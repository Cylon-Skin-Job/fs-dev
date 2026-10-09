'use strict';

const repository = require('./repository');
const { groupMutationLeaseKey, withGroupMutationLease } = require('./group-mutation-lease');

// Own the initial group transaction; session SQL/mirror invariants are delegated.
async function createGroup({ db, workspaceId, sessions }, threadId, name, options = {}) {
  return withGroupMutationLease(groupMutationLeaseKey(workspaceId, options.groupId || threadId), async () => {
    const now = Date.now();
    const groupId = options.groupId || threadId;
    const viewId = options.viewId === undefined ? null : options.viewId;

    await db.transaction(async (trx) => {
      const createdAt = await sessions.stageNewSession(trx, { ...options, threadId, name, groupId });
      await repository.insertGroup(trx, {
        groupId,
        workspaceId,
        viewId,
        name,
        currentPrimaryThreadId: threadId,
        createdAt: createdAt,
        updatedAt: now,
      });
      await repository.insertMember(trx, {
        groupId,
        threadId,
        ordinal: 1,
        originKind: 'initial',
        joinedAt: createdAt,
      });
      await repository.insertPrimaryEvent(trx, {
        groupId,
        sequence: 1,
        previousThreadId: null,
        nextThreadId: threadId,
        reason: 'initial',
        occurredAt: createdAt,
      });
      await repository.insertActivityEvent(trx, {
        eventKey: `initial:${groupId}`,
        groupId,
        threadId,
        turnId: null,
        kind: 'initial',
        occurredAt: createdAt,
      });
      if (options.requestId && options.action) {
        await repository.insertActionResult(trx, {
          workspaceId,
          requestId: options.requestId,
          action: options.action,
          targetHash: options.targetHash || 'creation',
          resultJson: JSON.stringify(options.actionResult || { threadId, threadGroupId: groupId }),
          createdAt: now,
          updatedAt: now,
        });
      }
    });

  });
}

// Raw deletion is supported only for an exact singleton. Revalidate under the
// same lease as Move/Delete; journal failure must roll the SQL deletion back.
async function deleteSingleSession({ db, workspaceId, sessions, closeSession }, threadId) {
  const found = await repository.getGroupForThread(db, threadId);
  if (found && found.workspace_id !== workspaceId) return null;
  return withGroupMutationLease(groupMutationLeaseKey(workspaceId, found?.group_id || threadId), async () => {
    const group = await repository.getGroupForThread(db, threadId);
    if (group && (group.workspace_id !== workspaceId
      || (await repository.listMembers(db, group.group_id)).length !== 1)) return null;
    await closeSession(threadId);
    let deleted = 0;
    await db.transaction(async (trx) => {
      if (group) {
        await sessions.stageDeletion(trx, threadId, group.group_id);
      }
      deleted = await sessions.deleteRows(trx, [threadId]);
      if (deleted && group) await repository.deleteGroup(trx, group.group_id);
    });
    return deleted ? { group } : null;
  });
}

module.exports = { createGroup, deleteSingleSession };
