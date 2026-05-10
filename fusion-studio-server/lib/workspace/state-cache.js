/**
 * Workspace State Cache — lightweight JSON file persistence for client
 * workspaceState. Survives browser refresh / app restart.
 *
 * One JSON file per server instance: data/workspace-cache.json
 * Keyed by workspaceId; value is a subset of the client's workspaceState
 * (panel configs, current panel, view states, thread metadata).
 *
 * This is a read-through cache, not source of truth. If panels are
 * added/removed on disk, the file watcher should invalidate so the
 * client falls back to rediscovery.
 */

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../../data/workspace-cache.json');

function ensureDir() {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadAll() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function save(workspaceId, state) {
  ensureDir();
  const cache = loadAll();
  cache[workspaceId] = {
    ...state,
    _savedAt: Date.now(),
  };
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[state-cache] failed to write:', err.message);
  }
}

function get(workspaceId) {
  const cache = loadAll();
  return cache[workspaceId] || null;
}

function invalidate(workspaceId) {
  const cache = loadAll();
  if (cache[workspaceId]) {
    delete cache[workspaceId];
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (err) {
      console.error('[state-cache] failed to invalidate:', err.message);
    }
  }
}

module.exports = { loadAll, save, get, invalidate };
