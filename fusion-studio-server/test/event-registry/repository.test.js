'use strict';

const knex = require('knex');
const migration = require('../../lib/db/migrations/034_event_registry_authority');
const { canonicalizeJson, sha256CanonicalJson } = require('../../lib/event-registry/canonical-json');
const {
  RegistryAuthorizationError,
  RegistryConflictError,
  createRegistryRepository,
} = require('../../lib/event-registry/repository');
const {
  createTestOnlyAuthorizedRegistry,
} = require('./fixtures/test-only-authorized-repository');

const EVENT_TYPES = [{ eventType: 'resource.mutated', schemaVersion: 1 }];
const FACT_CONSUME = {
  capabilityKey: 'fact.consume',
  scope: { eventTypes: EVENT_TYPES },
};
const FILTER = {
  eventTypes: EVENT_TYPES,
  resource: { operations: ['create', 'modify'], kinds: ['file'] },
};
const RESOURCE_SCHEMA_REFERENCE = {
  schemaKey: 'resource.mutated',
  schemaVersion: 1,
  definitionKind: 'event',
};

function createDb() {
  return knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
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

function pendingInput(overrides = {}) {
  return {
    subscriptionId: 'extension-subscription',
    ownerId: 'extension.example',
    ownerKind: 'system',
    locked: true,
    status: 'enabled',
    grantState: 'granted',
    handlerKey: 'system.provenance-ledger',
    priority: -100,
    filter: FILTER,
    requestedCapabilities: [FACT_CONSUME],
    deliveryPolicy: 'required_ack',
    schemaReferences: [RESOURCE_SCHEMA_REFERENCE],
    ...overrides,
  };
}

describe('event registry repository authority and effective state', () => {
  let db;
  let clock;

  beforeEach(async () => {
    db = createDb();
    await migration.up(db);
    clock = 1_000;
  });

  afterEach(async () => {
    await db.destroy();
  });

  test('forces extension definitions pending/unlocked and never turns requests into grants', async () => {
    const repository = createRegistryRepository(db, { now: () => clock });
    const schema = await repository.createPendingSchema({
      schemaId: 'extension-schema',
      schemaKey: 'extension.event',
      schemaVersion: 1,
      definitionKind: 'event',
      ownerId: 'extension.example',
      ownerKind: 'system',
      locked: true,
      status: 'enabled',
      definition: { type: 'object' },
    });
    const subscription = await repository.createPendingSubscription(pendingInput());

    expect(schema).toMatchObject({ owner_kind: 'extension', locked: 0, status: 'pending' });
    expect(subscription).toMatchObject({
      owner_kind: 'extension',
      locked: 0,
      status: 'pending',
      delivery_policy: 'best_effort',
    });
    expect(JSON.parse(subscription.definition_json)).toMatchObject({
      owner: { kind: 'extension', id: 'extension.example' },
      locked: false,
      deliveryPolicy: 'best_effort',
    });
    await expect(db('event_subscription_grants')).resolves.toEqual([]);
    const quarantinedSchema = await repository.quarantineSchema('extension-schema', {
      expectedUpdatedAt: schema.updated_at,
    });
    await expect(repository.revokeSchema('extension-schema', {
      expectedUpdatedAt: quarantinedSchema.updated_at,
    })).resolves.toMatchObject({ status: 'revoked' });
    const state = await repository.calculateEffectiveState();
    expect(state.effectiveSubscriptions).toEqual([]);
    expect(state.subscriptions[0].diagnostics).toContain('subscription_status_pending');
  });

  test('allows config revoke/narrow/disable but rejects grant/expand/re-enable lookalikes', async () => {
    const fixture = createTestOnlyAuthorizedRegistry(db, {
      now: () => clock,
      installedHandlers: ['system.provenance-ledger'],
    });
    const schema = await fixture.authorized.createSystemSchema({
      schemaId: 'resource-schema',
      schemaKey: 'resource.mutated',
      schemaVersion: 1,
      definitionKind: 'event',
      ownerId: 'fusion-studio',
      definition: { type: 'object' },
    }, fixture.authorization);
    expect(schema.status).toBe('enabled');
    const subscription = await fixture.authorized.createSystemSubscription({
      ...pendingInput({ subscriptionId: 'ledger' }),
      requestedCapabilities: [
        FACT_CONSUME,
        {
          capabilityKey: 'diagnostic.write_fixed',
          scope: { codes: ['ledger_write_failed', 'ledger_duplicate_conflict'] },
        },
      ],
    }, fixture.authorization);

    await expect(fixture.repository.changeSubscriptionRequest('ledger', {
      requestedCapabilities: [
        FACT_CONSUME,
        { capabilityKey: 'diagnostic.write_fixed', scope: { codes: ['ledger_write_failed'] } },
      ],
      filter: {
        ...FILTER,
        resource: { ...FILTER.resource, ingressPanels: ['file-viewer'] },
      },
    }, { expectedUpdatedAt: subscription.updated_at }))
      .rejects.toBeInstanceOf(RegistryAuthorizationError);

    const narrowed = await fixture.repository.getSubscription('ledger');
    await expect(fixture.repository.changeSubscriptionRequest('ledger', {
      requestedCapabilities: [
        FACT_CONSUME,
        {
          capabilityKey: 'diagnostic.write_fixed',
          scope: { codes: ['ledger_write_failed', 'ledger_duplicate_conflict'] },
        },
      ],
    }, { expectedUpdatedAt: narrowed.updated_at, authorization: null }))
      .rejects.toBeInstanceOf(RegistryAuthorizationError);

    const granted = await fixture.authorized.grantCapability(
      'ledger',
      'fact.consume',
      FACT_CONSUME.scope,
      { expectedUpdatedAt: narrowed.updated_at, authorization: fixture.authorization },
    );
    const diagnosticGrant = await fixture.authorized.grantCapability(
      'ledger',
      'diagnostic.write_fixed',
      { codes: ['ledger_write_failed', 'ledger_duplicate_conflict'] },
      { expectedUpdatedAt: narrowed.updated_at, authorization: fixture.authorization },
    );
    await expect(fixture.repository.narrowCapabilityGrant(
      'ledger',
      'diagnostic.write_fixed',
      { codes: ['ledger_write_failed'] },
      { expectedUpdatedAt: diagnosticGrant.updated_at },
    )).resolves.toMatchObject({ scope_json: '{"codes":["ledger_write_failed"]}' });

    const reconstructed = createRegistryRepository(db, {
      now: () => clock,
      installedHandlers: ['system.provenance-ledger'],
      systemSchemaIntegrity: [[schema.schema_id, {
        checksum: schema.definition_sha256,
        schemaKey: schema.schema_key,
        schemaVersion: schema.schema_version,
        definitionKind: schema.definition_kind,
        ownerId: schema.owner_id,
      }]],
      systemSubscriptionIntegrity: [[subscription.subscription_id, {
        checksum: subscription.definition_sha256,
        ownerId: subscription.owner_id,
        envelope: JSON.parse(subscription.definition_json),
      }]],
    });
    const reconstructedState = await reconstructed.calculateEffectiveState();
    expect(reconstructedState.effectiveSubscriptions).toHaveLength(1);
    expect(reconstructedState.effectiveSubscriptions[0].grants).toContainEqual({
      capabilityKey: 'diagnostic.write_fixed',
      scope: { codes: ['ledger_write_failed'] },
    });
    await expect(fixture.repository.revokeCapability('ledger', 'fact.consume', {
      expectedUpdatedAt: granted.updated_at,
    })).resolves.toMatchObject({ state: 'revoked' });

    const disabled = await fixture.repository.disableSubscription('ledger', {
      expectedUpdatedAt: narrowed.updated_at,
    });
    expect(disabled.status).toBe('disabled');
    await expect(fixture.authorized.setStatus('ledger', 'enabled', {
      expectedUpdatedAt: disabled.updated_at,
      authorization: { human: true },
    })).rejects.toBeInstanceOf(RegistryAuthorizationError);
    await expect(fixture.authorized.setStatus('ledger', 'enabled', {
      expectedUpdatedAt: disabled.updated_at,
      authorization: 'human',
    })).rejects.toBeInstanceOf(RegistryAuthorizationError);
    await expect(fixture.authorized.setStatus('ledger', 'enabled', {
      expectedUpdatedAt: disabled.updated_at,
      authorization: Symbol('human'),
    })).rejects.toBeInstanceOf(RegistryAuthorizationError);
    const enabled = await fixture.authorized.setStatus('ledger', 'enabled', {
      expectedUpdatedAt: disabled.updated_at,
      authorization: fixture.authorization,
    });
    expect(enabled.status).toBe('enabled');

    const serialized = JSON.parse(JSON.stringify(fixture.authorization));
    await expect(fixture.authorized.setStatus('ledger', 'enabled', {
      expectedUpdatedAt: enabled.updated_at,
      authorization: serialized,
    })).rejects.toThrow(/Cannot transition|authorization/);
  });

  test('derives deterministic effective system fixtures in priority/id order', async () => {
    const fixture = createTestOnlyAuthorizedRegistry(db, {
      now: () => clock,
      installedHandlers: ['system.provenance-ledger', 'system.resource-render-projection'],
    });
    await fixture.authorized.createSystemSchema({
      schemaId: 'resource-schema',
      schemaKey: 'resource.mutated',
      schemaVersion: 1,
      definitionKind: 'event',
      ownerId: 'fusion-studio',
      definition: { type: 'object' },
    }, fixture.authorization);

    const ledger = await fixture.authorized.createSystemSubscription({
      ...pendingInput({ subscriptionId: 'ledger', priority: -100 }),
      requestedCapabilities: [FACT_CONSUME],
    }, fixture.authorization);
    const renderer = await fixture.authorized.createSystemSubscription({
      ...pendingInput({
        subscriptionId: 'renderer',
        handlerKey: 'system.resource-render-projection',
        priority: 0,
        deliveryPolicy: 'best_effort',
      }),
      requestedCapabilities: [FACT_CONSUME],
    }, fixture.authorization);
    for (const subscription of [ledger, renderer]) {
      await fixture.authorized.grantCapability(
        subscription.subscription_id,
        'fact.consume',
        FACT_CONSUME.scope,
        { expectedUpdatedAt: subscription.updated_at, authorization: fixture.authorization },
      );
    }

    const state = await fixture.repository.calculateEffectiveState();
    expect(state.effectiveSubscriptions.map((entry) => [entry.subscriptionId, entry.priority]))
      .toEqual([['ledger', -100], ['renderer', 0]]);
    expect(state.effectiveSubscriptions[0].grants).toEqual([FACT_CONSUME]);
  });

  test('uses the narrowed request scope as effective authority under a broader grant', async () => {
    const fixture = createTestOnlyAuthorizedRegistry(db, {
      now: () => clock,
      installedHandlers: ['system.provenance-ledger'],
    });
    const schema = await fixture.repository.createPendingSchema({
      schemaId: 'resource-schema', schemaKey: 'resource.mutated', schemaVersion: 1,
      definitionKind: 'event', ownerId: 'extension.example', definition: { type: 'object' },
    });
    await fixture.authorized.setSchemaStatus('resource-schema', 'enabled', {
      expectedUpdatedAt: schema.updated_at,
      authorization: fixture.authorization,
    });
    const broadDiagnostic = {
      capabilityKey: 'diagnostic.write_fixed',
      scope: { codes: ['ledger_write_failed', 'ledger_duplicate_conflict'] },
    };
    const row = await fixture.repository.createPendingSubscription({
      ...pendingInput({ subscriptionId: 'ledger', deliveryPolicy: 'best_effort' }),
      requestedCapabilities: [FACT_CONSUME, broadDiagnostic],
    });
    await fixture.authorized.grantCapability('ledger', 'fact.consume', FACT_CONSUME.scope, {
      expectedUpdatedAt: row.updated_at,
      authorization: fixture.authorization,
    });
    await fixture.authorized.grantCapability(
      'ledger',
      'diagnostic.write_fixed',
      broadDiagnostic.scope,
      { expectedUpdatedAt: row.updated_at, authorization: fixture.authorization },
    );
    const enabled = await fixture.authorized.setStatus('ledger', 'enabled', {
      expectedUpdatedAt: row.updated_at,
      authorization: fixture.authorization,
    });
    await fixture.repository.changeSubscriptionRequest('ledger', {
      requestedCapabilities: [
        FACT_CONSUME,
        { capabilityKey: 'diagnostic.write_fixed', scope: { codes: ['ledger_write_failed'] } },
      ],
    }, { expectedUpdatedAt: enabled.updated_at });

    const state = await fixture.repository.calculateEffectiveState();
    expect(state.effectiveSubscriptions).toHaveLength(1);
    expect(state.effectiveSubscriptions[0].grants).toContainEqual({
      capabilityKey: 'diagnostic.write_fixed',
      scope: { codes: ['ledger_write_failed'] },
    });
    const narrowedRow = await fixture.repository.getSubscription('ledger');
    await fixture.repository.changeSubscriptionRequest('ledger', {
      requestedCapabilities: [FACT_CONSUME],
    }, { expectedUpdatedAt: narrowedRow.updated_at });
    const removedState = await fixture.repository.calculateEffectiveState();
    expect(removedState.effectiveSubscriptions).toHaveLength(1);
    expect(removedState.effectiveSubscriptions[0].grants).toEqual([FACT_CONSUME]);
    expect(removedState.subscriptions[0].diagnostics)
      .toContain('grant_not_requested:diagnostic.write_fixed');
    const removedRow = await fixture.repository.getSubscription('ledger');
    const expandedRequests = [FACT_CONSUME, broadDiagnostic];
    await expect(fixture.repository.changeSubscriptionRequest('ledger', {
      requestedCapabilities: expandedRequests,
    }, { expectedUpdatedAt: removedRow.updated_at, authorization: { human: true } }))
      .rejects.toBeInstanceOf(RegistryAuthorizationError);
    await expect(fixture.authorized.changeSubscriptionRequest('ledger', {
      requestedCapabilities: expandedRequests,
    }, { expectedUpdatedAt: removedRow.updated_at, authorization: fixture.authorization }))
      .resolves.toMatchObject({ subscription_id: 'ledger' });
  });

  test('fails closed per row on handler/schema/checksum/projection/JSON storage drift without lifecycle rewrites', async () => {
    const fixture = createTestOnlyAuthorizedRegistry(db, {
      now: () => clock,
      installedHandlers: ['system.provenance-ledger'],
    });
    await fixture.authorized.createSystemSchema({
      schemaId: 'resource-schema', schemaKey: 'resource.mutated', schemaVersion: 1,
      definitionKind: 'event', ownerId: 'fusion-studio', definition: { type: 'object' },
    }, fixture.authorization);
    await fixture.authorized.createSystemSchema({
      schemaId: 'downgraded-schema', schemaKey: 'downgraded.event', schemaVersion: 1,
      definitionKind: 'event', ownerId: 'fusion-studio', definition: { type: 'object' },
    }, fixture.authorization);
    await db('event_schema_registry').where({ schema_id: 'downgraded-schema' })
      .update({
        schema_key: 'file.command_accepted',
        schema_version: 7,
        definition_kind: 'command',
        owner_kind: 'extension',
        owner_id: 'moved.owner',
        locked: 0,
      });
    const ids = [
      'valid', 'unknown-handler', 'unknown-schema', 'unknown-capability',
      'checksum', 'projection', 'blob', 'ownership-downgrade',
    ];
    for (const id of ids) {
      const row = await fixture.authorized.createSystemSubscription({
        ...pendingInput({ subscriptionId: id }),
        handlerKey: id === 'unknown-handler' ? 'system.not-installed' : 'system.provenance-ledger',
        deliveryPolicy: id === 'unknown-handler' ? 'best_effort' : 'required_ack',
        schemaReferences: id === 'unknown-schema'
          ? [{ ...RESOURCE_SCHEMA_REFERENCE, schemaKey: 'missing.event' }]
          : [RESOURCE_SCHEMA_REFERENCE],
        requestedCapabilities: [FACT_CONSUME],
      }, fixture.authorization);
      await fixture.authorized.grantCapability(id, 'fact.consume', FACT_CONSUME.scope, {
        expectedUpdatedAt: row.updated_at,
        authorization: fixture.authorization,
      });
    }
    await db('event_subscription_registry').where({ subscription_id: 'checksum' })
      .update({ definition_sha256: 'b'.repeat(64) });
    await db('event_subscription_registry').where({ subscription_id: 'projection' })
      .update({ priority: 7 });
    const downgraded = await db('event_subscription_registry')
      .where({ subscription_id: 'ownership-downgrade' }).first();
    const downgradedEnvelope = {
      ...JSON.parse(downgraded.definition_json),
      owner: { kind: 'extension', id: downgraded.owner_id },
      locked: false,
      deliveryPolicy: 'best_effort',
      filter: { eventTypes: EVENT_TYPES },
    };
    await db('event_subscription_registry').where({ subscription_id: 'ownership-downgrade' })
      .update({
        owner_kind: 'extension',
        locked: 0,
        delivery_policy: 'best_effort',
        filter_json: canonicalizeJson(downgradedEnvelope.filter),
        definition_json: canonicalizeJson(downgradedEnvelope),
        definition_sha256: sha256CanonicalJson(downgradedEnvelope),
      });
    await db('event_subscription_grants').insert({
      subscription_id: 'unknown-capability',
      capability_key: 'arbitrary.execute',
      state: 'granted',
      scope_json: '{}',
      authorized_by_kind: 'human',
      authorized_at: clock,
      created_at: clock,
      updated_at: clock,
    });
    const blobText = await db('event_subscription_registry')
      .where({ subscription_id: 'blob' }).first('definition_json');
    await db.raw(
      'UPDATE event_subscription_registry SET definition_json = CAST(? AS BLOB) WHERE subscription_id = ?',
      [blobText.definition_json, 'blob'],
    );

    const state = await fixture.repository.calculateEffectiveState();
    expect(state.effectiveSubscriptions.map((entry) => entry.subscriptionId))
      .toEqual(['unknown-capability', 'valid']);
    const byId = new Map(state.subscriptions.map((entry) => [entry.row.subscription_id, entry]));
    expect(byId.get('unknown-handler').diagnostics).toContain('handler_not_installed');
    expect(byId.get('unknown-schema').diagnostics).toContain('referenced_schema_inactive');
    expect(byId.get('unknown-capability').diagnostics).toEqual(expect.arrayContaining([
      'grant_scope_invalid:arbitrary.execute',
      'grant_not_requested:arbitrary.execute',
    ]));
    expect(byId.get('checksum').diagnostics).toEqual(expect.arrayContaining([
      'subscription_checksum_mismatch', 'subscription_locked_integrity_mismatch',
    ]));
    expect(byId.get('projection').diagnostics).toContain('subscription_projection_mismatch');
    expect(byId.get('blob').diagnostics).toContain('subscription_definition_invalid');
    expect(byId.get('ownership-downgrade').diagnostics)
      .toContain('subscription_locked_integrity_mismatch');
    const schemaById = new Map(state.schemas.map((entry) => [entry.row.schema_id, entry]));
    expect(schemaById.get('downgraded-schema').diagnostics)
      .toContain('schema_locked_integrity_mismatch');
    expect(await db('event_subscription_registry').orderBy('subscription_id').pluck('status'))
      .toEqual(Array(ids.length).fill('enabled'));
  });

  test('rejects stale compare-and-swap updates and advances updated_at monotonically', async () => {
    const fixture = createTestOnlyAuthorizedRegistry(db, {
      now: () => clock,
      installedHandlers: ['system.provenance-ledger'],
    });
    const row = await fixture.authorized.createSystemSubscription({
      ...pendingInput({ subscriptionId: 'ledger' }),
      requestedCapabilities: [FACT_CONSUME],
    }, fixture.authorization);
    const first = await fixture.repository.quarantineSubscription('ledger', {
      expectedUpdatedAt: row.updated_at,
    });
    expect(first.updated_at).toBe(row.updated_at + 1);
    await expect(fixture.repository.revokeSubscription('ledger', {
      expectedUpdatedAt: row.updated_at,
    })).rejects.toBeInstanceOf(RegistryConflictError);
    expect((await fixture.repository.getSubscription('ledger')).status).toBe('quarantined');
  });

  test('does not discover definitions from the filesystem', async () => {
    const source = require('fs').readFileSync(
      require.resolve('../../lib/event-registry/repository'),
      'utf8',
    );
    expect(source).not.toMatch(/require\(['"](?:fs|chokidar)['"]\)/);
    const repository = createRegistryRepository(db, { now: () => clock });
    await expect(repository.listSubscriptions()).resolves.toEqual([]);
    expect(repository).not.toHaveProperty('knex');
    expect(repository).not.toHaveProperty('execute');
    expect(repository).not.toHaveProperty('emit');
    expect(repository).not.toHaveProperty('grantCapability');
  });

  test('does not export the authorization fixture outside the test environment', () => {
    const prior = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      const productionExports = require('../../lib/event-registry/repository');
      expect(productionExports).not.toHaveProperty('createTestOnlyAuthorizedRegistry');
      expect(productionExports).not.toHaveProperty('authorization');
    } finally {
      process.env.NODE_ENV = prior;
      jest.resetModules();
    }
  });

  test('treats noncanonical and duplicate-key stored JSON as row-local corruption', async () => {
    const fixture = createTestOnlyAuthorizedRegistry(db, {
      now: () => clock,
      installedHandlers: ['system.provenance-ledger'],
    });
    await fixture.authorized.createSystemSchema({
      schemaId: 'resource-schema', schemaKey: 'resource.mutated', schemaVersion: 1,
      definitionKind: 'event', ownerId: 'fusion-studio', definition: { type: 'object' },
    }, fixture.authorization);
    const row = await fixture.authorized.createSystemSubscription({
      ...pendingInput({ subscriptionId: 'noncanonical' }), requestedCapabilities: [FACT_CONSUME],
    }, fixture.authorization);
    await fixture.authorized.grantCapability('noncanonical', 'fact.consume', FACT_CONSUME.scope, {
      expectedUpdatedAt: row.updated_at,
      authorization: fixture.authorization,
    });
    const parsed = JSON.parse(row.definition_json);
    const spaced = JSON.stringify(parsed, null, 2);
    await db('event_subscription_registry').where({ subscription_id: 'noncanonical' })
      .update({ definition_json: spaced, definition_sha256: sha256CanonicalJson(parsed) });
    let state = await fixture.repository.calculateEffectiveState();
    expect(state.subscriptions[0].diagnostics).toContain('subscription_definition_invalid');

    // SQLite accepts duplicate JSON object keys, but the strict canonical parser does not.
    const duplicate = `{"handlerKey":"system.provenance-ledger","handlerKey":"system.provenance-ledger"}`;
    await db('event_subscription_registry').where({ subscription_id: 'noncanonical' })
      .update({ definition_json: duplicate, definition_sha256: sha256CanonicalJson({}) });
    state = await fixture.repository.calculateEffectiveState();
    expect(state.subscriptions[0].diagnostics).toContain('subscription_definition_invalid');
    expect((await fixture.repository.getSubscription('noncanonical')).status).toBe('enabled');
  });
});
