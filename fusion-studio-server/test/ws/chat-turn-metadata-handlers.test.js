'use strict';

jest.mock('../../lib/chat-metadata/exchange-metadata-update-service', () => ({
  updateExchangeMetadata: jest.fn(),
}));

const { updateExchangeMetadata } = require('../../lib/chat-metadata/exchange-metadata-update-service');
const { createChatTurnMetadataHandlers } = require('../../lib/ws/chat-turn-metadata-handlers');

function sentJson(ws, index = 0) {
  return JSON.parse(ws.send.mock.calls[index][0]);
}

describe('createChatTurnMetadataHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('chat-turn:metadata:update sends updated metadata response', async () => {
    const ws = { send: jest.fn() };
    updateExchangeMetadata.mockResolvedValue({
      threadId: 'thread-1',
      exchangeId: 42,
      metadata: { bookmark: { type: 'flag', createdAt: 1, updatedAt: 1 } },
    });

    const handlers = createChatTurnMetadataHandlers({ ws });
    await handlers['chat-turn:metadata:update']({
      type: 'chat-turn:metadata:update',
      threadId: 'thread-1',
      exchangeId: 42,
      patch: { bookmark: { type: 'flag' } },
    });

    expect(updateExchangeMetadata).toHaveBeenCalledWith({
      threadId: 'thread-1',
      exchangeId: 42,
      patch: { bookmark: { type: 'flag' } },
    });
    expect(sentJson(ws)).toEqual({
      type: 'chat-turn:metadata:updated',
      threadId: 'thread-1',
      exchangeId: 42,
      metadata: { bookmark: { type: 'flag', createdAt: 1, updatedAt: 1 } },
    });
  });

  test('chat-turn:metadata:update sends error response on failure', async () => {
    const ws = { send: jest.fn() };
    updateExchangeMetadata.mockRejectedValue(new Error('Exchange not found'));

    const handlers = createChatTurnMetadataHandlers({ ws });
    await handlers['chat-turn:metadata:update']({
      type: 'chat-turn:metadata:update',
      threadId: 'thread-1',
      exchangeId: 42,
      patch: { note: { body: 'private' } },
    });

    expect(sentJson(ws)).toEqual({
      type: 'chat-turn:metadata:error',
      threadId: 'thread-1',
      exchangeId: 42,
      message: 'Exchange not found',
    });
  });
});
