'use strict';
const { getMirrorRecovery, listMirrorRecoveryForGroup, insertMirrorRecovery, markMirrorRecovery, listPendingMirrorRecovery } = require('./mirror-repository');
const { toWorksurfaceCleanup, insertWorksurfaceCleanup, getWorksurfaceCleanup, listUnappliedWorksurfaceCleanup, markWorksurfaceCleanup, toPlacementOutbox, insertPlacementOutbox, getPlacementOutboxByIdempotencyKey, getPlacementOutboxForGroup, listUnappliedPlacementOutbox, markPlacementOutbox } = require('./projection-outbox-repository');
const { insertActionResult, getActionResult, updateActionResult, upsertActionResult, insertDeleteTombstone, getDeleteTombstone, updateDeleteTombstone } = require('./action-result-repository');

function toIso(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'string' && value) return value;
  return null;
}

function epochFromIso(value, fallback) {
  if (typeof value !== 'string' || !value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toProjection(row) {
  if (!row) return null;
  return {
    threadGroupId: row.group_id,
    workspaceId: row.workspace_id,
    viewId: row.view_id === undefined ? null : row.view_id,
    name: row.name ?? row.thread_name ?? null,
    currentPrimaryThreadId: row.current_primary_thread_id,
    currentPrimarySequence: Number(row.current_primary_sequence || 0),
    memberCount: Number(row.member_count == null ? 1 : row.member_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEntry(row) {
  return {
    name: row.name ?? row.thread_name ?? null,
    createdAt: toIso(row.thread_created_at) || toIso(row.created_at) || null,
    messageCount: Number(row.message_count || 0),
    status: row.thread_status || 'suspended',
    scope: 'project',
    viewId: row.view_id === undefined ? null : row.view_id,
    ...(row.harness_id ? { harnessId: row.harness_id } : {}),
  };
}

async function insertGroup(db, row) {
  await db('thread_groups').insert({
    group_id: row.groupId,
    workspace_id: row.workspaceId,
    view_id: row.viewId ?? null,
    name: row.name ?? null,
    current_primary_thread_id: row.currentPrimaryThreadId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  });
}

async function insertMember(db, row) {
  await db('thread_group_members').insert({
    group_id: row.groupId,
    thread_id: row.threadId,
    ordinal: row.ordinal,
    origin_kind: row.originKind || 'initial',
    joined_at: row.joinedAt,
  });
}

async function insertPrimaryEvent(db, row) {
  await db('thread_group_primary_events').insert({
    group_id: row.groupId,
    sequence: row.sequence,
    previous_thread_id: row.previousThreadId ?? null,
    next_thread_id: row.nextThreadId,
    reason: row.reason,
    occurred_at: row.occurredAt,
  });
}

async function insertActivityEvent(db, row) {
  const existing = await db('thread_group_activity_events')
    .where('event_key', row.eventKey)
    .first();
  if (existing) return false;
  await db('thread_group_activity_events').insert({
    event_key: row.eventKey,
    group_id: row.groupId,
    thread_id: row.threadId,
    turn_id: row.turnId ?? null,
    kind: row.kind,
    occurred_at: row.occurredAt,
  });
  return true;
}

async function advanceGroupUpdatedAt(db, groupId, occurredAt) {
  await db('thread_groups')
    .where('group_id', groupId)
    .update({ updated_at: occurredAt });
}

async function recordActivityAndAdvance(db, row) {
  const run = async (trx) => {
    const inserted = await insertActivityEvent(trx, row);
    if (!inserted) return false;
    // Strictly monotonic per group: two activities in the same millisecond
    // still order deterministically and never move the clock backwards.
    const current = await trx('thread_groups')
      .where('group_id', row.groupId)
      .first('updated_at');
    const observed = Number(row.occurredAt) || Date.now();
    const next = Math.max(observed, Number(current?.updated_at || 0) + 1);
    await advanceGroupUpdatedAt(trx, row.groupId, next);
    return true;
  };
  if (db.isTransaction) return run(db);
  return db.transaction(run);
}

async function getGroup(db, groupId) {
  return db('thread_groups').where('group_id', groupId).first() || null;
}

async function getGroupForThread(db, threadId) {
  return db('thread_groups')
    .join('thread_group_members', 'thread_group_members.group_id', 'thread_groups.group_id')
    .where('thread_group_members.thread_id', threadId)
    .select('thread_groups.*')
    .first() || null;
}

async function getMember(db, groupId, threadId) {
  return db('thread_group_members')
    .where({ group_id: groupId, thread_id: threadId })
    .first() || null;
}

async function listMembers(db, groupId) {
  return db('thread_group_members')
    .where('group_id', groupId)
    .orderBy('ordinal', 'asc');
}

async function getLatestPrimarySequence(db, groupId) {
  const row = await db('thread_group_primary_events')
    .where('group_id', groupId)
    .max('sequence as sequence')
    .first();
  return Number(row?.sequence || 0);
}

async function _populationQuery(db, workspaceId, viewId) {
  const primarySequence = db('thread_group_primary_events')
    .whereRaw('thread_group_primary_events.group_id = thread_groups.group_id')
    .max('sequence');
  const memberCount = db('thread_group_members')
    .whereRaw('thread_group_members.group_id = thread_groups.group_id')
    .count('*');
  return db('thread_groups')
    .leftJoin('threads', function joinPrimary() {
      this.on('threads.thread_id', '=', 'thread_groups.current_primary_thread_id')
        .andOn('threads.workspace_id', '=', 'thread_groups.workspace_id');
    })
    .where('thread_groups.workspace_id', workspaceId)
    .modify((builder) => {
      if (viewId === null) builder.whereNull('thread_groups.view_id');
      else builder.where('thread_groups.view_id', viewId);
    })
    .select(
      'thread_groups.*',
      'threads.name as thread_name',
      'threads.created_at as thread_created_at',
      'threads.message_count',
      'threads.status as thread_status',
      'threads.harness_id',
      primarySequence.as('current_primary_sequence'),
      memberCount.as('member_count'),
    )
    .orderBy('thread_groups.updated_at', 'desc')
    .orderBy('thread_groups.group_id', 'asc');
}

async function listGroupProjections(db, { workspaceId, viewId }) {
  const rows = await _populationQuery(db, workspaceId, viewId);
  return rows.map((row) => ({ ...toProjection(row), entry: toEntry(row) }));
}

async function getGroupProjection(db, groupId) {
  const primarySequence = db('thread_group_primary_events')
    .whereRaw('thread_group_primary_events.group_id = thread_groups.group_id')
    .max('sequence');
  const memberCount = db('thread_group_members')
    .whereRaw('thread_group_members.group_id = thread_groups.group_id')
    .count('*');
  const row = await db('thread_groups')
    .leftJoin('threads', function joinPrimary() {
      this.on('threads.thread_id', '=', 'thread_groups.current_primary_thread_id')
        .andOn('threads.workspace_id', '=', 'thread_groups.workspace_id');
    })
    .where('thread_groups.group_id', groupId)
    .select(
      'thread_groups.*',
      'threads.name as thread_name',
      'threads.created_at as thread_created_at',
      'threads.message_count',
      'threads.status as thread_status',
      'threads.harness_id',
      primarySequence.as('current_primary_sequence'),
      memberCount.as('member_count'),
    )
    .first();
  if (!row) return null;
  return { ...toProjection(row), entry: toEntry(row) };
}

async function nextOrdinal(db, groupId) {
  const row = await db('thread_group_members')
    .where('group_id', groupId)
    .max('ordinal as ordinal')
    .first();
  return Number(row?.ordinal || 0) + 1;
}

async function setCurrentPrimary(db, groupId, threadId) {
  await db('thread_groups')
    .where('group_id', groupId)
    .update({ current_primary_thread_id: threadId });
}

async function renameGroup(db, groupId, name) {
  // Rename changes the title only; the sole visible-list MRU clock advances
  // only for creation and accepted prompts (§5.4).
  const count = await db('thread_groups')
    .where('group_id', groupId)
    .update({ name });
  return count > 0;
}

async function deleteGroup(db, groupId) {
  // The group→current-primary foreign key is deferred; defer all FK checks for
  // this transaction so members/events can be removed before the group row
  // without tripping a mid-statement constraint. At commit the whole group is
  // gone, so no dangling primary reference remains.
  const run = async (trx) => {
    await trx.raw('PRAGMA defer_foreign_keys = ON');
    await trx('thread_group_primary_events').where('group_id', groupId).del();
    await trx('thread_group_activity_events').where('group_id', groupId).del();
    await trx('thread_group_members').where('group_id', groupId).del();
    return trx('thread_groups').where('group_id', groupId).del();
  };
  if (db.isTransaction) return run(db);
  return db.transaction(run);
}

async function listThreadIdsWithoutGroup(db, workspaceId) {
  const rows = await db('threads')
    .where({ workspace_id: workspaceId, scope: 'project' })
    .whereNotExists(function notGrouped() {
      this.select('*').from('thread_group_members')
        .whereRaw('thread_group_members.thread_id = threads.thread_id');
    })
    .select('thread_id', 'name', 'created_at', 'updated_at', 'harness_id', 'view_id');
  return rows;
}

async function hasGroupForThread(db, threadId) {
  const row = await db('thread_group_members').where('thread_id', threadId).first();
  return Boolean(row);
}

module.exports = {
  advanceGroupUpdatedAt,
  deleteGroup,
  epochFromIso,
  getActionResult,
  getDeleteTombstone,
  getGroup,
  getGroupForThread,
  getGroupProjection,
  getLatestPrimarySequence,
  getMember,
  getMirrorRecovery,
  getPlacementOutboxByIdempotencyKey,
  getPlacementOutboxForGroup,
  getWorksurfaceCleanup,
  hasGroupForThread,
  insertActionResult,
  insertActivityEvent,
  insertDeleteTombstone,
  insertGroup,
  insertMember,
  insertMirrorRecovery,
  insertPlacementOutbox,
  insertPrimaryEvent,
  insertWorksurfaceCleanup,
  listGroupProjections,
  listMembers,
  listMirrorRecoveryForGroup,
  listPendingMirrorRecovery,
  listThreadIdsWithoutGroup,
  listUnappliedPlacementOutbox,
  listUnappliedWorksurfaceCleanup,
  markMirrorRecovery,
  markPlacementOutbox,
  markWorksurfaceCleanup,
  nextOrdinal,
  recordActivityAndAdvance,
  renameGroup,
  setCurrentPrimary,
  toEntry,
  toPlacementOutbox,
  toProjection,
  toWorksurfaceCleanup,
  updateActionResult,
  updateDeleteTombstone,
  upsertActionResult,
};
