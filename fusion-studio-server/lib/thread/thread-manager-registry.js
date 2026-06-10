/**
 * @module thread-manager-registry
 * @role Return stable ThreadManager instances for workspace/scope/view targets.
 */

const path = require('path');
const { ThreadManager } = require('./ThreadManager');

const projectThreadManagers = new Map();
const viewThreadManagers = new Map();
const initPromises = new WeakMap();

function initManager(manager, logLabel) {
  if (!initPromises.has(manager)) {
    const promise = manager.init().catch(err => {
      console.error(`[${logLabel}] Failed to init:`, err);
      throw err;
    });
    initPromises.set(manager, promise);
  }
  return initPromises.get(manager);
}

function getWorkspaceKey(projectRoot, workspaceId) {
  return workspaceId || path.basename(projectRoot);
}

function getProjectThreadManager(projectRoot, workspaceId) {
  const key = getWorkspaceKey(projectRoot, workspaceId);
  let manager = projectThreadManagers.get(key);
  if (!manager) {
    manager = new ThreadManager({ scope: 'project', projectRoot, workspaceId });
    projectThreadManagers.set(key, manager);
    initManager(manager, `ProjectThreadManager:${key}`).catch(() => {});
  }
  return manager;
}

function getViewThreadManager(viewId, projectRoot, workspaceId) {
  const key = `${getWorkspaceKey(projectRoot, workspaceId)}:${viewId}`;
  let manager = viewThreadManagers.get(key);
  if (!manager) {
    manager = new ThreadManager({ scope: 'view', viewId, projectRoot, workspaceId });
    viewThreadManagers.set(key, manager);
    initManager(manager, `ViewThreadManager:${key}`).catch(() => {});
  }
  return manager;
}

async function awaitThreadManagerReady(manager) {
  await initManager(manager, 'ThreadManager');
  return manager;
}

function getThreadManagerForTarget(target) {
  if (target.scope === 'project') {
    return getProjectThreadManager(target.projectRoot, target.workspaceId);
  }
  return getViewThreadManager(target.viewId, target.projectRoot, target.workspaceId);
}

module.exports = {
  getProjectThreadManager,
  getViewThreadManager,
  getThreadManagerForTarget,
  awaitThreadManagerReady,
  _getProjectThreadManagers: () => projectThreadManagers,
  _getViewThreadManagers: () => viewThreadManagers,
};
