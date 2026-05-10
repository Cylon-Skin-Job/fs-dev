/**
 * Create secrets_index table — metadata mirror for secrets stored in the
 * macOS Keychain. Per SECRETS_MANAGER_SPEC §13.
 *
 * Holds: name (PK), description, use_when, expires_at, fingerprint,
 * created_at, updated_at. No values — values live in the Keychain.
 */

exports.up = (knex) => knex.schema.createTable('secrets_index', (t) => {
  t.text('name').primary();
  t.text('description');
  t.text('use_when');
  t.integer('expires_at').nullable();
  t.text('fingerprint').notNullable();
  t.integer('created_at').notNullable();
  t.integer('updated_at').notNullable();
});

exports.down = (knex) => knex.schema.dropTable('secrets_index');
