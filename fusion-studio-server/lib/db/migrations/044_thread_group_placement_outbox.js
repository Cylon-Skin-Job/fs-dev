'use strict';

/**
 * Migration 044 — SPEC-04 slice 04A durable Side Chat placement outbox.
 *
 * Move Chat to Side Chat commits the group transition first (durable session,
 * membership, primary event, activity/MRU, placement instruction) in one
 * transaction; delivery of the Side Chat tab is a separate, retryable step
 * (`CHAT-I-010`, `CHAT-RD-011`). This table is the bounded delivery intent:
 *
 *   - identity + idempotency + delivery state only:
 *     `side_chat_placement_id`, `idempotency_key`, `workspace_id`, `view_id`,
 *     `group_id`, `thread_id`, `operation`, `status`, `attempts`,
 *     `last_failure_code`, `created_at`, `updated_at`, `applied_at`;
 *   - `side_chat_placement_id` is the stable durable placement key
 *     (`CHAT-RD-012`), distinct from `projectionId`, `tabId`,
 *     `componentInstanceId`, `surfaceId`, `threadId`, and `threadGroupId`;
 *   - NO snapshot, transcript/runtime state, view descriptor, or `surfaceId`
 *     column (the descriptor is materialized into SPEC-03's service-managed
 *     placement lane at delivery time through the accepted
 *     `mutateManagedPlacement` contract).
 *
 * Deliberately NO foreign key into `thread_groups`: the instruction must
 * survive the group/members it describes, so a crash between the SQLite commit
 * and the view-state file mutation converges on restart. The migration creates
 * schema only: no backfill, no destructive step. Create-only.
 */

const MAX_ID_BYTES = 128;
const MAX_KEY_BYTES = 512;
const MAX_FAILURE_CODE_BYTES = 64;
const MAX_ATTEMPTS = 1000000;

/** Delivery status vocabulary mirrors the accepted worksurface-cleanup outbox. */
const PLACEMENT_STATUSES = Object.freeze(['pending', 'applied', 'failed']);
/** One durable operation for SPEC-04 slice 04A. */
const PLACEMENT_OPERATIONS = Object.freeze(['open-side-chat-tab']);

const idCheck = (column) => (
  `typeof(${column}) = 'text' AND length(CAST(${column} AS BLOB)) BETWEEN 1 AND ${MAX_ID_BYTES}`
);
const timeCheck = (column) => (
  `typeof(${column}) = 'integer' AND ${column} BETWEEN 0 AND 9007199254740991`
);

const OUTBOX_TABLE = `
  CREATE TABLE thread_group_placement_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    side_chat_placement_id TEXT NOT NULL UNIQUE CHECK (
      typeof(side_chat_placement_id) = 'text'
      AND length(CAST(side_chat_placement_id AS BLOB)) BETWEEN 1 AND ${MAX_ID_BYTES}
    ),
    idempotency_key TEXT NOT NULL UNIQUE CHECK (
      typeof(idempotency_key) = 'text'
      AND length(CAST(idempotency_key AS BLOB)) BETWEEN 1 AND ${MAX_KEY_BYTES}
    ),
    workspace_id TEXT NOT NULL CHECK (${idCheck('workspace_id')}),
    view_id TEXT NOT NULL CHECK (${idCheck('view_id')}),
    group_id TEXT NOT NULL CHECK (${idCheck('group_id')}),
    thread_id TEXT NOT NULL CHECK (${idCheck('thread_id')}),
    operation TEXT NOT NULL CHECK (operation IN ('${PLACEMENT_OPERATIONS.join("','")}')),
    status TEXT NOT NULL CHECK (status IN ('${PLACEMENT_STATUSES.join("','")}')),
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
  `CREATE INDEX thread_group_placement_outbox_workspace_idx
     ON thread_group_placement_outbox (workspace_id, status, id)`,
  `CREATE INDEX thread_group_placement_outbox_group_idx
     ON thread_group_placement_outbox (group_id)`,
  `CREATE INDEX thread_group_placement_outbox_thread_idx
     ON thread_group_placement_outbox (thread_id)`,
]);

exports.up = async function up(knex) {
  await knex.raw(OUTBOX_TABLE);
  for (const statement of INDEXES) await knex.raw(statement);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('thread_group_placement_outbox');
};

exports._internal = Object.freeze({
  MAX_ID_BYTES,
  MAX_KEY_BYTES,
  MAX_FAILURE_CODE_BYTES,
  MAX_ATTEMPTS,
  PLACEMENT_STATUSES,
  PLACEMENT_OPERATIONS,
});
