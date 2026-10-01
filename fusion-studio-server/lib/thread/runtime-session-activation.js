/** Transfers one exact provider session after serialized transport admission. */
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { attachClientToWire } = require('../wire/process-manager');
async function activateSession({ sessions, runtimeKey, threadId, wire, ws,
  isCurrent, publishActivation }) {
  if (!threadRuntimeManager.adoptRuntimeIdentity(runtimeKey)) throw new Error('Runtime unavailable');
  const ownership = threadRuntimeManager.captureOwnership(runtimeKey);
  const resourceRuntime = threadRuntimeManager.getRuntimeForResource(runtimeKey);
  if (resourceRuntime?.state === RUNTIME_STATES.STOPPING
    || sessions.getSession?.(threadId)?.state === 'stopping') {
    throw new Error('Thread provider retirement is still pending');
  }
  const thread = await sessions.getThread?.(threadId);
  if (thread === null || thread === undefined) {
    throw new Error('Thread unavailable during activation');
  }
  if (!isCurrent() || !threadRuntimeManager.isOwnershipCurrent(ownership)) {
    throw new Error('Workspace changed during thread activation');
  }
  if (threadRuntimeManager.getRuntimeForResource(runtimeKey)?.state === RUNTIME_STATES.STOPPING
    || sessions.getSession?.(threadId)?.state === 'stopping') {
    throw new Error('Thread provider retirement is still pending');
  }
  const previousTarget = typeof sessions.getSession === 'function'
    ? sessions.getSession(threadId)
    : null;
  const previousTargetOwner = previousTarget ? {
    ws: previousTarget.ws || null,
    workspaceEpoch: previousTarget.workspaceEpoch || null,
  } : null;
  await sessions.openSession(threadId, wire, ws, {
    workspaceEpoch: runtimeKey.workspaceEpoch || null,
  });
  const acceptedSession = typeof sessions.getSession === 'function'
    ? sessions.getSession(threadId)
    : null;
  if (acceptedSession
    && (acceptedSession.ws !== ws || acceptedSession.wireProcess !== wire)) {
    throw new Error('Thread activation ownership changed');
  }
  const rollbackAcceptedTarget = async () => {
    const currentTarget = typeof sessions.getSession === 'function'
      ? sessions.getSession(threadId)
      : null;
    if (!currentTarget || currentTarget !== acceptedSession
      || currentTarget.ws !== ws || currentTarget.wireProcess !== wire) return false;
    if (previousTarget === acceptedSession && previousTargetOwner
      && typeof sessions.restoreSessionOwner === 'function') {
      return sessions.restoreSessionOwner(
        threadId, acceptedSession, wire, ws, previousTargetOwner,
      );
    }
    await sessions.closeSession(threadId);
    return true;
  };
  if (!isCurrent() || !threadRuntimeManager.isOwnershipCurrent(ownership)) {
    await rollbackAcceptedTarget();
    throw new Error('Workspace changed during thread activation');
  }

  // Activation changes the selected provider reference, not another session's
  // lifetime. Same-workspace peers may stream concurrently on this connection.
  const targetExited = wire?.killed
    || (wire?.exitCode !== undefined && wire.exitCode !== null)
    || (wire?.signalCode !== undefined && wire.signalCode !== null);
  if (targetExited) {
    await rollbackAcceptedTarget();
    throw new Error('Thread activation target exited before publication');
  }
  if (!threadRuntimeManager.isOwnershipCurrent(ownership)) {
    await rollbackAcceptedTarget();
    throw new Error('Thread runtime ownership changed during activation');
  }
  attachClientToWire(threadId, wire, runtimeKey.projectRoot, ws, {
    workspaceId: runtimeKey.workspaceId,
    projectRoot: runtimeKey.projectRoot,
    workspaceEpoch: runtimeKey.workspaceEpoch,
    viewId: null,
  });
  publishActivation();
}
module.exports = { activateSession };
