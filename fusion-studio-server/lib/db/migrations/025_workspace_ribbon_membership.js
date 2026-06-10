/**
 * Migration 025 — Workspace ribbon membership
 *
 * Separates registered workspace order from top-ribbon membership/order.
 */

exports.up = async function (knex) {
  await knex.schema.table('workspaces', (t) => {
    t.integer('ribbon_visible').defaultTo(1);
    t.integer('ribbon_sort_order');
  });

  await knex.raw('UPDATE workspaces SET ribbon_visible = 1, ribbon_sort_order = sort_order');
};

exports.down = async function (knex) {
  await knex.schema.table('workspaces', (t) => {
    t.dropColumn('ribbon_visible');
    t.dropColumn('ribbon_sort_order');
  });
};
