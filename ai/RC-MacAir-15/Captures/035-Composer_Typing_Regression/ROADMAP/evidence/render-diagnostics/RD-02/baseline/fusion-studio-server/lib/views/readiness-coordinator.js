'use strict';

const path = require('path');
const fs = require('fs');
const aiPaths = require('../workspace/ai-paths');

const {
  canonicalProjectRoot,
  parseMachineIdentity,
  parseWorkspaceId,
  readinessKey,
} = require('./relocation-identity');
const { ViewRelocationError, toRelocationError } = require('./relocation-errors');

function createViewReadinessCoordinator({ migrationService, machineIdentity } = {}) {
  if (!migrationService || typeof migrationService.ensureReady !== 'function') {
    throw new TypeError('view relocation service is required');
  }
  const machine = parseMachineIdentity(machineIdentity);
  const records = new Map();
  const roots = new Map();

  function normalize(input) {
    return Object.freeze({
      workspaceId: parseWorkspaceId(input.workspaceId),
      machineIdentity: machine,
      projectRoot: canonicalProjectRoot(input.projectRoot),
      allowViewless: input.allowViewless === true,
    });
  }

  async function ensureReady(input) {
    const context = normalize(input);
    const key = readinessKey(context.workspaceId, machine);
    const existing = records.get(key);
    if (existing) {
      if (existing.projectRoot !== context.projectRoot) {
        throw new ViewRelocationError('workspace_identity_mismatch');
      }
      if (existing.retiring) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      if (existing.status === 'ready') return existing.result;
      if (existing.status === 'preparing') {
        if (existing.preparationAllowsViewless && !context.allowViewless) {
          throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
        }
        if (!existing.preparationAllowsViewless && context.allowViewless) {
          return existing.promise.then(
            () => ensureReady(input),
            () => ensureReady(input),
          );
        }
        return existing.promise;
      }
      if (
        existing.status === 'unavailable'
        && context.allowViewless
        && existing.errorCode === 'viewless_not_allowed'
      ) {
        records.delete(key);
        if (roots.get(context.projectRoot) === key) roots.delete(context.projectRoot);
        return ensureReady(input);
      }
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    const rootOwner = roots.get(context.projectRoot);
    if (rootOwner && rootOwner !== key) throw new ViewRelocationError('workspace_identity_mismatch');

    const record = {
      status: 'preparing',
      projectRoot: context.projectRoot,
      leases: 0,
      result: null,
      errorCode: null,
      promise: null,
      retiring: false,
      retirementPromise: null,
      drainPromise: null,
      resolveDrain: null,
      preparationAllowsViewless: context.allowViewless,
    };
    roots.set(context.projectRoot, key);
    records.set(key, record);
    record.promise = migrationService.ensureReady(context)
      .then((result) => {
        if (
          result?.status !== 'verified'
          || result.workspaceId !== context.workspaceId
          || result.machineIdentity !== context.machineIdentity
          || result.projectRoot !== context.projectRoot
          || typeof result.destinationRoot !== 'string'
          || !path.isAbsolute(result.destinationRoot)
          || path.resolve(result.destinationRoot) !== aiPaths.getCanonicalMachineViewsRoot(
            context.projectRoot,
            context.machineIdentity,
          )
        ) {
          throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
        }
        if (record.retiring) {
          throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
        }
        record.status = 'ready';
        record.result = Object.freeze({ ...result, phase: 'journal_verified', verified: true });
        return record.result;
      })
      .catch((error) => {
        const normalized = toRelocationError(error);
        if (!record.retiring) {
          record.status = 'unavailable';
          record.errorCode = normalized.code;
        }
        throw normalized;
      });
    return record.promise;
  }

  function findRecord(input) {
    let key = null;
    if (typeof input?.workspaceId === 'string') key = readinessKey(input.workspaceId, machine);
    else if (typeof input?.projectRoot === 'string') key = roots.get(canonicalProjectRoot(input.projectRoot));
    return key ? records.get(key) : null;
  }

  function acquireLease(input) {
    const record = findRecord(input);
    if (!record || record.status !== 'ready' || record.retiring) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    if (typeof input?.projectRoot === 'string'
      && canonicalProjectRoot(input.projectRoot) !== record.projectRoot) {
      throw new ViewRelocationError('workspace_identity_mismatch', undefined, { journalFailure: false });
    }
    record.leases += 1;
    let released = false;
    return Object.freeze({
      phase: 'journal_verified',
      verified: true,
      projectRoot: record.projectRoot,
      viewsRoot: record.result.destinationRoot,
      release() {
        if (released) return;
        released = true;
        record.leases -= 1;
        if (record.retiring && record.leases === 0) record.resolveDrain?.();
      },
    });
  }

  function acquireViewlessScaffoldLease(input) {
    if (parseMachineIdentity(input.machineIdentity) !== machine) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    const projectRoot = canonicalProjectRoot(input.projectRoot);
    const rootOwner = roots.get(projectRoot);
    if (rootOwner) throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    const sourceRoot = aiPaths.getMigrationSourceViewsRoot(projectRoot, machine);
    const destinationRoot = aiPaths.getCanonicalMachineViewsRoot(projectRoot, machine);
    if (fs.existsSync(sourceRoot) || fs.existsSync(destinationRoot)) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    let cursor = path.dirname(projectRoot);
    const parent = fs.realpathSync(cursor);
    if (path.resolve(parent) !== path.resolve(cursor) || !fs.lstatSync(cursor).isDirectory()) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    const key = `viewless-scaffold\0${projectRoot}`;
    roots.set(projectRoot, key);
    let released = false;
    let completed = false;
    return Object.freeze({
      phase: 'viewless_scaffold',
      verified: false,
      projectRoot,
      viewsRoot: destinationRoot,
      complete() {
        if (released || completed || roots.get(projectRoot) !== key || fs.existsSync(sourceRoot)) {
          throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
        }
        const destination = fs.lstatSync(destinationRoot);
        if (destination.isSymbolicLink() || !destination.isDirectory()) {
          throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
        }
        completed = true;
        return true;
      },
      release() {
        if (released) return;
        released = true;
        if (roots.get(projectRoot) === key) roots.delete(projectRoot);
      },
    });
  }

  async function retireWorkspace(input, retirementEffect) {
    const workspaceId = parseWorkspaceId(input.workspaceId);
    const key = readinessKey(workspaceId, machine);
    const projectRoot = canonicalProjectRoot(input.projectRoot);
    let record = records.get(key);
    if (!record) {
      // Claim both identities before the deletion effect can yield. This
      // tombstone prevents a concurrent attach from preparing against a
      // registry row whose journal is about to cascade away.
      const rootOwner = roots.get(projectRoot);
      if (rootOwner && rootOwner !== key) {
        throw new ViewRelocationError('workspace_identity_mismatch', undefined, { journalFailure: false });
      }
      record = {
        status: 'retiring',
        projectRoot,
        leases: 0,
        result: null,
        errorCode: null,
        promise: null,
        retiring: true,
        retirementPromise: null,
        drainPromise: null,
        resolveDrain: null,
        preparationAllowsViewless: false,
      };
      records.set(key, record);
      roots.set(projectRoot, key);
    }
    if (projectRoot !== record.projectRoot) {
      throw new ViewRelocationError('workspace_identity_mismatch', undefined, { journalFailure: false });
    }
    if (record.retiring && record.retirementPromise) return record.retirementPromise;

    record.retiring = true;
    record.status = 'retiring';
    record.errorCode = null;
    record.retirementPromise = (async () => {
      if (record.promise) {
        try {
          await record.promise;
        } catch (_error) {}
      }
      if (record.leases > 0) {
        if (!record.drainPromise) {
          record.drainPromise = new Promise((resolve) => { record.resolveDrain = resolve; });
        }
        await record.drainPromise;
      }
      try {
        // Keep the tombstone installed through the durable registry deletion.
        return typeof retirementEffect === 'function' ? await retirementEffect() : true;
      } finally {
        if (records.get(key) === record) records.delete(key);
        if (roots.get(record.projectRoot) === key) roots.delete(record.projectRoot);
      }
    })();
    return record.retirementPromise;
  }

  function getStatus(input) {
    const record = findRecord(input);
    if (!record) return Object.freeze({ status: 'unavailable', verified: false });
    if (record.retiring) {
      return Object.freeze({
        status: 'unavailable',
        verified: false,
        phase: null,
        errorCode: 'view_registry_unavailable',
        leases: record.leases,
      });
    }
    return Object.freeze({
      status: record.status,
      verified: record.status === 'ready' && !record.retiring,
      phase: record.status === 'ready' ? 'journal_verified' : null,
      errorCode: record.errorCode,
      leases: record.leases,
    });
  }

  return Object.freeze({
    phase: 'journal_verified',
    acquireLease,
    acquireViewlessScaffoldLease,
    ensureReady,
    getStatus,
    retireWorkspace,
  });
}

module.exports = { createViewReadinessCoordinator };
