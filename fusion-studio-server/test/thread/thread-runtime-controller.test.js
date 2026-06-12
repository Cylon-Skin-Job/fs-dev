'use strict';

jest.mock('../../lib/thread/ThreadWebSocketHandler', () => ({
  getState: jest.fn(),
  handleMessageSend: jest.fn(),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  getWireForThread: jest.fn(),
  unregisterWire: jest.fn(),
}));

const ThreadWebSocketHandler = require('../../lib/thread/ThreadWebSocketHandler');
const { getWireForThread, unregisterWire } = require('../../lib/wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const {
  acceptPromptThroughRuntime,
  getRuntimeKey,
  stopRuntimeTurn,
  warmRuntimeForIntent,
} = require('../../lib/thread/thread-runtime-controller');

function flushAsyncWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function makeHarness(events = [{ type: 'turn_begin' }]) {
  return {
    _usesDirectCanonicalEvents: true,
    async *_sendMessage(input) {
      events.push({ type: 'sent', input });
      yield { type: 'turn_end' };
    },
  };
}

function makeDeps(overrides = {}) {
  const ws = { send: jest.fn() };
  const session = {
    currentWorkspaceId: 'workspace-1',
  };
  const manager = {
    workspaceId: 'workspace-1',
    getThread: jest.fn(() => Promise.resolve({ entry: {} })),
  };
  ThreadWebSocketHandler.getState.mockReturnValue({
    panelId: 'view-1',
    viewName: 'view-1',
    threadId: 'thread-1',
    threadManager: manager,
  });
  ThreadWebSocketHandler.handleMessageSend.mockResolvedValue(true);
  return {
    ws,
    session,
    manager,
    clientMsg: { type: 'prompt', threadId: 'thread-1', user_input: 'hello' },
    wireLifecycle: {},
    projectRoot: '/tmp/project',
    spawnAndSetupWire: jest.fn(() => Promise.resolve(makeHarness(overrides.events))),
    handleCanonicalHarnessEvent: jest.fn(),
    ...overrides,
  };
}

describe('thread runtime prompt controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    threadRuntimeManager.runtimes.clear();
    getWireForThread.mockReturnValue(null);
    unregisterWire.mockReturnValue(undefined);
  });

  test('cold prompt warms runtime and accepts the prompt', async () => {
    const deps = makeDeps();
    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.handleMessageSend).toHaveBeenCalledWith(deps.ws, {
      content: 'hello',
    });
    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledWith({ type: 'turn_end' }, deps.ws);
  });

  test('persists user acceptance before draining _sendMessage events', async () => {
    const order = [];
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        order.push('send');
        yield { type: 'turn_end' };
      },
    };
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    ThreadWebSocketHandler.handleMessageSend.mockImplementation(async () => {
      order.push('persist');
      return true;
    });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(order).toEqual(['persist', 'send']);
  });

  test('warming prompts share one warm-up and do not spawn twice', async () => {
    let resolveWarm;
    const warmPromise = new Promise(resolve => { resolveWarm = resolve; });
    const wire = makeHarness([]);
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => warmPromise) });

    const first = acceptPromptThroughRuntime(deps);
    const second = acceptPromptThroughRuntime(deps);
    resolveWarm(wire);
    await Promise.all([first, second]);
    await flushAsyncWork();

    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.handleMessageSend).toHaveBeenCalledTimes(1);
  });

  test('in-flight runtime rejects another prompt without sending', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markInFlight(runtimeKey);

    await acceptPromptThroughRuntime(deps);

    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(JSON.parse(deps.ws.send.mock.calls[0][0])).toMatchObject({
      type: 'error',
      threadId: 'thread-1',
      recoverable: true,
    });
  });

  test('warm failure returns runtime to cold and sends recoverable error', async () => {
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.reject(new Error('warm failed'))) });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');

    await acceptPromptThroughRuntime(deps);

    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    expect(JSON.parse(deps.ws.send.mock.calls[0][0])).toMatchObject({
      type: 'error',
      message: 'warm failed',
      threadId: 'thread-1',
      recoverable: true,
    });
  });

  test('thread warm on cold runtime spawns once and marks ready', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.READY);
  });

  test('thread warm while warming shares warm promise and does not spawn twice', async () => {
    let resolveWarm;
    const warmPromise = new Promise(resolve => { resolveWarm = resolve; });
    const wire = makeHarness([]);
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => warmPromise) });

    const first = warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });
    const second = warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    resolveWarm(wire);
    await Promise.all([first, second]);

    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
  });

  test('thread warm while ready with registered wire does not spawn', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const wire = makeHarness([]);
    threadRuntimeManager.markReady(runtimeKey);
    getWireForThread.mockReturnValue(wire);

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
  });

  test('thread warm while busy does not stop, send, spawn, or scare user', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markInFlight(runtimeKey);

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
    expect(deps.ws.send).not.toHaveBeenCalled();
  });

  test('thread warm while stopping does not stop, send, spawn, or scare user', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markState(runtimeKey, RUNTIME_STATES.STOPPING);

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
    expect(deps.ws.send).not.toHaveBeenCalled();
  });

  test('stop on in-flight runtime emits one interrupted terminal turn and marks runtime cold', async () => {
    const stop = jest.fn(() => Promise.resolve());
    const wire = { _stopSession: stop };
    const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn() });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markInFlight(runtimeKey);
    threadRuntimeManager.beginLiveTurn(runtimeKey, {
      turnId: 'turn-live',
      userInput: 'hello',
    });
    threadRuntimeManager.appendLiveContent(runtimeKey, 'partial');
    getWireForThread.mockReturnValue(wire);

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    });

    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledTimes(1);
    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledWith({
      type: 'turn_end',
      reason: 'interrupted',
      partial: true,
    }, deps.ws);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(unregisterWire).toHaveBeenCalledWith('thread-1');
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
  });

  test('stop is recoverable no-op when runtime is not in flight', async () => {
    const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn() });

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    });

    expect(deps.handleCanonicalHarnessEvent).not.toHaveBeenCalled();
    expect(JSON.parse(deps.ws.send.mock.calls[0][0])).toMatchObject({
      type: 'error',
      threadId: 'thread-1',
      recoverable: true,
    });
  });

  test('duplicate stop while stopping does not emit duplicate terminal events', async () => {
    const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn() });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markState(runtimeKey, RUNTIME_STATES.STOPPING);

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    });

    expect(deps.handleCanonicalHarnessEvent).not.toHaveBeenCalled();
    expect(deps.ws.send).not.toHaveBeenCalled();
  });
});
