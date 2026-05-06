/**
 * Remove the `secrets` row from `system_tabs`, retiring the Secrets tab
 * from the Robin overlay. Per SECRETS_MANAGER_SPEC §13.
 *
 * The down() path is best-effort. The literal row data lives in
 * lib/db/migrations/002_system_panel.js if reverse-migration is needed.
 */

exports.up = async (knex) => {
  // The `system_wiki.secrets` row holds a FK to system_tabs.id and must
  // stay dormant per spec §10b. Null out the FK before deleting the tab
  // so the row's content is preserved without blocking the delete.
  await knex('system_wiki').where('tab', 'secrets').update({ tab: null });
  await knex('system_tabs').where('id', 'secrets').delete();
};

exports.down = async (knex) => {
  // Re-seed from migration 002 literal (see open-robin-server/lib/db/migrations/002_system_panel.js for the row).
};
