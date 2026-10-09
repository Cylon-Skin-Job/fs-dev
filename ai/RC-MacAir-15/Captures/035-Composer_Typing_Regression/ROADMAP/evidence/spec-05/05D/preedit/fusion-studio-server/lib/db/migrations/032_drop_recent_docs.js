/**
 * Migration 032 — Remove legacy DB-backed Office recents.
 *
 * Recents now live in per-view activity state under the view's state file.
 */

exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('recent_docs');
};

exports.down = async function () {};
