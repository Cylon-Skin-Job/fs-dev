'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const MODE = 'isolated-v1';
const MACHINE = 'Test-Provenance';
const MARKER = '.fusion-provenance-test-owned';
const EXPECTED_STARTUP_EFFECTS = Object.freeze([
  'calendar-adapters',
  'calendar-broadcaster',
  'cli-config-bootstrap',
  'harness-broadcaster',
  'harness-status-revalidation',
  'hotkey-screenshot-watcher',
  'theme-css-bootstrap',
  'workspace-watcher-trigger-pipeline',
]);
const EXPECTED_RUNTIME_EFFECTS = Object.freeze([
  'harness-http-revalidation',
]);
const CHILD_PROCESS_METHODS = Object.freeze([
  'exec',
  'execFile',
  'execFileSync',
  'execSync',
  'fork',
  'spawn',
  'spawnSync',
]);

function isInside(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readOwnedMarker(directory, nonce) {
  const markerPath = path.join(directory, MARKER);
  let marker;
  try {
    marker = fs.readFileSync(markerPath, 'utf8');
  } catch (_error) {
    throw new Error(`isolated provenance path is not test-owned: ${directory}`);
  }
  if (marker !== `${nonce}\n`) {
    throw new Error(`isolated provenance ownership marker does not match: ${directory}`);
  }
}

function assertSafeDirectory(directory, { nonce, testRoot, repositoryRoot, applicationSupport }) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
    throw new Error('isolated provenance paths must be absolute');
  }
  const resolved = path.resolve(directory);
  if (!isInside(resolved, testRoot)) {
    throw new Error(`isolated provenance path is outside the owned root: ${resolved}`);
  }
  if (isInside(resolved, repositoryRoot) || isInside(repositoryRoot, resolved)) {
    throw new Error(`isolated provenance path overlaps the repository: ${resolved}`);
  }
  if (isInside(resolved, applicationSupport) || isInside(applicationSupport, resolved)) {
    throw new Error(`isolated provenance path overlaps Application Support: ${resolved}`);
  }
  readOwnedMarker(resolved, nonce);
  return resolved;
}

function parseWorkspaces(raw) {
  let value;
  try {
    value = JSON.parse(raw || '');
  } catch (_error) {
    throw new Error('isolated provenance workspace manifest is invalid');
  }
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('isolated provenance requires exactly two workspaces');
  }
  const ids = new Set();
  return value.map((workspace, index) => {
    if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
      throw new Error('isolated provenance workspace entry is invalid');
    }
    const keys = Object.keys(workspace).sort().join(',');
    if (keys !== 'id,label,repoPath') {
      throw new Error('isolated provenance workspace entry has unknown fields');
    }
    if (typeof workspace.id !== 'string' || !workspace.id || ids.has(workspace.id)) {
      throw new Error('isolated provenance workspace ID is invalid');
    }
    if (typeof workspace.label !== 'string' || !workspace.label) {
      throw new Error('isolated provenance workspace label is invalid');
    }
    ids.add(workspace.id);
    return Object.freeze({ ...workspace, sortOrder: index });
  });
}

function createEffectRegistry(enabled, expectedEffects, effectKind, onChange = () => {}) {
  const effects = new Map();

  function defineEffect(name, factory) {
    if (!expectedEffects.includes(name)) {
      throw new Error(`unknown isolated provenance ${effectKind} effect: ${name}`);
    }
    if (typeof factory !== 'function') {
      throw new TypeError(`isolated provenance ${effectKind} effect requires a factory: ${name}`);
    }
    if (effects.has(name)) {
      throw new Error(`isolated provenance ${effectKind} effect repeated: ${name}`);
    }
    const state = {
      name,
      startRequests: 0,
      blockedRequests: 0,
      prohibitedAttempts: 0,
      factoryInvocations: 0,
    };
    effects.set(name, state);

    function invokeFactory(args) {
      state.factoryInvocations += 1;
      onChange();
      return factory(...args);
    }

    return Object.freeze({
      start(...args) {
        state.startRequests += 1;
        if (enabled) {
          state.blockedRequests += 1;
          onChange();
          return undefined;
        }
        return invokeFactory(args);
      },
      attempt(...args) {
        if (enabled) {
          state.prohibitedAttempts += 1;
          onChange();
          throw new Error(`isolated provenance prohibited ${effectKind} effect attempted: ${name}`);
        }
        return invokeFactory(args);
      },
    });
  }

  function snapshot() {
    return [...effects.values()]
      .map((state) => Object.freeze({ ...state }))
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  }

  return Object.freeze({ defineEffect, snapshot });
}

function createGlobalObservationGuards(enabled) {
  const attempts = {
    childProcess: 0,
    filesystemWatch: 0,
  };
  let installed = false;
  let originals = null;
  let onChange = () => {};

  function fail(kind) {
    attempts[kind] += 1;
    onChange();
    throw new Error(`isolated provenance prohibited ${kind} startup attempted`);
  }

  function install() {
    if (!enabled) return;
    if (installed) return;
    installed = true;
    originals = {
      fsWatch: fs.watch,
      fsWatchFile: fs.watchFile,
      childProcessPrototypeSpawn: childProcess.ChildProcess.prototype.spawn,
      childProcessMethods: new Map(),
    };
    fs.watch = function guardedWatch() { return fail('filesystemWatch'); };
    fs.watchFile = function guardedWatchFile() { return fail('filesystemWatch'); };
    childProcess.ChildProcess.prototype.spawn = function guardedChildProcessSpawn() {
      return fail('childProcess');
    };
    for (const method of CHILD_PROCESS_METHODS) {
      if (typeof childProcess[method] !== 'function') continue;
      originals.childProcessMethods.set(method, childProcess[method]);
      childProcess[method] = function guardedChildProcessMethod() { return fail('childProcess'); };
    }
  }

  function restore() {
    if (!enabled || !installed) return;
    fs.watch = originals.fsWatch;
    fs.watchFile = originals.fsWatchFile;
    childProcess.ChildProcess.prototype.spawn = originals.childProcessPrototypeSpawn;
    for (const [method, original] of originals.childProcessMethods) childProcess[method] = original;
    installed = false;
    originals = null;
  }

  return Object.freeze({
    install,
    restore,
    setOnChange(callback) {
      if (typeof callback !== 'function') throw new TypeError('observation guard callback must be a function');
      onChange = callback;
    },
    snapshot() {
      return Object.freeze({ installed, attempts: Object.freeze({ ...attempts }) });
    },
  });
}

let earlyObservationGuards = null;

function installEarlyIsolatedProvenanceGuards(environment = process.env) {
  if (environment.FUSION_PROVENANCE_TEST_MODE !== MODE) return;
  if (environment.NODE_ENV !== 'test') {
    throw new Error('isolated provenance mode requires NODE_ENV=test');
  }
  if (!earlyObservationGuards) {
    earlyObservationGuards = createGlobalObservationGuards(true);
    earlyObservationGuards.install();
  }
}

function takeEarlyObservationGuards() {
  const guards = earlyObservationGuards;
  earlyObservationGuards = null;
  return guards;
}

function createDisabledRuntime() {
  const startupEffects = createEffectRegistry(false, EXPECTED_STARTUP_EFFECTS, 'startup');
  const runtimeEffects = createEffectRegistry(false, EXPECTED_RUNTIME_EFFECTS, 'runtime');
  const observationGuards = createGlobalObservationGuards(false);
  return Object.freeze({
    enabled: false,
    defineRuntimeEffect: runtimeEffects.defineEffect,
    defineStartupEffect: startupEffects.defineEffect,
    installObservationGuards: observationGuards.install,
    restoreObservationGuards: observationGuards.restore,
    wrapFileSaveOwner(owner) { return owner; },
    async initializeProfile() {},
    async finalizeStartupAudit() {},
  });
}

function createIsolatedProvenanceRuntime({
  environment = process.env,
  port,
  dbPath,
  repositoryRoot = path.resolve(__dirname, '..', '..', '..'),
  applicationSupport = path.join(os.homedir(), 'Library', 'Application Support'),
} = {}) {
  if (environment.FUSION_PROVENANCE_TEST_MODE !== MODE) return createDisabledRuntime();
  if (environment.NODE_ENV !== 'test') {
    throw new Error('isolated provenance mode requires NODE_ENV=test');
  }
  if (environment.FUSION_LOCAL_MACHINE !== MACHINE) {
    throw new Error(`isolated provenance mode requires FUSION_LOCAL_MACHINE=${MACHINE}`);
  }
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 || port === 3001) {
    throw new Error('isolated provenance mode requires a unique non-development port');
  }
  const nonce = environment.FUSION_PROVENANCE_TEST_NONCE;
  if (typeof nonce !== 'string' || !/^[0-9a-f-]{36}$/u.test(nonce)) {
    throw new Error('isolated provenance ownership nonce is invalid');
  }
  const testRoot = path.resolve(environment.FUSION_PROVENANCE_TEST_ROOT || '');
  readOwnedMarker(testRoot, nonce);
  const appData = assertSafeDirectory(environment.FUSION_APP_USER_DATA, {
    nonce, testRoot, repositoryRoot, applicationSupport,
  });
  const workspaces = parseWorkspaces(environment.FUSION_PROVENANCE_TEST_WORKSPACES).map((workspace) => Object.freeze({
    ...workspace,
    repoPath: assertSafeDirectory(workspace.repoPath, {
      nonce, testRoot, repositoryRoot, applicationSupport,
    }),
  }));
  const expectedDbPath = path.join(appData, 'server-data', 'fusion.db');
  if (path.resolve(dbPath) !== expectedDbPath) {
    throw new Error('isolated provenance database is not inside the owned profile');
  }
  const auditPath = path.join(appData, 'isolated-provenance-audit.json');
  const scenario = environment.FUSION_PROVENANCE_TEST_SCENARIO || 'normal';
  if (!['normal', 'fact-publish-failure', 'agent-tool-live', 'agent-tool-restart'].includes(scenario)) {
    throw new Error('isolated provenance scenario is invalid');
  }
  let auditBase = null;
  let startupEffects;
  let runtimeEffects;
  const observationGuards = takeEarlyObservationGuards() || createGlobalObservationGuards(true);
  function writeAuditSnapshot() {
    if (!auditBase) return;
    const audit = Object.freeze({
      ...auditBase,
      startupEffects: startupEffects.snapshot(),
      runtimeEffects: runtimeEffects.snapshot(),
      observationGuards: observationGuards.snapshot(),
    });
    fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  }
  startupEffects = createEffectRegistry(
    true,
    EXPECTED_STARTUP_EFFECTS,
    'startup',
    writeAuditSnapshot,
  );
  runtimeEffects = createEffectRegistry(
    true,
    EXPECTED_RUNTIME_EFFECTS,
    'runtime',
    writeAuditSnapshot,
  );
  observationGuards.setOnChange(writeAuditSnapshot);
  let failedResourcePublication = false;

  async function initializeProfile(db) {
    await db.transaction(async (trx) => {
      await trx('workspace_screenshots').del();
      await trx('workspace_themes').del();
      await trx('workspaces').del();
      await trx('workspaces').insert(workspaces.map((workspace) => ({
        id: workspace.id,
        label: workspace.label,
        icon: 'folder_code',
        description: 'Isolated provenance acceptance fixture',
        repo_path: workspace.repoPath,
        sort_order: workspace.sortOrder,
        type: 'code',
        ribbon_visible: 1,
        ribbon_sort_order: workspace.sortOrder,
      })));
      const now = Date.now();
      await trx('system_config').insert({
        key: 'last_active_workspace_id', value: workspaces[0].id, updated_at: now,
      }).onConflict('key').merge(['value', 'updated_at']);
      await trx('system_config').insert({
        key: 'local_machine_name', value: MACHINE, updated_at: now,
      }).onConflict('key').merge(['value', 'updated_at']);
    });
  }

  function wrapFileSaveOwner(owner) {
    if (scenario !== 'fact-publish-failure') return owner;
    return Object.freeze({
      verifyReservation: owner.verifyReservation,
      installPublishers(publishers) {
        owner.installPublishers(Object.freeze({
          publishFileCommandAccepted: publishers.publishFileCommandAccepted,
          async publishResourceMutated(input) {
            if (!failedResourcePublication) {
              failedResourcePublication = true;
              throw new Error('isolated provenance injected resource publication failure');
            }
            return publishers.publishResourceMutated(input);
          },
        }));
      },
    });
  }

  async function finalizeStartupAudit(db) {
    const effectSnapshot = startupEffects.snapshot();
    const effectByName = new Map(effectSnapshot.map((effect) => [effect.name, effect]));
    const missing = EXPECTED_STARTUP_EFFECTS.filter((name) => !effectByName.has(name));
    if (missing.length) {
      throw new Error(`isolated provenance startup effect coverage incomplete: ${missing.join(', ')}`);
    }
    const unsafeEffects = effectSnapshot.filter((effect) => (
      effect.startRequests !== 1
      || effect.blockedRequests !== 1
      || effect.prohibitedAttempts !== 0
      || effect.factoryInvocations !== 0
    ));
    if (unsafeEffects.length) {
      throw new Error(`isolated provenance prohibited startup effect observed: ${unsafeEffects.map(({ name }) => name).join(', ')}`);
    }
    const runtimeEffectSnapshot = runtimeEffects.snapshot();
    const runtimeEffectByName = new Map(runtimeEffectSnapshot.map((effect) => [effect.name, effect]));
    const missingRuntimeEffects = EXPECTED_RUNTIME_EFFECTS.filter((name) => !runtimeEffectByName.has(name));
    if (missingRuntimeEffects.length) {
      throw new Error(`isolated provenance runtime effect coverage incomplete: ${missingRuntimeEffects.join(', ')}`);
    }
    const unsafeRuntimeEffects = runtimeEffectSnapshot.filter((effect) => (
      effect.blockedRequests !== effect.startRequests
      || effect.prohibitedAttempts !== 0
      || effect.factoryInvocations !== 0
    ));
    if (unsafeRuntimeEffects.length) {
      throw new Error(`isolated provenance prohibited runtime effect observed: ${unsafeRuntimeEffects.map(({ name }) => name).join(', ')}`);
    }
    const guardSnapshot = observationGuards.snapshot();
    if (!guardSnapshot.installed) {
      throw new Error('isolated provenance observation guards were not installed');
    }
    if (guardSnapshot.attempts.childProcess !== 0 || guardSnapshot.attempts.filesystemWatch !== 0) {
      throw new Error('isolated provenance prohibited global startup effect observed');
    }
    const dbExists = fs.existsSync(expectedDbPath);
    const registeredWorkspaces = await db('workspaces')
      .select('id', 'repo_path')
      .orderBy('sort_order', 'asc');
    const lockedSchemas = await db('event_schema_registry')
      .where({ owner_kind: 'system', locked: 1 })
      .select(
        'schema_id', 'schema_key', 'schema_version', 'definition_kind',
        'owner_id', 'status', 'definition_sha256',
      )
      .orderBy('schema_id', 'asc');
    const lockedSubscriptions = await db('event_subscription_registry')
      .where({ owner_kind: 'system', locked: 1 })
      .select(
        'subscription_id', 'owner_id', 'status', 'handler_key', 'priority',
        'delivery_policy', 'definition_sha256',
      )
      .orderBy('subscription_id', 'asc');
    const lockedGrants = await db('event_subscription_grants as grants')
      .join('event_subscription_registry as subscriptions', 'subscriptions.subscription_id', 'grants.subscription_id')
      .where({ 'subscriptions.owner_kind': 'system', 'subscriptions.locked': 1 })
      .select(
        'grants.subscription_id', 'grants.capability_key', 'grants.state',
        'grants.scope_json', 'grants.authorized_by_kind',
      )
      .orderBy([
        { column: 'grants.subscription_id', order: 'asc' },
        { column: 'grants.capability_key', order: 'asc' },
      ]);
    auditBase = Object.freeze({
      mode: MODE,
      machine: MACHINE,
      scenario,
      port,
      appData,
      dbPath: expectedDbPath,
      dbExists,
      workspaces: workspaces.map(({ id, repoPath }) => ({ id, repoPath })),
      registeredWorkspaces: registeredWorkspaces.map((workspace) => ({
        id: workspace.id,
        repoPath: workspace.repo_path,
      })),
      registryAuthority: {
        schemas: lockedSchemas,
        subscriptions: lockedSubscriptions,
        grants: lockedGrants,
      },
    });
    writeAuditSnapshot();
  }

  return Object.freeze({
    enabled: true,
    auditPath,
    defineRuntimeEffect: runtimeEffects.defineEffect,
    defineStartupEffect: startupEffects.defineEffect,
    installObservationGuards: observationGuards.install,
    restoreObservationGuards: observationGuards.restore,
    wrapFileSaveOwner,
    initializeProfile,
    finalizeStartupAudit,
  });
}

module.exports = {
  EXPECTED_RUNTIME_EFFECTS,
  EXPECTED_STARTUP_EFFECTS,
  MACHINE,
  MARKER,
  MODE,
  createIsolatedProvenanceRuntime,
  installEarlyIsolatedProvenanceGuards,
};
