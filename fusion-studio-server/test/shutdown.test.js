const { spawn } = require('child_process');
const { createShutdownHandler } = require('../lib/shutdown');
jest.mock('../lib/screenshot/ws-handlers', () => jest.fn());
const { createAgentPhaseAOwner } = require('../lib/startup');
const {
  createAgentFactAdmissionReconciler,
} = require('../lib/agent-provenance/fact-admission-reconciler');
const {
  createCanonicalHarnessEventBridge,
  shutdownActiveTurnLifecycles,
} = require('../lib/wire/canonical-harness-event-bridge');
const { createCanonicalChatEventApplier } = require('../lib/wire/canonical-chat-event-applier');
const { threadRuntimeManager } = require('../lib/thread/thread-runtime-manager');

function createHarness(overrides = {}) {
  const exits = [];
  const logs = [];
  const ws = { terminate: jest.fn() };
  const sessions = new Map([[ws, {}]]);
  const server = {
    close: jest.fn(),
    closeIdleConnections: jest.fn(),
    closeAllConnections: jest.fn(),
  };
  const closeWatchers = jest.fn().mockResolvedValue(undefined);
  const stopSubscriptions = jest.fn().mockResolvedValue(undefined);
  const closeDatabase = jest.fn().mockResolvedValue(undefined);
  const logger = {
    log: jest.fn((message) => logs.push(message)),
    error: jest.fn((message) => logs.push(message)),
  };
  const requestShutdown = createShutdownHandler({
    server,
    sessions,
    closeWatchers,
    stopSubscriptions,
    closeDatabase,
    exit: (code) => exits.push(code),
    logger,
    forceAfterMs: 100,
    ...overrides,
  });
  return {
    requestShutdown, server, sessions, ws, closeWatchers, stopSubscriptions,
    closeDatabase, exits, logs,
  };
}

function runIsolatedShutdown(mode) {
  const shutdownPath = require.resolve('../lib/shutdown');
  const script = `
    'use strict';
    const fs = require('fs');
    const { createShutdownHandler } = require(${JSON.stringify(shutdownPath)});
    const mode = ${JSON.stringify(mode)};
    const startedAt = Date.now();
    process.on('exit', () => {
      fs.writeSync(1, JSON.stringify({ mode, elapsedMs: Date.now() - startedAt }));
    });
    const owner = mode === 'success'
      ? async () => true
      : mode === 'false'
        ? async () => false
        : () => new Promise(() => {});
    const requestShutdown = createShutdownHandler({
      server: { close() {}, closeIdleConnections() {}, closeAllConnections() {} },
      sessions: new Map(),
      closeWatchers: async () => true,
      phaseAOwners: [owner],
      stopSubscriptions: async () => true,
      closeDatabase: async () => true,
      exit(code) { process.exitCode = code; },
      logger: { log() {}, error() {} },
      forceAfterMs: 120,
      ownerDeadlineMs: 40,
      subscriptionDeadlineMs: 70,
      databaseDeadlineMs: 90,
    });
    requestShutdown('SIGTERM');
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      try {
        resolve({ code, signal, stderr, ...JSON.parse(stdout) });
      } catch (error) {
        reject(new Error(`isolated shutdown did not report timing: ${error.message}; stderr=${stderr}`));
      }
    });
  });
}

test('shutdown closes network clients, watchers, and database before exiting', async () => {
  const harness = createHarness();

  await harness.requestShutdown('SIGTERM');

  expect(harness.server.close).toHaveBeenCalledTimes(1);
  expect(harness.server.closeIdleConnections).toHaveBeenCalledTimes(1);
  expect(harness.server.closeAllConnections).toHaveBeenCalledTimes(1);
  expect(harness.ws.terminate).toHaveBeenCalledTimes(1);
  expect(harness.sessions.size).toBe(0);
  expect(harness.stopSubscriptions).toHaveBeenCalledTimes(1);
  expect(harness.closeWatchers).toHaveBeenCalledTimes(1);
  expect(harness.closeDatabase).toHaveBeenCalledTimes(1);
  expect(harness.exits).toEqual([0]);
  expect(harness.logs).toContain('[Shutdown] cleanup complete');
  expect(harness.logs.indexOf('[Shutdown] concurrent owners drained'))
    .toBeLessThan(harness.logs.indexOf('[Shutdown] governed subscriptions stopped'));
  expect(harness.logs.indexOf('[Shutdown] governed subscriptions stopped'))
    .toBeLessThan(harness.logs.indexOf('[Shutdown] database closed'));
});

test('outer force timer stays referenced until successful cleanup clears it', async () => {
  const timers = [];
  const setTimer = jest.fn((callback, delay) => {
    const timer = { callback, delay, unref: jest.fn() };
    timers.push(timer);
    return timer;
  });
  const clearTimer = jest.fn();
  const harness = createHarness({ setTimer, clearTimer });

  await harness.requestShutdown('SIGTERM');

  expect(timers.length).toBeGreaterThan(1);
  expect(timers[0].delay).toBe(100);
  expect(timers[0].unref).not.toHaveBeenCalled();
  expect(clearTimer).toHaveBeenCalledWith(timers[0]);
  expect(timers.slice(1).every((timer) => timer.unref.mock.calls.length === 1)).toBe(true);
  expect(harness.exits).toEqual([0]);
});

test.each(['false', 'timeout'])(
  'isolated shutdown with a %s Phase-A owner stays alive to the force deadline and exits nonzero',
  async (mode) => {
    const result = await runIsolatedShutdown(mode);

    expect(result).toMatchObject({ mode, code: 1, signal: null, stderr: '' });
    expect(result.elapsedMs).toBeGreaterThanOrEqual(100);
  },
);

test('isolated successful shutdown clears its referenced force timer and exits promptly', async () => {
  const result = await runIsolatedShutdown('success');

  expect(result).toMatchObject({ mode: 'success', code: 0, signal: null, stderr: '' });
  expect(result.elapsedMs).toBeLessThan(100);
});

test('shutdown is idempotent when multiple signals arrive', async () => {
  const harness = createHarness();

  const first = harness.requestShutdown('SIGTERM');
  const second = harness.requestShutdown('SIGINT');
  await Promise.all([first, second]);

  expect(first).toBe(second);
  expect(harness.closeDatabase).toHaveBeenCalledTimes(1);
  expect(harness.exits).toEqual([0]);
});

test('shutdown reports cleanup failure and exits nonzero', async () => {
  const closeDatabase = jest.fn().mockRejectedValue(new Error('database busy'));
  const harness = createHarness({ closeDatabase });

  await harness.requestShutdown('SIGTERM');

  expect(harness.exits).toEqual([1]);
  expect(harness.logs).toContain('[Shutdown] cleanup failed: database busy');
});

test('rejected Phase A owner prevents subscriptions and database close and exits nonzero', async () => {
  const harness = createHarness({
    phaseAOwners: [async () => { throw new Error('owner drain failed'); }],
  });

  await harness.requestShutdown('SIGTERM');

  expect(harness.stopSubscriptions).not.toHaveBeenCalled();
  expect(harness.closeDatabase).not.toHaveBeenCalled();
  expect(harness.exits).toEqual([1]);
  expect(harness.logs).toContain('[Shutdown] cleanup failed: owner drain failed');
});

test('owner-reported local timeout prevents subscriptions and database close', async () => {
  jest.useFakeTimers();
  try {
    const harness = createHarness({
      phaseAOwners: [async () => false],
      forceAfterMs: 40,
      ownerDeadlineMs: 20,
      subscriptionDeadlineMs: 30,
      databaseDeadlineMs: 35,
    });

    await harness.requestShutdown('SIGTERM');
    expect(harness.stopSubscriptions).not.toHaveBeenCalled();
    expect(harness.closeDatabase).not.toHaveBeenCalled();
    expect(harness.exits).toEqual([]);
    await jest.advanceTimersByTimeAsync(40);
    expect(harness.exits).toEqual([1]);
  } finally {
    jest.useRealTimers();
  }
});

test('failed real active-wire shutdown blocks Phase-A dependents and all later phases', async () => {
  jest.useFakeTimers();
  try {
    const wire = { _stopSession: jest.fn(async () => false) };
    const identity = Object.freeze({
      workspaceId: 'failed-wire-workspace', threadId: 'failed-wire-thread', turnId: 'failed-wire-turn',
    });
    const bridge = createCanonicalHarnessEventBridge({
      resolveTurnIdentity: () => identity,
      applyChatEvent: async () => {},
    });
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const drain = bridge.drainHarnessEvents((async function* events() {
      yield { type: 'turn_begin', userInput: 'active' };
      await held;
    }()), null, { turnAuthority: identity, turnApplicationContext: { wire } });
    await jest.advanceTimersByTimeAsync(0);
    const activity = jest.fn(async () => true);
    const admission = { shutdown: jest.fn(async () => true) };
    const ledger = { shutdown: jest.fn(async () => true) };
    const announced = { shutdown: jest.fn(async () => true) };
    const closeReconciliationDatabase = jest.fn(async () => {});
    const phaseAOwner = createAgentPhaseAOwner({
      shutdownActiveTurns: (options) => shutdownActiveTurnLifecycles({
        ...options, monotonicNow: () => Date.now(),
      }),
      drainAuditSaves: async () => true,
      shutdownActivityOwners: activity,
      announcedOwner: announced,
      admissionOwner: admission,
      ledgerOwner: ledger,
      closeReconciliationDatabase,
      monotonicNow: () => Date.now(),
    });
    const harness = createHarness({
      phaseAOwners: [phaseAOwner], forceAfterMs: 40,
      ownerDeadlineMs: 20, subscriptionDeadlineMs: 30, databaseDeadlineMs: 35,
      monotonicNow: () => Date.now(),
    });

    await harness.requestShutdown('SIGTERM');
    expect(wire._stopSession.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL']);
    expect(activity).not.toHaveBeenCalled();
    expect(admission.shutdown).not.toHaveBeenCalled();
    expect(ledger.shutdown).not.toHaveBeenCalled();
    expect(closeReconciliationDatabase).not.toHaveBeenCalled();
    expect(harness.stopSubscriptions).not.toHaveBeenCalled();
    expect(harness.closeDatabase).not.toHaveBeenCalled();
    expect(harness.exits).toEqual([]);
    await jest.advanceTimersByTimeAsync(40);
    expect(harness.exits).toEqual([1]);
    release();
    await drain;
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test.each([
  ['timeout', async () => false, []],
  ['failure', async () => { throw new Error('audit save failed'); }, [1]],
])('audit-save %s blocks binder, subscriptions, database close, and normal exit', async (_label, auditDrain, expectedExit) => {
  jest.useFakeTimers();
  try {
    const binder = { shutdown: jest.fn(async () => true) };
    const owner = createAgentPhaseAOwner({
      shutdownActiveTurns: async () => true,
      drainAuditSaves: auditDrain,
      shutdownActivityOwners: async () => true,
      binderOwner: binder,
      announcedOwner: { shutdown: async () => true },
      admissionOwner: { shutdown: async () => true },
      ledgerOwner: { shutdown: async () => true },
      closeReconciliationDatabase: jest.fn(async () => {}),
    });
    const harness = createHarness({ phaseAOwners: [owner] });
    await harness.requestShutdown('SIGTERM');
    expect(binder.shutdown).not.toHaveBeenCalled();
    expect(harness.stopSubscriptions).not.toHaveBeenCalled();
    expect(harness.closeDatabase).not.toHaveBeenCalled();
    expect(harness.exits).toEqual(expectedExit);
    if (_label === 'timeout') {
      await jest.advanceTimersByTimeAsync(100);
      expect(harness.exits).toEqual([1]);
    }
  } finally {
    jest.useRealTimers();
  }
});

test('shutdown forces an exit when cleanup exceeds its deadline', async () => {
  jest.useFakeTimers();
  try {
    const closeDatabase = jest.fn(() => new Promise(() => {}));
    const harness = createHarness({ closeDatabase, forceAfterMs: 25 });

    harness.requestShutdown('SIGTERM');
    await jest.advanceTimersByTimeAsync(25);

    expect(harness.exits).toEqual([1]);
    expect(harness.logs).toContain('[Shutdown] cleanup exceeded 25ms; forcing exit');
  } finally {
    jest.useRealTimers();
  }
});

test('phase A owners drain concurrently before subscriptions and SQLite close', async () => {
  jest.useFakeTimers();
  try {
    const order = [];
    const owner = (label, delay) => jest.fn(() => new Promise((resolve) => {
      setTimeout(() => { order.push(label); resolve(); }, delay);
    }));
    const first = owner('owner-a', 20);
    const second = owner('owner-b', 30);
    const stopSubscriptions = jest.fn(async () => { order.push('subscriptions'); });
    const closeDatabase = jest.fn(async () => { order.push('database'); });
    const harness = createHarness({
      phaseAOwners: [first, second], stopSubscriptions, closeDatabase,
      forceAfterMs: 100, ownerDeadlineMs: 50, subscriptionDeadlineMs: 70, databaseDeadlineMs: 80,
    });
    const shutdown = harness.requestShutdown('SIGTERM');
    await jest.advanceTimersByTimeAsync(29);
    expect(stopSubscriptions).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await shutdown;
    expect(order).toEqual(['owner-a', 'owner-b', 'subscriptions', 'database']);
    expect(first.mock.calls[0][0].timeoutMs).toBeGreaterThan(0);
    expect(first.mock.calls[0][0].timeoutMs).toBeLessThanOrEqual(50);
  } finally {
    jest.useRealTimers();
  }
});

test('owner deadline stops later phases and leaves the outer force path to fail shutdown', async () => {
  jest.useFakeTimers();
  try {
    const lateCallback = jest.fn();
    const owner = jest.fn(({ signal }) => new Promise((resolve) => {
      const timer = setTimeout(lateCallback, 11);
      signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    }));
    const harness = createHarness({
      phaseAOwners: [owner], forceAfterMs: 40,
      ownerDeadlineMs: 10, subscriptionDeadlineMs: 20, databaseDeadlineMs: 30,
    });
    const shutdown = harness.requestShutdown('SIGTERM');
    await jest.advanceTimersByTimeAsync(10);
    await shutdown;
    expect(harness.stopSubscriptions).not.toHaveBeenCalled();
    expect(harness.closeDatabase).not.toHaveBeenCalled();
    expect(harness.exits).toEqual([]);
    await jest.advanceTimersByTimeAsync(30);
    expect(lateCallback).not.toHaveBeenCalled();
    expect(harness.exits).toEqual([1]);
    expect(harness.logs).not.toContain('[Shutdown] concurrent owners drained');
  } finally {
    jest.useRealTimers();
  }
});

test.each([
  ['minus', 39, 0],
  ['equal', 40, 1],
  ['plus', 41, 1],
])('outer force boundary %s at database delay %ims', async (_boundary, databaseDelay, expectedExit) => {
  jest.useFakeTimers();
  try {
    const closeDatabase = jest.fn(() => new Promise((resolve) => {
      setTimeout(resolve, databaseDelay);
    }));
    const harness = createHarness({
      closeDatabase,
      forceAfterMs: 40,
      ownerDeadlineMs: 10,
      subscriptionDeadlineMs: 20,
      databaseDeadlineMs: 40,
      monotonicNow: () => Date.now(),
    });
    const shutdown = harness.requestShutdown('SIGTERM');
    for (let index = 0; index < 20 && !closeDatabase.mock.calls.length; index += 1) {
      await Promise.resolve();
    }
    expect(closeDatabase).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(39);
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1);
    await shutdown;
    expect(harness.exits).toEqual([expectedExit]);
  } finally {
    jest.useRealTimers();
  }
});

test('timed-out actual admission owner cannot publish and prevents subscription or SQLite close', async () => {
  let releaseSelection;
  const selection = new Promise((resolve) => { releaseSelection = resolve; });
  const authority = {
    listPending: jest.fn(() => selection),
    createPublishInput: jest.fn(),
    markConflict: jest.fn(),
  };
  const owner = createAgentFactAdmissionReconciler({ authority });
  owner.installPublishers({
    publishAgentToolCompleted: jest.fn(),
    publishResourceStateObserved: jest.fn(),
  });
  const startup = owner.start();
  await new Promise((resolve) => setImmediate(resolve));
  const sequence = [];
  const harness = createHarness({
    phaseAOwners: [() => owner.shutdown()],
    stopSubscriptions: async () => { sequence.push('subscriptions'); },
    closeDatabase: async () => { sequence.push('database'); },
    forceAfterMs: 100,
    ownerDeadlineMs: 5,
    subscriptionDeadlineMs: 50,
    databaseDeadlineMs: 75,
  });

  await harness.requestShutdown('SIGTERM');
  expect(sequence).toEqual([]);
  releaseSelection([{ kind: 'tool', key: 'tool:event-1', eventId: 'event-1' }]);
  await startup;
  expect(authority.createPublishInput).not.toHaveBeenCalled();
  expect(harness.exits).toEqual([]);
  await new Promise((resolve) => setTimeout(resolve, 110));
  expect(harness.exits).toEqual([1]);
});

test.each([
  ['minus', 9, true],
  ['equal', 10, false],
  ['plus', 11, false],
])('actual active-turn interruption boundary %s is fenced at the owner deadline', async (_boundary, settleAt, succeeds) => {
  jest.useFakeTimers();
  try {
    threadRuntimeManager.runtimes.clear();
    const authority = Object.freeze({
      workspaceId: `shutdown-workspace-${settleAt}`,
      threadId: `shutdown-thread-${settleAt}`,
      turnId: `shutdown-turn-${settleAt}`,
      harnessId: 'opencode',
      provider: 'opencode',
      canonicalRoot: `/tmp/shutdown-root-${settleAt}`,
    });
    const wire = { _stopSession: jest.fn(async () => true) };
    const context = {
      currentThreadId: authority.threadId,
      currentWorkspaceId: authority.workspaceId,
      pendingUserInput: 'active prompt',
      pendingAgentTurnAuthority: authority,
      pendingTurnId: authority.turnId,
      pendingAttachments: [],
      currentTurn: null,
      assistantParts: [],
      hasToolCalls: false,
      toolArgs: {},
      toolNamesById: {},
      bouncedToolCalls: new Set(),
      contextUsage: null,
      tokenUsage: null,
      messageId: null,
      planMode: false,
      projectRoot: authority.canonicalRoot,
      wire,
    };
    const emitted = [];
    const activityOwner = {
      interruptOpen: jest.fn(() => new Promise((resolve) => setTimeout(resolve, settleAt))),
    };
    const applier = createCanonicalChatEventApplier({
      session: context,
      emit: (type, payload) => emitted.push({ type, payload }),
      resolveWorkspace: () => `workspace:${authority.workspaceId}`,
      touchThreadSession: () => {},
      checkSettingsBounce: () => null,
      generateTurnId: () => authority.turnId,
      activityOwner,
    });
    const bridge = createCanonicalHarnessEventBridge({
      applyChatEvent: applier.applyChatEvent,
      resolveTurnIdentity: () => authority,
    });
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const events = (async function* activeEvents() {
      yield { type: 'turn_begin', userInput: 'active prompt' };
      await held;
    }());
    const drain = bridge.drainHarnessEvents(events, null, {
      turnAuthority: authority,
      turnApplicationContext: context,
    });
    await jest.advanceTimersByTimeAsync(0);

    const harness = createHarness({
      phaseAOwners: [(options) => shutdownActiveTurnLifecycles({
        ...options,
        monotonicNow: () => Date.now(),
      })],
      forceAfterMs: 20,
      ownerDeadlineMs: 10,
      subscriptionDeadlineMs: 15,
      databaseDeadlineMs: 18,
      monotonicNow: () => Date.now(),
    });
    const shutdown = harness.requestShutdown('SIGTERM');
    for (let attempt = 0; attempt < 20 && !activityOwner.interruptOpen.mock.calls.length; attempt += 1) {
      await Promise.resolve();
    }
    expect(activityOwner.interruptOpen).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(succeeds ? settleAt : 10);
    await shutdown;

    expect(wire._stopSession).toHaveBeenCalledTimes(1);
    if (succeeds) {
      expect(emitted.filter((event) => event.type === 'chat:turn_end')).toHaveLength(1);
      expect(harness.stopSubscriptions).toHaveBeenCalledTimes(1);
      expect(harness.closeDatabase).toHaveBeenCalledTimes(1);
      expect(harness.exits).toEqual([0]);
    } else {
      expect(emitted.filter((event) => event.type === 'chat:turn_end')).toHaveLength(0);
      expect(context.currentTurn).toBeNull();
      expect(context.pendingAgentTurnAuthority).toBeNull();
      expect(context.projectRoot).toBeNull();
      expect(context.wire).toBeNull();
      expect(harness.stopSubscriptions).not.toHaveBeenCalled();
      expect(harness.closeDatabase).not.toHaveBeenCalled();
      expect(harness.exits).toEqual([]);
      await jest.advanceTimersByTimeAsync(10);
      expect(harness.exits).toEqual([1]);
    }
    release();
    await drain;
    await jest.runOnlyPendingTimersAsync();
    expect(emitted.filter((event) => event.type === 'chat:turn_end')).toHaveLength(succeeds ? 1 : 0);
  } finally {
    jest.useRealTimers();
    threadRuntimeManager.runtimes.clear();
  }
});
