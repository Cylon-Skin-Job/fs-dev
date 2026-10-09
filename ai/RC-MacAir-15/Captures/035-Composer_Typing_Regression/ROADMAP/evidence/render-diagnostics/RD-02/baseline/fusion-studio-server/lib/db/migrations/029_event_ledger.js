/**
 * Migration 029 - Event ledger skeleton
 *
 * Append-only audit tables for workspace/resource lifecycle events. Domain
 * detail such as snapshots, checkpoints, chat exchanges, and agent runs can
 * link back to these rows in later migrations.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('event_log', (t) => {
    t.text('event_id').primary();
    t.text('event_type').notNullable();
    t.text('workspace_id');
    t.text('machine_id');
    t.text('machine_name');
    t.text('actor_type').notNullable().defaultTo('system');
    t.text('actor_id');
    t.integer('occurred_at').notNullable();
    t.text('summary').notNullable().defaultTo('');
    t.text('payload_json').notNullable().defaultTo('{}');
    t.text('source_module');
    t.text('correlation_id');
    t.text('causation_id');
    t.integer('created_at').notNullable();

    t.index(['event_type', 'occurred_at']);
    t.index(['workspace_id', 'occurred_at']);
    t.index(['machine_id', 'occurred_at']);
    t.index(['correlation_id']);
  });

  await knex.schema.createTable('event_resource_edges', (t) => {
    t.increments('id').primary();
    t.text('event_id')
      .notNullable()
      .references('event_id')
      .inTable('event_log')
      .onDelete('CASCADE');
    t.text('resource_type').notNullable();
    t.text('resource_id');
    t.text('workspace_id');
    t.text('machine_id');
    t.text('path');
    t.text('role').notNullable().defaultTo('subject');

    t.index(['event_id']);
    t.index(['resource_type', 'resource_id']);
    t.index(['workspace_id', 'path']);
    t.index(['machine_id', 'path']);
  });

  await knex.schema.createTable('event_tags', (t) => {
    t.increments('id').primary();
    t.text('event_id')
      .notNullable()
      .references('event_id')
      .inTable('event_log')
      .onDelete('CASCADE');
    t.text('tag').notNullable();

    t.unique(['event_id', 'tag']);
    t.index(['tag']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('event_tags');
  await knex.schema.dropTableIfExists('event_resource_edges');
  await knex.schema.dropTableIfExists('event_log');
};
