'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');

jest.mock('uuid', () => ({ v4: jest.fn(() => 'turn-1') }));

jest.mock('../../lib/harness/compat', () => ({
  spawnThreadWire: jest.fn(),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  attachClientToWire: jest.fn(() => true),
  getWireForThread: jest.fn(),
  unregisterWire: jest.fn(),
}));

jest.mock('../../lib/event-bus', () => ({
  emit: jest.fn(),
}));

jest.mock('../../lib/thread/thread-manager-registry', () => ({
  getThreadManagerForTarget: jest.fn(),
  awaitThreadManagerReady: jest.fn(async manager => manager),
}));

// SPEC-03 Slice C: diagnostic service mocked file-wide with the
// failure-shaped default (null ⇒ no diagnosticId); Slice C tests override.
jest.mock('../../lib/thread/harness-diagnostic-service', () => ({
  persistDiagnosticReport: jest.fn(async () => null),
}));

const { emit } = require('../../lib/event-bus');
const { spawnThreadWire } = require('../../lib/harness/compat');
const {
  attachClientToWire,
  getWireForThread,
  unregisterWire,
} = require('../../lib/wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const registry = require('../../lib/thread/thread-manager-registry');
const {
  getAutomationRuntimeStatus,
  sendAutomationPrompt,
  _getRuntimeKey,
} = require('../../lib/thread/thread-runtime-automation');
const { persistDiagnosticReport } = require('../../lib/thread/harness-diagnostic-service');

function flushAsyncWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function makeTarget(overrides = {}) {
  return {
    workspaceId: 'workspace-1',
    projectRoot: '/tmp/project',
    threadId: 'thread-1',
    ...overrides,
  };
}

function makeManager(overrides = {}) {
  return {
    workspaceId: 'workspace-1',
    getThread: jest.fn(async () => ({ threadId: 'thread-1', entry: {} })),
    openSession: jest.fn(async () => ({})),
    touchSession: jest.fn(),
    addMessage: jest.fn(async () => ({})),
    index: { touch: jest.fn(async () => ({})) },
    ...overrides,
  };
}

function makeWire(events, onSend = null) {
  return {
    _usesDirectCanonicalEvents: true,
    _harnessPromise: Promise.resolve(),
    async *_sendMessage(input) {
      if (onSend) onSend(input);
      for (const event of events) yield event;
    },
  };
}

describe('thread runtime automation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    getWireForThread.mockReturnValue(null);
  });

  test('status lookup returns cold and canSend for a known cold runtime', () => {
    const status = getAutomationRuntimeStatus(makeTarget());

    expect(status).toMatchObject({
      state: RUNTIME_STATES.COLD,
      canSend: true,
      deferReason: null,
      hasLiveTurn: false,
      liveTurn: null,
    });
  });

  test.each([
    [RUNTIME_STATES.WARMING, 'warming'],
    [RUNTIME_STATES.IN_FLIGHT, 'in_flight'],
    [RUNTIME_STATES.STOPPING, 'stopping'],
  ])('status lookup returns deferred reason for %s', (state, reason) => {
    const target = makeTarget();
    const runtimeKey = _getRuntimeKey(target);
    if (state === RUNTIME_STATES.WARMING) {
      threadRuntimeManager.markWarming(runtimeKey, Promise.resolve());
    } else {
      threadRuntimeManager.markState(runtimeKey, state);
    }

    expect(getAutomationRuntimeStatus(target)).toMatchObject({
      state,
      canSend: false,
      deferReason: reason,
    });
  });

  test('automation send to in-flight runtime defers and does not send', async () => {
    const target = makeTarget();
    const runtimeKey = _getRuntimeKey(target);
    threadRuntimeManager.markInFlight(runtimeKey);
    const wire = makeWire([], jest.fn());
    getWireForThread.mockReturnValue(wire);

    const result = await sendAutomationPrompt(target, 'hello');

    expect(result).toMatchObject({
      accepted: false,
      deferred: true,
      reason: 'in_flight',
      threadId: 'thread-1',
      scope: 'project',
    });
    expect(wire._sendMessage).toBeDefined();
    expect(spawnThreadWire).not.toHaveBeenCalled();
    expect(registry.getThreadManagerForTarget).not.toHaveBeenCalled();
  });

  test.each([
    [RUNTIME_STATES.WARMING, 'warming'],
    [RUNTIME_STATES.IN_FLIGHT, 'in_flight'],
    [RUNTIME_STATES.STOPPING, 'stopping'],
  ])('automation send defers if runtime becomes %s after status lookup', async (state, reason) => {
    const target = makeTarget();
    const runtimeKey = _getRuntimeKey(target);
    const manager = makeManager({
      getThread: jest.fn(async () => {
        if (state === RUNTIME_STATES.WARMING) {
          threadRuntimeManager.markWarming(runtimeKey, Promise.resolve());
        } else {
          threadRuntimeManager.markState(runtimeKey, state);
        }
        return { threadId: 'thread-1', entry: {} };
      }),
    });
    registry.getThreadManagerForTarget.mockReturnValue(manager);

    const result = await sendAutomationPrompt(target, 'hello');

    expect(result).toMatchObject({
      accepted: false,
      deferred: true,
      reason,
      threadId: 'thread-1',
      scope: 'project',
    });
    expect(spawnThreadWire).not.toHaveBeenCalled();
    expect(manager.addMessage).not.toHaveBeenCalled();
  });

  test('cold automation send warms, persists user, drains canonical turn_end, and updates snapshot', async () => {
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    const sendOrder = [];
    const wire = makeWire([
      { type: 'turn_begin', userInput: 'hello' },
      { type: 'content', text: 'answer' },
      { type: 'turn_end', reason: 'complete' },
    ], input => sendOrder.push(['send', input]));
    spawnThreadWire.mockReturnValue(wire);

    manager.addMessage.mockImplementation(async (_threadId, message) => {
      sendOrder.push([message.role, message.content]);
      return {};
    });

    const result = await sendAutomationPrompt(target, 'hello');
    await flushAsyncWork();

    expect(result.error).toBeUndefined();
    expect(result).toMatchObject({
      accepted: true,
      deferred: false,
      threadId: 'thread-1',
      scope: 'project',
    });
    expect(spawnThreadWire).toHaveBeenCalledWith('thread-1', '/tmp/project', {
      workspaceId: 'workspace-1',
      projectRoot: '/tmp/project',
      workspaceEpoch: 'automation:workspace-1:/tmp/project',
      viewId: null,
    });
    expect(attachClientToWire).toHaveBeenCalledWith('thread-1', wire, '/tmp/project', null, {
      workspaceId: 'workspace-1',
      projectRoot: '/tmp/project',
      workspaceEpoch: 'automation:workspace-1:/tmp/project',
      viewId: null,
    });
    expect(manager.openSession).toHaveBeenCalledWith('thread-1', wire, null, {
      workspaceEpoch: 'automation:workspace-1:/tmp/project',
    });
    expect(sendOrder).toEqual([
      ['user', 'hello'],
      ['send', 'hello'],
    ]);
    expect(manager.index.touch).toHaveBeenCalledWith('thread-1');
    expect(emit).toHaveBeenCalledWith('chat:turn_end', expect.objectContaining({
      threadId: 'thread-1',
      fullText: 'answer',
      userInput: 'hello',
    }));
    expect(getAutomationRuntimeStatus(target)).toMatchObject({
      state: RUNTIME_STATES.READY,
      hasLiveTurn: true,
      liveTurn: expect.objectContaining({
        status: 'complete',
        fullText: 'answer',
      }),
    });
  });

  test('automation send does not require WebSocket state access', async () => {
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue(makeWire([
      { type: 'turn_begin', userInput: 'hello' },
      { type: 'turn_end', reason: 'complete' },
    ]));

    await expect(sendAutomationPrompt(target, 'hello')).resolves.toMatchObject({ accepted: true });
    expect(manager.addMessage).toHaveBeenCalledWith('thread-1', {
      role: 'user',
      content: 'hello',
      hasToolCalls: false,
    });
  });

  test('headless turns bind authority to server-resolved harness and canonical root', async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-headless-authority-'));
    try {
      const target = makeTarget({ projectRoot: temporaryRoot });
      const manager = makeManager({
        projectRoot: temporaryRoot,
        getThread: jest.fn(async () => ({ threadId: 'thread-1', entry: { harnessId: 'opencode' } })),
      });
      registry.getThreadManagerForTarget.mockReturnValue(manager);
      const wire = makeWire([
        { type: 'turn_begin', userInput: 'hello' },
        { type: 'turn_end', reason: 'complete' },
      ]);
      wire._harnessId = 'opencode';
      wire._provider = 'opencode';
      spawnThreadWire.mockReturnValue(wire);

      await expect(sendAutomationPrompt(target, 'hello')).resolves.toMatchObject({ accepted: true });
      expect(emit).toHaveBeenCalledWith('chat:turn_begin', expect.objectContaining({
        workspaceId: 'workspace-1', threadId: 'thread-1',
        projectRoot: await fs.realpath(temporaryRoot),
      }));
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('thread not found returns failed result without warming', async () => {
    const target = makeTarget();
    const manager = makeManager({ getThread: jest.fn(async () => null) });
    registry.getThreadManagerForTarget.mockReturnValue(manager);

    await expect(sendAutomationPrompt(target, 'hello')).resolves.toMatchObject({
      accepted: false,
      deferred: false,
      error: 'Thread not found: thread-1',
    });
    expect(spawnThreadWire).not.toHaveBeenCalled();
  });

  test('automation thread lookup rejection returns and logs only fixed-safe material', async () => {
    const canary = 'CANARY_SECRET_AUTOMATION_LOOKUP';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const manager = makeManager();
    manager.getThread.mockRejectedValue(new Error(canary));
    registry.getThreadManagerForTarget.mockReturnValue(manager);

    const result = await sendAutomationPrompt(makeTarget(), 'hello');

    expect(result).toMatchObject({ accepted: false, deferred: false, error: 'Thread lookup failed' });
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Automation thread lookup failed',
      { threadId: 'thread-1', marker: 'AUTOMATION_THREAD_LOOKUP_FAILED' },
    ]]);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls })).not.toContain(canary);
  });

  test('automation warm-up rejection returns and logs only fixed-safe material', async () => {
    const canary = 'CANARY_SECRET_AUTOMATION_WARM';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockImplementation(() => { throw new Error(canary); });

    const result = await sendAutomationPrompt(makeTarget(), 'hello');

    expect(result).toMatchObject({ accepted: false, deferred: false, error: 'Thread warm-up failed' });
    expect(getAutomationRuntimeStatus(makeTarget()).state).toBe(RUNTIME_STATES.COLD);
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Automation warm-up failed',
      { threadId: 'thread-1', marker: 'AUTOMATION_WARM_UP_FAILED' },
    ]]);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls })).not.toContain(canary);
  });

  test('automation warm-up never trusts a forged deferReason from a caught failure', async () => {
    const canary = 'CANARY_RAW_DEFER_REASON_0108';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockImplementation(() => {
      throw Object.assign(new Error('provider warm-up failed'), { deferReason: canary });
    });

    const result = await sendAutomationPrompt(makeTarget(), 'hello');

    expect(result).toMatchObject({
      accepted: false,
      deferred: false,
      error: 'Thread warm-up failed',
    });
    expect(result).not.toHaveProperty('reason');
    expect(getAutomationRuntimeStatus(makeTarget()).state).toBe(RUNTIME_STATES.COLD);
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Automation warm-up failed',
      { threadId: 'thread-1', marker: 'AUTOMATION_WARM_UP_FAILED' },
    ]]);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls })).not.toContain(canary);
  });

  test('automation prompt persistence rejection restores READY and stays fixed-safe', async () => {
    const canary = 'CANARY_SECRET_AUTOMATION_PERSIST';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const manager = makeManager();
    manager.addMessage.mockRejectedValue(new Error(canary));
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue(makeWire([{ type: 'turn_end', reason: 'complete' }]));

    const result = await sendAutomationPrompt(makeTarget(), 'hello');

    expect(result).toMatchObject({ accepted: false, deferred: false, error: 'Message could not be saved' });
    expect(getAutomationRuntimeStatus(makeTarget()).state).toBe(RUNTIME_STATES.READY);
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Automation prompt persistence failed',
      { threadId: 'thread-1', marker: 'AUTOMATION_PROMPT_PERSISTENCE_FAILED' },
    ]]);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls })).not.toContain(canary);
  });
});

describe('canonical drain binding (SPEC-01 Slice B)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    getWireForThread.mockReturnValue(null);
  });

  test('claims the active drain before the bridge drains harness events', async () => {
    const order = [];
    const originalClaim = threadRuntimeManager.claimActiveDrain.bind(threadRuntimeManager);
    const claimSpy = jest.spyOn(threadRuntimeManager, 'claimActiveDrain')
      .mockImplementation((key, control, routeContext) => {
        order.push('claim');
        return originalClaim(key, control, routeContext);
      });
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    manager.addMessage.mockImplementation(async () => {
      order.push('persist');
      return {};
    });
    const wire = makeWire([{ type: 'turn_end', reason: 'complete' }], () => {
      order.push('send');
    });
    spawnThreadWire.mockReturnValue(wire);

    await expect(sendAutomationPrompt(makeTarget(), 'hello')).resolves.toMatchObject({ accepted: true });

    expect(order).toEqual(['persist', 'claim', 'send']);
    claimSpy.mockRestore();
  });

  test('claimed record carries control closures and route context bound to the target', async () => {
    const stopSession = jest.fn(() => Promise.resolve());
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    const wire = {
      ...makeWire([{ type: 'turn_end', reason: 'complete' }]),
      _stopSession: stopSession,
    };
    spawnThreadWire.mockReturnValue(wire);

    await expect(sendAutomationPrompt(makeTarget(), 'hello')).resolves.toMatchObject({ accepted: true });

    const runtimeKey = _getRuntimeKey(makeTarget());
    const record = threadRuntimeManager.getActiveDrain(runtimeKey);

    expect(record).toBeTruthy();
    expect(record.drainId).toBe('turn-1'); // uuid is mocked file-wide
    expect(record.turnId).toBeNull();

    record.control.touchThreadSession();
    expect(manager.touchSession).toHaveBeenCalledWith('thread-1');

    await record.control.stopHarness();
    expect(stopSession).toHaveBeenCalledTimes(1);

    expect(record.routeContext).toMatchObject({
      workspaceId: 'workspace-1',
      workspace: 'workspace:workspace-1',
      projectRoot: '/tmp/project',
      scope: 'project',
      threadId: 'thread-1',
      acceptedUserInput: 'hello',
      attachments: [],
    });
    expect(Object.isFrozen(record.routeContext)).toBe(true);
    expect(JSON.stringify(record.control)).not.toContain('stopHarness');
  });

  test('automation-owned stop failure logs only fixed marker and opaque route ids', async () => {
    const canary = 'CANARY_SECRET_AUTOMATION_STOP';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const stopSession = jest.fn(async () => { throw new Error(canary); });
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    const wire = {
      ...makeWire([{ type: 'turn_end', reason: 'complete' }]),
      _stopSession: stopSession,
    };
    spawnThreadWire.mockReturnValue(wire);

    await expect(sendAutomationPrompt(makeTarget(), 'hello')).resolves.toMatchObject({ accepted: true });
    const record = threadRuntimeManager.getActiveDrain(_getRuntimeKey(makeTarget()));

    await expect(record.control.stopHarness()).rejects.toThrow('Automation provider termination failed');

    expect(stopSession).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls).toContainEqual([
      '[ThreadRuntime] Automation harness stop failed',
      {
        threadId: 'thread-1',
        drainId: 'turn-1',
        marker: 'AUTOMATION_HARNESS_STOP_FAILED',
      },
    ]);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(canary);
  });

  test('empty input is rejected before warming, persistence, or IN_FLIGHT', async () => {
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);

    await expect(sendAutomationPrompt(target, '')).resolves.toMatchObject({
      accepted: false,
      deferred: false,
      error: 'Prompt requires a non-empty input',
    });

    expect(registry.getThreadManagerForTarget).not.toHaveBeenCalled();
    expect(manager.addMessage).not.toHaveBeenCalled();
    expect(spawnThreadWire).not.toHaveBeenCalled();
    expect(threadRuntimeManager.getActiveDrain(_getRuntimeKey(target))).toBeNull();
    expect(getAutomationRuntimeStatus(target)).toMatchObject({
      state: RUNTIME_STATES.COLD,
      canSend: true,
    });
  });

  test('a drain-binding failure rolls the runtime back to READY instead of wedging it', async () => {
    const canary = 'CANARY_SECRET_AUTOMATION_BINDING';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const originalClaim = threadRuntimeManager.claimActiveDrain.bind(threadRuntimeManager);
    const claimSpy = jest.spyOn(threadRuntimeManager, 'claimActiveDrain')
      .mockImplementation(() => {
        throw new Error(canary);
      });
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue(makeWire([{ type: 'turn_end', reason: 'complete' }]));

    const result = await sendAutomationPrompt(makeTarget(), 'hello');

    expect(result).toMatchObject({
      accepted: false,
      deferred: false,
      error: 'Prompt binding failed',
    });
    expect(manager.addMessage).toHaveBeenCalledTimes(1); // persistence happened first
    expect(getAutomationRuntimeStatus(makeTarget())).toMatchObject({
      state: RUNTIME_STATES.READY,
      canSend: true,
    });
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Automation prompt drain binding failed',
      { threadId: 'thread-1', marker: 'AUTOMATION_PROMPT_DRAIN_BINDING_FAILED' },
    ]]);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls })).not.toContain(canary);
    claimSpy.mockRestore();
  });
});

describe('runtime drain authority (SPEC-01 Slice C)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    getWireForThread.mockReturnValue(null);
  });

  test('drain flows through bridge options: begin binds once and terminalization clears-if-current', async () => {
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue(makeWire([
      { type: 'turn_begin', userInput: 'hello' },
      { type: 'content', text: 'answer' },
      { type: 'status_update', messageId: 'msg-1', planMode: false },
      { type: 'turn_end', reason: 'complete' },
    ]));

    const runtimeKey = _getRuntimeKey(target);
    await expect(sendAutomationPrompt(target, 'hello')).resolves.toMatchObject({ accepted: true });

    // The terminal path cleared its own record (clear-if-current)…
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();

    // …and the completed snapshot remains for overlay consumers.
    const status = getAutomationRuntimeStatus(target);
    expect(status).toMatchObject({
      state: RUNTIME_STATES.READY,
      hasLiveTurn: true,
      liveTurn: expect.objectContaining({
        status: 'complete',
        turnId: 'turn-1',
        fullText: 'answer',
        userInput: 'hello',
      }),
    });

    // Usage metadata landed on the runtime-owned accumulator before reset;
    // the emitted bus payloads stay byte-compatible.
    expect(emit).toHaveBeenCalledWith('chat:turn_begin', expect.objectContaining({
      workspaceId: 'workspace-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
      userInput: 'hello',
    }));
    expect(emit).toHaveBeenCalledWith('chat:turn_end', expect.objectContaining({
      threadId: 'thread-1',
      turnId: 'turn-1',
      fullText: 'answer',
      userInput: 'hello',
    }));
  });

  test('a duplicate turn_begin cannot rebind or reset the live accumulator', async () => {
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue(makeWire([
      { type: 'turn_begin', userInput: 'hello' },
      { type: 'content', text: 'first ' },
      { type: 'turn_begin', userInput: 'hijack' }, // duplicate — must be rejected
      { type: 'content', text: 'second' },
      { type: 'turn_end', reason: 'complete' },
    ]));

    await expect(sendAutomationPrompt(target, 'hello')).resolves.toMatchObject({ accepted: true });

    const begins = emit.mock.calls.filter(([type]) => type === 'chat:turn_begin');
    expect(begins).toHaveLength(1);
    expect(begins[0][1].turnId).toBe('turn-1');

    // Accumulator/snapshot were never reset by the duplicate.
    const ends = emit.mock.calls.filter(([type]) => type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0][1]).toMatchObject({ fullText: 'first second', turnId: 'turn-1' });
  });

  test('late iterator error after supersession is a diagnostic-only no-op that leaves state alone', async () => {
    const canary = 'CANARY_SECRET_AUTOMATION_SUPERSEDED';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);

    let releaseError;
    const errorGate = new Promise(resolve => { releaseError = resolve; });
    let started;
    const startGate = new Promise(resolve => { started = resolve; });
    spawnThreadWire.mockReturnValue({
      _usesDirectCanonicalEvents: true,
      _harnessPromise: Promise.resolve(),
      async *_sendMessage() {
        started();
        yield { type: 'turn_begin', userInput: 'hello' };
        await errorGate;
        throw new Error(canary);
      },
    });

    const pending = sendAutomationPrompt(target, 'hello');
    await startGate;

    const runtimeKey = _getRuntimeKey(target);
    const replacementControl = {
      drainId: 'replacement-drain',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    };
    threadRuntimeManager.claimActiveDrain(runtimeKey, replacementControl, null);

    // Release the gated iterator so its late error surfaces post-supersession.
    releaseError();
    await pending;
    await flushAsyncWork();

    // Superseded: no state transition away from IN_FLIGHT (the replacement's
    // lifecycle owns it) and no crash surfaced as a generic harness failure.
    expect(getAutomationRuntimeStatus(target)).toMatchObject({
      state: RUNTIME_STATES.IN_FLIGHT,
    });
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)?.drainId).toBe('replacement-drain');
    expect(warnSpy.mock.calls).toContainEqual([
      '[ThreadRuntime] Ignoring superseded automation iterator failure',
      {
        threadId: 'thread-1',
        drainId: 'turn-1',
        marker: 'SUPERSEDED_AUTOMATION_ITERATOR_FAILURE',
      },
    ]);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(canary);
    void releaseError;
  });
});

describe('failure-path canonical terminalization — headless parity (SPEC-03 Slice B)', () => {
  const { TURN_TERMINAL_ERROR_CATALOG } = require('../../lib/thread/turn-terminal-error');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    getWireForThread.mockReturnValue(null);
  });

  test('exception mid-drain synthesizes the SAME error terminal through the bridge and still returns a failed result', async () => {
    const canary = 'CANARY_SECRET_AUTOMATION_MID_DRAIN';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue({
      _usesDirectCanonicalEvents: true,
      _harnessPromise: Promise.resolve(),
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        yield { type: 'content', text: 'partial answer' };
        throw new Error(canary);
      },
    });

    const result = await sendAutomationPrompt(target, 'hello');
    await flushAsyncWork();

    // The headless caller still learns about the failure...
    expect(result).toMatchObject({
      accepted: false,
      deferred: false,
      error: 'The model response failed before it completed.',
    });
    // ...but finalization was NOT stranded: exactly ONE canonical error
    // turn_end flowed through the same bridge/applier/terminal path.
    const ends = emit.mock.calls.filter(([type]) => type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0][1]).toMatchObject({
      threadId: 'thread-1',
      turnId: 'turn-1', // uuid mocked file-wide
      reason: 'error',
      partial: true,
      fullText: 'partial answer',
      userInput: 'hello',
    });
    expect(ends[0][1].terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);

    // Retained snapshot: error status + safe envelope until superseded.
    const runtimeKey = _getRuntimeKey(target);
    const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
    expect(liveTurn).toMatchObject({
      status: 'error',
      turnId: 'turn-1',
      fullText: 'partial answer',
    });
    expect(liveTurn.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();
    expect(getAutomationRuntimeStatus(target)).toMatchObject({ state: RUNTIME_STATES.READY });
    expect(errorSpy.mock.calls).toContainEqual([
      '[ThreadRuntime] Automation harness send failed',
      { threadId: 'thread-1', drainId: 'turn-1', marker: 'MODEL_RESPONSE_FAILED' },
    ]);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls, emissions: emit.mock.calls }))
      .not.toContain(canary);
  });

  test('automation error-turn synthesis exception is ids-only and never changes safe return text', async () => {
    const iteratorCanary = 'CANARY_SECRET_AUTOMATION_SYNTHESIS_ITERATOR';
    const synthesisCanary = 'CANARY_SECRET_AUTOMATION_SYNTHESIS_EMIT';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    emit.mockImplementation((type) => {
      if (type === 'chat:turn_end') throw new Error(synthesisCanary);
    });
    spawnThreadWire.mockReturnValue({
      _usesDirectCanonicalEvents: true,
      _harnessPromise: Promise.resolve(),
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        throw new Error(iteratorCanary);
      },
    });

    const result = await sendAutomationPrompt(target, 'hello');

    expect(result).toMatchObject({
      accepted: false,
      deferred: false,
      error: 'The model response failed before it completed.',
    });
    expect(errorSpy.mock.calls).toContainEqual([
      '[ThreadRuntime] Automation error-turn synthesis failed',
      {
        threadId: 'thread-1',
        drainId: 'turn-1',
        marker: 'AUTOMATION_ERROR_TURN_SYNTHESIS_FAILED',
      },
    ]);
    expect(errorSpy.mock.calls).toContainEqual([
      '[ThreadRuntime] Automation harness send failed',
      { threadId: 'thread-1', drainId: 'turn-1', marker: 'MODEL_RESPONSE_FAILED' },
    ]);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls }))
      .not.toContain(iteratorCanary);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls }))
      .not.toContain(synthesisCanary);
  });

  test('a genuine marker synthesizes its specific catalog row (process exit → HARNESS_EXITED)', async () => {
    const { HarnessRuntimeError } = require('../../lib/harness/errors');
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue({
      _usesDirectCanonicalEvents: true,
      _harnessPromise: Promise.resolve(),
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        throw new HarnessRuntimeError('HARNESS_PROCESS_EXIT', {
          version: 1,
          harnessId: 'opencode',
          category: 'process_exit',
          exitCode: 137,
          hadRenderableOutput: false,
          hadToolCalls: false,
          truncatedFields: [],
          stderrExcerpt: 'REDACTED-TAIL-MARKER',
        });
      },
    });

    await sendAutomationPrompt(target, 'hello');
    await flushAsyncWork();

    const ends = emit.mock.calls.filter(([type]) => type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0][1].reason).toBe('error');
    expect(ends[0][1].terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED);
    const serialized = JSON.stringify(emit.mock.calls);
    expect(serialized).not.toContain('REDACTED-TAIL-MARKER');
  });

  test('automation drain retirement stops its exact provider and awaits iterator quiescence', async () => {
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    let releaseIterator;
    const iteratorMayFinish = new Promise(resolve => { releaseIterator = resolve; });
    let markIteratorWaiting;
    const iteratorWaiting = new Promise(resolve => { markIteratorWaiting = resolve; });
    let finishProviderStop;
    const providerMayStop = new Promise(resolve => { finishProviderStop = resolve; });
    const stopSession = jest.fn(async () => providerMayStop);
    const wire = {
      _usesDirectCanonicalEvents: true,
      _harnessPromise: Promise.resolve(),
      _stopSession: stopSession,
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        markIteratorWaiting();
        await iteratorMayFinish;
        yield { type: 'content', text: 'stale content' };
        yield { type: 'turn_end', reason: 'complete' };
      },
    };
    spawnThreadWire.mockReturnValue(wire);

    const sending = sendAutomationPrompt(target, 'hello');
    await iteratorWaiting;
    const runtimeKey = _getRuntimeKey(target);
    let retirementResolved = false;
    const retiring = threadRuntimeManager.retireActiveDrain(runtimeKey).then(value => {
      retirementResolved = true;
      return value;
    });
    await flushAsyncWork();

    expect(stopSession).toHaveBeenCalledWith('SIGTERM');
    expect(retirementResolved).toBe(false);

    finishProviderStop();
    await flushAsyncWork();
    expect(retirementResolved).toBe(false);
    releaseIterator();
    await expect(retiring).resolves.toBe(true);
    await expect(sending).resolves.toMatchObject({
      accepted: false,
      deferred: false,
      error: 'Drain retired during iteration',
    });
    expect(unregisterWire).toHaveBeenCalledWith('thread-1', {
      workspaceId: 'workspace-1',
      projectRoot: '/tmp/project',
      workspaceEpoch: 'automation:workspace-1:/tmp/project',
      scope: 'project',
      viewId: null,
      threadId: 'thread-1',
    }, wire);
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    const terminals = emit.mock.calls.filter(([type]) => type === 'chat:turn_end');
    expect(terminals).toHaveLength(1);
    expect(terminals[0][1]).toMatchObject({ partial: true, reason: 'interrupted' });
  });

  test('superseded drains remain diagnostic no-ops — no synthesized error terminal at all', async () => {
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);

    let releaseError;
    const errorGate = new Promise(resolve => { releaseError = resolve; });
    let started;
    const startGate = new Promise(resolve => { started = resolve; });
    spawnThreadWire.mockReturnValue({
      _usesDirectCanonicalEvents: true,
      _harnessPromise: Promise.resolve(),
      async *_sendMessage() {
        started();
        yield { type: 'turn_begin', userInput: 'hello' };
        await errorGate;
        throw new Error('late boom');
      },
    });

    const pending = sendAutomationPrompt(target, 'hello');
    await startGate;

    const runtimeKey = _getRuntimeKey(target);
    threadRuntimeManager.claimActiveDrain(runtimeKey, {
      drainId: 'replacement-drain',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    }, null);

    releaseError();
    await pending;
    await flushAsyncWork();

    // Supersession guard fired BEFORE any synthesis: zero turn_end emissions.
    expect(emit.mock.calls.filter(([type]) => type === 'chat:turn_end')).toHaveLength(0);
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)?.drainId).toBe('replacement-drain');
    void releaseError;
  });

  test('pre-begin exception synthesizes NO canonical event (headless)', async () => {
    const canary = 'CANARY_SECRET_AUTOMATION_PRE_BEGIN';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue({
      _usesDirectCanonicalEvents: true,
      _harnessPromise: Promise.resolve(),
      async *_sendMessage() {
        throw new Error(canary);
      },
    });

    const result = await sendAutomationPrompt(target, 'hello');
    await flushAsyncWork();

    expect(result).toMatchObject({
      accepted: false,
      deferred: false,
      error: 'The model response failed before it completed.',
    });
    expect(emit.mock.calls.filter(([type]) => type === 'chat:turn_end')).toHaveLength(0);
    expect(threadRuntimeManager.getLiveTurn(_getRuntimeKey(target))).toBeNull();
    expect(errorSpy.mock.calls).toContainEqual([
      '[ThreadRuntime] Automation harness send failed',
      { threadId: 'thread-1', drainId: 'turn-1', marker: 'MODEL_RESPONSE_FAILED' },
    ]);
    expect(JSON.stringify({ result, logs: errorSpy.mock.calls })).not.toContain(canary);
  });
});

describe('diagnosticId wiring — headless parity (SPEC-03 Slice C)', () => {
  const { TURN_TERMINAL_ERROR_CATALOG } = require('../../lib/thread/turn-terminal-error');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    getWireForThread.mockReturnValue(null);
    emit.mockImplementation(() => {});
    persistDiagnosticReport.mockResolvedValue(null); // failure-shaped default
  });

  function makeThrowingWire(thrown) {
    return {
      _usesDirectCanonicalEvents: true,
      _harnessPromise: Promise.resolve(),
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        throw thrown;
      },
    };
  }

  test('genuine marker + candidate: the headless error terminal carries the diagnosticId and the service got the authoritative binding', async () => {
    const { HarnessRuntimeError } = require('../../lib/harness/errors');
    persistDiagnosticReport.mockResolvedValue('diag-auto-1');
    const candidate = {
      version: 1,
      harnessId: 'opencode',
      category: 'process_exit',
      exitCode: 137,
      hadRenderableOutput: false,
      hadToolCalls: false,
      truncatedFields: [],
    };
    const target = makeTarget();
    const manager = makeManager();
    registry.getThreadManagerForTarget.mockReturnValue(manager);
    spawnThreadWire.mockReturnValue(
      makeThrowingWire(new HarnessRuntimeError('HARNESS_PROCESS_EXIT', candidate)),
    );

    const result = await sendAutomationPrompt(target, 'hello');
    await flushAsyncWork();

    expect(persistDiagnosticReport).toHaveBeenCalledTimes(1);
    expect(persistDiagnosticReport.mock.calls[0][0]).toEqual({
      workspaceId: 'workspace-1',
      projectRoot: '/tmp/project',
      workspaceEpoch: 'automation:workspace-1:/tmp/project',
      threadId: 'thread-1',
      turnId: 'turn-1', // uuid mocked file-wide; bound turnId
    });
    expect(persistDiagnosticReport.mock.calls[0][1]).toEqual(candidate);

    const ends = emit.mock.calls.filter(([type]) => type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0][1].terminalError).toEqual({
      ...TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED,
      diagnosticId: 'diag-auto-1',
    });
    const liveTurn = threadRuntimeManager.getLiveTurn(_getRuntimeKey(target));
    expect(liveTurn.status).toBe('error');
    expect(liveTurn.terminalError).toEqual({
      ...TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED,
      diagnosticId: 'diag-auto-1',
    });
    // The headless caller result is unchanged by diagnostic persistence.
    expect(result).toMatchObject({ accepted: false, deferred: false });
  });

  test('absent candidate or service failure: no diagnosticId, terminalization unchanged', async () => {
    const { HarnessRuntimeError } = require('../../lib/harness/errors');

    // Absent candidate: service never called.
    let target = makeTarget();
    registry.getThreadManagerForTarget.mockReturnValue(makeManager());
    spawnThreadWire.mockReturnValue(
      makeThrowingWire(new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT')),
    );
    await sendAutomationPrompt(target, 'hello');
    await flushAsyncWork();
    expect(persistDiagnosticReport).not.toHaveBeenCalled();
    let ends = emit.mock.calls.filter(([type]) => type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0][1].terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT);
    expect('diagnosticId' in ends[0][1].terminalError).toBe(false);

    // Service failure: null ⇒ same fixed safe envelope, runtime READY.
    jest.clearAllMocks();
    threadRuntimeManager.runtimes.clear();
    persistDiagnosticReport.mockResolvedValue(null);
    target = makeTarget();
    registry.getThreadManagerForTarget.mockReturnValue(makeManager());
    spawnThreadWire.mockReturnValue(makeThrowingWire(
      new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT', {
        version: 1,
        harnessId: 'opencode',
        category: 'timeout',
        hadRenderableOutput: false,
        hadToolCalls: false,
        truncatedFields: [],
      }),
    ));
    const result = await sendAutomationPrompt(target, 'hello');
    await flushAsyncWork();
    expect(persistDiagnosticReport).toHaveBeenCalledTimes(1);
    ends = emit.mock.calls.filter(([type]) => type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0][1].terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT);
    expect('diagnosticId' in ends[0][1].terminalError).toBe(false);
    expect(result).toMatchObject({ accepted: false, deferred: false });
    expect(getAutomationRuntimeStatus(target)).toMatchObject({ state: RUNTIME_STATES.READY });
  });

  test('rejecting diagnostic dependency is fixed-safe and cannot block automation terminalization', async () => {
    const { HarnessRuntimeError } = require('../../lib/harness/errors');
    const canary = 'CANARY_AUTOMATION_DIAGNOSTIC_REJECTION_0108';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    persistDiagnosticReport.mockRejectedValue(new Error(canary));
    const target = makeTarget();
    registry.getThreadManagerForTarget.mockReturnValue(makeManager());
    spawnThreadWire.mockReturnValue(makeThrowingWire(
      new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT', {
        version: 1,
        harnessId: 'opencode',
        category: 'timeout',
        hadRenderableOutput: false,
        hadToolCalls: false,
        truncatedFields: [],
      }),
    ));

    const result = await sendAutomationPrompt(target, 'hello');
    await flushAsyncWork();

    const ends = emit.mock.calls.filter(([type]) => type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0][1].terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT);
    expect('diagnosticId' in ends[0][1].terminalError).toBe(false);
    expect(result).toMatchObject({
      accepted: false,
      deferred: false,
      error: TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT.message,
    });
    expect(getAutomationRuntimeStatus(target)).toMatchObject({ state: RUNTIME_STATES.READY });
    expect(threadRuntimeManager.getActiveDrain(_getRuntimeKey(target))).toBeNull();
    expect(warnSpy.mock.calls).toContainEqual([
      '[HarnessDiagnostics] Terminal persistence dependency failed',
      {
        workspaceId: 'workspace-1',
        threadId: 'thread-1',
        turnId: 'turn-1',
        marker: 'HARNESS_DIAGNOSTIC_DEPENDENCY_FAILED',
      },
    ]);
    expect(JSON.stringify({
      result,
      ends,
      warnLogs: warnSpy.mock.calls,
      errorLogs: errorSpy.mock.calls,
    })).not.toContain(canary);
  });
});
