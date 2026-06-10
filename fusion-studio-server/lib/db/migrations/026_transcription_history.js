/**
 * Migration 026 — Transcription history
 *
 * Adds: transcription_history table for raw Whisper output and Gwen cleanup output.
 * FIFO 100 rows, enforced in application code by the event-bus subscriber.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('transcription_history', (t) => {
    t.increments('id').primary();
    t.text('raw_text').notNullable().defaultTo('');
    t.text('corrected_text').notNullable().defaultTo('');
    t.text('cleanup_capability');
    t.text('cleanup_model');
    t.text('cleanup_provider');
    t.integer('cleanup_success').notNullable().defaultTo(0);
    t.text('cleanup_error');
    t.text('whisper_model').notNullable().defaultTo('');
    t.integer('duration_ms');
    t.integer('created_at').notNullable();

    t.index(['created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('transcription_history');
};
