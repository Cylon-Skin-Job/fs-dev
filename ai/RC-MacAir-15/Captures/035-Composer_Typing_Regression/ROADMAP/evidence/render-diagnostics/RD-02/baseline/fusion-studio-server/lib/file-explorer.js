/**
 * File Explorer Handlers
 *
 * Extracted from server.js — handles the three file_*_request client
 * message types: file_tree_request, file_content_request,
 * recent_files_request. Includes path security, error code mapping,
 * and filename parsing helpers used by those handlers.
 *
 * Uses a factory pattern so server.js can inject getPanelPath (which
 * depends on per-WS session roots and the views resolver) and
 * getProjectRoot (used by virtual V2 content).
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { commitIfChanged, resolveGitMutationPaths } = require('./versioning');
const views = require('./views');
const { getPanelArchiveFolder, isPanelArchiveRoot } = require('./view-folders');
const { classifyEntry, isInsidePath } = require('./fs/dirents');
const { createCycleGuard } = require('./fs/cycle-guard');
const { resolveSymlinkInfo } = require('./fs/symlinks');
const { assertGenericViewMutationAllowed } = require('./views/protected-path-policy');

/**
 * @param {object} deps
 * @param {(panel: string, ws: import('ws').WebSocket) => string|null} deps.getPanelPath
 * @param {(ws?: import('ws').WebSocket) => string|null} deps.getProjectRoot
 */
function createFileExplorerHandlers({ getPanelPath, getProjectRoot }) {

  async function assertMutationAllowed(ws, paths) {
    const projectRoot = getProjectRoot(ws);
    if (!projectRoot) throw Object.assign(new Error('No active workspace'), { code: 'ENOENT' });
    await assertGenericViewMutationAllowed({ projectRoot, paths });
  }

  function mapFileErrorCode(err) {
    if (err.code === 'ENOENT') return 'ENOENT';
    if (err.code === 'EACCES' || err.code === 'EPERM') return 'EACCES';
    if (err.code === 'ENOTDIR') return 'ENOTDIR';
    if (err.code === 'EISDIR') return 'EISDIR';
    if (err.code === 'EEXIST') return 'EEXIST';
    if (err.code === 'EINVAL') return 'EINVAL';
    return 'UNKNOWN';
  }

  function isPathAllowed(basePath, targetPath) {
    // Policy: containment is checked against the logical panel path only.
    // Runtime reads follow user-created symlinks, including external targets.
    return isInsidePath(basePath, targetPath);
  }

  function parseExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot <= 0) return undefined;
    return filename.slice(lastDot + 1).toLowerCase();
  }

  function yamlQuoted(value) {
    return JSON.stringify(String(value || ''));
  }

  function createMarkdownDocumentContent(title) {
    const displayName = String(title || 'Untitled').trim() || 'Untitled';
    return [
      '---',
      `name: ${yamlQuoted(displayName)}`,
      'description: ""',
      'metadata:',
      '  display:',
      '    font:',
      '      family: serif',
      '      size: 16',
      '    alignment: left',
      '    margins:',
      '      top: 72',
      '      bottom: 72',
      '      left: 90',
      '      right: 90',
      '  tables: []',
      '---',
      '',
      `# ${displayName}`,
      '',
    ].join('\n');
  }

  function isHiddenPanelRootFolder(panel, requestPath, entryName) {
    return isPanelArchiveRoot(panel, requestPath, entryName);
  }

  function requestCorrelation(msg) {
    return {
      ...(typeof msg.requestId === 'string' ? { requestId: msg.requestId } : {}),
      ...(typeof msg.workspaceId === 'string' || msg.workspaceId === null
        ? { workspaceId: msg.workspaceId }
        : {}),
      ...(Number.isSafeInteger(msg.generation) ? { generation: msg.generation } : {}),
    };
  }

  function sendVirtualFileContent(ws, panel, requestPath, content, correlation) {
    ws.send(JSON.stringify({
      type: 'file_content_response',
      panel,
      path: requestPath,
      ...correlation,
      success: true,
      content,
      size: Buffer.byteLength(content),
      lastModified: Date.now(),
    }));
  }

  function sendVirtualFileNotFound(ws, panel, requestPath, correlation) {
    ws.send(JSON.stringify({
      type: 'file_content_response',
      panel,
      path: requestPath,
      ...correlation,
      success: false,
      error: 'Not found',
      code: 'ENOENT',
    }));
  }

  function getVirtualV2FileContent(projectRoot, panel, requestPath) {
    if (!projectRoot || !views.hasV2Views(projectRoot)) return undefined;

    if (panel === '__workspace__' && requestPath === 'views.json') {
      const registry = {
        version: 2,
        sort: 'filesystem-prefix',
        views: views.loadAllViews(projectRoot).map((view, index) => ({
          id: view.id,
          baseViewId: view.id,
          label: view.index?.label || view.id,
          icon: view.index?.icon || 'folder',
          rank: typeof view.index?.rank === 'number' ? view.index.rank : index + 1,
          enabled: true,
          source: 'default',
          viewPath: path.relative(projectRoot, view.viewRoot),
        })),
      };
      return JSON.stringify(registry, null, 2);
    }

    if (panel !== '__panels__') return undefined;

    const match = String(requestPath || '').match(/^([^/]+)\/(.+)$/);
    if (!match) return undefined;

    const viewId = match[1];
    const viewPath = match[2];
    const view = views.loadView(projectRoot, viewId, { includeHidden: true });
    if (!view || view.v2 !== true) return undefined;

    if (viewPath === 'index.json') {
      return JSON.stringify(view.index || {}, null, 2);
    }
    if (viewPath === 'content.json') {
      return JSON.stringify(view.content || {}, null, 2);
    }
    if (viewPath === 'styles/layout.json') {
      return JSON.stringify(view.layout || {}, null, 2);
    }
    if (viewPath === 'styles/icon.md') {
      return readVirtualViewFile(view.viewRoot, 'styles/icon.md');
    }
    if (viewPath === 'styles/layout.css') {
      return readVirtualViewFile(view.viewRoot, 'styles/layout.css');
    }
    if (viewPath === 'styles/themes.css') {
      return readVirtualViewFile(view.viewRoot, 'styles/themes.css');
    }

    return readVirtualViewFile(view.viewRoot, viewPath);
  }

  function readVirtualViewFile(viewRoot, relativePath) {
    const basePath = path.resolve(viewRoot);
    const targetPath = path.resolve(basePath, relativePath);
    const relative = path.relative(basePath, targetPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    if (!isPathAllowed(basePath, targetPath)) return null;

    try {
      return fs.readFileSync(targetPath, 'utf8');
    } catch {
      return null;
    }
  }

  async function handleFileTreeRequest(ws, msg) {
    const panel = msg.panel || 'file-viewer';
    const requestPath = msg.path || '';
    const includeHiddenFolders = msg.includeHiddenFolders === true;
    const correlation = requestCorrelation(msg);
    const panelPath = getPanelPath(panel, ws);

    if (panelPath === null) {
      ws.send(JSON.stringify({
        type: 'file_tree_response',
        panel,
        path: requestPath,
        ...correlation,
        success: false,
        error: `Panel "${panel}" is not filesystem-backed`,
        code: 'ENOTPANEL',
      }));
      return;
    }

    const basePath = path.resolve(panelPath);
    const targetPath = requestPath ? path.join(basePath, requestPath) : basePath;

    if (!isPathAllowed(basePath, targetPath)) {
      ws.send(JSON.stringify({
        type: 'file_tree_response',
        panel,
        path: requestPath,
        ...correlation,
        success: false,
        error: 'Invalid path',
        code: 'ENOENT',
      }));
      return;
    }

    try {
      const entries = await fsPromises.readdir(targetPath, { withFileTypes: true });
      const directorySymlinkInfo = await resolveSymlinkInfo(basePath, targetPath);

      if (entries.length > 1000) {
        ws.send(JSON.stringify({
          type: 'file_tree_response',
          panel,
          path: requestPath,
          ...correlation,
          success: false,
          error: `Folder has ${entries.length} items (max 1000). Use terminal to explore.`,
          code: 'ETOOLARGE',
        }));
        return;
      }

      const folders = [];
      const files = [];

      for (const entry of entries) {
        if (entry.name === 'node_modules') continue;
        if (isHiddenPanelRootFolder(panel, requestPath, entry.name)) continue;

        const entryPath = requestPath ? `${requestPath}/${entry.name}` : entry.name;
        const fullEntryPath = path.join(targetPath, entry.name);
        const classified = await classifyEntry(targetPath, entry);
        if (classified.isSymlink && classified.realPath === null) continue;

        if (entry.name.startsWith('.') && (!includeHiddenFolders || !classified.isDir)) continue;

        if (classified.isDir) {
          const entrySymlinkInfo = classified.isSymlink
            ? { isSymlink: true, symlinkTarget: classified.realPath }
            : directorySymlinkInfo.isSymlink
              ? await resolveSymlinkInfo(basePath, fullEntryPath)
              : {};
          let hasChildren = false;
          try {
            const children = await fsPromises.readdir(fullEntryPath, { withFileTypes: true });
            for (const child of children) {
              if (child.name === 'node_modules') continue;
              const childClassified = await classifyEntry(fullEntryPath, child);
              if (childClassified.isSymlink && childClassified.realPath === null) continue;
              if (!child.name.startsWith('.')) {
                hasChildren = true;
                break;
              }
              if (includeHiddenFolders && childClassified.isDir) {
                hasChildren = true;
                break;
              }
            }
          } catch (_) {}
          folders.push({
            name: entry.name,
            path: entryPath,
            type: 'folder',
            hasChildren,
            ...entrySymlinkInfo,
          });
        } else if (classified.isFile) {
          const entrySymlinkInfo = classified.isSymlink
            ? { isSymlink: true, symlinkTarget: classified.realPath }
            : directorySymlinkInfo.isSymlink
              ? await resolveSymlinkInfo(basePath, fullEntryPath)
              : {};
          files.push({
            name: entry.name,
            path: entryPath,
            type: 'file',
            extension: parseExtension(entry.name),
            ...entrySymlinkInfo,
          });
        }
      }

      folders.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));

      ws.send(JSON.stringify({
        type: 'file_tree_response',
        panel,
        path: requestPath,
        ...correlation,
        success: true,
        nodes: [...folders, ...files],
        ...directorySymlinkInfo,
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'file_tree_response',
        panel,
        path: requestPath,
        ...correlation,
        success: false,
        error: err.message,
        code: mapFileErrorCode(err),
      }));
    }
  }

  async function handleFileContentRequest(ws, msg) {
    const panel = msg.panel || 'file-viewer';
    const requestPath = msg.path || '';
    const correlation = requestCorrelation(msg);
    const virtualContent = getVirtualV2FileContent(getProjectRoot(ws), panel, requestPath);
    if (virtualContent !== undefined) {
      if (virtualContent === null) {
        sendVirtualFileNotFound(ws, panel, requestPath, correlation);
        return;
      }
      sendVirtualFileContent(ws, panel, requestPath, virtualContent, correlation);
      return;
    }

    const panelPath = getPanelPath(panel, ws);

    if (panelPath === null) {
      ws.send(JSON.stringify({
        type: 'file_content_response',
        panel,
        path: requestPath,
        ...correlation,
        success: false,
        error: `Panel "${panel}" is not filesystem-backed`,
        code: 'ENOTPANEL',
      }));
      return;
    }

    const basePath = path.resolve(panelPath);
    const targetPath = path.join(basePath, requestPath);

    if (!isPathAllowed(basePath, targetPath)) {
      ws.send(JSON.stringify({
        type: 'file_content_response',
        panel,
        path: requestPath,
        ...correlation,
        success: false,
        error: 'Invalid path',
        code: 'ENOENT',
      }));
      return;
    }

    try {
      const stat = await fsPromises.stat(targetPath);

      if (stat.isDirectory()) {
        ws.send(JSON.stringify({
          type: 'file_content_response',
          panel,
          path: requestPath,
          ...correlation,
          success: false,
          error: 'Expected file, got directory',
          code: 'EISDIR',
        }));
        return;
      }

      const symlinkInfo = await resolveSymlinkInfo(basePath, targetPath);
      let content = await fsPromises.readFile(targetPath, 'utf-8');

      // Enrich agents dashboard with human-readable schedule labels
      if (panel === 'agents-viewer' && requestPath === 'agents.json') {
        try {
          const { cronToLabel } = require('./cron-label');
          const index = JSON.parse(content);
          if (index.agents) {
            for (const agent of Object.values(index.agents)) {
              if (agent.schedule) {
                agent.schedule_label = cronToLabel(agent.schedule);
              }
            }
          }
          content = JSON.stringify(index, null, 2);
        } catch {}
      }

      ws.send(JSON.stringify({
        type: 'file_content_response',
        panel,
        path: requestPath,
        ...correlation,
        success: true,
        content,
        size: stat.size,
        lastModified: stat.mtimeMs,
        ...symlinkInfo,
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'file_content_response',
        panel,
        path: requestPath,
        ...correlation,
        success: false,
        error: err.message,
        code: mapFileErrorCode(err),
      }));
    }
  }

  async function handleRecentFilesRequest(ws, msg) {
    const panel = msg.panel || 'file-viewer';
    const limit = msg.limit || 30;
    const panelPath = getPanelPath(panel, ws);

    if (panelPath === null) {
      ws.send(JSON.stringify({
        type: 'recent_files_response',
        panel,
        success: false,
        error: `Panel "${panel}" is not filesystem-backed`,
        code: 'ENOTPANEL',
      }));
      return;
    }

    const basePath = path.resolve(panelPath);

    if (!isPathAllowed(basePath, basePath)) {
      ws.send(JSON.stringify({
        type: 'recent_files_response',
        panel,
        success: false,
        error: 'Invalid path',
        code: 'ENOENT',
      }));
      return;
    }

    try {
      const files = [];
      const cycleGuard = createCycleGuard();

      async function scanDir(dirPath, relativePath = '') {
        const realDirPath = await fsPromises.realpath(dirPath);
        if (!cycleGuard.shouldEnter(realDirPath)) return;

        const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          const entryFullPath = path.join(dirPath, entry.name);

          // Skip excluded patterns
          if (entry.name === 'node_modules' || entry.name === '.git' ||
              entry.name === 'dist' || entry.name === '.kimi' ||
              entry.name.startsWith('.')) {
            continue;
          }

          if (entryRelativePath === getPanelArchiveFolder(panel)) {
            continue;
          }

          const classified = await classifyEntry(dirPath, entry);
          if (classified.isSymlink && classified.realPath === null) continue;

          if (classified.isDir) {
            // Recurse into subdirectories (with depth limit)
            if (entryRelativePath.split('/').length < 5) {
              await scanDir(entryFullPath, entryRelativePath);
            }
          } else if (classified.isFile) {
            try {
              const stat = await fsPromises.stat(entryFullPath);
              files.push({
                name: entry.name,
                path: entryRelativePath,
                mtime: stat.mtimeMs,
                size: stat.size,
              });
            } catch {
              // Skip files we can't stat
            }
          }
        }
      }

      await scanDir(basePath);

      // Sort by mtime descending (newest first), then take limit, then reverse so newest is at bottom
      const sortedFiles = files
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit)
        .reverse();

      ws.send(JSON.stringify({
        type: 'recent_files_response',
        panel,
        success: true,
        files: sortedFiles,
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'recent_files_response',
        panel,
        success: false,
        error: err.message,
        code: mapFileErrorCode(err),
      }));
    }
  }

  async function handleFileSaveRequest(ws, msg) {
    const panel = msg.panel || 'file-viewer';
    const requestPath = msg.path || '';
    const content = msg.content || '';
    const panelPath = getPanelPath(panel, ws);

    if (panelPath === null) {
      ws.send(JSON.stringify({
        type: 'file_save_response',
        panel,
        path: requestPath,
        success: false,
        error: `Panel "${panel}" is not filesystem-backed`,
        code: 'ENOTPANEL',
      }));
      return;
    }

    const basePath = path.resolve(panelPath);
    const targetPath = path.join(basePath, requestPath);

    if (!isPathAllowed(basePath, targetPath)) {
      ws.send(JSON.stringify({
        type: 'file_save_response',
        panel,
        path: requestPath,
        success: false,
        error: 'Invalid path',
        code: 'ENOENT',
      }));
      return;
    }

    try {
      const lstat = await fsPromises.lstat(targetPath).catch(() => null);
      let writePath = targetPath;

      if (lstat?.isSymbolicLink()) {
        try {
          writePath = await fsPromises.realpath(targetPath);
        } catch (err) {
          ws.send(JSON.stringify({
            type: 'file_save_response',
            panel,
            path: requestPath,
            success: false,
            error: err.message,
            code: mapFileErrorCode(err),
          }));
          return;
        }
      }

      const stat = await fsPromises.stat(writePath).catch(() => null);
      if (stat && stat.isDirectory()) {
        ws.send(JSON.stringify({
          type: 'file_save_response',
          panel,
          path: requestPath,
          success: false,
          error: 'Expected file, got directory',
          code: 'EISDIR',
        }));
        return;
      }

      const tmpPath = writePath + '.tmp';
      const reason = msg.reason || 'autosave';
      const mutationPaths = [targetPath, writePath, tmpPath];
      if (reason === 'session_end' || reason === 'checkpoint' || reason === 'milestone') {
        const projectRoot = getProjectRoot(ws);
        if (!projectRoot) throw Object.assign(new Error('No active workspace'), { code: 'ENOENT' });
        mutationPaths.push(
          ...resolveGitMutationPaths(basePath),
          path.join(basePath, '.gitignore'),
        );
      }
      await assertMutationAllowed(ws, mutationPaths);
      let descriptor = null;
      let ownsTemp = false;
      try {
        descriptor = fs.openSync(
          tmpPath,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
          0o600,
        );
        ownsTemp = true;
        fs.writeFileSync(descriptor, content, 'utf8');
        fs.fsyncSync(descriptor);
        fs.closeSync(descriptor);
        descriptor = null;
        fs.renameSync(tmpPath, writePath);
        ownsTemp = false;
      } catch (error) {
        if (descriptor !== null) {
          try { fs.closeSync(descriptor); } catch (_closeError) {}
        }
        if (ownsTemp) {
          try { fs.unlinkSync(tmpPath); } catch (_cleanupError) {}
        }
        throw error;
      }

      // Versioning: commit on session_end, checkpoint, or milestone
      if (reason === 'session_end' || reason === 'checkpoint' || reason === 'milestone') {
        const milestone = msg.milestone;
        const fileName = path.basename(requestPath);
        const message =
          reason === 'milestone'
            ? `milestone: ${milestone} — ${fileName}`
            : reason === 'checkpoint'
              ? `checkpoint: ${fileName} @ ${new Date().toISOString()}`
              : `session: ${fileName}`;

        try {
          await commitIfChanged(basePath, requestPath, message);
        } catch (err) {
          console.warn('[Versioning] Commit failed:', err.message);
        }
      }

      ws.send(JSON.stringify({
        type: 'file_save_response',
        panel,
        path: requestPath,
        success: true,
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'file_save_response',
        panel,
        path: requestPath,
        success: false,
        error: err.message,
        code: mapFileErrorCode(err),
      }));
    }
  }

  async function handleFolderCreateRequest(ws, msg) {
    const panel = msg.panel || 'file-viewer';
    const parentPath = msg.parentPath || '';
    const rawName = String(msg.name || '').trim();
    const panelPath = getPanelPath(panel, ws);

    if (panelPath === null) {
      ws.send(JSON.stringify({
        type: 'folder_create_response',
        panel,
        parentPath,
        success: false,
        error: `Panel "${panel}" is not filesystem-backed`,
        code: 'ENOTPANEL',
      }));
      return;
    }

    if (!rawName || rawName.includes('/') || rawName.includes('\\') || rawName === '.' || rawName === '..') {
      ws.send(JSON.stringify({
        type: 'folder_create_response',
        panel,
        parentPath,
        success: false,
        error: 'Invalid folder name',
        code: 'EINVAL',
      }));
      return;
    }

    const basePath = path.resolve(panelPath);
    const parentAbsolutePath = path.join(basePath, parentPath);
    const targetPath = path.join(parentAbsolutePath, rawName);
    const folderPath = parentPath ? `${parentPath}/${rawName}` : rawName;

    if (!isPathAllowed(basePath, parentAbsolutePath) || !isPathAllowed(basePath, targetPath)) {
      ws.send(JSON.stringify({
        type: 'folder_create_response',
        panel,
        parentPath,
        path: folderPath,
        success: false,
        error: 'Invalid path',
        code: 'ENOENT',
      }));
      return;
    }

    try {
      await assertMutationAllowed(ws, [targetPath]);
      const parentStat = await fsPromises.stat(parentAbsolutePath);
      if (!parentStat.isDirectory()) {
        ws.send(JSON.stringify({
          type: 'folder_create_response',
          panel,
          parentPath,
          path: folderPath,
          success: false,
          error: 'Parent path is not a directory',
          code: 'ENOTDIR',
        }));
        return;
      }

      await fsPromises.mkdir(targetPath);

      ws.send(JSON.stringify({
        type: 'folder_create_response',
        panel,
        parentPath,
        path: folderPath,
        success: true,
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'folder_create_response',
        panel,
        parentPath,
        path: folderPath,
        success: false,
        error: err.code === 'EEXIST' ? 'Folder already exists' : err.message,
        code: mapFileErrorCode(err),
      }));
    }
  }

  async function handleDocumentCreateRequest(ws, msg) {
    const panel = msg.panel || 'file-viewer';
    const parentPath = msg.parentPath || '';
    const rawName = String(msg.name || '').trim();
    const panelPath = getPanelPath(panel, ws);

    if (panelPath === null) {
      ws.send(JSON.stringify({
        type: 'document_create_response',
        panel,
        parentPath,
        success: false,
        error: `Panel "${panel}" is not filesystem-backed`,
        code: 'ENOTPANEL',
      }));
      return;
    }

    if (!rawName || rawName.includes('/') || rawName.includes('\\') || rawName === '.' || rawName === '..') {
      ws.send(JSON.stringify({
        type: 'document_create_response',
        panel,
        parentPath,
        success: false,
        error: 'Invalid document name',
        code: 'EINVAL',
      }));
      return;
    }

    const fileName = /\.(md|markdown)$/i.test(rawName) ? rawName : `${rawName}.md`;
    const extension = parseExtension(fileName) || 'md';
    const basePath = path.resolve(panelPath);
    const parentAbsolutePath = path.join(basePath, parentPath);
    const targetPath = path.join(parentAbsolutePath, fileName);
    const documentPath = parentPath ? `${parentPath}/${fileName}` : fileName;

    if (!isPathAllowed(basePath, parentAbsolutePath) || !isPathAllowed(basePath, targetPath)) {
      ws.send(JSON.stringify({
        type: 'document_create_response',
        panel,
        parentPath,
        path: documentPath,
        name: fileName,
        extension,
        success: false,
        error: 'Invalid path',
        code: 'ENOENT',
      }));
      return;
    }

    try {
      await assertMutationAllowed(ws, [targetPath]);
      const parentStat = await fsPromises.stat(parentAbsolutePath);
      if (!parentStat.isDirectory()) {
        ws.send(JSON.stringify({
          type: 'document_create_response',
          panel,
          parentPath,
          path: documentPath,
          name: fileName,
          extension,
          success: false,
          error: 'Parent path is not a directory',
          code: 'ENOTDIR',
        }));
        return;
      }

      const title = fileName.replace(/\.(md|markdown)$/i, '') || 'Untitled';
      const content = createMarkdownDocumentContent(title);
      await fsPromises.writeFile(targetPath, content, { encoding: 'utf8', flag: 'wx' });

      ws.send(JSON.stringify({
        type: 'document_create_response',
        panel,
        parentPath,
        path: documentPath,
        name: fileName,
        extension,
        content,
        success: true,
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'document_create_response',
        panel,
        parentPath,
        path: documentPath,
        name: fileName,
        extension,
        success: false,
        error: err.code === 'EEXIST' ? 'Document already exists' : err.message,
        code: mapFileErrorCode(err),
      }));
    }
  }

  return {
    handleFileTreeRequest,
    handleFileContentRequest,
    handleRecentFilesRequest,
    handleFileSaveRequest,
    handleFolderCreateRequest,
    handleDocumentCreateRequest,
  };
}

module.exports = { createFileExplorerHandlers };
