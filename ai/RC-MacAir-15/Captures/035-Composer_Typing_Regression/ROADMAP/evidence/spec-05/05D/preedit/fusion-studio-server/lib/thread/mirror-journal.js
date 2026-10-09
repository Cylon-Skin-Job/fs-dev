'use strict';

// SQL-only write-intent seam shared by canonical exchange persistence and the
// disposable projection owner. Use the caller's transaction, never a new DB.
async function invalidate(trx, threadId) {
  await trx('thread_group_mirror_recovery').where({ thread_id: threadId, operation: 'create' })
    .update({ status: 'pending', failure_code: null,
      updated_at: trx.raw('MAX(updated_at + 1, ?)', [Date.now()]) });
}

async function read(db, workspaceId, threadId) {
  return db('thread_group_mirror_recovery').where({ workspace_id: workspaceId,
    thread_id: threadId, operation: 'create' }).first();
}

module.exports = { invalidate, read };
