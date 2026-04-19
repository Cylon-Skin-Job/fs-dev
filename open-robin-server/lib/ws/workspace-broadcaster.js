/**
 * Workspace Broadcaster — bus → WebSocket fan-out for workspace and
 * thread lifecycle events.
 *
 * Per WORKSPACE_BROADCASTER_SPEC. Completes the server→client return
 * path for events that have no threadId and therefore can't be routed
 * by wire-broadcaster. Two delivery modes:
 *
 *   - Broadcast: every connected client with readyState === OPEN
 *     (workspace registry/state changes, thread lifecycle).
 *   - Targeted:  the specific client that triggered the action, keyed
 *     by connectionId on the originating event (rejection modals).
 *
 * Architectural template: lib/wire/wire-broadcaster.js. Same shape —
 * subscribe to bus events at startup, deliver on each, no state.
 *
 * This module owns ONE job: translating workspace/thread bus events
 * to wire messages and delivering them. It does NOT own:
 *   - Emitting workspace events (that's the workspace-controller).
 *   - Per-client session state (that's server.js).
 *   - Client-side handling (that's the future workspaceStore).
 */

const { on } = require('../event-bus');

/**
 * Initialize the workspace broadcaster. Call once at server startup,
 * BEFORE server.listen() opens the port so boot-time events (e.g.
 * workspace:culled_at_launch) reach subscribers.
 *
 * @param {object} deps
 * @param {() => import('ws').WebSocket[]} deps.getAllClients
 *        Returns every open WebSocket in the sessions map.
 * @param {(connectionId: string) => import('ws').WebSocket|null} deps.getClientByConnectionId
 *        Returns the WebSocket for a specific connectionId, or null.
 * @returns {{ started: boolean }}
 */
function createWorkspaceBroadcaster({ getAllClients, getClientByConnectionId }) {

  function broadcastAll(wireMessage) {
    const payload = JSON.stringify(wireMessage);
    const clients = getAllClients();
    for (const ws of clients) {
      if (ws.readyState !== 1) continue;
      ws.send(payload);
    }
  }

  function sendTargeted(connectionId, wireMessage) {
    const ws = getClientByConnectionId(connectionId);
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(wireMessage));
  }

  // --- Broadcast subscriptions ---

  on('workspace:added', (event) => {
    broadcastAll({ type: 'workspace:added', workspace: event.workspace });
  });

  on('workspace:removed', (event) => {
    broadcastAll({ type: 'workspace:removed', workspaceId: event.workspaceId });
  });

  on('workspace:registry_changed', (event) => {
    broadcastAll({ type: 'workspace:registry_changed', workspaces: event.workspaces });
  });

  on('workspace:switched', (event) => {
    broadcastAll({
      type: 'workspace:switched',
      from: event.from,
      to: event.to,
      repoPath: event.repoPath,
    });
  });

  on('workspace:culled_at_launch', (event) => {
    broadcastAll({
      type: 'workspace:culled_at_launch',
      workspaceId: event.workspaceId,
      reason: event.reason,
    });
  });

  on('thread:state_changed', (event) => {
    broadcastAll({
      type: 'thread:state_changed',
      threadId: event.threadId,
      workspace: event.workspace,
      state: event.state,
      previousState: event.previousState,
    });
  });

  // --- Targeted subscriptions ---

  on('workspace:add_rejected_duplicate', (event) => {
    if (!event.connectionId) return;
    sendTargeted(event.connectionId, {
      type: 'workspace:add_rejected_duplicate',
      existingWorkspace: event.existingWorkspace,
    });
  });

  console.log('[WorkspaceBroadcaster] Started');
  return { started: true };
}

module.exports = { createWorkspaceBroadcaster };
