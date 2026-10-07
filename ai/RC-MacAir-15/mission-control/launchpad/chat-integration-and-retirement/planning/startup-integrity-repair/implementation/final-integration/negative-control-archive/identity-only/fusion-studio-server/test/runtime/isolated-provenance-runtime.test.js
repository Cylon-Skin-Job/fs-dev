'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const childProcess = require('child_process');
const {
  EXPECTED_RUNTIME_EFFECTS,
  EXPECTED_STARTUP_EFFECTS,
  AGENT_TOOL_FIXTURE_THREAD_ID,
  MARKER,
  createIsolatedProvenanceRuntime,
  installEarlyIsolatedProvenanceGuards,
} = require('../../lib/testing/isolated-provenance-runtime');

const ownedRoots = [];

function emptyAuditDb() {
  return {
    where() { return this; },
    join() { return this; },
    select() { return this; },
    orderBy: async () => [],
  };
}

function marker(directory, nonce) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, MARKER), `${nonce}\n`, { encoding: 'utf8', flag: 'wx' });
  return directory;
}

function fixture(overrides = {}) {
  const nonce = randomUUID();
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'fusion-provenance-runtime-test-'));
  ownedRoots.push({ root, nonce });
  marker(root, nonce);
  const appData = marker(path.join(root, 'app-data'), nonce);
  const workspaceA = marker(path.join(root, 'workspace-a'), nonce);
  const workspaceB = marker(path.join(root, 'workspace-b'), nonce);
  const environment = {
    NODE_ENV: 'test',
    FUSION_LOCAL_MACHINE: 'Test-Provenance',
    FUSION_APP_USER_DATA: appData,
    FUSION_PROVENANCE_TEST_MODE: 'isolated-v1',
    FUSION_PROVENANCE_TEST_NONCE: nonce,
    FUSION_PROVENANCE_TEST_ROOT: root,
    FUSION_PROVENANCE_TEST_SCENARIO: 'normal',
    FUSION_PROVENANCE_TEST_WORKSPACES: JSON.stringify([
      { id: 'A', label: 'Workspace A', repoPath: workspaceA },
      { id: 'B', label: 'Workspace B', repoPath: workspaceB },
    ]),
    ...overrides,
  };
  return {
    nonce,
    root,
    appData,
    environment,
    dbPath: path.join(appData, 'server-data', 'fusion.db'),
  };
}

afterEach(() => {
  for (const { root, nonce } of ownedRoots.splice(0)) {
    expect(fs.readFileSync(path.join(root, MARKER), 'utf8')).toBe(`${nonce}\n`);
    fs.rmSync(root, { recursive: true, force: false });
  }
});

test('production-default path is inert and preserves the owner', async () => {
  const owner = Object.freeze({ verifyReservation() {}, installPublishers() {} });
  const runtime = createIsolatedProvenanceRuntime({ environment: {}, port: 3001, dbPath: '/not-used' });
  expect(runtime.enabled).toBe(false);
  expect(runtime.wrapFileSaveOwner(owner)).toBe(owner);
  runtime.installObservationGuards();
  let starts = 0;
  runtime.defineStartupEffect(EXPECTED_STARTUP_EFFECTS[0], () => { starts += 1; }).start();
  runtime.defineRuntimeEffect(EXPECTED_RUNTIME_EFFECTS[0], () => { starts += 1; }).start();
  expect(starts).toBe(2);
  runtime.restoreObservationGuards();
  await expect(runtime.initializeProfile()).resolves.toBeUndefined();
  await expect(runtime.provisionAgentToolThread()).resolves.toBeNull();
  await expect(runtime.finalizeStartupAudit()).resolves.toBeUndefined();
});

test('isolated agent-tool thread identity is process-owned and not request-selected', async () => {
  const input = fixture();
  const runtime = createIsolatedProvenanceRuntime({
    environment: input.environment,
    port: 43127,
    dbPath: input.dbPath,
    repositoryRoot: '/definitely-separate/repository',
    applicationSupport: '/definitely-separate/Application Support',
  });
  const provision = jest.fn().mockResolvedValue(undefined);

  await expect(runtime.provisionAgentToolThread(provision))
    .resolves.toBe(AGENT_TOOL_FIXTURE_THREAD_ID);
  expect(provision).toHaveBeenCalledWith({
    workspaceId: 'A',
    projectRoot: expect.stringMatching(/workspace-a$/),
    threadId: AGENT_TOOL_FIXTURE_THREAD_ID,
  });
  await expect(runtime.provisionAgentToolThread())
    .rejects.toThrow('thread provisioner is required');
});

test('isolated mode records every routed startup factory and proves zero invocation', async () => {
  const input = fixture();
  const runtime = createIsolatedProvenanceRuntime({
    environment: input.environment,
    port: 43127,
    dbPath: input.dbPath,
    repositoryRoot: '/definitely-separate/repository',
    applicationSupport: '/definitely-separate/Application Support',
  });
  runtime.installObservationGuards();
  try {
    expect(runtime.enabled).toBe(true);
    await expect(runtime.finalizeStartupAudit(emptyAuditDb))
      .rejects.toThrow('startup effect coverage incomplete');
    const invoked = [];
    for (const name of EXPECTED_STARTUP_EFFECTS) {
      runtime.defineStartupEffect(name, () => invoked.push(name)).start();
    }
    for (const name of EXPECTED_RUNTIME_EFFECTS) {
      runtime.defineRuntimeEffect(name, () => invoked.push(name));
    }
    expect(invoked).toEqual([]);
    expect(() => runtime.defineStartupEffect(EXPECTED_STARTUP_EFFECTS[0], () => {})).toThrow('effect repeated');
    await runtime.finalizeStartupAudit(emptyAuditDb);
    const audit = JSON.parse(fs.readFileSync(runtime.auditPath, 'utf8'));
    expect(audit.startupEffects).toEqual(EXPECTED_STARTUP_EFFECTS.map((name) => ({
      name,
      startRequests: 1,
      blockedRequests: 1,
      prohibitedAttempts: 0,
      factoryInvocations: 0,
    })).sort((left, right) => left.name.localeCompare(right.name)));
    expect(audit.observationGuards).toEqual({
      installed: true,
      attempts: { childProcess: 0, filesystemWatch: 0 },
    });
    expect(audit.runtimeEffects).toEqual(EXPECTED_RUNTIME_EFFECTS.map((name) => ({
      name,
      startRequests: 0,
      blockedRequests: 0,
      prohibitedAttempts: 0,
      factoryInvocations: 0,
    })));
  } finally {
    runtime.restoreObservationGuards();
  }
});

test('isolated startup factories fail closed if a prohibited effect is attempted', async () => {
  const input = fixture();
  const runtime = createIsolatedProvenanceRuntime({
    environment: input.environment,
    port: 43127,
    dbPath: input.dbPath,
    repositoryRoot: '/definitely-separate/repository',
    applicationSupport: '/definitely-separate/Application Support',
  });
  runtime.installObservationGuards();
  try {
    const effects = EXPECTED_STARTUP_EFFECTS.map((name) => ({
      name,
      effect: runtime.defineStartupEffect(name, () => {
        throw new Error('prohibited factory body must not run');
      }),
    }));
    for (const name of EXPECTED_RUNTIME_EFFECTS) {
      runtime.defineRuntimeEffect(name, () => {
        throw new Error('prohibited runtime factory body must not run');
      });
    }
    for (const { effect } of effects) effect.start();
    for (const { name, effect } of effects) {
      expect(() => effect.attempt()).toThrow(`prohibited startup effect attempted: ${name}`);
    }
    await expect(runtime.finalizeStartupAudit(emptyAuditDb))
      .rejects.toThrow('prohibited startup effect observed');
  } finally {
    runtime.restoreObservationGuards();
  }
});

test('isolated global observation guards fail closed on watcher and child-process starts', () => {
  const input = fixture();
  const runtime = createIsolatedProvenanceRuntime({
    environment: input.environment,
    port: 43127,
    dbPath: input.dbPath,
    repositoryRoot: '/definitely-separate/repository',
    applicationSupport: '/definitely-separate/Application Support',
  });
  runtime.installObservationGuards();
  try {
    expect(() => fs.watch(input.root, () => {})).toThrow('filesystemWatch startup attempted');
    expect(() => childProcess.spawn('/usr/bin/true')).toThrow('childProcess startup attempted');
  } finally {
    runtime.restoreObservationGuards();
  }
});

test('early isolated guard is installed before modules can capture spawn', () => {
  const input = fixture();
  installEarlyIsolatedProvenanceGuards(input.environment);
  const capturedSpawn = childProcess.spawn;
  const runtime = createIsolatedProvenanceRuntime({
    environment: input.environment,
    port: 43127,
    dbPath: input.dbPath,
    repositoryRoot: '/definitely-separate/repository',
    applicationSupport: '/definitely-separate/Application Support',
  });
  runtime.installObservationGuards();
  try {
    expect(() => capturedSpawn('/usr/bin/true')).toThrow('childProcess startup attempted');
  } finally {
    runtime.restoreObservationGuards();
  }
});

test.each([
  ['development port', { port: 3001 }, 'unique non-development port'],
  ['normal machine', { environment: { FUSION_LOCAL_MACHINE: 'RC-MacAir-15' } }, 'FUSION_LOCAL_MACHINE=Test-Provenance'],
  ['normal process mode', { environment: { NODE_ENV: 'development' } }, 'NODE_ENV=test'],
])('isolated mode refuses %s', (_label, mutation, message) => {
  const input = fixture(mutation.environment);
  expect(() => createIsolatedProvenanceRuntime({
    environment: input.environment,
    port: mutation.port || 43127,
    dbPath: input.dbPath,
    repositoryRoot: '/definitely-separate/repository',
    applicationSupport: '/definitely-separate/Application Support',
  })).toThrow(message);
});

test('isolated mode refuses unowned workspace paths and a database outside its profile', () => {
  const input = fixture();
  const manifest = JSON.parse(input.environment.FUSION_PROVENANCE_TEST_WORKSPACES);
  const unowned = path.join(input.root, 'unowned-workspace');
  fs.mkdirSync(unowned);
  manifest[1].repoPath = unowned;
  expect(() => createIsolatedProvenanceRuntime({
    environment: { ...input.environment, FUSION_PROVENANCE_TEST_WORKSPACES: JSON.stringify(manifest) },
    port: 43127,
    dbPath: input.dbPath,
    repositoryRoot: '/definitely-separate/repository',
    applicationSupport: '/definitely-separate/Application Support',
  })).toThrow('not test-owned');
  expect(() => createIsolatedProvenanceRuntime({
    environment: input.environment,
    port: 43127,
    dbPath: path.join(input.root, 'fusion.db'),
    repositoryRoot: '/definitely-separate/repository',
    applicationSupport: '/definitely-separate/Application Support',
  })).toThrow('database is not inside the owned profile');
});

test.each([
  ['developer checkout', 'repositoryRoot', 'repository'],
  ['normal profile', 'applicationSupport', 'Application Support'],
])('isolated mode refuses paths overlapping the %s', (_label, rootName, message) => {
  const input = fixture();
  expect(() => createIsolatedProvenanceRuntime({
    environment: input.environment,
    port: 43127,
    dbPath: input.dbPath,
    repositoryRoot: rootName === 'repositoryRoot' ? input.root : '/definitely-separate/repository',
    applicationSupport: rootName === 'applicationSupport' ? input.root : '/definitely-separate/Application Support',
  })).toThrow(message);
});
