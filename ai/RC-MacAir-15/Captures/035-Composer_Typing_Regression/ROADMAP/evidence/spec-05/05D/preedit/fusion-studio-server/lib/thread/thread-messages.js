/**
 * Thread Message Handlers
 *
 * Extracted from ThreadWebSocketHandler.js — handles accepted user message
 * activity. Durable chat exchanges are saved by the audit subscriber.
 *
 * RCC-0095: all threads are workspace-scoped (single workspace chat).
 *
 * Uses a factory pattern so the coordinator can inject the shared wsState Map.
 */

/**
 * @param {object} deps
 * @param {Map} deps.wsState - Per-WS state map (shared with coordinator)
 */
function createMessageHandlers({ wsState }) {

  /**
   * Handle message:send - add user message to the active thread.
   * @param {import('ws').WebSocket} ws
   * @param {object} msg
   * @param {string} msg.content
   */
  async function handleMessageSend(ws, msg) {
    const state = wsState.get(ws);
    if (!state) {
      ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
      return false;
    }

    // The prompt's resolved target is immutable for this admission. The
    // connection's selected thread can still refer to a different session.
    const threadId = msg.threadId;
    if (!threadId) {
      ws.send(JSON.stringify({ type: 'error', message: 'No active thread' }));
      return false;
    }

    const manager = state.threadManager;
    const { content } = msg;

    try {
      // Add message to thread
      await manager.addMessage(threadId, {
        role: 'user',
        content,
        hasToolCalls: false
      });

      // Update MRU
      await manager.index.touch(threadId);

      if (msg.sendAcknowledgement !== false) {
        ws.send(JSON.stringify({
          type: 'message:sent',
          workspaceId: manager.workspaceId,
          threadId,
          scope: 'project',
          content,
          ...(msg.requestId ? { requestId: msg.requestId } : {}),
          ...(msg.turnId ? { turnId: msg.turnId } : {}),
        }));
      }
      return true;

    } catch {
      console.error('[ThreadWS] Send message failed', {
        threadId,
        marker: 'MESSAGE_PERSISTENCE_FAILED',
      });
      if (msg.suppressFailureFrame !== true) ws.send(JSON.stringify({
        type: 'error',
        message: 'Message could not be saved',
        scope: 'project',
        ...(manager.workspaceId ? { workspaceId: manager.workspaceId } : {}),
        threadId,
        recoverable: true,
        ...(msg.requestId ? { requestId: msg.requestId } : {}),
      }));
      return false;
    }
  }

  return { handleMessageSend };
}

module.exports = { createMessageHandlers };
