'use strict';

const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

const uuidCheck = (column) => `
  length(${column}) = 36
  AND ${column} = lower(${column})
  AND substr(${column}, 9, 1) = '-'
  AND substr(${column}, 14, 1) = '-'
  AND substr(${column}, 15, 1) GLOB '[1-8]'
  AND substr(${column}, 19, 1) = '-'
  AND substr(${column}, 20, 1) GLOB '[89ab]'
  AND substr(${column}, 24, 1) = '-'
  AND replace(${column}, '-', '') NOT GLOB '*[^0-9a-f]*'
  AND length(replace(${column}, '-', '')) = 32
`;

const digestCheck = (column) => `
  length(${column}) = 64 AND ${column} NOT GLOB '*[^0-9a-f]*'
`;

const timeCheck = (column) => `typeof(${column}) = 'integer' AND ${column} BETWEEN 0 AND 9007199254740991`;

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE agent_tool_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id TEXT NOT NULL UNIQUE CHECK (${uuidCheck('activity_id')}),
      event_id TEXT NOT NULL UNIQUE CHECK (${uuidCheck('event_id')}),
      workspace_id TEXT NOT NULL CHECK (length(CAST(workspace_id AS BLOB)) BETWEEN 1 AND 128),
      thread_id TEXT NOT NULL CHECK (length(CAST(thread_id AS BLOB)) BETWEEN 1 AND 128),
      turn_id TEXT NOT NULL CHECK (length(CAST(turn_id AS BLOB)) BETWEEN 1 AND 128),
      authority_root_sha256 TEXT NOT NULL CHECK (${digestCheck('authority_root_sha256')}),
      authority_root_device TEXT,
      authority_root_inode TEXT,
      exchange_id INTEGER REFERENCES exchanges(id) ON DELETE SET NULL,
      exchange_saved_at INTEGER CHECK (exchange_saved_at IS NULL OR (${timeCheck('exchange_saved_at')})),
      exchange_bound_at INTEGER CHECK (exchange_bound_at IS NULL OR (${timeCheck('exchange_bound_at')})),
      harness_id TEXT NOT NULL CHECK (length(CAST(harness_id AS BLOB)) BETWEEN 1 AND 128),
      provider TEXT NOT NULL CHECK (length(CAST(provider AS BLOB)) BETWEEN 1 AND 128),
      tool_call_id TEXT NOT NULL CHECK (length(CAST(tool_call_id AS BLOB)) BETWEEN 1 AND 512),
      tool_name TEXT NOT NULL CHECK (length(CAST(tool_name AS BLOB)) BETWEEN 1 AND 128),
      native_tool_name TEXT NOT NULL CHECK (length(CAST(native_tool_name AS BLOB)) BETWEEN 1 AND 128),
      status TEXT NOT NULL CHECK (status IN ('announced','completed','error','blocked','interrupted')),
      arguments_sha256 TEXT CHECK (arguments_sha256 IS NULL OR (${digestCheck('arguments_sha256')})),
      result_sha256 TEXT CHECK (result_sha256 IS NULL OR (${digestCheck('result_sha256')})),
      candidate_reported_count INTEGER NOT NULL DEFAULT 0 CHECK (
        typeof(candidate_reported_count) = 'integer' AND candidate_reported_count BETWEEN 0 AND 65
      ),
      candidate_retained_count INTEGER NOT NULL DEFAULT 0 CHECK (
        typeof(candidate_retained_count) = 'integer' AND candidate_retained_count BETWEEN 0 AND 64
      ),
      candidates_truncated INTEGER NOT NULL DEFAULT 0 CHECK (candidates_truncated IN (0,1)),
      announced_observed_at INTEGER NOT NULL CHECK (${timeCheck('announced_observed_at')}),
      announced_reported_at INTEGER CHECK (announced_reported_at IS NULL OR (${timeCheck('announced_reported_at')})),
      execution_started_reported_at INTEGER CHECK (execution_started_reported_at IS NULL OR (${timeCheck('execution_started_reported_at')})),
      arguments_observed_at INTEGER CHECK (arguments_observed_at IS NULL OR (${timeCheck('arguments_observed_at')})),
      arguments_reported_at INTEGER CHECK (arguments_reported_at IS NULL OR (${timeCheck('arguments_reported_at')})),
      terminal_observed_at INTEGER CHECK (terminal_observed_at IS NULL OR (${timeCheck('terminal_observed_at')})),
      terminal_reported_at INTEGER CHECK (terminal_reported_at IS NULL OR (${timeCheck('terminal_reported_at')})),
      terminal_snapshot_reported_at INTEGER CHECK (terminal_snapshot_reported_at IS NULL OR (${timeCheck('terminal_snapshot_reported_at')})),
      reconciled_at INTEGER CHECK (reconciled_at IS NULL OR (${timeCheck('reconciled_at')})),
      fact_admission_state TEXT NOT NULL DEFAULT 'not_ready'
        CHECK (fact_admission_state IN ('not_ready','pending','admitted','conflict')),
      ledger_state TEXT NOT NULL DEFAULT 'not_ready'
        CHECK (ledger_state IN ('not_ready','pending','running','stored','conflict','failed')),
      ledger_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (
        typeof(ledger_attempt_count) = 'integer' AND ledger_attempt_count BETWEEN 0 AND 3
      ),
      ledger_next_attempt_at INTEGER CHECK (ledger_next_attempt_at IS NULL OR (${timeCheck('ledger_next_attempt_at')})),
      ledger_claim_token TEXT CHECK (ledger_claim_token IS NULL OR (${uuidCheck('ledger_claim_token')})),
      ledger_claimed_at INTEGER CHECK (ledger_claimed_at IS NULL OR (${timeCheck('ledger_claimed_at')})),
      ledger_lease_expires_at INTEGER CHECK (ledger_lease_expires_at IS NULL OR (${timeCheck('ledger_lease_expires_at')})),
      fact_json TEXT CHECK (fact_json IS NULL OR (json_valid(fact_json) AND json_type(fact_json) = 'object')),
      fact_sha256 TEXT CHECK (fact_sha256 IS NULL OR (${digestCheck('fact_sha256')})),
      created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
      updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
      UNIQUE (workspace_id, thread_id, turn_id, harness_id, tool_call_id),
      UNIQUE (activity_id, workspace_id),
      CHECK (
        (authority_root_device IS NULL AND authority_root_inode IS NULL)
        OR (
          authority_root_device IS NOT NULL AND authority_root_inode IS NOT NULL
          AND length(authority_root_device) BETWEEN 1 AND 20
          AND length(authority_root_inode) BETWEEN 1 AND 20
          AND authority_root_device NOT GLOB '*[^0-9]*'
          AND authority_root_inode NOT GLOB '*[^0-9]*'
          AND (authority_root_device = '0' OR substr(authority_root_device,1,1) <> '0')
          AND (authority_root_inode = '0' OR substr(authority_root_inode,1,1) <> '0')
        )
      ),
      CHECK (
        (exchange_id IS NULL AND exchange_saved_at IS NULL AND exchange_bound_at IS NULL)
        OR (exchange_id IS NOT NULL AND exchange_saved_at IS NOT NULL AND exchange_bound_at IS NOT NULL)
      ),
      CHECK (candidate_retained_count <= candidate_reported_count),
      CHECK (
        (candidate_reported_count = 65 AND candidates_truncated = 1)
        OR (candidate_reported_count < 65 AND candidates_truncated = 0)
      ),
      CHECK (arguments_reported_at IS NULL OR arguments_observed_at IS NOT NULL),
      CHECK (
        (execution_started_reported_at IS NULL AND terminal_reported_at IS NULL AND terminal_snapshot_reported_at IS NULL)
        OR terminal_observed_at IS NOT NULL
      ),
      CHECK (arguments_observed_at IS NULL OR arguments_observed_at >= announced_observed_at),
      CHECK (terminal_observed_at IS NULL OR terminal_observed_at >= announced_observed_at),
      CHECK (reconciled_at IS NULL OR (status = 'interrupted' AND terminal_observed_at IS NOT NULL)),
      CHECK (
        (status = 'announced'
          AND terminal_observed_at IS NULL AND reconciled_at IS NULL
          AND fact_json IS NULL AND fact_sha256 IS NULL
          AND fact_admission_state = 'not_ready' AND ledger_state = 'not_ready'
          AND ledger_attempt_count = 0 AND ledger_next_attempt_at IS NULL
          AND ledger_claim_token IS NULL AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
        OR (status IN ('completed','error','blocked','interrupted')
          AND terminal_observed_at IS NOT NULL AND fact_json IS NOT NULL AND fact_sha256 IS NOT NULL
          AND fact_admission_state IN ('pending','admitted','conflict'))
      ),
      CHECK (
        (fact_admission_state IN ('not_ready','pending','conflict')
          AND ledger_state = 'not_ready' AND ledger_attempt_count = 0
          AND ledger_next_attempt_at IS NULL AND ledger_claim_token IS NULL
          AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
        OR (fact_admission_state = 'admitted' AND ledger_state IN ('pending','running','stored','conflict','failed'))
      ),
      CHECK (
        (ledger_state = 'not_ready'
          AND ledger_attempt_count = 0 AND ledger_next_attempt_at IS NULL
          AND ledger_claim_token IS NULL AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
        OR (ledger_state = 'pending'
          AND ledger_attempt_count BETWEEN 0 AND 2 AND ledger_next_attempt_at IS NOT NULL
          AND ledger_claim_token IS NULL AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
        OR (ledger_state = 'running'
          AND ledger_attempt_count BETWEEN 1 AND 3 AND ledger_next_attempt_at IS NULL
          AND ledger_claim_token IS NOT NULL AND ledger_claimed_at IS NOT NULL
          AND ledger_lease_expires_at > ledger_claimed_at)
        OR (ledger_state IN ('stored','conflict','failed')
          AND ledger_attempt_count BETWEEN 1 AND 3 AND ledger_next_attempt_at IS NULL
          AND ledger_claim_token IS NULL AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
      ),
      CHECK (updated_at >= created_at)
    )
  `);
  await knex.raw(`CREATE INDEX agent_tool_activities_natural_idx ON agent_tool_activities (workspace_id, thread_id, turn_id, harness_id, tool_call_id)`);
  await knex.raw(`CREATE INDEX agent_tool_activities_workspace_time_idx ON agent_tool_activities (workspace_id, terminal_observed_at DESC, id DESC)`);
  await knex.raw(`CREATE INDEX agent_tool_activities_thread_turn_idx ON agent_tool_activities (workspace_id, thread_id, turn_id, id DESC)`);
  await knex.raw(`CREATE INDEX agent_tool_activities_exchange_idx ON agent_tool_activities (exchange_id, tool_call_id)`);
  await knex.raw(`CREATE INDEX agent_tool_activities_ledger_due_idx ON agent_tool_activities (ledger_state, ledger_next_attempt_at)`);
  await knex.raw(`CREATE INDEX agent_tool_activities_ledger_lease_idx ON agent_tool_activities (ledger_state, ledger_lease_expires_at)`);

  await knex.raw(`
    CREATE TABLE agent_tool_resource_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edge_id TEXT NOT NULL UNIQUE CHECK (${uuidCheck('edge_id')}),
      workspace_id TEXT NOT NULL CHECK (length(CAST(workspace_id AS BLOB)) BETWEEN 1 AND 128),
      activity_id TEXT NOT NULL CHECK (${uuidCheck('activity_id')}),
      candidate_ordinal INTEGER NOT NULL CHECK (typeof(candidate_ordinal) = 'integer' AND candidate_ordinal BETWEEN 0 AND 63),
      candidate_sha256 TEXT NOT NULL CHECK (${digestCheck('candidate_sha256')}),
      resource_id TEXT REFERENCES resource_registry(resource_id) ON DELETE RESTRICT,
      canonical_path TEXT CHECK (canonical_path IS NULL OR length(CAST(canonical_path AS BLOB)) BETWEEN 1 AND 4096),
      file_name TEXT CHECK (file_name IS NULL OR length(CAST(file_name AS BLOB)) BETWEEN 1 AND 255),
      folder_path TEXT CHECK (folder_path IS NULL OR length(CAST(folder_path AS BLOB)) BETWEEN 0 AND 4096),
      access_family TEXT NOT NULL CHECK (access_family IN ('read','write','execute','unknown')),
      access_kind TEXT NOT NULL CHECK (access_kind IN ('read','write','create','delete','move_from','move_to','execute','unknown')),
      extraction_basis TEXT NOT NULL CHECK (extraction_basis IN ('structured_path','shell_input_redirection','shell_output_redirection','shell_known_operand')),
      observation_state TEXT NOT NULL DEFAULT 'pending'
        CHECK (observation_state IN ('pending','first_observation','changed','unchanged','skipped','failed')),
      observation_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (
        typeof(observation_attempt_count) = 'integer' AND observation_attempt_count BETWEEN 0 AND 3
      ),
      next_observation_at INTEGER CHECK (next_observation_at IS NULL OR (${timeCheck('next_observation_at')})),
      observation_reason TEXT CHECK (observation_reason IS NULL OR observation_reason IN (
        'outside_workspace','invalid_path','final_symlink','not_regular_file','unsupported_text','too_large','blocked_before_execution',
        'workspace_unavailable','unreadable','secure_open_unavailable','observation_timeout','observation_incomplete','unstable_during_observation','identity_conflict'
      )),
      observed_at INTEGER CHECK (observed_at IS NULL OR (${timeCheck('observed_at')})),
      snapshot_id TEXT CHECK (snapshot_id IS NULL OR (${uuidCheck('snapshot_id')})),
      previous_snapshot_id TEXT CHECK (previous_snapshot_id IS NULL OR (${uuidCheck('previous_snapshot_id')})),
      created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
      updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
      UNIQUE (activity_id, candidate_sha256, access_family, access_kind, extraction_basis),
      UNIQUE (activity_id, candidate_ordinal),
      FOREIGN KEY (activity_id, workspace_id)
        REFERENCES agent_tool_activities(activity_id, workspace_id) ON DELETE RESTRICT,
      FOREIGN KEY (snapshot_id) REFERENCES agent_resource_snapshots(snapshot_id) ON DELETE RESTRICT,
      FOREIGN KEY (previous_snapshot_id) REFERENCES agent_resource_snapshots(snapshot_id) ON DELETE RESTRICT,
      CHECK (
        (canonical_path IS NULL AND file_name IS NULL AND folder_path IS NULL AND resource_id IS NULL)
        OR (canonical_path IS NOT NULL AND file_name IS NOT NULL AND folder_path IS NOT NULL)
      ),
      CHECK (folder_path IS NULL OR folder_path NOT IN ('.','/') AND (folder_path = '' OR substr(folder_path,-1) <> '/')),
      CHECK (
        (observation_state = 'pending' AND observation_reason IS NULL AND observed_at IS NULL
          AND snapshot_id IS NULL AND previous_snapshot_id IS NULL AND next_observation_at IS NOT NULL
          AND observation_attempt_count BETWEEN 0 AND 3)
        OR (observation_state = 'skipped' AND observation_reason IS NOT NULL AND observation_reason IN (
            'outside_workspace','invalid_path','final_symlink','not_regular_file','unsupported_text','too_large','blocked_before_execution'
          ) AND observed_at IS NOT NULL AND next_observation_at IS NULL
          AND snapshot_id IS NULL AND previous_snapshot_id IS NULL)
        OR (observation_state = 'failed' AND observation_reason IS NOT NULL AND observation_reason IN (
            'workspace_unavailable','unreadable','secure_open_unavailable','observation_timeout','observation_incomplete','unstable_during_observation','identity_conflict'
          ) AND observed_at IS NOT NULL AND next_observation_at IS NULL
          AND snapshot_id IS NULL AND previous_snapshot_id IS NULL)
        OR (observation_state IN ('first_observation','changed','unchanged')
          AND observation_reason IS NULL AND observed_at IS NOT NULL AND next_observation_at IS NULL
          AND snapshot_id IS NOT NULL AND observation_attempt_count BETWEEN 1 AND 3)
      ),
      CHECK (observation_state <> 'first_observation' OR previous_snapshot_id IS NULL),
      CHECK (observation_state <> 'changed' OR previous_snapshot_id IS NOT NULL),
      CHECK (
        observation_reason NOT IN ('outside_workspace','invalid_path')
        OR canonical_path IS NULL
        OR observation_reason = 'invalid_path'
      ),
      CHECK (updated_at >= created_at)
    )
  `);
  await knex.raw(`CREATE INDEX agent_tool_edges_workspace_path_idx ON agent_tool_resource_edges (workspace_id, canonical_path, id DESC)`);
  await knex.raw(`CREATE INDEX agent_tool_edges_file_idx ON agent_tool_resource_edges (workspace_id, file_name, id DESC)`);
  await knex.raw(`CREATE INDEX agent_tool_edges_folder_idx ON agent_tool_resource_edges (workspace_id, folder_path, id DESC)`);
  await knex.raw(`CREATE INDEX agent_tool_edges_activity_idx ON agent_tool_resource_edges (activity_id, candidate_ordinal)`);
  await knex.raw(`CREATE INDEX agent_tool_edges_access_idx ON agent_tool_resource_edges (workspace_id, access_family, access_kind, id DESC)`);
  await knex.raw(`CREATE INDEX agent_tool_edges_observation_idx ON agent_tool_resource_edges (observation_state, next_observation_at, id)`);
  await knex.raw(`CREATE INDEX agent_tool_edges_observed_time_idx ON agent_tool_resource_edges (workspace_id, observed_at DESC, id DESC)`);

  await knex.raw(`
    CREATE TABLE agent_snapshot_blobs (
      sha256 TEXT NOT NULL PRIMARY KEY CHECK (${digestCheck('sha256')}),
      byte_length INTEGER NOT NULL CHECK (typeof(byte_length) = 'integer' AND byte_length BETWEEN 0 AND ${MAX_SNAPSHOT_BYTES}),
      encoding TEXT NOT NULL CHECK (encoding = 'utf8'),
      bytes BLOB NOT NULL CHECK (typeof(bytes) = 'blob' AND length(bytes) = byte_length),
      first_stored_at INTEGER NOT NULL CHECK (${timeCheck('first_stored_at')})
    )
  `);

  await knex.raw(`
    CREATE TABLE agent_resource_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id TEXT NOT NULL UNIQUE CHECK (${uuidCheck('snapshot_id')}),
      observation_id TEXT NOT NULL UNIQUE CHECK (${uuidCheck('observation_id')}),
      event_id TEXT NOT NULL UNIQUE CHECK (${uuidCheck('event_id')}),
      workspace_id TEXT NOT NULL CHECK (length(CAST(workspace_id AS BLOB)) BETWEEN 1 AND 128),
      resource_id TEXT REFERENCES resource_registry(resource_id) ON DELETE RESTRICT,
      canonical_path TEXT NOT NULL CHECK (length(CAST(canonical_path AS BLOB)) BETWEEN 1 AND 4096),
      file_name TEXT NOT NULL CHECK (length(CAST(file_name AS BLOB)) BETWEEN 1 AND 255),
      folder_path TEXT NOT NULL CHECK (
        length(CAST(folder_path AS BLOB)) BETWEEN 0 AND 4096
        AND folder_path NOT IN ('.','/')
        AND (folder_path = '' OR substr(folder_path,-1) <> '/')
      ),
      state TEXT NOT NULL CHECK (state IN ('bytes','absent')),
      blob_sha256 TEXT REFERENCES agent_snapshot_blobs(sha256) ON DELETE RESTRICT,
      byte_length INTEGER NOT NULL CHECK (typeof(byte_length) = 'integer' AND byte_length BETWEEN 0 AND ${MAX_SNAPSHOT_BYTES}),
      relation TEXT NOT NULL CHECK (relation IN ('first_observation','changed')),
      previous_snapshot_id TEXT REFERENCES agent_resource_snapshots(snapshot_id) ON DELETE RESTRICT,
      source_activity_id TEXT NOT NULL CHECK (${uuidCheck('source_activity_id')}),
      source_edge_id TEXT NOT NULL UNIQUE REFERENCES agent_tool_resource_edges(edge_id) ON DELETE RESTRICT,
      access_family TEXT NOT NULL CHECK (access_family IN ('read','write','execute','unknown')),
      access_kind TEXT NOT NULL CHECK (access_kind IN ('read','write','create','delete','move_from','move_to','execute','unknown')),
      extraction_basis TEXT NOT NULL CHECK (extraction_basis IN ('structured_path','shell_input_redirection','shell_output_redirection','shell_known_operand')),
      snapshot_observed_at INTEGER NOT NULL CHECK (${timeCheck('snapshot_observed_at')}),
      fact_admission_state TEXT NOT NULL DEFAULT 'pending' CHECK (fact_admission_state IN ('pending','admitted','conflict')),
      ledger_state TEXT NOT NULL DEFAULT 'not_ready' CHECK (ledger_state IN ('not_ready','pending','running','stored','conflict','failed')),
      ledger_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (typeof(ledger_attempt_count) = 'integer' AND ledger_attempt_count BETWEEN 0 AND 3),
      ledger_next_attempt_at INTEGER CHECK (ledger_next_attempt_at IS NULL OR (${timeCheck('ledger_next_attempt_at')})),
      ledger_claim_token TEXT CHECK (ledger_claim_token IS NULL OR (${uuidCheck('ledger_claim_token')})),
      ledger_claimed_at INTEGER CHECK (ledger_claimed_at IS NULL OR (${timeCheck('ledger_claimed_at')})),
      ledger_lease_expires_at INTEGER CHECK (ledger_lease_expires_at IS NULL OR (${timeCheck('ledger_lease_expires_at')})),
      fact_json TEXT NOT NULL CHECK (json_valid(fact_json) AND json_type(fact_json) = 'object'),
      fact_sha256 TEXT NOT NULL CHECK (${digestCheck('fact_sha256')}),
      created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
      updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
      FOREIGN KEY (source_activity_id, workspace_id)
        REFERENCES agent_tool_activities(activity_id, workspace_id) ON DELETE RESTRICT,
      CHECK (
        (state = 'bytes' AND resource_id IS NOT NULL AND blob_sha256 IS NOT NULL)
        OR (state = 'absent' AND resource_id IS NULL AND blob_sha256 IS NULL AND byte_length = 0)
      ),
      CHECK ((relation = 'first_observation' AND previous_snapshot_id IS NULL) OR (relation = 'changed' AND previous_snapshot_id IS NOT NULL)),
      CHECK (
        (fact_admission_state IN ('pending','conflict') AND ledger_state = 'not_ready'
          AND ledger_attempt_count = 0 AND ledger_next_attempt_at IS NULL
          AND ledger_claim_token IS NULL AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
        OR (fact_admission_state = 'admitted' AND ledger_state IN ('pending','running','stored','conflict','failed'))
      ),
      CHECK (
        (ledger_state = 'not_ready' AND ledger_attempt_count = 0 AND ledger_next_attempt_at IS NULL
          AND ledger_claim_token IS NULL AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
        OR (ledger_state = 'pending' AND ledger_attempt_count BETWEEN 0 AND 2 AND ledger_next_attempt_at IS NOT NULL
          AND ledger_claim_token IS NULL AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
        OR (ledger_state = 'running' AND ledger_attempt_count BETWEEN 1 AND 3 AND ledger_next_attempt_at IS NULL
          AND ledger_claim_token IS NOT NULL AND ledger_claimed_at IS NOT NULL AND ledger_lease_expires_at > ledger_claimed_at)
        OR (ledger_state IN ('stored','conflict','failed') AND ledger_attempt_count BETWEEN 1 AND 3
          AND ledger_next_attempt_at IS NULL AND ledger_claim_token IS NULL AND ledger_claimed_at IS NULL AND ledger_lease_expires_at IS NULL)
      ),
      CHECK (updated_at >= created_at)
    )
  `);
  await knex.raw(`CREATE INDEX agent_snapshots_path_time_idx ON agent_resource_snapshots (workspace_id, canonical_path, snapshot_observed_at DESC, id DESC)`);
  await knex.raw(`CREATE INDEX agent_snapshots_resource_time_idx ON agent_resource_snapshots (resource_id, snapshot_observed_at DESC)`);
  await knex.raw(`CREATE INDEX agent_snapshots_activity_idx ON agent_resource_snapshots (source_activity_id, id)`);
  await knex.raw(`CREATE INDEX agent_snapshots_event_idx ON agent_resource_snapshots (event_id)`);
  await knex.raw(`CREATE INDEX agent_snapshots_observation_idx ON agent_resource_snapshots (observation_id)`);
  await knex.raw(`CREATE INDEX agent_snapshots_previous_idx ON agent_resource_snapshots (previous_snapshot_id)`);
  await knex.raw(`CREATE INDEX agent_snapshots_ledger_due_idx ON agent_resource_snapshots (ledger_state, ledger_next_attempt_at)`);
  await knex.raw(`CREATE INDEX agent_snapshots_ledger_lease_idx ON agent_resource_snapshots (ledger_state, ledger_lease_expires_at)`);

  await knex.raw(`
    CREATE TABLE agent_exchange_bind_jobs (
      exchange_id INTEGER NOT NULL PRIMARY KEY DESC REFERENCES exchanges(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL CHECK (length(CAST(workspace_id AS BLOB)) BETWEEN 1 AND 128),
      thread_id TEXT NOT NULL CHECK (length(CAST(thread_id AS BLOB)) BETWEEN 1 AND 128),
      turn_id TEXT NOT NULL CHECK (length(CAST(turn_id AS BLOB)) BETWEEN 1 AND 128),
      exchange_saved_at INTEGER NOT NULL CHECK (${timeCheck('exchange_saved_at')}),
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','applied','conflict')),
      conflict_code TEXT CHECK (conflict_code IS NULL OR conflict_code IN ('duplicate_tool_part','incomplete_tool_part','detail_hash_mismatch','different_binding')),
      created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
      updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
      UNIQUE (workspace_id, thread_id, turn_id, exchange_id),
      CHECK ((state = 'conflict' AND conflict_code IS NOT NULL) OR (state IN ('pending','applied') AND conflict_code IS NULL)),
      CHECK (updated_at >= created_at)
    )
  `);
  await knex.raw(`CREATE INDEX agent_exchange_bind_jobs_pending_idx ON agent_exchange_bind_jobs (state, exchange_id)`);

  await knex.raw(`
    CREATE TABLE agent_observation_jobs (
      activity_id TEXT NOT NULL PRIMARY KEY CHECK (${uuidCheck('activity_id')}),
      workspace_id TEXT NOT NULL CHECK (length(CAST(workspace_id AS BLOB)) BETWEEN 1 AND 128),
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','complete')),
      claim_token TEXT CHECK (claim_token IS NULL OR (${uuidCheck('claim_token')})),
      claimed_edge_id TEXT REFERENCES agent_tool_resource_edges(edge_id) ON DELETE RESTRICT,
      claimed_attempt INTEGER CHECK (claimed_attempt IS NULL OR (typeof(claimed_attempt) = 'integer' AND claimed_attempt BETWEEN 0 AND 3)),
      claimed_at INTEGER CHECK (claimed_at IS NULL OR (${timeCheck('claimed_at')})),
      lease_expires_at INTEGER CHECK (lease_expires_at IS NULL OR (${timeCheck('lease_expires_at')})),
      next_attempt_at INTEGER CHECK (next_attempt_at IS NULL OR (${timeCheck('next_attempt_at')})),
      created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
      updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
      FOREIGN KEY (activity_id, workspace_id)
        REFERENCES agent_tool_activities(activity_id, workspace_id) ON DELETE RESTRICT,
      CHECK (
        (state = 'pending' AND claim_token IS NULL AND claimed_edge_id IS NULL AND claimed_attempt IS NULL
          AND claimed_at IS NULL AND lease_expires_at IS NULL AND next_attempt_at IS NOT NULL)
        OR (state = 'running' AND claim_token IS NOT NULL AND claimed_edge_id IS NOT NULL AND claimed_attempt IS NOT NULL
          AND claimed_at IS NOT NULL AND lease_expires_at > claimed_at AND next_attempt_at IS NOT NULL)
        OR (state = 'complete' AND claim_token IS NULL AND claimed_edge_id IS NULL AND claimed_attempt IS NULL
          AND claimed_at IS NULL AND lease_expires_at IS NULL AND next_attempt_at IS NULL)
      ),
      CHECK (updated_at >= created_at)
    )
  `);
  await knex.raw(`CREATE INDEX agent_observation_jobs_due_idx ON agent_observation_jobs (state, next_attempt_at, created_at, activity_id)`);
  await knex.raw(`CREATE INDEX agent_observation_jobs_lease_idx ON agent_observation_jobs (state, lease_expires_at, activity_id)`);

  await knex.raw(`
    CREATE TABLE agent_renderer_projection_jobs (
      source_edge_id TEXT NOT NULL PRIMARY KEY REFERENCES agent_tool_resource_edges(edge_id) ON DELETE RESTRICT,
      workspace_id TEXT NOT NULL CHECK (length(CAST(workspace_id AS BLOB)) BETWEEN 1 AND 128),
      activity_id TEXT NOT NULL CHECK (${uuidCheck('activity_id')}),
      observed_at INTEGER NOT NULL CHECK (${timeCheck('observed_at')}),
      relation TEXT NOT NULL CHECK (relation IN ('first_observation','changed','unchanged')),
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','settled','failed')),
      delivery_failure_count INTEGER NOT NULL DEFAULT 0 CHECK (typeof(delivery_failure_count) = 'integer' AND delivery_failure_count BETWEEN 0 AND 3),
      next_attempt_at INTEGER CHECK (next_attempt_at IS NULL OR (${timeCheck('next_attempt_at')})),
      claim_token TEXT CHECK (claim_token IS NULL OR (${uuidCheck('claim_token')})),
      claimed_at INTEGER CHECK (claimed_at IS NULL OR (${timeCheck('claimed_at')})),
      lease_expires_at INTEGER CHECK (lease_expires_at IS NULL OR (${timeCheck('lease_expires_at')})),
      settled_at INTEGER CHECK (settled_at IS NULL OR (${timeCheck('settled_at')})),
      settlement TEXT CHECK (settlement IS NULL OR settlement IN ('v2_sent','refresh_required_sent','no_recipient','retry_exhausted')),
      created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
      updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
      FOREIGN KEY (activity_id, workspace_id)
        REFERENCES agent_tool_activities(activity_id, workspace_id) ON DELETE RESTRICT,
      CHECK (
        (state = 'pending' AND delivery_failure_count BETWEEN 0 AND 2 AND next_attempt_at IS NOT NULL
          AND claim_token IS NULL AND claimed_at IS NULL AND lease_expires_at IS NULL AND settled_at IS NULL AND settlement IS NULL)
        OR (state = 'running' AND delivery_failure_count BETWEEN 0 AND 2 AND next_attempt_at IS NULL
          AND claim_token IS NOT NULL AND claimed_at IS NOT NULL AND lease_expires_at > claimed_at
          AND settled_at IS NULL AND settlement IS NULL)
        OR (state = 'settled' AND delivery_failure_count BETWEEN 0 AND 2 AND next_attempt_at IS NULL
          AND claim_token IS NULL AND claimed_at IS NULL AND lease_expires_at IS NULL
          AND settled_at IS NOT NULL AND settlement IS NOT NULL
          AND settlement IN ('v2_sent','refresh_required_sent','no_recipient'))
        OR (state = 'failed' AND delivery_failure_count = 3 AND next_attempt_at IS NULL
          AND claim_token IS NULL AND claimed_at IS NULL AND lease_expires_at IS NULL
          AND settled_at IS NOT NULL AND settlement IS NOT NULL AND settlement = 'retry_exhausted')
      ),
      CHECK (updated_at >= created_at)
    )
  `);
  await knex.raw(`CREATE INDEX agent_renderer_jobs_due_idx ON agent_renderer_projection_jobs (state, next_attempt_at, observed_at, source_edge_id)`);
  await knex.raw(`CREATE INDEX agent_renderer_jobs_lease_idx ON agent_renderer_projection_jobs (state, lease_expires_at, source_edge_id)`);

  await knex.raw(`
    CREATE TRIGGER agent_exchange_delete_clear_activity_binding
    BEFORE DELETE ON exchanges
    FOR EACH ROW
    BEGIN
      UPDATE agent_tool_activities
      SET exchange_id = NULL, exchange_saved_at = NULL, exchange_bound_at = NULL
      WHERE exchange_id = OLD.id;
    END
  `);
};

exports.down = async function down(knex) {
  await knex.raw('PRAGMA foreign_keys = OFF');
  try {
    await knex.raw('DROP TRIGGER IF EXISTS agent_exchange_delete_clear_activity_binding');
    await knex.schema.dropTableIfExists('agent_exchange_bind_jobs');
    await knex.schema.dropTableIfExists('agent_renderer_projection_jobs');
    await knex.schema.dropTableIfExists('agent_observation_jobs');
    await knex.schema.dropTableIfExists('agent_resource_snapshots');
    await knex.schema.dropTableIfExists('agent_snapshot_blobs');
    await knex.schema.dropTableIfExists('agent_tool_resource_edges');
    await knex.schema.dropTableIfExists('agent_tool_activities');
  } finally {
    await knex.raw('PRAGMA foreign_keys = ON');
  }
};

exports.MAX_SNAPSHOT_BYTES = MAX_SNAPSHOT_BYTES;
exports.config = { transaction: false };
