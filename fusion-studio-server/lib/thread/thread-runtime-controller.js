/**
 * @module thread-runtime-controller
 * @role Accept prompts through server-owned thread runtime state.
 */

const ThreadWebSocketHandler = require('./ThreadWebSocketHandler');
// crypto.randomUUID() emits RFC 4122 v4 UUIDs and stays CommonJS-safe
// (the 'uuid' package is ESM-only under Jest). Same precedent as
// lib/wire/process-manager.js.
const { randomUUID: generateDrainId } = require('crypto');
const { resolveScope } = require('../chat-scope');
const { attachClientToWire, getWireForThread, unregisterWire } = require('../wire/process-manager');
const {
  isHarnessRuntimeError,
  HARNESS_RUNTIME_ERROR_MESSAGES,
} = require('../harness/errors');
const {
  normalizeTurnTerminalError,
  TURN_TERMINAL_ERROR_CATALOG,
} = require('./turn-terminal-error');
const { persistDiagnosticReport } = require('./harness-diagnostic-service');
const { persistTerminalDiagnosticSafely } = require('./terminal-diagnostic-boundary');
const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
  normalizeRouteAttachments,
} = require('./canonical-drain-context');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');

// RCC-0095: all threads are workspace-scoped. The 'project' scope literal
// is kept on runtime keys and outbound messages for wire compatibility.
const SCOPE = 'project';

function extractSelectionPatch(harnessConfig) {
  if (!harnessConfig || typeof harnessConfig !== 'object') return null;
  const patch = {};
  if (typeof harnessConfig.model === 'string' && harnessConfig.model.trim()) {
    patch.model = harnessConfig.model.trim();
  }
  if (typeof harnessConfig.variant === 'string' && harnessConfig.variant.trim()) {
    patch.variant = harnessConfig.variant.trim();
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function serializeAttachmentsForHarness(userInput, attachments) {
  if (!attachments.length) return userInput;
  const lines = attachments.map((attachment) => `- ${attachment.label}: ${attachment.path}`);
  return `${userInput}\n\nAttached references:\n${lines.join('\n')}`;
}

function getRuntimeKey(manager, threadId) {
  return {
    workspaceId: manager.workspaceId,
    scope: SCOPE,
    threadId,
  };
}

function sendRuntimeError(ws, message, threadId, recoverable) {
  ws.send(JSON.stringify({ type: 'error', message, scope: SCOPE, threadId, recoverable }));
}

// Controller exception boundaries never serialize or log the caught value.
// These fixed reports preserve route correlation while keeping provider text,
// stacks, and arbitrary thrown objects outside ordinary frames and logs.
function reportWarmupFailure(ws, threadId) {
  console.error('[ThreadRuntime] Thread warm-up failed', {
    threadId,
    marker: 'THREAD_WARM_UP_FAILED',
  });
  sendRuntimeError(ws, 'Thread warm-up failed', threadId, true);
}

function reportThreadLookupFailure(ws, threadId) {
  console.error('[ThreadRuntime] Thread lookup failed', {
    threadId,
    marker: 'THREAD_LOOKUP_FAILED',
  });
  sendRuntimeError(ws, 'Thread lookup failed', threadId, true);
}

function reportPromptAcceptanceFailure(ws, threadId) {
  console.error('[ThreadRuntime] Prompt acceptance failed', {
    threadId,
    marker: 'PROMPT_ACCEPTANCE_FAILED',
  });
  sendRuntimeError(ws, 'Message could not be accepted', threadId, true);
}

function reportDrainBindingFailure(ws, threadId) {
  console.error('[ThreadRuntime] Prompt drain binding failed', {
    threadId,
    marker: 'PROMPT_DRAIN_BINDING_FAILED',
  });
  sendRuntimeError(ws, 'Prompt binding failed', threadId, true);
}

function reportHarnessStopFailure(threadId, drainId) {
  console.warn('[ThreadRuntime] Harness stop failed', {
    threadId,
    drainId,
    marker: 'HARNESS_STOP_FAILED',
  });
}

function reportInterruptedSynthesisFailure(threadId, drainId) {
  console.error('[ThreadRuntime] Interrupted-turn synthesis failed', {
    threadId,
    ...(drainId ? { drainId } : {}),
    marker: 'INTERRUPTED_TURN_SYNTHESIS_FAILED',
  });
}

function reportLegacyStopFailure(threadId) {
  console.warn('[ThreadRuntime] Legacy harness stop failed', {
    threadId,
    marker: 'LEGACY_HARNESS_STOP_FAILED',
  });
}

function markReadyIfRuntimeStillActive(runtimeKey) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.IN_FLIGHT) {
    threadRuntimeManager.markReady(runtimeKey);
  }
}

async function stopWire(wire, threadId) {
  try {
    if (wire._stopSession) {
      await wire._stopSession();
    } else if (wire.stop) {
      await wire.stop();
    } else if (wire.kill) {
      wire.kill('SIGTERM');
    }
  } finally {
    unregisterWire(threadId);
  }
}

async function ensureReadyRuntime({ ws, session, wireLifecycle, projectRoot, spawnAndSetupWire, runtimeKey, threadId, suppressBusyError = false }) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);

  if (state === RUNTIME_STATES.READY) {
    const readyWire = getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);
    if (readyWire && !readyWire.killed) return readyWire;
    if (readyWire?.killed) {
      console.warn(`[ThreadRuntime] Discarding closed ready wire for thread ${threadId}; warming a replacement`);
      if (getWireForThread(threadId) === readyWire) unregisterWire(threadId);
      if (session.wire === readyWire) session.wire = null;
    }
    threadRuntimeManager.markCold(runtimeKey);
  }

  if (state === RUNTIME_STATES.WARMING) {
    try {
      const warmedWire = await threadRuntimeManager.getWarmPromise(runtimeKey);
      return warmedWire || getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);
    } catch {
      threadRuntimeManager.markCold(runtimeKey);
      reportWarmupFailure(ws, threadId);
      return null;
    }
  }

  if (state === RUNTIME_STATES.IN_FLIGHT || state === RUNTIME_STATES.STOPPING) {
    if (!suppressBusyError) {
      sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', threadId, true);
    }
    return null;
  }

  // Promise indirection also captures a synchronous spawn exception into the
  // same fixed-safe failure boundary as an asynchronous rejection.
  const warmPromise = Promise.resolve().then(() => spawnAndSetupWire({
    ws,
    session,
    wireLifecycle,
    threadId,
    projectRoot,
  }));
  threadRuntimeManager.markWarming(runtimeKey, warmPromise);

  try {
    const wire = await warmPromise;
    threadRuntimeManager.markReady(runtimeKey);
    return wire;
  } catch {
    threadRuntimeManager.markCold(runtimeKey);
    reportWarmupFailure(ws, threadId);
    return null;
  } finally {
    threadRuntimeManager.clearWarmPromise(runtimeKey);
  }
}

async function warmRuntimeForIntent({
  ws,
  session,
  clientMsg,
  wireLifecycle,
  projectRoot,
  spawnAndSetupWire,
}) {
  const threadId = clientMsg.threadId;
  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManager;
  if (!threadId || !manager) {
    sendRuntimeError(ws, 'No active thread', threadId, false);
    return;
  }

  let thread;
  try {
    thread = await manager.getThread(threadId);
  } catch {
    reportThreadLookupFailure(ws, threadId);
    return;
  }
  if (!thread) {
    sendRuntimeError(ws, `Thread not found: ${threadId}`, threadId, false);
    return;
  }

  const runtimeKey = getRuntimeKey(manager, threadId);
  await ensureReadyRuntime({
    ws,
    session,
    wireLifecycle,
    projectRoot,
    spawnAndSetupWire,
    runtimeKey,
    threadId,
    suppressBusyError: true,
  });
}

async function acceptPromptThroughRuntime({
  ws,
  session,
  clientMsg,
  wireLifecycle,
  projectRoot,
  spawnAndSetupWire,
  handleCanonicalHarnessEvent,
}) {
  const threadId = clientMsg.threadId;
  console.log('[WS] PROMPT received:', clientMsg.user_input?.slice(0, 50), 'threadId:', threadId?.slice(0, 8));

  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManager;
  if (!threadId || !manager) {
    sendRuntimeError(ws, 'No active thread', threadId, false);
    return;
  }

  // SPEC-01 Slice B: the drain-binding factories below require non-empty
  // string input. Validate before spawning a wire, persisting, or entering
  // IN_FLIGHT so a garbage prompt can neither wedge the runtime nor dirty
  // history.
  if (typeof clientMsg.user_input !== 'string' || !clientMsg.user_input) {
    sendRuntimeError(ws, 'Prompt requires a non-empty user_input', threadId, false);
    return;
  }

  let thread;
  try {
    thread = await manager.getThread(threadId);
  } catch {
    reportThreadLookupFailure(ws, threadId);
    return;
  }
  if (!thread) {
    sendRuntimeError(ws, `Thread not found: ${threadId}`, threadId, false);
    return;
  }

  // Apply per-prompt model/effort selection to the thread before the turn.
  // Persists into harness_config so cold restarts keep the selection.
  const selectionPatch = extractSelectionPatch(clientMsg.harnessConfig);
  if (selectionPatch) {
    try {
      await manager.updateHarnessConfig(threadId, selectionPatch);
    } catch (err) {
      console.error('[WS] Failed to persist harnessConfig selection:', err?.message || err);
    }
  }

  const runtimeKey = getRuntimeKey(manager, threadId);
  const wire = await ensureReadyRuntime({
    ws,
    session,
    wireLifecycle,
    projectRoot,
    spawnAndSetupWire,
    runtimeKey,
    threadId,
  });
  if (!wire) return;

  session.currentThreadId = threadId;
  session.currentScope = SCOPE;
  session.currentViewId = null;
  threadState.threadId = threadId;

  if (!wire._sendMessage) {
    sendRuntimeError(ws, 'Wire does not support ACP sendMessage. Legacy wire format has been retired.', threadId, false);
    return;
  }

  if (!wire._usesDirectCanonicalEvents || !handleCanonicalHarnessEvent) {
    sendRuntimeError(ws, 'Wire does not support direct canonical event delivery. Legacy wire format has been retired.', threadId, false);
    return;
  }

  // Push the per-prompt model/effort selection live onto the wire so the
  // current session picks it up without a re-spawn.
  if (selectionPatch && typeof wire._applyHarnessConfig === 'function') {
    wire._applyHarnessConfig(selectionPatch);
  }

  if (threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.READY) {
    sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', threadId, true);
    return;
  }

  threadRuntimeManager.markInFlight(runtimeKey);
  const attachments = normalizeRouteAttachments(clientMsg.attachments);
  const harnessInput = serializeAttachmentsForHarness(clientMsg.user_input, attachments);
  let accepted = false;
  try {
    accepted = await ThreadWebSocketHandler.handleMessageSend(ws, {
      content: clientMsg.user_input,
    });
  } catch {
    threadRuntimeManager.markReady(runtimeKey);
    reportPromptAcceptanceFailure(ws, threadId);
    return;
  }
  if (!accepted) {
    threadRuntimeManager.markReady(runtimeKey);
    return;
  }
  console.log('[WS] Message accepted by runtime and tracked in thread');

  attachClientToWire(threadId, wire, projectRoot, ws, {
    workspaceId: session.currentWorkspaceId,
    viewId: null,
  });

  // SPEC-01 Slice B: bind the accepted prompt to an immutable route context
  // and claim one UUID drain before the harness iterator is consumed. The
  // control closes over the exact wire that accepted this prompt; it never
  // looks the session up through mutable connection selection. Any binding
  // failure rolls the runtime back to READY instead of wedging it. Accepted
  // input/attachments live in the frozen route context from here on — the
  // connection session stores none of them.
  let claimedRecord = null;
  try {
    const routeContext = createCanonicalRouteContext({
      workspaceId: manager.workspaceId,
      workspace: resolveScope({ currentWorkspaceId: session.currentWorkspaceId, currentViewId: null }),
      projectRoot,
      scope: SCOPE,
      threadId,
      acceptedUserInput: clientMsg.user_input,
      attachments,
    });

    const drainId = generateDrainId();
    const drainControl = createCanonicalDrainControl({
      drainId,
      runtimeKey,
      touchThreadSession: () => manager.touchSession(threadId),
      stopHarness: async () => {
        try {
          if (wire._stopSession) {
            await wire._stopSession();
          } else if (wire.stop) {
            await wire.stop();
          } else if (wire.kill) {
            wire.kill('SIGTERM');
          }
        } catch {
          reportHarnessStopFailure(threadId, drainId);
        }
      },
    });

    claimedRecord = threadRuntimeManager.claimActiveDrain(runtimeKey, drainControl, routeContext);
  } catch {
    threadRuntimeManager.markReady(runtimeKey);
    reportDrainBindingFailure(ws, threadId);
    return;
  }

  const drainId = claimedRecord.drainId;
  // SPEC-01 Slice C: every iterator event carries its claimed drain context so
  // canonical mutations compare the exact route/control that accepted them.
  const drainContext = { route: claimedRecord.routeContext, control: claimedRecord.control };

  // Replacement-aware supersession check for the end/error paths below. A
  // normal turn clears its own record in terminalize/clear-if-current before
  // iteration completes, so record-absence alone is NOT supersession; only a
  // DIFFERENT live drain proves this iterator is stale.
  function isDrainSuperseded() {
    const current = threadRuntimeManager.getActiveDrain(runtimeKey);
    return Boolean(current && current.drainId !== drainId);
  }

  (async () => {
    try {
      for await (const event of wire._sendMessage(harnessInput, {})) {
        handleCanonicalHarnessEvent(event, ws, drainContext);
      }
      if (isDrainSuperseded()) {
        console.warn(`[ThreadRuntime] Drain ${drainId} superseded; completion handling is a diagnostic no-op`);
        return;
      }
      markReadyIfRuntimeStillActive(runtimeKey);
    } catch (err) {
      if (isDrainSuperseded()) {
        console.warn('[ThreadRuntime] Ignoring superseded iterator failure', {
          threadId,
          drainId,
          marker: 'SUPERSEDED_ITERATOR_FAILURE',
        });
        return;
      }
      // Reconstruct the disclosure-safe outcome once at this boundary. This
      // genuine-marker check never reads raw message/name/stack/provider data;
      // every unknown throw becomes the fixed generic catalog row.
      const safeTerminalError = normalizeTurnTerminalError(err);
      // SPEC-03 Slice B (parent §4.13, DEV-5 carry-forward slot): a begun,
      // non-terminalized bound turn is a POST-BEGIN failure — terminalize it
      // exactly once by synthesizing ONE canonical error turn_end through
      // handleCanonicalHarnessEvent with the bound drain context. This flows
      // through bridge → applier → canonical-chat-terminal-events.handleTurnEnd
      // — the SAME single sequenced terminal publication path as every other
      // turn_end, with compare-current gating intact. The safe catalog
      // envelope is reconstructed from the fixed table only; raw error
      // material never travels with it.
      const boundTurnId = threadRuntimeManager.resolveBoundTurnId(runtimeKey, drainId);
      if (boundTurnId) {
        // SPEC-03 Slice C (parent §4.13.1, R5/R5A): best-effort diagnostic
        // persistence BEFORE synthesis, gated on a genuine marker carrying
        // an already-redacted closed V1 candidate. The service re-validates,
        // binds the authoritative workspace/thread/turn identity, and
        // normally resolves to null on failure. The shared terminal boundary
        // also contains a rejecting replacement/dependency as fixed-safe null,
        // so persistence cannot block terminalization or rewrite the envelope.
        // The supersession guard above ran first and downstream compare-current
        // gating in handleTurnEnd still drops a stale synthesis.
        let diagnosticId = null;
        if (isHarnessRuntimeError(err) && err.candidate) {
          diagnosticId = await persistTerminalDiagnosticSafely(
            persistDiagnosticReport,
            { workspaceId: manager.workspaceId, threadId, turnId: boundTurnId },
            err.candidate,
          );
        }
        try {
          // Envelopes are frozen catalog copies — construct a NEW plain
          // object with the optional opaque diagnosticId. Downstream
          // validateTurnTerminalError re-validates the final shape
          // (diagnosticId: non-empty string ≤128 chars).
          handleCanonicalHarnessEvent({
            type: 'turn_end',
            reason: 'error',
            partial: true,
            terminalError: {
              ...safeTerminalError,
              ...(diagnosticId ? { diagnosticId } : {}),
            },
          }, ws, drainContext);
        } catch {
          console.error('[ThreadRuntime] Error-turn synthesis failed', {
            threadId,
            drainId,
            marker: 'ERROR_TURN_SYNTHESIS_FAILED',
          });
        }
      }
      // Pre-begin failures (no bound turnId): NO exchange, NO turn_begin-
      // dependent state change — synthesis skipped entirely; warm-up and
      // validation failure behavior elsewhere in this file stays untouched.
      markReadyIfRuntimeStillActive(runtimeKey);
      console.error('[WS] Harness sendMessage failed', {
        threadId,
        drainId,
        marker: safeTerminalError.code,
      });
      // SPEC-03 Slice A: companion selection is marker-only. Shared code
      // checks ONLY a genuine HarnessRuntimeError — never raw codes, names,
      // or message text (roadmap §5.5). The auth_error companion carries the
      // fixed safe authentication text and no raw error serialization.
      // Companion notification runs AFTER the synthesis attempt above.
      if (isHarnessRuntimeError(err) && err.code === 'HARNESS_AUTHENTICATION_FAILED') {
        ws.send(JSON.stringify({
          type: 'auth_error',
          scope: SCOPE,
          threadId,
          recoverable: true,
          message: HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_AUTHENTICATION_FAILED,
        }));
      } else {
        sendRuntimeError(
          ws,
          TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED.message,
          threadId,
          true,
        );
      }
    }
  })();
}

async function stopRuntimeTurn({ ws, session, clientMsg, handleCanonicalHarnessEvent }) {
  const threadId = clientMsg.threadId;
  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManager;
  if (!threadId || !manager) {
    sendRuntimeError(ws, 'No active thread', threadId, false);
    return;
  }

  const runtimeKey = getRuntimeKey(manager, threadId);
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.STOPPING) return;
  if (state !== RUNTIME_STATES.IN_FLIGHT) {
    sendRuntimeError(ws, 'Thread runtime is not currently streaming.', threadId, true);
    return;
  }

  const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
  if (!liveTurn) {
    sendRuntimeError(ws, 'No live turn is available to stop.', threadId, true);
    return;
  }

  // SPEC-01 Slice D: capture the bound drain identity BEFORE synthesizing the
  // interrupted turn_end. When a record exists, stopping goes ONLY through
  // that record's control — never through registry/session wire lookup.
  const activeDrain = threadRuntimeManager.getActiveDrain(runtimeKey);
  const capturedDrain = activeDrain
    ? { drainId: activeDrain.drainId, routeContext: activeDrain.routeContext, control: activeDrain.control }
    : null;

  threadRuntimeManager.markState(runtimeKey, RUNTIME_STATES.STOPPING);

  session.currentThreadId = threadId;
  session.currentScope = SCOPE;
  session.currentViewId = null;

  // Canonical accumulator reconstruction through session state is retired:
  // the applier sources interrupted-turn assembly from the runtime snapshot.

  if (handleCanonicalHarnessEvent) {
    try {
      if (capturedDrain) {
        handleCanonicalHarnessEvent({
          type: 'turn_end',
          reason: 'interrupted',
          partial: true,
        }, ws, { route: capturedDrain.routeContext, control: capturedDrain.control });
      } else {
        // No active drain record: keep the historical 2-arg call shape so the
        // applier's defensive no-drain-context drop behaves unchanged.
        handleCanonicalHarnessEvent({
          type: 'turn_end',
          reason: 'interrupted',
          partial: true,
        }, ws);
      }
    } catch {
      // A terminal publication failure must not escape into the router's raw
      // catch or prevent the bound harness and runtime from being cleaned up.
      reportInterruptedSynthesisFailure(threadId, capturedDrain?.drainId);
    }
  }

  if (capturedDrain) {
    // SPEC-01 Slice D item 2: stop only the bound harness through the matching
    // control capability.
    try {
      await capturedDrain.control.stopHarness();
    } catch {
      // Controls are expected to contain their own provider failure, but the
      // controller defends the Promise<void> contract so an injected or
      // automation-owned control cannot escape into the router's raw catch.
      reportHarnessStopFailure(threadId, capturedDrain.drainId);
    }

    // SPEC-01 Slice D item 4 (supersession-safe completion): re-read the
    // active record AFTER the stop resolves. Absence of a record is our own
    // clear-if-current from the synthesized terminal above (NOT supersession);
    // only a DIFFERENT live drainId proves this stop is stale. A superseded
    // Stop completion is a diagnostic no-op: no unregisterWire (the registry
    // slot may belong to the replacement's wire), no state transition (the
    // replacement owns runtime state), and nothing extra sent.
    const currentDrain = threadRuntimeManager.getActiveDrain(runtimeKey);
    const superseded = Boolean(currentDrain && currentDrain.drainId !== capturedDrain.drainId);
    if (superseded) {
      console.warn(`[ThreadRuntime] Drain ${capturedDrain.drainId} superseded during stop; cleanup is a diagnostic no-op`);
      return;
    }

    // Registry hygiene for our own wire slot...
    unregisterWire(threadId);
    // ...then remove any orphaned never-begun record (idempotent no-op after
    // the applier's own terminal clear-if-current).
    threadRuntimeManager.clearActiveDrainIfCurrent(runtimeKey, capturedDrain.drainId);
    // Transition to cold only while still STOPPING — mirrors the
    // markReadyIfRuntimeStillActive precedent so a replacement drain's
    // IN_FLIGHT state is never stomped by a late stop completion.
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.STOPPING) {
      threadRuntimeManager.markCold(runtimeKey);
    }
    // Bound path: session.wire can no longer be identity-compared to the
    // stopped harness; a stale reference is discarded by ensureReadyRuntime's
    // killed-wire logic instead.
    return;
  }

  // No active drain record (pre-claim stop edge): keep the historical legacy
  // wire lookup + unconditional cold exactly as before Slice D.
  const wire = getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);

  if (wire) {
    try {
      await stopWire(wire, threadId);
    } catch {
      // stopWire unregisters in its finally block. Keep completing local
      // cleanup, but never let the caught provider/runtime value reach the
      // router's raw exception frame/logger.
      reportLegacyStopFailure(threadId);
    }
    if (session.wire === wire) session.wire = null;
  }
  threadRuntimeManager.markCold(runtimeKey);
}

module.exports = {
  acceptPromptThroughRuntime,
  ensureReadyRuntime,
  getRuntimeKey,
  stopRuntimeTurn,
  warmRuntimeForIntent,
};
