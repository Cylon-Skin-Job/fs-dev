/**
 * @module workspace-request-handlers
 * @role Per-connection handlers for workspace lifecycle, folder browse,
 *       view state, and file:move WebSocket messages.
 *
 * Factory — call once per connection inside createClientMessageRouter.
 * Returns a handler map keyed by message type.
 *
 * Covers:
 *   workspace:add_requested / switch_requested / remove_requested
 *   folder:browse
 *   state:get / state:set
 *   file:move
 */

const path = require('path');
const fsPromises = require('fs').promises;
const { emit } = require('../event-bus');
const { resolveViewState, writeViewStatePatch } = require('../view-state');
const { moveFileWithArchive } = require('../file-ops');

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 */
function createWorkspaceRequestHandlers({ ws, session }) {
  return {
    // ---- Workspace lifecycle (MULTI_WORKSPACE_SPEC) ----

    'workspace:add_requested'(clientMsg) {
      if (typeof clientMsg.repoPath !== 'string' || clientMsg.repoPath.trim() === '') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'workspace:add_requested requires repoPath',
        }));
        return;
      }
      emit('workspace:add_requested', {
        repoPath: clientMsg.repoPath,
        connectionId: session.connectionId,
      });
    },

    'workspace:switch_requested'(clientMsg) {
      if (typeof clientMsg.workspaceId !== 'string' || clientMsg.workspaceId.trim() === '') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'workspace:switch_requested requires workspaceId',
        }));
        return;
      }
      emit('workspace:switch_requested', {
        workspaceId: clientMsg.workspaceId,
        connectionId: session.connectionId,
      });
    },

    'workspace:remove_requested'(clientMsg) {
      if (typeof clientMsg.workspaceId !== 'string' || clientMsg.workspaceId.trim() === '') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'workspace:remove_requested requires workspaceId',
        }));
        return;
      }
      emit('workspace:remove_requested', {
        workspaceId: clientMsg.workspaceId,
        connectionId: session.connectionId,
      });
    },

    // ---- Folder picker (FOLDER_PICKER_SPEC) ----

    async 'folder:browse'(clientMsg) {
      const browsePath = clientMsg.path || '/';
      try {
        const resolved = path.resolve(browsePath);
        const entries = await fsPromises.readdir(resolved, { withFileTypes: true });
        const folders = [];

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith('.')) continue;
          if (entry.name === 'node_modules') continue;

          const fullPath = path.join(resolved, entry.name);
          let hasChildren = false;
          let isRepo = false;
          try {
            const children = await fsPromises.readdir(fullPath);
            hasChildren = children.length > 0;
            isRepo = children.includes('.git');
          } catch (_) {}

          folders.push({ name: entry.name, path: fullPath, hasChildren, isRepo });
        }

        folders.sort((a, b) => a.name.localeCompare(b.name));
        const parent = resolved === '/' ? null : path.dirname(resolved);
        ws.send(JSON.stringify({
          type: 'folder:browse_result',
          path: resolved,
          folders,
          parent,
          success: true,
        }));
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'folder:browse_result',
          path: browsePath,
          success: false,
          error: err.message,
        }));
      }
    },

    // ---- View UI state (SPEC-26c-2) ----

    async 'state:get'(clientMsg) {
      try {
        const projectRoot = session.projectRoot;
        if (!projectRoot) {
          ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
          return;
        }
        const state = await resolveViewState(projectRoot, clientMsg.view);
        ws.send(JSON.stringify({
          type: 'state:result',
          view: clientMsg.view,
          state,
        }));
      } catch (err) {
        console.error('[state:get] failed:', err);
        ws.send(JSON.stringify({ type: 'state:error', message: err.message }));
      }
    },

    async 'state:set'(clientMsg) {
      try {
        const projectRoot = session.projectRoot;
        if (!projectRoot) {
          ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
          return;
        }
        const merged = await writeViewStatePatch(projectRoot, clientMsg.view, clientMsg.state);
        ws.send(JSON.stringify({
          type: 'state:result',
          view: clientMsg.view,
          state: merged,
        }));
      } catch (err) {
        console.error('[state:set] failed:', err);
        ws.send(JSON.stringify({ type: 'state:error', message: err.message }));
      }
    },

    // ---- File move ----

    'file:move'(clientMsg) {
      try {
        const { source, target } = clientMsg;
        const projectRoot = session.projectRoot;
        if (!projectRoot) {
          ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
          return;
        }
        const result = moveFileWithArchive(source, target, projectRoot);
        emit('system:file_deployed', {
          source,
          target,
          archived: result.archived,
          moved: result.moved,
        });
        ws.send(JSON.stringify({
          type: 'file:moved',
          ...result,
        }));
      } catch (err) {
        console.error(`[FileMove] ${err.message}`);
        ws.send(JSON.stringify({
          type: 'file:move_error',
          error: err.message,
        }));
      }
    },
  };
}

module.exports = { createWorkspaceRequestHandlers };
