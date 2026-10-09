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
const { getDb } = require('../db');
const { createAgentActivityRepository } = require('../agent-provenance/activity-repository');
const { getSharedAgentActivityOwner } = require('../agent-provenance/activity-owner');
const { getAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');
const { getWireForThread } = require('./process-manager');
const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
} = require('../thread/canonical-drain-context');
const { resolveScope } = require('../chat-scope');

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

  const applier = createCanonicalChatEventApplier({
    emit,
    checkSettingsBounce,
    generateTurnId: () => generateId(),
    activityOwner,
  });

  function resolveAgentTurnIdentity(event) {
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
  }

  function directDrainContext(event) {
    const identity = resolveAgentTurnIdentity(event);
    if (!identity?.workspaceId || !identity?.threadId || !identity?.turnId) return null;
    const runtimeKey = {
      workspaceId: identity.workspaceId,
      projectRoot: identity.canonicalRoot || session.projectRoot,
      workspaceEpoch: identity.workspaceEpoch || session.workspaceEpoch,
      scope: 'project',
      threadId: identity.threadId,
    };
    const active = threadRuntimeManager.getActiveDrain(runtimeKey);
    if (active) return { route: active.routeContext, control: active.control };
    if (event?.type !== 'turn_begin') return null;
    const capturedWire = getWireForThread(identity.threadId, runtimeKey)
      || (session.currentThreadId === identity.threadId ? session.wire : null);
    const control = createCanonicalDrainControl({
      drainId: generateId(),
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => {
        try {
          if (capturedWire?._stopSession) await capturedWire._stopSession();
          else if (capturedWire?.stop) await capturedWire.stop();
          else if (capturedWire?.kill) capturedWire.kill('SIGTERM');
        } catch {
          console.warn('[ThreadRuntime] Direct canonical harness stop failed', {
            threadId: identity.threadId,
            marker: 'DIRECT_CANONICAL_HARNESS_STOP_FAILED',
          });
        }
      },
    });
    const route = createCanonicalRouteContext({
      workspaceId: identity.workspaceId,
      workspace: resolveScope({ currentWorkspaceId: identity.workspaceId, currentViewId: null }),
      projectRoot: identity.canonicalRoot || session.projectRoot,
      workspaceEpoch: session.workspaceEpoch || null,
      scope: 'project',
      threadId: identity.threadId,
      acceptedUserInput: session.pendingUserInput || event.userInput,
      attachments: Array.isArray(session.pendingAttachments) ? session.pendingAttachments : [],
    });
    const claimed = threadRuntimeManager.claimActiveDrain(runtimeKey, control, route);
    return { route: claimed.routeContext, control: claimed.control };
  }

  const bridge = createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
    // SPEC-01 Slice C bind-once: the accepted server turnId binds exactly once
    // to the drain that produced it — never through mutable connection state.
    bindDrainTurn: (drainContext, turnId) => threadRuntimeManager.bindTurnToDrain(
      drainContext.control.runtimeKey,
      drainContext.control.drainId,
      turnId
    ),
    resolveTurnIdentity: resolveAgentTurnIdentity,
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

  const handleCanonicalHarnessEvent = (event, eventWs, drainContext = null) => bridge.applyHarnessEvent(
    event,
    eventWs,
    drainContext || directDrainContext(event),
  );
  handleCanonicalHarnessEvent.drainHarnessEvents = bridge.drainHarnessEvents;
  handleCanonicalHarnessEvent.finalizeTurn = bridge.finalizeTurn;
  return { handleMessage, handleCanonicalHarnessEvent };
}

module.exports = { createWireMessageRouter };
