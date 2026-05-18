/**
 * Workspace screenshot persistence.
 *
 * Stores PNG thumbnails of workspace panels for the ribbon and
 * off-screen carousel previews. One row per workspace.
 */

exports.up = function (knex) {
  return knex.schema.createTable('workspace_screenshots', (t) => {
    t.text('workspace_id').primary().references('id').inTable('workspaces');
    t.binary('screenshot_png');
    t.text('panel_id');
    t.integer('captured_at');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('workspace_screenshots');
};
