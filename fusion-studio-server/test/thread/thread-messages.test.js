'use strict';

const { createMessageHandlers } = require('../../lib/thread/thread-messages');

describe('createMessageHandlers', () => {
  let wsState;
  let ws;
  let mockManager;
  let handlers;

  beforeEach(() => {
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
  });
});
