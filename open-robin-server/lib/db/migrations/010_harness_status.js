/**
 * Harness install-status cache — persists last-known install state per
 * harness id so /api/harnesses can answer from a single cached query
 * instead of fanning out subprocesses.
 *
 * See docs/HARNESS_STATUS_CACHE_SPEC.md §4a.
 */

exports.up = function (knex) {
  return knex.schema.createTable('harness_status', (t) => {
    t.text('id').primary();
    t.integer('installed').notNullable().defaultTo(0);
    t.text('binary_path');
    t.text('version');
    t.integer('checked_at');
    t.text('error');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('harness_status');
};
