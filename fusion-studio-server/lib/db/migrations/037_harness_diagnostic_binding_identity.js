/**
 * Add exact root/connection-epoch ownership to harness diagnostics.
 * Existing rows remain nullable and intentionally become unavailable because
 * their root/epoch provenance cannot be reconstructed safely.
 */

exports.up = async function (knex) {
  const hasRoot = await knex.schema.hasColumn('harness_error_diagnostics', 'project_root');
  const hasEpoch = await knex.schema.hasColumn('harness_error_diagnostics', 'workspace_epoch');
  await knex.schema.alterTable('harness_error_diagnostics', (table) => {
    if (!hasRoot) table.text('project_root').nullable();
    if (!hasEpoch) table.text('workspace_epoch').nullable();
  });
  await knex.schema.alterTable('harness_error_diagnostics', (table) => {
    table.index(
      ['workspace_id', 'project_root', 'workspace_epoch', 'thread_id', 'turn_id', 'diagnostic_id'],
      'harness_diag_exact_binding_idx',
    );
  });
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS harness_diag_exact_binding_idx');
  await knex.schema.alterTable('harness_error_diagnostics', (table) => {
    table.dropColumn('workspace_epoch');
    table.dropColumn('project_root');
  });
};
