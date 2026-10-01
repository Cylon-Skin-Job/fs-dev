'use strict';

// Bind eager assistant activation to the exact connection/runtime owner.
const { RUNTIME_STATES, threadRuntimeManager } = require('../thread/thread-runtime-manager');
const ThreadWebSocketHandler = require('../thread/ThreadWebSocketHandler');
const { spawnThreadWire } = require('../harness/compat');
const { attachClientToWire, getWireForThread, unregisterWire } = require('../wire/process-manager');
const { terminateProviderProcessAndWait } = require('../thread/provider-termination');

async function resumeLiveProvider({ ws, session, threadId, binding }) {
    const state = ThreadWebSocketHandler.getState(ws);
    const manager = state?.threadManager;
    const managedSession = typeof manager?.getSession === 'function'
      ? manager.getSession(threadId)
      : null;
    const runtimeKey = {
      workspaceId: binding.workspaceId,
      projectRoot: binding.projectRoot,
      workspaceEpoch: binding.workspaceEpoch,
      scope: 'project',
      threadId,
    };
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.STOPPING
      || managedSession?.state === 'stopping') {
      throw new Error('Thread provider retirement is still pending');
    }
    const registeredWire = getWireForThread(threadId, binding);
    if (managedSession?.wireProcess && registeredWire
      && managedSession.wireProcess !== registeredWire) {
      throw new Error('Thread provider ownership is inconsistent');
    }
    const wire = managedSession?.wireProcess || registeredWire;
    const exited = wire && (
      (wire.exitCode !== undefined && wire.exitCode !== null)
      || (wire.signalCode !== undefined && wire.signalCode !== null)
    );
    if (!wire) return null;
    if (wire.killed || exited) {
      if (managedSession?.wireProcess === wire) {
        await manager.closeSession(threadId);
      }
      if (getWireForThread(threadId, binding) === wire) {
        unregisterWire(threadId, binding, wire);
      }
      return null;
    }

    const ownsExactSession = managedSession?.ws === ws
      && managedSession.wireProcess === wire;
    if (!ownsExactSession) {
      await ThreadWebSocketHandler.activateThreadSession(ws, threadId, wire, binding);
    }
    attachClientToWire(threadId, wire, binding.projectRoot, ws, {
      workspaceId: binding.workspaceId,
      projectRoot: binding.projectRoot,
      workspaceEpoch: binding.workspaceEpoch,
      viewId: null,
    });
    session.wire = wire;
    session.currentThreadId = threadId;
    session.currentScope = 'project';
    session.currentViewId = null;
    ws.send(JSON.stringify({ type: 'wire_ready', threadId, scope: 'project' }));
    return wire;
  }

async function spawnAndSetupWire({
  ws,
  session,
  wireLifecycle,
  threadId,
  projectRoot,
  expectedBinding = null,
}) {
  const { awaitHarnessReady, initializeWire, setupWireHandlers } = wireLifecycle;

  console.log('[WS] Spawning wire for thread:', threadId);
  // CHAT_SCOPE_SPEC: workspace-universal scope — resolveScope() builds the
  // structured workspace string for every chat:* event this wire emits.
  const state = ThreadWebSocketHandler.getState(ws);
  const manager = state?.threadManager;
  if (!manager || manager.projectRoot !== projectRoot
    || manager.workspaceId !== session.currentWorkspaceId) {
    throw new Error('Workspace unavailable for thread activation');
  }
  const binding = {
    state,
    session,
    projectRoot,
    workspaceId: session.currentWorkspaceId,
    workspaceEpoch: session.workspaceEpoch,
  };
  const activationBinding = expectedBinding || binding;
  if (!ThreadWebSocketHandler.isActivationBindingCurrent(ws, activationBinding)) {
    throw new Error('Workspace unavailable for thread activation');
  }
  const scopeContext = {
    workspaceId: session.currentWorkspaceId,
    projectRoot,
    workspaceEpoch: session.workspaceEpoch,
    viewId: null,
  };
  const runtimeKey = Object.freeze({ ...scopeContext, scope: 'project', threadId });
  if (!threadRuntimeManager.adoptRuntimeIdentity(runtimeKey)) throw new Error('Runtime unavailable');
  const ownership = threadRuntimeManager.captureOwnership(runtimeKey);
  const current = () => threadRuntimeManager.isOwnershipCurrent(ownership)
    && ThreadWebSocketHandler.isActivationBindingCurrent(ws, activationBinding);
  const wire = spawnThreadWire(threadId, projectRoot, scopeContext);
  try {
    console.log('[WS] Wire spawned, awaiting harness ready...');
    await awaitHarnessReady(wire);
    if (!current()) throw new Error('Runtime changed during warmup');
    console.log('[WS] Setting up handlers...');
    setupWireHandlers(wire, threadId, scopeContext);
    console.log('[WS] Initializing wire...');
    initializeWire(wire);
    console.log('[WS] Wire initialization complete');

    // Register with the workspace ThreadManager before claiming the session
    // or announcing readiness. A failed/stale activation is rolled back below.
    console.log('[WS] Registering with ThreadManager...');
    await ThreadWebSocketHandler.activateThreadSession(ws, threadId, wire, activationBinding);
    if (!current()) throw new Error('Runtime changed during activation');
    session.wire = wire;
    session.currentThreadId = threadId;
    session.currentScope = 'project';
    session.currentViewId = null;
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    console.log('[WS] ThreadManager registration complete');

    // Fire wire_ready only after the serialized lifecycle owner commits.
    ws.send(JSON.stringify({ type: 'wire_ready', threadId, scope: 'project' }));

    return wire;
  } catch (error) {
    try {
      await ThreadWebSocketHandler.rollbackThreadActivation(
        ws,
        threadId,
        wire,
        activationBinding,
      );
    } catch (_rollbackError) {
      // Registry/provider teardown below remains mandatory even if durable
      // suspension reporting fails during rollback.
    }
    const managedSession = typeof manager.getSession === 'function'
      ? manager.getSession(threadId)
      : null;
    if (wire && managedSession?.wireProcess === wire) {
      // Rollback could not prove provider exit. Keep every ownership surface
      // discoverable and block replacement until a later bounded close wins.
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);
      throw error;
    }
    if (wire) await terminateProviderProcessAndWait(wire);

    // Clear delivery/runtime ownership only after actual child termination.
    if (getWireForThread(threadId, scopeContext) === wire) {
      unregisterWire(threadId, scopeContext, wire);
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
    }
    if (session.wire === wire) {
      session.wire = null;
      if (session.currentThreadId === threadId) {
        session.currentThreadId = null;
        session.currentScope = null;
        session.currentViewId = null;
      }
    }
    throw error;
  }
}

module.exports = { spawnAndSetupWire, resumeLiveProvider };
