/**
 * Migration 027 — Emoji recents tracker
 *
 * Adds: emoji_recents table for Fusion-local recently used emojis.
 * Keeps last 20 unique emojis in application code.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('emoji_recents', (t) => {
    t.increments('id').primary();
    t.text('emoji').notNullable().unique();
    t.integer('last_used_at').notNullable();

    t.index(['last_used_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('emoji_recents');
};
