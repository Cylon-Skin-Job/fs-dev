/**
 * workspace-controller — multi-workspace lifecycle orchestrator.
 *
 * Subscribes to `workspace:*_requested` events on the bus (routed from
 * client WebSocket messages by client-message-router), mutates the
 * `workspaces` table via registry-service, and emits `workspace:*` result
 * events that workspace-broadcaster fans out to clients.
 *
 * At `start()` time:
 *   1. Gate every registered workspace through the view-readiness owner.
 *   2. auditRegistryAvailability() — warn about unavailable registered rows.
 *   3. restoreLastActive() — read system_config.last_active_workspace_id
 *      and set module-level activeWorkspaceId.
 *   4. Subscribe request handlers.
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
const createService = require('./create-service');
const { createWorkspaceRibbonHandlers } = require('./workspace-ribbon');
const viewReadiness = require('../views/readiness-runtime');
const { publishElectronWorkspaceBinding } = require('./electron-binding-channel');

let activeWorkspaceId = null;
let activeWorkspace = null; // cached registry row, kept in lockstep with activeWorkspaceId so sync callers (HTTP routes, file-explorer symlink check, boot pipeline) can resolve repo_path without awaiting a DB query
let activeWorkspaceBindingRevision = 0;
let lifecycleTail = Promise.resolve();

const ribbonHandlers = createWorkspaceRibbonHandlers({
  registry,
  emit,
  getActiveWorkspaceId: () => activeWorkspaceId,
  setActiveWorkspace,
  writeLastActive,
});

async function start() {
  if (!viewReadiness.hasInstalledViewReadinessOwner()) {
    const { createViewReadinessCoordinator } = require('../views/readiness-coordinator');
    const { createViewRelocationService } = require('../views/relocation-service');
    const { getLocalMachineName } = require('./ai-paths');
    viewReadiness.installViewReadinessOwner(createViewReadinessCoordinator({
      migrationService: createViewRelocationService({ db: getDb() }),
      machineIdentity: getLocalMachineName(),
    }));
  }
  await viewReadiness.ensureRegisteredWorkspaceReadiness(await registry.list());
  await auditRegistryAvailability();
  await restoreLastActive();
  publishActiveWorkspaceBinding();

  on('workspace:add_requested', (event) => enqueueWorkspaceLifecycle(
    () => handleAddRequested(event),
  ));
  on('workspace:switch_requested', (event) => enqueueWorkspaceLifecycle(
    () => handleSwitchRequested(event),
  ));
  on('workspace:remove_requested', (event) => enqueueWorkspaceLifecycle(
    () => handleRemoveRequested(event),
  ));
  on('workspace:ribbon_remove_requested', (event) => enqueueWorkspaceLifecycle(
    () => ribbonHandlers.handleRibbonRemoveRequested(event),
  ));
  on('workspace:ribbon_add_requested', (event) => enqueueWorkspaceLifecycle(
    () => ribbonHandlers.handleRibbonAddRequested(event),
  ));
  on('workspace:ribbon_reorder_requested', (event) => enqueueWorkspaceLifecycle(
    () => ribbonHandlers.handleRibbonReorderRequested(event),
  ));
  on('workspace:create_requested', (event) => enqueueWorkspaceLifecycle(
    () => handleCreateRequested(event),
  ));

  console.log('[WorkspaceController] Started (active: ' + (activeWorkspaceId || 'none') + ')');
  emit('workspace:controller_ready');
}

function enqueueWorkspaceLifecycle(operation) {
  const current = lifecycleTail
    .catch(() => undefined)
    .then(operation);
  lifecycleTail = current;
  return current;
}

function runInWorkspaceLifecycle(operation) {
  if (typeof operation !== 'function') {
    return Promise.reject(new TypeError('workspace lifecycle operation is required'));
  }
  return enqueueWorkspaceLifecycle(operation);
}

function getLaunchStatus(workspace) {
  const repoPath = workspace.repo_path || workspace.repoPath;
  if (!isDirectory(repoPath)) {
    return { available: false, reason: 'path_missing' };
  }
  if (!bootstrap.isValidWorkspaceRoot(repoPath)) {
    return { available: false, reason: 'invalid_structure' };
  }
  return { available: true, reason: null };
}

async function auditRegistryAvailability() {
  const rows = await registry.list();
  let unavailable = 0;

  for (const row of rows) {
    const status = getLaunchStatus(row);
    if (status.available) continue;

    console.warn(
      '[WorkspaceController] Registered workspace unavailable at launch (' +
        row.id +
        '): ' +
        status.reason
    );
    emit('workspace:unavailable_at_launch', { workspaceId: row.id, reason: status.reason });
    unavailable += 1;
  }

  console.log(
    '[WorkspaceController] Launch registry audit: ' +
      rows.length +
      ' workspaces, ' +
      unavailable +
      ' unavailable'
  );
}

async function restoreLastActive() {
  const row = await getDb()('system_config').where('key', 'last_active_workspace_id').first();
  const candidateId = row ? row.value : null;

  if (candidateId) {
    const existing = await registry.getById(candidateId);
    if (existing && getLaunchStatus(existing).available) {
      activeWorkspaceId = candidateId;
      activeWorkspace = existing;
      console.log('[WorkspaceController] Restored workspace: ' + candidateId);
      return;
    }
    if (existing) {
      const status = getLaunchStatus(existing);
      console.warn(
        '[WorkspaceController] Last active workspace unavailable at launch (' +
          candidateId +
          '): ' +
          status.reason
      );
    }
  }

  if (row && !candidateId) {
    activeWorkspaceId = null;
    activeWorkspace = null;
    console.log('[WorkspaceController] Restored workspace: none');
    return;
  }

  // Candidate is unavailable or was never set — fall back to the first
  // launchable row without removing any registrations.
  const all = await registry.list();
  const fallback = all.find((workspace) => getLaunchStatus(workspace).available) || null;
  if (fallback) {
    activeWorkspaceId = fallback.id;
    activeWorkspace = fallback;
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

function setActiveWorkspace(workspaceId, workspace) {
  activeWorkspaceId = workspaceId;
  activeWorkspace = workspace;
  return publishActiveWorkspaceBinding();
}

function publishActiveWorkspaceBinding() {
  if (activeWorkspaceBindingRevision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('electron_workspace_binding_revision_exhausted');
  }
  activeWorkspaceBindingRevision += 1;
  publishElectronWorkspaceBinding(
    activeWorkspaceId,
    activeWorkspace ? activeWorkspace.repoPath || activeWorkspace.repo_path : null,
    activeWorkspaceBindingRevision,
  );
  return activeWorkspaceBindingRevision;
}

async function findRegisteredWorkspaceByPath(repoPath) {
  const targetKey = pathService.comparisonKey(repoPath);
  const workspaces = await registry.list();
  return workspaces.find((workspace) => (
    pathService.comparisonKey(workspace.repoPath || workspace.repo_path) === targetKey
  )) || null;
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

  const existing = await findRegisteredWorkspaceByPath(canonical);
  if (existing) {
    emit('workspace:add_rejected_duplicate', {
      existingWorkspace: existing,
      connectionId,
    });
    return;
  }

  const aiPath = path.join(canonical, 'ai');
  if (!isDirectory(aiPath)) {
    emit('workspace:add_rejected_missing_ai', {
      repoPath: canonical,
      connectionId,
    });
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
    ribbonVisible: true,
    ribbonSortOrder: nextSortOrder,
  });

  let viewAvailability = await prepareWorkspaceViews(workspace, { allowViewless: true });
  if (viewAvailability.status !== 'unavailable') {
    try {
      bootstrap.bootstrap(canonical);
    } catch (err) {
      console.warn('[WorkspaceController] add_requested: bootstrap failed — ' + err.message);
      viewAvailability = {
        status: 'unavailable',
        verified: false,
        code: 'view_registry_unavailable',
      };
    }
  }

  emit('workspace:added', {
    workspace,
    viewRegistryUnavailable: viewAvailability.status === 'unavailable',
  });
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

  const viewAvailability = await prepareWorkspaceViews(target);

  const from = activeWorkspaceId;
  const bindingRevision = setActiveWorkspace(workspaceId, target);
  await writeLastActive(workspaceId);

  emit('workspace:switched', {
    from,
    to: workspaceId,
    repoPath: target.repo_path,
    bindingRevision,
    viewRegistryUnavailable: viewAvailability.status === 'unavailable',
  });
}

async function handleRemoveRequested(event) {
  const { workspaceId } = event;
  const target = await registry.getById(workspaceId);
  if (!target) {
    console.warn('[WorkspaceController] remove_requested: unknown workspace (' + workspaceId + ')');
    return;
  }

  const wasActive = workspaceId === activeWorkspaceId;
  await viewReadiness.retireWorkspaceViewReadiness(
    {
      workspaceId,
      projectRoot: target.repoPath || target.repo_path,
    },
    () => registry.remove(workspaceId),
  );

  emit('workspace:removed', { workspaceId });
  emit('workspace:registry_changed', { workspaces: await registry.list() });

  if (wasActive) {
    const remaining = await registry.list();
    const next = remaining.length > 0 ? remaining[0] : null;
    const nextId = next ? next.id : null;
    const bindingRevision = setActiveWorkspace(nextId, next);
    await writeLastActive(nextId);
    emit('workspace:switched', {
      from: workspaceId,
      to: nextId,
      repoPath: next ? next.repo_path : null,
      bindingRevision,
    });
  }
}

async function handleCreateRequested(event) {
  const { projectPath, label, connectionId } = event;
  if (!projectPath || typeof projectPath !== 'string' || !path.isAbsolute(projectPath)) {
    rejectCreate(connectionId, 'Create New requires an absolute project path.');
    return;
  }

  const requestedPath = path.resolve(projectPath);
  const parent = path.dirname(requestedPath);
  if (!isDirectory(parent)) {
    rejectCreate(connectionId, 'Parent directory does not exist.');
    return;
  }
  const exactParent = pathService.canonicalize(parent);
  const targetPath = path.join(exactParent, path.basename(requestedPath));
  if (fs.existsSync(targetPath) && !isDirectoryEmpty(targetPath)) {
    rejectCreate(connectionId, 'Project path already exists and is not empty.');
    return;
  }

  const existing = await findRegisteredWorkspaceByPath(targetPath);
  if (existing) {
    rejectCreate(connectionId, 'Project is already registered.');
    return;
  }

  let selectedViews;
  try {
    selectedViews = createService.scaffoldProject({
      projectPath: targetPath,
    }).selectedViews;
  } catch (err) {
    rejectCreate(connectionId, err.message);
    return;
  }

  const canonical = pathService.canonicalize(targetPath);
  const id = await generateUniqueId(canonical);
  const workspaceLabel = String(label || '').trim() || toTitleCase(path.basename(canonical));
  const nextSortOrder = (await registry.maxSortOrder()) + 1;
  const workspace = await registry.add({
    id,
    label: workspaceLabel,
    icon: selectedViews[0]?.icon || 'folder',
    description: null,
    repoPath: canonical,
    sortOrder: nextSortOrder,
    type: 'code',
    ribbonVisible: true,
    ribbonSortOrder: nextSortOrder,
  });

  const viewAvailability = await prepareWorkspaceViews(workspace);

  const from = activeWorkspaceId;
  const bindingRevision = setActiveWorkspace(id, workspace);
  await writeLastActive(id);

  emit('workspace:created', { workspace, connectionId });
  emit('workspace:added', { workspace });
  emit('workspace:registry_changed', { workspaces: await registry.list() });
  emit('workspace:switched', {
    from,
    to: id,
    repoPath: canonical,
    bindingRevision,
    viewRegistryUnavailable: viewAvailability.status === 'unavailable',
  });
}

async function prepareWorkspaceViews(workspace, options = {}) {
  try {
    return await viewReadiness.ensureWorkspaceViewReadiness({
      workspaceId: workspace.id,
      projectRoot: workspace.repoPath || workspace.repo_path,
      allowViewless: options.allowViewless === true,
    });
  } catch (_error) {
    return { status: 'unavailable', verified: false, code: 'view_registry_unavailable' };
  }
}

function rejectCreate(connectionId, message) {
  emit('workspace:create_rejected', {
    connectionId,
    message,
  });
}

function isDirectoryEmpty(targetPath) {
  if (!isDirectory(targetPath)) return false;
  return fs.readdirSync(targetPath).length === 0;
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

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function getActiveWorkspaceId() {
  return activeWorkspaceId;
}

function getActiveWorkspaceBindingRevision() {
  return activeWorkspaceBindingRevision;
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
  getActiveWorkspaceBindingRevision,
  getActiveWorkspace,
  getActiveWorkspaceSync,
  runInWorkspaceLifecycle,
  listWorkspaces,
};
