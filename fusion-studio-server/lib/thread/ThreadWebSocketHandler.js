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
const {
  getProjectThreadManager,
  _getProjectThreadManagers,
} = require('./thread-manager-registry');

// Per-WS state:
//   ws -> {
//     panelId,
//     viewName,
//     threadId: string|null,
//     threadManager: ThreadManager
//   }
// The manager and threadId persist across panel switches; both reset on
// workspace switches.
const wsState = new Map();

// Pending reorder timers: ws -> timeoutId (for delayed thread list refresh)
const pendingReorderTimers = new Map();
const REORDER_DELAY_MS = 3000;

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
    && existing.threadManager.workspaceId !== config.workspaceId;

  // The workspace thread PERSISTS across panel switches (that's the whole
  // point of the single workspace chat), but NOT across workspace switches —
  // a thread in workspace A is meaningless in workspace B.
  if (workspaceChanged && existing?.threadId) {
    closeThread(ws);
  }

  const threadManager = (!existing?.threadManager || workspaceChanged)
    ? getProjectThreadManager(config.projectRoot, config.workspaceId)
    : existing.threadManager;

  wsState.set(ws, {
    panelId,
    viewName: config.viewName || panelId,
    threadId: workspaceChanged ? null : (existing?.threadId || null),
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
function cleanup(ws) {
  const state = wsState.get(ws);
  if (state && state.threadId) {
    closeThread(ws);
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
 * Close the active thread session.
 * @param {import('ws').WebSocket} ws
 */
async function closeThread(ws) {
  const state = wsState.get(ws);
  if (!state) return;

  const threadId = state.threadId;
  if (!threadId) return;

  await state.threadManager.closeSession(threadId);

  state.threadId = null;
  console.log(`[ThreadWS] Closed thread ${threadId}`);
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

  // For testing
  _getProjectThreadManagers,
  _getWsState: () => wsState
};
