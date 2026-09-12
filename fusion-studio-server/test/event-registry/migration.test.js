'use strict';

const path = require('path');
const knex = require('knex');
const initialMigration = require('../../lib/db/migrations/001_initial');
const ledgerMigration = require('../../lib/db/migrations/029_event_ledger');
const registryMigration = require('../../lib/db/migrations/034_event_registry_authority');

const MIGRATIONS_DIRECTORY = path.join(__dirname, '../../lib/db/migrations');
const CHECKSUM = 'a'.repeat(64);

function createDb({ migrations = false } = {}) {
  return knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(conn, done) {
        conn.pragma('foreign_keys = ON');
        done(null, conn);
      },
    },
    ...(migrations ? { migrations: { directory: MIGRATIONS_DIRECTORY } } : {}),
  });
}

function schemaRow(overrides = {}) {
  return {
    schema_id: 'schema-1',
    schema_key: 'resource.mutated',
    schema_version: 1,
    definition_kind: 'event',
    owner_kind: 'system',
    owner_id: 'fusion-studio',
    locked: 1,
    status: 'enabled',
    definition_json: '{}',
    definition_sha256: CHECKSUM,
    created_at: 100,
    updated_at: 100,
    ...overrides,
  };
}

function subscriptionRow(overrides = {}) {
  return {
    subscription_id: 'subscription-1',
    owner_kind: 'system',
    owner_id: 'fusion-studio',
    locked: 1,
    status: 'enabled',
    handler_key: 'system.test-handler',
    priority: 0,
    filter_json: '{}',
    requested_capabilities_json: '[]',
    definition_json: '{}',
    definition_sha256: CHECKSUM,
    delivery_policy: 'best_effort',
    installation_id: null,
    installation_revision: null,
    created_at: 100,
    updated_at: 100,
    ...overrides,
  };
}

async function expectConstraint(db, table, row) {
  try {
    await db(table).insert(row);
  } catch (error) {
    expect(error.message).toMatch(/constraint/i);
    return;
  }
  throw new Error(`Expected ${table} insert to violate a constraint`);
}

describe('migration 034 event registry authority', () => {
  let db;

  afterEach(async () => {
    if (db) {
      await db.destroy();
      db = null;
    }
  });

  test('applies after the full current migration set on a fresh database', async () => {
    db = createDb({ migrations: true });
    const [batch, migrations] = await db.migrate.latest();

    expect(batch).toBe(1);
    expect(migrations.at(-1)).toMatch(/039_system_wiki_canonical_view_path\.js$/);
    await expect(db.schema.hasTable('event_schema_registry')).resolves.toBe(true);
    await expect(db.schema.hasTable('event_subscription_registry')).resolves.toBe(true);
    await expect(db.schema.hasTable('event_subscription_grants')).resolves.toBe(true);
    await expect(db.schema.hasTable('agent_tool_activities')).resolves.toBe(true);
    await expect(db.schema.hasTable('file_operations')).resolves.toBe(true);
    await expect(db.schema.hasTable('view_capsule_relocations')).resolves.toBe(true);
  });

  test('preserves migration 029 ledger data through up, down, and re-up', async () => {
    db = createDb();
    await initialMigration.up(db);
    await ledgerMigration.up(db);
    await db('event_log').insert({
      event_id: 'legacy-event',
      event_type: 'file:changed',
      actor_type: 'system',
      occurred_at: 50,
      summary: 'preserve me',
      payload_json: '{}',
      created_at: 50,
    });

    await registryMigration.up(db);
    await db('event_schema_registry').insert(schemaRow());
    await expect(db('event_schema_registry').select('schema_id', 'schema_key'))
      .resolves.toEqual([{ schema_id: 'schema-1', schema_key: 'resource.mutated' }]);
    await registryMigration.down(db);

    await expect(db.schema.hasTable('event_schema_registry')).resolves.toBe(false);
    await expect(db.schema.hasTable('event_subscription_registry')).resolves.toBe(false);
    await expect(db.schema.hasTable('event_subscription_grants')).resolves.toBe(false);
    await expect(db('event_log').where({ event_id: 'legacy-event' }).first())
      .resolves.toMatchObject({ summary: 'preserve me' });

    await registryMigration.up(db);
    await expect(db('event_log').where({ event_id: 'legacy-event' }).first())
      .resolves.toMatchObject({ summary: 'preserve me' });
    await expect(db('event_schema_registry')).resolves.toEqual([]);
  });

  test('enforces schema domains, canonical-storage shape, and unique identity', async () => {
    db = createDb();
    await registryMigration.up(db);
    await db('event_schema_registry').insert(schemaRow());

    await expectConstraint(db, 'event_schema_registry', schemaRow({ schema_id: 'duplicate-key' }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: null, schema_key: 'null-id',
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'bad-version', schema_key: 'other', schema_version: 0,
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'bad-kind', schema_key: 'other', definition_kind: 'unknown',
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'bad-owner', schema_key: 'other', owner_kind: 'user',
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'locked-extension', schema_key: 'other', owner_kind: 'extension', locked: 1,
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'bad-status', schema_key: 'other', status: 'active',
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'bad-json', schema_key: 'other', definition_json: '{',
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'wrong-json-shape', schema_key: 'other', definition_json: '[]',
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'bad-checksum', schema_key: 'other', definition_sha256: 'A'.repeat(64),
    }));
    await expectConstraint(db, 'event_schema_registry', schemaRow({
      schema_id: 'bad-time', schema_key: 'other', updated_at: 99,
    }));
  });

  test('enforces subscription priority, delivery policy, JSON, and ownership domains', async () => {
    db = createDb();
    await registryMigration.up(db);

    await db('event_subscription_registry').insert(subscriptionRow());
    await db('event_subscription_registry').insert(subscriptionRow({
      subscription_id: 'required-system',
      delivery_policy: 'required_ack',
      priority: -1000,
    }));
    await expect(db('event_subscription_registry').orderBy('subscription_id').pluck('subscription_id'))
      .resolves.toEqual(['required-system', 'subscription-1']);

    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: null,
    }));
    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: 'low-priority', priority: -1001,
    }));
    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: 'high-priority', priority: 1001,
    }));
    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: 'fractional-priority', priority: 0.5,
    }));
    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: 'extension-required', owner_kind: 'extension', locked: 0,
      delivery_policy: 'required_ack',
    }));
    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: 'unlocked-required', locked: 0, delivery_policy: 'required_ack',
    }));
    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: 'bad-filter', filter_json: '[]',
    }));
    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: 'bad-requests', requested_capabilities_json: '{}',
    }));
    await expectConstraint(db, 'event_subscription_registry', subscriptionRow({
      subscription_id: 'bad-installation', installation_id: '',
    }));
  });

  test('enforces grant authority shape, uniqueness, and cascading ownership', async () => {
    db = createDb();
    await registryMigration.up(db);
    await db('event_subscription_registry').insert(subscriptionRow());

    const grant = {
      subscription_id: 'subscription-1',
      capability_key: 'fact.consume',
      state: 'pending',
      scope_json: '{}',
      authorized_by_kind: null,
      authorized_at: null,
      created_at: 100,
      updated_at: 100,
    };
    await db('event_subscription_grants').insert(grant);
    await expect(db('event_subscription_grants').select('subscription_id', 'capability_key'))
      .resolves.toEqual([{
        subscription_id: 'subscription-1',
        capability_key: 'fact.consume',
      }]);

    await expectConstraint(db, 'event_subscription_grants', grant);
    await expectConstraint(db, 'event_subscription_grants', {
      ...grant, capability_key: 'unknown-state', state: 'enabled',
    });
    await expectConstraint(db, 'event_subscription_grants', {
      ...grant, capability_key: 'missing-authorization', state: 'granted',
    });
    await expectConstraint(db, 'event_subscription_grants', {
      ...grant, capability_key: 'bad-authorizer', authorized_by_kind: 'assistant',
    });
    await expectConstraint(db, 'event_subscription_grants', {
      ...grant, capability_key: 'bad-scope', scope_json: '[]',
    });
    await expectConstraint(db, 'event_subscription_grants', {
      ...grant, subscription_id: 'missing-subscription', capability_key: 'orphan',
    });

    await db('event_subscription_grants').insert({
      ...grant,
      capability_key: 'ledger.append_resource_fact',
      state: 'granted',
      authorized_by_kind: 'system_seed',
      authorized_at: 100,
    });
    await db('event_subscription_registry').where({ subscription_id: 'subscription-1' }).del();
    await expect(db('event_subscription_grants')).resolves.toEqual([]);
  });
});
