'use strict';

const { updateExchangeMetadata } = require('../chat-metadata/exchange-metadata-update-service');
const ThreadWebSocketHandler = require('../thread/ThreadWebSocketHandler');
const { denyThreadMutation } = require('./privileged-thread-guard');
const {
  isWorkspaceOperationLeaseError,
  runWorkspaceOperation,
} = require('./workspace-operation-lease');

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 * @returns {Record<string, (msg: object) => Promise<void>>}
 */
function createChatTurnMetadataHandlers({ ws, session }) {
  return {
    async 'chat-turn:metadata:update'(clientMsg) {
      const binding = ThreadWebSocketHandler.captureActivationBinding(ws, session);
      if (!binding) {
        denyThreadMutation(ws);
        return;
      }
      try {
        await runWorkspaceOperation(
          ws,
          () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
          async () => {
            const result = await updateExchangeMetadata({
              workspaceId: binding.workspaceId,
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
          },
        );
      } catch (err) {
        if (isWorkspaceOperationLeaseError(err)) {
          denyThreadMutation(ws);
          return;
        }
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
