'use strict';

const TABLE = 'prompt_submission_receipts';

function key({ workspaceId, threadId, requestId }) {
  return { workspace_id: workspaceId, thread_id: threadId, request_id: requestId };
}

async function get(db, identity) {
  return db(TABLE).where(key(identity)).first();
}

async function reserve(db, identity, { fingerprint, snapshotJson, generation }) {
  const now = Date.now();
  await db(TABLE).insert({ ...key(identity), fingerprint, snapshot_json: snapshotJson,
    generation, outcome: 'reserved', execution: 'not_dispatched', created_at: now, updated_at: now });
  return get(db, identity);
}

async function cancelAbsent(db, identity, generation) {
  const now = Date.now();
  await db(TABLE).insert({ ...key(identity), generation, outcome: 'cancelled',
    execution: 'not_dispatched', reason: 'recovery_fence', created_at: now, updated_at: now });
  return get(db, identity);
}

async function transition(db, identity, from, patch) {
  const count = await db(TABLE).where({ ...key(identity), outcome: from })
    .update({ ...patch, updated_at: Date.now() });
  return count === 1;
}

async function claimDispatch(db, identity) {
  const count = await db(TABLE).where({ ...key(identity), outcome: 'accepted', execution: 'not_dispatched' })
    .update({ execution: 'claimed', updated_at: Date.now() });
  return count === 1;
}

async function failBeforeDispatch(db, identity, reason) {
  const count = await db(TABLE).where({ ...key(identity), outcome: 'accepted',
    execution: 'not_dispatched' }).update({ execution: 'failed_before_dispatch',
    reason, updated_at: Date.now() });
  return count === 1;
}

async function noteClaimedFailure(db, identity, reason) {
  const count = await db(TABLE).where({ ...key(identity), outcome: 'accepted',
    execution: 'claimed' }).update({ reason, updated_at: Date.now() });
  return count === 1;
}

async function recoverInterrupted(db) {
  return db.transaction(async (trx) => {
    const reserved = await trx(TABLE).where({ outcome: 'reserved' }).update({ outcome: 'cancelled',
      reason: 'server_restart', updated_at: Date.now() });
    const accepted = await trx(TABLE).where({ outcome: 'accepted',
      execution: 'not_dispatched' }).update({ execution: 'interrupted_before_dispatch',
      reason: 'server_restart', updated_at: Date.now() });
    return { reserved, accepted };
  });
}

module.exports = { get, reserve, cancelAbsent, transition, claimDispatch,
  failBeforeDispatch, noteClaimedFailure, recoverInterrupted };
