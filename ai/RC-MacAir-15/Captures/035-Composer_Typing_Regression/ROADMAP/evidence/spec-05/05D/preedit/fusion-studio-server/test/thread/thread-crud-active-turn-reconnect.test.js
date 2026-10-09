'use strict';

const { EventEmitter } = require('node:events');

jest.mock('../../lib/event-bus', () => ({
  on: jest.fn(),
}));

const { on } = require('../../lib/event-bus');
const { createCrudHandlers } = require('../../lib/thread/thread-crud');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const {
  getClientForThread,
  getWireForThread,
  createWireLifecycle,
  registerWire,
  attachClientToWire,
  unregisterWire,
  unregisterWireForClient,
} = require('../../lib/wire/process-manager');
const { createWireBroadcaster } = require('../../lib/wire/wire-broadcaster');

const THREAD_ID = 'thread-reconnect-1';
const PROJECT_ROOT = '/tmp/project';
const WORKSPACE_EPOCH = 'epoch-reconnect';
const RUNTIME_KEY = {
  workspaceId: 'workspace-1',
  projectRoot: PROJECT_ROOT,
  workspaceEpoch: WORKSPACE_EPOCH,
  scope: 'project',
  threadId: THREAD_ID,
};

function makeWebSocket(readyState = 1) {
  return { readyState, send: jest.fn() };
}

function makeManager(exchanges = []) {
  return {
    workspaceId: 'workspace-1',
    projectRoot: PROJECT_ROOT,
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
    workspaceEpoch: WORKSPACE_EPOCH,
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

test('retiring the exact client wire stops live fan-out immediately', () => {
  const owner = makeWebSocket();
  const other = makeWebSocket();
  const wire = { pid: 79, killed: false };
  registerWire(THREAD_ID, wire, PROJECT_ROOT, owner, RUNTIME_KEY);
  const routes = broadcasterHandlers();

  expect(unregisterWireForClient(THREAD_ID, RUNTIME_KEY, other)).toBe(false);
  routes.get('chat:content')({
    workspaceId: 'workspace-1',
    projectRoot: PROJECT_ROOT,
    workspaceEpoch: WORKSPACE_EPOCH,
    threadId: THREAD_ID,
    scope: 'project',
    turnId: 'turn-before-retire',
    streamSeq: 1,
    activityRevision: 1,
    text: 'still owned',
  });
  expect(parseSent(owner).map(message => message.text)).toContain('still owned');
  owner.send.mockClear();

  expect(unregisterWireForClient(THREAD_ID, RUNTIME_KEY, owner)).toBe(true);
  routes.get('chat:content')({
    workspaceId: 'workspace-1',
    projectRoot: PROJECT_ROOT,
    workspaceEpoch: WORKSPACE_EPOCH,
    threadId: THREAD_ID,
    scope: 'project',
    turnId: 'turn-after-retire',
    streamSeq: 2,
    activityRevision: 2,
    text: 'must not cross workspace bind',
  });
  expect(owner.send).not.toHaveBeenCalled();
});

test('a retired wire exit cannot notify the newly bound workspace', () => {
  const ws = makeWebSocket();
  const wire = new EventEmitter();
  wire.stdout = new EventEmitter();
  const session = { buffer: '', wire };
  const lifecycle = createWireLifecycle({
    session,
    ws,
    connectionId: 'connection-retired',
    onWireMessage: jest.fn(),
  });
  lifecycle.setupWireHandlers(wire, THREAD_ID, RUNTIME_KEY);

  session.wire = null;
  wire.emit('exit', 0);

  expect(ws.send).not.toHaveBeenCalled();
});

test('wire output and exit follow the exact current client after ownership transfer', () => {
  const ownerA = makeWebSocket();
  const ownerB = makeWebSocket();
  const wire = new EventEmitter();
  wire.stdout = new EventEmitter();
  const sessionA = { buffer: '', wire };
  const sessionB = { buffer: '', wire: null };
  const messagesA = jest.fn();
  const messagesB = jest.fn();
  createWireLifecycle({
    session: sessionA, ws: ownerA, connectionId: 'owner-a', onWireMessage: messagesA,
  }).setupWireHandlers(wire, THREAD_ID, {
    workspaceId: 'workspace-transfer', projectRoot: '/tmp/project-transfer',
    workspaceEpoch: 'epoch-transfer',
  });
  createWireLifecycle({
    session: sessionB, ws: ownerB, connectionId: 'owner-b', onWireMessage: messagesB,
  });
  registerWire(THREAD_ID, wire, '/tmp/project-transfer', ownerA, {
    workspaceId: 'workspace-transfer',
    projectRoot: '/tmp/project-transfer',
    workspaceEpoch: 'epoch-transfer',
  });

  expect(attachClientToWire(
    THREAD_ID, wire, '/tmp/project-transfer', ownerB, {
      workspaceId: 'workspace-transfer', projectRoot: '/tmp/project-transfer',
      workspaceEpoch: 'epoch-transfer',
    },
  )).toBe(true);
  sessionB.wire = wire;
  expect(sessionA.wire).toBeNull();

  wire.stdout.emit('data', Buffer.from('{"type":"current-owner"}\n'));
  expect(messagesA).not.toHaveBeenCalled();
  expect(messagesB).toHaveBeenCalledWith({ type: 'current-owner' });

  wire.emit('exit', 0);
  expect(getWireForThread(THREAD_ID, 'workspace-transfer')).toBeNull();
  expect(sessionB.wire).toBeNull();
  expect(ownerA.send).not.toHaveBeenCalled();
  expect(ownerB.send).toHaveBeenCalledWith(JSON.stringify({ type: 'wire_disconnected', code: 0 }));
});

test('one provider process cannot be rebound under a different workspace root', () => {
  const ownerA = makeWebSocket();
  const ownerB = makeWebSocket();
  const wire = { pid: 124, killed: false };
  const scopeA = {
    workspaceId: 'workspace-shared', projectRoot: '/tmp/project-root-a', workspaceEpoch: 'epoch-a',
  };
  const scopeB = {
    workspaceId: 'workspace-shared', projectRoot: '/tmp/project-root-b', workspaceEpoch: 'epoch-b',
  };
  registerWire(THREAD_ID, wire, scopeA.projectRoot, ownerA, scopeA);

  expect(() => attachClientToWire(
    THREAD_ID, wire, scopeB.projectRoot, ownerB, scopeB,
  )).toThrow('Provider wire belongs to a different workspace root');
  expect(() => registerWire(
    THREAD_ID, wire, scopeB.projectRoot, ownerB, scopeB,
  )).toThrow('Provider wire belongs to a different workspace root');
  expect(getClientForThread(THREAD_ID, scopeA)).toBe(ownerA);
  expect(getClientForThread(THREAD_ID, scopeB)).toBeNull();

  unregisterWire(THREAD_ID, scopeA, wire);
});

test('equal thread ids in different workspaces keep distinct wires and recipients', () => {
  const ownerA = makeWebSocket();
  const ownerB = makeWebSocket();
  const wireA = { pid: 80, killed: false };
  const wireB = { pid: 81, killed: false };
  registerWire(THREAD_ID, wireA, '/tmp/project-a', ownerA, {
    workspaceId: 'workspace-a', projectRoot: '/tmp/project-a', workspaceEpoch: 'epoch-a',
  });
  registerWire(THREAD_ID, wireB, '/tmp/project-b', ownerB, {
    workspaceId: 'workspace-b', projectRoot: '/tmp/project-b', workspaceEpoch: 'epoch-b',
  });
  const routes = broadcasterHandlers();

  routes.get('chat:content')({
    workspaceId: 'workspace-b', projectRoot: '/tmp/project-b', workspaceEpoch: 'epoch-b',
    scope: 'project', threadId: THREAD_ID,
    turnId: 'turn-b', streamSeq: 1, activityRevision: 1, text: 'only B',
  });

  expect(getWireForThread(THREAD_ID, 'workspace-a')).toBe(wireA);
  expect(getWireForThread(THREAD_ID, 'workspace-b')).toBe(wireB);
  expect(ownerA.send).not.toHaveBeenCalled();
  expect(parseSent(ownerB)).toEqual([
    expect.objectContaining({ type: 'content', threadId: THREAD_ID, text: 'only B' }),
  ]);
  unregisterWire(THREAD_ID, 'workspace-a', wireA);
  unregisterWire(THREAD_ID, 'workspace-b', wireB);
});

describe('passive open active-turn reconnect routing', () => {
  let wire;
  let warnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    threadRuntimeManager.runtimes.clear();
    unregisterWire(THREAD_ID, 'workspace-1');
    wire = { pid: 123, killed: false, kill: jest.fn() };
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    unregisterWire(THREAD_ID, 'workspace-1');
    threadRuntimeManager.runtimes.clear();
    warnSpy.mockRestore();
  });

  test('passive open never reclaims a closed live owner or redirects later delivery', async () => {
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

    registerWire(THREAD_ID, wire, PROJECT_ROOT, oldOwner, RUNTIME_KEY);
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
    expect(getClientForThread(THREAD_ID, RUNTIME_KEY)).toBe(oldOwner);

    const routes = broadcasterHandlers();
    routes.get('chat:content')({
      workspaceId: 'workspace-1', projectRoot: PROJECT_ROOT, workspaceEpoch: WORKSPACE_EPOCH,
      scope: 'project', threadId: THREAD_ID, turnId: 'turn-live', text: ' answer',
    });
    routes.get('chat:turn_end')({
      scope: 'project',
      workspaceId: 'workspace-1',
      projectRoot: PROJECT_ROOT,
      workspaceEpoch: WORKSPACE_EPOCH,
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
      workspaceId: 'workspace-1',
      projectRoot: PROJECT_ROOT,
      workspaceEpoch: WORKSPACE_EPOCH,
      threadId: THREAD_ID,
      turnId: 'turn-live',
      exchangeId: 8,
      seq: 2,
      ts: 5678,
      partial: false,
      reason: 'completed',
      metadata: {},
    });

    expect(parseSent(replacement).slice(1)).toEqual([]);
    expect(closeThread).not.toHaveBeenCalled();
    expect(wire.kill).not.toHaveBeenCalled();
    expect(getWireForThread(THREAD_ID, 'workspace-1')).toBe(wire);
    expect(threadRuntimeManager.getRuntimeState(RUNTIME_KEY)).toBe(RUNTIME_STATES.IN_FLIGHT);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(
      `Dropped content for thread ${THREAD_ID}: client readyState=3`
    ));
    clearPendingTimers(pendingReorderTimers);
  });

  test('passive open leaves an absent delivery owner unchanged', async () => {
    const replacement = makeWebSocket(1);
    const manager = makeManager();
    const { handlers, pendingReorderTimers } = makeHandlers(replacement, manager);
    registerWire(THREAD_ID, wire, PROJECT_ROOT, null, RUNTIME_KEY);
    threadRuntimeManager.markInFlight(RUNTIME_KEY);

    await handlers.handleThreadOpen(replacement, { threadId: THREAD_ID });

    expect(getClientForThread(THREAD_ID, RUNTIME_KEY)).toBeNull();
    expect(getWireForThread(THREAD_ID, 'workspace-1')).toBe(wire);
    expect(threadRuntimeManager.getRuntimeState(RUNTIME_KEY)).toBe(RUNTIME_STATES.IN_FLIGHT);
    expect(wire.kill).not.toHaveBeenCalled();
    clearPendingTimers(pendingReorderTimers);
  });

  test('an open owner is not hijacked by another passive viewer', async () => {
    const owner = makeWebSocket(1);
    const viewer = makeWebSocket(1);
    const manager = makeManager();
    const { handlers, pendingReorderTimers } = makeHandlers(viewer, manager);
    registerWire(THREAD_ID, wire, PROJECT_ROOT, owner, RUNTIME_KEY);
    threadRuntimeManager.beginLiveTurn(RUNTIME_KEY, { turnId: 'turn-live', userInput: 'alpha' });
    threadRuntimeManager.markInFlight(RUNTIME_KEY);

    await handlers.handleThreadOpen(viewer, { threadId: THREAD_ID });

    expect(getClientForThread(THREAD_ID, RUNTIME_KEY)).toBe(owner);
    const routes = broadcasterHandlers();
    routes.get('chat:content')({
      workspaceId: 'workspace-1', projectRoot: PROJECT_ROOT, workspaceEpoch: WORKSPACE_EPOCH,
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
    registerWire(THREAD_ID, wire, PROJECT_ROOT, closedOwner, RUNTIME_KEY);
    const routes = broadcasterHandlers();

    routes.get('chat:content')({
      workspaceId: 'workspace-1', projectRoot: PROJECT_ROOT, workspaceEpoch: WORKSPACE_EPOCH,
      scope: 'project', threadId: THREAD_ID, turnId: 'turn-live', text: 'lost',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Dropped content for thread ${THREAD_ID}: client readyState=3`)
    );
  });
});
