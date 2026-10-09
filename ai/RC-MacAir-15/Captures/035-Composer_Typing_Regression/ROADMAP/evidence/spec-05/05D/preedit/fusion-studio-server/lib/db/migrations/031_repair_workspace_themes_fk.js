/**
 * Repair stale dev databases where migration 009 left workspace_themes
 * referencing workspaces_old after the workspace table rebuild.
 */

exports.config = { transaction: false };

exports.up = async function (knex) {
  const table = await knex('sqlite_master')
    .where({ type: 'table', name: 'workspace_themes' })
    .select('sql')
    .first();

  if (!table || !String(table.sql || '').includes('workspaces_old')) {
    return;
  }

  await knex.raw('PRAGMA foreign_keys = OFF');
  try {
    await knex.schema.createTable('workspace_themes_repair', (t) => {
      t.text('workspace_id').primary().references('id').inTable('workspaces');
      t.text('primary_color').defaultTo('#4fc3f7');
      t.text('primary_rgb').defaultTo('79, 195, 247');
      t.text('theme_css');
      t.text('updated_at').defaultTo(knex.fn.now());
    });

    await knex.raw(`
      INSERT INTO workspace_themes_repair (workspace_id, primary_color, primary_rgb, theme_css, updated_at)
      SELECT workspace_id, primary_color, primary_rgb, theme_css, updated_at
      FROM workspace_themes
      WHERE workspace_id IN (SELECT id FROM workspaces)
    `);

    await knex.schema.dropTable('workspace_themes');
    await knex.raw('ALTER TABLE workspace_themes_repair RENAME TO workspace_themes');
  } finally {
    await knex.raw('PRAGMA foreign_keys = ON');
  }
};

exports.down = async function () {
  return Promise.resolve();
};
