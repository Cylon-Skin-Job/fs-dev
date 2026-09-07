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

function makeHandlers(ws, role) {
  const session = {};
  if (role) Object.defineProperty(session, 'connectionRole', { value: role, enumerable: false });
  return createThreadWsHandlers({
    ws,
    session,
    projectRoot: '/tmp/project',
    wireLifecycle: {
      awaitHarnessReady: jest.fn(),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
  });
}

describe('thread:fork websocket boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  for (const role of ['trusted-shell', 'untrusted']) {
    test(`is unconditionally unavailable to ${role} connections before service effects`, async () => {
      const ws = { send: jest.fn() };
      const handlers = makeHandlers(ws, role);
      await handlers['thread:fork']({
        sourceThreadId: 'source-thread',
        role: 'trusted-shell',
        proof: 'request-proof-canary',
      });

      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: 'error',
        code: 'THREAD_FORK_UNAVAILABLE',
        message: 'Thread fork is unavailable',
      });
      expect(ThreadWebSocketHandler.getState).not.toHaveBeenCalled();
      expect(ThreadWebSocketHandler.sendThreadList).not.toHaveBeenCalled();
      expect(createPendingForkThread).not.toHaveBeenCalled();
    });
  }
});
