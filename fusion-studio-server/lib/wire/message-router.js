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
const { threadRuntimeManager } = require('../thread/thread-runtime-manager');
const { createCanonicalChatEventApplier } = require('./canonical-chat-event-applier');
const { createCanonicalHarnessEventBridge } = require('./canonical-harness-event-bridge');

/**
 * SPEC-03 Slice A: wire JSON-RPC error responses are a transport relay for
 * non-turn protocol errors. They forward generically and VALUE-MINIMIZED —
 * no raw msg.error object echo and no auth classification. Companion
 * auth_error notification behavior remains available on the runtime iterator
 * path via genuine HarnessRuntimeError markers only.
 */
const WIRE_ERROR_RELAY_MESSAGE = 'The harness reported a protocol error.';

/**
 * Create a per-connection wire message router.
 *
 * @param {object} deps
 * @param {object} deps.session - per-connection session state (non-canonical
 *        transport concerns only; canonical turn state lives in the runtime)
 * @param {import('ws').WebSocket} deps.ws - for non-chat direct sends
 * @param {(type: string, payload: object) => void} deps.emit - event bus emit
 * @param {(toolName: string, args: object, workspaceRoot?: string | null) => {message: string}|null} deps.checkSettingsBounce
 * @returns {{ handleMessage: (msg: object) => void }}
 */
function createWireMessageRouter({ session, ws, emit, checkSettingsBounce }) {

  const applier = createCanonicalChatEventApplier({
    emit,
    checkSettingsBounce,
    generateTurnId: () => generateId()
  });

  const bridge = createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
    // SPEC-01 Slice C bind-once: the accepted server turnId binds exactly once
    // to the drain that produced it — never through mutable connection state.
    bindDrainTurn: (drainContext, turnId) => threadRuntimeManager.bindTurnToDrain(
      drainContext.control.runtimeKey,
      drainContext.control.drainId,
      turnId
    ),
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
    // SPEC-02 Slice D §3.D rule 5: the legacy direct StepBegin ws.send branch
    // is deleted entirely (no shim, no compatibility forwarder, no step
    // counter field). StepBegin wire events take the same generic unknown-
    // event forward as any other non-chat event.
    if (msg.method === 'event' && msg.params) {
      const { type: eventType, payload } = msg.params;
      console.log('[Wire] Event:', eventType);

      // Non-chat: unknown event type — forward raw to client
      ws.send(JSON.stringify({ type: 'event', eventType, payload }));
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

    // Non-chat: errors — generic, value-minimized transport relay. Native
    // protocol-code and provider-auth-text classification was removed
    // entirely (SPEC-03 §A4): shared code never recovers specificity by
    // parsing wire error payloads.
    else if (msg.id !== undefined && msg.error !== undefined) {
      ws.send(JSON.stringify({ type: 'error', id: msg.id, message: WIRE_ERROR_RELAY_MESSAGE }));
    }

    // Non-chat: unknown
    else {
      ws.send(JSON.stringify({ type: 'unknown', data: msg }));
    }
  }

  return { handleMessage, handleCanonicalHarnessEvent: bridge.applyHarnessEvent };
}

module.exports = { createWireMessageRouter };
