'use strict';

// Session-owned admission journal. The FK makes authorized session deletion
// the only ordinary retention boundary; existing exchanges are untouched.
exports.up = async function up(knex) {
  await knex.schema.createTable('prompt_submission_receipts', (t) => {
    t.text('workspace_id').notNullable();
    t.text('thread_id').notNullable().references('thread_id').inTable('threads').onDelete('CASCADE');
    t.text('request_id').notNullable();
    t.text('fingerprint'); // null only for an absent-status cancellation fence
    t.text('snapshot_json'); // same disclosure/retention boundary as chat history
    t.text('turn_id');
    t.text('generation').notNullable();
    t.text('outcome').notNullable(); // reserved, accepted, rejected, cancelled
    t.text('execution').notNullable().defaultTo('not_dispatched');
    t.text('reason');
    t.bigInteger('created_at').notNullable();
    t.bigInteger('updated_at').notNullable();
    t.primary(['workspace_id', 'thread_id', 'request_id']);
    t.index(['thread_id', 'outcome']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('prompt_submission_receipts');
};
