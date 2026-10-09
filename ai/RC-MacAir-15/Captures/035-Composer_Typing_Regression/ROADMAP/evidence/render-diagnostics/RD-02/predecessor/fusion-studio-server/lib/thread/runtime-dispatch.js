/** Own the claimed interactive iterator lifecycle and its terminal boundary. */
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { randomUUID: generateDrainId } = require('crypto');
const { resolveScope } = require('../chat-scope');
const { terminateProviderProcessAndWait } = require('./provider-termination');
const { createCanonicalRouteContext, createCanonicalDrainControl } = require('./canonical-drain-context');
const { createAgentTurnAuthorityRef, releaseAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');
const { projectSessionForTurn, disposeTurnApplicationContext, clearAcceptedPromptIfOwned } = require('./turn-application-context');
const { stopRuntimeTurn } = require('./runtime-stop');
const { sendRuntimeError, reportAcceptedExecutionFailure } = require('./runtime-response');
const { isHarnessRuntimeError, HARNESS_RUNTIME_ERROR_MESSAGES } = require('../harness/errors');
const { normalizeTurnTerminalError, TURN_TERMINAL_ERROR_CATALOG } = require('./turn-terminal-error');
const { persistDiagnosticReport } = require('./harness-diagnostic-service');
const { persistTerminalDiagnosticSafely } = require('./terminal-diagnostic-boundary');
const promptSubmission = require('./prompt-submission-service');
const SCOPE = 'project';

function markReadyIfRuntimeStillActive(runtimeKey, ownership) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.IN_FLIGHT) {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
  }
}

async function dispatchAcceptedTurn({ ws, session, sessions, thread, threadId, requestId, clientMsg, wire,
  runtimeKey, ownership: admissionOwnership, workspaceBinding, projectRoot, attachments, harnessInput, turnId, receiptIdentity,
  failAcceptedBeforeDispatch, handleCanonicalHarnessEvent }) {
  let turnAuthority = null;
  let authorityAttempted = false;
  try {
    const harnessId = thread.entry?.harnessId;
    if (!harnessId || wire._harnessId !== harnessId) throw new Error('resolved harness identity mismatch');
    authorityAttempted = true;
    turnAuthority = await createAgentTurnAuthorityRef({
      workspaceId: sessions.workspaceId,
      threadId,
      turnId,
      harnessId,
      provider: wire._provider || harnessId,
      workspaceRoot: sessions.projectRoot,
    });
  } catch {
    turnAuthority = null;
    if (authorityAttempted) console.warn('[AgentProvenance] agent_turn_authority_unavailable');
  }
  if (!threadRuntimeManager.isOwnershipCurrent(admissionOwnership)) {
    releaseAgentTurnAuthorityRef(turnAuthority);
    await failAcceptedBeforeDispatch('runtime_replaced');
    return;
  }
  session.pendingTurnId = turnId;
  session.pendingAgentTurnAuthority = turnAuthority;

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
    ...projectSessionForTurn(session),
    currentWorkspaceId: sessions.workspaceId,
    currentThreadId: threadId,
    projectRoot: turnAuthority?.canonicalRoot || sessions.projectRoot || projectRoot,
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
  const clearPending = () => {
    if (acceptedPrompt) clearAcceptedPromptIfOwned(session, acceptedPrompt);
    else if (session.pendingTurnId === turnId && session.pendingAgentTurnAuthority === turnAuthority) {
      session.pendingTurnId = null;
      session.pendingAgentTurnAuthority = null;
    }
  };
  let claimedRecord = null;
  let ownership = admissionOwnership;
  try {
    const routeContext = createCanonicalRouteContext({
      workspaceId: sessions.workspaceId,
      workspace: resolveScope({ currentWorkspaceId: session.currentWorkspaceId, currentViewId: null }),
      projectRoot: turnAuthority?.canonicalRoot || projectRoot,
      workspaceEpoch: workspaceBinding.workspaceEpoch,
      scope: SCOPE,
      threadId,
      acceptedUserInput: clientMsg.user_input,
      attachments,
    });

    const drainId = generateDrainId();
    const drainControl = createCanonicalDrainControl({
      drainId,
      runtimeKey,
      touchThreadSession: () => sessions.touchSession?.(threadId),
      stopHarness: async () => {
        try {
          await terminateProviderProcessAndWait(wire, 2_000, 1_000);
        } catch {
          throw new Error('Provider termination failed');
        }
      },
    });

    claimedRecord = threadRuntimeManager.claimActiveDrain(runtimeKey, drainControl, routeContext);
    ownership = threadRuntimeManager.captureOwnership(runtimeKey);
  } catch {
    await failAcceptedBeforeDispatch('drain_claim_failed');
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    releaseAgentTurnAuthorityRef(turnAuthority);
    clearPending();
    disposeTurnApplicationContext(turnApplicationContext);
    reportAcceptedExecutionFailure(ws, threadId, requestId);
    return;
  }

  const drainId = claimedRecord.drainId;
  let dispatchClaimed = false;
  try {
    dispatchClaimed = await promptSubmission.claimDispatch(receiptIdentity);
  } catch (_error) { /* a failed durable claim forbids external dispatch */ }
  if (!dispatchClaimed || !threadRuntimeManager.isOwnershipCurrent(ownership)) {
    await failAcceptedBeforeDispatch('dispatch_claim_failed');
    threadRuntimeManager.clearActiveDrainIfCurrent(runtimeKey, drainId);
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    clearPending();
    releaseAgentTurnAuthorityRef(turnAuthority);
    disposeTurnApplicationContext(turnApplicationContext);
    reportAcceptedExecutionFailure(ws, threadId, requestId);
    return;
  }
  const drainContext = { route: claimedRecord.routeContext, control: claimedRecord.control };
  function isDrainSuperseded() {
    return !threadRuntimeManager.isOwnershipCurrent(ownership);
  }

  const drainCompletion = (async () => {
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
      markReadyIfRuntimeStillActive(runtimeKey, ownership);
    } catch (err) {
      if (isDrainSuperseded()) {
        console.warn('[ThreadRuntime] Ignoring superseded iterator failure', {
          threadId,
          drainId,
          marker: 'SUPERSEDED_ITERATOR_FAILURE',
        });
        return;
      }
      try {
        await promptSubmission.noteClaimedFailure(receiptIdentity, 'provider_failed');
      } catch (_error) { /* claimed dispatch stays unknown after restart */ }
      const safeTerminalError = normalizeTurnTerminalError(err);
      const boundTurnId = threadRuntimeManager.resolveBoundTurnId(runtimeKey, drainId);
      if (boundTurnId) {
        let diagnosticId = null;
        if (isHarnessRuntimeError(err) && err.candidate) {
          diagnosticId = await persistTerminalDiagnosticSafely(
            persistDiagnosticReport,
            {
              workspaceId: sessions.workspaceId,
              projectRoot: runtimeKey.projectRoot,
              workspaceEpoch: runtimeKey.workspaceEpoch,
              threadId,
              turnId: boundTurnId,
            },
            err.candidate,
          );
        }
        try {
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
      if (isDrainSuperseded()) return;
      markReadyIfRuntimeStillActive(runtimeKey, ownership);
      console.error('[WS] Harness sendMessage failed', {
        threadId,
        drainId,
        marker: safeTerminalError.code,
      });
      if (isHarnessRuntimeError(err) && err.code === 'HARNESS_AUTHENTICATION_FAILED') {
        ws.send(JSON.stringify({
          type: 'auth_error',
          scope: SCOPE,
          workspaceId: sessions.workspaceId,
          threadId,
          recoverable: true,
          message: HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_AUTHENTICATION_FAILED,
          code: 'accepted_execution_failed',
          ...(requestId ? { requestId } : {}),
        }));
      } else {
        sendRuntimeError(
          ws,
          TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED.message,
          threadId,
          true,
          requestId,
          'accepted_execution_failed',
        );
      }
    } finally {
      if (!isDrainSuperseded() && threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.STOPPING) {
        threadRuntimeManager.clearActiveDrainIfCurrent(runtimeKey, drainId);
      }
      clearPending();
      releaseAgentTurnAuthorityRef(turnAuthority);
      disposeTurnApplicationContext(turnApplicationContext);
    }
  })();
  threadRuntimeManager.bindActiveDrainLifecycle(runtimeKey, drainId, {
    completion: drainCompletion,
    retire: () => stopRuntimeTurn({
      ws,
      session,
      clientMsg: { threadId },
      handleCanonicalHarnessEvent,
      allowInactiveDrain: true,
      returnOutcome: true,
      runtimeBinding: Object.freeze({ sessions, wire, runtimeKey, drainId, ownership }),
    }),
  });
}


module.exports = { dispatchAcceptedTurn };
