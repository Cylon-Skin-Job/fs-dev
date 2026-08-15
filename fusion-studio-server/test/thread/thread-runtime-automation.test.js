'use strict';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'turn-1') }));

jest.mock('../../lib/harness/compat', () => ({
  spawnThreadWire: jest.fn(),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  getWireForThread: jest.fn(),
  registerWire: jest.fn(),
}));

jest.mock('../../lib/event-bus', () => ({
  emit: jest.fn(),
}));

jest.mock('../../lib/thread/thread-manager-registry', () => ({
  getThreadManagerForTarget: jest.fn(),
  awaitThreadManagerReady: jest.fn(async manager => manager),
}));

const { emit } = require('../../lib/event-bus');
const { spawnThreadWire } = require('../../lib/harness/compat');
const { getWireForThread, registerWire } = require('../../lib/wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const registry = require('../../lib/thread/thread-manager-registry');
const {
  getAutomationRuntimeStatus,
  sendAutomationPrompt,
  _getRuntimeKey,
} = require('../../lib/thread/thread-runtime-automation');

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

    expect(result).toMatchObject({
      accepted: true,
      deferred: false,
      threadId: 'thread-1',
      scope: 'project',
    });
    expect(spawnThreadWire).toHaveBeenCalledWith('thread-1', '/tmp/project', {
      workspaceId: 'workspace-1',
      viewId: null,
    });
    expect(registerWire).toHaveBeenCalledWith('thread-1', wire, '/tmp/project', null, {
      workspaceId: 'workspace-1',
      viewId: null,
    });
    expect(manager.openSession).toHaveBeenCalledWith('thread-1', wire, null);
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
});
