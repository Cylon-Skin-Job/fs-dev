'use strict';

/**
 * @module thread-groups/delete-service
 * @role The whole-group `delete` operation, its retained cleanup tombstone,
 *       and new-request-ID tombstone recovery.
 *
 * Extracted verbatim from `./service` (04A-D9 / 04C-D13 carry; the recorded
 * 04D-D4 split plan, mechanical split in Slice 05B). It runs against the
 * owning `ThreadGroupService` instance passed as the first argument, so every
 * lease, replay, context, and repository helper stays single-sourced on the
 * service. The public `ThreadGroupService` surface (`performAction`, the
 * `deleteGroup` method) is unchanged, and `DELETE_TOMBSTONE_TTL_MS` is
 * defined here and re-exported by `./service` under the same name and value.
 */

const repository = require('./repository');
const { buildDurableActionContext, canonicalTargetHash } = require('./action-identity');
const { groupMutationLeaseKey, withGroupMutationLease } = require('./group-mutation-lease');

/** Bounded recovery window for a deleted group's cleanup tombstone. */
const DELETE_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Delete one whole group with busy check, runtime fences, durable mirror
 * deletion + cleanup tombstone, and new-ID tombstone recovery (§9).
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function deleteGroup(service, {
  threadGroupId = null, threadId = null, requestId = null, componentContext = null,
} = {}) {
  const activation = await service.activate();
  if (!activation.ok) {
    return { ok: false, code: 'view_id_preflight_repair_required', diagnostics: activation.diagnostics };
  }
  const db = service.db;
  const targetHash = canonicalTargetHash({ action: 'delete', threadGroupId, threadId });

  if (requestId) {
    const existing = await repository.getActionResult(db, service.workspaceId, requestId);
    if (existing) {
      return service._replay(existing, { action: 'delete', threadGroupId, threadId });
    }
  }

  const groupRow = await service._resolveOwnedGroup({ threadGroupId, threadId });
  if (!groupRow) {
    return withGroupMutationLease(
      groupMutationLeaseKey(service.workspaceId, threadGroupId || threadId),
      () => recoverDeletedGroupWithinLease(service, {
        threadGroupId, threadId, requestId, componentContext, targetHash,
      }),
    );
  }

  return withGroupMutationLease(
    groupMutationLeaseKey(service.workspaceId, groupRow.group_id),
    async () => {
      if (requestId) {
        const replay = await repository.getActionResult(db, service.workspaceId, requestId);
        if (replay) return service._replay(replay, { action: 'delete', threadGroupId, threadId });
      }
      // A peer delete may have committed while this request waited. The
      // group lease is already held here, so recover without re-acquiring it.
      const current = await repository.getGroup(db, groupRow.group_id);
      if (!current) {
        return recoverDeletedGroupWithinLease(service, {
          threadGroupId: groupRow.group_id, threadId, requestId, componentContext, targetHash,
        });
      }

      const deleted = await service.operations.deleteGroup(groupRow.group_id, {
        tombstoneExpiresAt: Date.now() + DELETE_TOMBSTONE_TTL_MS,
        context: buildDurableActionContext({
          workspaceId: service.workspaceId,
          viewId: current.view_id ?? null,
          threadGroupId: groupRow.group_id,
          threadId: current.current_primary_thread_id ?? null,
          componentContext,
        }),
      });
      if (!deleted.deleted) {
        if (deleted.reason === 'group_busy') {
          return { ok: false, code: 'group_busy', busy: deleted.busy };
        }
        return { ok: false, code: 'not_found' };
      }

      // Post-commit mirror cleanup is separately failure-isolated; a failed
      // cleanup returns the retained state and stays repairable.
      let result = deleted.result;
      try {
        await service.operations.retryMirrorCleanupForGroup(groupRow.group_id);
      } catch (_error) {
        // Retained tombstone cleanup state already records the failure.
      }
      result = await refreshTombstoneAggregate(service, groupRow.group_id, result);

      if (requestId) {
        const now = Date.now();
        await repository.upsertActionResult(db, {
          workspaceId: service.workspaceId,
          requestId,
          action: 'delete',
          targetHash,
          resultJson: JSON.stringify(result),
          createdAt: now,
          updatedAt: now,
        });
      }
      return { ok: true, result };
    },
  );
}

/**
 * New-request recovery: while the group-scoped cleanup tombstone holds,
 * return the retained aggregate (not `not_found`, not a rerun), resume
 * idempotent repair, and bind the aggregate to the new request ID so replay
 * survives tombstone expiry (`CHAT-I-030`/`CHAT-I-032`). Past expiry an
 * unseen request receives ordinary `not_found` and the mutation is never
 * replayed.
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function recoverDeletedGroupWithinLease(service, {
  threadGroupId = null, threadId = null, requestId = null, componentContext = null, targetHash,
}) {
  const db = service.db;
  const tombstone = threadGroupId
    ? await repository.getDeleteTombstone(db, threadGroupId)
    : null;
  if (!tombstone
    || tombstone.workspaceId !== service.workspaceId
    || Number(tombstone.expiresAt) <= Date.now()) {
    return { ok: false, code: 'not_found' };
  }

  try {
    await service.operations.retryMirrorCleanupForGroup(tombstone.groupId);
  } catch (_error) {
    // Retained cleanup state below reflects the remaining pending work.
  }
  // Explicit cross-store retry: only the tombstoned group's unapplied
  // worksurface instruction is consumed; an applied/no-op delivery is
  // harmless.
  try {
    await service.operations.retryWorksurfaceCleanupForGroup(tombstone.groupId);
  } catch (_error) {
    // The refreshed aggregate below still reports the unapplied state.
  }
  let base;
  try {
    base = JSON.parse(tombstone.resultJson);
  } catch (_error) {
    base = { action: 'delete', threadGroupId: tombstone.groupId, deleted: true };
  }
  const result = await refreshTombstoneAggregate(
    service,
    tombstone.groupId,
    { ...base, recovered: true },
  );
  const context = base?.context
    ?? buildDurableActionContext({
      workspaceId: service.workspaceId,
      viewId: result.viewId ?? null,
      threadGroupId: result.threadGroupId,
      threadId: result.threadId ?? null,
      componentContext,
    });
  const durableResult = { ...result, context };
  if (requestId) {
    const now = Date.now();
    await repository.upsertActionResult(db, {
      workspaceId: service.workspaceId,
      requestId,
      action: 'delete',
      targetHash,
      resultJson: JSON.stringify(durableResult),
      createdAt: now,
      updatedAt: now,
    });
  }
  return { ok: true, result: durableResult, recovered: true };
}

/**
 * Recompute the retained cleanup aggregate from durable mirror records.
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {string} groupId
 * @param {object} baseResult
 */
async function refreshTombstoneAggregate(service, groupId, baseResult) {
  const db = service.db;
  const rows = await repository.listMirrorRecoveryForGroup(db, groupId, 'delete');
  const mirrors = rows.map((row) => ({
    threadId: row.thread_id,
    mirrorKey: row.mirror_key,
    status: row.status,
    failureCode: row.failure_code ?? null,
  }));
  const status = mirrors.some((mirror) => mirror.status === 'failed')
    ? 'failed'
    : mirrors.some((mirror) => mirror.status === 'pending')
      ? 'pending'
      : 'complete';
  const cleanup = { status, mirrors };
  const viewStateCleanup = await worksurfaceCleanupState(service, groupId);
  const result = { ...baseResult, cleanup, viewStateCleanup };
  try {
    await repository.updateDeleteTombstone(db, groupId, {
      resultJson: JSON.stringify(result),
      cleanupJson: JSON.stringify(cleanup),
      now: Date.now(),
    });
  } catch (_error) {
    // The durable action result below still carries the same aggregate.
  }
  return result;
}

/**
 * Observable worksurface-cleanup outbox state for one deleted group. Legacy
 * (and any group with no instruction) reports `not_applicable`.
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {string} groupId
 */
async function worksurfaceCleanupState(service, groupId) {
  const record = await repository.getWorksurfaceCleanup(service.db, groupId);
  if (!record || record.workspaceId !== service.workspaceId) {
    return { status: 'not_applicable', attempts: 0 };
  }
  return {
    status: record.status,
    attempts: record.attempts,
    ...(record.failureCode ? { failureCode: record.failureCode } : {}),
  };
}

module.exports = {
  DELETE_TOMBSTONE_TTL_MS,
  deleteGroup,
  refreshTombstoneAggregate,
  recoverDeletedGroupWithinLease,
  worksurfaceCleanupState,
};
