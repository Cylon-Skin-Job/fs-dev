/** Stop only the captured runtime and provider owner across finalization. */
const { captureStopTarget, captureStopDeliveryGuard } = require('./runtime-session-binding');
const { retainTimedOutSavedDelivery } = require('../wire/terminal-saved-delivery');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { getWireForThread, unregisterWire } = require('../wire/process-manager');
const { terminateProviderProcessAndWait } = require('./provider-termination');
const { getRuntimeKey } = require('./runtime-identity');
const { getAgentTurnAuthorityRef, releaseAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');
const { clearAcceptedPromptIfOwned, captureBaseTurnOwnership, clearBaseTurnIfOwned } = require('./turn-application-context');
const { sendRuntimeError, reportHarnessStopFailure, reportInterruptedSynthesisFailure, reportLegacyStopFailure, reportSessionRetirementFailure } = require('./runtime-response');

async function completeReservedSession(manager, threadId, retiringSession) {
  if (!retiringSession || typeof manager.completeStoppedSession !== 'function') return true;
  try {
    return await manager.completeStoppedSession(
      threadId,
      retiringSession.wireProcess,
    );
  } catch {
    return false;
  }
}

async function stopWire(wire, threadId, runtimeKey, current) {
  await terminateProviderProcessAndWait(wire, 2_000, 1_000);
  if (current()) unregisterWire(threadId, runtimeKey, wire);
}

async function stopOwnedRuntimeTurn({
  ws,
  session,
  clientMsg,
  handleCanonicalHarnessEvent,
  allowInactiveDrain = false,
  returnOutcome = false,
  runtimeBinding = null,
  reserveFinalization,
  deferredDelivery,
}) {
  const outcome = value => (returnOutcome ? value : undefined);
  const threadId = clientMsg.threadId;
  const manager = runtimeBinding?.sessions || captureStopTarget(ws);
  if (!threadId || !manager) {
    sendRuntimeError(ws, 'No active thread', threadId, false);
    return;
  }

  const managedSessionForIdentity = typeof manager.getSession === 'function'
    ? manager.getSession(threadId)
    : null;
  const runtimeKey = runtimeBinding?.runtimeKey || getRuntimeKey(
    manager,
    threadId,
    managedSessionForIdentity?.workspaceEpoch || session.workspaceEpoch,
  );
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  const activeDrain = threadRuntimeManager.getActiveDrain(runtimeKey);
  const ownership = runtimeBinding?.ownership || threadRuntimeManager.captureOwnership(runtimeKey);
  const current = () => threadRuntimeManager.isOwnershipCurrent(ownership);
  if (runtimeBinding && (!current() || activeDrain?.drainId !== runtimeBinding.drainId)) return outcome(false);
  if (state === RUNTIME_STATES.STOPPING) return outcome(false);
  if (state !== RUNTIME_STATES.IN_FLIGHT && !(allowInactiveDrain && activeDrain)) {
    sendRuntimeError(ws, 'Thread runtime is not currently streaming.', threadId, true);
    return outcome(false);
  }

  const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
  if (!liveTurn && !(allowInactiveDrain && activeDrain)) {
    sendRuntimeError(ws, 'No live turn is available to stop.', threadId, true);
    return outcome(false);
  }

  const registeredWire = getWireForThread(threadId, runtimeKey);
  const managedSessionBeforeStop = typeof manager.getSession === 'function'
    ? manager.getSession(threadId)
    : null;
  if (runtimeBinding?.wire && managedSessionBeforeStop?.wireProcess
    && runtimeBinding.wire !== managedSessionBeforeStop.wireProcess) {
    sendRuntimeError(ws, 'Thread runtime is not currently streaming.', threadId, true);
    return outcome(false);
  }
  if (registeredWire && managedSessionBeforeStop?.wireProcess
    && registeredWire !== managedSessionBeforeStop.wireProcess) {
    sendRuntimeError(ws, 'Thread runtime is not currently streaming.', threadId, true);
    return outcome(false);
  }
  const providerOwnerWs = managedSessionBeforeStop?.ws || ws;
  const retiringSession = typeof manager.beginSessionRetirement === 'function'
    ? manager.beginSessionRetirement(threadId, providerOwnerWs)
    : null;
  if (typeof manager.beginSessionRetirement === 'function' && !retiringSession) {
    sendRuntimeError(ws, 'Thread runtime is not currently streaming.', threadId, true);
    return outcome(false);
  }
  if (retiringSession) reserveFinalization(manager, threadId, retiringSession);

  if (!liveTurn) {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);
    try {
      await activeDrain.control.stopHarness();
    } catch {
      reportHarnessStopFailure(threadId, activeDrain.drainId);
      return outcome(false);
    }
    if (!current()) return outcome(false);
    if (registeredWire) unregisterWire(threadId, runtimeKey, registeredWire);
    threadRuntimeManager.clearActiveDrainIfCurrent(runtimeKey, activeDrain.drainId);
    if (!await completeReservedSession(manager, threadId, retiringSession)) {
      reportSessionRetirementFailure(threadId);
      return outcome(false);
    }
    if (!current()) return outcome(false);
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
    return outcome(true);
  }
  const capturedDrain = activeDrain
    ? { drainId: activeDrain.drainId, routeContext: activeDrain.routeContext, control: activeDrain.control }
    : null;
  const wire = capturedDrain
    ? null
    : retiringSession?.wireProcess
      || getWireForThread(threadId, runtimeKey)
      || (session.currentThreadId === threadId ? session.wire : null);

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

  threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);

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
            providerOwnerWs,
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
        }, providerOwnerWs, { route: capturedDrain.routeContext, control: capturedDrain.control }));
      } else {
        finalization = Promise.resolve(handleCanonicalHarnessEvent(terminalEvent, ws));
      }
    } catch {
      reportInterruptedSynthesisFailure(threadId, capturedDrain?.drainId);
    }
  }

  // Terminal persistence is asynchronous on the bus. Keep this exact wire
  // registered until its saved acknowledgement has had a chance to deliver.
  // Legacy unqualified callers have no tracked exact-identity bus effects.
  await finalization.catch(() => {});
  if (!current()) { releaseAgentTurnAuthorityRef(authority); return outcome(false); }
  if (typeof runtimeKey.workspaceEpoch === 'string' && runtimeKey.workspaceEpoch) {
    const effects = await require('../event-bus').drainEventEffects({
      ...runtimeKey, turnId: liveTurn.turnId,
    }, { timeoutMs: 3_000 });
    if (!current()) { releaseAgentTurnAuthorityRef(authority); return outcome(false); }
    if (!effects.drained) {
      reportInterruptedSynthesisFailure(threadId, capturedDrain?.drainId);
      const connectionCurrent = captureStopDeliveryGuard(providerOwnerWs, runtimeKey);
      deferredDelivery.cancel = retainTimedOutSavedDelivery({
        identity: { ...runtimeKey, turnId: liveTurn.turnId }, ws: providerOwnerWs,
        isCurrent: () => current() && connectionCurrent()
          && (!manager.getSession?.(threadId) || manager.getSession(threadId) === retiringSession),
      });
      // Persistence must not pin active computation or admission. Terminate
      // the exact provider below; only genuine late ACK delivery is retained.
    }
  }

  if (capturedDrain) {
    if (!current()) { releaseAgentTurnAuthorityRef(authority); return outcome(false); }
    let providerStopped = false;
    try {
      await capturedDrain.control.stopHarness();
      providerStopped = true;
    } catch {
      reportHarnessStopFailure(threadId, capturedDrain.drainId);
    }

    if (!providerStopped) {
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);
      releaseAgentTurnAuthorityRef(authority);
      return outcome(false);
    }
    const superseded = !current();
    if (superseded) {
      releaseAgentTurnAuthorityRef(authority);
      console.warn(`[ThreadRuntime] Drain ${capturedDrain.drainId} superseded during stop; cleanup is a diagnostic no-op`);
      return outcome(false);
    }
    if (registeredWire) unregisterWire(threadId, runtimeKey, registeredWire);
    threadRuntimeManager.clearActiveDrainIfCurrent(runtimeKey, capturedDrain.drainId);
    if (!await completeReservedSession(manager, threadId, retiringSession)) {
      reportSessionRetirementFailure(threadId);
      releaseAgentTurnAuthorityRef(authority);
      return outcome(false);
    }
    if (!current()) { releaseAgentTurnAuthorityRef(authority); return outcome(false); }
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.STOPPING) {
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
    }
    if (pendingOwnership) clearAcceptedPromptIfOwned(session, pendingOwnership);
    clearBaseTurnIfOwned(session, {
      threadId,
      turnId: liveTurn.turnId,
      authority,
    }, baseTurnOwnership);
    releaseAgentTurnAuthorityRef(authority);
    deferredDelivery.keep = true;
    return outcome(true);
  }
  let stopping = Promise.resolve();
  if (wire) {
    stopping = stopWire(wire, threadId, runtimeKey, current).then(() => {
      if (current() && session.wire === wire) session.wire = null;
    });
  }
  const [, stopResult] = await Promise.allSettled([finalization, stopping]);
  if (!current()) { releaseAgentTurnAuthorityRef(authority); return outcome(false); }
  if (pendingOwnership) clearAcceptedPromptIfOwned(session, pendingOwnership);
  clearBaseTurnIfOwned(session, {
    threadId,
    turnId: liveTurn.turnId,
    authority,
  }, baseTurnOwnership);
  releaseAgentTurnAuthorityRef(authority);
  if (stopResult.status === 'rejected') {
    reportLegacyStopFailure(threadId);
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);
    return outcome(false);
  }
  if (!await completeReservedSession(manager, threadId, retiringSession)) {
    reportSessionRetirementFailure(threadId);
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);
    return outcome(false);
  }
  if (!current()) return outcome(false);
  threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
  deferredDelivery.keep = true;
  return outcome(true);
}


async function stopRuntimeTurn(options) {
  let release = () => {};
  const deferredDelivery = { cancel: null, keep: false };
  try {
    return await stopOwnedRuntimeTurn({ ...options, deferredDelivery, reserveFinalization(manager, threadId, session) {
      const token = {};
      session.stopFinalization = token;
      release = () => {
        if (session.stopFinalization !== token) return;
        delete session.stopFinalization;
        manager.reconcileProviderExit?.(threadId, session);
      };
    } });
  } finally {
    if (!deferredDelivery.keep) deferredDelivery.cancel?.();
    release();
  }
}

module.exports = { stopRuntimeTurn };
