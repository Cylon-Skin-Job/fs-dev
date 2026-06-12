/**
 * Thread Message Handlers
 *
 * Extracted from ThreadWebSocketHandler.js — handles user message sending
 * and assistant message recording.
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

    const threadId = state.threadId;
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

      ws.send(JSON.stringify({
        type: 'message:sent',
        threadId,
        scope: 'project',
        content
      }));
      return true;

    } catch (err) {
      console.error('[ThreadWS] Send message failed:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
      return false;
    }
  }

  /**
   * Add assistant message to thread (called after streaming completes).
   * Runtime-1R: if explicit threadId is provided, use it directly instead of
   * resolving from mutable selection state. This prevents a passive browse
   * from retargeting persistence of an in-flight turn.
   * @param {import('ws').WebSocket} ws
   * @param {string} content
   * @param {boolean} hasToolCalls
   * @param {object} [metadata] - Optional metadata (contextUsage, tokenUsage, etc.)
   * @param {string} [explicitThreadId] - Optional explicit target thread ID
   */
  async function addAssistantMessage(ws, content, hasToolCalls = false, metadata = null, explicitThreadId = null) {
    const state = wsState.get(ws);
    if (!state) return;

    const threadId = explicitThreadId || state.threadId;
    if (!threadId) return;

    const manager = state.threadManager;
    const message = {
      role: 'assistant',
      content,
      hasToolCalls
    };

    if (metadata && Object.keys(metadata).length > 0) {
      await manager.addMessageWithMetadata(threadId, message, metadata);
    } else {
      await manager.addMessage(threadId, message);
    }
  }

  return { handleMessageSend, addAssistantMessage };
}

module.exports = { createMessageHandlers };
