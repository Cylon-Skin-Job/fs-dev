/**
 * Drop the `use_when` column from `secrets_index`. The field is collapsed
 * into `description`, which now carries both the human-facing summary and
 * the AI's retrieval hint, capped at 150 characters.
 *
 * Per SECRETS_MANAGER_SPEC.md §13 and SESSION-COLLAPSE-description.md.
 */

exports.up = (knex) => knex.schema.alterTable('secrets_index', (t) => {
  t.dropColumn('use_when');
});

exports.down = (knex) => knex.schema.alterTable('secrets_index', (t) => {
  t.text('use_when');
});
