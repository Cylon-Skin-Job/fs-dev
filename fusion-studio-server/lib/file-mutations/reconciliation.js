'use strict';

const fs = require('fs');
const { createAtomicWriter } = require('./atomic-writer');
const { createFactReplay } = require('./fact-replay');
const { createPathAuthority } = require('./path-authority');
const { sha256 } = require('./text-codec');
const { MAX_SNAPSHOT_BYTES } = require('./file-version-repository');
const { readFileHandleBounded } = require('./bounded-file-read');

function createFileSaveReconciler({
  operations,
  reservations,
  publishers,
  pathAuthority = createPathAuthority(),
  atomicWriter = createAtomicWriter(),
  fsPromises = fs.promises,
  clock = Date.now,
  writeDiagnostic = () => {},
  publishResourceRefreshRequired = async () => {},
} = {}) {
  if (!operations || !reservations) throw new TypeError('file-save repositories are required');
  if (typeof publishResourceRefreshRequired !== 'function') {
    throw new TypeError('resource recovery publisher is required');
  }
  const replay = createFactReplay({
    operations,
    reservations,
    publishers,
    publishResourceRefreshRequired,
    clock,
    writeDiagnostic,
  });

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  async function recover(operation, reason) {
    try {
      await publishResourceRefreshRequired(Object.freeze({
        type: 'resource:refresh_required',
        version: 1,
        workspaceId: operation.workspaceId,
        panel: 'file-viewer',
        path: operation.canonicalPath,
        operationId: operation.operationId,
        reason,
      }));
    } catch (_error) {
      diagnose('resource_refresh_required_failed');
    }
  }

  async function observe(operation) {
    try {
      const target = await pathAuthority.resolveCanonical({
        workspaceId: operation.workspaceId,
        canonicalPath: operation.canonicalPath,
      });
      let stat;
      try {
        stat = await fsPromises.lstat(target.targetPath);
      } catch (error) {
        if (error.code === 'ENOENT') return { target, state: 'absent' };
        return { target, state: 'unreadable' };
      }
      if (stat.isSymbolicLink() || !stat.isFile()) return { target, state: 'unreadable' };
      if (stat.size > MAX_SNAPSHOT_BYTES || !Number.isInteger(fs.constants.O_NOFOLLOW)) {
        return { target, state: 'unreadable' };
      }
      let handle;
      try {
        handle = await fsPromises.open(target.targetPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        const openedStat = await handle.stat();
        if (!openedStat.isFile() || openedStat.size > MAX_SNAPSHOT_BYTES) {
          await handle.close();
          return { target, state: 'unreadable' };
        }
        const bytes = await readFileHandleBounded(handle);
        await handle.close();
        return { target, state: 'bytes', sha256: sha256(bytes), byteLength: bytes.length };
      } catch (_error) {
        try { await handle?.close(); } catch (_closeError) {}
        return { target, state: 'unreadable' };
      }
    } catch (_error) {
      return { target: null, state: 'unreadable' };
    }
  }

  async function cleanupTerminal(operation, knownTarget = null) {
    try {
      const target = knownTarget || await pathAuthority.resolveCanonical({
        workspaceId: operation.workspaceId,
        canonicalPath: operation.canonicalPath,
      });
      await atomicWriter.cleanup({ target, operationId: operation.operationId });
      return await operations.markTempCleanupComplete(operation.operationId, clock());
    } catch (_error) {
      diagnose('file_operation_temp_cleanup_pending');
      return operation;
    }
  }

  async function reconcile() {
    const initial = await operations.listForReconciliation();
    const results = [];
    for (const candidate of initial) {
      let operation = await operations.getById(candidate.operationId);
      if (!operation) continue;
      if (operation.state === 'accepted') {
        operation = await operations.markFailed({
          operationId: operation.operationId,
          failureCode: 'interrupted_before_prepare',
          completedAt: clock(),
          reconciledAt: clock(),
        });
        diagnose('file_operation_interrupted_before_prepare');
      } else if (operation.state === 'prepared') {
        if (operation.attemptedAt == null) {
          operation = await operations.markPreparedBeforeReplaceFailed({
            operationId: operation.operationId,
            completedAt: clock(),
          });
        } else {
          const observed = await observe(operation);
          operation = await operations.markOutcomeUnknown({
            operationId: operation.operationId,
            completedAt: clock(),
            observedTargetState: observed.state,
            ...(observed.state === 'bytes' ? {
              observedTargetSha256: observed.sha256,
              observedTargetByteLength: observed.byteLength,
            } : {}),
            reconciledAt: clock(),
          });
          diagnose('file_operation_outcome_unknown');
          operation = await cleanupTerminal(operation, observed.target);
          const intendedPostimageObserved = observed.state === 'bytes'
            && observed.sha256 === operation.intendedAfterSha256
            && observed.byteLength === operation.intendedAfterByteLength;
          if (intendedPostimageObserved) await recover(operation, 'mutation_outcome_unknown');
        }
      }

      operation = await replay.publishCommand(operation);
      if (operation.state === 'succeeded'
        && (operation.factAdmissionState === 'pending' || operation.ledgerProjectionState === 'pending')) {
        operation = await replay.publishResource(operation);
      }
      if (['failed', 'succeeded', 'outcome_unknown'].includes(operation.state)) {
        operation = await cleanupTerminal(operation);
      }
      results.push(operation);
    }
    return Object.freeze(results);
  }

  return Object.freeze({ reconcile });
}

module.exports = { createFileSaveReconciler };
