/**
 * ThreadWebSocketHandler - Manages WebSocket connections with thread switching
 *
 * Each WebSocket connection:
 * - Has a current panel
 * - Can switch between threads within that panel
 * - Manages one wire process at a time (per active thread)
 *
 * Multiple tabs = multiple WebSockets = independent sessions
 *
 * Coordinator module: owns shared state (Maps) and delegates to
 * thread-crud.js (CRUD handlers) and thread-messages.js (message handlers).
 */

const path = require('path');
const { ThreadManager } = require('./ThreadManager');
const { createCrudHandlers } = require('./thread-crud');
const { createMessageHandlers } = require('./thread-messages');
const { search: searchExchanges } = require('./chat-search');

// Global registries — one per scope (SPEC-26b).
// Project managers are keyed by workspaceId. View managers
// are keyed by `${workspaceId}:${viewId}` to handle the workspace
// switcher (multi-project) without collisions.
const projectThreadManagers = new Map(); // key: workspaceId
const viewThreadManagers = new Map();    // key: `${workspaceId}:${viewId}`

// Per-WS state. SPEC-26b: dual-scope shape.
//   ws -> {
//     panelId,
//     viewName,
//     threadIds: { project: string|null, view: string|null },
//     threadManagers: { project: ThreadManager, view: ThreadManager }
//   }
// The project manager persists across panel switches; the view manager is
// swapped on every setPanel() call. Project threadId persists across panel
// switches; view threadId resets on switch.
const wsState = new Map();

// Pending reorder timers: ws -> timeoutId (for delayed thread list refresh)
const pendingReorderTimers = new Map();
const REORDER_DELAY_MS = 3000;

/**
 * Get or create the project-scoped ThreadManager for a workspace.
 * Project managers are stable across panel switches (one per workspace per
 * server process). SPEC-26b.
 *
 * @param {string} projectRoot
 * @param {string} [workspaceId] - Workspace identifier; falls back to basename(projectRoot)
 * @returns {ThreadManager}
 */
function getProjectThreadManager(projectRoot, workspaceId) {
  const key = workspaceId || path.basename(projectRoot);
  let mgr = projectThreadManagers.get(key);
  if (!mgr) {
    mgr = new ThreadManager({ scope: 'project', projectRoot, workspaceId });
    projectThreadManagers.set(key, mgr);
    mgr.init().catch(err => {
      console.error(`[ProjectThreadManager] Failed to init ${key}:`, err);
    });
  }
  return mgr;
}

/**
 * Get or create the view-scoped ThreadManager for a (workspaceId, viewId)
 * pair. View managers swap as the user switches panels. SPEC-26b.
 *
 * @param {string} viewId
 * @param {string} projectRoot
 * @param {string} [workspaceId] - Workspace identifier; falls back to basename(projectRoot)
 * @returns {ThreadManager}
 */
function getViewThreadManager(viewId, projectRoot, workspaceId) {
  const key = `${workspaceId || path.basename(projectRoot)}:${viewId}`;
  let mgr = viewThreadManagers.get(key);
  if (!mgr) {
    mgr = new ThreadManager({ scope: 'view', viewId, projectRoot, workspaceId });
    viewThreadManagers.set(key, mgr);
    mgr.init().catch(err => {
      console.error(`[ViewThreadManager] Failed to init ${key}:`, err);
    });
  }
  return mgr;
}

/**
 * Set panel for a WebSocket connection.
 *
 * SPEC-26b: populates TWO ThreadManagers — one project-scoped (persistent
 * across panel switches) and one view-scoped (swapped on every panel
 * change). Project thread state persists across panel switches; view
 * thread state resets.
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
    throw new Error('setPanel: config.projectRoot is required (SPEC-26b)');
  }

  const existing = wsState.get(ws);
  const workspaceChanged = existing?.threadManagers?.project
    && existing.threadManagers.project.workspaceId !== config.workspaceId;

  // Close currently open VIEW thread when switching panels — view threads
  // are tied to a specific view. Project threads PERSIST across panel
  // switches (that's the whole point of project scope), but NOT across
  // workspace switches — a project thread in workspace A is meaningless
  // in workspace B.
  if (existing && existing.threadIds?.view) {
    closeThread(ws, 'view');
  }
  if (workspaceChanged && existing?.threadIds?.project) {
    closeThread(ws, 'project');
  }

  // Project manager: stable across panel switches, but swapped when the
  // workspace changes so queries target the correct workspace_id.
  const projectMgr = (!existing?.threadManagers?.project || workspaceChanged)
    ? getProjectThreadManager(config.projectRoot, config.workspaceId)
    : existing.threadManagers.project;

  // View manager: always replace with the manager for the new panel.
  const viewMgr = getViewThreadManager(panelId, config.projectRoot, config.workspaceId);

  wsState.set(ws, {
    panelId,
    viewName: config.viewName || panelId,
    threadIds: {
      project: workspaceChanged ? null : (existing?.threadIds?.project || null),
      view: null,
    },
    threadManagers: {
      project: projectMgr,
      view: viewMgr,
    },
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
 * Clean up when WebSocket closes. SPEC-26b: closes both scopes' threads.
 * @param {import('ws').WebSocket} ws
 */
function cleanup(ws) {
  const state = wsState.get(ws);
  if (state) {
    if (state.threadIds?.view) closeThread(ws, 'view');
    if (state.threadIds?.project) closeThread(ws, 'project');
  }
  wsState.delete(ws);

  // Clear any pending reorder timer
  const timer = pendingReorderTimers.get(ws);
  if (timer) {
    clearTimeout(timer);
    pendingReorderTimers.delete(ws);
  }
}

/**
 * Close the active thread session for a given scope. SPEC-26b.
 * @param {import('ws').WebSocket} ws
 * @param {'project'|'view'} scope
 */
async function closeThread(ws, scope) {
  const state = wsState.get(ws);
  if (!state) return;

  const threadId = state.threadIds?.[scope];
  if (!threadId) return;

  const manager = state.threadManagers[scope];
  await manager.closeSession(threadId);

  state.threadIds[scope] = null;
  console.log(`[ThreadWS] Closed ${scope} thread ${threadId}`);
}

/**
 * Send thread list to client. SPEC-26b: scope-aware.
 * @param {import('ws').WebSocket} ws
 * @param {'project'|'view'} [scope='view'] - Default 'view' matches pre-26b behavior.
 */
async function sendThreadList(ws, scope = 'view') {
  console.log(`[ThreadWS] sendThreadList called scope=${scope}`);
  const state = wsState.get(ws);
  if (!state) {
    console.log('[ThreadWS] No state for ws, skipping');
    return;
  }

  const manager = state.threadManagers?.[scope];
  if (!manager) {
    console.log(`[ThreadWS] No ${scope} manager for ws, skipping`);
    return;
  }

  const threads = await manager.listThreads();
  console.log(`[ThreadWS] Sending ${threads.length} ${scope} threads`);

  ws.send(JSON.stringify({
    type: 'thread:list',
    scope, // echo so the client knows which list to update (SPEC-26c)
    threads: threads.map(t => ({
      threadId: t.threadId,
      entry: t.entry
    }))
  }));
}

/**
 * Get current thread ID for WebSocket (scope-aware). SPEC-26b.
 * @param {import('ws').WebSocket} ws
 * @param {'project'|'view'} [scope='view']
 * @returns {string|null}
 */
function getCurrentThreadId(ws, scope = 'view') {
  return wsState.get(ws)?.threadIds?.[scope] || null;
}

/**
 * Get current ThreadManager for WebSocket (scope-aware). SPEC-26b.
 * @param {import('ws').WebSocket} ws
 * @param {'project'|'view'} [scope='view']
 * @returns {ThreadManager|null}
 */
function getCurrentThreadManager(ws, scope = 'view') {
  return wsState.get(ws)?.threadManagers?.[scope] || null;
}

// Wire up extracted handlers with shared state
const crud = createCrudHandlers({ wsState, sendThreadList, closeThread, pendingReorderTimers, REORDER_DELAY_MS });
const messages = createMessageHandlers({ wsState });

module.exports = {
  // Setup
  setPanel,
  getState,
  cleanup,

  // Thread operations
  sendThreadList,
  ...crud,

  // Message handling
  ...messages,

  // Accessors
  getCurrentThreadId,
  getCurrentThreadManager,

  // For testing (SPEC-26b split)
  _getProjectThreadManagers: () => projectThreadManagers,
  _getViewThreadManagers: () => viewThreadManagers,
  _getWsState: () => wsState
};
