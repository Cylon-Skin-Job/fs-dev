'use strict';

/**
 * Migration 040 — BRIDGE-01 SPEC-01 §6.3/§9-01B queryable ComponentActionContext.
 *
 * Adds the tab/component/presenter/target context columns and indexes required
 * to query mediated-save provenance by view/tab/component/presenter/target.
 * Workspace and view columns were already introduced by migration 035 for
 * `file_operations`; `resource_provenance_events` gains the full context set.
 *
 * It also refreshes the locked system-schema definition rows whose canonical
 * bytes changed with the extended `reportedUiContext`, because
 * `reconcileSystemSchemas` preserves existing rows by id and a checksum drift
 * would otherwise render the schema inactive. On a fresh database those rows do
 * not exist yet, so this refresh is a no-op before reconcile inserts them.
 */

const AFFECTED_SCHEMA_IDS = Object.freeze([
  '27c767a2-c48e-4dad-bfec-2e16429be9e4', // resource.mutated@1
  'd8ba7295-e7c1-46a7-aa87-e295d6776c26', // file.command_accepted@1
  '3c728bed-889f-4e9f-92f5-2d43b50dc97d', // file_save@1
  'e4d64cbc-1ce9-46fd-8bb4-07368e2fe4f5', // resource:provenance@1
]);

const FILE_OPERATION_COLUMNS = Object.freeze([
  ['reported_tab_id', 128],
  ['reported_component_type_id', 128],
  ['reported_component_instance_id', 128],
  ['reported_presenter_id', 128],
  ['reported_target_key', 512],
]);

const PROVENANCE_COLUMNS = Object.freeze([
  ['reported_view_id', 128],
  ['reported_view_instance_id', 128],
  ['reported_tab_id', 128],
  ['reported_component_type_id', 128],
  ['reported_component_instance_id', 128],
  ['reported_presenter_id', 128],
  ['reported_target_key', 512],
]);

const INDEXES = Object.freeze([
  `CREATE INDEX file_operations_reported_context_idx
     ON file_operations (
       workspace_id, reported_view_id, reported_tab_id, reported_component_type_id,
       reported_component_instance_id, reported_presenter_id, reported_target_key
     )`,
  `CREATE INDEX resource_provenance_reported_view_idx
     ON resource_provenance_events (workspace_id, reported_view_id, occurred_at DESC, event_id ASC)`,
  `CREATE INDEX resource_provenance_reported_tab_idx
     ON resource_provenance_events (workspace_id, reported_tab_id, occurred_at DESC)`,
  `CREATE INDEX resource_provenance_reported_component_idx
     ON resource_provenance_events (
       workspace_id, reported_component_type_id, reported_component_instance_id, occurred_at DESC
     )`,
  `CREATE INDEX resource_provenance_reported_presenter_idx
     ON resource_provenance_events (workspace_id, reported_presenter_id, occurred_at DESC)`,
  `CREATE INDEX resource_provenance_reported_target_idx
     ON resource_provenance_events (workspace_id, reported_target_key, occurred_at DESC)`,
]);

async function addColumns(knex, table, columns) {
  for (const [column, maxLength] of columns) {
    await knex.raw(
      `ALTER TABLE ${table} ADD COLUMN ${column} TEXT
         CHECK (${column} IS NULL OR length(${column}) BETWEEN 1 AND ${maxLength})`,
    );
  }
}

exports.up = async function up(knex) {
  await addColumns(knex, 'file_operations', FILE_OPERATION_COLUMNS);
  await addColumns(knex, 'resource_provenance_events', PROVENANCE_COLUMNS);
  for (const statement of INDEXES) await knex.raw(statement);

  // Refresh only the locked system schemas whose canonical bytes changed.
  const { SYSTEM_SCHEMA_SEEDS } = require('../../event-registry/seed-catalog');
  const seedsById = new Map(SYSTEM_SCHEMA_SEEDS.map((seed) => [seed.schemaId, seed]));
  await knex.transaction(async (trx) => {
    for (const schemaId of AFFECTED_SCHEMA_IDS) {
      const seed = seedsById.get(schemaId);
      if (!seed) continue;
      const row = await trx('event_schema_registry').where({ schema_id: schemaId }).first();
      if (!row) continue; // fresh database: reconcile inserts current bytes later
      if (row.definition_json === seed.definitionJson
        && row.definition_sha256 === seed.definitionSha256) continue;
      await trx('event_schema_registry').where({ schema_id: schemaId }).update({
        definition_json: seed.definitionJson,
        definition_sha256: seed.definitionSha256,
        updated_at: Math.max(Date.now(), row.updated_at + 1),
      });
    }
  });
};

exports.down = async function down(knex) {
  for (const statement of [
    'DROP INDEX IF EXISTS resource_provenance_reported_target_idx',
    'DROP INDEX IF EXISTS resource_provenance_reported_presenter_idx',
    'DROP INDEX IF EXISTS resource_provenance_reported_component_idx',
    'DROP INDEX IF EXISTS resource_provenance_reported_tab_idx',
    'DROP INDEX IF EXISTS resource_provenance_reported_view_idx',
    'DROP INDEX IF EXISTS file_operations_reported_context_idx',
  ]) await knex.raw(statement);

  for (const [column] of [...PROVENANCE_COLUMNS].reverse()) {
    await knex.raw(`ALTER TABLE resource_provenance_events DROP COLUMN ${column}`);
  }
  for (const [column] of [...FILE_OPERATION_COLUMNS].reverse()) {
    await knex.raw(`ALTER TABLE file_operations DROP COLUMN ${column}`);
  }
};

exports.AFFECTED_SCHEMA_IDS = AFFECTED_SCHEMA_IDS;
