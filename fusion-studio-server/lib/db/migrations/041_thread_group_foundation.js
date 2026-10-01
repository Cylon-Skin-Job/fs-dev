'use strict';

/**
 * Migration 041 — SPEC-01 Thread Group Foundation (slice 01A).
 *
 * Introduces the durable Thread Group domain the user-visible Thread is:
 *   thread_groups                 — visible Thread, immutable {workspace, view}
 *   thread_group_members          — one session belongs to exactly one group
 *   thread_group_primary_events   — append-only per-group primary history
 *   thread_group_activity_events  — durable MRU/idempotency activity rows
 *   thread_group_action_results   — durable per-{workspace,request} action result
 *   thread_group_mirror_recovery  — ThreadManager-owned mirror create/delete work
 *
 * Structural integrity (§5.2/§5.6, CHAT-I-007): the group's current primary is
 * protected by a DEFERRABLE INITIALLY DEFERRED composite foreign key into
 * thread_group_members, so a nonempty committed group can never name a
 * non-member primary. The group/member/current-primary cycle is therefore
 * enforced by the database, not only by the repository.
 *
 * Data (§6): every retained registered-workspace thread becomes exactly one
 * group reusing the legacy `thread_id` value as its initial `group_id` (types
 * remain non-interchangeable), with ordinal-1 `initial` membership, an initial
 * primary event, and an `initial:{threadGroupId}` activity event. Session
 * bytes (exchanges, transcript, harness config, provider session, name,
 * timestamps, status, message count, mirror) are preserved. No view is ever
 * inferred from UI, title, project, folder, content root, or path; retained
 * view bindings resolve through the registry at activation, not here.
 *
 * Owner-authorized retirement branch: thread/exchange pairs whose workspace is
 * null or no longer registered are deleted, recording only bounded IDs/counts
 * for later mirror reconciliation. Every registered-workspace row is preserved.
 *
 * Stored Fork-era harness_config rows are normalized in place (pendingFork /
 * forkProvenance and the fork-era provider session are dropped) without ever
 * invoking Fork. Idempotent: re-running the data steps is a no-op.
 */

const MAX_ID_BYTES = 128;
const MAX_TARGET_HASH_BYTES = 128;
const MAX_RESULT_BYTES = 65536;
const MAX_DIAGNOSTIC_IDS = 100;

const idCheck = (column) => (
  `typeof(${column}) = 'text' AND length(CAST(${column} AS BLOB)) BETWEEN 1 AND ${MAX_ID_BYTES}`
);
const timeCheck = (column) => (
  `typeof(${column}) = 'integer' AND ${column} BETWEEN 0 AND 9007199254740991`
);

const GROUP_TABLE = `
  CREATE TABLE thread_groups (
    group_id TEXT NOT NULL PRIMARY KEY CHECK (${idCheck('group_id')}),
    workspace_id TEXT NOT NULL CHECK (${idCheck('workspace_id')}),
    view_id TEXT CHECK (view_id IS NULL OR ${idCheck('view_id')}),
    name TEXT,
    current_primary_thread_id TEXT NOT NULL CHECK (${idCheck('current_primary_thread_id')}),
    created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
    updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
    FOREIGN KEY (group_id, current_primary_thread_id)
      REFERENCES thread_group_members(group_id, thread_id)
      DEFERRABLE INITIALLY DEFERRED
  )
`;

const MEMBERS_TABLE = `
  CREATE TABLE thread_group_members (
    group_id TEXT NOT NULL CHECK (${idCheck('group_id')}),
    thread_id TEXT NOT NULL UNIQUE CHECK (${idCheck('thread_id')}),
    ordinal INTEGER NOT NULL CHECK (typeof(ordinal) = 'integer' AND ordinal BETWEEN 1 AND 1000000),
    origin_kind TEXT NOT NULL CHECK (origin_kind IN ('initial','move-to-side-chat-primary')),
    joined_at INTEGER NOT NULL CHECK (${timeCheck('joined_at')}),
    PRIMARY KEY (group_id, thread_id),
    UNIQUE (group_id, ordinal),
    FOREIGN KEY (group_id) REFERENCES thread_groups(group_id) ON DELETE CASCADE
  )
`;

const PRIMARY_EVENTS_TABLE = `
  CREATE TABLE thread_group_primary_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL CHECK (${idCheck('group_id')}),
    sequence INTEGER NOT NULL CHECK (typeof(sequence) = 'integer' AND sequence BETWEEN 1 AND 1000000000),
    previous_thread_id TEXT CHECK (previous_thread_id IS NULL OR ${idCheck('previous_thread_id')}),
    next_thread_id TEXT NOT NULL CHECK (${idCheck('next_thread_id')}),
    reason TEXT NOT NULL CHECK (reason IN ('initial','move-to-side-chat')),
    occurred_at INTEGER NOT NULL CHECK (${timeCheck('occurred_at')}),
    UNIQUE (group_id, sequence)
  )
`;

const ACTIVITY_EVENTS_TABLE = `
  CREATE TABLE thread_group_activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_key TEXT NOT NULL UNIQUE CHECK (${idCheck('event_key')}),
    group_id TEXT NOT NULL CHECK (${idCheck('group_id')}),
    thread_id TEXT NOT NULL CHECK (${idCheck('thread_id')}),
    turn_id TEXT CHECK (turn_id IS NULL OR ${idCheck('turn_id')}),
    kind TEXT NOT NULL CHECK (kind IN ('initial','prompt-accepted','move-chat-to-side')),
    occurred_at INTEGER NOT NULL CHECK (${timeCheck('occurred_at')})
  )
`;

const ACTION_RESULTS_TABLE = `
  CREATE TABLE thread_group_action_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL CHECK (${idCheck('workspace_id')}),
    request_id TEXT NOT NULL CHECK (${idCheck('request_id')}),
    action TEXT NOT NULL CHECK (${idCheck('action')}),
    target_hash TEXT NOT NULL CHECK (
      typeof(target_hash) = 'text' AND length(CAST(target_hash AS BLOB)) BETWEEN 1 AND ${MAX_TARGET_HASH_BYTES}
    ),
    result_json TEXT NOT NULL CHECK (
      json_valid(result_json) AND length(CAST(result_json AS BLOB)) BETWEEN 1 AND ${MAX_RESULT_BYTES}
    ),
    created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
    updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
    UNIQUE (workspace_id, request_id)
  )
`;

const MIRROR_RECOVERY_TABLE = `
  CREATE TABLE thread_group_mirror_recovery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL CHECK (${idCheck('workspace_id')}),
    group_id TEXT NOT NULL CHECK (${idCheck('group_id')}),
    thread_id TEXT NOT NULL CHECK (${idCheck('thread_id')}),
    mirror_key TEXT NOT NULL CHECK (${idCheck('mirror_key')}),
    operation TEXT NOT NULL CHECK (operation IN ('create','delete')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','failed')),
    failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN (
      'mirror_write_failed','mirror_delete_failed','mirror_unavailable'
    )),
    created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
    updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
    UNIQUE (workspace_id, mirror_key, operation),
    CHECK (
      (status = 'failed' AND failure_code IS NOT NULL)
      OR (status IN ('pending','complete') AND failure_code IS NULL)
    )
  )
`;

const INDEXES = Object.freeze([
  `CREATE INDEX thread_groups_population_idx
     ON thread_groups (workspace_id, view_id, updated_at DESC, group_id ASC)`,
  `CREATE INDEX thread_group_members_group_idx
     ON thread_group_members (group_id, ordinal)`,
  `CREATE INDEX thread_group_primary_events_group_idx
     ON thread_group_primary_events (group_id, sequence DESC)`,
  `CREATE INDEX thread_group_activity_group_idx
     ON thread_group_activity_events (group_id, occurred_at DESC, id DESC)`,
  `CREATE INDEX thread_group_mirror_recovery_pending_idx
     ON thread_group_mirror_recovery (status, workspace_id)`,
]);

const RETIREMENT_CONFIG_KEY = 'thread_group.retirement.041';

async function backfillGroups(knex) {
  // 1. Groups: one per retained registered-workspace thread. `view_id` is
  //    deliberately NULL here — the registry resolves exact view bindings at
  //    activation, never the migration from a title/folder/path.
  await knex.raw(`
    INSERT INTO thread_groups
      (group_id, workspace_id, view_id, name, current_primary_thread_id, created_at, updated_at)
    SELECT
      t.thread_id,
      t.workspace_id,
      NULL,
      t.name,
      t.thread_id,
      COALESCE(CAST(strftime('%s', t.created_at) AS INTEGER) * 1000, t.updated_at, 0),
      COALESCE(t.updated_at, 0)
    FROM threads t
    JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.scope = 'project'
      AND NOT EXISTS (SELECT 1 FROM thread_groups g WHERE g.group_id = t.thread_id)
  `);

  // 2. Ordinal-1 initial membership.
  await knex.raw(`
    INSERT INTO thread_group_members (group_id, thread_id, ordinal, origin_kind, joined_at)
    SELECT g.group_id, g.current_primary_thread_id, 1, 'initial', g.created_at
    FROM thread_groups g
    WHERE NOT EXISTS (
      SELECT 1 FROM thread_group_members m WHERE m.thread_id = g.current_primary_thread_id
    )
  `);

  // 3. Initial primary event.
  await knex.raw(`
    INSERT INTO thread_group_primary_events
      (group_id, sequence, previous_thread_id, next_thread_id, reason, occurred_at)
    SELECT g.group_id, 1, NULL, g.current_primary_thread_id, 'initial', g.created_at
    FROM thread_groups g
    WHERE NOT EXISTS (
      SELECT 1 FROM thread_group_primary_events e WHERE e.group_id = g.group_id
    )
  `);

  // 4. `initial:{threadGroupId}` activity event.
  await knex.raw(`
    INSERT INTO thread_group_activity_events
      (event_key, group_id, thread_id, turn_id, kind, occurred_at)
    SELECT 'initial:' || g.group_id, g.group_id, g.current_primary_thread_id, NULL, 'initial', g.created_at
    FROM thread_groups g
    WHERE NOT EXISTS (
      SELECT 1 FROM thread_group_activity_events a
      WHERE a.event_key = 'initial:' || g.group_id
    )
  `);
}

async function normalizeForkEraConfig(knex) {
  const rows = await knex('threads')
    .select('thread_id', 'harness_config')
    .whereNotNull('harness_config')
    .where((builder) => builder
      .where('harness_config', 'like', '%pendingFork%')
      .orWhere('harness_config', 'like', '%forkProvenance%'));

  for (const row of rows) {
    let parsed;
    try {
      parsed = JSON.parse(row.harness_config);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const normalized = { ...parsed };
    delete normalized.pendingFork;
    delete normalized.forkProvenance;
    // A fork-era provider session is the source session's binding, not this
    // thread's. Never resume it as if it belonged here.
    delete normalized.opencodeSessionId;
    await knex('threads')
      .where('thread_id', row.thread_id)
      .update({ harness_config: JSON.stringify(normalized) });
  }
}

async function retireUnregisteredRows(knex) {
  const rows = await knex('threads')
    .select('thread_id')
    .where('scope', 'project')
    .where((builder) => builder
      .whereNull('workspace_id')
      .orWhereNotIn('workspace_id', knex('workspaces').select('id')));

  const threadIds = rows.map((row) => row.thread_id);
  if (threadIds.length === 0) {
    await knex('system_config')
      .where('key', RETIREMENT_CONFIG_KEY)
      .del();
    return { count: 0, threadIds: [] };
  }

  const exchangeCountRow = await knex('exchanges')
    .whereIn('thread_id', threadIds)
    .count('* as count')
    .first();
  const record = {
    migration: '041_thread_group_foundation',
    retiredAt: Date.now(),
    threadCount: threadIds.length,
    exchangeCount: Number(exchangeCountRow?.count || 0),
    // Bounded: only the first MAX_DIAGNOSTIC_IDS identities are retained.
    threadIds: threadIds.slice(0, MAX_DIAGNOSTIC_IDS),
    truncated: threadIds.length > MAX_DIAGNOSTIC_IDS,
  };
  await knex('system_config')
    .insert({ key: RETIREMENT_CONFIG_KEY, value: JSON.stringify(record), updated_at: Date.now() })
    .onConflict('key')
    .merge(['value', 'updated_at']);

  // Exchanges cascade from threads (foreign_keys = ON, 001_initial FK).
  await knex('threads').whereIn('thread_id', threadIds).del();
  return record;
}

exports.up = async function up(knex) {
  await knex.raw(GROUP_TABLE);
  await knex.raw(MEMBERS_TABLE);
  await knex.raw(PRIMARY_EVENTS_TABLE);
  await knex.raw(ACTIVITY_EVENTS_TABLE);
  await knex.raw(ACTION_RESULTS_TABLE);
  await knex.raw(MIRROR_RECOVERY_TABLE);
  for (const statement of INDEXES) await knex.raw(statement);

  await backfillGroups(knex);
  await normalizeForkEraConfig(knex);
  await retireUnregisteredRows(knex);
};

exports.down = async function down(knex) {
  for (const table of [
    'thread_group_mirror_recovery',
    'thread_group_action_results',
    'thread_group_activity_events',
    'thread_group_primary_events',
    'thread_group_members',
    'thread_groups',
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
  await knex('system_config').where('key', RETIREMENT_CONFIG_KEY).del();
};

exports.RETIREMENT_CONFIG_KEY = RETIREMENT_CONFIG_KEY;
// Exposed for focused migration tests; `up` always runs the same functions.
exports._internal = { backfillGroups, normalizeForkEraConfig, retireUnregisteredRows };
