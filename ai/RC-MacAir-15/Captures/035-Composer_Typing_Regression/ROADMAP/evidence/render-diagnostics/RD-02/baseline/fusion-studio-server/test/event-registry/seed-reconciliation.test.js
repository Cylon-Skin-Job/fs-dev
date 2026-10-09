'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const knex = require('knex');
const migration = require('../../lib/db/migrations/034_event_registry_authority');
const { canonicalizeJson, sha256CanonicalJson } = require('../../lib/event-registry/canonical-json');
const {
  createInitializedEventRegistry,
} = require('../../lib/event-registry');
const {
  SYSTEM_SCHEMA_SEEDS,
  createSystemSchemaIntegrityCatalog,
} = require('../../lib/event-registry/seed-catalog');
const {
  PROVENANCE_LEDGER_SUBSCRIPTION_SEED,
  AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_SEED,
  AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_SEED,
  RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_SEED,
  SYSTEM_SUBSCRIPTION_SEEDS,
  createSystemSubscriptionIntegrityCatalog,
} = require('../../lib/event-registry/subscription-seed-catalog');

function createDb(filename = ':memory:') {
  return knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(connection, done) {
        connection.pragma('foreign_keys = ON');
        done(null, connection);
      },
    },
  });
}

function unknownSchemaRow(overrides = {}) {
  const definition = { type: 'object', additionalProperties: false };
  return {
    schema_id: 'unknown-system-schema',
    schema_key: 'unknown.event',
    schema_version: 1,
    definition_kind: 'event',
    owner_kind: 'system',
    owner_id: 'unknown-owner',
    locked: 1,
    status: 'enabled',
    definition_json: canonicalizeJson(definition),
    definition_sha256: sha256CanonicalJson(definition),
    created_at: 10,
    updated_at: 10,
    ...overrides,
  };
}

describe('locked system schema seed reconciliation', () => {
  let db;

  beforeEach(async () => {
    db = createDb();
    await migration.up(db);
  });

  afterEach(async () => {
    if (db) await db.destroy();
  });

  test('fresh initialization atomically inserts locked schemas plus all exact system subscriptions and grants', async () => {
    const initialized = await createInitializedEventRegistry(db, {
      now: () => 1_000,
      installedHandlers: [
        'system.provenance-ledger',
        'system.agent-provenance-ledger',
        'system.agent-resource-observer',
        'system.resource-render-projection',
      ],
    });

    expect(initialized.reconciliation.inserted).toHaveLength(SYSTEM_SCHEMA_SEEDS.length);
    expect(initialized.reconciliation.diagnostics).toEqual([]);
    await expect(db('event_schema_registry').count({ count: '*' }).first())
      .resolves.toMatchObject({ count: SYSTEM_SCHEMA_SEEDS.length });
    await expect(db('event_subscription_registry')).resolves.toHaveLength(4);
    await expect(db('event_subscription_grants')).resolves.toHaveLength(13);
    expect(initialized.state.schemas.every((entry) => entry.effective)).toBe(true);
    expect(initialized.state.effectiveSubscriptions).toHaveLength(4);
    expect(initialized.state.effectiveSubscriptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        subscriptionId: PROVENANCE_LEDGER_SUBSCRIPTION_SEED.subscriptionId,
        handlerKey: 'system.provenance-ledger',
        deliveryPolicy: 'required_ack',
      }),
      expect.objectContaining({
        subscriptionId: RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_SEED.subscriptionId,
        handlerKey: 'system.resource-render-projection',
        deliveryPolicy: 'best_effort',
      }),
      expect.objectContaining({
        subscriptionId: AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_SEED.subscriptionId,
        handlerKey: 'system.agent-provenance-ledger',
        deliveryPolicy: 'required_ack',
      }),
      expect.objectContaining({
        subscriptionId: AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_SEED.subscriptionId,
        handlerKey: 'system.agent-resource-observer',
        deliveryPolicy: 'required_ack',
      }),
    ]));
  });

  test('catalog has stable IDs, semantic identities, canonical bytes, and complete integrity descriptors', () => {
    expect(SYSTEM_SCHEMA_SEEDS.map((seed) => [
      seed.schemaKey, seed.schemaVersion, seed.definitionKind,
    ])).toEqual([
      ['resource.mutated', 1, 'event'],
      ['resource:changed', 1, 'projection'],
      ['resource:changed', 2, 'projection'],
      ['resource:refresh_required', 1, 'projection'],
      ['file.command_accepted', 1, 'event'],
      ['file_save', 1, 'command'],
      ['resource:provenance', 1, 'query'],
      ['file_tree', 1, 'query'],
      ['file_content', 1, 'query'],
      ['agent.tool_completed', 1, 'event'],
      ['resource.state_observed', 1, 'event'],
      ['agent:activity', 1, 'query'],
    ]);
    expect(new Set(SYSTEM_SCHEMA_SEEDS.map((seed) => seed.schemaId)))
      .toHaveProperty('size', SYSTEM_SCHEMA_SEEDS.length);

    const integrity = createSystemSchemaIntegrityCatalog();
    for (const seed of SYSTEM_SCHEMA_SEEDS) {
      expect(seed.definitionJson).toBe(canonicalizeJson(seed.definition));
      expect(seed.definitionSha256).toBe(sha256CanonicalJson(seed.definition));
      expect(integrity.get(seed.schemaId)).toEqual({
        checksum: seed.definitionSha256,
        schemaKey: seed.schemaKey,
        schemaVersion: seed.schemaVersion,
        definitionKind: seed.definitionKind,
        ownerId: 'fusion-studio',
      });
    }
    const subscriptionIntegrity = createSystemSubscriptionIntegrityCatalog();
    expect(subscriptionIntegrity.size).toBe(SYSTEM_SUBSCRIPTION_SEEDS.length);
    for (const subscriptionSeed of SYSTEM_SUBSCRIPTION_SEEDS) {
      expect(subscriptionIntegrity.get(subscriptionSeed.subscriptionId)).toEqual({
        checksum: subscriptionSeed.definitionSha256,
        ownerId: 'fusion-studio',
        envelope: subscriptionSeed.envelope,
      });
    }
    expect(RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_SEED.envelope).toMatchObject({
      handlerKey: 'system.resource-render-projection',
      deliveryPolicy: 'best_effort',
      filter: { eventTypes: [{ eventType: 'resource.mutated', schemaVersion: 1 }] },
    });
    expect(RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_SEED.grants).toHaveLength(4);
    expect(AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_SEED.grants).toHaveLength(3);
    expect(AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_SEED.grants).toHaveLength(3);
  });

  test('rerun is idempotent and preserves matching lifecycle state and timestamps', async () => {
    await createInitializedEventRegistry(db, { now: () => 1_000 });
    const seed = SYSTEM_SCHEMA_SEEDS[0];
    await db('event_schema_registry').where({ schema_id: seed.schemaId }).update({
      status: 'disabled',
      updated_at: 1_100,
    });

    const rerun = await createInitializedEventRegistry(db, { now: () => 2_000 });
    const row = await db('event_schema_registry').where({ schema_id: seed.schemaId }).first();
    expect(rerun.reconciliation.inserted).toEqual([]);
    expect(rerun.reconciliation.preserved).toHaveLength(SYSTEM_SCHEMA_SEEDS.length);
    expect(row).toMatchObject({ status: 'disabled', created_at: 1_000, updated_at: 1_100 });
    expect(rerun.state.schemas.find((entry) => entry.row.schema_id === seed.schemaId))
      .toMatchObject({ effective: false, diagnostics: ['schema_status_disabled'] });
  });

  test('locked ledger definition drift and grant removal are preserved and fail closed', async () => {
    await createInitializedEventRegistry(db, {
      now: () => 1_000,
      installedHandlers: ['system.provenance-ledger'],
    });
    const seed = PROVENANCE_LEDGER_SUBSCRIPTION_SEED;
    await db('event_subscription_registry').where({ subscription_id: seed.subscriptionId }).update({
      priority: 999,
      updated_at: 1_100,
    });
    await db('event_subscription_grants').where({
      subscription_id: seed.subscriptionId,
      capability_key: 'fact.consume',
    }).delete();

    const rerun = await createInitializedEventRegistry(db, {
      now: () => 2_000,
      installedHandlers: ['system.provenance-ledger'],
    });
    expect(rerun.reconciliation.subscriptionsInserted).toEqual([]);
    expect(rerun.reconciliation.subscriptionsPreserved).toEqual(
      SYSTEM_SUBSCRIPTION_SEEDS.map((item) => item.subscriptionId),
    );
    await expect(db('event_subscription_grants').where({ subscription_id: seed.subscriptionId }))
      .resolves.toHaveLength(2);
    const state = rerun.state.subscriptions.find((entry) => entry.row.subscription_id === seed.subscriptionId);
    expect(state.effective).toBe(false);
    expect(state.diagnostics).toEqual(expect.arrayContaining([
      'subscription_projection_mismatch',
      'capability_not_granted:fact.consume',
      'fact_consume_not_effective',
    ]));
  });

  test('a subscription collision cannot leak diagnostics into a schema with the same opaque id', async () => {
    const schemaSeed = SYSTEM_SCHEMA_SEEDS[0];
    await db('event_subscription_registry').insert({
      subscription_id: schemaSeed.schemaId,
      owner_kind: 'system',
      owner_id: 'fusion-studio',
      locked: 1,
      status: 'enabled',
      handler_key: PROVENANCE_LEDGER_SUBSCRIPTION_SEED.handlerKey,
      priority: PROVENANCE_LEDGER_SUBSCRIPTION_SEED.priority,
      filter_json: PROVENANCE_LEDGER_SUBSCRIPTION_SEED.filterJson,
      requested_capabilities_json: PROVENANCE_LEDGER_SUBSCRIPTION_SEED.requestedCapabilitiesJson,
      definition_json: PROVENANCE_LEDGER_SUBSCRIPTION_SEED.definitionJson,
      definition_sha256: PROVENANCE_LEDGER_SUBSCRIPTION_SEED.definitionSha256,
      delivery_policy: PROVENANCE_LEDGER_SUBSCRIPTION_SEED.deliveryPolicy,
      created_at: 10,
      updated_at: 10,
    });

    const initialized = await createInitializedEventRegistry(db, {
      now: () => 1_000,
      installedHandlers: ['system.provenance-ledger'],
    });
    expect(initialized.reconciliation.diagnostics).toContainEqual({
      kind: 'subscription', id: schemaSeed.schemaId, code: 'subscription_seed_handler_collision',
    });
    expect(initialized.state.schemas.find((entry) => entry.row.schema_id === schemaSeed.schemaId))
      .toMatchObject({ effective: true, diagnostics: [] });
    expect(initialized.state.effectiveSubscriptions).toEqual([]);
  });

  test('mutated locked row stays byte-for-byte persisted and only that row becomes inactive', async () => {
    await createInitializedEventRegistry(db, { now: () => 1_000 });
    const seed = SYSTEM_SCHEMA_SEEDS[0];
    const mutatedDefinition = canonicalizeJson({ type: 'object', additionalProperties: true });
    const mutatedChecksum = sha256CanonicalJson({ type: 'object', additionalProperties: true });
    await db('event_schema_registry').where({ schema_id: seed.schemaId }).update({
      definition_json: mutatedDefinition,
      definition_sha256: mutatedChecksum,
      owner_id: 'mutated-owner',
      updated_at: 1_500,
    });

    const initialized = await createInitializedEventRegistry(db, { now: () => 2_000 });
    const persisted = await db('event_schema_registry').where({ schema_id: seed.schemaId }).first();
    expect(persisted).toMatchObject({
      definition_json: mutatedDefinition,
      definition_sha256: mutatedChecksum,
      owner_id: 'mutated-owner',
      status: 'enabled',
      updated_at: 1_500,
    });
    const affected = initialized.state.schemas.find((entry) => entry.row.schema_id === seed.schemaId);
    expect(affected.effective).toBe(false);
    expect(affected.diagnostics).toContain('schema_locked_integrity_mismatch');
    expect(initialized.state.schemas.filter((entry) => entry.effective))
      .toHaveLength(SYSTEM_SCHEMA_SEEDS.length - 1);
  });

  test('unknown malformed locked row is diagnosed without aborting valid seed activation', async () => {
    const malformed = { type: 'object', unknownKeyword: true };
    await db('event_schema_registry').insert(unknownSchemaRow({
      definition_json: canonicalizeJson(malformed),
      definition_sha256: sha256CanonicalJson(malformed),
    }));

    const initialized = await createInitializedEventRegistry(db, { now: () => 1_000 });
    expect(initialized.state.schemas).toHaveLength(SYSTEM_SCHEMA_SEEDS.length + 1);
    expect(initialized.state.schemas.filter((entry) => entry.effective))
      .toHaveLength(SYSTEM_SCHEMA_SEEDS.length);
    const unknown = initialized.state.schemas.find((entry) => entry.row.schema_id === 'unknown-system-schema');
    expect(unknown.effective).toBe(false);
    expect(unknown.diagnostics).toEqual(expect.arrayContaining([
      'schema_definition_invalid',
      'schema_locked_integrity_mismatch',
    ]));
    await expect(db('event_schema_registry').where({ schema_id: 'unknown-system-schema' }).first())
      .resolves.toMatchObject({ status: 'enabled', updated_at: 10 });
  });

  test('semantic-key collision is preserved, diagnosed, and cannot impersonate the locked seed', async () => {
    const seed = SYSTEM_SCHEMA_SEEDS[0];
    await db('event_schema_registry').insert(unknownSchemaRow({
      schema_id: 'extension-collision',
      schema_key: seed.schemaKey,
      schema_version: seed.schemaVersion,
      definition_kind: seed.definitionKind,
      owner_kind: 'extension',
      owner_id: 'extension.example',
      locked: 0,
    }));

    const initialized = await createInitializedEventRegistry(db, { now: () => 1_000 });
    expect(initialized.reconciliation.inserted).toHaveLength(SYSTEM_SCHEMA_SEEDS.length - 1);
    expect(initialized.reconciliation.diagnostics).toEqual([{
      kind: 'schema', id: 'extension-collision', code: 'schema_seed_semantic_collision',
    }]);
    const collision = initialized.state.schemas.find((entry) => entry.row.schema_id === 'extension-collision');
    expect(collision.effective).toBe(false);
    expect(collision.diagnostics).toContain('schema_seed_semantic_collision');
    await expect(db('event_schema_registry').where({ schema_id: seed.schemaId }).first())
      .resolves.toBeUndefined();
  });

  test('stable-ID collision is preserved and does not suppress unrelated seeds', async () => {
    const seed = SYSTEM_SCHEMA_SEEDS[0];
    await db('event_schema_registry').insert(unknownSchemaRow({
      schema_id: seed.schemaId,
      schema_key: 'collision.event',
    }));

    const initialized = await createInitializedEventRegistry(db, { now: () => 1_000 });
    expect(initialized.reconciliation.inserted).toHaveLength(SYSTEM_SCHEMA_SEEDS.length - 1);
    expect(initialized.reconciliation.diagnostics).toEqual([{
      kind: 'schema', id: seed.schemaId, code: 'schema_seed_id_collision',
    }]);
    const collision = initialized.state.schemas.find((entry) => entry.row.schema_id === seed.schemaId);
    expect(collision.effective).toBe(false);
    expect(collision.diagnostics).toEqual(expect.arrayContaining([
      'schema_locked_integrity_mismatch',
      'schema_seed_id_collision',
    ]));
    expect(initialized.state.schemas.filter((entry) => entry.effective))
      .toHaveLength(SYSTEM_SCHEMA_SEEDS.length - 1);
  });

  test('simultaneous stable-ID and semantic-key collisions both fail closed', async () => {
    const seed = SYSTEM_SCHEMA_SEEDS[0];
    await db('event_schema_registry').insert(unknownSchemaRow({
      schema_id: seed.schemaId,
      schema_key: 'collision.event',
    }));
    await db('event_schema_registry').insert(unknownSchemaRow({
      schema_id: 'semantic-impostor',
      schema_key: seed.schemaKey,
      schema_version: seed.schemaVersion,
      definition_kind: seed.definitionKind,
      owner_kind: 'extension',
      owner_id: 'extension.example',
      locked: 0,
      definition_json: '{}',
      definition_sha256: sha256CanonicalJson({}),
    }));

    const initialized = await createInitializedEventRegistry(db, { now: () => 1_000 });
    expect(initialized.reconciliation.inserted).toHaveLength(SYSTEM_SCHEMA_SEEDS.length - 1);
    expect(initialized.reconciliation.diagnostics).toEqual([
      { kind: 'schema', id: seed.schemaId, code: 'schema_seed_id_collision' },
      { kind: 'schema', id: 'semantic-impostor', code: 'schema_seed_semantic_collision' },
    ]);
    const byId = initialized.state.schemas.find((entry) => entry.row.schema_id === seed.schemaId);
    const bySemantic = initialized.state.schemas.find(
      (entry) => entry.row.schema_id === 'semantic-impostor',
    );
    expect(byId.effective).toBe(false);
    expect(bySemantic.effective).toBe(false);
    expect(byId.diagnostics).toContain('schema_seed_id_collision');
    expect(bySemantic.diagnostics).toContain('schema_seed_semantic_collision');
    await expect(initialized.access.validatePayload({
      schemaKey: seed.schemaKey,
      schemaVersion: seed.schemaVersion,
      definitionKind: seed.definitionKind,
    }, {})).resolves.toEqual({
      valid: false,
      errors: [{ instancePath: '', keyword: 'registry', code: 'schema_inactive' }],
    });
  });

  test('reconstructs the same registry after a file-backed database restart', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-registry-restart-'));
    const filename = path.join(tempRoot, 'registry.sqlite');
    await db.destroy();
    db = createDb(filename);
    await migration.up(db);
    const first = await createInitializedEventRegistry(db, { now: () => 1_000 });
    const firstRows = await first.access.listSchemas();
    await db.destroy();

    db = createDb(filename);
    const second = await createInitializedEventRegistry(db, { now: () => 2_000 });
    expect(await second.access.listSchemas()).toEqual(firstRows);
    expect(second.reconciliation.inserted).toEqual([]);
    expect(second.state.schemas.every((entry) => entry.effective)).toBe(true);
    await db.destroy();
    db = null;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('does not discover project schema files and exposes only narrow read/validate access', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-registry-project-'));
    fs.writeFileSync(path.join(projectRoot, 'event-schema.json'), JSON.stringify({
      schemaKey: 'project.injection', status: 'enabled',
    }));
    const previousCwd = process.cwd();
    process.chdir(projectRoot);
    try {
      const initialized = await createInitializedEventRegistry(db, { now: () => 1_000 });
      expect(await initialized.access.listSchemas()).toHaveLength(SYSTEM_SCHEMA_SEEDS.length);
      expect(Object.keys(initialized.access).sort()).toEqual([
        'getEffectiveState', 'listSchemas', 'listSubscriptions', 'validatePayload',
      ]);
      expect(initialized.access.knex).toBeUndefined();
      expect(initialized.access.createSystemSchema).toBeUndefined();
      expect(initialized.access.grantCapability).toBeUndefined();
    } finally {
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
