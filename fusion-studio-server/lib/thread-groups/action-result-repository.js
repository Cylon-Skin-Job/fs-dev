'use strict';

// SQL-only action result repository; every query uses the supplied database/transaction.
async function insertActionResult(db, row) {
  await db('thread_group_action_results').insert({
    workspace_id: row.workspaceId,
    request_id: row.requestId,
    action: row.action,
    target_hash: row.targetHash,
    result_json: row.resultJson,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  });
}


async function getActionResult(db, workspaceId, requestId) {
  const row = await db('thread_group_action_results')
    .where({ workspace_id: workspaceId, request_id: requestId })
    .first();
  if (!row) return null;
  return {
    workspaceId: row.workspace_id,
    requestId: row.request_id,
    action: row.action,
    targetHash: row.target_hash,
    resultJson: row.result_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


async function updateActionResult(db, workspaceId, requestId, { resultJson, now }) {
  await db('thread_group_action_results')
    .where({ workspace_id: workspaceId, request_id: requestId })
    .update({ result_json: resultJson, updated_at: now });
}


async function upsertActionResult(db, row) {
  await db('thread_group_action_results')
    .insert({
      workspace_id: row.workspaceId,
      request_id: row.requestId,
      action: row.action,
      target_hash: row.targetHash,
      result_json: row.resultJson,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })
    .onConflict(['workspace_id', 'request_id'])
    .ignore();
  return getActionResult(db, row.workspaceId, row.requestId);
}


async function insertDeleteTombstone(db, row) {
  await db('thread_group_delete_tombstones').insert({
    group_id: row.groupId,
    workspace_id: row.workspaceId,
    result_json: row.resultJson,
    cleanup_json: row.cleanupJson,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    expires_at: row.expiresAt,
  });
}


async function getDeleteTombstone(db, groupId) {
  const row = await db('thread_group_delete_tombstones')
    .where('group_id', groupId)
    .first();
  if (!row) return null;
  return {
    groupId: row.group_id,
    workspaceId: row.workspace_id,
    resultJson: row.result_json,
    cleanupJson: row.cleanup_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}


async function updateDeleteTombstone(db, groupId, {
  resultJson, cleanupJson, now,
}) {
  await db('thread_group_delete_tombstones')
    .where('group_id', groupId)
    .update({
      result_json: resultJson,
      cleanup_json: cleanupJson,
      updated_at: now,
    });
}


module.exports = { insertActionResult, getActionResult, updateActionResult, upsertActionResult, insertDeleteTombstone, getDeleteTombstone, updateDeleteTombstone };
