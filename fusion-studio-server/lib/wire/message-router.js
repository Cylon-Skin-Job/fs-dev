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
const { getDb } = require('../db');
const { createAgentActivityRepository } = require('../agent-provenance/activity-repository');
const { getSharedAgentActivityOwner } = require('../agent-provenance/activity-owner');
const { getAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');

/**
 * Create a per-connection wire message router.
 *
 * @param {object} deps
 * @param {object} deps.session - per-connection session state (mutated)
 * @param {import('ws').WebSocket} deps.ws - for non-chat direct sends
 * @param {(type: string, payload: object) => void} deps.emit - event bus emit
 * @param {(toolName: string, args: object, workspaceRoot?: string | null) => {message: string}|null} deps.checkSettingsBounce
 * @returns {{ handleMessage: (msg: object) => void }}
 */
function createWireMessageRouter({ session, ws, emit, checkSettingsBounce, activityOwner: injectedActivityOwner = null }) {

  let activityOwner = injectedActivityOwner;
  if (!activityOwner) {
    try {
      const db = getDb();
      const activityRepository = createAgentActivityRepository(db, {
        onDiagnostic: (code) => console.warn(`[AgentProvenance] ${code}`),
      });
      activityOwner = getSharedAgentActivityOwner({
        db,
        activityRepository,
        onDiagnostic: (code) => console.warn(`[AgentProvenance] ${code}`),
      });
    } catch {
      console.warn('[AgentProvenance] agent_activity_owner_unavailable');
    }
  }

  /**
   * Touch the session for the current thread to reset the idle timeout.
   * Called on wire activity so in-flight turns are not killed by the session idle timer.
   */
  function touchThreadSession(threadId = session.currentThreadId) {
    if (!threadId) return;
    const manager = ThreadWebSocketHandler.getCurrentThreadManager(ws);
    if (manager) {
      manager.touchSession(threadId);
    }
  }

  const applier = createCanonicalChatEventApplier({
    session,
    emit,
    resolveWorkspace: resolveScope,
    touchThreadSession,
    checkSettingsBounce,
    generateTurnId: () => generateId(),
    activityOwner,
  });

  const bridge = createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
    resolveTurnIdentity: (event) => {
      const pendingAuthority = session.pendingAgentTurnAuthority;
      const currentAuthority = session.currentTurn?.authority;
      const currentIsLive = currentAuthority
        && getAgentTurnAuthorityRef(currentAuthority) === currentAuthority;
      const pendingIsLive = pendingAuthority
        && getAgentTurnAuthorityRef(pendingAuthority) === pendingAuthority;
      const authority = event?.type === 'turn_begin'
        ? (pendingIsLive ? pendingAuthority : null)
          || (currentIsLive ? currentAuthority : null)
          || pendingAuthority
          || currentAuthority
        : (currentIsLive ? currentAuthority : null)
          || (pendingIsLive ? pendingAuthority : null)
          || pendingAuthority
          || currentAuthority;
      if (authority) return authority;
      return {
        workspaceId: session.currentWorkspaceId,
        threadId: session.currentThreadId,
        turnId: session.currentTurn?.id || session.pendingTurnId,
      };
    },
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

  const handleCanonicalHarnessEvent = bridge.applyHarnessEvent;
  handleCanonicalHarnessEvent.drainHarnessEvents = bridge.drainHarnessEvents;
  handleCanonicalHarnessEvent.finalizeTurn = bridge.finalizeTurn;
  return { handleMessage, handleCanonicalHarnessEvent };
}

module.exports = { createWireMessageRouter };
