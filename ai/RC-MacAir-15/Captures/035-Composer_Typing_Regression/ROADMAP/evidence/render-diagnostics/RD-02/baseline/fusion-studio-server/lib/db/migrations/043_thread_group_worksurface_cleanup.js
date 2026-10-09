'use strict';

/**
 * Migration 043 — SPEC-03 slice 03C durable group-deletion worksurface cleanup.
 *
 * Adds one bounded projection/outbox table for the cross-store delete:
 * deleting a view-bound Thread Group atomically records a
 * `remove-group-worksurface` instruction with the group tombstone, and the
 * trusted in-process view-state consumer removes exactly the addressed
 * `{workspaceId, viewId, threadGroupId}` entry through the normal view-state
 * writer, then acknowledges the instruction
 * (`Wiki/.../007-Persistence_And_Metadata/PAGE.md` "Cross-store recovery";
 * `SPEC-03 §8`).
 *
 * The record contains identity + delivery state only:
 * `idempotency_key`, `workspace_id`, `view_id`, `group_id`, `status`,
 * `attempts`, `last_failure_code`, `created_at`, `updated_at`, `applied_at`.
 * It contains NO worksurface snapshot, no transcript/runtime state, and no
 * `threadId`/`surfaceId`.
 *
 * Deliberately NO foreign key into `thread_groups`: the instruction must
 * survive the group, its members, sessions, and exchanges it describes, so a
 * crash between the SQLite commit and the file mutation converges on restart.
 * The migration creates schema only: it performs no backfill and never deletes
 * a pre-existing worksurface entry. "Destructive migrations require explicit
 * owner authorization" therefore does not apply.
 */

const MAX_ID_BYTES = 128;
const MAX_KEY_BYTES = 512;
const MAX_FAILURE_CODE_BYTES = 64;
const MAX_ATTEMPTS = 1000000;

const CLEANUP_STATUSES = Object.freeze(['pending', 'applied', 'failed']);

const idCheck = (column) => (
  `typeof(${column}) = 'text' AND length(CAST(${column} AS BLOB)) BETWEEN 1 AND ${MAX_ID_BYTES}`
);
const timeCheck = (column) => (
  `typeof(${column}) = 'integer' AND ${column} BETWEEN 0 AND 9007199254740991`
);

const CLEANUP_TABLE = `
  CREATE TABLE thread_group_worksurface_cleanup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT NOT NULL UNIQUE CHECK (
      typeof(idempotency_key) = 'text'
      AND length(CAST(idempotency_key AS BLOB)) BETWEEN 1 AND ${MAX_KEY_BYTES}
    ),
    workspace_id TEXT NOT NULL CHECK (${idCheck('workspace_id')}),
    view_id TEXT NOT NULL CHECK (${idCheck('view_id')}),
    group_id TEXT NOT NULL CHECK (${idCheck('group_id')}),
    status TEXT NOT NULL CHECK (status IN ('${CLEANUP_STATUSES.join("','")}')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (
      typeof(attempts) = 'integer' AND attempts BETWEEN 0 AND ${MAX_ATTEMPTS}
    ),
    last_failure_code TEXT NULL CHECK (
      last_failure_code IS NULL OR (
        typeof(last_failure_code) = 'text'
        AND length(CAST(last_failure_code AS BLOB)) BETWEEN 1 AND ${MAX_FAILURE_CODE_BYTES}
      )
    ),
    created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
    updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
    applied_at INTEGER NULL CHECK (applied_at IS NULL OR ${timeCheck('applied_at')})
  )
`;

const INDEXES = Object.freeze([
  `CREATE INDEX thread_group_worksurface_cleanup_workspace_idx
     ON thread_group_worksurface_cleanup (workspace_id, status, id)`,
  `CREATE INDEX thread_group_worksurface_cleanup_group_idx
     ON thread_group_worksurface_cleanup (group_id)`,
]);

exports.up = async function up(knex) {
  await knex.raw(CLEANUP_TABLE);
  for (const statement of INDEXES) await knex.raw(statement);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('thread_group_worksurface_cleanup');
};

exports._internal = Object.freeze({
  MAX_ID_BYTES,
  MAX_KEY_BYTES,
  MAX_FAILURE_CODE_BYTES,
  MAX_ATTEMPTS,
  CLEANUP_STATUSES,
});
