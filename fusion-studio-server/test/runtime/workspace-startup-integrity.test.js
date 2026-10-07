'use strict';

const fs = require('fs');
const path = require('path');
const { createStartupEntryFixture } = require('./fixtures/startup-entry-fixture');

// Deliberately independent of the implementation's exported expected array.
const STARTUP_EFFECTS = [
  'calendar-adapters', 'calendar-broadcaster', 'cli-config-bootstrap',
  'harness-broadcaster', 'harness-status-revalidation', 'theme-css-bootstrap',
  'workspace-automation-pipeline',
];

test('actual normal startup/listen invokes preserved automation consumers once', async () => {
  const fixture = await createStartupEntryFixture({ preimageRoot: process.env.STARTUP_INTEGRITY_PREIMAGE_ROOT });
  try {
    await fixture.start();
    // Do not accept a healthy listen/returned handler as automation evidence.
    if (process.env.STARTUP_INTEGRITY_PREIMAGE_ROOT) {
      const rejection = fixture.errors.find(args => args[0] === '[Server] Pipeline init error:');
      if (rejection) process.stderr.write(`Preimage startup pipeline error: ${rejection[1]?.message}\n`);
    }
    expect(fixture.componentLoad).toHaveBeenCalledTimes(1);
    expect(fixture.readiness.stages.map(item => item.name)).toEqual([
      'resolveViewRoot', 'resolveOperationalViewRoot', 'script', 'components', 'actions',
      'resolveOperationalViewRoot', 'triggers', 'cron-factory', 'cron-register', 'cron-start', 'runner',
    ]);
    for (const stage of fixture.readiness.stages) {
      expect(stage.status).toMatchObject({ status: 'ready', verified: true, phase: 'journal_verified', leases: 1 });
    }
    const operations = fixture.readiness.events.filter(item => item.kind === 'operation-ensure');
    expect(operations).toHaveLength(1);
    expect(operations[0].input).toEqual(fixture.readiness.context);
    const acquired = fixture.readiness.events.find(item => item.kind === 'acquired');
    expect(acquired).toMatchObject({ input: fixture.readiness.context, status: { leases: 1 }, lease: {
      verified: true, phase: 'journal_verified', projectRoot: fixture.workspaces[0].repoPath,
      viewsRoot: fixture.workspace.viewsRoot,
    } });
    expect(fixture.readiness.events.indexOf(acquired)).toBeGreaterThan(
      fixture.readiness.events.findLastIndex(item => item.kind === 'verified'),
    );
    expect(fixture.readiness.events.filter(item => item.kind === 'released')).toHaveLength(1);
    expect(fixture.readiness.runtime.getViewReadinessStatus(fixture.readiness.context)).toMatchObject({ leases: 0 });
    expect(fixture.errors.filter(args => args[0] === '[Server] Pipeline init error:')).toEqual([]);
    expect(fixture.componentLoad).toHaveBeenCalledWith(path.join(fixture.workspaces[0].repoPath, 'ai/components'));
    expect(fixture.components.getModalDefinition('scratch')).toMatchObject({ config: { name: 'scratch-modal' } });
    expect(fixture.actionWiring).toHaveBeenCalledTimes(1);
    expect(fixture.heartbeatStart).toHaveBeenCalledTimes(1);
    const bus = require('../../lib/event-bus');
    for (const type of ['chat', 'ticket', 'agent', 'system']) {
      const topic = `${type}:startup-canary`;
      expect(bus.bus.listenerCount(topic)).toBe(1);
      bus.emit(topic);
    }
    expect(fixture.messages.filter(item => item.type === 'system_message').map(item => item.content))
      .toEqual(['scratch-chat', 'scratch-ticket', 'scratch-agent', 'scratch-system']);
    expect(fixture.cronFactory).toHaveBeenCalledTimes(1);
    expect(fixture.cronSchedulers[0].getJobs()).toHaveLength(1);
    const cron = fixture.cronIntervals;
    expect(cron).toHaveLength(1);
    cron[0].callback();
    cron[0].callback();
    expect(fs.readFileSync(fixture.workspace.ticketReceipts, 'utf8').trim().split('\n').map(JSON.parse))
      .toEqual([{ kind: 'script-loaded' }, expect.objectContaining({ kind: 'ticket', title: 'scratch-cron', assignee: 'scratch' })]);
    expect(fixture.intervals.filter(item => item.delay === 300_000)).toHaveLength(1);
  } finally {
    await fixture.cleanup();
  }
}, 30_000);

function expectNoPipeline(fixture) {
  expect(fixture.readiness.stages).toEqual([]);
  expect(fixture.componentLoad).not.toHaveBeenCalled();
  expect(fixture.actionWiring).not.toHaveBeenCalled();
  expect(fixture.heartbeatStart).not.toHaveBeenCalled();
  expect(fixture.cronFactory).not.toHaveBeenCalled();
  expect(fs.existsSync(fixture.workspace.ticketReceipts)).toBe(false);
  expect(fixture.readiness.events.filter(item => item.kind === 'acquired')).toEqual([]);
}

test('actual unavailable startup refuses all consumers after genuine registered readiness conflict', async () => {
  const fixture = await createStartupEntryFixture({
    preimageRoot: process.env.STARTUP_INTEGRITY_PREIMAGE_ROOT, readiness: { conflict: true },
  });
  try {
    await fixture.start();
    expect(fixture.readiness.registeredStatus).toMatchObject({ status: 'unavailable', verified: false, errorCode: 'root_conflict' });
    expect(fixture.controller.getActiveWorkspaceId()).toBe('A');
    expect(fixture.runtimeModule.EXPECTED_STARTUP_EFFECTS).toContain('workspace-automation-pipeline');
    expect(fixture.errors.filter(args => args[0] === '[Server] Pipeline init error:')).toEqual([]);
    expectNoPipeline(fixture);
    expect(fixture.readiness.events.filter(item => item.kind === 'operation-ensure')).toHaveLength(1);
  } finally { await fixture.cleanup(); }
}, 30_000);

test('actual preparing startup waits for real migration verification before consumers and lease', async () => {
  const fixture = await createStartupEntryFixture({ readiness: { preparing: true } });
  let starting;
  try {
    starting = fixture.start();
    await fixture.readiness.preparationEntered;
    await fixture.readiness.operationEntered;
    expect(fixture.readiness.runtime.getViewReadinessStatus(fixture.readiness.context)).toMatchObject({ status: 'preparing', leases: 0 });
    expectNoPipeline(fixture);
    expect(fixture.readiness.events.filter(item => item.kind === 'operation-ensure')).toHaveLength(1);
    fixture.readiness.releasePreparation();
    await starting;
    expect(fixture.componentLoad).toHaveBeenCalledTimes(1);
    for (const stage of fixture.readiness.stages) expect(stage.status).toMatchObject({ verified: true, leases: 1 });
    expect(fixture.readiness.runtime.getViewReadinessStatus(fixture.readiness.context)).toMatchObject({ status: 'ready', leases: 0 });
  } finally {
    fixture.readiness.releasePreparation();
    await starting?.catch(() => {});
    await fixture.cleanup();
  }
}, 30_000);

test('actual startup retirement during scratch script waits for lease and denies late work', async () => {
  const fixture = await createStartupEntryFixture({ readiness: { retireDuringScript: true } });
  try {
    await fixture.start();
    expect(fixture.componentLoad).toHaveBeenCalledTimes(1);
    expect(fixture.heartbeatStart).toHaveBeenCalledTimes(1);
    for (const stage of fixture.readiness.stages) {
      expect(stage.status.leases).toBe(1);
      expect(stage.retirementCompleted).toBe(false);
    }
    expect(fixture.readiness.leaseDenial).toBe('view_registry_unavailable');
    await expect(fixture.readiness.lateAdmission).resolves.toEqual({ code: 'view_registry_unavailable' });
    await fixture.readiness.retirement;
    expect(fixture.readiness.retirementCompleted).toBe(true);
    expect(fixture.readiness.events.find(item => item.kind === 'retirement-effect').status.leases).toBe(0);
    expect(fixture.readiness.events.filter(item => item.kind === 'released')).toHaveLength(1);
  } finally { await fixture.cleanup(); }
}, 30_000);

test.each(['retiring', 'retireBeforeAcquire'])('actual startup refuses %s readiness with zero consumer work', async mode => {
  const fixture = await createStartupEntryFixture({ readiness: { [mode]: true, holdRetirement: true } });
  try {
    await fixture.start();
    expectNoPipeline(fixture);
    expect(fixture.readiness.retirementCompleted).toBe(false);
    expect(fixture.readiness.runtime.getViewReadinessStatus(fixture.readiness.context)).toMatchObject({ verified: false, leases: 0 });
    expect(fixture.errors.filter(args => args[0] === '[Server] Pipeline init error:')).toEqual([]);
  } finally { await fixture.cleanup(); }
}, 30_000);

test('actual startup relocates capsules and loads only the canonical-root script under lease', async () => {
  const fixture = await createStartupEntryFixture({ readiness: { relocate: true } });
  try {
    expect(fs.existsSync(fixture.viewSetup.oldRoot)).toBe(true);
    await fixture.start();
    expect(fs.existsSync(fixture.viewSetup.oldRoot)).toBe(false);
    const scripts = fixture.readiness.stages.filter(item => item.name === 'script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].details.scriptRoot).toBe(path.join(fixture.workspace.viewsRoot, '001-issues-viewer/scripts'));
    expect(scripts[0].status).toMatchObject({ verified: true, leases: 1 });
    const verified = fixture.readiness.events.filter(item => item.kind === 'verified');
    expect(verified.at(-1).result).toMatchObject({
      workspaceId: 'A', machineIdentity: 'Test-Provenance', projectRoot: fixture.workspaces[0].repoPath,
      destinationRoot: fixture.workspace.viewsRoot,
    });
    expect(fixture.componentLoad).toHaveBeenCalledTimes(1);
    expect(fixture.heartbeatStart).toHaveBeenCalledTimes(1);
  } finally { await fixture.cleanup(); }
}, 30_000);

test('actual startup releases lease and uses existing catch after downstream initialization failure', async () => {
  const fixture = await createStartupEntryFixture({ readiness: { failPipeline: true } });
  try {
    await fixture.start();
    expect(fixture.errors.filter(args => args[0] === '[Server] Pipeline init error:'))
      .toEqual([['[Server] Pipeline init error:', expect.objectContaining({ message: 'scratch downstream initialization failure' })]]);
    expect(fixture.componentLoad).toHaveBeenCalledTimes(1);
    expect(fixture.actionWiring).not.toHaveBeenCalled();
    expect(fixture.readiness.stages.at(-1)).toMatchObject({ name: 'components', status: { leases: 1 } });
    expect(fixture.readiness.events.filter(item => item.kind === 'released')).toHaveLength(1);
    expect(fixture.readiness.runtime.getViewReadinessStatus(fixture.readiness.context)).toMatchObject({ leases: 0 });
  } finally { await fixture.cleanup(); }
}, 30_000);

test.each([
  { missingRoot: true }, { missingId: true }, { missingRoot: true, missingId: true },
])('actual startup skips all view work when workspace identity is incomplete: %j', async readiness => {
  const fixture = await createStartupEntryFixture({ readiness });
  try {
    await fixture.start();
    expectNoPipeline(fixture);
    expect(fixture.readiness.events.filter(item => item.kind === 'operation-ensure')).toEqual([]);
    expect(fixture.errors.filter(args => args[0] === '[Server] Pipeline init error:')).toEqual([]);
  } finally { await fixture.cleanup(); }
}, 30_000);

test('failed actual isolated startup restores guards, timers, listeners and owned database', async () => {
  const fixture = await createStartupEntryFixture({ isolated: true, failAfterDbInit: true });
  try {
    await expect(fixture.start()).rejects.toThrow('scratch startup database failure');
    expect(fixture.componentLoad).not.toHaveBeenCalled();
  } finally {
    await fixture.cleanup();
  }
  expect(fs.existsSync(fixture.root)).toBe(false);
  expect(() => fixture.db.getDb()).toThrow('DB not initialized');
}, 30_000);

test('actual isolated startup registers seven effects once and blocks every factory under guards', async () => {
  const fixture = await createStartupEntryFixture({ isolated: true });
  try {
    await fixture.start();
    const audit = JSON.parse(fs.readFileSync(path.join(fixture.appData, 'isolated-provenance-audit.json')));
    expect(audit.port).toBe(fixture.port);
    expect(audit.port).not.toBe(3001);
    expect(audit.dbExists).toBe(true);
    expect(audit.registeredWorkspaces).toEqual(fixture.workspaces.map(({ id, repoPath }) => ({ id, repoPath })));
    expect(audit.startupEffects).toEqual(STARTUP_EFFECTS.map(name => ({
      name, startRequests: 1, blockedRequests: 1, prohibitedAttempts: 0, factoryInvocations: 0,
    })));
    expect(audit.observationGuards).toEqual({ installed: true, attempts: { childProcess: 0, filesystemWatch: 0 } });
    expect(fixture.componentLoad).not.toHaveBeenCalled();
    expect(fixture.actionWiring).not.toHaveBeenCalled();
    expect(fixture.heartbeatStart).not.toHaveBeenCalled();
    expect(fs.existsSync(fixture.workspace.ticketReceipts)).toBe(false);
    expect(audit.registryAuthority.schemas.length).toBeGreaterThan(0);
  } finally {
    await fixture.cleanup();
  }
}, 30_000);
