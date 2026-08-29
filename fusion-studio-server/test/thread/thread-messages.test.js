'use strict';

const { createMessageHandlers } = require('../../lib/thread/thread-messages');

describe('createMessageHandlers', () => {
  let wsState;
  let ws;
  let mockManager;
  let handlers;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockManager = {
      addMessage: jest.fn(() => Promise.resolve()),
      index: {
        touch: jest.fn(() => Promise.resolve()),
      },
    };

    ws = { send: jest.fn() };

    wsState = new Map();
    wsState.set(ws, {
      threadId: 'thread-A',
      threadManager: mockManager,
    });

    handlers = createMessageHandlers({ wsState });
  });

  describe('handleMessageSend', () => {
    test('records accepted user message activity and acknowledges the send', async () => {
      await expect(handlers.handleMessageSend(ws, { content: 'Hello' })).resolves.toBe(true);

      expect(mockManager.addMessage).toHaveBeenCalledWith('thread-A', {
        role: 'user',
        content: 'Hello',
        hasToolCalls: false,
      });
      expect(mockManager.index.touch).toHaveBeenCalledWith('thread-A');
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'message:sent',
        threadId: 'thread-A',
        scope: 'project',
        content: 'Hello',
      }));
    });

    test('returns false when no thread is active', async () => {
      wsState.set(ws, {
        threadId: null,
        threadManager: mockManager,
      });

      await expect(handlers.handleMessageSend(ws, { content: 'Hello' })).resolves.toBe(false);

      expect(mockManager.addMessage).not.toHaveBeenCalled();
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'error',
        message: 'No active thread',
      }));
    });

    test.each(['addMessage', 'touch'])(
      '%s rejection uses one routed fixed-safe failure frame and ids-only log',
      async (failurePoint) => {
        const canary = `CANARY_SECRET_MESSAGE_PERSISTENCE_${failurePoint}`;
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        if (failurePoint === 'addMessage') {
          mockManager.addMessage.mockRejectedValue(new Error(canary));
        } else {
          mockManager.index.touch.mockRejectedValue(new Error(canary));
        }

        await expect(handlers.handleMessageSend(ws, { content: 'Hello' })).resolves.toBe(false);

        expect(ws.send.mock.calls.map(([raw]) => JSON.parse(raw))).toEqual([{
          type: 'error',
          message: 'Message could not be saved',
          scope: 'project',
          threadId: 'thread-A',
          recoverable: true,
        }]);
        expect(errorSpy.mock.calls).toEqual([[
          '[ThreadWS] Send message failed',
          { threadId: 'thread-A', marker: 'MESSAGE_PERSISTENCE_FAILED' },
        ]]);
        expect(JSON.stringify({ frames: ws.send.mock.calls, logs: errorSpy.mock.calls }))
          .not.toContain(canary);
      }
    );
  });
});
