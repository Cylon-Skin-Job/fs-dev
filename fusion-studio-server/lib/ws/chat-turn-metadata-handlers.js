'use strict';

const { updateExchangeMetadata } = require('../chat-metadata/exchange-metadata-update-service');

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @returns {Record<string, (msg: object) => Promise<void>>}
 */
function createChatTurnMetadataHandlers({ ws }) {
  return {
    async 'chat-turn:metadata:update'(clientMsg) {
      try {
        const result = await updateExchangeMetadata({
          threadId: clientMsg.threadId,
          exchangeId: clientMsg.exchangeId,
          patch: clientMsg.patch,
        });

        ws.send(JSON.stringify({
          type: 'chat-turn:metadata:updated',
          threadId: result.threadId,
          exchangeId: result.exchangeId,
          metadata: result.metadata,
        }));
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'chat-turn:metadata:error',
          threadId: clientMsg.threadId || null,
          exchangeId: clientMsg.exchangeId ?? null,
          message: err.message || 'Metadata update failed',
        }));
      }
    },
  };
}

module.exports = { createChatTurnMetadataHandlers };
