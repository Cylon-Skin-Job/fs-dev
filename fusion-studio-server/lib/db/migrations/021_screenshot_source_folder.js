/**
 * macOS screenshot source folder registry.
 *
 * Stores the folder where macOS writes screenshots (typically ~/Desktop).
 * Refreshed on app startup and when the user clicks the in-app screenshot
 * button so the hotkey watcher follows macOS configuration changes.
 */

exports.up = function (knex) {
  return knex.schema.createTable('screenshot_source_folder', (t) => {
    t.increments('id').primary();
    t.text('path').notNullable();
    t.integer('updated_at').notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('screenshot_source_folder');
};
