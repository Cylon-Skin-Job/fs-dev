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
  if (typeof projectRoot !== 'string' || !projectRoot) {
    throw new Error('Project thread manager requires projectRoot');
  }
  const normalizedRoot = path.resolve(projectRoot);
  const normalizedWorkspaceId = workspaceId || path.basename(normalizedRoot);
  return JSON.stringify([normalizedWorkspaceId, normalizedRoot]);
}

function getProjectThreadManager(projectRoot, workspaceId) {
  const normalizedRoot = path.resolve(projectRoot);
  const key = getWorkspaceKey(normalizedRoot, workspaceId);
  let manager = projectThreadManagers.get(key);
  if (!manager) {
    manager = new ThreadManager({ projectRoot: normalizedRoot, workspaceId });
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

async function shutdownThreadManagers(options = {}) {
  const managers = [...projectThreadManagers.values()];
  const results = await Promise.allSettled(
    managers.map((manager) => manager.shutdownSessions(options)),
  );
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected) throw rejected.reason;
  return results.every((result) => result.value === true);
}

module.exports = {
  getProjectThreadManager,
  getThreadManagerForTarget,
  awaitThreadManagerReady,
  shutdownThreadManagers,
  _getProjectThreadManagers: () => projectThreadManagers,
};
