'use strict';

const { createCrudHandlers } = require('../../lib/thread/thread-crud');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');

function makeManager() {
  return {
    workspaceId: 'workspace-1',
    getThread: jest.fn(() => Promise.resolve({ entry: { name: 'Thread 1' } })),
    getHistory: jest.fn(() => Promise.resolve({ messages: [] })),
    getRichHistory: jest.fn(() => Promise.resolve({ exchanges: [] })),
    index: {
      markResumed: jest.fn(() => Promise.resolve()),
      touch: jest.fn(() => Promise.resolve()),
    },
  };
}

function makeHandlers(manager) {
  const ws = { send: jest.fn() };
  const wsState = new Map([[ws, {
    viewName: 'view-1',
    panelId: 'view-1',
    threadId: null,
    threadManager: manager,
  }]]);
  const pendingReorderTimers = new Map();
  const handlers = createCrudHandlers({
    wsState,
    sendThreadList: jest.fn(() => Promise.resolve()),
    closeThread: jest.fn(() => Promise.resolve()),
    pendingReorderTimers,
    REORDER_DELAY_MS: 10,
  });
  return { ws, handlers, pendingReorderTimers };
}

function clearPendingTimers(pendingReorderTimers) {
  for (const timer of pendingReorderTimers.values()) {
    clearTimeout(timer);
  }
  pendingReorderTimers.clear();
}

describe('thread CRUD live turn snapshots', () => {
  beforeEach(() => {
    threadRuntimeManager.runtimes.clear();
  });

  test('thread:opened includes liveTurn when a snapshot exists', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);
    const key = {
      workspaceId: 'workspace-1',
      scope: 'project',
      threadId: 'thread-1',
    };
    threadRuntimeManager.beginLiveTurn(key, { turnId: 'turn-1', userInput: 'hello' });
    threadRuntimeManager.appendLiveContent(key, 'hi there');

    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened).toMatchObject({
      type: 'thread:opened',
      threadId: 'thread-1',
      scope: 'project',
      liveTurn: {
        workspaceId: 'workspace-1',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        userInput: 'hello',
        status: 'in_flight',
        fullText: 'hi there',
      },
    });
    clearPendingTimers(pendingReorderTimers);
  });

  test('thread:opened sends null liveTurn for cold/no-live threads', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);

    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened.type).toBe('thread:opened');
    expect(opened.liveTurn).toBeNull();
    clearPendingTimers(pendingReorderTimers);
  });
});
