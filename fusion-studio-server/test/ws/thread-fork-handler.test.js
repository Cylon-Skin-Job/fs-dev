'use strict';

jest.mock('../../lib/thread', () => ({
  ThreadWebSocketHandler: {
    getState: jest.fn(),
    sendThreadList: jest.fn(() => Promise.resolve()),
  },
  threadRuntimeManager: {},
}));

jest.mock('../../lib/harness/compat', () => ({
  spawnThreadWire: jest.fn(),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  registerWire: jest.fn(),
}));

jest.mock('../../lib/thread/thread-fork-service', () => ({
  createPendingForkThread: jest.fn(),
}));

const { ThreadWebSocketHandler } = require('../../lib/thread');
const { createPendingForkThread } = require('../../lib/thread/thread-fork-service');
const { createThreadWsHandlers } = require('../../lib/ws/thread-ws-handlers');

function makeHandlers(ws) {
  return createThreadWsHandlers({
    ws,
    session: {},
    projectRoot: '/tmp/project',
    wireLifecycle: {
      awaitHarnessReady: jest.fn(),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
  });
}

describe('thread:fork websocket handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sends thread:forked and refreshes the thread list after service success', async () => {
    const ws = { send: jest.fn() };
    const manager = { workspaceId: 'workspace-1' };
    ThreadWebSocketHandler.getState.mockReturnValue({
      viewName: 'file-viewer',
      threadManager: manager,
    });
    createPendingForkThread.mockResolvedValue({
      threadId: 'fork-thread',
      thread: {
        name: 'Fork: Original',
        harnessId: 'opencode',
        harnessConfig: {
          pendingFork: {
            sourceThreadId: 'source-thread',
            sourceOpenCodeSessionId: 'ses_source',
          },
        },
      },
      exchanges: [{ exchangeId: 2, seq: 1, user: 'hello' }],
      fork: {
        sourceThreadId: 'source-thread',
        sourceOpenCodeSessionId: 'ses_source',
      },
    });

    const handlers = makeHandlers(ws);
    await handlers['thread:fork']({ sourceThreadId: 'source-thread' });

    expect(createPendingForkThread).toHaveBeenCalledWith({
      manager,
      sourceThreadId: 'source-thread',
      sourceExchangeId: null,
      requestedFrom: 'composer-fork-button',
    });

    const payload = JSON.parse(ws.send.mock.calls[0][0]);
    expect(payload).toMatchObject({
      type: 'thread:forked',
      threadId: 'fork-thread',
      panel: 'file-viewer',
      scope: 'project',
      thread: { name: 'Fork: Original', harnessId: 'opencode' },
      exchanges: [{ exchangeId: 2, seq: 1, user: 'hello' }],
    });
    expect(ThreadWebSocketHandler.sendThreadList).toHaveBeenCalledWith(ws);
  });

  test('sends a recoverable error when the fork service rejects', async () => {
    const ws = { send: jest.fn() };
    const err = new Error('Source thread has no OpenCode session to fork');
    err.code = 'THREAD_FORK_MISSING_SOURCE_SESSION';
    err.recoverable = true;
    ThreadWebSocketHandler.getState.mockReturnValue({
      viewName: 'file-viewer',
      threadManager: { workspaceId: 'workspace-1' },
    });
    createPendingForkThread.mockRejectedValue(err);

    const handlers = makeHandlers(ws);
    await handlers['thread:fork']({ sourceThreadId: 'source-thread' });

    const payload = JSON.parse(ws.send.mock.calls[0][0]);
    expect(payload).toMatchObject({
      type: 'error',
      message: 'Source thread has no OpenCode session to fork',
      code: 'THREAD_FORK_MISSING_SOURCE_SESSION',
      scope: 'project',
      threadId: 'source-thread',
      recoverable: true,
    });
  });
});
