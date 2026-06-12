/**
 * Wire Message Router — per-connection router for wire protocol messages.
 *
 * Extracted from server.js per SPEC-01d.
 *
 * Chat events are handled through the canonical harness event bridge
 * (handleCanonicalHarnessEvent) for direct canonical event delivery.
 * The wire-broadcaster in lib/wire/wire-broadcaster.js subscribes and handles
 * client fan-out via threadId routing through wireRegistry.
 *
 * Non-chat events (request, response, error) are sent directly to the
 * injected ws. They are per-connection transport messages and do not
 * flow through the bus.
 *
 * Created once per WebSocket connection inside wss.on('connection').
 * Closes over the per-connection session and ws.
 */

const { v4: generateId } = require('uuid');
const { resolveScope } = require('../chat-scope');
const { ThreadWebSocketHandler } = require('../thread');
const { createCanonicalChatEventApplier } = require('./canonical-chat-event-applier');
const { createCanonicalHarnessEventBridge } = require('./canonical-harness-event-bridge');

/**
 * Create a per-connection wire message router.
 *
 * @param {object} deps
 * @param {object} deps.session - per-connection session state (mutated)
 * @param {import('ws').WebSocket} deps.ws - for non-chat direct sends
 * @param {object} deps.threadWebSocketHandler - for TurnEnd assistant-message persistence
 * @param {(type: string, payload: object) => void} deps.emit - event bus emit
 * @param {(toolName: string, args: object) => {message: string}|null} deps.checkSettingsBounce
 * @returns {{ handleMessage: (msg: object) => void }}
 */
function createWireMessageRouter({ session, ws, threadWebSocketHandler, emit, checkSettingsBounce }) {

  /**
   * Touch the session for the current thread to reset the idle timeout.
   * Called on wire activity so in-flight turns are not killed by the session idle timer.
   */
  function touchThreadSession() {
    const threadId = session.currentThreadId;
    if (!threadId) return;
    const manager = ThreadWebSocketHandler.getCurrentThreadManager(ws);
    if (manager) {
      manager.touchSession(threadId);
    }
  }

  /**
   * Persist assistant message after turn end.
   * Runtime-1R: accepts explicit threadId so persistence uses the in-flight
   * turn's identity, not the currently selected/browsed thread.
   */
  async function persistAssistantMessage(wsRef, content, hasToolCalls, metadata, explicitThreadId) {
    await threadWebSocketHandler.addAssistantMessage(wsRef, content, hasToolCalls, metadata, explicitThreadId);
  }

  const applier = createCanonicalChatEventApplier({
    session,
    emit,
    resolveWorkspace: resolveScope,
    touchThreadSession,
    persistAssistantMessage,
    checkSettingsBounce,
    generateTurnId: () => generateId()
  });

  const bridge = createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
  });

  function handleMessage(msg) {
    console.log('[Wire] Message received:', msg.method, msg.id ? `(id:${msg.id})` : '(event)');

    // Guard: don't process if WebSocket closed
    if (ws.readyState !== 1) {
      console.log('[Wire] WebSocket closed, dropping message');
      return;
    }

    // Event notifications — raw Kimi chat event parsing has been retired.
    // Chat events now flow through handleCanonicalHarnessEvent (direct canonical
    // event delivery) only. This path handles truly generic non-chat transport
    // messages or visible errors.
    if (msg.method === 'event' && msg.params) {
      const { type: eventType, payload } = msg.params;
      console.log('[Wire] Event:', eventType);

      switch (eventType) {
        case 'StepBegin':
          // Non-chat event — direct ws.send, not routed through the bus
          ws.send(JSON.stringify({ type: 'step_begin', stepNumber: payload?.n }));
          break;

        default:
          // Non-chat: unknown event type — forward raw to client
          ws.send(JSON.stringify({ type: 'event', eventType, payload }));
      }
    }

    // Non-chat: requests from agent
    else if (msg.method === 'request' && msg.params) {
      ws.send(JSON.stringify({
        type: 'request',
        requestType: msg.params.type,
        payload: msg.params.payload,
        requestId: msg.id
      }));
    }

    // Non-chat: responses to our requests
    else if (msg.id !== undefined && msg.result !== undefined) {
      ws.send(JSON.stringify({ type: 'response', id: msg.id, result: msg.result }));
    }

    // Non-chat: errors
    else if (msg.id !== undefined && msg.error !== undefined) {
      const errorMessage = msg.error?.message || '';
      if (msg.error?.code === -32004 || /Authentication failed/i.test(errorMessage)) {
        ws.send(JSON.stringify({
          type: 'auth_error',
          id: msg.id,
          scope: 'project',
          threadId: session.currentThreadId,
          message: errorMessage || 'Authentication failed. Run `kimi login` in your terminal.',
          error: msg.error
        }));
        return;
      }
      ws.send(JSON.stringify({ type: 'error', id: msg.id, error: msg.error }));
    }

    // Non-chat: unknown
    else {
      ws.send(JSON.stringify({ type: 'unknown', data: msg }));
    }
  }

  return { handleMessage, handleCanonicalHarnessEvent: bridge.applyHarnessEvent };
}

module.exports = { createWireMessageRouter };
