'use strict';

const aiPaths = require('../../../lib/workspace/ai-paths');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  canonicalProjectRoot,
  parseMachineIdentity,
  parseWorkspaceId,
  readinessKey,
} = require('../../../lib/views/relocation-identity');
const { ViewRelocationError } = require('../../../lib/views/relocation-errors');
const { validateCapsuleTree } = require('../../../lib/views/relocation-content-roots');
const {
  assertDirectoryChainStable,
  captureSafeDirectoryChain,
  collectInventory,
  isInside,
} = require('../../../lib/views/relocation-inventory');

function lstatOrNull(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null;
    throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
  }
}

function assertSafeExistingDirectoryChainSync(projectRoot, targetPath) {
  if (!isInside(projectRoot, targetPath)) {
    throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
  }
  const relative = path.relative(projectRoot, targetPath);
  const segments = relative ? relative.split(path.sep) : [];
  let cursor = projectRoot;
  let physicalProjectRoot = null;
  for (const segment of ['', ...segments]) {
    if (segment) cursor = path.join(cursor, segment);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return;
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    let physical;
    try {
      physical = path.resolve(fs.realpathSync(cursor));
    } catch (_error) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    if (!physicalProjectRoot) physicalProjectRoot = physical;
    if (!isInside(physicalProjectRoot, physical)) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
  }
}

/**
 * Slice-3-only integration adapter.
 *
 * This adapter never claims journal verification and never exposes the
 * canonical root. Slice 4 must replace it with createViewReadinessCoordinator
 * in the same change that cuts ordinary resolution to System/Views and invokes
 * the product relocation service for the live tree.
 *
 * Exact Slice-4 removal gate:
 * 1. after DB migration and machine-identity initialization, install one real
 *    coordinator backed by createViewRelocationService before the workspace
 *    controller starts;
 * 2. give scaffolding its registry workspace identity before capsule writes so
 *    the synthetic direct-writer bridge can be deleted;
 * 3. switch ordinary resolution to System/Views and pass every registered/live
 *    workspace through that coordinator before publication; and
 * Historical fixture support only. Production runtime has no import, export,
 * default, or fallback path to this adapter after VIEW-01 cutover. Delete this
 * test fixture once the relocation compatibility tests no longer need it.
 *    startup/attach tests observe exclusively journal_verified leases.
 */
function createPreCutoverViewReadinessAdapter({ machineIdentity } = {}) {
  const machine = parseMachineIdentity(machineIdentity);
  const records = new Map();
  const roots = new Map();

  async function ensureReady(input) {
    const workspaceId = parseWorkspaceId(input.workspaceId);
    const projectRoot = canonicalProjectRoot(input.projectRoot);
    const allowViewless = input.allowViewless === true;
    const key = readinessKey(workspaceId, machine);
    const prior = records.get(key);
    if (prior && prior.projectRoot !== projectRoot) {
      throw new ViewRelocationError('workspace_identity_mismatch', undefined, { journalFailure: false });
    }
    if (prior?.retiring) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    if (prior?.viewlessScaffoldPending && !allowViewless) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    if (prior && !prior.synthetic && (prior.status === 'preparing' || prior.revalidationPending)) {
      if (prior.preparationAllowsViewless && !allowViewless) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      if (!prior.preparationAllowsViewless && allowViewless) {
        return prior.promise.then(
          () => ensureReady(input),
          () => ensureReady(input),
        );
      }
      return prior.promise;
    }
    if (prior?.synthetic && prior.leases !== 0) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    let record;
    let inheritedViewlessScaffoldPending = false;
    if (prior && !prior.synthetic) {
      // Staging is deliberately not journal verification. Revalidate the live
      // legacy tree on every admission instead of trusting a cached result.
      // If an admitted operation is still running, fence new ensured callers
      // behind its lease drain while leaving the staged status available to
      // that operation's nested trusted resolvers.
      record = prior;
      record.promise = null;
      if (record.leases > 0) {
        record.revalidationPending = true;
        if (!record.drainPromise) {
          record.drainPromise = new Promise((resolve) => { record.resolveDrain = resolve; });
        }
      } else {
        record.status = 'preparing';
      }
    } else {
      if (prior?.synthetic) {
        inheritedViewlessScaffoldPending = prior.viewlessScaffoldPending === true;
        records.delete(key);
      }
      const rootOwner = roots.get(projectRoot);
      if (rootOwner && rootOwner !== key) {
        const stagedOwner = records.get(rootOwner);
        // A direct internal writer can be the first Slice-3 caller for a root.
        // Replace that explicitly synthetic staging record when the registry's
        // canonical workspace identity reaches the coordinator. A real owner is
        // never replaced, and the Slice-4 journal coordinator has no such path.
        if (!stagedOwner?.synthetic || stagedOwner.leases !== 0) {
          throw new ViewRelocationError('workspace_identity_mismatch', undefined, { journalFailure: false });
        }
        if (stagedOwner.viewlessScaffoldPending && !allowViewless) {
          throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
        }
        inheritedViewlessScaffoldPending = (
          inheritedViewlessScaffoldPending
          || stagedOwner.viewlessScaffoldPending === true
        );
        records.delete(rootOwner);
      }
      record = {
        status: 'preparing',
        projectRoot,
        result: null,
        leases: 0,
        synthetic: false,
        retiring: false,
        revalidationPending: false,
        retirementPromise: null,
        promise: null,
        drainPromise: null,
        resolveDrain: null,
        preparationAllowsViewless: false,
        viewlessScaffoldPending: inheritedViewlessScaffoldPending,
      };
      records.set(key, record);
      roots.set(projectRoot, key);
    }

    record.preparationAllowsViewless = allowViewless;
    record.promise = (async () => {
      if (record.revalidationPending) {
        await record.drainPromise;
        record.revalidationPending = false;
        record.drainPromise = null;
        record.resolveDrain = null;
        if (record.retiring || records.get(key) !== record) {
          throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
        }
        record.status = 'preparing';
      }
      const workspaceState = lstatOrNull(projectRoot);
      if (!workspaceState || workspaceState.isSymbolicLink() || !workspaceState.isDirectory()) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      try {
        await captureSafeDirectoryChain(projectRoot, projectRoot);
      } catch (_error) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      const sourceRoot = aiPaths.getMigrationSourceViewsRoot(projectRoot, machine);
      const destinationRoot = aiPaths.getCanonicalMachineViewsRoot(projectRoot, machine);
      // Both-absent is available only to the explicit Add/Create scaffold
      // policy. Validate every ancestor that already exists before recording
      // readiness, even though there is no tree to inventory yet.
      let sourceAncestry;
      let destinationAncestry;
      try {
        [sourceAncestry, destinationAncestry] = await Promise.all([
          captureSafeDirectoryChain(projectRoot, sourceRoot, undefined, { allowMissing: true }),
          captureSafeDirectoryChain(projectRoot, destinationRoot, undefined, { allowMissing: true }),
        ]);
        await Promise.all([
          assertDirectoryChainStable(sourceAncestry),
          assertDirectoryChainStable(destinationAncestry),
        ]);
      } catch (_error) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      const sourceState = lstatOrNull(sourceRoot);
      const destinationState = lstatOrNull(destinationRoot);
      // This bridge can expose only the still-active pre-cutover namespace.
      // Canonical bytes are never interpreted through the retired resolver.
      if (destinationState) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      if (sourceState && (sourceState.isSymbolicLink() || !sourceState.isDirectory())) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      if (!sourceState && !allowViewless) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      if (sourceState) {
        try {
          const ancestry = await captureSafeDirectoryChain(projectRoot, sourceRoot);
          await collectInventory({ sourceRoot, destinationRoot });
          await validateCapsuleTree({
            projectRoot,
            machineIdentity: machine,
            sourceRoot,
            destinationRoot,
            currentRoot: sourceRoot,
            projectedRoot: destinationRoot,
          });
          await assertDirectoryChainStable(ancestry);
        } catch (_error) {
          throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
        }
      }
      if (record.retiring || records.get(key) !== record) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      record.result = Object.freeze({
        status: 'staged',
        phase: 'precutover_staged',
        verified: false,
        workspaceId,
        machineIdentity: machine,
        projectRoot,
        sourceRoot,
      });
      record.viewlessScaffoldPending = record.viewlessScaffoldPending || !sourceState;
      record.status = 'staged';
      return record.result;
    })().catch((error) => {
      if (!record.retiring) {
        record.status = 'unavailable';
        record.result = null;
        record.promise = null;
        record.revalidationPending = false;
        record.drainPromise = null;
        record.resolveDrain = null;
      }
      throw error;
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
    let record = findRecord(input);
    // Direct internal/unit callers predate workspace-identity plumbing. This
    // staging-only bridge is intentionally unavailable to the real
    // journal-verified coordinator installed by Slice 4.
    if (!record && typeof input?.projectRoot === 'string') {
      if (input.allowViewless !== true) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      const projectRoot = canonicalProjectRoot(input.projectRoot);
      const sourceRoot = aiPaths.getMigrationSourceViewsRoot(projectRoot, machine);
      const destinationRoot = aiPaths.getCanonicalMachineViewsRoot(projectRoot, machine);
      const sourceState = lstatOrNull(sourceRoot);
      if (
        lstatOrNull(destinationRoot)
        || sourceState
      ) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      // Synthetic leases exist only for a truly absent scaffold root. Validate
      // every already-existing lexical ancestor so a scaffold cannot follow a
      // pre-existing symlink before the registry identity is available.
      assertSafeExistingDirectoryChainSync(projectRoot, sourceRoot);
      const syntheticId = `precutover-${crypto.createHash('sha256').update(projectRoot).digest('hex').slice(0, 32)}`;
      const key = readinessKey(syntheticId, machine);
      const result = Object.freeze({
        status: 'staged',
        phase: 'precutover_staged',
        verified: false,
        workspaceId: syntheticId,
        machineIdentity: machine,
        projectRoot,
        sourceRoot,
      });
      record = {
        status: 'staged',
        projectRoot,
        result,
        leases: 0,
        synthetic: true,
        retiring: false,
        revalidationPending: false,
        retirementPromise: null,
        promise: null,
        drainPromise: null,
        resolveDrain: null,
        preparationAllowsViewless: true,
        viewlessScaffoldPending: true,
      };
      records.set(key, record);
      roots.set(projectRoot, key);
    }
    if (!record || record.retiring || record.status !== 'staged' || !record.result) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    if (record.viewlessScaffoldPending && input.allowViewless !== true) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    record.leases += 1;
    let released = false;
    const canCompleteViewlessScaffold = (
      record.viewlessScaffoldPending
      && input.allowViewless === true
    );
    const leaseBinding = Object.freeze({
      workspaceId: record.result.workspaceId,
      machineIdentity: record.result.machineIdentity,
      projectRoot: record.projectRoot,
      viewsRoot: record.result.sourceRoot,
    });
    function completeViewlessScaffold(completedViewsRoot = leaseBinding.viewsRoot) {
      if (
        released
        || record.retiring
        || record.status !== 'staged'
        || !record.viewlessScaffoldPending
        || record.result.workspaceId !== leaseBinding.workspaceId
        || record.result.machineIdentity !== leaseBinding.machineIdentity
        || record.projectRoot !== leaseBinding.projectRoot
        || record.result.sourceRoot !== leaseBinding.viewsRoot
        || records.get(readinessKey(leaseBinding.workspaceId, leaseBinding.machineIdentity)) !== record
        || roots.get(leaseBinding.projectRoot) !== readinessKey(
          leaseBinding.workspaceId,
          leaseBinding.machineIdentity,
        )
      ) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      if (typeof completedViewsRoot !== 'string') {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      const completedRoot = path.resolve(completedViewsRoot);
      const completedState = lstatOrNull(completedRoot);
      if (
        completedRoot !== path.resolve(leaseBinding.viewsRoot)
        || !completedState?.isDirectory()
        || completedState.isSymbolicLink()
      ) {
        throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
      }
      assertSafeExistingDirectoryChainSync(record.projectRoot, completedRoot);
      // Only the explicit scaffold writer holding this live capability may end
      // the temporary policy fence. Ordinary callers remain unable to borrow a
      // viewless staged record before trusted scaffolding reports completion.
      record.viewlessScaffoldPending = false;
    }
    return Object.freeze({
      phase: 'precutover_staged',
      verified: false,
      ...leaseBinding,
      ...(canCompleteViewlessScaffold ? { completeViewlessScaffold } : {}),
      release() {
        if (released) return;
        released = true;
        record.leases -= 1;
        if ((record.retiring || record.revalidationPending) && record.leases === 0) {
          record.resolveDrain?.();
        }
      },
    });
  }

  async function retireWorkspace(input, retirementEffect) {
    const workspaceId = parseWorkspaceId(input.workspaceId);
    const key = readinessKey(workspaceId, machine);
    const projectRoot = canonicalProjectRoot(input.projectRoot);
    let record = records.get(key);
    if (!record) {
      // Match the real coordinator's remove/reattach exclusion even though
      // this temporary owner never claims journal verification.
      const rootOwner = roots.get(projectRoot);
      if (rootOwner && rootOwner !== key) {
        throw new ViewRelocationError('workspace_identity_mismatch', undefined, { journalFailure: false });
      }
      record = {
        status: 'retiring',
        projectRoot,
        result: null,
        leases: 0,
        synthetic: false,
        retiring: true,
        revalidationPending: false,
        retirementPromise: null,
        promise: null,
        drainPromise: null,
        resolveDrain: null,
        preparationAllowsViewless: false,
        viewlessScaffoldPending: false,
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
        // Retain the tombstone until the registry deletion effect settles.
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
    if (!record || record.retiring) {
      return Object.freeze({ status: 'unavailable', verified: false });
    }
    return Object.freeze({
      status: record.status,
      phase: record.status === 'staged' ? 'precutover_staged' : null,
      verified: false,
      leases: record.leases,
    });
  }

  return Object.freeze({
    phase: 'precutover_staged',
    acquireLease,
    ensureReady,
    getStatus,
    retireWorkspace,
  });
}

module.exports = { createPreCutoverViewReadinessAdapter };
