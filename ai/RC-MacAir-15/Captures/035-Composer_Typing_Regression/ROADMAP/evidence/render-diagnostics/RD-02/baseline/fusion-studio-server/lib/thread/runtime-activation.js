/** Warm one exact interactive runtime under the session admission lease. */
const { captureRuntimeTarget, activationBindingIsCurrent } = require('./runtime-session-binding');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { attachClientToWire, getWireForThread, unregisterWire } = require('../wire/process-manager');
const { terminateProviderProcessAndWait } = require('./provider-termination');
const { sendRuntimeError, reportWarmupFailure, reportThreadLookupFailure } = require('./runtime-response');
const { getRuntimeKey } = require('./runtime-identity');
const SCOPE = 'project';

async function ensureReadyRuntime(options) {
  const { withSessionAdmission } = require('../thread-groups/session-transactions');
  return withSessionAdmission(options.runtimeKey.workspaceId, options.threadId,
    () => ensureReadyRuntimeWithinLease(options));
}

async function ensureReadyRuntimeWithinLease({
  ws,
  session,
  wireLifecycle,
  projectRoot,
  spawnAndSetupWire,
  runtimeKey,
  threadId,
  workspaceBinding,
  target = captureRuntimeTarget(ws, session, projectRoot),
  reserveForPrompt = false,
  suppressBusyError = false,
  requestId,
}) {
  const ownedRuntime = threadRuntimeManager.adoptRuntimeIdentity(runtimeKey);
  if (!ownedRuntime) {
    if (!suppressBusyError) {
      sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', threadId, true, requestId);
    }
    return null;
  }
  const ownership = threadRuntimeManager.captureOwnership(runtimeKey);
  const current = () => threadRuntimeManager.isOwnershipCurrent(ownership)
    && activationBindingIsCurrent(ws, activationBinding);
  const state = ownedRuntime.state;
  const activationBinding = workspaceBinding || target.binding;
  if (!activationBindingIsCurrent(ws, activationBinding)) {
    reportWarmupFailure(ws, threadId, requestId);
    return null;
  }

  const ownReadyRuntime = async (wire) => {
    if (!wire || !current()) return null;
    if (!target.ownsSession(threadId, wire)) await target.activate(threadId, wire);
    if (!current()) throw new Error('Runtime changed during activation');
    attachClientToWire(threadId, wire, projectRoot, ws, {
      workspaceId: session.currentWorkspaceId,
      projectRoot: runtimeKey.projectRoot,
      workspaceEpoch: runtimeKey.workspaceEpoch,
      viewId: null,
    });
    session.wire = wire;
    session.currentThreadId = threadId;
    session.currentScope = SCOPE;
    session.currentViewId = null;
    return wire;
  };

  const finishReadyRuntime = async (wire) => {
    if (!wire || !current()) return null;
    if (reserveForPrompt) {
      if (threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.READY) {
        if (!suppressBusyError) {
          sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', threadId, true, requestId);
        }
        return null;
      }
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.IN_FLIGHT);
      return { wire, ownership };
    }
    try {
      return await ownReadyRuntime(wire);
    } catch {
      if (reserveForPrompt) threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
      throw new Error('Thread runtime ownership transfer failed');
    }
  };

  if (state === RUNTIME_STATES.READY) {
    const readyWire = getWireForThread(threadId, runtimeKey)
      || (session.currentThreadId === threadId ? session.wire : null);
    if (readyWire && !readyWire.killed) {
      try {
        return await finishReadyRuntime(readyWire);
      } catch {
        reportWarmupFailure(ws, threadId, requestId);
        return null;
      }
    }
    if (readyWire?.killed) {
      console.warn(`[ThreadRuntime] Discarding closed ready wire for thread ${threadId}; warming a replacement`);
      const managedSession = target.sessions.getSession?.(threadId);
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);
      if (managedSession?.wireProcess === readyWire) {
        await target.sessions.closeSession(threadId);
      } else {
        await terminateProviderProcessAndWait(readyWire);
      }
      if (getWireForThread(threadId, runtimeKey) === readyWire) {
        unregisterWire(threadId, runtimeKey, readyWire);
      }
      if (session.wire === readyWire) session.wire = null;
    }
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
  }

  if (state === RUNTIME_STATES.WARMING) {
    try {
      const warmedWire = await threadRuntimeManager.getWarmPromise(runtimeKey);
      const readyWire = warmedWire || getWireForThread(threadId, runtimeKey)
        || (session.currentThreadId === threadId ? session.wire : null);
      return finishReadyRuntime(readyWire);
    } catch {
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
      reportWarmupFailure(ws, threadId, requestId);
      return null;
    }
  }

  if (state === RUNTIME_STATES.IN_FLIGHT || state === RUNTIME_STATES.STOPPING) {
    if (!suppressBusyError) {
      sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', threadId, true, requestId);
    }
    return null;
  }
  if (!current()) return null;
  const warmPromise = Promise.resolve().then(() => {
    if (!current()) throw new Error('Runtime changed before activation');
    return spawnAndSetupWire({
    ws,
    session,
    wireLifecycle,
    threadId,
    projectRoot,
    expectedBinding: activationBinding,
  });
  });
  threadRuntimeManager.markWarming(runtimeKey, warmPromise);

  try {
    const wire = await warmPromise;
    if (!current()) return null;
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    return finishReadyRuntime(wire);
  } catch {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
    reportWarmupFailure(ws, threadId, requestId);
    return null;
  } finally {
    threadRuntimeManager.clearOwnedWarmPromise(ownership, warmPromise);
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
  const target = captureRuntimeTarget(ws, session, projectRoot);
  if (!threadId || !target) {
    sendRuntimeError(ws, 'No active thread', threadId, false);
    return;
  }
  const workspaceBinding = target.binding;
  if (!activationBindingIsCurrent(ws, workspaceBinding)) {
    sendRuntimeError(ws, 'Workspace unavailable for thread activation', threadId, false);
    return;
  }

  let thread;
  try {
    thread = await target.getThread(threadId);
  } catch {
    reportThreadLookupFailure(ws, threadId);
    return;
  }
  if (!thread) {
    sendRuntimeError(ws, `Thread not found: ${threadId}`, threadId, false);
    return;
  }
  if (!activationBindingIsCurrent(ws, workspaceBinding)) {
    sendRuntimeError(ws, 'Workspace unavailable for thread activation', threadId, false);
    return;
  }

  const runtimeKey = getRuntimeKey(target, threadId, workspaceBinding.workspaceEpoch);
  await ensureReadyRuntime({
    ws,
    session,
    wireLifecycle,
    projectRoot,
    spawnAndSetupWire,
    runtimeKey,
    threadId,
    workspaceBinding,
    target,
    suppressBusyError: true,
  });
}


module.exports = { ensureReadyRuntime, warmRuntimeForIntent };
