/** Warm an exact headless provider under its caller-owned admission lease. */
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { spawnThreadWire } = require('../harness/compat');
const { attachClientToWire, getWireForThread } = require('../wire/process-manager');
const { terminateProviderProcessAndWait } = require('./session-manager');
function getDeferReason(state) {
  if (state === RUNTIME_STATES.WARMING) return 'warming';
  if (state === RUNTIME_STATES.IN_FLIGHT) return 'in_flight';
  if (state === RUNTIME_STATES.STOPPING) return 'stopping';
  return null;
}

async function warmAutomationRuntime(target, sessions, runtimeKey, ownership) {
  const scopeContext = {
    workspaceId: target.workspaceId,
    projectRoot: target.projectRoot,
    workspaceEpoch: target.workspaceEpoch,
    viewId: target.viewId,
  };
  const current = () => threadRuntimeManager.isOwnershipCurrent(ownership);
  const warmPromise = Promise.resolve().then(async () => {
    if (!current()) throw new Error('Runtime changed before automation warmup');
    const wire = spawnThreadWire(target.threadId, target.projectRoot, scopeContext);
    try {
      if (wire._harnessPromise) await wire._harnessPromise;
      if (!wire._sendMessage) {
        throw new Error('Wire does not support ACP sendMessage. Legacy wire format has been retired.');
      }
      if (!wire._usesDirectCanonicalEvents) {
        throw new Error('Wire does not support direct canonical event delivery. Legacy wire format has been retired.');
      }
      if (!current()) throw new Error('Runtime changed during automation warmup');
      await sessions.openSession(target.threadId, wire, null, {
        workspaceEpoch: target.workspaceEpoch,
      });
      if (!current()) throw new Error('Runtime changed during automation activation');
      attachClientToWire(target.threadId, wire, target.projectRoot, null, scopeContext);
      return wire;
    } catch (error) {
      const managedSession = typeof sessions.getSession === 'function'
        ? sessions.getSession(target.threadId)
        : null;
      if (managedSession?.wireProcess === wire) {
        await sessions.closeSession(target.threadId);
      } else {
        await terminateProviderProcessAndWait(wire);
      }
      throw error;
    }
  });

  threadRuntimeManager.markWarming(runtimeKey, warmPromise);
  try {
    const wire = await warmPromise;
    if (!current()) throw new Error('Runtime changed during automation warmup');
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    return wire;
  } catch (err) {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
    throw err;
  } finally {
    threadRuntimeManager.clearOwnedWarmPromise(ownership, warmPromise);
  }
}

async function ensureAutomationWire(target, sessions, runtimeKey, ownership) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.READY) {
    const wire = getWireForThread(target.threadId, target);
    if (wire) return { wire, deferReason: null };
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
  } else {
    const deferReason = getDeferReason(state);
    if (deferReason) {
      return { wire: null, deferReason };
    }
  }
  return {
    wire: await warmAutomationRuntime(target, sessions, runtimeKey, ownership),
    deferReason: null,
  };
}

module.exports = { ensureAutomationWire, getDeferReason };
