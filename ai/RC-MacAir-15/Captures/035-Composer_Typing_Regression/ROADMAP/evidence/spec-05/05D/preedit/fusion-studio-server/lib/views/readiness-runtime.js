'use strict';

const path = require('path');
const { ViewRelocationError } = require('./relocation-errors');

const unavailableOwner = Object.freeze({
  ensureReady: async () => { throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false }); },
  acquireLease: () => { throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false }); },
  getStatus: () => Object.freeze({ status: 'unavailable', verified: false }),
});
let owner = unavailableOwner;
let ownerGeneration = 0;
let installed = false;
const activeLeases = new WeakMap();

function installViewReadinessOwner(nextOwner) {
  if (
    !nextOwner
    || typeof nextOwner.ensureReady !== 'function'
    || typeof nextOwner.acquireLease !== 'function'
    || typeof nextOwner.getStatus !== 'function'
  ) throw new TypeError('view readiness owner is invalid');
  owner = nextOwner;
  ownerGeneration += 1;
  installed = true;
  return owner;
}

function hasInstalledViewReadinessOwner() { return installed; }

async function ensureWorkspaceViewReadiness(input) {
  return owner.ensureReady(input);
}

async function ensureRegisteredWorkspaceReadiness(workspaces) {
  const results = new Map();
  for (const workspace of workspaces) {
    const workspaceId = workspace?.id;
    const projectRoot = workspace?.repoPath ?? workspace?.repo_path;
    if (typeof workspaceId !== 'string' || typeof projectRoot !== 'string') continue;
    try {
      results.set(workspaceId, await owner.ensureReady({ workspaceId, projectRoot }));
    } catch (_error) {
      results.set(workspaceId, Object.freeze({
        status: 'unavailable',
        verified: false,
        code: 'view_registry_unavailable',
      }));
    }
  }
  return results;
}

function acquireViewReadinessLease(input) {
  const ownedLease = owner.acquireLease(input);
  if (!ownedLease || typeof ownedLease.release !== 'function') {
    throw new TypeError('view readiness owner returned an invalid lease');
  }
  let released = false;
  const lease = Object.freeze({
    ...ownedLease,
    release() {
      if (released) return;
      released = true;
      activeLeases.delete(lease);
      ownedLease.release();
    },
  });
  activeLeases.set(lease, ownerGeneration);
  return lease;
}

function acquireViewlessScaffoldLease(input) {
  if (typeof owner.acquireViewlessScaffoldLease !== 'function') {
    throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
  }
  return owner.acquireViewlessScaffoldLease(input);
}

function assertActiveViewReadinessLease(input, lease) {
  if (
    !lease
    || activeLeases.get(lease) !== ownerGeneration
    || typeof lease.release !== 'function'
    || typeof lease.projectRoot !== 'string'
    || typeof input?.projectRoot !== 'string'
    || path.resolve(lease.projectRoot) !== path.resolve(input.projectRoot)
    || lease.phase !== 'journal_verified'
    || lease.verified !== true
  ) {
    throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
  }
  return lease;
}

async function withViewReadinessLease(input, callback) {
  if (typeof callback !== 'function') throw new TypeError('view readiness callback is required');
  const lease = acquireViewReadinessLease(input);
  try {
    return await callback(lease);
  } finally {
    lease.release();
  }
}

function getViewReadinessStatus(input) {
  return owner.getStatus(input);
}

async function retireWorkspaceViewReadiness(input, retirementEffect) {
  if (typeof owner.retireWorkspace !== 'function') {
    return typeof retirementEffect === 'function' ? retirementEffect() : false;
  }
  return owner.retireWorkspace(input, retirementEffect);
}

function boundedViewRegistryUnavailable() {
  return Object.freeze({ code: 'view_registry_unavailable' });
}

module.exports = {
  acquireViewReadinessLease,
  acquireViewlessScaffoldLease,
  assertActiveViewReadinessLease,
  boundedViewRegistryUnavailable,
  ensureRegisteredWorkspaceReadiness,
  ensureWorkspaceViewReadiness,
  getViewReadinessStatus,
  hasInstalledViewReadinessOwner,
  installViewReadinessOwner,
  retireWorkspaceViewReadiness,
  withViewReadinessLease,
};
