'use strict';

jest.mock('../../lib/event-bus', () => ({
  on: jest.fn(),
}));

const { on } = require('../../lib/event-bus');
const { createCrudHandlers } = require('../../lib/thread/thread-crud');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const {
  getClientForThread,
  getWireForThread,
  registerWire,
  unregisterWire,
} = require('../../lib/wire/process-manager');
const { createWireBroadcaster } = require('../../lib/wire/wire-broadcaster');

const THREAD_ID = 'thread-reconnect-1';
const RUNTIME_KEY = {
  workspaceId: 'workspace-1',
  scope: 'project',
  threadId: THREAD_ID,
};

function makeWebSocket(readyState = 1) {
  return { readyState, send: jest.fn() };
}

function makeManager(exchanges = []) {
  return {
    workspaceId: 'workspace-1',
    getThread: jest.fn(() => Promise.resolve({ entry: { name: 'Reconnect thread' } })),
    getHistory: jest.fn(() => Promise.resolve({ messages: [] })),
    getRichHistory: jest.fn(() => Promise.resolve({ exchanges })),
    index: {
      markResumed: jest.fn(() => Promise.resolve()),
      touch: jest.fn(() => Promise.resolve()),
    },
  };
}

function makeHandlers(ws, manager) {
  const closeThread = jest.fn(() => Promise.resolve());
  const sendThreadList = jest.fn(() => Promise.resolve());
  const pendingReorderTimers = new Map();
  const wsState = new Map([[ws, {
    viewName: 'view-1',
    panelId: 'view-1',
    threadId: null,
    threadManager: manager,
  }]]);
  const handlers = createCrudHandlers({
    wsState,
    sendThreadList,
    closeThread,
    pendingReorderTimers,
    REORDER_DELAY_MS: 1000,
  });
  return { closeThread, handlers, pendingReorderTimers };
}

function clearPendingTimers(pendingReorderTimers) {
  for (const timer of pendingReorderTimers.values()) clearTimeout(timer);
  pendingReorderTimers.clear();
}

function broadcasterHandlers() {
  on.mockClear();
  createWireBroadcaster({ getClientForThread });
  return new Map(on.mock.calls.map(([type, handler]) => [type, handler]));
}

function parseSent(ws) {
  return ws.send.mock.calls.map(([message]) => JSON.parse(message));
}

describe('passive open active-turn reconnect routing', () => {
  let wire;
  let warnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    threadRuntimeManager.runtimes.clear();
    unregisterWire(THREAD_ID);
    wire = { pid: 123, killed: false, kill: jest.fn() };
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    unregisterWire(THREAD_ID);
    threadRuntimeManager.runtimes.clear();
    warnSpy.mockRestore();
  });

  test('closed owner is reclaimed and subsequent terminal delivery reaches the replacement', async () => {
    const oldOwner = makeWebSocket(3);
    const replacement = makeWebSocket(1);
    const persistedExchange = {
      exchangeId: 7,
      seq: 1,
      ts: 1234,
      user: 'earlier prompt',
      assistant: { parts: [{ type: 'text', content: 'earlier answer' }] },
      metadata: { contextUsage: 0.25 },
    };
    const manager = makeManager([persistedExchange]);
    const { closeThread, handlers, pendingReorderTimers } = makeHandlers(replacement, manager);

    registerWire(THREAD_ID, wire, '/tmp/project', oldOwner, { workspaceId: 'workspace-1' });
    threadRuntimeManager.beginLiveTurn(RUNTIME_KEY, { turnId: 'turn-live', userInput: 'alpha' });
    threadRuntimeManager.appendLiveContent(RUNTIME_KEY, 'partial');
    threadRuntimeManager.markInFlight(RUNTIME_KEY);

    await handlers.handleThreadOpen(replacement, { threadId: THREAD_ID });

    const opened = parseSent(replacement)[0];
    expect(opened).toMatchObject({
      type: 'thread:opened',
      threadId: THREAD_ID,
      exchanges: [persistedExchange],
      liveTurn: {
        threadId: THREAD_ID,
        turnId: 'turn-live',
        userInput: 'alpha',
        fullText: 'partial',
        status: 'in_flight',
      },
      contextUsage: 0.25,
    });
    expect(getClientForThread(THREAD_ID)).toBe(replacement);

    const routes = broadcasterHandlers();
    routes.get('chat:content')({
      scope: 'project', threadId: THREAD_ID, turnId: 'turn-live', text: ' answer',
    });
    routes.get('chat:turn_end')({
      scope: 'project',
      threadId: THREAD_ID,
      turnId: 'turn-live',
      fullText: 'partial answer',
      hasToolCalls: false,
      userInput: 'alpha',
      parts: [{ type: 'text', content: 'partial answer' }],
      reason: 'completed',
      partial: false,
    });
    routes.get('chat-turn:saved')({
      scope: 'project',
      threadId: THREAD_ID,
      turnId: 'turn-live',
      exchangeId: 8,
      seq: 2,
      ts: 5678,
      partial: false,
      reason: 'completed',
      metadata: {},
    });

    expect(parseSent(replacement).slice(1).map((message) => message.type)).toEqual([
      'content',
      'turn_end',
      'chat-turn:saved',
    ]);
    expect(closeThread).not.toHaveBeenCalled();
    expect(wire.kill).not.toHaveBeenCalled();
    expect(getWireForThread(THREAD_ID)).toBe(wire);
    expect(threadRuntimeManager.getRuntimeState(RUNTIME_KEY)).toBe(RUNTIME_STATES.IN_FLIGHT);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Reclaimed live delivery for thread ${THREAD_ID}`)
    );
    clearPendingTimers(pendingReorderTimers);
  });

  test('absent owner can be reclaimed without changing the runtime', async () => {
    const replacement = makeWebSocket(1);
    const manager = makeManager();
    const { handlers, pendingReorderTimers } = makeHandlers(replacement, manager);
    registerWire(THREAD_ID, wire, '/tmp/project', null, { workspaceId: 'workspace-1' });
    threadRuntimeManager.markInFlight(RUNTIME_KEY);

    await handlers.handleThreadOpen(replacement, { threadId: THREAD_ID });

    expect(getClientForThread(THREAD_ID)).toBe(replacement);
    expect(getWireForThread(THREAD_ID)).toBe(wire);
    expect(threadRuntimeManager.getRuntimeState(RUNTIME_KEY)).toBe(RUNTIME_STATES.IN_FLIGHT);
    expect(wire.kill).not.toHaveBeenCalled();
    clearPendingTimers(pendingReorderTimers);
  });

  test('an open owner is not hijacked by another passive viewer', async () => {
    const owner = makeWebSocket(1);
    const viewer = makeWebSocket(1);
    const manager = makeManager();
    const { handlers, pendingReorderTimers } = makeHandlers(viewer, manager);
    registerWire(THREAD_ID, wire, '/tmp/project', owner, { workspaceId: 'workspace-1' });
    threadRuntimeManager.beginLiveTurn(RUNTIME_KEY, { turnId: 'turn-live', userInput: 'alpha' });
    threadRuntimeManager.markInFlight(RUNTIME_KEY);

    await handlers.handleThreadOpen(viewer, { threadId: THREAD_ID });

    expect(getClientForThread(THREAD_ID)).toBe(owner);
    const routes = broadcasterHandlers();
    routes.get('chat:content')({
      scope: 'project', threadId: THREAD_ID, turnId: 'turn-live', text: 'owner only',
    });

    expect(parseSent(owner)).toEqual([
      expect.objectContaining({ type: 'content', threadId: THREAD_ID, text: 'owner only' }),
    ]);
    expect(parseSent(viewer).map((message) => message.type)).toEqual(['thread:opened']);
    expect(wire.kill).not.toHaveBeenCalled();
    clearPendingTimers(pendingReorderTimers);
  });

  test('dropped delivery reports the message type, thread, and socket state', () => {
    const closedOwner = makeWebSocket(3);
    registerWire(THREAD_ID, wire, '/tmp/project', closedOwner, { workspaceId: 'workspace-1' });
    const routes = broadcasterHandlers();

    routes.get('chat:content')({
      scope: 'project', threadId: THREAD_ID, turnId: 'turn-live', text: 'lost',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Dropped content for thread ${THREAD_ID}: client readyState=3`)
    );
  });
});
