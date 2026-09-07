'use strict';

jest.mock('../../lib/thread', () => ({
  RUNTIME_STATES: {
    COLD: 'cold',
    WARMING: 'warming',
    READY: 'ready',
    IN_FLIGHT: 'in_flight',
    STOPPING: 'stopping',
  },
  ThreadWebSocketHandler: {
    handleThreadOpen: jest.fn(() => Promise.resolve()),
    handleThreadOpenAssistant: jest.fn((ws, message) => Promise.resolve(
      message.threadId || 'thread-created',
    )),
    handleThreadRename: jest.fn(() => Promise.resolve()),
    handleThreadDelete: jest.fn(() => Promise.resolve()),
    handleThreadCopyLink: jest.fn(() => Promise.resolve()),
    handleThreadTouch: jest.fn(() => Promise.resolve()),
    handleThreadSearch: jest.fn(() => Promise.resolve()),
    activateThreadSession: jest.fn(() => Promise.resolve()),
    isActivationBindingCurrent: jest.fn(() => true),
    getState: jest.fn(() => ({
      threadId: 'thread-created',
      threadManager: { workspaceId: 'workspace-1', projectRoot: '/repo', openSession: jest.fn() },
    })),
    sendThreadList: jest.fn(() => Promise.resolve()),
  },
  threadRuntimeManager: { markReady: jest.fn(), getRuntimeState: jest.fn(() => 'cold') },
  threadRuntimeController: { warmRuntimeForIntent: jest.fn(() => Promise.resolve()) },
}));

jest.mock('../../lib/harness/compat', () => ({
  spawnThreadWire: jest.fn(() => ({ pid: 42 })),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  getWireForThread: jest.fn(),
  registerWire: jest.fn(),
  unregisterWire: jest.fn(),
}));

const { ThreadWebSocketHandler, threadRuntimeManager } = require('../../lib/thread');
const { spawnThreadWire } = require('../../lib/harness/compat');
const { createThreadWsHandlers } = require('../../lib/ws/thread-ws-handlers');
const { beginWorkspaceTransition } = require('../../lib/ws/workspace-operation-lease');

function make(role, sessionPatch = {}) {
  const ws = { send: jest.fn() };
  const session = {
    currentWorkspaceId: 'workspace-1',
    workspaceEpoch: 'workspace-epoch-1',
    workspaceBindingState: 'active',
    projectRoot: '/repo',
    ...sessionPatch,
  };
  if (role) Object.defineProperty(session, 'connectionRole', { value: role, enumerable: false });
  const lifecycle = {
    awaitHarnessReady: jest.fn(() => Promise.resolve()),
    initializeWire: jest.fn(),
    setupWireHandlers: jest.fn(),
  };
  const handlers = createThreadWsHandlers({ ws, session, wireLifecycle: lifecycle, projectRoot: '/repo' });
  return { handlers, lifecycle, session, ws };
}

describe('privileged thread route gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ThreadWebSocketHandler.getState.mockReturnValue({
      threadId: 'thread-created',
      threadManager: { workspaceId: 'workspace-1', projectRoot: '/repo', openSession: jest.fn() },
    });
    ThreadWebSocketHandler.isActivationBindingCurrent.mockReturnValue(true);
    threadRuntimeManager.getRuntimeState.mockReturnValue('cold');
  });

  for (const type of ['thread:open-assistant', 'thread:rename', 'thread:delete', 'thread:touch', 'thread:warm']) {
    test(`${type} denies untrusted/request-asserted authority before all effects`, async () => {
      const existingWire = { kill: jest.fn() };
      const { handlers, session, ws } = make('untrusted', { wire: existingWire });
      await handlers[type]({
        type,
        threadId: 'thread-existing',
        role: 'trusted-shell',
        trusted: true,
        permission: 'all',
        proof: 'forged-proof',
      });

      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: 'error', code: 'THREAD_MUTATION_DENIED', message: 'Thread mutation denied',
      });
      expect(session.wire).toBe(existingWire);
      expect(existingWire.kill).not.toHaveBeenCalled();
      expect(ThreadWebSocketHandler.getState).not.toHaveBeenCalled();
      expect(ThreadWebSocketHandler.handleThreadOpenAssistant).not.toHaveBeenCalled();
      expect(ThreadWebSocketHandler.handleThreadRename).not.toHaveBeenCalled();
      expect(ThreadWebSocketHandler.handleThreadDelete).not.toHaveBeenCalled();
      expect(ThreadWebSocketHandler.handleThreadTouch).not.toHaveBeenCalled();
      expect(spawnThreadWire).not.toHaveBeenCalled();
    });
  }

  test('an enumerable role copied into server state cannot authorize', async () => {
    const { handlers, ws } = make(null, { connectionRole: 'trusted-shell' });
    await handlers['thread:rename']({ threadId: 'thread-1', name: 'Nope' });
    expect(JSON.parse(ws.send.mock.calls[0][0]).code).toBe('THREAD_MUTATION_DENIED');
    expect(ThreadWebSocketHandler.handleThreadRename).not.toHaveBeenCalled();
  });

  test('trusted New Chat crosses the route and launches its provider', async () => {
    const { handlers, lifecycle, ws } = make('trusted-shell');
    await handlers['thread:open-assistant']({ type: 'thread:open-assistant' });
    expect(ThreadWebSocketHandler.handleThreadOpenAssistant).toHaveBeenCalledWith(ws, {
      type: 'thread:open-assistant',
    });
    expect(spawnThreadWire).toHaveBeenCalledWith('thread-created', '/repo', {
      workspaceId: 'workspace-1',
      projectRoot: '/repo',
      workspaceEpoch: 'workspace-epoch-1',
      viewId: null,
    });
    expect(lifecycle.awaitHarnessReady).toHaveBeenCalled();
    expect(lifecycle.initializeWire).toHaveBeenCalled();
  });

  test('trusted New Chat preserves an explicit nullable variant at the public boundary', async () => {
    const { handlers, ws } = make('trusted-shell');
    await handlers['thread:open-assistant']({
      type: 'thread:open-assistant',
      harnessId: 'opencode',
      harnessConfig: { model: 'provider/model', variant: null },
    });
    expect(ThreadWebSocketHandler.handleThreadOpenAssistant).toHaveBeenCalledWith(ws, {
      type: 'thread:open-assistant',
      harnessId: 'opencode',
      harnessConfig: { model: 'provider/model', variant: null },
    });
    expect(spawnThreadWire).toHaveBeenCalledWith('thread-created', '/repo', {
      workspaceId: 'workspace-1',
      projectRoot: '/repo',
      workspaceEpoch: 'workspace-epoch-1',
      viewId: null,
    });
  });

  test('trusted rejects non-portable creation configuration before owners or provider', async () => {
    const { handlers, ws } = make('trusted-shell');
    await handlers['thread:open-assistant']({
      type: 'thread:open-assistant',
      harnessConfig: { pendingFork: { sourceOpenCodeSessionId: 'provider-session' } },
    });
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'error', code: 'THREAD_MUTATION_DENIED', message: 'Thread mutation denied',
    });
    expect(ThreadWebSocketHandler.handleThreadOpenAssistant).not.toHaveBeenCalled();
    expect(spawnThreadWire).not.toHaveBeenCalled();
  });

  test('trusted exact-session resume retains the existing route and provider launch', async () => {
    const { handlers, ws } = make('trusted-shell');
    const request = { type: 'thread:open-assistant', threadId: 'thread-existing' };
    await handlers['thread:open-assistant'](request);
    expect(ThreadWebSocketHandler.handleThreadOpenAssistant).toHaveBeenCalledWith(ws, request);
    expect(spawnThreadWire).toHaveBeenCalledTimes(1);
  });

  test('trusted Rename and Delete cross the existing owning handlers', async () => {
    const { handlers, ws } = make('trusted-shell');
    const rename = { threadId: 'thread-1', name: 'Renamed' };
    const remove = { threadId: 'thread-1' };
    await handlers['thread:rename'](rename);
    await handlers['thread:delete'](remove);
    expect(ThreadWebSocketHandler.handleThreadRename).toHaveBeenCalledWith(ws, rename);
    expect(ThreadWebSocketHandler.handleThreadDelete).toHaveBeenCalledWith(ws, remove);
  });

  test('trusted Touch and Warm cross their owners', async () => {
    const { threadRuntimeController } = require('../../lib/thread');
    const { handlers, ws, session } = make('trusted-shell');
    await handlers['thread:touch']({ type: 'thread:touch', threadId: 'thread-1' });
    await handlers['thread:warm']({ type: 'thread:warm', threadId: 'thread-1' });
    expect(ThreadWebSocketHandler.handleThreadTouch).toHaveBeenCalledWith(ws, {
      type: 'thread:touch', threadId: 'thread-1',
    });
    expect(threadRuntimeController.warmRuntimeForIntent).toHaveBeenCalledWith(expect.objectContaining({
      ws, session, clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
    }));
  });

  test.each([
    ['thread:rename', 'handleThreadRename', { type: 'thread:rename', threadId: 'thread-1', name: 'Nope' }],
    ['thread:delete', 'handleThreadDelete', { type: 'thread:delete', threadId: 'thread-1' }],
    ['thread:touch', 'handleThreadTouch', { type: 'thread:touch', threadId: 'thread-1' }],
  ])('%s queued behind workspace binding denies before its durable owner', async (type, owner, message) => {
    const { handlers, session, ws } = make('trusted-shell', {
      workspaceBindingState: 'active',
      workspaceEpoch: 'epoch-a',
    });
    const binding = beginWorkspaceTransition(ws, () => {
      session.workspaceBindingState = 'binding';
      session.currentWorkspaceId = null;
      session.workspaceEpoch = null;
      session.projectRoot = null;
    });
    ThreadWebSocketHandler.isActivationBindingCurrent.mockReturnValueOnce(false);

    await Promise.all([binding, handlers[type](message)]);

    expect(ThreadWebSocketHandler[owner]).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'error', code: 'THREAD_MUTATION_DENIED', message: 'Thread mutation denied',
    });
  });

  test.each([
    ['new thread', { type: 'thread:open-assistant' }],
    ['exact resume', { type: 'thread:open-assistant', threadId: 'thread-existing' }],
  ])('%s admission already in progress completes before workspace binding begins', async (_label, message) => {
    const { handlers, session, ws } = make('trusted-shell', {
      workspaceBindingState: 'active',
      workspaceEpoch: 'epoch-a',
    });
    let releaseOwner;
    const ownerMayFinish = new Promise(resolve => { releaseOwner = resolve; });
    let markOwnerStarted;
    const ownerStarted = new Promise(resolve => { markOwnerStarted = resolve; });
    ThreadWebSocketHandler.handleThreadOpenAssistant.mockImplementationOnce(async (_ws, request) => {
      markOwnerStarted();
      await ownerMayFinish;
      return request.threadId || 'thread-created';
    });

    const admission = handlers['thread:open-assistant'](message);
    await ownerStarted;
    const binding = beginWorkspaceTransition(ws, () => {
      expect(spawnThreadWire).toHaveBeenCalledTimes(1);
      session.workspaceBindingState = 'binding';
      session.currentWorkspaceId = null;
      session.workspaceEpoch = null;
      session.projectRoot = null;
    });
    await Promise.resolve();
    expect(session.workspaceBindingState).toBe('active');

    releaseOwner();
    await admission;
    expect(spawnThreadWire).toHaveBeenCalledTimes(1);
    await binding;
    expect(session.workspaceBindingState).toBe('binding');
    expect(ws.send).not.toHaveBeenCalledWith(expect.stringContaining('THREAD_MUTATION_DENIED'));
  });

  test('post-switch Open Assistant and Warm use the current bound workspace root', async () => {
    const { threadRuntimeController } = require('../../lib/thread');
    const ws = { send: jest.fn() };
    const session = {
      currentWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
      workspaceBindingState: 'active', projectRoot: '/repo-a',
    };
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
    const state = {
      threadId: null,
      threadManager: { workspaceId: 'workspace-a', projectRoot: '/repo-a' },
    };
    ThreadWebSocketHandler.getState.mockImplementation(() => state);
    const handlers = createThreadWsHandlers({
      ws,
      session,
      projectRoot: '/repo-a',
      wireLifecycle: {
        awaitHarnessReady: jest.fn(async () => {}),
        initializeWire: jest.fn(),
        setupWireHandlers: jest.fn(),
      },
    });

    session.currentWorkspaceId = 'workspace-b';
    session.workspaceEpoch = 'epoch-b';
    session.projectRoot = '/repo-b';
    state.threadManager = { workspaceId: 'workspace-b', projectRoot: '/repo-b' };
    await handlers['thread:warm']({ type: 'thread:warm', threadId: 'thread-b' });
    expect(threadRuntimeController.warmRuntimeForIntent).toHaveBeenCalledWith(expect.objectContaining({
      projectRoot: '/repo-b',
    }));

    await handlers['thread:open-assistant']({
      type: 'thread:open-assistant', threadId: 'thread-b',
    });
    expect(spawnThreadWire).toHaveBeenLastCalledWith('thread-b', '/repo-b', {
      workspaceId: 'workspace-b', projectRoot: '/repo-b', workspaceEpoch: 'epoch-b', viewId: null,
    });
  });

  test('stale manager binding denies Open Assistant and Warm before owners or provider', async () => {
    const { threadRuntimeController } = require('../../lib/thread');
    const ws = { send: jest.fn() };
    const session = { currentWorkspaceId: 'workspace-b', projectRoot: '/repo-b' };
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
    ThreadWebSocketHandler.getState.mockReturnValue({
      threadId: null,
      threadManager: { workspaceId: 'workspace-a', projectRoot: '/repo-a' },
    });
    const handlers = createThreadWsHandlers({
      ws,
      session,
      projectRoot: '/repo-a',
      wireLifecycle: {},
    });

    await handlers['thread:warm']({ type: 'thread:warm', threadId: 'thread-b' });
    await handlers['thread:open-assistant']({
      type: 'thread:open-assistant', threadId: 'thread-b',
    });
    expect(threadRuntimeController.warmRuntimeForIntent).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleThreadOpenAssistant).not.toHaveBeenCalled();
    expect(spawnThreadWire).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledTimes(2);
    for (const [raw] of ws.send.mock.calls) {
      expect(JSON.parse(raw).code).toBe('THREAD_MUTATION_DENIED');
    }
  });

  test('an in-progress workspace bind cannot fall back to the socket construction root', async () => {
    const ws = { send: jest.fn() };
    const session = {
      currentWorkspaceId: null,
      projectRoot: null,
      workspaceBindingState: 'binding',
    };
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
    ThreadWebSocketHandler.getState.mockReturnValue({
      threadId: null,
      threadManager: { workspaceId: 'workspace-a', projectRoot: '/repo-a' },
    });
    const handlers = createThreadWsHandlers({
      ws,
      session,
      projectRoot: '/repo-a',
      wireLifecycle: {},
    });

    await handlers['thread:warm']({ type: 'thread:warm', threadId: 'thread-a' });
    await handlers['thread:open-assistant']({ type: 'thread:open-assistant', threadId: 'thread-a' });
    expect(ThreadWebSocketHandler.handleThreadOpenAssistant).not.toHaveBeenCalled();
    expect(spawnThreadWire).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledTimes(2);
  });

  test('standalone untrusted read-only thread routes remain available', async () => {
    const { handlers, ws } = make('untrusted');
    await handlers['thread:open']({ threadId: 'thread-1' });
    await handlers['thread:copyLink']({ threadId: 'thread-1' });
    await handlers['thread:search']({ query: 'term' });
    await handlers['thread:list']();
    expect(ThreadWebSocketHandler.handleThreadOpen).toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleThreadCopyLink).toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleThreadSearch).toHaveBeenCalled();
    expect(ThreadWebSocketHandler.sendThreadList).toHaveBeenCalled();
    expect(ws.send).not.toHaveBeenCalled();
  });

  test('search rejects requester-selected foreign/all-workspace scope before lookup', async () => {
    const { handlers, ws } = make('untrusted');

    await handlers['thread:search']({ query: 'secret', workspaceId: 'workspace-b' });
    await handlers['thread:search']({ query: 'secret', workspaceId: null });

    expect(ThreadWebSocketHandler.handleThreadSearch).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledTimes(2);
    for (const [raw] of ws.send.mock.calls) {
      expect(JSON.parse(raw)).toEqual({ type: 'error', message: 'No active workspace' });
    }

    ws.send.mockClear();
    await handlers['thread:search']({ query: 'current', workspaceId: 'workspace-1' });
    expect(ThreadWebSocketHandler.handleThreadSearch).toHaveBeenCalledWith(ws, {
      query: 'current',
      workspaceId: 'workspace-1',
    });
    expect(ws.send).not.toHaveBeenCalled();
  });

  test('post-switch stale manager cannot serve passive current-workspace reads', async () => {
    const { handlers, session, ws } = make('untrusted', {
      currentWorkspaceId: 'workspace-b',
      workspaceEpoch: 'epoch-b',
      projectRoot: '/repo-b',
    });
    const state = {
      threadId: null,
      threadManager: { workspaceId: 'workspace-a', projectRoot: '/repo-a' },
    };
    ThreadWebSocketHandler.getState.mockReturnValue(state);

    await handlers['thread:open']({ type: 'thread:open', threadId: 'thread-a' });
    await handlers['thread:copyLink']({ type: 'thread:copyLink', threadId: 'thread-a' });
    await handlers['thread:list']({ type: 'thread:list' });
    await handlers['thread:search']({ type: 'thread:search', query: 'secret' });

    expect(ThreadWebSocketHandler.handleThreadOpen).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleThreadCopyLink).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.sendThreadList).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleThreadSearch).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledTimes(4);
    for (const [raw] of ws.send.mock.calls) {
      expect(JSON.parse(raw)).toEqual({ type: 'error', message: 'No active workspace' });
    }

    ws.send.mockClear();
    state.threadManager = { workspaceId: 'workspace-b', projectRoot: '/repo-b' };
    await handlers['thread:open']({ type: 'thread:open', threadId: 'thread-b' });
    await handlers['thread:copyLink']({ type: 'thread:copyLink', threadId: 'thread-b' });
    await handlers['thread:list']({ type: 'thread:list' });
    await handlers['thread:search']({ type: 'thread:search', query: 'current' });

    expect(ThreadWebSocketHandler.handleThreadOpen).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.handleThreadCopyLink).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.sendThreadList).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.handleThreadSearch).toHaveBeenCalledTimes(1);
    expect(session.workspaceBindingState).toBe('active');
  });
});
