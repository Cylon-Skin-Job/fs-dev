/**
 * @module thread-ws-handlers
 * @role Per-connection handlers for all thread: WebSocket messages.
 *
 * Factory — call once per connection inside createClientMessageRouter.
 * Returns a handler map keyed by message type. The router dispatches
 * any clientMsg.type that starts with 'thread:' through this map.
 *
 * Owns the wire-spawn sequence for thread:open-assistant. Thin
 * delegations to ThreadWebSocketHandler for rename/delete/copyLink/
 * touch/search/list.
 */

const {
  RUNTIME_STATES,
  ThreadWebSocketHandler,
  threadRuntimeController,
  threadRuntimeManager,
} = require('../thread');
const { spawnThreadWire } = require('../harness/compat');
const {
  attachClientToWire,
  getWireForThread,
  unregisterWire,
} = require('../wire/process-manager');
const { terminateProviderProcessAndWait } = require('../thread/session-manager');
const { normalizeOpenAssistantRequest } = require('../thread/thread-harness-config-policy');
const {
  denyThreadFork,
  denyThreadMutation,
  requireTrustedThreadAuthority,
} = require('./privileged-thread-guard');
const {
  isWorkspaceOperationLeaseError,
  runWorkspaceOperation,
} = require('./workspace-operation-lease');

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 * @param {{ awaitHarnessReady: Function, initializeWire: Function, setupWireHandlers: Function }} deps.wireLifecycle
 * @param {string} deps.projectRoot
 * @returns {Record<string, (msg: object) => Promise<void>>}
 */
function createThreadWsHandlers({ ws, session, wireLifecycle, projectRoot }) {
  const { awaitHarnessReady, initializeWire, setupWireHandlers } = wireLifecycle;

  const currentBinding = () => {
    const state = ThreadWebSocketHandler.getState(ws);
    const manager = state?.threadManager;
    const currentRoot = session.projectRoot;
    const currentWorkspaceId = session.currentWorkspaceId;
    const currentWorkspaceEpoch = session.workspaceEpoch;
    if (!manager || typeof currentRoot !== 'string' || !currentRoot
      || typeof currentWorkspaceId !== 'string' || !currentWorkspaceId
      || typeof currentWorkspaceEpoch !== 'string' || !currentWorkspaceEpoch
      || (session.workspaceBindingState !== undefined
        && session.workspaceBindingState !== 'active')
      || manager.projectRoot !== currentRoot
      || manager.workspaceId !== currentWorkspaceId) {
      return null;
    }
    return {
      state,
      session,
      projectRoot: currentRoot,
      workspaceId: currentWorkspaceId,
      workspaceEpoch: currentWorkspaceEpoch,
    };
  };

  const runBoundMutation = async (binding, operation) => {
    try {
      return await runWorkspaceOperation(
        ws,
        () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
        operation,
      );
    } catch (error) {
      if (!isWorkspaceOperationLeaseError(error)) throw error;
      denyThreadMutation(ws);
      return null;
    }
  };

  const denyUnavailableRead = () => {
    ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
  };

  const runBoundRead = async (binding, operation) => {
    if (!binding) {
      denyUnavailableRead();
      return null;
    }
    try {
      return await runWorkspaceOperation(
        ws,
        () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
        operation,
      );
    } catch (error) {
      if (!isWorkspaceOperationLeaseError(error)) throw error;
      denyUnavailableRead();
      return null;
    }
  };

  const resumeLiveProvider = async (threadId, binding) => {
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

    const activeThreadId = state && Object.prototype.hasOwnProperty.call(state, 'activatedThreadId')
      ? state.activatedThreadId
      : state?.threadId;
    const ownsExactSession = activeThreadId === threadId
      && managedSession?.ws === ws
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
  };

  return {
    async 'thread:open'(clientMsg) {
      const binding = currentBinding();
      await runBoundRead(binding, () => ThreadWebSocketHandler.handleThreadOpen(ws, clientMsg));
    },

    async 'thread:open-assistant'(clientMsg) {
      // Existing assistant resume marks the thread resumed and advances its
      // durable MRU timestamp, so this route is privileged for both branches.
      // Passive thread:open remains available to untrusted standalone clients.
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const acceptedRequest = normalizeOpenAssistantRequest(clientMsg);
      if (!acceptedRequest) {
        denyThreadMutation(ws);
        return;
      }
      const binding = currentBinding();
      if (!binding) {
        denyThreadMutation(ws);
        return;
      }
      console.log('[WS] thread:open-assistant received, threadId:', acceptedRequest.threadId?.slice(0, 8) || '(new)');

      await runBoundMutation(binding, async () => {
        if (acceptedRequest.threadId) {
          const runtimeKey = {
            workspaceId: binding.workspaceId,
            projectRoot: binding.projectRoot,
            workspaceEpoch: binding.workspaceEpoch,
            scope: 'project',
            threadId: acceptedRequest.threadId,
          };
          const existingSession = binding.state.threadManager.getSession?.(acceptedRequest.threadId);
          if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.STOPPING
            || existingSession?.state === 'stopping') {
            denyThreadMutation(ws);
            return;
          }
        }
        // Dispatcher: create or resume based on whether msg.threadId exists.
        const threadId = await ThreadWebSocketHandler.handleThreadOpenAssistant(ws, acceptedRequest);
        if (!threadId) return;

        // Creation/resume, its response frames, and provider admission are one
        // workspace-leased operation. A queued workspace bind cannot split
        // durable metadata from activation.
        if (await resumeLiveProvider(threadId, binding)) return;
        await spawnAndSetupWire({
          ws,
          session,
          wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
          threadId,
          projectRoot: binding.projectRoot,
          expectedBinding: binding,
        });
      });
    },

    async 'thread:rename'(clientMsg) {
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const binding = currentBinding();
      if (!binding) return denyThreadMutation(ws);
      await runBoundMutation(binding, () => ThreadWebSocketHandler.handleThreadRename(ws, clientMsg));
    },

    async 'thread:delete'(clientMsg) {
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const binding = currentBinding();
      if (!binding) return denyThreadMutation(ws);
      await runBoundMutation(binding, () => ThreadWebSocketHandler.handleThreadDelete(ws, clientMsg));
    },

    async 'thread:copyLink'(clientMsg) {
      const binding = currentBinding();
      await runBoundRead(binding, () => ThreadWebSocketHandler.handleThreadCopyLink(ws, clientMsg));
    },

    async 'thread:fork'() {
      // Fork is not a trusted capability. Keep the baseline public symbol
      // bounded and inert until SPEC-01 removes the remaining stale surfaces.
      denyThreadFork(ws);
    },

    async 'thread:warm'(clientMsg) {
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const binding = currentBinding();
      if (!binding) {
        denyThreadMutation(ws);
        return;
      }
      await runBoundMutation(binding, () => threadRuntimeController.warmRuntimeForIntent({
        ws,
        session,
        clientMsg,
        wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
        projectRoot: binding.projectRoot,
        spawnAndSetupWire,
      }));
    },

    async 'thread:touch'(clientMsg) {
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const binding = currentBinding();
      if (!binding) return denyThreadMutation(ws);
      await runBoundMutation(binding, () => ThreadWebSocketHandler.handleThreadTouch(ws, clientMsg));
    },

    async 'thread:search'(clientMsg) {
      const binding = currentBinding();
      if (!binding) {
        denyUnavailableRead();
        return;
      }
      if (clientMsg.workspaceId !== undefined
        && clientMsg.workspaceId !== binding.workspaceId) {
        denyUnavailableRead();
        return;
      }
      await runBoundRead(binding, () => ThreadWebSocketHandler.handleThreadSearch(ws, {
        ...clientMsg,
        workspaceId: binding.workspaceId,
      }));
    },

    async 'thread:list'() {
      const binding = currentBinding();
      await runBoundRead(binding, () => ThreadWebSocketHandler.sendThreadList(ws));
    },
  };
}

/**
 * Spawn and set up a wire for a thread. Extracted so the prompt recovery
 * path in client-message-router.js can reuse the same wire-spawn sequence
 * as thread:open-assistant without duplicating logic.
 *
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 * @param {{ awaitHarnessReady: Function, initializeWire: Function, setupWireHandlers: Function }} deps.wireLifecycle
 * @param {string} deps.threadId
 * @param {string} deps.projectRoot
 * @returns {Promise<import('child_process').ChildProcess>}
 */
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
  const wire = spawnThreadWire(threadId, projectRoot, scopeContext);
  try {
    console.log('[WS] Wire spawned, awaiting harness ready...');
    await awaitHarnessReady(wire);
    console.log('[WS] Setting up handlers...');
    setupWireHandlers(wire, threadId, scopeContext);
    console.log('[WS] Initializing wire...');
    initializeWire(wire);
    console.log('[WS] Wire initialization complete');

    // Register with the workspace ThreadManager before claiming the session
    // or announcing readiness. A failed/stale activation is rolled back below.
    console.log('[WS] Registering with ThreadManager...');
    await ThreadWebSocketHandler.activateThreadSession(ws, threadId, wire, activationBinding);
    session.wire = wire;
    session.currentThreadId = threadId;
    session.currentScope = 'project';
    session.currentViewId = null;
    threadRuntimeManager.markReady({
      workspaceId: manager.workspaceId,
      projectRoot: manager.projectRoot,
      workspaceEpoch: activationBinding.workspaceEpoch,
      scope: 'project',
      threadId,
    });
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
      threadRuntimeManager.markState({
        workspaceId: manager.workspaceId,
        projectRoot: manager.projectRoot,
        workspaceEpoch: activationBinding.workspaceEpoch,
        scope: 'project',
        threadId,
      }, RUNTIME_STATES.STOPPING);
      throw error;
    }
    if (wire) await terminateProviderProcessAndWait(wire);

    // Clear delivery/runtime ownership only after actual child termination.
    if (getWireForThread(threadId, scopeContext) === wire) {
      unregisterWire(threadId, scopeContext, wire);
      threadRuntimeManager.markCold({
        workspaceId: manager.workspaceId,
        projectRoot: manager.projectRoot,
        workspaceEpoch: activationBinding.workspaceEpoch,
        scope: 'project',
        threadId,
      });
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

module.exports = { createThreadWsHandlers, spawnAndSetupWire };
