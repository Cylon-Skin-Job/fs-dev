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

const { ThreadWebSocketHandler } = require('../thread');
const { spawnThreadWire } = require('../harness/compat');
const { registerWire } = require('../wire/process-manager');

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

  return {
    async 'thread:open-assistant'(clientMsg) {
      const scope = clientMsg.scope === 'project' ? 'project' : 'view';
      console.log('[WS] thread:open-assistant received, threadId:', clientMsg.threadId?.slice(0, 8) || '(new)', 'scope:', scope);

      // Close current wire if one is open (switching threads or reopening).
      // Single-wire model preserved in 26b — see SPEC. 26d adds dual-wire.
      if (session.wire) {
        console.log('[WS] Closing previous wire before opening assistant thread');
        session.wire.kill('SIGTERM');
        session.wire = null;
      }

      // Dispatcher: create or resume based on whether msg.threadId exists.
      await ThreadWebSocketHandler.handleThreadOpenAssistant(ws, clientMsg);

      // After the handler runs, the per-ws state should have the current
      // thread ID for the requested scope.
      const state = ThreadWebSocketHandler.getState(ws);
      const threadId = state?.threadIds?.[scope];
      if (!threadId) {
        console.error(`[WS] No threadId for scope=${scope} after handleThreadOpenAssistant — dispatch failed`);
        return;
      }

      await spawnAndSetupWire({ ws, session, wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers }, threadId, scope, projectRoot });
    },

    async 'thread:rename'(clientMsg) {
      await ThreadWebSocketHandler.handleThreadRename(ws, clientMsg);
    },

    async 'thread:delete'(clientMsg) {
      await ThreadWebSocketHandler.handleThreadDelete(ws, clientMsg);
    },

    async 'thread:copyLink'(clientMsg) {
      await ThreadWebSocketHandler.handleThreadCopyLink(ws, clientMsg);
    },

    async 'thread:touch'(clientMsg) {
      await ThreadWebSocketHandler.handleThreadTouch(ws, clientMsg);
    },

    async 'thread:search'(clientMsg) {
      await ThreadWebSocketHandler.handleThreadSearch(ws, clientMsg);
    },

    async 'thread:list'(clientMsg) {
      // SPEC-26b: forward optional scope field; sendThreadList defaults to 'view'.
      await ThreadWebSocketHandler.sendThreadList(ws, clientMsg.scope);
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
 * @param {'project'|'view'} deps.scope
 * @param {string} deps.projectRoot
 * @returns {Promise<import('child_process').ChildProcess>}
 */
async function spawnAndSetupWire({ ws, session, wireLifecycle, threadId, scope, projectRoot }) {
  const { awaitHarnessReady, initializeWire, setupWireHandlers } = wireLifecycle;

  console.log(`[WS] Spawning wire for ${scope} thread:`, threadId);
  session.currentThreadId = threadId;
  session.currentScope = scope;  // SPEC-26b: track which scope owns the active wire
  // CHAT_SCOPE_SPEC: populate scope fields so resolveScope() can build the
  // structured workspace string for every chat:* event this wire emits.
  const state = ThreadWebSocketHandler.getState(ws);
  session.currentViewId = (scope === 'view') ? (state?.panelId || state?.viewName || null) : null;
  const scopeContext = {
    workspaceId: session.currentWorkspaceId,
    viewId: session.currentViewId,
  };
  const wire = spawnThreadWire(threadId, projectRoot, scopeContext);
  session.wire = wire;
  registerWire(threadId, wire, projectRoot, ws, scopeContext);

  console.log('[WS] Wire spawned, awaiting harness ready...');
  await awaitHarnessReady(wire);
  console.log('[WS] Setting up handlers...');
  setupWireHandlers(wire, threadId);
  session.wire = wire;  // Re-assign in case exit handler cleared it
  console.log('[WS] Initializing wire...');
  initializeWire(wire);
  console.log('[WS] Wire initialization complete');

  // Fire wire_ready for BOTH create and resume — this harmonizes the two
  // paths (previously only thread:create sent it, which was a latent bug
  // in the resume flow: the connecting overlay would not clear).
  ws.send(JSON.stringify({ type: 'wire_ready', threadId, scope }));

  // Register with the scope-appropriate ThreadManager
  const manager = state?.threadManagers?.[scope];
  if (manager) {
    console.log('[WS] Registering with ThreadManager...');
    await manager.openSession(threadId, wire, ws);
    console.log('[WS] ThreadManager registration complete');
  }

  return wire;
}

module.exports = { createThreadWsHandlers, spawnAndSetupWire };
