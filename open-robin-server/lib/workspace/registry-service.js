/**
 * registry-service — CRUD on the `workspaces` table.
 *
 * Pure data access. Never emits events, never touches the bus, never knows
 * about DOM or client connections. The workspace-controller is the only
 * caller today. Queries go through knex via `getDb()`.
 *
 * Contract notes:
 *   - `add` assumes the caller has already canonicalized repoPath and
 *     resolved id collisions.
 *   - `remove` deletes the matching `workspace_themes` row first because
 *     the FK (migration 003) has no CASCADE.
 */

const { getDb } = require('../db');

async function list() {
  return getDb()('workspaces').orderBy('sort_order', 'asc');
}

async function getById(id) {
  return getDb()('workspaces').where('id', id).first();
}

async function getByRepoPath(repoPath) {
  return getDb()('workspaces').where('repo_path', repoPath).first();
}

async function add({ id, label, icon, description, repoPath, sortOrder, type }) {
  await getDb()('workspaces').insert({
    id,
    label,
    icon: icon || 'folder',
    description: description || null,
    repo_path: repoPath,
    sort_order: sortOrder ?? 0,
    type: type || 'code',
  });
  return getById(id);
}

async function remove(id) {
  const db = getDb();
  // Themes first — FK has no CASCADE (migration 003).
  await db('workspace_themes').where('workspace_id', id).del();
  const deleted = await db('workspaces').where('id', id).del();
  return deleted > 0;
}

async function updateSortOrder(id, sortOrder) {
  await getDb()('workspaces').where('id', id).update({ sort_order: sortOrder });
}

async function maxSortOrder() {
  const row = await getDb()('workspaces').max('sort_order as max').first();
  return row && row.max != null ? row.max : -1;
}

module.exports = {
  list,
  getById,
  getByRepoPath,
  add,
  remove,
  updateSortOrder,
  maxSortOrder,
};
