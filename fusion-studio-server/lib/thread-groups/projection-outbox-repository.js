'use strict';

// SQL-only projection outbox repository; every query uses the supplied database/transaction.
function toWorksurfaceCleanup(row) {
  if (!row) return null;
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    workspaceId: row.workspace_id,
    viewId: row.view_id,
    groupId: row.group_id,
    status: row.status,
    attempts: Number(row.attempts || 0),
    failureCode: row.last_failure_code ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    appliedAt: row.applied_at ?? null,
  };
}


async function insertWorksurfaceCleanup(db, row) {
  await db('thread_group_worksurface_cleanup')
    .insert({
      idempotency_key: row.idempotencyKey,
      workspace_id: row.workspaceId,
      view_id: row.viewId,
      group_id: row.groupId,
      status: row.status || 'pending',
      attempts: row.attempts || 0,
      last_failure_code: row.failureCode ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      applied_at: row.appliedAt ?? null,
    })
    .onConflict('idempotency_key')
    .ignore();
}


async function getWorksurfaceCleanup(db, groupId) {
  const row = await db('thread_group_worksurface_cleanup')
    .where('group_id', groupId)
    .orderBy('id', 'desc')
    .first();
  return toWorksurfaceCleanup(row);
}


async function listUnappliedWorksurfaceCleanup(db, workspaceId) {
  const rows = await db('thread_group_worksurface_cleanup')
    .where({ workspace_id: workspaceId })
    .whereNot('status', 'applied')
    .orderBy('id', 'asc');
  return rows.map(toWorksurfaceCleanup);
}


async function markWorksurfaceCleanup(db, {
  idempotencyKey, status, failureCode = null, appliedAt = null, now,
}) {
  await db('thread_group_worksurface_cleanup')
    .where({ idempotency_key: idempotencyKey })
    .update({
      status,
      attempts: db.raw('attempts + 1'),
      last_failure_code: failureCode,
      updated_at: now,
      applied_at: appliedAt,
    });
}


function toPlacementOutbox(row) {
  if (!row) return null;
  return {
    id: row.id,
    sideChatPlacementId: row.side_chat_placement_id,
    idempotencyKey: row.idempotency_key,
    workspaceId: row.workspace_id,
    viewId: row.view_id,
    groupId: row.group_id,
    threadId: row.thread_id,
    operation: row.operation,
    status: row.status,
    attempts: Number(row.attempts || 0),
    failureCode: row.last_failure_code ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    appliedAt: row.applied_at ?? null,
  };
}


async function insertPlacementOutbox(db, row) {
  await db('thread_group_placement_outbox')
    .insert({
      side_chat_placement_id: row.sideChatPlacementId,
      idempotency_key: row.idempotencyKey,
      workspace_id: row.workspaceId,
      view_id: row.viewId,
      group_id: row.groupId,
      thread_id: row.threadId,
      operation: row.operation || 'open-side-chat-tab',
      status: row.status || 'pending',
      attempts: row.attempts || 0,
      last_failure_code: row.failureCode ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      applied_at: row.appliedAt ?? null,
    })
    .onConflict('idempotency_key')
    .ignore();
}


async function getPlacementOutboxByIdempotencyKey(db, idempotencyKey) {
  const row = await db('thread_group_placement_outbox')
    .where('idempotency_key', idempotencyKey)
    .first();
  return toPlacementOutbox(row);
}


async function getPlacementOutboxForGroup(db, groupId) {
  const row = await db('thread_group_placement_outbox')
    .where('group_id', groupId)
    .orderBy('id', 'desc')
    .first();
  return toPlacementOutbox(row);
}


async function listUnappliedPlacementOutbox(db, workspaceId) {
  const rows = await db('thread_group_placement_outbox')
    .where({ workspace_id: workspaceId })
    .whereNot('status', 'applied')
    .orderBy('id', 'asc');
  return rows.map(toPlacementOutbox);
}


async function markPlacementOutbox(db, {
  idempotencyKey, status, failureCode = null, appliedAt = null, now,
}) {
  await db('thread_group_placement_outbox')
    .where({ idempotency_key: idempotencyKey })
    .update({
      status,
      attempts: db.raw('attempts + 1'),
      last_failure_code: failureCode,
      updated_at: now,
      applied_at: appliedAt,
    });
}


module.exports = { toWorksurfaceCleanup, insertWorksurfaceCleanup, getWorksurfaceCleanup, listUnappliedWorksurfaceCleanup, markWorksurfaceCleanup, toPlacementOutbox, insertPlacementOutbox, getPlacementOutboxByIdempotencyKey, getPlacementOutboxForGroup, listUnappliedPlacementOutbox, markPlacementOutbox };
