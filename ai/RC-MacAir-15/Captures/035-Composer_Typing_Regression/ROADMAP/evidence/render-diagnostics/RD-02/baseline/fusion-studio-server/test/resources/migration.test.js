'use strict';

const ledgerMigration = require('../../lib/db/migrations/029_event_ledger');
const registryMigration = require('../../lib/db/migrations/034_event_registry_authority');
const provenanceMigration = require('../../lib/db/migrations/035_file_provenance');
const initialMigration = require('../../lib/db/migrations/001_initial');
const { createDb } = require('./test-db');

describe('migration 035 file provenance', () => {
  let db;

  afterEach(async () => {
    if (db) await db.destroy();
    db = null;
  });

  test('applies after 029/034, preserves legacy rows, and rolls back only its tables', async () => {
    db = createDb();
    await initialMigration.up(db);
    await ledgerMigration.up(db);
    await db('event_log').insert({
      event_id: 'legacy-event', event_type: 'file:changed', actor_type: 'system',
      occurred_at: 10, summary: 'legacy', payload_json: '{}', created_at: 11,
    });
    await db('event_resource_edges').insert({
      event_id: 'legacy-event', resource_type: 'file', path: 'old.md', role: 'subject',
    });
    await db('event_tags').insert({ event_id: 'legacy-event', tag: 'legacy' });
    await registryMigration.up(db);
    await provenanceMigration.up(db);

    await expect(db('event_log').where({ event_id: 'legacy-event' }).first())
      .resolves.toMatchObject({ summary: 'legacy' });
    await expect(db('event_resource_edges').where({ event_id: 'legacy-event' }).first())
      .resolves.toMatchObject({ path: 'old.md' });
    await expect(db('event_tags').where({ event_id: 'legacy-event' }).first())
      .resolves.toMatchObject({ tag: 'legacy' });
    for (const table of [
      'resource_registry', 'file_operations', 'file_versions', 'resource_provenance_events',
    ]) {
      await expect(db.schema.hasTable(table)).resolves.toBe(true);
    }

    const indexes = await db.raw("SELECT name FROM sqlite_master WHERE type = 'index' AND (name LIKE '%provenance%' OR name LIKE 'resource_registry_%' OR name LIKE 'file_operations_%' OR name LIKE 'file_versions_%')");
    expect(indexes.map((row) => row.name)).toEqual(expect.arrayContaining([
      'resource_registry_active_path_unique',
      'file_operations_reconciliation_idx',
      'file_operations_active_resource_unique',
      'file_operations_active_path_unique',
      'file_versions_resource_idx',
      'resource_provenance_query_order_idx',
    ]));
    const foreignKeys = await db.raw('PRAGMA foreign_key_list(file_versions)');
    expect(foreignKeys.map((row) => row.table)).toEqual(expect.arrayContaining([
      'file_operations', 'resource_registry',
    ]));

    await provenanceMigration.down(db);
    await expect(db.schema.hasTable('resource_registry')).resolves.toBe(false);
    await expect(db('event_log').where({ event_id: 'legacy-event' }).first())
      .resolves.toMatchObject({ summary: 'legacy' });
    await expect(db.schema.hasTable('event_schema_registry')).resolves.toBe(true);
  });

  test('enforces one active canonical path while allowing tombstoned history', async () => {
    db = createDb();
    await initialMigration.up(db);
    await ledgerMigration.up(db);
    await registryMigration.up(db);
    await provenanceMigration.up(db);
    const base = {
      workspace_id: 'workspace-1', kind: 'file', canonical_path: 'docs/a.md',
      lifecycle_state: 'reserved', created_at: 1, updated_at: 1,
    };
    await db('resource_registry').insert({ resource_id: 'resource-1', ...base });
    let duplicateError;
    try {
      await db('resource_registry').insert({ resource_id: 'resource-2', ...base });
    } catch (error) {
      duplicateError = error;
    }
    expect(duplicateError).toBeDefined();
    expect(duplicateError.message).toMatch(/UNIQUE constraint failed/u);
    await db('resource_registry').where({ resource_id: 'resource-1' }).update({
      lifecycle_state: 'tombstoned', tombstone_reason: 'compatibility_relocated_or_replaced',
      tombstoned_at: 2, updated_at: 2,
    });
    await expect(db('resource_registry').insert({ resource_id: 'resource-2', ...base }))
      .resolves.toBeDefined();
  });
});
