/**
 * @module workspace-request-handlers
 * @role Per-connection handlers for workspace lifecycle, folder browse,
 *       view state, and file:move WebSocket messages.
 *
 * Factory — call once per connection inside createClientMessageRouter.
 * Returns a handler map keyed by message type.
 *
 * Covers:
 *   workspace:add_requested / switch_requested / remove_requested / ribbon_remove_requested / ribbon_add_requested / ribbon_reorder_requested
 *   folder:browse
 *   state:get / state:set
 *   file:move
 */

const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { emit } = require('../event-bus');
const { resolveViewState, writeViewStatePatch } = require('../view-state');
const { moveFileWithArchive } = require('../file-ops');
const createService = require('../workspace/create-service');
const { getPanelPath } = require('../views/panel-paths');

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 * @param {() => import('ws').WebSocket[]} deps.getAllClients
 */
function createWorkspaceRequestHandlers({ ws, session, getAllClients }) {
  function broadcastFileChanged(filePath) {
    const clients = getAllClients ? getAllClients() : [];
    if (!clients.length) return;
    const payload = JSON.stringify({ type: 'file_changed', panel: 'doc-viewer', filePath });
    for (const client of clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  function relativeToDocViewer(absPath) {
    const panelRoot = getPanelPath('doc-viewer', ws);
    if (!panelRoot) return null;
    const rel = path.relative(panelRoot, absPath);
    if (rel.startsWith('..')) return null;
    return rel.split(path.sep).join('/');
  }
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

    'workspace:ribbon_remove_requested'(clientMsg) {
      if (typeof clientMsg.workspaceId !== 'string' || clientMsg.workspaceId.trim() === '') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'workspace:ribbon_remove_requested requires workspaceId',
        }));
        return;
      }
      emit('workspace:ribbon_remove_requested', {
        workspaceId: clientMsg.workspaceId,
        connectionId: session.connectionId,
      });
    },

    'workspace:ribbon_add_requested'(clientMsg) {
      if (typeof clientMsg.workspaceId !== 'string' || clientMsg.workspaceId.trim() === '') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'workspace:ribbon_add_requested requires workspaceId',
        }));
        return;
      }
      emit('workspace:ribbon_add_requested', {
        workspaceId: clientMsg.workspaceId,
        connectionId: session.connectionId,
      });
    },

    'workspace:ribbon_reorder_requested'(clientMsg) {
      if (!Array.isArray(clientMsg.workspaceIds) || clientMsg.workspaceIds.length === 0) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'workspace:ribbon_reorder_requested requires workspaceIds',
        }));
        return;
      }
      if (clientMsg.workspaceIds.some((workspaceId) => typeof workspaceId !== 'string' || workspaceId.trim() === '')) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'workspace:ribbon_reorder_requested workspaceIds must be strings',
        }));
        return;
      }
      emit('workspace:ribbon_reorder_requested', {
        workspaceIds: clientMsg.workspaceIds,
        connectionId: session.connectionId,
      });
    },

    'workspace:create_manifest_requested'() {
      try {
        ws.send(JSON.stringify({
          type: 'workspace:create_manifest',
          manifest: createService.readManifest(),
        }));
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'workspace:create_rejected',
          message: 'Unable to load view templates: ' + err.message,
        }));
      }
    },

    'workspace:create_requested'(clientMsg) {
      if (typeof clientMsg.projectPath !== 'string' || clientMsg.projectPath.trim() === '') {
        ws.send(JSON.stringify({
          type: 'workspace:create_rejected',
          message: 'Create New requires a project path.',
        }));
        return;
      }
      if (clientMsg.viewIds !== undefined && !Array.isArray(clientMsg.viewIds)) {
        ws.send(JSON.stringify({
          type: 'workspace:create_rejected',
          message: 'workspace:create_requested viewIds must be an array when provided.',
        }));
        return;
      }
      emit('workspace:create_requested', {
        projectPath: clientMsg.projectPath,
        label: typeof clientMsg.label === 'string' ? clientMsg.label : '',
        viewIds: Array.isArray(clientMsg.viewIds) ? clientMsg.viewIds : undefined,
        workspaceTemplateId: typeof clientMsg.workspaceTemplateId === 'string' ? clientMsg.workspaceTemplateId : undefined,
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
        const sourceRel = relativeToDocViewer(source);
        const targetRel = relativeToDocViewer(result.moved);
        if (sourceRel) broadcastFileChanged(sourceRel);
        if (targetRel) broadcastFileChanged(targetRel);
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

    async 'file:rename'(clientMsg) {
      try {
        const { source, newName } = clientMsg;
        if (typeof source !== 'string' || typeof newName !== 'string' || !newName.trim()) {
          ws.send(JSON.stringify({ type: 'file:rename_error', error: 'Source and newName are required' }));
          return;
        }
        const projectRoot = session.projectRoot;
        if (!projectRoot) {
          ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
          return;
        }
        const resolvedSource = path.resolve(source);
        const resolvedRoot = path.resolve(projectRoot);
        if (!resolvedSource.startsWith(resolvedRoot)) {
          ws.send(JSON.stringify({ type: 'file:rename_error', error: 'Source path outside project root' }));
          return;
        }
        const target = path.join(path.dirname(resolvedSource), newName.trim());
        if (fs.existsSync(target)) {
          ws.send(JSON.stringify({ type: 'file:rename_error', error: 'A file with that name already exists' }));
          return;
        }
        await fsPromises.rename(resolvedSource, target);
        const sourceRel = relativeToDocViewer(resolvedSource);
        const targetRel = relativeToDocViewer(target);
        if (sourceRel) broadcastFileChanged(sourceRel);
        if (targetRel) broadcastFileChanged(targetRel);
        ws.send(JSON.stringify({ type: 'file:renamed', source, target, newName }));
      } catch (err) {
        console.error(`[FileRename] ${err.message}`);
        ws.send(JSON.stringify({ type: 'file:rename_error', error: err.message }));
      }
    },

    async 'file:delete'(clientMsg) {
      try {
        const { source } = clientMsg;
        if (typeof source !== 'string') {
          ws.send(JSON.stringify({ type: 'file:delete_error', error: 'Source is required' }));
          return;
        }
        const projectRoot = session.projectRoot;
        if (!projectRoot) {
          ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
          return;
        }
        const resolvedSource = path.resolve(source);
        const resolvedRoot = path.resolve(projectRoot);
        if (!resolvedSource.startsWith(resolvedRoot)) {
          ws.send(JSON.stringify({ type: 'file:delete_error', error: 'Source path outside project root' }));
          return;
        }
        await fsPromises.unlink(resolvedSource);
        const sourceRel = relativeToDocViewer(resolvedSource);
        if (sourceRel) broadcastFileChanged(sourceRel);
        ws.send(JSON.stringify({ type: 'file:deleted', source }));
      } catch (err) {
        console.error(`[FileDelete] ${err.message}`);
        ws.send(JSON.stringify({ type: 'file:delete_error', error: err.message }));
      }
    },
  };
}

module.exports = { createWorkspaceRequestHandlers };
