/**
 * Migration 034 — Database authority for event schemas and subscriptions.
 *
 * Definitions and requested capabilities live separately from effective
 * grants. Runtime policy still validates canonical envelopes and derives
 * effective authority; these constraints protect the durable domain itself.
 */

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE event_schema_registry (
      schema_id TEXT NOT NULL PRIMARY KEY
        CHECK (length(schema_id) > 0),
      schema_key TEXT NOT NULL
        CHECK (length(schema_key) > 0),
      schema_version INTEGER NOT NULL
        CHECK (typeof(schema_version) = 'integer' AND schema_version >= 1),
      definition_kind TEXT NOT NULL
        CHECK (definition_kind IN ('event', 'projection', 'command', 'query')),
      owner_kind TEXT NOT NULL
        CHECK (owner_kind IN ('system', 'extension')),
      owner_id TEXT NOT NULL
        CHECK (length(owner_id) > 0),
      locked INTEGER NOT NULL DEFAULT 0
        CHECK (typeof(locked) = 'integer' AND locked IN (0, 1))
        CHECK (locked = 0 OR owner_kind = 'system'),
      status TEXT NOT NULL
        CHECK (status IN ('enabled', 'disabled', 'pending', 'quarantined', 'revoked')),
      definition_json TEXT NOT NULL
        CHECK (json_valid(definition_json) AND json_type(definition_json) = 'object'),
      definition_sha256 TEXT NOT NULL
        CHECK (
          length(definition_sha256) = 64
          AND definition_sha256 NOT GLOB '*[^0-9a-f]*'
        ),
      created_at INTEGER NOT NULL
        CHECK (typeof(created_at) = 'integer' AND created_at >= 0),
      updated_at INTEGER NOT NULL
        CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
      CONSTRAINT event_schema_registry_key_version_kind_unique
        UNIQUE (schema_key, schema_version, definition_kind)
    )
  `);

  await knex.raw(`
    CREATE INDEX event_schema_registry_owner_status_idx
    ON event_schema_registry (owner_kind, owner_id, status)
  `);

  await knex.raw(`
    CREATE TABLE event_subscription_registry (
      subscription_id TEXT NOT NULL PRIMARY KEY
        CHECK (length(subscription_id) > 0),
      owner_kind TEXT NOT NULL
        CHECK (owner_kind IN ('system', 'extension')),
      owner_id TEXT NOT NULL
        CHECK (length(owner_id) > 0),
      locked INTEGER NOT NULL DEFAULT 0
        CHECK (typeof(locked) = 'integer' AND locked IN (0, 1))
        CHECK (locked = 0 OR owner_kind = 'system'),
      status TEXT NOT NULL
        CHECK (status IN ('enabled', 'disabled', 'pending', 'quarantined', 'revoked')),
      handler_key TEXT NOT NULL
        CHECK (length(handler_key) > 0),
      priority INTEGER NOT NULL DEFAULT 0
        CHECK (typeof(priority) = 'integer' AND priority BETWEEN -1000 AND 1000),
      filter_json TEXT NOT NULL
        CHECK (json_valid(filter_json) AND json_type(filter_json) = 'object'),
      requested_capabilities_json TEXT NOT NULL
        CHECK (
          json_valid(requested_capabilities_json)
          AND json_type(requested_capabilities_json) = 'array'
        ),
      definition_json TEXT NOT NULL
        CHECK (json_valid(definition_json) AND json_type(definition_json) = 'object'),
      definition_sha256 TEXT NOT NULL
        CHECK (
          length(definition_sha256) = 64
          AND definition_sha256 NOT GLOB '*[^0-9a-f]*'
        ),
      delivery_policy TEXT NOT NULL DEFAULT 'best_effort'
        CHECK (delivery_policy IN ('best_effort', 'required_ack'))
        CHECK (
          delivery_policy <> 'required_ack'
          OR (owner_kind = 'system' AND locked = 1)
        ),
      installation_id TEXT
        CHECK (installation_id IS NULL OR length(installation_id) > 0),
      installation_revision TEXT
        CHECK (installation_revision IS NULL OR length(installation_revision) > 0),
      created_at INTEGER NOT NULL
        CHECK (typeof(created_at) = 'integer' AND created_at >= 0),
      updated_at INTEGER NOT NULL
        CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at)
    )
  `);

  await knex.raw(`
    CREATE INDEX event_subscription_registry_effective_order_idx
    ON event_subscription_registry (status, priority, subscription_id)
  `);
  await knex.raw(`
    CREATE INDEX event_subscription_registry_owner_status_idx
    ON event_subscription_registry (owner_kind, owner_id, status)
  `);
  await knex.raw(`
    CREATE INDEX event_subscription_registry_handler_idx
    ON event_subscription_registry (handler_key)
  `);
  await knex.raw(`
    CREATE INDEX event_subscription_registry_installation_idx
    ON event_subscription_registry (installation_id, installation_revision)
    WHERE installation_id IS NOT NULL
  `);

  await knex.raw(`
    CREATE TABLE event_subscription_grants (
      subscription_id TEXT NOT NULL
        REFERENCES event_subscription_registry(subscription_id) ON DELETE CASCADE,
      capability_key TEXT NOT NULL
        CHECK (length(capability_key) > 0),
      state TEXT NOT NULL
        CHECK (state IN ('pending', 'granted', 'denied', 'revoked')),
      scope_json TEXT NOT NULL
        CHECK (json_valid(scope_json) AND json_type(scope_json) = 'object'),
      authorized_by_kind TEXT
        CHECK (
          authorized_by_kind IS NULL
          OR authorized_by_kind IN ('system_seed', 'human')
        ),
      authorized_at INTEGER
        CHECK (
          authorized_at IS NULL
          OR (typeof(authorized_at) = 'integer' AND authorized_at >= 0)
        ),
      created_at INTEGER NOT NULL
        CHECK (typeof(created_at) = 'integer' AND created_at >= 0),
      updated_at INTEGER NOT NULL
        CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
      CONSTRAINT event_subscription_grants_granted_authority_check
        CHECK (
          state <> 'granted'
          OR (authorized_by_kind IS NOT NULL AND authorized_at IS NOT NULL)
        ),
      CONSTRAINT event_subscription_grants_subscription_capability_unique
        PRIMARY KEY (subscription_id, capability_key)
    )
  `);

  await knex.raw(`
    CREATE INDEX event_subscription_grants_state_capability_idx
    ON event_subscription_grants (state, capability_key)
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('event_subscription_grants');
  await knex.schema.dropTableIfExists('event_subscription_registry');
  await knex.schema.dropTableIfExists('event_schema_registry');
};
