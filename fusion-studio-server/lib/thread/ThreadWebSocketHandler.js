/**
 * ThreadWebSocketHandler - Manages WebSocket connections with thread switching
 *
 * Each WebSocket connection:
 * - Has a current panel
 * - Can switch between threads
 * - Manages one wire process at a time (per active thread)
 *
 * Multiple tabs = multiple WebSockets = independent sessions
 *
 * RCC-0095: single workspace chat. Threads are workspace-scoped and the
 * active thread persists across panel switches (but not across workspace
 * switches). The legacy per-view thread scope has been removed.
 *
 * Coordinator module: owns shared state (Maps) and delegates to
 * thread-crud.js (CRUD handlers) and thread-messages.js (message handlers).
 */

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

// Per-WS state:
//   ws -> {
//     panelId,
//     viewName,
//     threadId: string|null,          // selected/hydrated thread
//     activatedThreadId: string|null, // connection-owned live session
//     threadManager: ThreadManager
//   }
// The manager, selection, and activation persist across panel switches; all
// reset on workspace switches.
const wsState = new Map();

// Pending reorder timers: ws -> timeoutId (for delayed thread list refresh)
const pendingReorderTimers = new Map();
// Per-connection lifecycle tail. Provider ownership changes are serialized so
// two concurrently accepted activation intents cannot both close the same
// predecessor and leave one of their children untracked.
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

/**
 * Capture the exact live workspace/manager pair for one connection.
 * Consumers must still hold the workspace-operation lease and re-check this
 * binding before performing manager, persistence, provider, or fixture work.
 */
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

/**
 * Retire selection, delayed list delivery, and provider ownership before a
 * different workspace pair becomes authoritative for this connection.
 * The workspace broadcaster calls this while holding the shared operation
 * lease, so no admitted thread operation can be split by retirement.
 */
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

/**
 * Set panel for a WebSocket connection.
 *
 * The workspace ThreadManager persists across panel switches, as does the
 * active thread. Switching workspaces closes the active thread and swaps
 * the manager so queries target the correct workspace_id.
 *
 * @param {import('ws').WebSocket} ws
 * @param {string} panelId - Panel identifier (e.g., 'file-viewer', 'agent:bot-name')
 * @param {object} [config]
 * @param {string} [config.projectRoot] - Project root (required for thread storage)
 * @param {string} [config.viewName] - View name for client messages (e.g., 'file-viewer')
 * @param {string} [config.workspaceId] - Workspace identifier (workspaces.id)
 */
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

  // The workspace thread PERSISTS across panel switches (that's the whole
  // point of the single workspace chat), but NOT across workspace switches —
  // a thread in workspace A is meaningless in workspace B.
  if (workspaceChanged && activatedThreadId) {
    // Capture the old workspace state before replacing it. closeThread's
    // serialized operation will close only this exact owner, never a newer
    // workspace installed below.
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

/**
 * Get current state for a WebSocket
 * @param {import('ws').WebSocket} ws
 */
function getState(ws) {
  return wsState.get(ws);
}

/**
 * Clean up when WebSocket closes.
 * @param {import('ws').WebSocket} ws
 */
async function cleanup(ws) {
  const state = wsState.get(ws);
  const activatedThreadId = state && Object.prototype.hasOwnProperty.call(state, 'activatedThreadId')
    ? state.activatedThreadId
    : state?.threadId;
  const closing = activatedThreadId ? closeThread(ws) : null;

  // Clear any pending reorder timer
  const timer = pendingReorderTimers.get(ws);
  if (timer) {
    clearTimeout(timer);
    pendingReorderTimers.delete(ws);
  }
  try {
    // Keep the exact manager binding available while the canonical drain's
    // retirement callback terminalizes and stops its provider. No new frame
    // can be admitted on the closed socket, and deletion after the await makes
    // the lifecycle unavailable immediately once quiescence is proven.
    await closing;
  } finally {
    if (wsState.get(ws) === state) wsState.delete(ws);
  }
}

/**
 * Close the active thread session.
 * @param {import('ws').WebSocket} ws
 */
async function closeThread(ws) {
  const state = wsState.get(ws);
  if (!state) return;

  // Older direct unit fixtures predate the explicit activation marker and
  // represent activated state. Production state always owns the marker.
  const threadId = getActivatedThreadId(state);
  if (!threadId) return;
  return serializeActivation(ws, () => closeOwnedSession(state, threadId, ws));
}

/**
 * Transfer this connection's live-session ownership to a successfully warmed
 * thread. Passive selection is deliberately separate from this lifecycle.
 *
 * @param {import('ws').WebSocket} ws
 * @param {string} threadId
 * @param {import('child_process').ChildProcess} wire
 */
async function activateThreadSession(ws, threadId, wire, binding = null) {
  const expectedState = wsState.get(ws);
  if (!expectedState?.threadManager) throw new Error('No ThreadManager');

  return serializeActivation(ws, async () => {
    if (wsState.get(ws) !== expectedState || !bindingMatches(expectedState, binding)) {
      throw new Error('Workspace changed during thread activation');
    }

    const manager = expectedState.threadManager;
    const runtimeKey = {
      workspaceId: manager.workspaceId,
      projectRoot: manager.projectRoot,
      workspaceEpoch: binding?.workspaceEpoch || expectedState.workspaceEpoch,
      scope: 'project',
      threadId,
    };
    const resourceRuntime = threadRuntimeManager.getRuntimeForResource(runtimeKey);
    if (resourceRuntime?.state === RUNTIME_STATES.STOPPING
      || manager.getSession?.(threadId)?.state === 'stopping') {
      throw new Error('Thread provider retirement is still pending');
    }
    const thread = await manager.getThread?.(threadId);
    if (thread === null || thread === undefined) {
      throw new Error('Thread unavailable during activation');
    }
    if (wsState.get(ws) !== expectedState || !bindingMatches(expectedState, binding)) {
      throw new Error('Workspace changed during thread activation');
    }
    if (threadRuntimeManager.getRuntimeForResource(runtimeKey)?.state === RUNTIME_STATES.STOPPING
      || manager.getSession?.(threadId)?.state === 'stopping') {
      throw new Error('Thread provider retirement is still pending');
    }

    // Claim the target before making any destructive change to the current
    // connection-owned provider. A duplicate resume or occupied target must
    // fail its manager CAS while the predecessor remains fully live.
    const previousTarget = typeof manager.getSession === 'function'
      ? manager.getSession(threadId)
      : null;
    const previousTargetOwner = previousTarget ? {
      ws: previousTarget.ws || null,
      workspaceEpoch: previousTarget.workspaceEpoch || null,
    } : null;
    await manager.openSession(threadId, wire, ws, {
      workspaceEpoch: binding?.workspaceEpoch || expectedState.workspaceEpoch || null,
    });
    const acceptedSession = typeof manager.getSession === 'function'
      ? manager.getSession(threadId)
      : null;
    if (acceptedSession
      && (acceptedSession.ws !== ws || acceptedSession.wireProcess !== wire)) {
      throw new Error('Thread activation ownership changed');
    }
    const rollbackAcceptedTarget = async () => {
      const currentTarget = typeof manager.getSession === 'function'
        ? manager.getSession(threadId)
        : null;
      if (!currentTarget || currentTarget !== acceptedSession
        || currentTarget.ws !== ws || currentTarget.wireProcess !== wire) return false;
      if (previousTarget === acceptedSession && previousTargetOwner
        && typeof manager.restoreSessionOwner === 'function') {
        return manager.restoreSessionOwner(
          threadId, acceptedSession, wire, ws, previousTargetOwner,
        );
      }
      await manager.closeSession(threadId);
      return true;
    };
    if (wsState.get(ws) !== expectedState || !bindingMatches(expectedState, binding)) {
      // openSession may have installed a durable/session owner. Roll back only
      // the exact session from this failed lease before exposing readiness.
      await rollbackAcceptedTarget();
      throw new Error('Workspace changed during thread activation');
    }

    const activeThreadId = getActivatedThreadId(expectedState);
    if (activeThreadId && activeThreadId !== threadId) {
      try {
        await closeOwnedSession(expectedState, activeThreadId, ws);
      } catch (error) {
        // The target was accepted, but predecessor retirement did not finish.
        // Roll the target back so failed activation never leaves two admitted
        // providers or publishes readiness for the challenger.
        await rollbackAcceptedTarget();
        throw error;
      }
      const currentTarget = typeof manager.getSession === 'function'
        ? manager.getSession(threadId)
        : null;
      const targetExited = wire?.killed
        || (wire?.exitCode !== undefined && wire.exitCode !== null)
        || (wire?.signalCode !== undefined && wire.signalCode !== null);
      if (currentTarget !== acceptedSession || currentTarget?.ws !== ws
        || currentTarget?.wireProcess !== wire || currentTarget?.state !== 'active'
        || targetExited) {
        await rollbackAcceptedTarget();
        throw new Error('Thread activation target exited or changed during predecessor retirement');
      }
      if (wsState.get(ws) !== expectedState || !bindingMatches(expectedState, binding)) {
        await rollbackAcceptedTarget();
        throw new Error('Workspace changed during thread activation');
      }
    }
    if (!threadRuntimeManager.adoptRuntimeIdentity(runtimeKey)) {
      await rollbackAcceptedTarget();
      throw new Error('Thread runtime ownership changed during activation');
    }
    attachClientToWire(threadId, wire, manager.projectRoot, ws, {
      workspaceId: manager.workspaceId,
      projectRoot: manager.projectRoot,
      workspaceEpoch: binding?.workspaceEpoch || expectedState.workspaceEpoch,
      viewId: null,
    });
    expectedState.threadId = threadId;
    expectedState.activatedThreadId = threadId;
  });
}

/**
 * Roll back only the exact connection/wire activation that failed after the
 * manager accepted it but before the caller could publish readiness.
 */
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

/**
 * Delete a durable thread while holding the same connection lifecycle lease
 * used by activation. This prevents a concurrent activation from opening a
 * thread between the delete handler's ownership check and durable removal.
 */
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

/**
 * Send thread list to client.
 * @param {import('ws').WebSocket} ws
 */
async function sendThreadList(ws) {
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

  const threads = await manager.listThreads();
  console.log(`[ThreadWS] Sending ${threads.length} threads`);

  ws.send(JSON.stringify({
    type: 'thread:list',
    scope: 'project', // protocol field kept for wire compatibility
    threads: threads.map(t => ({
      threadId: t.threadId,
      entry: t.entry
    }))
  }));
}

/**
 * Get current thread ID for WebSocket.
 * @param {import('ws').WebSocket} ws
 * @returns {string|null}
 */
function getCurrentThreadId(ws) {
  return wsState.get(ws)?.threadId || null;
}

/**
 * Get current ThreadManager for WebSocket.
 * @param {import('ws').WebSocket} ws
 * @returns {ThreadManager|null}
 */
function getCurrentThreadManager(ws) {
  return wsState.get(ws)?.threadManager || null;
}

// Wire up extracted handlers with shared state
const crud = createCrudHandlers({
  wsState,
  sendThreadList,
  deleteThreadSession,
  pendingReorderTimers,
  REORDER_DELAY_MS,
  runDelayedThreadList,
});
const messages = createMessageHandlers({ wsState });

module.exports = {
  // Setup
  setPanel,
  getState,
  cleanup,

  // Thread operations
  sendThreadList,
  activateThreadSession,
  rollbackThreadActivation,
  captureActivationBinding,
  deleteThreadSession,
  isActivationBindingCurrent,
  retireWorkspaceBinding,
  ...crud,

  // Message handling
  ...messages,

  // Accessors
  getCurrentThreadId,
  getCurrentThreadManager,

  // For testing
  _getProjectThreadManagers,
  _getWsState: () => wsState
};
