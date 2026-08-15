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
const { classifyEntry } = require('../fs/dirents');

const OFFICE_PANEL = 'office-viewer';
const OFFICE_THUMBNAIL_FOLDER = '.thumbnails';

function officeThumbnailPathForDocument(documentPath) {
  return path.join(path.dirname(documentPath), OFFICE_THUMBNAIL_FOLDER, `${path.basename(documentPath)}.png`);
}

async function moveOfficeThumbnail(sourcePath, targetPath) {
  const sourceThumbnail = officeThumbnailPathForDocument(sourcePath);
  if (!fs.existsSync(sourceThumbnail)) return;
  const targetThumbnail = officeThumbnailPathForDocument(targetPath);
  if (sourceThumbnail === targetThumbnail) return;
  await fsPromises.mkdir(path.dirname(targetThumbnail), { recursive: true });
  if (fs.existsSync(targetThumbnail)) {
    await fsPromises.rm(targetThumbnail, { force: true });
  }
  await fsPromises.rename(sourceThumbnail, targetThumbnail);
}

async function removeOfficeThumbnail(documentPath) {
  await fsPromises.rm(officeThumbnailPathForDocument(documentPath), { force: true });
}

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 * @param {() => import('ws').WebSocket[]} deps.getAllClients
 */
function createWorkspaceRequestHandlers({ ws, session, getAllClients }) {
  const mutationPanels = ['capture-viewer', 'office-viewer', 'email-viewer', 'file-viewer'];

  function isPathInside(root, candidate) {
    const relative = path.relative(path.resolve(root), path.resolve(candidate));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  function isValidEntryName(name) {
    return Boolean(name) &&
      !name.includes('/') &&
      !name.includes('\\') &&
      name !== '.' &&
      name !== '..';
  }

  function broadcastFileChanged(panel, filePath) {
    const clients = getAllClients ? getAllClients() : [];
    if (!clients.length) return;
    const payload = JSON.stringify({ type: 'file_changed', panel, filePath });
    for (const client of clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  function relativeToPanel(absPath) {
    const resolvedPath = path.resolve(absPath);
    for (const panel of mutationPanels) {
      const panelRoot = getPanelPath(panel, ws);
      if (!panelRoot) continue;
      const rel = path.relative(path.resolve(panelRoot), resolvedPath);
      if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
        return { panel, path: rel.split(path.sep).join('/') };
      }
    }
    return null;
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
      emit('workspace:create_requested', {
        projectPath: clientMsg.projectPath,
        label: typeof clientMsg.label === 'string' ? clientMsg.label : '',
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
          const classified = await classifyEntry(resolved, entry);
          if (!classified.isDir) continue;
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
          clientMutationId: clientMsg.clientMutationId,
          state: merged,
        }));
      } catch (err) {
        console.error('[state:set] failed:', err);
        ws.send(JSON.stringify({
          type: 'state:error',
          view: clientMsg.view,
          clientMutationId: clientMsg.clientMutationId,
          message: err.message,
        }));
      }
    },

    // ---- File move ----

    async 'file:move'(clientMsg) {
      try {
        const { source, target } = clientMsg;
        const projectRoot = session.projectRoot;
        if (!projectRoot) {
          ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
          return;
        }
        if (!isPathInside(projectRoot, source) || !isPathInside(projectRoot, target)) {
          ws.send(JSON.stringify({ type: 'file:move_error', error: 'Source or target path outside project root' }));
          return;
        }
        const sourceStat = fs.statSync(source);
        const sourceIsDirectory = sourceStat.isDirectory();
        const result = moveFileWithArchive(source, target, projectRoot);
        emit('system:file_deployed', {
          source,
          target,
          archived: result.archived,
          moved: result.moved,
        });
        const sourceRef = relativeToPanel(source);
        const targetRef = relativeToPanel(result.moved);
        if (!sourceIsDirectory && sourceRef?.panel === OFFICE_PANEL && targetRef?.panel === OFFICE_PANEL) {
          await moveOfficeThumbnail(source, result.moved);
        }
        if (sourceRef) broadcastFileChanged(sourceRef.panel, sourceRef.path);
        if (targetRef) broadcastFileChanged(targetRef.panel, targetRef.path);
        ws.send(JSON.stringify({
          type: 'file:moved',
          ...result,
          sourcePanel: sourceRef?.panel,
          sourcePath: sourceRef?.path,
          targetPanel: targetRef?.panel,
          targetPath: targetRef?.path,
          sourceIsDirectory,
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
        const trimmedName = typeof newName === 'string' ? newName.trim() : '';
        if (typeof source !== 'string' || !isValidEntryName(trimmedName)) {
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
        if (!isPathInside(resolvedRoot, resolvedSource) || resolvedSource === resolvedRoot) {
          ws.send(JSON.stringify({ type: 'file:rename_error', error: 'Source path outside project root' }));
          return;
        }
        const sourceStat = await fsPromises.stat(resolvedSource);
        const sourceIsDirectory = sourceStat.isDirectory();
        const target = path.join(path.dirname(resolvedSource), trimmedName);
        if (fs.existsSync(target)) {
          ws.send(JSON.stringify({ type: 'file:rename_error', error: 'A file with that name already exists' }));
          return;
        }
        await fsPromises.rename(resolvedSource, target);
        const sourceRef = relativeToPanel(resolvedSource);
        const targetRef = relativeToPanel(target);
        if (!sourceIsDirectory && sourceRef?.panel === OFFICE_PANEL && targetRef?.panel === OFFICE_PANEL) {
          await moveOfficeThumbnail(resolvedSource, target);
        }
        if (sourceRef) broadcastFileChanged(sourceRef.panel, sourceRef.path);
        if (targetRef) broadcastFileChanged(targetRef.panel, targetRef.path);
        ws.send(JSON.stringify({
          type: 'file:renamed',
          source,
          target,
          newName: trimmedName,
          sourcePanel: sourceRef?.panel,
          sourcePath: sourceRef?.path,
          targetPanel: targetRef?.panel,
          targetPath: targetRef?.path,
          sourceIsDirectory,
        }));
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
        if (!isPathInside(resolvedRoot, resolvedSource) || resolvedSource === resolvedRoot) {
          ws.send(JSON.stringify({ type: 'file:delete_error', error: 'Source path outside project root' }));
          return;
        }
        const sourceStat = await fsPromises.stat(resolvedSource);
        const sourceIsDirectory = sourceStat.isDirectory();
        if (sourceIsDirectory) {
          await fsPromises.rm(resolvedSource, { recursive: true, force: false });
        } else {
          await fsPromises.unlink(resolvedSource);
        }
        const sourceRef = relativeToPanel(resolvedSource);
        if (!sourceIsDirectory && sourceRef?.panel === OFFICE_PANEL) {
          await removeOfficeThumbnail(resolvedSource);
        }
        if (sourceRef) broadcastFileChanged(sourceRef.panel, sourceRef.path);
        ws.send(JSON.stringify({
          type: 'file:deleted',
          source,
          sourcePanel: sourceRef?.panel,
          sourcePath: sourceRef?.path,
          sourceIsDirectory,
        }));
      } catch (err) {
        console.error(`[FileDelete] ${err.message}`);
        ws.send(JSON.stringify({ type: 'file:delete_error', error: err.message }));
      }
    },

    async 'office:thumbnail_save'(clientMsg) {
      const documentPath = typeof clientMsg.documentPath === 'string' ? clientMsg.documentPath : '';
      try {
        const { dataUrl } = clientMsg;
        if (!documentPath || path.isAbsolute(documentPath) || documentPath.split(/[\\/]/).includes(OFFICE_THUMBNAIL_FOLDER)) {
          ws.send(JSON.stringify({
            type: 'office:thumbnail_error',
            documentPath,
            error: 'Invalid document path',
          }));
          return;
        }
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
          ws.send(JSON.stringify({
            type: 'office:thumbnail_error',
            documentPath,
            error: 'office:thumbnail_save requires a PNG dataUrl',
          }));
          return;
        }

        const panelRoot = getPanelPath(OFFICE_PANEL, ws);
        if (!panelRoot) {
          ws.send(JSON.stringify({
            type: 'office:thumbnail_error',
            documentPath,
            error: 'Office panel root not loaded',
          }));
          return;
        }

        const basePath = path.resolve(panelRoot);
        const resolvedDocument = path.resolve(basePath, documentPath);
        if (!isPathInside(basePath, resolvedDocument) || resolvedDocument === basePath) {
          ws.send(JSON.stringify({
            type: 'office:thumbnail_error',
            documentPath,
            error: 'Document path outside Office root',
          }));
          return;
        }

        const stat = await fsPromises.stat(resolvedDocument);
        if (!stat.isFile()) {
          ws.send(JSON.stringify({
            type: 'office:thumbnail_error',
            documentPath,
            error: 'Expected document file',
          }));
          return;
        }

        const thumbnailPath = officeThumbnailPathForDocument(resolvedDocument);
        if (!isPathInside(basePath, thumbnailPath)) {
          ws.send(JSON.stringify({
            type: 'office:thumbnail_error',
            documentPath,
            error: 'Thumbnail path outside Office root',
          }));
          return;
        }

        const buffer = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
        await fsPromises.mkdir(path.dirname(thumbnailPath), { recursive: true });
        await fsPromises.writeFile(thumbnailPath, buffer);
        const savedAt = Date.now();
        ws.send(JSON.stringify({
          type: 'office:thumbnail_saved',
          documentPath,
          thumbnailPath: path.relative(basePath, thumbnailPath).split(path.sep).join('/'),
          savedAt,
        }));
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'office:thumbnail_error',
          documentPath,
          error: err.message,
        }));
      }
    },
  };
}

module.exports = { createWorkspaceRequestHandlers };
