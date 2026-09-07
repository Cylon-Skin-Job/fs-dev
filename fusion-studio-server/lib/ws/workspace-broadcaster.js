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
 * subscribe to bus events at startup and serialize workspace bind delivery.
 *
 * This module owns ONE job: translating workspace/thread bus events
 * to wire messages and delivering them. It does NOT own:
 *   - Emitting workspace events (that's the workspace-controller).
 *   - Creating per-client session state (that's server.js); bind transitions
 *     are intentionally delegated to workspace-session.
 *   - Client-side handling (that's the future workspaceStore).
 */

const { on } = require('../event-bus');
const path = require('path');
const fsPromises = require('fs').promises;
const registry = require('../workspace/registry-service');
const themesService = require('../theme/themes-service');
const aiPaths = require('../workspace/ai-paths');
const { buildPanelConfig } = require('./connection-init');
const {
  beginWorkspaceBind,
  completeWorkspaceBind,
} = require('./workspace-session');
const { beginWorkspaceTransition } = require('./workspace-operation-lease');
const ThreadWebSocketHandler = require('../thread/ThreadWebSocketHandler');

const STYLE_FILES = [
  'variables.css',
  'themes.css',
  'components.css',
  'views.css',
  'file-viewer.css',
  'capture-viewer.css',
  'tints.css',
];

async function readWorkspaceStyles(repoPath) {
  if (!repoPath) return {};
  const settingsDir = aiPaths.getSystemStylesRoot(repoPath);
  const styles = {};
  await Promise.all(
    STYLE_FILES.map(async (file) => {
      try {
        const css = await fsPromises.readFile(path.join(settingsDir, file), 'utf8');
        styles[file] = css;
      } catch {
        // ENOENT is fine — not every workspace has every layer
        styles[file] = '';
      }
    })
  );
  return styles;
}

/**
 * Initialize the workspace broadcaster. Call once at server startup,
 * BEFORE server.listen() opens the port so boot-time workspace availability
 * events reach subscribers.
 *
 * @param {object} deps
 * @param {() => import('ws').WebSocket[]} deps.getAllClients
 *        Returns every open WebSocket in the sessions map.
 * @param {(connectionId: string) => import('ws').WebSocket|null} deps.getClientByConnectionId
 *        Returns the WebSocket for a specific connectionId, or null.
 * @returns {{ started: boolean }}
 */
function createWorkspaceBroadcaster({ getAllClients, getClientByConnectionId, getSessionForClient }) {
  let workspaceSwitchBroadcastQueue = Promise.resolve();

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

  function broadcastThreadLifecycle(event) {
    if (typeof event.workspaceId !== 'string' || !event.workspaceId
      || typeof event.projectRoot !== 'string' || !event.projectRoot
      || typeof event.workspaceEpoch !== 'string' || !event.workspaceEpoch) return;
    const payload = JSON.stringify({
      type: 'thread:state_changed',
      threadId: event.threadId,
      workspace: event.workspace,
      workspaceId: event.workspaceId,
      projectRoot: event.projectRoot,
      workspaceEpoch: event.workspaceEpoch,
      turnId: event.turnId,
      state: event.state,
      previousState: event.previousState,
    });
    for (const ws of getAllClients()) {
      if (ws.readyState !== 1) continue;
      const session = getSessionForClient?.(ws);
      const threadState = ThreadWebSocketHandler.getState?.(ws);
      if (!session || session.workspaceBindingState !== 'active'
        || session.currentWorkspaceId !== event.workspaceId
        || session.projectRoot !== event.projectRoot
        || session.workspaceEpoch !== event.workspaceEpoch
        || !threadState || threadState.workspaceRetired === true
        || threadState.threadManager?.workspaceId !== event.workspaceId
        || threadState.threadManager?.projectRoot !== event.projectRoot) continue;
      ws.send(payload);
    }
  }

  async function broadcastWorkspaceSwitched(event) {
    const clients = getAllClients().filter((ws) => ws.readyState === 1);
    const bindings = (await Promise.all(clients.map(async (ws) => {
      const session = getSessionForClient?.(ws);
      if (!session) return null;
      try {
        return Object.freeze({
          ws,
          session,
          pair: await beginWorkspaceTransition(ws, async () => {
            const workspaceChanges = session.currentWorkspaceId !== event.to
              || session.projectRoot !== event.repoPath;
            if (workspaceChanges) await ThreadWebSocketHandler.retireWorkspaceBinding(ws, session);
            return beginWorkspaceBind(session, {
              workspaceId: event.to,
              repoPath: event.repoPath,
            });
          }),
        });
      } catch (_error) {
        try { ws.close(1011, 'workspace retirement failed'); } catch (_closeError) {}
        return null;
      }
    }))).filter(Boolean);
    let baseMessage;
    try {
      const target = event.to ? await registry.getById(event.to) : null;
      baseMessage = {
        type: 'workspace:switched',
        fileSaveProtocolVersion: 1,
        resourceProvenanceProtocolVersion: 1,
        agentActivityProtocolVersion: 1,
        fileViewerReadProtocolVersion: 1,
        from: event.from,
        to: event.to,
        repoPath: event.repoPath,
        workspaceType: target ? target.type : 'code',
      };

      // WORKSPACE_ISOLATION_SPEC: include compiled CSS so the client can
      // inject styles synchronously without 7 separate WebSocket round-trips.
      if (event.repoPath) {
        try {
          baseMessage.styles = await readWorkspaceStyles(event.repoPath);
        } catch (err) {
          console.error('[WorkspaceBroadcaster] Failed to read styles:', err.message);
          baseMessage.styles = {};
        }

        // Include themes so the client's theme picker stays in sync.
        try {
          const themes = await themesService.list(event.repoPath);
          baseMessage.themes = themes;
          const active = themes.find(t => t.active);
          baseMessage.activeThemeId = active ? active.id : null;
        } catch (err) {
          console.error('[WorkspaceBroadcaster] Failed to read themes:', err.message);
          baseMessage.themes = [];
          baseMessage.activeThemeId = null;
        }
      }
    } catch (error) {
      console.error('[WorkspaceBroadcaster] Failed to build switch frame:', error.message);
      for (const { ws } of bindings) {
        try { ws.close(1011, 'workspace bind failed'); } catch (_closeError) {}
      }
      return;
    }

    const completed = [];
    for (const binding of bindings) {
      if (await completeWorkspaceBind(binding.ws, binding.session, baseMessage, binding.pair)) {
        completed.push(binding);
      }
    }

    if (event.repoPath) {
      // Send panel_config after workspace:switched. The client activates the
      // new workspace on that message, which clears old per-workspace roots.
      // Link/copy/send-to-chat actions consume these resolved content roots
      // through the shared resource-path module.
      for (const { ws } of completed) {
        if (ws.readyState === 1) ws.send(JSON.stringify(buildPanelConfig(event.repoPath)));
      }
    }
  }

  function queueWorkspaceSwitchBroadcast(event) {
    workspaceSwitchBroadcastQueue = workspaceSwitchBroadcastQueue
      .catch(() => {})
      .then(() => broadcastWorkspaceSwitched(event));
    return workspaceSwitchBroadcastQueue;
  }

  // --- Broadcast subscriptions ---

  on('workspace:added', (event) => {
    broadcastAll({ type: 'workspace:added', workspace: event.workspace });
  });

  on('workspace:removed', (event) => {
    broadcastAll({ type: 'workspace:removed', workspaceId: event.workspaceId });
  });

  on('workspace:ribbon_removed', (event) => {
    return workspaceSwitchBroadcastQueue.then(() => {
      broadcastAll({ type: 'workspace:ribbon_removed', workspaceId: event.workspaceId });
    });
  });

  on('workspace:registry_changed', (event) => {
    broadcastAll({ type: 'workspace:registry_changed', workspaces: event.workspaces });
  });

  on('workspace:created', (event) => {
    if (!event.connectionId) return;
    sendTargeted(event.connectionId, {
      type: 'workspace:created',
      workspace: event.workspace,
    });
  });

  on('workspace:switched', (event) => {
    return queueWorkspaceSwitchBroadcast(event);
  });

  on('workspace:unavailable_at_launch', (event) => {
    broadcastAll({
      type: 'workspace:unavailable_at_launch',
      workspaceId: event.workspaceId,
      reason: event.reason,
    });
  });

  on('thread:state_changed', (event) => {
    broadcastThreadLifecycle(event);
  });

  // --- Targeted subscriptions ---

  on('workspace:add_rejected_duplicate', (event) => {
    if (!event.connectionId) return;
    sendTargeted(event.connectionId, {
      type: 'workspace:add_rejected_duplicate',
      existingWorkspace: event.existingWorkspace,
    });
  });

  on('workspace:add_rejected_missing_ai', (event) => {
    if (!event.connectionId) return;
    sendTargeted(event.connectionId, {
      type: 'workspace:add_rejected_missing_ai',
      repoPath: event.repoPath,
    });
  });

  on('workspace:create_rejected', (event) => {
    if (!event.connectionId) return;
    sendTargeted(event.connectionId, {
      type: 'workspace:create_rejected',
      message: event.message,
    });
  });

  on('workspace:ribbon_reorder_rejected', (event) => {
    if (!event.connectionId) return;
    sendTargeted(event.connectionId, {
      type: 'workspace:ribbon_reorder_rejected',
      message: event.message,
    });
  });

  console.log('[WorkspaceBroadcaster] Started');
  return { started: true };
}

module.exports = { createWorkspaceBroadcaster };
