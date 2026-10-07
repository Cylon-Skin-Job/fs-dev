'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { randomUUID } = require('crypto');
const { createStartupWorkspace } = require('./startup-workspace');
const { observeStartupResources } = require('./startup-failure-resources');

const SERVER_ROOT = path.resolve(__dirname, '../../..');
const MARKER = '.fusion-provenance-test-owned';
const MACHINE = 'Test-Provenance';

// These owners are outside the startup/effect/pipeline seam. All database,
// registry, readiness, component/action/trigger/cron and runner owners are real.
const EXTERNAL_STUBS = Object.freeze([
  'lib/screenshot/ws-handlers', // Screenshot capture/native integration.
  'lib/calendar/index', // External calendar adapters.
  'lib/harness/harness-status-service', // Provider executable probing.
  'lib/theme/themes-service', // Unrelated boot CSS generation.
  'lib/cli-config', // Unrelated workspace policy bootstrap.
]);

function ownedDirectory(directory, nonce) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, MARKER), `${nonce}\n`, { flag: 'wx' });
  return directory;
}

async function reservePort() {
  const probe = http.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  if (port === 3001 || port < 1024) return reservePort();
  return port;
}

function preimageStartup(root, preimageRoot) {
  const marker = JSON.parse(fs.readFileSync(path.join(preimageRoot, '.chat-ar-preimage-owner.json')));
  if (marker.purpose !== 'CHAT-AR-REPAIR-01 R1 exact audited preimages retained for R2') {
    throw new Error('startup preimage fixture ownership mismatch');
  }
  const shadow = path.join(root, 'audited-server');
  const shadowLib = path.join(shadow, 'lib');
  fs.mkdirSync(path.join(shadowLib, 'testing'), { recursive: true });
  for (const entry of fs.readdirSync(path.join(SERVER_ROOT, 'lib'))) {
    if (entry === 'startup.js' || entry === 'testing') continue;
    fs.symlinkSync(path.join(SERVER_ROOT, 'lib', entry), path.join(shadowLib, entry));
  }
  for (const entry of fs.readdirSync(path.join(SERVER_ROOT, 'lib/testing'))) {
    if (entry === 'isolated-provenance-runtime.js') continue;
    fs.symlinkSync(path.join(SERVER_ROOT, 'lib/testing', entry), path.join(shadowLib, 'testing', entry));
  }
  for (const relative of ['startup.js', 'testing/isolated-provenance-runtime.js']) {
    fs.copyFileSync(path.join(preimageRoot, 'fusion-studio-server/lib', relative), path.join(shadowLib, relative));
  }
  for (const entry of ['native', 'node_modules']) fs.symlinkSync(path.join(SERVER_ROOT, entry), path.join(shadow, entry));
  return path.join(shadowLib, 'startup.js');
}

async function createStartupEntryFixture({ isolated = false, preimageRoot, failAfterDbInit = false } = {}) {
  jest.resetModules();
  const nonce = randomUUID();
  const root = ownedDirectory(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'fusion-startup-canary-')), nonce);
  const appData = ownedDirectory(path.join(root, 'profile'), nonce);
  const workspaces = ['A', 'B'].map(id => ({
    id, label: `Scratch ${id}`, repoPath: ownedDirectory(path.join(root, `workspace-${id}`), nonce),
  }));
  const workspace = createStartupWorkspace(workspaces[0].repoPath, MACHINE);
  createStartupWorkspace(workspaces[1].repoPath, MACHINE);
  const port = await reservePort();
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test', PORT: String(port), FUSION_LOCAL_MACHINE: MACHINE,
    FUSION_APP_USER_DATA: appData,
    FUSION_PROVENANCE_TEST_MODE: isolated ? 'isolated-v1' : '',
    FUSION_PROVENANCE_TEST_ROOT: root, FUSION_PROVENANCE_TEST_NONCE: nonce,
    FUSION_PROVENANCE_TEST_WORKSPACES: JSON.stringify(workspaces),
    FUSION_PROVENANCE_TEST_SCENARIO: 'normal',
  });
  const startupPath = preimageRoot ? preimageStartup(root, preimageRoot) : path.join(SERVER_ROOT, 'lib/startup');
  const runtimePath = preimageRoot
    ? path.join(path.dirname(startupPath), 'testing/isolated-provenance-runtime')
    : path.join(SERVER_ROOT, 'lib/testing/isolated-provenance-runtime');
  const runtimeModule = require(runtimePath);
  const originals = { watch: fs.watch, watchFile: fs.watchFile, spawn: require('child_process').spawn };
  runtimeModule.installEarlyIsolatedProvenanceGuards();
  const intervals = [];
  const timeouts = new Set();
  const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((callback, delay, ...args) => {
    // Record the real consumer's scheduled callback; tests advance only scratch
    // cron work. No background clock can dispatch during startup or cleanup.
    const timer = { unref() {} };
    intervals.push({ callback: () => callback(...args), delay, timer });
    return timer;
  });
  const originalTimeout = global.setTimeout;
  const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay, ...args) => {
    const timer = originalTimeout(callback, delay, ...args);
    timeouts.add(timer);
    return timer;
  });
  const priorListeners = new Map(['SIGTERM', 'SIGINT', 'exit'].map(name => [name, process.listeners(name)]));
  const priorHold = global.__holdRegistry;
  const messages = [];
  const ws = { readyState: 1, send: frame => messages.push(JSON.parse(frame)) };
  const sessions = new Map([[ws, {}]]);
  const errors = [];
  const errorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.doMock(path.join(SERVER_ROOT, 'lib/screenshot/ws-handlers'), () => () => ({}));
  jest.doMock(path.join(SERVER_ROOT, 'lib/calendar/index'), () => ({ start() {} }));
  jest.doMock(path.join(SERVER_ROOT, 'lib/harness/harness-status-service'), () => ({ revalidateAll: async () => {} }));
  jest.doMock(path.join(SERVER_ROOT, 'lib/theme/themes-service'), () => ({ list: async () => [] }));
  jest.doMock(path.join(SERVER_ROOT, 'lib/cli-config'), () => ({ ensureWorkspaceFile: async () => {} }));

  const dbPath = path.join(SERVER_ROOT, 'lib/db');
  const actualDb = jest.requireActual(dbPath);
  jest.doMock(dbPath, () => ({
    ...actualDb,
    async initDb() {
      const db = await actualDb.initDb();
      if (failAfterDbInit) throw new Error('scratch startup database failure');
      await db('workspace_screenshots').del();
      await db('workspace_themes').del();
      await db('workspaces').del();
      await db('workspaces').insert(workspaces.map((item, sort_order) => ({
        id: item.id, label: item.label, repo_path: item.repoPath, sort_order, type: 'code',
      })));
      await db('system_config').insert({ key: 'last_active_workspace_id', value: 'A', updated_at: Date.now() })
        .onConflict('key').merge(['value', 'updated_at']);
      return db;
    },
  }));
  let shutdown;
  const exitCodes = [];
  const actualShutdown = jest.requireActual(path.join(SERVER_ROOT, 'lib/shutdown'));
  jest.doMock(path.join(SERVER_ROOT, 'lib/shutdown'), () => ({
    ...actualShutdown,
    createShutdownHandler(deps) {
      shutdown = actualShutdown.createShutdownHandler({ ...deps, exit: code => exitCodes.push(code) });
      return shutdown;
    },
  }));
  const resources = observeStartupResources(SERVER_ROOT);
  const components = require(path.join(SERVER_ROOT, 'lib/components/component-loader'));
  const componentLoad = jest.spyOn(components, 'loadComponents');
  const actions = require(path.join(SERVER_ROOT, 'lib/watcher/actions'));
  const actionWiring = jest.spyOn(actions, 'createActionHandlers');
  const runner = require(path.join(SERVER_ROOT, 'lib/runner'));
  const heartbeatStart = jest.spyOn(runner, 'checkHeartbeats');
  const cronModule = require(path.join(SERVER_ROOT, 'lib/triggers/cron-scheduler'));
  const originalCronFactory = cronModule.createCronScheduler;
  const cronIntervals = [];
  const cronSchedulers = [];
  const cronFactory = jest.spyOn(cronModule, 'createCronScheduler').mockImplementation((...args) => {
    const scheduler = originalCronFactory(...args);
    const originalStart = scheduler.start;
    scheduler.start = () => {
      const before = intervals.length;
      originalStart();
      cronIntervals.push(...intervals.slice(before));
    };
    cronSchedulers.push(scheduler);
    return scheduler;
  });
  const controller = require(path.join(SERVER_ROOT, 'lib/workspace/workspace-controller'));
  const startup = require(startupPath);
  const server = http.createServer((_request, response) => response.end('scratch'));

  return {
    root, nonce, port, appData, workspaces, workspace, messages, errors, intervals,
    components, componentLoad, actionWiring, heartbeatStart, runtimeModule,
    cronFactory, cronIntervals, cronSchedulers,
    db: actualDb, controller, exitCodes,
    async start() {
      return startup.start({
        server, app: require('express')(), sessions,
        getProjectRoot: () => controller.getActiveWorkspaceSync()?.repoPath || null,
        productSessionRegistry: {
          getAllClients: () => [], getClientByConnectionId: () => null, getSessionForClient: () => null,
        },
        transportConnectionRegistry: { terminateAll: async () => {} },
        installProtocolRoutes() {},
      });
    },
    async cleanup() {
      try {
        if (shutdown) await shutdown('fixture-cleanup');
        if (!shutdown || exitCodes.at(-1) !== 0) {
          // Startup audit failure occurs before shutdown publication. Explicitly
          // drain the same real owners and both owned database connections.
          await resources.cleanupBeforeShutdownPublication();
          await actualDb.closeDb();
        }
      } finally {
        await actualDb.closeDb();
        if (server.listening) await new Promise(resolve => server.close(resolve));
        for (const name of priorListeners.keys()) {
          for (const listener of process.listeners(name)) {
            if (priorListeners.get(name).includes(listener)) continue;
            if (name === 'exit') listener();
            process.removeListener(name, listener);
          }
        }
        for (const timer of timeouts) clearTimeout(timer);
        require(path.join(SERVER_ROOT, 'lib/event-bus')).bus.removeAllListeners();
        global.__holdRegistry?.stop?.();
        for (const scheduler of cronSchedulers) scheduler.stop();
        if (priorHold === undefined) delete global.__holdRegistry;
        else global.__holdRegistry = priorHold;
        for (const spy of [intervalSpy, timeoutSpy, errorSpy, logSpy, warnSpy, componentLoad, actionWiring, heartbeatStart, cronFactory]) spy.mockRestore();
        resources.restore();
        for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
        Object.assign(process.env, previousEnv);
        for (const entry of [...EXTERNAL_STUBS, 'lib/db', 'lib/shutdown']) jest.dontMock(path.join(SERVER_ROOT, entry));
        if (fs.readFileSync(path.join(root, MARKER), 'utf8') !== `${nonce}\n`) throw new Error('startup fixture cleanup ownership mismatch');
        fs.rmSync(root, { recursive: true });
        const receipt = {
          mode: isolated ? 'isolated-v1' : 'normal', root, port, cleaned: !fs.existsSync(root),
          guardsRestored: fs.watch === originals.watch && fs.watchFile === originals.watchFile
            && require('child_process').spawn === originals.spawn,
          listenersRestored: [...priorListeners].every(([name, before]) => (
            process.listeners(name).length === before.length
            && process.listeners(name).every(listener => before.includes(listener))
          )),
          exitCodes,
          // Fixed fixture diagnostics only; the pipeline assertion checks the
          // original error object directly before any cleanup.
          cleanupErrors: errors.filter(args => String(args[0]).startsWith('[Shutdown]'))
            .map(args => String(args[0])),
        };
        process.stdout.write(`STARTUP_CANARY_RECEIPT ${JSON.stringify(receipt)}\n`);
        if (!receipt.guardsRestored || !receipt.listenersRestored) throw new Error('startup fixture globals were not restored');
        jest.resetModules();
      }
    },
  };
}

module.exports = { createStartupEntryFixture, EXTERNAL_STUBS };
