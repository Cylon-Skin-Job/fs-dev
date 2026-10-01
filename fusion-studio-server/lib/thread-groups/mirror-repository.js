'use strict';

// SQL-only mirror repository; every query uses the supplied database/transaction.
async function getMirrorRecovery(db, { workspaceId, mirrorKey, operation }) {
  return db('thread_group_mirror_recovery')
    .where({ workspace_id: workspaceId, mirror_key: mirrorKey, operation })
    .first() || null;
}


async function listMirrorRecoveryForGroup(db, groupId, operation) {
  return db('thread_group_mirror_recovery')
    .where({ group_id: groupId, operation })
    .orderBy('id', 'asc');
}


async function insertMirrorRecovery(db, row) {
  await db('thread_group_mirror_recovery').insert({
    workspace_id: row.workspaceId,
    group_id: row.groupId,
    thread_id: row.threadId,
    mirror_key: row.mirrorKey,
    operation: row.operation,
    status: row.status || 'pending',
    failure_code: row.failureCode ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  });
}


async function markMirrorRecovery(db, {
  workspaceId, mirrorKey, operation, status, failureCode = null, now, expectedUpdatedAt = null,
}) {
  const query = db('thread_group_mirror_recovery')
    .where({ workspace_id: workspaceId, mirror_key: mirrorKey, operation });
  if (expectedUpdatedAt !== null) query.where('updated_at', expectedUpdatedAt);
  return query.update({ status, failure_code: failureCode, updated_at: now });
}


async function listPendingMirrorRecovery(db, workspaceId) {
  return db('thread_group_mirror_recovery')
    .where({ workspace_id: workspaceId })
    .whereIn('status', ['pending', 'failed'])
    .orderBy('id', 'asc');
}



module.exports = { getMirrorRecovery, listMirrorRecoveryForGroup, insertMirrorRecovery, markMirrorRecovery, listPendingMirrorRecovery };
