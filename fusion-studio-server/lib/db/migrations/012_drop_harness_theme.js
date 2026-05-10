/**
 * Drop the harness_theme table left over from CLI_COLOR_OVERRIDE_SPEC.
 *
 * CLI_CONFIG_SPEC replaced the SQLite-backed per-CLI color override with a
 * JSON file (`ai/views/settings/cli.json`). No UI ever shipped for the
 * SQLite path; any rows in the table are seed defaults.
 *
 * Data loss is acceptable — see CLI_CONFIG_SPEC §10b.
 */

exports.up = function (knex) {
  return knex.schema.dropTableIfExists('harness_theme');
};

exports.down = function (knex) {
  // Intentional no-op. CLI_COLOR_OVERRIDE_SPEC has been superseded; the
  // table is not recreated on rollback.
  return Promise.resolve();
};
