'use strict';

const { EventEmitter } = require('events');

jest.mock('uuid', () => ({ v4: jest.fn(() => '00000000-0000-4000-8000-000000000001') }));

jest.mock('../../lib/harness/compat', () => ({
  spawnThreadWire: jest.fn(),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  attachClientToWire: jest.fn(),
  getWireForThread: jest.fn(() => null),
  registerWire: jest.fn(),
  unregisterWire: jest.fn(),
  unregisterWireForClient: jest.fn(),
}));

const mockGetProjectThreadManager = jest.fn();
jest.mock('../../lib/thread/thread-manager-registry', () => ({
  getProjectThreadManager: (...args) => mockGetProjectThreadManager(...args),
  _getProjectThreadManagers: jest.fn(() => new Map()),
}));

const { spawnThreadWire } = require('../../lib/harness/compat');
const {
  attachClientToWire,
  getWireForThread,
  unregisterWire,
  unregisterWireForClient,
} = require('../../lib/wire/process-manager');
const {
  ThreadManager,
  ThreadWebSocketHandler,
  threadRuntimeController,
  threadRuntimeManager,
} = require('../../lib/thread');
const { SessionManager } = require('../../lib/thread/session-manager');
const { createThreadWsHandlers, spawnAndSetupWire } = require('../../lib/ws/thread-ws-handlers');
const { emit: emitBusEvent, on: onBusEvent } = require('../../lib/event-bus');

function makeWs() {
  return { send: jest.fn(), readyState: 1 };
}

function makeManager() {
  const sessions = new Map();
  const manager = {
    workspaceId: 'workspace-lifecycle',
    projectRoot: '/tmp/spec00c-lifecycle',
    getThread: jest.fn(() => Promise.resolve({ entry: { harnessId: 'opencode' } })),
    getHistory: jest.fn(() => Promise.resolve({ messages: [] })),
    getRichHistory: jest.fn(() => Promise.resolve({ exchanges: [] })),
    index: {
      markResumed: jest.fn(() => Promise.resolve()),
      touch: jest.fn(() => Promise.resolve()),
    },
    openSession: jest.fn(async (threadId, wireProcess, ws, options = {}) => {
      sessions.set(threadId, {
        threadId, wireProcess, ws, state: 'active',
        workspaceEpoch: options.workspaceEpoch || null,
      });
    }),
    getSession: jest.fn(threadId => sessions.get(threadId)),
    restoreSessionOwner: jest.fn(async (threadId, expectedSession, expectedWire, expectedWs, previous) => {
      if (sessions.get(threadId) !== expectedSession
        || expectedSession?.wireProcess !== expectedWire
        || expectedSession?.ws !== expectedWs) return false;
      if (previous) sessions.set(threadId, previous);
      else sessions.delete(threadId);
      return true;
    }),
    closeSession: jest.fn(async (threadId) => {
      sessions.delete(threadId);
      return true;
    }),
    deleteThread: jest.fn(() => Promise.resolve(true)),
    listThreads: jest.fn(() => Promise.resolve([])),
  };
  manager._sessions = sessions;
  return manager;
}

function setState(ws, manager, threadId, activatedThreadId, workspaceEpoch = null) {
  ThreadWebSocketHandler._getWsState().set(ws, {
    panelId: 'chat',
    viewName: 'chat',
    threadId,
    activatedThreadId,
    workspaceEpoch,
    threadManager: manager,
  });
}

async function activateThroughSharedSpawn(ws, session, threadId) {
  const wire = { pid: 42, killed: false, kill: jest.fn() };
  spawnThreadWire.mockReturnValue(wire);
  await spawnAndSetupWire({
    ws,
    session,
    projectRoot: '/tmp/spec00c-lifecycle',
    threadId,
    wireLifecycle: {
      awaitHarnessReady: jest.fn(() => Promise.resolve()),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
  });
  return wire;
}

afterEach(async () => {
  for (const ws of ThreadWebSocketHandler._getWsState().keys()) {
    await ThreadWebSocketHandler.cleanup(ws);
  }
  threadRuntimeManager.runtimes.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  getWireForThread.mockReturnValue(null);
});

test('trusted active assistant resume reuses the exact live provider through the public handler', async () => {
  const ws = makeWs();
  const previousWs = makeWs();
  const manager = Object.create(ThreadManager.prototype);
  manager.workspaceId = 'workspace-lifecycle';
  manager.projectRoot = '/tmp/spec00c-lifecycle';
  manager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
  manager.index = {
    activate: jest.fn(async () => {}),
    markResumed: jest.fn(async () => {}),
    touch: jest.fn(async () => {}),
    suspend: jest.fn(async () => {}),
    list: jest.fn(async () => []),
  };
  manager._enforceSessionLimit = jest.fn(async () => {});
  manager.getThread = jest.fn(async () => ({ entry: { harnessId: 'opencode' } }));
  manager.getHistory = jest.fn(async () => ({ messages: [] }));
  manager.getRichHistory = jest.fn(async () => ({ exchanges: [] }));
  const wire = new EventEmitter();
  wire.pid = 70;
  wire.killed = false;
  wire.exitCode = null;
  wire.signalCode = null;
  wire.kill = jest.fn((signal) => {
    wire.killed = true;
    queueMicrotask(() => wire.emit('close', null, signal));
    return true;
  });
  const session = {
    currentWorkspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-active-resume',
    workspaceBindingState: 'active',
    wire,
    currentThreadId: 'thread-active',
  };
  Object.defineProperty(session, 'connectionRole', {
    value: 'trusted-shell',
    enumerable: false,
  });
  await manager.openSession('thread-active', wire, previousWs, {
    workspaceEpoch: session.workspaceEpoch,
  });
  threadRuntimeManager.markReady({
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: session.workspaceEpoch,
    scope: 'project',
    threadId: 'thread-active',
  });
  getWireForThread.mockReturnValue(wire);
  setState(ws, manager, 'thread-active', null, session.workspaceEpoch);
  const handlers = createThreadWsHandlers({
    ws,
    session,
    projectRoot: manager.projectRoot,
    wireLifecycle: {
      awaitHarnessReady: jest.fn(async () => {}),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
  });

  await handlers['thread:open-assistant']({
    type: 'thread:open-assistant',
    threadId: 'thread-active',
  });

  expect(spawnThreadWire).not.toHaveBeenCalled();
  expect(manager.getSession('thread-active')).toMatchObject({ wireProcess: wire, ws });
  expect(wire.kill).not.toHaveBeenCalled();
  expect(attachClientToWire).toHaveBeenCalledWith(
    'thread-active', wire, manager.projectRoot, ws,
    {
      workspaceId: manager.workspaceId, projectRoot: manager.projectRoot,
      workspaceEpoch: session.workspaceEpoch, viewId: null,
    },
  );
  expect(ws.send.mock.calls.map(([frame]) => JSON.parse(frame).type))
    .toEqual(expect.arrayContaining(['thread:opened', 'wire_ready']));
});

test('assistant resume cannot transfer or announce a provider reserved by concurrent Stop', async () => {
  const wsA = makeWs();
  const wsB = makeWs();
  const manager = Object.create(ThreadManager.prototype);
  manager.workspaceId = 'workspace-lifecycle';
  manager.projectRoot = '/tmp/spec00c-lifecycle';
  manager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
  manager.index = {
    activate: jest.fn(async () => {}),
    markResumed: jest.fn(async () => {}),
    touch: jest.fn(async () => {}),
    suspend: jest.fn(async () => {}),
    list: jest.fn(async () => []),
  };
  manager._enforceSessionLimit = jest.fn(async () => {});
  manager.getThread = jest.fn(async () => ({ entry: { harnessId: 'opencode' } }));
  manager.getHistory = jest.fn(async () => ({ messages: [] }));
  manager.getRichHistory = jest.fn(async () => ({ exchanges: [] }));
  const wire = new EventEmitter();
  wire.killed = false;
  wire.exitCode = null;
  wire.signalCode = null;
  wire.kill = jest.fn();
  await manager.openSession('thread-active', wire, wsA, { workspaceEpoch: 'epoch-stop-race' });
  setState(wsA, manager, 'thread-active', 'thread-active', 'epoch-stop-race');
  setState(wsB, manager, 'thread-active', null, 'epoch-stop-race');
  const runtimeKey = {
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-stop-race',
    scope: 'project',
    threadId: 'thread-active',
  };
  let releaseStop;
  const stopGate = new Promise(resolve => { releaseStop = resolve; });
  const stopHarness = jest.fn(async () => {
    await stopGate;
    wire.killed = true;
    wire.exitCode = 0;
  });
  threadRuntimeManager.markInFlight(runtimeKey);
  threadRuntimeManager.claimActiveDrain(runtimeKey, {
    drainId: 'concurrent-stop-drain',
    stopHarness,
  });
  threadRuntimeManager.beginLiveTurn(runtimeKey, {
    turnId: 'turn-active',
    userInput: 'hello',
  });
  getWireForThread.mockReturnValue(wire);
  const stop = threadRuntimeController.stopRuntimeTurn({
    ws: wsA,
    session: { currentThreadId: 'thread-active', workspaceEpoch: 'epoch-stop-race', wire },
    clientMsg: { type: 'turn:stop', threadId: 'thread-active' },
    handleCanonicalHarnessEvent: jest.fn(async () => {}),
  });
  await new Promise(resolve => setImmediate(resolve));
  expect(manager.getSession('thread-active')).toMatchObject({ ws: wsA, state: 'stopping' });

  const sessionB = {
    currentWorkspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-stop-race',
    workspaceBindingState: 'active',
  };
  Object.defineProperty(sessionB, 'connectionRole', { value: 'trusted-shell' });
  const handlersB = createThreadWsHandlers({
    ws: wsB,
    session: sessionB,
    projectRoot: manager.projectRoot,
    wireLifecycle: {},
  });
  await handlersB['thread:open-assistant']({
    type: 'thread:open-assistant',
    threadId: 'thread-active',
  });

  expect(manager.index.markResumed).toHaveBeenCalledTimes(1);
  expect(spawnThreadWire).not.toHaveBeenCalled();
  expect(attachClientToWire).not.toHaveBeenCalled();
  expect(manager.getSession('thread-active')).toMatchObject({ ws: wsA, state: 'stopping' });
  expect(wsB.send.mock.calls.map(([raw]) => JSON.parse(raw)))
    .toEqual([{
      type: 'error',
      code: 'THREAD_MUTATION_DENIED',
      message: 'Thread mutation denied',
    }]);

  releaseStop();
  await stop;
  expect(stopHarness).toHaveBeenCalledTimes(1);
  expect(unregisterWire).toHaveBeenCalledWith(
    'thread-active', runtimeKey, wire,
  );
  expect(manager.getSession('thread-active')).toBeUndefined();
  expect(manager.index.suspend).toHaveBeenCalledWith('thread-active');
});

test('disconnect retains its exact manager binding until canonical drain quiescence', async () => {
  const ws = makeWs();
  const manager = Object.create(ThreadManager.prototype);
  manager.workspaceId = 'workspace-lifecycle';
  manager.projectRoot = '/tmp/spec00c-lifecycle';
  manager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
  manager.index = {
    activate: jest.fn(async () => {}),
    markResumed: jest.fn(async () => {}),
    suspend: jest.fn(async () => {}),
    list: jest.fn(async () => []),
  };
  manager._enforceSessionLimit = jest.fn(async () => {});
  const wire = new EventEmitter();
  wire.killed = false;
  wire.exitCode = null;
  wire.signalCode = null;
  wire.kill = jest.fn((signal) => {
    wire.killed = true;
    queueMicrotask(() => wire.emit('close', null, signal));
    return true;
  });
  await manager.openSession('thread-active', wire, ws, { workspaceEpoch: null });
  setState(ws, manager, 'thread-active', 'thread-active', null);
  const runtimeKey = {
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: null,
    scope: 'project',
    threadId: 'thread-active',
  };
  let finishDrain;
  const drainCompletion = new Promise(resolve => { finishDrain = resolve; });
  const retire = jest.fn(async () => {
    expect(ThreadWebSocketHandler.getState(ws)?.threadManager).toBe(manager);
    return true;
  });
  threadRuntimeManager.markInFlight(runtimeKey);
  threadRuntimeManager.claimActiveDrain(runtimeKey, { drainId: 'disconnect-drain' });
  threadRuntimeManager.bindActiveDrainLifecycle(runtimeKey, 'disconnect-drain', {
    completion: drainCompletion,
    retire,
  });

  let cleanupResolved = false;
  const cleaning = ThreadWebSocketHandler.cleanup(ws).then(() => {
    cleanupResolved = true;
  });
  await new Promise(resolve => setImmediate(resolve));

  expect(retire).toHaveBeenCalledTimes(1);
  expect(cleanupResolved).toBe(false);
  expect(ThreadWebSocketHandler.getState(ws)?.threadManager).toBe(manager);
  expect(wire.kill).not.toHaveBeenCalled();

  finishDrain();
  await cleaning;
  expect(wire.kill).toHaveBeenCalledWith('SIGTERM');
  expect(ThreadWebSocketHandler.getState(ws)).toBeUndefined();
});

test('passive selection followed by warm/prompt shared spawn owns disconnect cleanup', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const session = { currentWorkspaceId: 'workspace-lifecycle', projectRoot: manager.projectRoot, wire: null };
  setState(ws, manager, 'thread-b', null);

  const wire = await activateThroughSharedSpawn(ws, session, 'thread-b');
  expect(manager.openSession).toHaveBeenCalledWith('thread-b', wire, ws, { workspaceEpoch: null });
  expect(attachClientToWire).toHaveBeenCalledWith(
    'thread-b', wire, manager.projectRoot, ws,
    {
      workspaceId: manager.workspaceId, projectRoot: manager.projectRoot,
      workspaceEpoch: null, viewId: null,
    },
  );
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: 'thread-b',
    activatedThreadId: 'thread-b',
  });

  await ThreadWebSocketHandler.cleanup(ws);
  expect(manager.closeSession).toHaveBeenCalledTimes(1);
  expect(manager.closeSession).toHaveBeenCalledWith('thread-b');
});

test('warm/prompt activation transfers active A to passively selected B before cleanup', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const session = { currentWorkspaceId: 'workspace-lifecycle', projectRoot: manager.projectRoot, wire: null };
  setState(ws, manager, 'thread-b', 'thread-a');

  const wire = await activateThroughSharedSpawn(ws, session, 'thread-b');
  expect(manager.closeSession).toHaveBeenNthCalledWith(1, 'thread-a');
  expect(manager.openSession).toHaveBeenCalledWith('thread-b', wire, ws, { workspaceEpoch: null });
  expect(manager.openSession.mock.invocationCallOrder[0])
    .toBeLessThan(manager.closeSession.mock.invocationCallOrder[0]);

  await ThreadWebSocketHandler.cleanup(ws);
  expect(manager.closeSession).toHaveBeenNthCalledWith(2, 'thread-b');
});

test('duplicate same-thread activation fails target CAS without closing the live predecessor', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const currentWire = { pid: 101 };
  const challenger = { pid: 102 };
  let owned = { threadId: 'thread-a', wireProcess: currentWire, ws };
  manager.getSession = jest.fn(() => owned);
  manager.openSession.mockImplementation(async (threadId, wireProcess, ownerWs) => {
    if (owned && owned.wireProcess !== wireProcess) throw new Error('A live provider already owns this thread');
    owned = { threadId, wireProcess, ws: ownerWs };
  });
  manager.closeSession.mockImplementation(async () => {
    owned = null;
    return true;
  });
  setState(ws, manager, 'thread-a', 'thread-a');

  await expect(ThreadWebSocketHandler.activateThreadSession(
    ws,
    'thread-a',
    challenger,
  )).rejects.toThrow('A live provider already owns this thread');

  expect(manager.closeSession).not.toHaveBeenCalled();
  expect(owned).toEqual({ threadId: 'thread-a', wireProcess: currentWire, ws });
  expect(attachClientToWire).not.toHaveBeenCalled();
  expect(ThreadWebSocketHandler.getState(ws).activatedThreadId).toBe('thread-a');
});

test('occupied target activation preserves the connection-owned predecessor', async () => {
  const ws = makeWs();
  const otherWs = makeWs();
  const manager = makeManager();
  const wireA = { pid: 201 };
  const wireB = { pid: 202 };
  const challenger = { pid: 203 };
  const sessions = new Map([
    ['thread-a', { threadId: 'thread-a', wireProcess: wireA, ws }],
    ['thread-b', { threadId: 'thread-b', wireProcess: wireB, ws: otherWs }],
  ]);
  manager.getSession = jest.fn(threadId => sessions.get(threadId));
  manager.openSession.mockImplementation(async (threadId, wireProcess, ownerWs) => {
    const existing = sessions.get(threadId);
    if (existing && existing.wireProcess !== wireProcess) {
      throw new Error('A live provider already owns this thread');
    }
    sessions.set(threadId, { threadId, wireProcess, ws: ownerWs });
  });
  manager.closeSession.mockImplementation(async threadId => sessions.delete(threadId));
  setState(ws, manager, 'thread-a', 'thread-a');

  await expect(ThreadWebSocketHandler.activateThreadSession(
    ws,
    'thread-b',
    challenger,
  )).rejects.toThrow('A live provider already owns this thread');

  expect(manager.closeSession).not.toHaveBeenCalled();
  expect(sessions.get('thread-a')).toEqual({ threadId: 'thread-a', wireProcess: wireA, ws });
  expect(sessions.get('thread-b')).toEqual({ threadId: 'thread-b', wireProcess: wireB, ws: otherWs });
  expect(ThreadWebSocketHandler.getState(ws).activatedThreadId).toBe('thread-a');
});

test('predecessor retirement failure restores a same-wire target to its prior owner', async () => {
  const ws = makeWs();
  const otherWs = makeWs();
  const manager = makeManager();
  const wireA = { pid: 211, killed: false };
  const wireB = { pid: 212, killed: false };
  const target = {
    threadId: 'thread-b', wireProcess: wireB, ws: otherWs,
    state: 'active', workspaceEpoch: 'epoch-other',
  };
  manager.getSession = jest.fn(threadId => (threadId === 'thread-b' ? target : null));
  manager.openSession.mockImplementation(async (_threadId, _wire, ownerWs, options = {}) => {
    target.ws = ownerWs;
    target.workspaceEpoch = options.workspaceEpoch || null;
  });
  manager.restoreSessionOwner.mockImplementation(async (
    _threadId, expectedSession, expectedWire, expectedWs, previous,
  ) => {
    if (expectedSession !== target || expectedWire !== wireB || target.ws !== expectedWs) return false;
    target.ws = previous.ws;
    target.workspaceEpoch = previous.workspaceEpoch;
    return true;
  });
  manager.closeSession.mockImplementation(async (threadId) => {
    if (threadId === 'thread-a') throw new Error('injected predecessor retirement failure');
    throw new Error('target must be restored, not closed');
  });
  setState(ws, manager, 'thread-b', 'thread-a', 'epoch-new-owner');

  await expect(ThreadWebSocketHandler.activateThreadSession(
    ws, 'thread-b', wireB,
  )).rejects.toThrow('injected predecessor retirement failure');

  expect(manager.restoreSessionOwner).toHaveBeenCalledTimes(1);
  expect(target).toMatchObject({
    wireProcess: wireB, ws: otherWs, state: 'active', workspaceEpoch: 'epoch-other',
  });
  expect(manager.closeSession).toHaveBeenCalledTimes(1);
  expect(manager.closeSession).toHaveBeenCalledWith('thread-a');
  expect(attachClientToWire).not.toHaveBeenCalled();
  expect(wireA.killed).toBe(false);
  expect(wireB.killed).toBe(false);
  manager.closeSession.mockResolvedValue(true);
});

test('target exit while predecessor retires rolls back without publishing ownership', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const wireB = { pid: 221, killed: false, exitCode: null, signalCode: null };
  manager.closeSession.mockImplementation(async (threadId) => {
    manager._sessions.delete(threadId);
    if (threadId === 'thread-a') {
      wireB.killed = true;
      wireB.exitCode = 0;
    }
    return true;
  });
  setState(ws, manager, 'thread-b', 'thread-a', 'epoch-exit-race');

  await expect(ThreadWebSocketHandler.activateThreadSession(
    ws, 'thread-b', wireB,
  )).rejects.toThrow('Thread activation target exited or changed during predecessor retirement');

  expect(manager.closeSession.mock.calls.map(([threadId]) => threadId)).toEqual([
    'thread-a', 'thread-b',
  ]);
  expect(manager.getSession('thread-b')).toBeUndefined();
  expect(attachClientToWire).not.toHaveBeenCalled();
  expect(ThreadWebSocketHandler.getState(ws).activatedThreadId).toBeNull();
});

test('deleting passive B preserves unrelated active A', async () => {
  const ws = makeWs();
  const manager = makeManager();
  setState(ws, manager, 'thread-b', 'thread-a');

  await ThreadWebSocketHandler.handleThreadDelete(ws, { threadId: 'thread-b' });

  expect(manager.closeSession).not.toHaveBeenCalled();
  expect(manager.deleteThread).toHaveBeenCalledWith('thread-b');
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: null,
    activatedThreadId: 'thread-a',
  });
});

test('deleting active A closes A while preserving passive B selection', async () => {
  const ws = makeWs();
  const manager = makeManager();
  setState(ws, manager, 'thread-b', 'thread-a');

  await ThreadWebSocketHandler.handleThreadDelete(ws, { threadId: 'thread-a' });

  expect(manager.closeSession).toHaveBeenCalledWith('thread-a');
  expect(manager.deleteThread).toHaveBeenCalledWith('thread-a');
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: 'thread-b',
    activatedThreadId: null,
  });
});

test('workspace switch closes activation even when passive selection is empty', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const nextManager = { workspaceId: 'workspace-next' };
  mockGetProjectThreadManager.mockReturnValue(nextManager);
  setState(ws, manager, null, 'thread-a');

  ThreadWebSocketHandler.setPanel(ws, 'chat', {
    projectRoot: '/tmp/spec00c-next-workspace',
    workspaceId: 'workspace-next',
  });
  await new Promise(resolve => setImmediate(resolve));

  expect(manager.closeSession).toHaveBeenCalledWith('thread-a');
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: null,
    activatedThreadId: null,
    threadManager: nextManager,
  });
});

test('same workspace id at a different project root installs a distinct manager', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const nextManager = {
    workspaceId: manager.workspaceId,
    projectRoot: '/tmp/spec00c-relocated-workspace',
  };
  mockGetProjectThreadManager.mockReturnValue(nextManager);
  setState(ws, manager, null, 'thread-a');

  ThreadWebSocketHandler.setPanel(ws, 'chat', {
    projectRoot: nextManager.projectRoot,
    workspaceId: manager.workspaceId,
  });
  await new Promise(resolve => setImmediate(resolve));

  expect(mockGetProjectThreadManager).toHaveBeenCalledWith(
    nextManager.projectRoot, manager.workspaceId,
  );
  expect(manager.closeSession).toHaveBeenCalledWith('thread-a');
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: null,
    activatedThreadId: null,
    threadManager: nextManager,
  });
});

test('workspace bind retirement clears selection and delivery before suspending the provider', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const wire = { pid: 44, killed: false };
  const session = { wire };
  getWireForThread.mockReturnValue(wire);
  let finishSuspension;
  let markSuspensionStarted;
  const suspensionStarted = new Promise(resolve => { markSuspensionStarted = resolve; });
  manager.closeSession.mockImplementation(() => new Promise(resolve => {
    finishSuspension = () => resolve(true);
    markSuspensionStarted();
  }));
  setState(ws, manager, 'thread-passive', 'thread-active');

  const retiring = ThreadWebSocketHandler.retireWorkspaceBinding(ws, session);
  await suspensionStarted;
  expect(unregisterWireForClient).toHaveBeenCalledWith(
    'thread-active', {
      workspaceId: manager.workspaceId, projectRoot: manager.projectRoot, workspaceEpoch: null,
    }, ws,
  );
  expect(session.wire).toBeNull();
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({ workspaceRetired: true });

  finishSuspension();
  await retiring;
  expect(manager.closeSession).toHaveBeenCalledWith('thread-active');
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: null,
    activatedThreadId: null,
    workspaceRetired: true,
  });
});

test('a stale client workspace retirement cannot close another client provider owner', async () => {
  const wsA = makeWs();
  const wsB = makeWs();
  const manager = makeManager();
  const wireB = { pid: 45, killed: false };
  manager.getSession = jest.fn(() => ({ threadId: 'thread-shared', ws: wsB, wireProcess: wireB }));
  manager.closeSessionAndWait = jest.fn(() => Promise.resolve(true));
  getWireForThread.mockReturnValue(wireB);
  unregisterWireForClient.mockReturnValue(false);
  const retireDrain = jest.spyOn(threadRuntimeManager, 'retireActiveDrain');
  setState(wsA, manager, 'thread-shared', 'thread-shared');

  await ThreadWebSocketHandler.retireWorkspaceBinding(wsA, { wire: null });

  expect(unregisterWireForClient).toHaveBeenCalledWith(
    'thread-shared', {
      workspaceId: manager.workspaceId, projectRoot: manager.projectRoot, workspaceEpoch: null,
    }, wsA,
  );
  expect(manager.closeSessionAndWait).not.toHaveBeenCalled();
  expect(manager.closeSession).not.toHaveBeenCalled();
  expect(retireDrain).not.toHaveBeenCalled();
  expect(ThreadWebSocketHandler.getState(wsA)).toMatchObject({
    threadId: null,
    activatedThreadId: null,
    workspaceRetired: true,
  });
});

test('workspace retirement awaits provider termination before completing the bind handoff', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const wire = { pid: 46, killed: false };
  let finishProviderStop;
  const providerStopped = new Promise(resolve => { finishProviderStop = resolve; });
  manager.getSession = jest.fn(() => ({ threadId: 'thread-active', ws, wireProcess: wire }));
  manager.closeSessionAndWait = jest.fn(() => providerStopped.then(() => true));
  getWireForThread.mockReturnValue(wire);
  unregisterWireForClient.mockReturnValue(true);
  setState(ws, manager, 'thread-passive', 'thread-active');

  let retired = false;
  const retiring = ThreadWebSocketHandler.retireWorkspaceBinding(ws, { wire })
    .then((value) => {
      retired = true;
      return value;
    });
  await new Promise(resolve => setImmediate(resolve));

  expect(manager.closeSessionAndWait).toHaveBeenCalledWith('thread-active');
  expect(retired).toBe(false);

  finishProviderStop();
  await expect(retiring).resolves.toBe(true);
  expect(retired).toBe(true);
});

test('workspace retirement awaits the exact admitted drain after requesting its stop', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const wire = { pid: 47, killed: false };
  const runtimeKey = {
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-workspace-retirement',
    scope: 'project',
    threadId: 'thread-active',
  };
  let finishDrain;
  const drainCompletion = new Promise(resolve => { finishDrain = resolve; });
  const retire = jest.fn(async () => true);
  threadRuntimeManager.markInFlight(runtimeKey);
  threadRuntimeManager.claimActiveDrain(runtimeKey, {
    drainId: 'drain-workspace-retirement',
  }, {
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-workspace-retirement',
  });
  threadRuntimeManager.bindTurnToDrain(
    runtimeKey, 'drain-workspace-retirement', 'turn-workspace-retirement',
  );
  threadRuntimeManager.bindActiveDrainLifecycle(runtimeKey, 'drain-workspace-retirement', {
    completion: drainCompletion,
    retire,
  });
  manager.getSession = jest.fn(() => ({
    threadId: 'thread-active', ws, wireProcess: wire,
    state: 'active', workspaceEpoch: 'epoch-workspace-retirement',
  }));
  manager.closeSessionAndWait = jest.fn(async () => true);
  getWireForThread.mockReturnValue(wire);
  setState(ws, manager, 'thread-active', 'thread-active', 'epoch-workspace-retirement');
  let finishEffect;
  const unsubscribe = onBusEvent('test:held-effect', async () => {
    await new Promise(resolve => { finishEffect = resolve; });
  });
  emitBusEvent('test:held-effect', {
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-workspace-retirement',
    threadId: 'thread-active',
    turnId: 'turn-workspace-retirement',
  });

  let retirementResolved = false;
  const retiring = ThreadWebSocketHandler.retireWorkspaceBinding(ws, { wire })
    .then(() => { retirementResolved = true; });
  await new Promise(resolve => setImmediate(resolve));

  expect(retire).toHaveBeenCalledTimes(1);
  expect(manager.closeSessionAndWait).not.toHaveBeenCalled();
  expect(retirementResolved).toBe(false);

  finishDrain();
  await new Promise(resolve => setImmediate(resolve));
  expect(manager.closeSessionAndWait).not.toHaveBeenCalled();
  finishEffect();
  await retiring;
  unsubscribe();
  expect(manager.closeSessionAndWait).toHaveBeenCalledWith('thread-active');
  expect(retirementResolved).toBe(true);
});

test('workspace bind retirement cancels the delayed assistant-resume list', async () => {
  jest.useFakeTimers();
  const ws = makeWs();
  const manager = makeManager();
  setState(ws, manager, null, null);

  try {
    await ThreadWebSocketHandler.handleThreadOpenAssistant(ws, { threadId: 'thread-a' });
    expect(ws.send.mock.calls.map(([frame]) => JSON.parse(frame).type)).toContain('thread:opened');
    manager.listThreads.mockClear();

    await ThreadWebSocketHandler.retireWorkspaceBinding(ws);
    await jest.advanceTimersByTimeAsync(3_100);

    expect(manager.listThreads).not.toHaveBeenCalled();
    expect(ws.send.mock.calls.map(([frame]) => JSON.parse(frame).type)).not.toContain('thread:list');
  } finally {
    jest.useRealTimers();
  }
});

test('READY warm transfers active A to B before disconnect cleanup', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const session = { currentWorkspaceId: 'workspace-lifecycle', projectRoot: manager.projectRoot, wire: null };
  const wire = { pid: 43, killed: false };
  setState(ws, manager, 'thread-b', 'thread-a');
  threadRuntimeManager.markReady({
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: null,
    scope: 'project',
    threadId: 'thread-b',
  });
  getWireForThread.mockReturnValue(wire);

  await threadRuntimeController.warmRuntimeForIntent({
    ws,
    session,
    clientMsg: { type: 'thread:warm', threadId: 'thread-b' },
    wireLifecycle: {},
    projectRoot: manager.projectRoot,
    spawnAndSetupWire: jest.fn(),
  });

  expect(manager.closeSession).toHaveBeenNthCalledWith(1, 'thread-a');
  expect(manager.openSession).toHaveBeenCalledWith('thread-b', wire, ws, { workspaceEpoch: null });
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: 'thread-b',
    activatedThreadId: 'thread-b',
  });
  await ThreadWebSocketHandler.cleanup(ws);
  expect(manager.closeSession).toHaveBeenNthCalledWith(2, 'thread-b');
});

test('READY warm reclaims exact manager ownership after another client previously owned the thread', async () => {
  const ws = makeWs();
  const otherWs = makeWs();
  const manager = makeManager();
  const session = { currentWorkspaceId: 'workspace-lifecycle', projectRoot: manager.projectRoot, wire: null };
  const wire = { pid: 47, killed: false };
  let ownedSession = {
    threadId: 'thread-b',
    wireProcess: wire,
    ws: otherWs,
    state: 'active',
    workspaceEpoch: null,
  };
  manager.getSession = jest.fn(() => ownedSession);
  manager.openSession.mockImplementation(async (threadId, wireProcess, ownerWs, options = {}) => {
    ownedSession = {
      threadId, wireProcess, ws: ownerWs, state: 'active',
      workspaceEpoch: options.workspaceEpoch || null,
    };
  });
  setState(ws, manager, 'thread-b', 'thread-b');
  threadRuntimeManager.markReady({
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: null,
    scope: 'project',
    threadId: 'thread-b',
  });
  getWireForThread.mockReturnValue(wire);

  await threadRuntimeController.warmRuntimeForIntent({
    ws,
    session,
    clientMsg: { type: 'thread:warm', threadId: 'thread-b' },
    wireLifecycle: {},
    projectRoot: manager.projectRoot,
    spawnAndSetupWire: jest.fn(),
  });

  expect(manager.closeSession).not.toHaveBeenCalled();
  expect(manager.openSession).toHaveBeenCalledWith('thread-b', wire, ws, { workspaceEpoch: null });
});

test('cross-client activation race commits only the manager-accepted exact owner', async () => {
  const wsA = makeWs();
  const wsB = makeWs();
  const manager = makeManager();
  const wireA = { pid: 70, killed: false };
  const wireB = { pid: 71, killed: false };
  let ownedSession = null;
  let releaseA;
  let markAStarted;
  const aStarted = new Promise(resolve => { markAStarted = resolve; });
  const aMayFinish = new Promise(resolve => { releaseA = resolve; });
  manager.openSession.mockImplementation(async (threadId, wireProcess, ownerWs) => {
    ownedSession = {
      threadId, wireProcess, ws: ownerWs, state: 'active', workspaceEpoch: null,
    };
    if (ownerWs === wsA) {
      markAStarted();
      await aMayFinish;
    }
  });
  manager.getSession = jest.fn(() => ownedSession);
  setState(wsA, manager, 'thread-b', null);
  setState(wsB, manager, 'thread-b', null);

  const activateA = ThreadWebSocketHandler.activateThreadSession(wsA, 'thread-b', wireA);
  await aStarted;
  await ThreadWebSocketHandler.activateThreadSession(wsB, 'thread-b', wireB);
  releaseA();
  await expect(activateA).rejects.toThrow('Thread activation ownership changed');

  expect(ownedSession).toEqual({
    threadId: 'thread-b', wireProcess: wireB, ws: wsB,
    state: 'active', workspaceEpoch: null,
  });
  expect(manager.closeSession).not.toHaveBeenCalled();
  expect(attachClientToWire).toHaveBeenCalledTimes(1);
  expect(attachClientToWire).toHaveBeenCalledWith(
    'thread-b', wireB, manager.projectRoot, wsB,
    {
      workspaceId: manager.workspaceId, projectRoot: manager.projectRoot,
      workspaceEpoch: null, viewId: null,
    },
  );
  expect(ThreadWebSocketHandler.getState(wsA).activatedThreadId).toBeNull();
  expect(ThreadWebSocketHandler.getState(wsB).activatedThreadId).toBe('thread-b');
});

test('READY prompt transfers active A to B before workspace-switch cleanup', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const nextManager = { workspaceId: 'workspace-next' };
  const session = { currentWorkspaceId: 'workspace-lifecycle', projectRoot: manager.projectRoot, wire: null };
  const wire = {
    pid: 44,
    killed: false,
    _harnessId: 'opencode',
    _provider: 'opencode',
    _usesDirectCanonicalEvents: true,
    async *_sendMessage() {},
  };
  mockGetProjectThreadManager.mockReturnValue(nextManager);
  setState(ws, manager, 'thread-b', 'thread-a');
  threadRuntimeManager.markReady({
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: null,
    scope: 'project',
    threadId: 'thread-b',
  });
  getWireForThread.mockReturnValue(wire);
  jest.spyOn(ThreadWebSocketHandler, 'handleMessageSend').mockResolvedValue(true);

  await threadRuntimeController.acceptPromptThroughRuntime({
    ws,
    session,
    clientMsg: { type: 'prompt', threadId: 'thread-b', user_input: 'hello' },
    wireLifecycle: {},
    projectRoot: manager.projectRoot,
    spawnAndSetupWire: jest.fn(),
    handleCanonicalHarnessEvent: jest.fn(),
  });

  expect(manager.closeSession).toHaveBeenNthCalledWith(1, 'thread-a');
  expect(manager.openSession).toHaveBeenCalledWith('thread-b', wire, ws, { workspaceEpoch: null });
  ThreadWebSocketHandler.setPanel(ws, 'chat', {
    projectRoot: '/tmp/spec00c-next-workspace',
    workspaceId: 'workspace-next',
  });
  await new Promise(resolve => setImmediate(resolve));
  expect(manager.closeSession).toHaveBeenNthCalledWith(2, 'thread-b');
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: null,
    activatedThreadId: null,
    threadManager: nextManager,
  });
});

test('concurrent B/C transfers serialize and disconnect closes the sole final owner', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const wireB = { pid: 51, killed: false };
  const wireC = { pid: 52, killed: false };
  let releaseB;
  const bMayOpen = new Promise(resolve => { releaseB = resolve; });
  let markBStarted;
  const bStarted = new Promise(resolve => { markBStarted = resolve; });
  manager.openSession.mockImplementation(async threadId => {
    if (threadId === 'thread-b') {
      markBStarted();
      await bMayOpen;
    }
    manager._sessions.set(threadId, {
      threadId,
      wireProcess: threadId === 'thread-b' ? wireB : wireC,
      ws,
      state: 'active',
      workspaceEpoch: null,
    });
  });
  setState(ws, manager, 'thread-a', 'thread-a');

  const activateB = ThreadWebSocketHandler.activateThreadSession(ws, 'thread-b', wireB);
  await bStarted;
  const activateC = ThreadWebSocketHandler.activateThreadSession(ws, 'thread-c', wireC);
  await new Promise(resolve => setImmediate(resolve));
  expect(manager.openSession).toHaveBeenCalledTimes(1);

  releaseB();
  await Promise.all([activateB, activateC]);
  expect(manager.closeSession.mock.calls.map(([threadId]) => threadId)).toEqual([
    'thread-a', 'thread-b',
  ]);
  expect(manager.openSession.mock.calls.map(([threadId]) => threadId)).toEqual([
    'thread-b', 'thread-c',
  ]);
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: 'thread-c', activatedThreadId: 'thread-c',
  });

  await ThreadWebSocketHandler.cleanup(ws);
  expect(manager.closeSession).toHaveBeenLastCalledWith('thread-c');
});

test('workspace switch during activation rolls back the stale opened session', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const nextManager = { workspaceId: 'workspace-next', projectRoot: '/tmp/spec00c-next-workspace' };
  const session = {
    currentWorkspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-a',
  };
  let releaseOpen;
  const mayOpen = new Promise(resolve => { releaseOpen = resolve; });
  let markOpenStarted;
  const openStarted = new Promise(resolve => { markOpenStarted = resolve; });
  manager.openSession.mockImplementation(async (threadId, wireProcess, ownerWs, options = {}) => {
    markOpenStarted();
    await mayOpen;
    manager._sessions.set(threadId, {
      threadId, wireProcess, ws: ownerWs, state: 'active',
      workspaceEpoch: options.workspaceEpoch || null,
    });
  });
  mockGetProjectThreadManager.mockReturnValue(nextManager);
  setState(ws, manager, 'thread-a', 'thread-a', session.workspaceEpoch);

  const activation = ThreadWebSocketHandler.activateThreadSession(ws, 'thread-b', { pid: 53 }, {
    session,
    projectRoot: manager.projectRoot,
    workspaceId: manager.workspaceId,
    workspaceEpoch: session.workspaceEpoch,
  });
  await openStarted;
  session.currentWorkspaceId = nextManager.workspaceId;
  session.projectRoot = nextManager.projectRoot;
  session.workspaceEpoch = 'epoch-b';
  ThreadWebSocketHandler.setPanel(ws, 'chat', {
    projectRoot: nextManager.projectRoot,
    workspaceId: nextManager.workspaceId,
  });
  releaseOpen();

  await expect(activation).rejects.toThrow('Workspace changed during thread activation');
  await new Promise(resolve => setImmediate(resolve));
  expect(manager.openSession).toHaveBeenCalledWith(
    'thread-b', { pid: 53 }, ws, { workspaceEpoch: 'epoch-a' },
  );
  expect(manager.closeSession).toHaveBeenCalledWith('thread-b');
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: null, activatedThreadId: null, threadManager: nextManager,
  });
});

test('failed activation kills and unregisters a new wire before wire_ready', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const oldWire = { pid: 60, killed: false };
  const wire = {
    pid: 61, killed: false, kill: jest.fn(), _waitForTermination: jest.fn(() => Promise.resolve()),
  };
  const session = {
    currentWorkspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-a',
    wire: oldWire,
  };
  manager.openSession.mockRejectedValue(new Error('injected activation persistence failure'));
  spawnThreadWire.mockReturnValue(wire);
  getWireForThread.mockReturnValue(wire);
  setState(ws, manager, 'thread-b', null, session.workspaceEpoch);

  await expect(spawnAndSetupWire({
    ws,
    session,
    projectRoot: manager.projectRoot,
    threadId: 'thread-b',
    wireLifecycle: {
      awaitHarnessReady: jest.fn(async () => {}),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
  })).rejects.toThrow('injected activation persistence failure');

  expect(wire.kill).toHaveBeenCalledWith('SIGTERM');
  expect(unregisterWire).toHaveBeenCalledWith('thread-b', {
    workspaceId: manager.workspaceId, projectRoot: manager.projectRoot,
    workspaceEpoch: session.workspaceEpoch, viewId: null,
  }, wire);
  expect(session.wire).toBe(oldWire);
  expect(ThreadWebSocketHandler.getState(ws).activatedThreadId).toBeNull();
  expect(ws.send).not.toHaveBeenCalledWith(expect.stringContaining('wire_ready'));
});

test('wire_ready delivery failure rolls back the exact accepted manager session and provider', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const wire = {
    pid: 62, killed: false, kill: jest.fn(), _waitForTermination: jest.fn(() => Promise.resolve()),
  };
  const session = {
    currentWorkspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-a',
    wire: null,
  };
  let ownedSession = null;
  manager.openSession.mockImplementation(async (threadId, wireProcess, ownerWs, options = {}) => {
    ownedSession = {
      threadId, wireProcess, ws: ownerWs, state: 'active',
      workspaceEpoch: options.workspaceEpoch || null,
    };
  });
  manager.getSession = jest.fn(() => ownedSession);
  manager.closeSession.mockImplementation(async (threadId) => {
    if (ownedSession?.threadId !== threadId) return false;
    ownedSession = null;
    wire.killed = true;
    wire.kill('SIGTERM');
    return true;
  });
  spawnThreadWire.mockReturnValue(wire);
  getWireForThread.mockReturnValue(wire);
  setState(ws, manager, 'thread-b', null, session.workspaceEpoch);
  ws.send.mockImplementation((frame) => {
    if (JSON.parse(frame).type === 'wire_ready') throw new Error('injected delivery failure');
  });

  await expect(spawnAndSetupWire({
    ws,
    session,
    projectRoot: manager.projectRoot,
    threadId: 'thread-b',
    wireLifecycle: {
      awaitHarnessReady: jest.fn(async () => {}),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
  })).rejects.toThrow('injected delivery failure');

  expect(manager.closeSession).toHaveBeenCalledWith('thread-b');
  expect(ownedSession).toBeNull();
  expect(session.wire).toBeNull();
  expect(session).toMatchObject({
    currentThreadId: null,
    currentScope: null,
    currentViewId: null,
  });
  expect(ThreadWebSocketHandler.getState(ws)).toMatchObject({
    threadId: null,
    activatedThreadId: null,
  });
  expect(threadRuntimeManager.getRuntimeState({
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: session.workspaceEpoch,
    scope: 'project',
    threadId: 'thread-b',
  })).toBe('cold');
  expect(unregisterWire).toHaveBeenCalledWith('thread-b', {
    workspaceId: manager.workspaceId, projectRoot: manager.projectRoot,
    workspaceEpoch: session.workspaceEpoch, viewId: null,
  }, wire);
  expect(wire.kill).toHaveBeenCalledWith('SIGTERM');
});

test('superseded workspace epoch rejects before spawning a provider', async () => {
  const ws = makeWs();
  const manager = makeManager();
  const session = {
    currentWorkspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch: 'epoch-new',
    workspaceBindingState: 'active',
    wire: null,
  };
  setState(ws, manager, 'thread-b', null, session.workspaceEpoch);
  const state = ThreadWebSocketHandler.getState(ws);

  await expect(spawnAndSetupWire({
    ws,
    session,
    projectRoot: manager.projectRoot,
    threadId: 'thread-b',
    expectedBinding: {
      state,
      session,
      projectRoot: manager.projectRoot,
      workspaceId: manager.workspaceId,
      workspaceEpoch: 'epoch-old',
    },
    wireLifecycle: {},
  })).rejects.toThrow('Workspace unavailable for thread activation');

  expect(spawnThreadWire).not.toHaveBeenCalled();
  expect(manager.openSession).not.toHaveBeenCalled();
  expect(ws.send).not.toHaveBeenCalled();
});
