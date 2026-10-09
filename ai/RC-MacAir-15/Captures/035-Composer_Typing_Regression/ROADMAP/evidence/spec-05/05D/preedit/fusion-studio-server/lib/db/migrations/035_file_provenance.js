'use strict';

const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE resource_registry (
      resource_id TEXT NOT NULL PRIMARY KEY CHECK (length(resource_id) > 0),
      workspace_id TEXT NOT NULL CHECK (length(workspace_id) > 0),
      kind TEXT NOT NULL CHECK (kind = 'file'),
      canonical_path TEXT NOT NULL CHECK (length(canonical_path) BETWEEN 1 AND 4096),
      lifecycle_state TEXT NOT NULL
        CHECK (lifecycle_state IN ('reserved', 'live', 'outcome_unknown', 'tombstoned')),
      fingerprint_dev TEXT,
      fingerprint_ino TEXT,
      fingerprint_size INTEGER
        CHECK (fingerprint_size IS NULL OR (typeof(fingerprint_size) = 'integer' AND fingerprint_size >= 0)),
      fingerprint_birthtime_ms INTEGER
        CHECK (fingerprint_birthtime_ms IS NULL OR (typeof(fingerprint_birthtime_ms) = 'integer' AND fingerprint_birthtime_ms >= 0)),
      tombstone_reason TEXT
        CHECK (tombstone_reason IS NULL OR tombstone_reason IN (
          'compatibility_relocated_or_replaced',
          'create_failed_before_replace'
        )),
      created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at >= 0),
      updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
      tombstoned_at INTEGER
        CHECK (tombstoned_at IS NULL OR (typeof(tombstoned_at) = 'integer' AND tombstoned_at >= created_at)),
      CHECK (
        (lifecycle_state = 'live'
          AND fingerprint_dev IS NOT NULL
          AND fingerprint_ino IS NOT NULL
          AND fingerprint_size IS NOT NULL
          AND tombstone_reason IS NULL
          AND tombstoned_at IS NULL)
        OR (lifecycle_state IN ('reserved', 'outcome_unknown')
          AND fingerprint_dev IS NULL
          AND fingerprint_ino IS NULL
          AND fingerprint_size IS NULL
          AND fingerprint_birthtime_ms IS NULL
          AND tombstone_reason IS NULL
          AND tombstoned_at IS NULL)
        OR (lifecycle_state = 'tombstoned'
          AND tombstone_reason IS NOT NULL
          AND tombstoned_at IS NOT NULL)
      )
    )
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX resource_registry_active_path_unique
    ON resource_registry (workspace_id, canonical_path)
    WHERE lifecycle_state <> 'tombstoned'
  `);
  await knex.raw(`
    CREATE INDEX resource_registry_fingerprint_idx
    ON resource_registry (
      workspace_id, fingerprint_dev, fingerprint_ino, fingerprint_size, fingerprint_birthtime_ms
    )
    WHERE lifecycle_state = 'live'
  `);

  await knex.raw(`
    CREATE TABLE file_operations (
      operation_id TEXT NOT NULL PRIMARY KEY CHECK (length(operation_id) > 0),
      workspace_id TEXT NOT NULL CHECK (length(workspace_id) > 0),
      request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
      command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) > 0),
      command_accepted_event_id TEXT NOT NULL UNIQUE CHECK (length(command_accepted_event_id) > 0),
      resource_event_id TEXT NOT NULL UNIQUE CHECK (length(resource_event_id) > 0),
      resource_id TEXT NOT NULL REFERENCES resource_registry(resource_id) ON DELETE RESTRICT,
      file_version_id TEXT NOT NULL UNIQUE CHECK (length(file_version_id) > 0),
      canonical_path TEXT NOT NULL CHECK (length(canonical_path) BETWEEN 1 AND 4096),
      ingress_panel TEXT NOT NULL CHECK (length(ingress_panel) BETWEEN 1 AND 128),
      ingress_path TEXT NOT NULL CHECK (length(ingress_path) BETWEEN 1 AND 4096),
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('create', 'modify')),
      state TEXT NOT NULL CHECK (state IN ('accepted', 'prepared', 'succeeded', 'failed', 'outcome_unknown')),
      command_fact_admission_state TEXT NOT NULL DEFAULT 'pending'
        CHECK (command_fact_admission_state IN ('pending', 'admitted')),
      fact_admission_state TEXT NOT NULL DEFAULT 'pending'
        CHECK (fact_admission_state IN ('pending', 'admitted')),
      ledger_projection_state TEXT NOT NULL DEFAULT 'pending'
        CHECK (ledger_projection_state IN ('pending', 'stored', 'conflict')),
      temp_cleanup_state TEXT NOT NULL DEFAULT 'pending'
        CHECK (temp_cleanup_state IN ('pending', 'complete')),
      terminal_response_json TEXT CHECK (
        terminal_response_json IS NULL OR (
          json_valid(terminal_response_json) AND json_type(terminal_response_json) = 'object'
        )
      ),
      response_command_fact_state TEXT CHECK (
        response_command_fact_state IS NULL OR response_command_fact_state IN ('pending', 'admitted')
      ),
      response_fact_state TEXT CHECK (
        response_fact_state IS NULL OR response_fact_state IN ('pending', 'admitted', 'not_emitted')
      ),
      response_ledger_state TEXT CHECK (
        response_ledger_state IS NULL OR response_ledger_state IN (
          'pending', 'stored', 'conflict', 'not_applicable'
        )
      ),
      response_provenance_state TEXT CHECK (
        response_provenance_state IS NULL OR response_provenance_state IN (
          'complete', 'pending_reconciliation'
        )
      ),
      response_checkpoint_state TEXT CHECK (
        response_checkpoint_state IS NULL OR response_checkpoint_state IN (
          'not_requested', 'committed', 'no_change', 'failed'
        )
      ),
      response_workspace_id TEXT CHECK (
        response_workspace_id IS NULL OR length(response_workspace_id) BETWEEN 1 AND 128
      ),
      response_workspace_epoch TEXT CHECK (
        response_workspace_epoch IS NULL OR length(response_workspace_epoch) = 36
      ),
      origin_kind TEXT NOT NULL CHECK (origin_kind = 'local_client'),
      origin_connection_id TEXT NOT NULL CHECK (length(origin_connection_id) BETWEEN 1 AND 128),
      origin_assurance TEXT NOT NULL CHECK (origin_assurance = 'transport_only'),
      reported_view_id TEXT CHECK (reported_view_id IS NULL OR length(reported_view_id) BETWEEN 1 AND 128),
      reported_view_instance_id TEXT
        CHECK (reported_view_instance_id IS NULL OR length(reported_view_instance_id) BETWEEN 1 AND 128),
      save_reason TEXT CHECK (save_reason IS NULL OR save_reason IN (
        'autosave', 'manual', 'session_end', 'checkpoint', 'milestone'
      )),
      milestone TEXT CHECK (milestone IS NULL OR length(milestone) BETWEEN 0 AND 256),
      client_action_id TEXT CHECK (client_action_id IS NULL OR length(client_action_id) BETWEEN 1 AND 128),
      preimage_kind TEXT NOT NULL DEFAULT 'unknown' CHECK (preimage_kind IN ('unknown', 'absent', 'bytes')),
      preimage_sha256 TEXT CHECK (
        preimage_sha256 IS NULL OR (
          length(preimage_sha256) = 64 AND preimage_sha256 NOT GLOB '*[^0-9a-f]*'
        )
      ),
      preimage_byte_length INTEGER CHECK (
        preimage_byte_length IS NULL OR (
          typeof(preimage_byte_length) = 'integer'
          AND preimage_byte_length BETWEEN 0 AND ${MAX_SNAPSHOT_BYTES}
        )
      ),
      intended_after_sha256 TEXT NOT NULL CHECK (
        length(intended_after_sha256) = 64 AND intended_after_sha256 NOT GLOB '*[^0-9a-f]*'
      ),
      intended_after_byte_length INTEGER NOT NULL CHECK (
        typeof(intended_after_byte_length) = 'integer'
        AND intended_after_byte_length BETWEEN 0 AND ${MAX_SNAPSHOT_BYTES}
      ),
      succeeded_fingerprint_dev TEXT,
      succeeded_fingerprint_ino TEXT,
      succeeded_fingerprint_size INTEGER CHECK (
        succeeded_fingerprint_size IS NULL OR (
          typeof(succeeded_fingerprint_size) = 'integer' AND succeeded_fingerprint_size >= 0
        )
      ),
      succeeded_fingerprint_birthtime_ms INTEGER CHECK (
        succeeded_fingerprint_birthtime_ms IS NULL OR (
          typeof(succeeded_fingerprint_birthtime_ms) = 'integer'
          AND succeeded_fingerprint_birthtime_ms >= 0
        )
      ),
      observed_target_state TEXT CHECK (
        observed_target_state IS NULL OR observed_target_state IN ('absent', 'bytes', 'unreadable')
      ),
      observed_target_sha256 TEXT CHECK (
        observed_target_sha256 IS NULL OR (
          length(observed_target_sha256) = 64 AND observed_target_sha256 NOT GLOB '*[^0-9a-f]*'
        )
      ),
      observed_target_byte_length INTEGER CHECK (
        observed_target_byte_length IS NULL OR (
          typeof(observed_target_byte_length) = 'integer' AND observed_target_byte_length >= 0
        )
      ),
      failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN (
        'snapshot_failed', 'unsupported_preimage', 'preimage_too_large', 'preimage_conflict',
        'write_prepare_failed', 'replace_failed', 'permission_denied',
        'interrupted_before_prepare', 'mutation_outcome_unknown'
      )),
      request_binding_sha256 TEXT NOT NULL CHECK (
        length(request_binding_sha256) = 64 AND request_binding_sha256 NOT GLOB '*[^0-9a-f]*'
      ),
      command_reservation_sha256 TEXT NOT NULL CHECK (
        length(command_reservation_sha256) = 64 AND command_reservation_sha256 NOT GLOB '*[^0-9a-f]*'
      ),
      resource_reservation_sha256 TEXT CHECK (
        resource_reservation_sha256 IS NULL OR (
          length(resource_reservation_sha256) = 64 AND resource_reservation_sha256 NOT GLOB '*[^0-9a-f]*'
        )
      ),
      accepted_at INTEGER NOT NULL CHECK (typeof(accepted_at) = 'integer' AND accepted_at >= 0),
      prepared_at INTEGER CHECK (
        prepared_at IS NULL OR (typeof(prepared_at) = 'integer' AND prepared_at >= accepted_at)
      ),
      attempted_at INTEGER CHECK (
        attempted_at IS NULL OR (
          typeof(attempted_at) = 'integer'
          AND prepared_at IS NOT NULL
          AND attempted_at >= prepared_at
        )
      ),
      completed_at INTEGER CHECK (
        completed_at IS NULL OR (
          typeof(completed_at) = 'integer'
          AND completed_at >= COALESCE(attempted_at, prepared_at, accepted_at)
        )
      ),
      resource_occurred_at INTEGER CHECK (
        resource_occurred_at IS NULL OR (
          typeof(resource_occurred_at) = 'integer'
          AND attempted_at IS NOT NULL
          AND resource_occurred_at >= attempted_at
          AND completed_at IS NOT NULL
          AND completed_at >= resource_occurred_at
        )
      ),
      reconciled_at INTEGER CHECK (
        reconciled_at IS NULL OR (
          typeof(reconciled_at) = 'integer'
          AND completed_at IS NOT NULL
          AND reconciled_at >= completed_at
        )
      ),
      updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= accepted_at),
      UNIQUE (workspace_id, origin_connection_id, request_id),
      CHECK (milestone IS NULL OR save_reason = 'milestone'),
      CHECK (
        (preimage_kind = 'unknown' AND preimage_sha256 IS NULL AND preimage_byte_length IS NULL)
        OR (preimage_kind = 'absent' AND preimage_sha256 IS NULL AND preimage_byte_length = 0)
        OR (preimage_kind = 'bytes' AND preimage_sha256 IS NOT NULL AND preimage_byte_length IS NOT NULL)
      ),
      CHECK (state IN ('accepted', 'failed') OR preimage_kind IN ('absent', 'bytes')),
      CHECK (
        (observed_target_state IS NULL
          AND observed_target_sha256 IS NULL
          AND observed_target_byte_length IS NULL)
        OR (observed_target_state = 'bytes'
          AND observed_target_sha256 IS NOT NULL
          AND observed_target_byte_length IS NOT NULL)
        OR (observed_target_state IN ('absent', 'unreadable')
          AND observed_target_sha256 IS NULL
          AND observed_target_byte_length IS NULL)
      ),
      CHECK (
        updated_at >= accepted_at
        AND (prepared_at IS NULL OR updated_at >= prepared_at)
        AND (attempted_at IS NULL OR updated_at >= attempted_at)
        AND (completed_at IS NULL OR updated_at >= completed_at)
        AND (resource_occurred_at IS NULL OR updated_at >= resource_occurred_at)
        AND (reconciled_at IS NULL OR updated_at >= reconciled_at)
      ),
      CHECK (
        (state = 'accepted'
          AND preimage_kind = 'unknown'
          AND prepared_at IS NULL AND attempted_at IS NULL
          AND completed_at IS NULL AND resource_occurred_at IS NULL
          AND failure_code IS NULL)
        OR (state = 'prepared'
          AND preimage_kind IN ('absent', 'bytes')
          AND prepared_at IS NOT NULL
          AND completed_at IS NULL AND resource_occurred_at IS NULL
          AND failure_code IS NULL)
        OR (state = 'succeeded'
          AND preimage_kind IN ('absent', 'bytes')
          AND prepared_at IS NOT NULL AND attempted_at IS NOT NULL
          AND completed_at IS NOT NULL AND resource_occurred_at IS NOT NULL
          AND failure_code IS NULL)
        OR (state = 'failed'
          AND completed_at IS NOT NULL
          AND resource_occurred_at IS NULL
          AND failure_code IS NOT NULL)
        OR (state = 'outcome_unknown'
          AND preimage_kind IN ('absent', 'bytes')
          AND prepared_at IS NOT NULL
          AND completed_at IS NOT NULL
          AND resource_occurred_at IS NULL
          AND failure_code = 'mutation_outcome_unknown')
      ),
      CHECK (
        state <> 'failed'
        OR (
          (prepared_at IS NULL AND attempted_at IS NULL AND failure_code IN (
            'snapshot_failed', 'unsupported_preimage', 'preimage_too_large',
            'permission_denied', 'interrupted_before_prepare'
          ))
          OR (prepared_at IS NOT NULL AND attempted_at IS NULL
            AND failure_code = 'write_prepare_failed')
          OR (prepared_at IS NOT NULL AND attempted_at IS NOT NULL AND failure_code IN (
            'preimage_conflict', 'write_prepare_failed', 'replace_failed', 'permission_denied'
          ))
        )
      ),
      CHECK (state = 'succeeded' OR fact_admission_state = 'pending'),
      CHECK (state = 'succeeded' OR ledger_projection_state = 'pending'),
      CHECK (
        terminal_response_json IS NULL
        OR state IN ('succeeded', 'failed', 'outcome_unknown')
      ),
      CHECK (
        (response_command_fact_state IS NULL
          AND response_fact_state IS NULL
          AND response_ledger_state IS NULL
          AND response_provenance_state IS NULL
          AND response_checkpoint_state IS NULL
          AND response_workspace_id IS NULL
          AND response_workspace_epoch IS NULL)
        OR (state = 'succeeded'
          AND response_command_fact_state IS NOT NULL
          AND response_fact_state IN ('pending', 'admitted')
          AND response_ledger_state IN ('pending', 'stored', 'conflict')
          AND response_provenance_state IS NOT NULL
          AND response_checkpoint_state IS NOT NULL
          AND response_workspace_id = workspace_id
          AND response_workspace_epoch IS NOT NULL)
        OR (state IN ('failed', 'outcome_unknown')
          AND response_command_fact_state IS NOT NULL
          AND response_fact_state = 'not_emitted'
          AND response_ledger_state = 'not_applicable'
          AND response_provenance_state IS NULL
          AND response_checkpoint_state IS NULL
          AND response_workspace_id = workspace_id
          AND response_workspace_epoch IS NOT NULL)
      ),
      CHECK (
        state <> 'succeeded'
        OR (
          resource_occurred_at IS NOT NULL
          AND resource_reservation_sha256 IS NOT NULL
          AND succeeded_fingerprint_dev IS NOT NULL
          AND succeeded_fingerprint_ino IS NOT NULL
          AND succeeded_fingerprint_size IS NOT NULL
        )
      )
    )
  `);
  await knex.raw(`
    CREATE INDEX file_operations_reconciliation_idx
    ON file_operations (
      state, temp_cleanup_state, command_fact_admission_state,
      fact_admission_state, ledger_projection_state
    )
  `);
  await knex.raw(`
    CREATE INDEX file_operations_workspace_path_idx
    ON file_operations (workspace_id, canonical_path, accepted_at DESC, operation_id ASC)
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX file_operations_active_resource_unique
    ON file_operations (resource_id)
    WHERE state IN ('accepted', 'prepared')
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX file_operations_active_path_unique
    ON file_operations (workspace_id, canonical_path)
    WHERE state IN ('accepted', 'prepared')
  `);
  await knex.raw(`CREATE INDEX file_operations_resource_idx ON file_operations (resource_id, accepted_at DESC)`);

  await knex.raw(`
    CREATE TABLE file_versions (
      file_version_id TEXT NOT NULL PRIMARY KEY CHECK (length(file_version_id) > 0),
      operation_id TEXT NOT NULL UNIQUE REFERENCES file_operations(operation_id) ON DELETE CASCADE,
      resource_id TEXT NOT NULL REFERENCES resource_registry(resource_id) ON DELETE RESTRICT,
      resource_event_id TEXT NOT NULL UNIQUE,
      preimage_kind TEXT NOT NULL CHECK (preimage_kind IN ('absent', 'bytes')),
      snapshot_bytes BLOB,
      sha256 TEXT CHECK (
        sha256 IS NULL OR (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*')
      ),
      encoding TEXT CHECK (encoding IS NULL OR encoding = 'utf-8'),
      byte_length INTEGER NOT NULL CHECK (
        typeof(byte_length) = 'integer' AND byte_length BETWEEN 0 AND ${MAX_SNAPSHOT_BYTES}
      ),
      captured_at INTEGER NOT NULL CHECK (typeof(captured_at) = 'integer' AND captured_at >= 0),
      CHECK (
        (preimage_kind = 'absent'
          AND snapshot_bytes IS NULL AND sha256 IS NULL AND encoding IS NULL AND byte_length = 0)
        OR (preimage_kind = 'bytes'
          AND typeof(snapshot_bytes) = 'blob'
          AND sha256 IS NOT NULL AND encoding = 'utf-8'
          AND length(snapshot_bytes) = byte_length)
      )
    )
  `);
  await knex.raw(`CREATE INDEX file_versions_resource_idx ON file_versions (resource_id, captured_at DESC)`);

  await knex.raw(`
    CREATE TABLE resource_provenance_events (
      event_id TEXT NOT NULL PRIMARY KEY REFERENCES event_log(event_id) ON DELETE CASCADE,
      payload_sha256 TEXT NOT NULL CHECK (
        length(payload_sha256) = 64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
      ),
      workspace_id TEXT NOT NULL,
      occurred_at INTEGER NOT NULL CHECK (typeof(occurred_at) = 'integer' AND occurred_at >= 0),
      accepted_at INTEGER NOT NULL CHECK (typeof(accepted_at) = 'integer' AND accepted_at >= 0),
      operation_id TEXT NOT NULL UNIQUE REFERENCES file_operations(operation_id) ON DELETE RESTRICT,
      command_id TEXT NOT NULL,
      command_accepted_event_id TEXT NOT NULL,
      resource_id TEXT NOT NULL REFERENCES resource_registry(resource_id) ON DELETE RESTRICT,
      file_version_id TEXT NOT NULL REFERENCES file_versions(file_version_id) ON DELETE RESTRICT,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('create', 'modify')),
      canonical_path TEXT NOT NULL CHECK (length(canonical_path) BETWEEN 1 AND 4096),
      file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
      folder_path TEXT NOT NULL CHECK (length(folder_path) <= 4096),
      ingress_panel TEXT NOT NULL CHECK (length(ingress_panel) BETWEEN 1 AND 128),
      ingress_path TEXT NOT NULL CHECK (length(ingress_path) BETWEEN 1 AND 4096),
      origin_kind TEXT NOT NULL CHECK (origin_kind = 'local_client'),
      origin_connection_id TEXT NOT NULL CHECK (length(origin_connection_id) BETWEEN 1 AND 128),
      origin_assurance TEXT NOT NULL CHECK (origin_assurance = 'transport_only')
    )
  `);
  await knex.raw(`
    CREATE INDEX resource_provenance_query_order_idx
    ON resource_provenance_events (workspace_id, occurred_at DESC, event_id ASC)
  `);
  await knex.raw(`
    CREATE INDEX resource_provenance_path_idx
    ON resource_provenance_events (workspace_id, canonical_path, occurred_at DESC)
  `);
  await knex.raw(`
    CREATE INDEX resource_provenance_file_idx
    ON resource_provenance_events (workspace_id, file_name, occurred_at DESC)
  `);
  await knex.raw(`
    CREATE INDEX resource_provenance_folder_idx
    ON resource_provenance_events (workspace_id, folder_path, occurred_at DESC)
  `);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('resource_provenance_events');
  await knex.schema.dropTableIfExists('file_versions');
  await knex.schema.dropTableIfExists('file_operations');
  await knex.schema.dropTableIfExists('resource_registry');
};

exports.MAX_SNAPSHOT_BYTES = MAX_SNAPSHOT_BYTES;
