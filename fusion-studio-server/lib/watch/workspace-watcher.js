/**
 * Project-wide file watcher with pluggable filters.
 *
 * Replaces lib/watcher/index.js. Drives events through core.js instead of fs.watch.
 * Keeps the filter system, exclude patterns, rename detection, and context building.
 */

const path = require('path');
const { subscribe } = require('./core');
const { buildContext, isExcluded } = require('./workspace-context');
const { emit } = require('../event-bus');

const RENAME_WINDOW_MS = 2000;

const DEFAULT_EXCLUDES = [
  'node_modules', 'dist', '.git', '.kimi',
  // Served as a static asset library, not workspace content. Watching the
  // full Material Symbols checkout opens tens of thousands of file handles
  // on macOS and can prevent unrelated child processes (including Keychain
  // lookups) from spawning.
  'material-symbols',
  'fusion-studio-server/data',
  'ai/*/Data/Chatlogs',
  'ai/*/Data/Runs',
  'ai/*/Data/File-Viewer',
  'ai/*/Issues/done',
  '*.log', 'CHAT.md', 'history.json',
  'wire-debug.log', 'server-live.log',
];

/**
 * Create a file watcher on projectRoot.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @param {object} [options]
 * @param {string[]} [options.excludes] - Additional exclusion patterns
 * @returns {{ close: Function, addFilter: Function }}
 */
function createWatcher(projectRoot, options = {}) {
  const excludes = DEFAULT_EXCLUDES.concat(options.excludes || []);
  const filters = [];

  // Rename detection
  const recentDeletes = new Map();

  function notifyFilters(event, filePath, extra) {
    const ctx = buildContext(projectRoot, filePath, event);

    for (const filter of filters) {
      try {
        if (!filter.shouldWatch(filePath, ctx)) continue;

        const handlerMap = {
          delete: filter.onDelete,
          create: filter.onCreate,
          modify: filter.onModify,
          rename: filter.onRename,
        };

        const handler = handlerMap[event];
        if (typeof handler !== 'function') continue;

        if (event === 'rename') {
          const newCtx = buildContext(projectRoot, extra.newPath, event);
          handler(extra.oldPath, extra.newPath, ctx, newCtx);
        } else {
          handler(filePath, ctx);
        }
        console.log(`[Watcher:${filter.name}] handled ${event}`);
      } catch (err) {
        console.error(`[Watcher:${filter.name}] error on ${event}:`, err.message);
      }
    }

    // Emit on UEB so any domain can subscribe without owning a watcher
    if (event === 'rename') {
      const oldCtx = buildContext(projectRoot, extra.oldPath, 'delete');
      const newCtx = buildContext(projectRoot, extra.newPath, 'create');
      emit('file:changed', { filePath: extra.oldPath, event: 'delete', context: oldCtx });
      emit('file:changed', { filePath: extra.newPath, event: 'create', context: newCtx });
    } else {
      emit('file:changed', { filePath, event, context: ctx });
    }
  }

  function checkForRenameTarget(filename) {
    const dir = path.dirname(filename);
    for (const [deletedFile, entry] of recentDeletes) {
      if (path.dirname(deletedFile) !== dir) continue;
      if (Date.now() - entry.timestamp > RENAME_WINDOW_MS) continue;

      // Match: delete + create in same dir within window
      recentDeletes.delete(deletedFile);
      console.log(`[Watcher] rename: ${deletedFile} -> ${filename}`);
      notifyFilters('rename', deletedFile, { oldPath: deletedFile, newPath: filename });
      return true;
    }
    return false;
  }

  function scheduleDelete(filePath) {
    recentDeletes.set(filePath, { timestamp: Date.now() });

    setTimeout(() => {
      const entry = recentDeletes.get(filePath);
      if (!entry) return; // matched to rename
      recentDeletes.delete(filePath);
      console.log(`[Watcher] delete: ${filePath}`);
      notifyFilters('delete', filePath);
    }, RENAME_WINDOW_MS);
  }

  function handleFileEvent(event, absolutePath) {
    const relPath = path.relative(projectRoot, absolutePath);
    if (!relPath || relPath.startsWith('..')) return;

    if (event === 'change') {
      if (isExcluded(relPath, excludes)) return;
      console.log(`[Watcher] modify: ${relPath}`);
      notifyFilters('modify', relPath);
      return;
    }

    if (event === 'add' || event === 'addDir') {
      if (isExcluded(relPath, excludes)) return;
      const wasRename = checkForRenameTarget(relPath);
      if (!wasRename) {
        console.log(`[Watcher] create: ${relPath}`);
        notifyFilters('create', relPath);
      }
      return;
    }

    if (event === 'unlink' || event === 'unlinkDir') {
      if (isExcluded(relPath, excludes)) return;
      scheduleDelete(relPath);
      return;
    }
  }

  // chokidar receives absolute paths in its ignored check; simple strings like
  // 'node_modules' don't match against '/abs/path/to/node_modules/...'. Use a
  // function so isExcluded operates on the relative path as it does elsewhere.
  const ignoredFn = (absolutePath) => {
    const rel = path.relative(projectRoot, absolutePath);
    if (!rel || rel.startsWith('..')) return false;
    return isExcluded(rel, excludes);
  };

  const unsub = subscribe({
    id: 'workspace',
    path: projectRoot,
    options: { ignored: ignoredFn },
    handler: handleFileEvent,
  });

  console.log(`[Watcher] Watching ${projectRoot}`);

  return {
    close() {
      unsub();
      for (const t of recentDeletes.values()) clearTimeout(t);
      recentDeletes.clear();
      console.log('[Watcher] Stopped');
    },

    addFilter(filter) {
      if (!filter || typeof filter.shouldWatch !== 'function') {
        console.error('[Watcher] Invalid filter — must have shouldWatch()');
        return;
      }
      filters.push(filter);
      console.log(`[Watcher] Filter registered: ${filter.name}`);
    },
  };
}

module.exports = { createWatcher };
