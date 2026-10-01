'use strict';

jest.mock('uuid', () => ({ v4: jest.fn(() => '00000000-0000-4000-8000-000000000001') }));
const mockManager = { workspaceId: 'workspace-a', projectRoot: '/tmp/panel-rebind',
  getThread: jest.fn(async () => ({ entry: { harnessId: 'opencode' } })),
  getHistory: jest.fn(async () => ({ messages: [{ content: 'preserved history' }] })),
  getRichHistory: jest.fn(async () => ({ exchanges: [] })),
};
jest.mock('../../lib/thread/thread-manager-registry', () => ({
  getProjectThreadManager: jest.fn(() => mockManager),
  _getProjectThreadManagers: jest.fn(() => new Map()),
}));
const { ThreadWebSocketHandler } = require('../../lib/thread');
const { createThreadWsHandlers } = require('../../lib/ws/thread-ws-handlers');
const { runWorkspaceOperation } = require('../../lib/ws/workspace-operation-lease');

afterEach(async () => {
  for (const ws of ThreadWebSocketHandler._getWsState().keys()) await ThreadWebSocketHandler.cleanup(ws);
  jest.clearAllMocks();
});

function setup() {
  const ws = { send: jest.fn(), readyState: 1 };
  const session = { projectRoot: mockManager.projectRoot, currentWorkspaceId: mockManager.workspaceId,
    workspaceEpoch: 'epoch-a', workspaceBindingState: 'active' };
  const config = { projectRoot: session.projectRoot, workspaceId: session.currentWorkspaceId,
    workspaceEpoch: session.workspaceEpoch };
  ThreadWebSocketHandler.setPanel(ws, 'capture-viewer', config);
  return { ws, session, config, handlers: createThreadWsHandlers({ ws, session,
    projectRoot: session.projectRoot, wireLifecycle: {} }) };
}

test('queued passive history survives an identical active set_panel without warming a provider', async () => {
  const { ws, config, handlers } = setup();
  const initial = ThreadWebSocketHandler.getState(ws);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const rebind = runWorkspaceOperation(ws, () => true, async () => {
    await held;
    ThreadWebSocketHandler.setPanel(ws, 'capture-viewer', config);
  });
  const reading = handlers['thread:open']({ type: 'thread:open', threadId: 'historical-thread',
    requestId: 'queued-history', historyOnly: true });
  release();
  await Promise.all([rebind, reading]);
  expect(ThreadWebSocketHandler.getState(ws)).toBe(initial);
  expect(ws.send.mock.calls.map(([frame]) => JSON.parse(frame))).toEqual([
    expect.objectContaining({ type: 'thread:opened', requestId: 'queued-history',
      threadId: 'historical-thread', history: [{ content: 'preserved history' }] }),
  ]);
  expect(initial.activatedThreadId).toBeNull();
});

test.each(['panel', 'root', 'workspace', 'epoch', 'retired', 'missing-epoch'])(
  '%s change still replaces the binding and rejects a previously queued read', async change => {
    const { ws, session, config, handlers } = setup();
    const initial = ThreadWebSocketHandler.getState(ws);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const rebind = runWorkspaceOperation(ws, () => true, async () => {
      await held;
      if (change === 'root') config.projectRoot = '/tmp/other-root';
      if (change === 'workspace') config.workspaceId = 'workspace-b';
      if (change === 'epoch') { config.workspaceEpoch = 'epoch-b'; session.workspaceEpoch = 'epoch-b'; }
      if (change === 'retired') initial.workspaceRetired = true;
      if (change === 'missing-epoch') delete config.workspaceEpoch;
      ThreadWebSocketHandler.setPanel(ws, change === 'panel' ? 'wiki' : 'capture-viewer', config);
    });
    const reading = handlers['thread:open']({ type: 'thread:open', threadId: 'historical-thread', historyOnly: true });
    release();
    await Promise.all([rebind, reading]);
    expect(ThreadWebSocketHandler.getState(ws)).not.toBe(initial);
    expect(mockManager.getHistory).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'error', message: 'No active workspace' }));
  },
);
