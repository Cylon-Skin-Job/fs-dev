'use strict';

// Own the whole-group SQL deletion transition under the caller's mutation lease.
const { getDb } = require('../db');
const repository = require('./repository');
const { buildWorksurfaceCleanupKey } = require('./worksurface-cleanup');
const { DELETE_TOMBSTONE_TTL_MS: DEFAULT_DELETE_TOMBSTONE_TTL_MS } = require('./delete-service');

async function deleteGroupWithinLease({ workspaceId, sessions, mirror, retryWorksurfaceCleanup }, groupId, { tombstoneExpiresAt = null, context = null } = {}) {
    const db = getDb();
    const groupRow = await repository.getGroup(db, groupId);
    if (!groupRow || groupRow.workspace_id !== workspaceId) {
      return { deleted: false, reason: 'not_found' };
    }
    const members = await repository.listMembers(db, groupId);
    if (members.length === 0) return { deleted: false, reason: 'not_found' };

    const busy = [];
    for (const member of members) {
      const state = sessions.memberBusy(member.thread_id);
      if (state) busy.push({ threadId: member.thread_id, state });
    }
    if (busy.length > 0) return { deleted: false, reason: 'group_busy', busy };

    for (const member of members) {
      await sessions.fenceMember(member.thread_id);
    }

    const projection = await repository.getGroupProjection(db, groupId);
    const now = Date.now();
    const memberRecords = members.map((member) => ({
      threadId: member.thread_id,
      mirrorKey: mirror.key(member.thread_id),
    }));
    const viewId = projection?.viewId ?? null;
    const cleanup = {
      status: 'pending',
      mirrors: memberRecords.map((member) => ({
        threadId: member.threadId,
        mirrorKey: member.mirrorKey,
        status: 'pending',
        failureCode: null,
      })),
    };
    // A view-bound group records exactly one durable worksurface-cleanup
    // instruction in the same transaction as the group deletion/tombstone.
    // Legacy groups (`viewId: null`) own no worksurface and create no record.
    const viewStateCleanup = viewId
      ? { status: 'pending', attempts: 0 }
      : { status: 'not_applicable', attempts: 0 };
    const result = {
      action: 'delete',
      threadGroupId: groupId,
      threadId: projection?.currentPrimaryThreadId ?? memberRecords[0]?.threadId ?? null,
      workspaceId: workspaceId,
      viewId,
      members: memberRecords,
      deleted: true,
      cleanup,
      viewStateCleanup,
      context: context || null,
    };
    const expiresAt = Number.isFinite(tombstoneExpiresAt) && tombstoneExpiresAt > now
      ? tombstoneExpiresAt
      : now + DEFAULT_DELETE_TOMBSTONE_TTL_MS;

    await db.transaction(async (trx) => {
      const current = await repository.getGroup(trx, groupId);
      const currentMembers = await repository.listMembers(trx, groupId);
      if (!current || current.workspace_id !== workspaceId
        || currentMembers.length !== members.length
        || currentMembers.some((row) => !members.some((member) => member.thread_id === row.thread_id))) {
        throw new Error('Group membership changed before deletion');
      }
      for (const member of memberRecords) {
        await mirror.stage(trx, { threadId: member.threadId, groupId, operation: 'delete' });
      }
      if (viewId) {
        await repository.insertWorksurfaceCleanup(trx, {
          idempotencyKey: buildWorksurfaceCleanupKey({
            workspaceId: workspaceId,
            viewId,
            threadGroupId: groupId,
          }),
          workspaceId: workspaceId,
          viewId,
          groupId,
          status: 'pending',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      await repository.insertDeleteTombstone(trx, {
        groupId,
        workspaceId: workspaceId,
        resultJson: JSON.stringify(result),
        cleanupJson: JSON.stringify(cleanup),
        createdAt: now,
        updatedAt: now,
        expiresAt,
      });
      await sessions.deleteRows(trx, memberRecords.map((member) => member.threadId));
      await repository.deleteGroup(trx, groupId);
    });

    // Post-commit cross-store delivery. Failure-isolated: the group deletion is
    // committed and success-shaped regardless; a failure leaves the instruction
    // observable/retryable and never rolls back.
    let committedViewStateCleanup = viewStateCleanup;
    if (viewId) {
      try {
        committedViewStateCleanup = await retryWorksurfaceCleanup(groupId);
      } catch (_error) {
        committedViewStateCleanup = { status: 'failed', attempts: 0, failureCode: 'view_state_unavailable' };
      }
    }

    return {
      deleted: true,
      result: { ...result, viewStateCleanup: committedViewStateCleanup },
      members: memberRecords,
    };
  }

module.exports = { deleteGroupWithinLease };
