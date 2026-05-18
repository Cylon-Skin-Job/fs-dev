/**
 * workspace-controller — multi-workspace lifecycle orchestrator.
 *
 * Subscribes to `workspace:*_requested` events on the bus (routed from
 * client WebSocket messages by client-message-router), mutates the
 * `workspaces` table via registry-service, and emits `workspace:*` result
 * events that workspace-broadcaster fans out to clients.
 *
 * At `start()` time:
 *   1. validateRegistry() — cull rows whose repo_path is gone or invalid.
 *   2. restoreLastActive() — read system_config.last_active_workspace_id
 *      and set module-level activeWorkspaceId.
 *   3. Subscribe request handlers.
 *
 * Module-level activeWorkspaceId is sufficient for today's single-tab
 * reality (see WORKSPACE_CONTROLLER_SPEC §6). Per-connection active state
 * is future work.
 *
 * The controller also caches the active workspace row (`activeWorkspace`)
 * so sync callers (HTTP routes, file-explorer symlink check, boot
 * pipeline) can resolve `repo_path` without an async DB hop. The cache is
 * the source of truth that `server.js#getProjectRoot()` reads from.
 */

const fs = require('fs');
const path = require('path');

const { on, emit } = require('../event-bus');
const { getDb } = require('../db');
const pathService = require('./path-service');
const registry = require('./registry-service');
const bootstrap = require('./bootstrap-service');

let activeWorkspaceId = null;
let activeWorkspace = null; // cached registry row, kept in lockstep with activeWorkspaceId so sync callers (HTTP routes, file-explorer symlink check, boot pipeline) can resolve repo_path without awaiting a DB query

async function start() {
  await validateRegistry();
  await restoreLastActive();

  on('workspace:add_requested', handleAddRequested);
  on('workspace:switch_requested', handleSwitchRequested);
  on('workspace:remove_requested', handleRemoveRequested);

  console.log('[WorkspaceController] Started (active: ' + (activeWorkspaceId || 'none') + ')');
  emit('workspace:controller_ready');
}

async function validateRegistry() {
  const rows = await registry.list();
  let culled = 0;

  for (const row of rows) {
    const exists = fs.existsSync(row.repo_path);
    const valid = exists && bootstrap.isValidWorkspaceRoot(row.repo_path);
    if (valid) continue;

    const reason = !exists ? 'path_missing' : 'invalid_structure';
    await registry.remove(row.id);
    emit('workspace:culled_at_launch', { workspaceId: row.id, reason });
    culled += 1;
  }

  console.log(
    '[WorkspaceController] Launch validator: ' + rows.length + ' workspaces, ' + culled + ' culled'
  );
}

async function restoreLastActive() {
  const row = await getDb()('system_config').where('key', 'last_active_workspace_id').first();
  const candidateId = row ? row.value : null;

  if (candidateId) {
    const existing = await registry.getById(candidateId);
    if (existing) {
      activeWorkspaceId = candidateId;
      activeWorkspace = existing;
      console.log('[WorkspaceController] Restored workspace: ' + candidateId);
      return;
    }
  }

  // Candidate was culled or never set — fall back to the first row.
  const all = await registry.list();
  if (all.length > 0) {
    activeWorkspaceId = all[0].id;
    activeWorkspace = all[0];
    await writeLastActive(activeWorkspaceId);
    console.log('[WorkspaceController] Restored workspace: ' + activeWorkspaceId + ' (fallback)');
  } else {
    activeWorkspaceId = null;
    activeWorkspace = null;
    console.log('[WorkspaceController] No workspaces');
  }
}

async function writeLastActive(workspaceId) {
  await getDb()('system_config')
    .insert({
      key: 'last_active_workspace_id',
      value: workspaceId == null ? '' : workspaceId,
      updated_at: Date.now(),
    })
    .onConflict('key')
    .merge(['value', 'updated_at']);
}

async function handleAddRequested(event) {
  const { repoPath, connectionId } = event;

  if (!repoPath || typeof repoPath !== 'string' || !fs.existsSync(repoPath)) {
    console.warn('[WorkspaceController] add_requested: path missing or invalid (' + repoPath + ')');
    return;
  }

  let canonical;
  try {
    canonical = pathService.canonicalize(repoPath);
  } catch (err) {
    console.warn('[WorkspaceController] add_requested: canonicalize failed — ' + err.message);
    return;
  }

  const existing = await registry.getByRepoPath(canonical);
  if (existing) {
    emit('workspace:add_rejected_duplicate', {
      existingWorkspace: existing,
      connectionId,
    });
    return;
  }

  try {
    bootstrap.bootstrap(canonical);
  } catch (err) {
    console.warn('[WorkspaceController] add_requested: bootstrap failed — ' + err.message);
    return;
  }

  const id = await generateUniqueId(canonical);
  const label = toTitleCase(path.basename(canonical));
  const nextSortOrder = (await registry.maxSortOrder()) + 1;

  // Detect workspace paradigm: 'app' if ai/apps/ exists, otherwise 'code'
  const hasAppsDir = fs.existsSync(path.join(canonical, 'ai', 'apps'));
  const workspaceType = hasAppsDir ? 'app' : 'code';

  const workspace = await registry.add({
    id,
    label,
    icon: 'folder',
    description: null,
    repoPath: canonical,
    sortOrder: nextSortOrder,
    type: workspaceType,
  });

  emit('workspace:added', { workspace });
  emit('workspace:registry_changed', { workspaces: await registry.list() });
}

async function handleSwitchRequested(event) {
  const { workspaceId } = event;
  const target = await registry.getById(workspaceId);
  if (!target) {
    console.warn('[WorkspaceController] switch_requested: unknown workspace (' + workspaceId + ')');
    return;
  }
  if (workspaceId === activeWorkspaceId) return;

  const from = activeWorkspaceId;
  activeWorkspaceId = workspaceId;
  activeWorkspace = target;
  await writeLastActive(workspaceId);

  emit('workspace:switched', { from, to: workspaceId, repoPath: target.repo_path });
}

async function handleRemoveRequested(event) {
  const { workspaceId } = event;
  const target = await registry.getById(workspaceId);
  if (!target) {
    console.warn('[WorkspaceController] remove_requested: unknown workspace (' + workspaceId + ')');
    return;
  }

  const wasActive = workspaceId === activeWorkspaceId;
  await registry.remove(workspaceId);

  emit('workspace:removed', { workspaceId });
  emit('workspace:registry_changed', { workspaces: await registry.list() });

  if (wasActive) {
    const remaining = await registry.list();
    const next = remaining.length > 0 ? remaining[0] : null;
    const nextId = next ? next.id : null;
    activeWorkspaceId = nextId;
    activeWorkspace = next;
    await writeLastActive(nextId);
    emit('workspace:switched', { from: workspaceId, to: nextId, repoPath: next ? next.repo_path : null });
  }
}

async function generateUniqueId(canonicalPath) {
  const base = slugify(path.basename(canonicalPath));
  if (!(await registry.getById(base))) return base;
  let suffix = 2;
  while (await registry.getById(base + '-' + suffix)) {
    suffix += 1;
  }
  return base + '-' + suffix;
}

function slugify(str) {
  return String(str || 'workspace')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
}

function toTitleCase(str) {
  return String(str || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || 'Workspace';
}

function getActiveWorkspaceId() {
  return activeWorkspaceId;
}

async function getActiveWorkspace() {
  if (!activeWorkspaceId) return null;
  return registry.getById(activeWorkspaceId);
}

function getActiveWorkspaceSync() {
  return activeWorkspace;
}

async function listWorkspaces() {
  return registry.list();
}

module.exports = {
  start,
  getActiveWorkspaceId,
  getActiveWorkspace,
  getActiveWorkspaceSync,
  listWorkspaces,
};
