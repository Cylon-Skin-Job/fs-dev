'use strict';

/**
 * @module thread-groups/worksurface-cleanup
 * @role Trusted in-process consumer for the durable `remove-group-worksurface`
 *       projection/outbox (`SPEC-03 §7/§8`).
 *
 * The Thread Group delete transaction atomically records one cleanup
 * instruction with the group tombstone (no snapshot). After commit, or on
 * restart/recovery, this consumer drains unapplied instructions: it derives the
 * workspace/project root from the owning server service (never from the record
 * content), removes only the exact `{workspaceId, viewId, threadGroupId}` entry
 * through the view-state writer, and acknowledges (`applied`) or records a
 * failure (`failed`, attempts, timestamp) that stays observable and retryable.
 *
 * Idempotency: the unique `idempotency_key` plus the view-state service's
 * absent-entry no-op make a repeated delivery harmless. A failure here never
 * rolls back the committed group deletion.
 */

const repository = require('./repository');
const { removeThreadWorksurface } = require('../view-state/thread-worksurface');

const CLEANUP_PREFIX = 'remove-group-worksurface';

/** Stable per-group idempotency key for the remove instruction. */
function buildWorksurfaceCleanupKey({ workspaceId, viewId, threadGroupId }) {
  return `${CLEANUP_PREFIX}:${workspaceId}:${viewId}:${threadGroupId}`;
}

/** Observable delivery state for one instruction (or a non-view-bound group). */
function cleanupResult(record) {
  if (!record) return { status: 'not_applicable', attempts: 0 };
  return {
    status: record.status,
    attempts: Number(record.attempts || 0),
    ...(record.failureCode ? { failureCode: record.failureCode } : {}),
  };
}

/** Bounded, classified failure code stored on the instruction. */
function classifyFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (/^[a-z0-9_]{1,64}$/.test(code)) return code;
  return 'view_state_unavailable';
}

/**
 * Consume exactly one instruction. Failure-isolated: a delivery failure is
 * recorded and reported, never thrown at the committed delete.
 */
async function consumeWorksurfaceCleanup(db, { workspaceId, projectRoot, record }) {
  if (!record) return cleanupResult(null);
  if (record.workspaceId !== workspaceId) return cleanupResult(null);
  if (record.status === 'applied') return cleanupResult(record);

  const now = Date.now();
  try {
    const outcome = await removeThreadWorksurface(projectRoot, record.viewId, record.groupId);
    await repository.markWorksurfaceCleanup(db, {
      idempotencyKey: record.idempotencyKey,
      status: 'applied',
      failureCode: null,
      appliedAt: now,
      now,
    });
    return {
      ...cleanupResult({ ...record, status: 'applied', attempts: record.attempts + 1 }),
      removed: Boolean(outcome?.removed),
    };
  } catch (error) {
    const failureCode = classifyFailure(error);
    try {
      await repository.markWorksurfaceCleanup(db, {
        idempotencyKey: record.idempotencyKey,
        status: 'failed',
        failureCode,
        appliedAt: null,
        now,
      });
    } catch (_markError) {
      // The delivery attempt is best-effort; a failed status write still leaves
      // the instruction unapplied and retryable.
    }
    return cleanupResult({
      ...record, status: 'failed', attempts: record.attempts + 1, failureCode,
    });
  }
}

/** Retry one group's unapplied instruction by its idempotency key. */
async function consumeWorksurfaceCleanupForGroup(db, { workspaceId, projectRoot, groupId }) {
  const record = await repository.getWorksurfaceCleanup(db, groupId);
  if (!record || record.workspaceId !== workspaceId) return cleanupResult(null);
  return consumeWorksurfaceCleanup(db, { workspaceId, projectRoot, record });
}

/** Restart/recovery sweep: drain every unapplied instruction for one workspace. */
async function consumePendingWorksurfaceCleanup(db, { workspaceId, projectRoot }) {
  const records = await repository.listUnappliedWorksurfaceCleanup(db, workspaceId);
  const outcomes = [];
  for (const record of records) {
    outcomes.push(await consumeWorksurfaceCleanup(db, { workspaceId, projectRoot, record }));
  }
  return outcomes;
}

module.exports = {
  buildWorksurfaceCleanupKey,
  classifyFailure,
  cleanupResult,
  consumePendingWorksurfaceCleanup,
  consumeWorksurfaceCleanupForGroup,
};
