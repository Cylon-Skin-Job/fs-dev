'use strict';

const initialMigration = require('../../lib/db/migrations/001_initial');
const ledgerMigration = require('../../lib/db/migrations/029_event_ledger');
const registryMigration = require('../../lib/db/migrations/034_event_registry_authority');
const provenanceMigration = require('../../lib/db/migrations/035_file_provenance');
const agentToolProvenanceMigration = require('../../lib/db/migrations/036_agent_tool_provenance');
const reportedUiContextMigration = require('../../lib/db/migrations/040_reported_ui_context');
const { canonicalizeJson, sha256CanonicalJson } = require('../../lib/event-registry/canonical-json');
const { createInitializedEventRegistry } = require('../../lib/event-registry');
const { SYSTEM_SCHEMA_SEEDS } = require('../../lib/event-registry/seed-catalog');
const { createDb } = require('../resources/test-db');

const UUID = '123e4567-e89b-42d3-a456-426614174000';
const UUID_2 = '123e4567-e89b-42d3-a456-426614174001';
const UUID_3 = '123e4567-e89b-42d3-a456-426614174002';
const UUID_4 = '123e4567-e89b-42d3-a456-426614174003';
const EXTENDED_CONTEXT = Object.freeze({
  workspaceId: 'workspace-1',
  viewId: 'file-viewer',
  viewInstanceId: 'mount-1',
  tabId: 'tab-1',
  componentTypeId: 'file-viewer',
  componentInstanceId: 'component-1',
  presenterId: 'markdown',
  targetKey: 'docs/note.md',
});

async function migrateTo039(db) {
  await initialMigration.up(db);
  await ledgerMigration.up(db);
  await registryMigration.up(db);
  await provenanceMigration.up(db);
  await agentToolProvenanceMigration.up(db);
}

/** A faithful pre-change definition: the extended context fields did not exist. */
function previousDefinition(seed) {
  const clone = JSON.parse(JSON.stringify(seed.definition));
  const context = clone.$defs?.reportedUiContext;
  if (context?.properties) {
    for (const key of [
      'workspaceId', 'tabId', 'componentTypeId', 'componentInstanceId', 'presenterId', 'targetKey',
    ]) delete context.properties[key];
  }
  if (clone.$defs?.boundedTargetKey) delete clone.$defs.boundedTargetKey;
  return clone;
}

async function seedPreviousSchemaRows(db) {
  for (const seed of SYSTEM_SCHEMA_SEEDS.filter(
    (candidate) => reportedUiContextMigration.AFFECTED_SCHEMA_IDS.includes(candidate.schemaId),
  )) {
    const definition = previousDefinition(seed);
    await db('event_schema_registry').insert({
      schema_id: seed.schemaId,
      schema_key: seed.schemaKey,
      schema_version: seed.schemaVersion,
      definition_kind: seed.definitionKind,
      owner_kind: 'system',
      owner_id: seed.ownerId,
      locked: 1,
      status: 'enabled',
      definition_json: canonicalizeJson(definition),
      definition_sha256: sha256CanonicalJson(definition),
      created_at: 10,
      updated_at: 10,
    });
  }
}

function resourceMutated() {
  return {
    eventId: UUID,
    eventType: 'resource.mutated',
    schemaVersion: 1,
    occurredAt: 1,
    workspaceId: 'workspace-1',
    operationId: UUID_2,
    commandId: UUID_3,
    commandAcceptedEventId: UUID_4,
    origin: {
      kind: 'local_client',
      connectionId: 'connection-1',
      assurance: 'transport_only',
      reportedUiContext: { ...EXTENDED_CONTEXT },
    },
    resource: {
      resourceId: UUID_4,
      kind: 'file',
      path: 'docs/note.md',
      access: { panel: 'file-viewer', path: 'docs/note.md' },
    },
    mutation: { kind: 'modify', saveReason: 'manual' },
    fileVersionId: UUID_4,
  };
}

describe('migration 040 reported UI context refresh', () => {
  let db;

  afterEach(async () => {
    if (db) await db.destroy();
    db = null;
  });

  test('upgrades previous locked definition bytes so the extended schema is effective', async () => {
    db = createDb();
    await migrateTo039(db);
    await seedPreviousSchemaRows(db);

    const before = await createInitializedEventRegistry(db, { now: () => 1_000 });
    for (const schemaId of reportedUiContextMigration.AFFECTED_SCHEMA_IDS) {
      expect(before.state.schemas.find((entry) => entry.row.schema_id === schemaId).effective).toBe(false);
    }

    await reportedUiContextMigration.up(db);
    expect(await db.schema.hasColumn('file_operations', 'reported_tab_id')).toBe(true);
    expect(await db.schema.hasColumn('file_operations', 'reported_target_key')).toBe(true);
    expect(await db.schema.hasColumn('resource_provenance_events', 'reported_view_id')).toBe(true);
    expect(await db.schema.hasColumn('resource_provenance_events', 'reported_tab_id')).toBe(true);

    const initialized = await createInitializedEventRegistry(db, { now: () => 1_000 });
    for (const schemaId of reportedUiContextMigration.AFFECTED_SCHEMA_IDS) {
      const entry = initialized.state.schemas.find((schema) => schema.row.schema_id === schemaId);
      expect(entry.effective).toBe(true);
      const seed = SYSTEM_SCHEMA_SEEDS.find((candidate) => candidate.schemaId === schemaId);
      expect(entry.row.definition_sha256).toBe(seed.definitionSha256);
      expect(entry.row.definition_json).toBe(seed.definitionJson);
    }

    const mutated = await initialized.access.validatePayload(
      { schemaKey: 'resource.mutated', schemaVersion: 1, definitionKind: 'event' },
      resourceMutated(),
    );
    expect(mutated).toMatchObject({ valid: true, errors: [] });

    const save = await initialized.access.validatePayload(
      { schemaKey: 'file_save', schemaVersion: 1, definitionKind: 'command' },
      {
        type: 'file_save', version: 1, requestId: 'request-1', workspaceId: 'workspace-1',
        workspaceEpoch: UUID, panel: 'file-viewer', path: 'docs/note.md', content: 'text',
        reason: 'manual', reportedUiContext: { ...EXTENDED_CONTEXT },
      },
    );
    expect(save).toMatchObject({ valid: true, errors: [] });

    const query = await initialized.access.validatePayload(
      { schemaKey: 'resource:provenance', schemaVersion: 1, definitionKind: 'query' },
      {
        type: 'resource:provenance:query', version: 1, requestId: 'request-1',
        workspaceId: 'workspace-1', workspaceEpoch: UUID,
        tabId: 'tab-1', targetKey: 'docs/note.md',
      },
    );
    expect(query).toMatchObject({ valid: true, errors: [] });
  });

  test('is a no-op on a fresh database whose registry rows do not exist yet', async () => {
    db = createDb();
    await migrateTo039(db);
    await reportedUiContextMigration.up(db);
    await expect(db('event_schema_registry')).resolves.toEqual([]);
    const initialized = await createInitializedEventRegistry(db, { now: () => 1_000 });
    expect(initialized.reconciliation.inserted).toHaveLength(SYSTEM_SCHEMA_SEEDS.length);
    expect(initialized.state.schemas.every((entry) => entry.effective)).toBe(true);
  });
});
