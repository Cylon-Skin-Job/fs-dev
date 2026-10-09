'use strict';

/**
 * Migration 042 — SPEC-01 slice 01B group Delete/action recovery.
 *
 * Adds one bounded, group-scoped cleanup tombstone table. It is the durable
 * "already deleted group" resolution surface that lets a Delete with a new
 * `requestId` recover the retained aggregate and resume idempotent mirror
 * repair instead of answering `not_found` (`SPEC-01 §5.5/§9`,
 * `CHAT-I-030`/`CHAT-I-032`).
 *
 * Deliberately NO foreign key into `thread_groups`: the tombstone must survive
 * the group, members, sessions, and exchanges it describes. The durable
 * per-`{workspaceId, requestId}` action result continues to live in
 * `thread_group_action_results` (migration 041), which also has no cascading
 * group FK. Tombstone rows expire after a bounded recovery window; an unseen
 * request past expiry receives ordinary `not_found`.
 */

const MAX_ID_BYTES = 128;
const MAX_RESULT_BYTES = 65536;
const MAX_CLEANUP_BYTES = 65536;

const idCheck = (column) => (
  `typeof(${column}) = 'text' AND length(CAST(${column} AS BLOB)) BETWEEN 1 AND ${MAX_ID_BYTES}`
);
const timeCheck = (column) => (
  `typeof(${column}) = 'integer' AND ${column} BETWEEN 0 AND 9007199254740991`
);

const TOMBSTONES_TABLE = `
  CREATE TABLE thread_group_delete_tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL UNIQUE CHECK (${idCheck('group_id')}),
    workspace_id TEXT NOT NULL CHECK (${idCheck('workspace_id')}),
    result_json TEXT NOT NULL CHECK (
      json_valid(result_json) AND length(CAST(result_json AS BLOB)) BETWEEN 1 AND ${MAX_RESULT_BYTES}
    ),
    cleanup_json TEXT NOT NULL CHECK (
      json_valid(cleanup_json) AND length(CAST(cleanup_json AS BLOB)) BETWEEN 1 AND ${MAX_CLEANUP_BYTES}
    ),
    created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
    updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
    expires_at INTEGER NOT NULL CHECK (${timeCheck('expires_at')})
  )
`;

const INDEXES = Object.freeze([
  `CREATE INDEX thread_group_delete_tombstones_expiry_idx
     ON thread_group_delete_tombstones (expires_at)`,
  `CREATE INDEX thread_group_delete_tombstones_workspace_idx
     ON thread_group_delete_tombstones (workspace_id, expires_at)`,
]);

exports.up = async function up(knex) {
  await knex.raw(TOMBSTONES_TABLE);
  for (const statement of INDEXES) await knex.raw(statement);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('thread_group_delete_tombstones');
};
