/**
 * Migration 023 — Browser bookmarks
 *
 * Adds: bookmarks table for per-workspace URL bookmarks.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('bookmarks', (t) => {
    t.increments('id').primary();
    t.text('workspace_id').notNullable();
    t.text('url').notNullable();
    t.text('title').notNullable().defaultTo('');
    t.text('folder').notNullable().defaultTo('');
    t.integer('created_at').notNullable();

    t.index(['workspace_id', 'created_at']);
    t.unique(['workspace_id', 'url']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('bookmarks');
};
