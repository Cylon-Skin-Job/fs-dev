/** WebSocket selection, workspace/session binding and handler delegation. */
const { activateSession } = require('./runtime-session-activation');
const { createCrudHandlers } = require('./thread-crud');
const { createMessageHandlers } = require('./thread-messages');
const path = require('path');
const {
  getProjectThreadManager,
  _getProjectThreadManagers,
} = require('./thread-manager-registry');
const {
  attachClientToWire,
  getWireForThread,
  unregisterWireForClient,
} = require('../wire/process-manager');
const {
  isWorkspaceOperationLeaseError,
  runWorkspaceOperation,
} = require('../ws/workspace-operation-lease');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { drainEventEffects } = require('../event-bus');
const wsState = new Map();
const pendingReorderTimers = new Map();
const activationTails = new Map();
const REORDER_DELAY_MS = 3000;

function serializeActivation(ws, operation) {
  const previous = activationTails.get(ws) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  activationTails.set(ws, current);
  return current.finally(() => {
    if (activationTails.get(ws) === current) activationTails.delete(ws);
  });
}

function getActivatedThreadId(state) {
  return Object.prototype.hasOwnProperty.call(state, 'activatedThreadId')
    ? state.activatedThreadId
    : state.threadId;
}

async function closeOwnedSession(state, threadId, ws = null, options = {}) {
  if (!state?.threadManager || !threadId) return false;
  const currentSession = typeof state.threadManager.getSession === 'function'
    ? state.threadManager.getSession(threadId)
    : null;
  if (ws && currentSession && currentSession.ws !== ws) {
    if (getActivatedThreadId(state) === threadId) state.activatedThreadId = null;
    if (state.threadId === threadId) state.threadId = null;
    return false;
  }
  const close = options.awaitProvider
    && typeof state.threadManager.closeSessionAndWait === 'function'
    ? state.threadManager.closeSessionAndWait.bind(state.threadManager)
    : state.threadManager.closeSession.bind(state.threadManager);
  const closed = await close(threadId);
  if (getActivatedThreadId(state) === threadId) state.activatedThreadId = null;
  if (state.threadId === threadId) state.threadId = null;
  if (closed) console.log('[ThreadWS] thread_closed');
  return closed;
}

function bindingMatches(state, binding) {
  if (!state?.threadManager || state.workspaceRetired === true) return false;
  if (!binding) return true;
  const { session, projectRoot, workspaceId, workspaceEpoch } = binding;
  if (binding.state && binding.state !== state) return false;
  if (state.threadManager.projectRoot !== projectRoot) return false;
  if (state.threadManager.workspaceId !== workspaceId) return false;
  if (!session) return true;
  return session.projectRoot === projectRoot
    && session.currentWorkspaceId === workspaceId
    && session.workspaceEpoch === workspaceEpoch
    && (session.workspaceBindingState === undefined
      || session.workspaceBindingState === 'active');
}

function isActivationBindingCurrent(ws, binding) {
  const state = wsState.get(ws);
  return state === binding?.state && bindingMatches(state, binding);
}

function captureActivationBinding(ws, session) {
  const state = wsState.get(ws);
  const manager = state?.threadManager;
  const projectRoot = session?.projectRoot;
  const workspaceId = session?.currentWorkspaceId;
  const workspaceEpoch = session?.workspaceEpoch;
  if (!manager || typeof projectRoot !== 'string' || !projectRoot
    || typeof workspaceId !== 'string' || !workspaceId
    || typeof workspaceEpoch !== 'string' || !workspaceEpoch) {
    return null;
  }
  const binding = { state, session, projectRoot, workspaceId, workspaceEpoch };
  return bindingMatches(state, binding) ? binding : null;
}

async function runDelayedThreadList(ws, expectedState, operation) {
  try {
    return await runWorkspaceOperation(
      ws,
      () => wsState.get(ws) === expectedState && expectedState?.workspaceRetired !== true,
      operation,
    );
  } catch (error) {
    if (!isWorkspaceOperationLeaseError(error)) throw error;
    return false;
  }
}

async function retireWorkspaceBinding(ws, session = null) {
  const state = wsState.get(ws);
  if (!state) return false;
  state.workspaceRetired = true;

  const timer = pendingReorderTimers.get(ws);
  if (timer) clearTimeout(timer);
  pendingReorderTimers.delete(ws);

  const activatedThreadId = getActivatedThreadId(state);
  const workspaceId = state.threadManager.workspaceId;
  const wireScope = {
    workspaceId,
    projectRoot: state.threadManager.projectRoot,
    workspaceEpoch: state.workspaceEpoch || session?.workspaceEpoch || null,
  };
  const activatedWire = activatedThreadId
    ? getWireForThread(activatedThreadId, wireScope)
    : null;
  if (activatedThreadId) unregisterWireForClient(activatedThreadId, wireScope, ws);
  if (activatedWire && session?.wire === activatedWire) session.wire = null;
  await serializeActivation(ws, async () => {
    if (wsState.get(ws) !== state) return;
    const currentSession = activatedThreadId
      && typeof state.threadManager.getSession === 'function'
      ? state.threadManager.getSession(activatedThreadId)
      : null;
    const supportsRetirementReservation = typeof state.threadManager.beginSessionRetirement === 'function';
    const retirementOwner = activatedThreadId
      && supportsRetirementReservation
      ? state.threadManager.beginSessionRetirement(activatedThreadId, ws)
      : null;
    const ownsActivatedProvider = retirementOwner
      ? true
      : (!supportsRetirementReservation
        && (!currentSession || currentSession.ws === ws));
    if (activatedThreadId && ownsActivatedProvider) {
      const runtimeKey = {
        workspaceId,
        projectRoot: state.threadManager.projectRoot,
        workspaceEpoch: state.workspaceEpoch || currentSession?.workspaceEpoch || session?.workspaceEpoch,
        scope: 'project',
        threadId: activatedThreadId,
      };
      const activeDrain = threadRuntimeManager.getActiveDrain(runtimeKey);
      const effectIdentity = activeDrain?.turnId
        && typeof activeDrain.routeContext?.projectRoot === 'string'
        && typeof activeDrain.routeContext?.workspaceEpoch === 'string' ? {
        workspaceId,
        projectRoot: activeDrain.routeContext?.projectRoot,
        workspaceEpoch: activeDrain.routeContext?.workspaceEpoch,
        threadId: activatedThreadId,
        turnId: activeDrain.turnId,
      } : null;
      if (activeDrain?.turnId && !effectIdentity) {
        throw new Error('Active turn is missing exact workspace effect identity');
      }
      await threadRuntimeManager.retireActiveDrain(runtimeKey);
      if (effectIdentity) {
        const effects = await drainEventEffects(effectIdentity, { timeoutMs: 3_000 });
        if (!effects.drained) throw new Error('Turn effects did not quiesce during workspace retirement');
      }
      await closeOwnedSession(state, activatedThreadId, ws, { awaitProvider: true });
    }
    state.threadId = null;
    state.activatedThreadId = null;
  });
  return true;
}

function setPanel(ws, panelId, config = {}) {
  if (!config.projectRoot) {
    throw new Error('setPanel: config.projectRoot is required');
  }

  const existing = wsState.get(ws);
  const workspaceChanged = existing?.threadManager
    && (existing.threadManager.workspaceId !== config.workspaceId
      || path.resolve(existing.threadManager.projectRoot) !== path.resolve(config.projectRoot));
  const activatedThreadId = existing && Object.prototype.hasOwnProperty.call(existing, 'activatedThreadId')
    ? existing.activatedThreadId
    : existing?.threadId;
  if (workspaceChanged && activatedThreadId) {
    closeThread(ws);
  }

  const threadManager = (!existing?.threadManager || workspaceChanged)
    ? getProjectThreadManager(config.projectRoot, config.workspaceId)
    : existing.threadManager;

  wsState.set(ws, {
    panelId,
    viewName: config.viewName || panelId,
    threadId: workspaceChanged ? null : (existing?.threadId || null),
    activatedThreadId: workspaceChanged
      ? null
      : (existing && Object.prototype.hasOwnProperty.call(existing, 'activatedThreadId')
        ? existing.activatedThreadId
        : (existing?.threadId || null)),
    workspaceRetired: false,
    workspaceEpoch: config.workspaceEpoch || null,
    threadManager,
  });
}

function getState(ws) {
  return wsState.get(ws);
}

async function cleanup(ws) {
  const state = wsState.get(ws);
  const activatedThreadId = state && Object.prototype.hasOwnProperty.call(state, 'activatedThreadId')
    ? state.activatedThreadId
    : state?.threadId;
  const closing = activatedThreadId ? closeThread(ws) : null;
  const timer = pendingReorderTimers.get(ws);
  if (timer) {
    clearTimeout(timer);
    pendingReorderTimers.delete(ws);
  }
  try {
    await closing;
  } finally {
    if (wsState.get(ws) === state) wsState.delete(ws);
  }
}

async function closeThread(ws) {
  const state = wsState.get(ws);
  if (!state) return;
  const threadId = getActivatedThreadId(state);
  if (!threadId) return;
  return serializeActivation(ws, () => closeOwnedSession(state, threadId, ws));
}

async function activateThreadSession(ws, threadId, wire, binding = null) {
  const expectedState = wsState.get(ws);
  const manager = expectedState?.threadManager;
  if (!manager) throw new Error('No ThreadManager');
  return serializeActivation(ws, () => {
    const isCurrent = () => wsState.get(ws) === expectedState && bindingMatches(expectedState, binding);
    if (!isCurrent()) throw new Error('Workspace changed during thread activation');
    return activateSession({
      sessions: Object.freeze({ getSession: manager.getSession?.bind(manager),
        getThread: manager.getThread?.bind(manager), openSession: manager.openSession.bind(manager),
        closeSession: manager.closeSession.bind(manager), restoreSessionOwner: manager.restoreSessionOwner?.bind(manager) }),
      runtimeKey: Object.freeze({ workspaceId: manager.workspaceId, projectRoot: manager.projectRoot,
        workspaceEpoch: binding?.workspaceEpoch || expectedState.workspaceEpoch, scope: 'project', threadId }),
      threadId, wire, ws, isCurrent,
      getActiveThreadId: () => getActivatedThreadId(expectedState),
      closePredecessor: id => closeOwnedSession(expectedState, id, ws),
      publishActivation() { expectedState.threadId = threadId; expectedState.activatedThreadId = threadId; },
    });
  });
}

async function rollbackThreadActivation(ws, threadId, wire, binding = null) {
  const expectedState = wsState.get(ws);
  if (!expectedState?.threadManager) return false;

  return serializeActivation(ws, async () => {
    if (wsState.get(ws) !== expectedState || !bindingMatches(expectedState, binding)) return false;
    if (getActivatedThreadId(expectedState) !== threadId) return false;
    const ownedSession = typeof expectedState.threadManager.getSession === 'function'
      ? expectedState.threadManager.getSession(threadId)
      : null;
    if (ownedSession
      && (ownedSession.ws !== ws || ownedSession.wireProcess !== wire)) return false;
    return closeOwnedSession(expectedState, threadId, ws);
  });
}

async function deleteThreadSession(ws, threadId) {
  const expectedState = wsState.get(ws);
  if (!expectedState?.threadManager) throw new Error('No ThreadManager');

  return serializeActivation(ws, async () => {
    if (wsState.get(ws) !== expectedState) {
      throw new Error('Workspace changed during thread deletion');
    }
    const manager = expectedState.threadManager;
    const existing = await manager.getThread(threadId);
    if (!existing || wsState.get(ws) !== expectedState) return false;

    if (getActivatedThreadId(expectedState) === threadId) {
      await closeOwnedSession(expectedState, threadId, ws);
      if (wsState.get(ws) !== expectedState) {
        throw new Error('Workspace changed during thread deletion');
      }
    }
    const deleted = await manager.deleteThread(threadId);
    if (deleted && wsState.get(ws) === expectedState && expectedState.threadId === threadId) {
      expectedState.threadId = null;
    }
    return deleted;
  });
}

async function sendThreadList(ws, viewId = null) {
  const state = wsState.get(ws);
  if (!state) {
    console.log('[ThreadWS] No state for ws, skipping sendThreadList');
    return;
  }

  const manager = state.threadManager;
  if (!manager) {
    console.log('[ThreadWS] No ThreadManager for ws, skipping sendThreadList');
    return;
  }

  const result = await manager.listGroups(viewId);
  if (!result.ok) {
    console.log('[ThreadWS] Group activation blocked by view-identity repair');
    ws.send(JSON.stringify({
      type: 'error',
      code: 'view_id_preflight_repair_required',
      message: 'View identity repair required',
      diagnostics: result.diagnostics || [],
    }));
    return;
  }

  console.log(`[ThreadWS] Sending ${result.groups.length} thread groups`);
  ws.send(JSON.stringify({
    type: 'thread:list',
    scope: 'project', // protocol field kept for wire compatibility
    viewId: result.viewId,
    threads: result.groups,
  }));
}

function getCurrentThreadId(ws) {
  return wsState.get(ws)?.threadId || null;
}

function getCurrentThreadManager(ws) {
  return wsState.get(ws)?.threadManager || null;
}
const crud = createCrudHandlers({
  wsState,
  sendThreadList,
  pendingReorderTimers,
  REORDER_DELAY_MS,
  runDelayedThreadList,
});
const messages = createMessageHandlers({ wsState });

module.exports = {
  setPanel,
  getState,
  cleanup,
  sendThreadList,
  activateThreadSession,
  rollbackThreadActivation,
  captureActivationBinding,
  deleteThreadSession,
  isActivationBindingCurrent,
  retireWorkspaceBinding,
  ...crud,
  ...messages,
  getCurrentThreadId,
  getCurrentThreadManager,
  _getProjectThreadManagers,
  _getWsState: () => wsState
};
