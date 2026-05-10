/**
 * Migration 017 — Add workspace_id to threads
 *
 * Replaces the basename-derived project_id discriminator with a formal
 * workspace_id relationship. Fixes thread collision when two workspaces
 * share the same basename.
 *
 * Schema changes:
 *   + workspace_id TEXT      (new discriminator; nullable during migration)
 *   + threads_workspace_id_idx (new — fast workspace-scoped list queries)
 *   + threads_workspace_scope_view_idx (new — covers list queries)
 *
 * Data changes:
 *   - Backfill: for each workspaces row, update threads.workspace_id
 *     where threads.project_id = basename(workspaces.repo_path) and
 *     workspace_id IS NULL. First-match wins for ambiguous basenames.
 *   - Unmatched rows stay NULL (acceptable for pre-prod data).
 *
 * Note: project_id is kept for backward compatibility. All reads switch
 * to workspace_id. A future migration drops project_id once all consumers
 * are verified.
 */

exports.config = { transaction: false };

exports.up = async function (knex) {
  await knex.raw('PRAGMA foreign_keys = OFF');

  // 1. Add workspace_id column
  await knex.schema.alterTable('threads', (t) => {
    t.text('workspace_id');
  });

  // 2. Backfill workspace_id from workspaces table
  //    Match on basename(repo_path) == project_id. First match wins.
  const workspaces = await knex('workspaces').select('id', 'repo_path');
  for (const ws of workspaces) {
    const basename = require('path').basename(ws.repo_path);
    await knex('threads')
      .where('project_id', basename)
      .whereNull('workspace_id')
      .update({ workspace_id: ws.id });
  }

  // 3. Log unmatched rows for operator awareness
  const unmatched = await knex('threads')
    .whereNull('workspace_id')
    .count('* as count')
    .first();
  if (unmatched && unmatched.count > 0) {
    console.warn(`[Migration 017] ${unmatched.count} threads could not be matched to a workspace (project_id has no corresponding workspace basename).`);
  }

  // 4. Add indexes for workspace-scoped queries
  await knex.schema.alterTable('threads', (t) => {
    t.index('workspace_id', 'threads_workspace_id_idx');
    t.index(['workspace_id', 'scope', 'view_id'], 'threads_workspace_scope_view_idx');
  });

  await knex.raw('PRAGMA foreign_keys = ON');
};

exports.down = async function (knex) {
  await knex.raw('PRAGMA foreign_keys = OFF');

  try {
    await knex.schema.alterTable('threads', (t) =>
      t.dropIndex(['workspace_id', 'scope', 'view_id'], 'threads_workspace_scope_view_idx')
    );
  } catch { /* may not exist */ }

  try {
    await knex.schema.alterTable('threads', (t) =>
      t.dropIndex('workspace_id', 'threads_workspace_id_idx')
    );
  } catch { /* may not exist */ }

  await knex.schema.alterTable('threads', (t) => {
    t.dropColumn('workspace_id');
  });

  await knex.raw('PRAGMA foreign_keys = ON');
};
