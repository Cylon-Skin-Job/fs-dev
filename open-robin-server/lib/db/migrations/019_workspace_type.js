/**
 * Migration 019 — Workspace type (code vs app)
 *
 * Adds a `type` column to the workspaces table to distinguish between
 * code-oriented workspaces (flat panel sidebar) and app-oriented workspaces
 * (two-zone sidebar with apps above a divider and tools below).
 */

exports.up = async function (knex) {
  await knex.schema.table('workspaces', (t) => {
    t.text('type').defaultTo('code');
  });

  // Backfill existing rows to 'code'
  await knex('workspaces').update({ type: 'code' });

  console.log('[Migration 019] Added workspaces.type (default: code)');
};

exports.down = async function (knex) {
  await knex.schema.table('workspaces', (t) => {
    t.dropColumn('type');
  });
};
