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
const { randomUUID } = require('crypto');
const {
  createAgentTurnAuthorityRef,
  getAgentTurnAuthorityRef,
  releaseAgentTurnAuthorityRef,
} = require('../agent-provenance/turn-authority');

// RCC-0095: all threads are workspace-scoped. The 'project' scope literal
// is kept on runtime keys and outbound messages for wire compatibility.
const SCOPE = 'project';

/**
 * Extract the model/effort selection from a client-provided harnessConfig.
 * Only model and variant are writable per-prompt; everything else is left
 * untouched so session continuity fields are never clobbered.
 * @returns {object|null}
 */
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

function clearAcceptedPromptIfOwned(session, acceptedPrompt) {
  if (session.pendingTurnId !== acceptedPrompt.turnId
    || session.pendingAgentTurnAuthority !== acceptedPrompt.authority
    || session.pendingUserInput !== acceptedPrompt.userInput
    || session.pendingAttachments !== acceptedPrompt.attachments) return false;
  session.pendingTurnId = null;
  session.pendingAgentTurnAuthority = null;
  session.pendingUserInput = null;
  session.pendingAttachments = [];
  return true;
}

function captureBaseTurnOwnership(session, identity) {
  const turn = session.currentTurn;
  if (!turn || turn.id !== identity.turnId || session.currentThreadId !== identity.threadId) return null;
  if (turn.authority && identity.authority && turn.authority !== identity.authority) return null;
  if (turn.authority && !identity.authority
    && (turn.authority.workspaceId !== identity.workspaceId
      || turn.authority.threadId !== identity.threadId
      || turn.authority.turnId !== identity.turnId)) return null;
  return {
    currentTurn: turn,
    assistantParts: session.assistantParts,
  };
}

function clearBaseTurnIfOwned(session, identity, ownership) {
  if (!ownership || session.currentThreadId !== identity.threadId) return false;
  const stillOwned = session.currentTurn === ownership.currentTurn
    && session.assistantParts === ownership.assistantParts;
  const clearedByOwnedFinalizer = session.currentTurn === null
    && Array.isArray(session.assistantParts)
    && session.assistantParts.length === 0;
  if (!stillOwned && !clearedByOwnedFinalizer) return false;
  if (stillOwned) {
    session.currentTurn = null;
    session.assistantParts = [];
  }
  session.hasToolCalls = false;
  session.activeToolId = null;
  session.activeToolName = null;
  session.toolArgs = {};
  session.toolNamesById = {};
  session.bouncedToolCalls = new Set();
  session.contextUsage = null;
  session.tokenUsage = null;
  session.messageId = null;
  session.planMode = false;
  return true;
}

function disposeTurnApplicationContext(context) {
  context.pendingTurnId = null;
  context.pendingAgentTurnAuthority = null;
  context.pendingUserInput = null;
  context.pendingAttachments = [];
  context.currentTurn = null;
  context.assistantParts = [];
  context.hasToolCalls = false;
  context.activeToolId = null;
  context.activeToolName = null;
  context.toolArgs = {};
  context.toolNamesById = {};
  context.bouncedToolCalls = new Set();
  context.contextUsage = null;
  context.tokenUsage = null;
  context.messageId = null;
  context.planMode = false;
  context.wire = null;
  context.projectRoot = null;
}

async function stopWire(wire, threadId) {
  const bounded = (promise, timeoutMs) => new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve('timeout');
    }, timeoutMs);
    timer.unref?.();
    Promise.resolve(promise).then(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve('fulfilled');
    }, () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve('rejected');
    });
  });
  try {
    if (wire._stopSession) {
      const stopped = await bounded(wire._stopSession('SIGTERM'), 2_000);
      if (stopped === 'timeout') await bounded(wire._stopSession('SIGKILL'), 1_000);
      if (stopped === 'rejected') throw new Error('legacy stop rejected');
    } else if (wire.stop) {
      const stopped = await bounded(wire.stop('SIGTERM'), 2_000);
      if (stopped === 'timeout') await bounded(wire.stop('SIGKILL'), 1_000);
      if (stopped === 'rejected') throw new Error('legacy stop rejected');
    } else if (wire.kill) {
      wire.kill('SIGTERM');
      const closed = await bounded(new Promise((resolve) => wire.once?.('close', resolve)), 2_000);
      if (closed === 'timeout') {
        wire.kill('SIGKILL');
        await bounded(new Promise((resolve) => wire.once?.('close', resolve)), 1_000);
      }
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

  const turnId = randomUUID();
  session.pendingTurnId = turnId;
  let authorityAttempted = false;
  try {
    const harnessId = thread.entry?.harnessId;
    if (!harnessId || wire._harnessId !== harnessId) throw new Error('resolved harness identity mismatch');
    authorityAttempted = true;
    session.pendingAgentTurnAuthority = await createAgentTurnAuthorityRef({
      workspaceId: manager.workspaceId,
      threadId,
      turnId,
      harnessId,
      provider: wire._provider || harnessId,
      workspaceRoot: manager.projectRoot,
    });
  } catch {
    session.pendingAgentTurnAuthority = null;
    if (authorityAttempted) console.warn('[AgentProvenance] agent_turn_authority_unavailable');
  }
  const turnAuthority = session.pendingAgentTurnAuthority;

  attachClientToWire(threadId, wire, projectRoot, ws, {
    workspaceId: session.currentWorkspaceId,
    viewId: null,
  });

  if (turnAuthority) {
    session.pendingUserInput = clientMsg.user_input;
    session.pendingAttachments = attachments;
  }
  const acceptedPrompt = turnAuthority ? {
    turnId,
    authority: turnAuthority,
    userInput: clientMsg.user_input,
    attachments,
  } : null;
  const turnApplicationContext = {
    ...session,
    currentWorkspaceId: manager.workspaceId,
    currentThreadId: threadId,
    projectRoot: turnAuthority?.canonicalRoot || manager.projectRoot || projectRoot,
    wire,
    pendingAgentTurnAuthority: turnAuthority,
    pendingTurnId: turnId,
    pendingUserInput: clientMsg.user_input,
    pendingAttachments: [...attachments],
    currentTurn: null,
    assistantParts: [],
    hasToolCalls: false,
    toolArgs: {},
    toolNamesById: {},
    bouncedToolCalls: new Set(),
  };

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
      projectRoot: turnAuthority?.canonicalRoot || projectRoot,
      scope: SCOPE,
      threadId,
      acceptedUserInput: clientMsg.user_input,
      attachments,
    });

    const drainId = generateDrainId();
    const drainControl = createCanonicalDrainControl({
      drainId,
      runtimeKey,
      touchThreadSession: () => manager.touchSession?.(threadId),
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
      if (typeof handleCanonicalHarnessEvent.drainHarnessEvents === 'function') {
        await handleCanonicalHarnessEvent.drainHarnessEvents(wire._sendMessage(harnessInput, {}), ws, {
          drainContext,
          turnAuthority,
          turnApplicationContext,
          finalizeOnError: false,
        });
      } else {
        for await (const event of wire._sendMessage(harnessInput, {})) {
          await handleCanonicalHarnessEvent(event, ws, drainContext);
        }
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
          await handleCanonicalHarnessEvent({
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
    } finally {
      if (acceptedPrompt) clearAcceptedPromptIfOwned(session, acceptedPrompt);
      else {
        if (session.pendingTurnId === turnId) session.pendingTurnId = null;
        if (session.pendingAgentTurnAuthority === turnAuthority) {
          session.pendingAgentTurnAuthority = null;
        }
      }
      releaseAgentTurnAuthorityRef(turnAuthority);
      disposeTurnApplicationContext(turnApplicationContext);
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
  const wire = capturedDrain
    ? null
    : getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);

  const authority = getAgentTurnAuthorityRef({
    workspaceId: manager.workspaceId,
    threadId,
    turnId: liveTurn.turnId,
  });
  const stopIdentity = authority || {
    workspaceId: manager.workspaceId,
    threadId,
    turnId: liveTurn.turnId,
  };
  const pendingAuthority = session.pendingAgentTurnAuthority;
  const pendingBelongsToStop = session.pendingTurnId === liveTurn.turnId
    && (authority
      ? pendingAuthority === authority
      : (!pendingAuthority
        ? session.currentThreadId === threadId
        : pendingAuthority.workspaceId === manager.workspaceId
          && pendingAuthority.threadId === threadId
          && pendingAuthority.turnId === liveTurn.turnId));
  const pendingOwnership = pendingBelongsToStop ? {
    turnId: liveTurn.turnId,
    authority: pendingAuthority,
    userInput: session.pendingUserInput,
    attachments: session.pendingAttachments,
  } : null;
  const hasOwnedFinalizer = typeof handleCanonicalHarnessEvent?.finalizeTurn === 'function';
  const canReconstructWithoutNavigationLoss = !hasOwnedFinalizer
    && (!session.currentThreadId || session.currentThreadId === threadId)
    && (!session.currentTurn || session.currentTurn.id === liveTurn.turnId);
  if (canReconstructWithoutNavigationLoss
    && (!session.currentTurn || session.currentTurn.id !== liveTurn.turnId)) {
    if (!session.currentThreadId) session.currentThreadId = threadId;
    session.currentTurn = {
      id: liveTurn.turnId,
      text: liveTurn.fullText || '',
      userInput: liveTurn.userInput || '',
    };
    session.assistantParts = Array.isArray(liveTurn.parts) ? liveTurn.parts : [];
    session.hasToolCalls = session.assistantParts.some(part => part.type === 'tool_call');
  }
  if (session.currentTurn?.id === liveTurn.turnId && !session.currentTurn.authority && authority) {
    Object.defineProperty(session.currentTurn, 'authority', {
      value: authority,
      enumerable: false,
    });
  }
  const baseTurnOwnership = captureBaseTurnOwnership(session, {
    workspaceId: manager.workspaceId,
    threadId,
    turnId: liveTurn.turnId,
    authority,
  });

  threadRuntimeManager.markState(runtimeKey, RUNTIME_STATES.STOPPING);

  let finalization = Promise.resolve();
  if (handleCanonicalHarnessEvent) {
    try {
      const terminalEvent = {
        type: 'turn_end',
        reason: 'interrupted',
        partial: true,
      };
      if (hasOwnedFinalizer) {
        finalization = Promise.resolve(
          handleCanonicalHarnessEvent.finalizeTurn(
            terminalEvent,
            ws,
            stopIdentity,
            null,
            capturedDrain
              ? { route: capturedDrain.routeContext, control: capturedDrain.control }
              : null,
          ),
        );
      } else if (capturedDrain) {
        finalization = Promise.resolve(handleCanonicalHarnessEvent({
          ...terminalEvent,
        }, ws, { route: capturedDrain.routeContext, control: capturedDrain.control }));
      } else {
        // No active drain record: keep the historical 2-arg call shape so the
        // applier's defensive no-drain-context drop behaves unchanged.
        finalization = Promise.resolve(handleCanonicalHarnessEvent(terminalEvent, ws));
      }
    } catch {
      // A terminal publication failure must not escape into the router's raw
      // catch or prevent the bound harness and runtime from being cleaned up.
      reportInterruptedSynthesisFailure(threadId, capturedDrain?.drainId);
    }
  }

  if (capturedDrain) {
    await finalization.catch(() => {});
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
      releaseAgentTurnAuthorityRef(authority);
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
    if (pendingOwnership) clearAcceptedPromptIfOwned(session, pendingOwnership);
    clearBaseTurnIfOwned(session, {
      threadId,
      turnId: liveTurn.turnId,
      authority,
    }, baseTurnOwnership);
    releaseAgentTurnAuthorityRef(authority);
    // Bound path: session.wire can no longer be identity-compared to the
    // stopped harness; a stale reference is discarded by ensureReadyRuntime's
    // killed-wire logic instead.
    return;
  }

  // No active drain record (pre-claim stop edge): keep the historical legacy
  // wire lookup + unconditional cold exactly as before Slice D.
  let stopping = Promise.resolve();
  if (wire) {
    stopping = stopWire(wire, threadId).then(() => {
      if (session.wire === wire) session.wire = null;
    }).catch(() => reportLegacyStopFailure(threadId));
  }
  await Promise.allSettled([finalization, stopping]);
  if (pendingOwnership) clearAcceptedPromptIfOwned(session, pendingOwnership);
  clearBaseTurnIfOwned(session, {
    threadId,
    turnId: liveTurn.turnId,
    authority,
  }, baseTurnOwnership);
  releaseAgentTurnAuthorityRef(authority);
  threadRuntimeManager.markCold(runtimeKey);
}

module.exports = {
  acceptPromptThroughRuntime,
  ensureReadyRuntime,
  getRuntimeKey,
  stopRuntimeTurn,
  warmRuntimeForIntent,
};
