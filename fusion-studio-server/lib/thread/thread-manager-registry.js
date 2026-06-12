/**
 * @module thread-manager-registry
 * @role Return stable ThreadManager instances for workspace targets.
 *
 * RCC-0095: all threads are workspace-scoped. The view-scoped manager
 * registry has been removed.
 */

const path = require('path');
const { ThreadManager } = require('./ThreadManager');

const projectThreadManagers = new Map();
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
    manager = new ThreadManager({ projectRoot, workspaceId });
    projectThreadManagers.set(key, manager);
    initManager(manager, `ProjectThreadManager:${key}`).catch(() => {});
  }
  return manager;
}

async function awaitThreadManagerReady(manager) {
  await initManager(manager, 'ThreadManager');
  return manager;
}

function getThreadManagerForTarget(target) {
  return getProjectThreadManager(target.projectRoot, target.workspaceId);
}

module.exports = {
  getProjectThreadManager,
  getThreadManagerForTarget,
  awaitThreadManagerReady,
  _getProjectThreadManagers: () => projectThreadManagers,
};
