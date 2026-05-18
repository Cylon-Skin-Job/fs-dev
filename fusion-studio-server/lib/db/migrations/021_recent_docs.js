/**
 * Migration 021 — Recently opened documents tracker
 *
 * Adds: recent_docs table for office-viewer document history.
 * FIFO 20 per workspace, enforced in application code (index-table.js).
 */

exports.up = async function (knex) {
  await knex.schema.createTable('recent_docs', (t) => {
    t.increments('id').primary();
    t.text('workspace_id').notNullable();
    t.text('file_path').notNullable();
    t.text('folder').notNullable();
    t.text('name').notNullable();
    t.text('panel').notNullable();
    t.integer('opened_at').notNullable();

    t.index(['workspace_id', 'opened_at']);
    t.unique(['workspace_id', 'file_path']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('recent_docs');
};
