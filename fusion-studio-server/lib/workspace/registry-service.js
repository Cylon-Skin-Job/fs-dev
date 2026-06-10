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

function toWorkspace(row) {
  if (!row) return null;

  const workspace = {
    id: row.id,
    label: row.label,
    icon: row.icon,
    description: row.description,
    repoPath: row.repo_path,
    sortOrder: row.sort_order,
    type: row.type,
    ribbonVisible: row.ribbon_visible == null ? true : row.ribbon_visible !== 0,
    ribbonSortOrder: row.ribbon_sort_order == null ? null : row.ribbon_sort_order,
  };

  Object.defineProperties(workspace, {
    repo_path: { value: row.repo_path, enumerable: false },
    sort_order: { value: row.sort_order, enumerable: false },
  });

  return workspace;
}

async function list() {
  const rows = await getDb()('workspaces').orderBy('sort_order', 'asc');
  return rows.map(toWorkspace);
}

async function getById(id) {
  const row = await getDb()('workspaces').where('id', id).first();
  return toWorkspace(row);
}

async function getByRepoPath(repoPath) {
  const row = await getDb()('workspaces').where('repo_path', repoPath).first();
  return toWorkspace(row);
}

async function add({ id, label, icon, description, repoPath, sortOrder, type, ribbonVisible, ribbonSortOrder }) {
  await getDb()('workspaces').insert({
    id,
    label,
    icon: icon || 'folder',
    description: description || null,
    repo_path: repoPath,
    sort_order: sortOrder ?? 0,
    type: type || 'code',
    ribbon_visible: ribbonVisible === false ? 0 : 1,
    ribbon_sort_order: ribbonSortOrder ?? sortOrder ?? 0,
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

async function updateRibbonVisibility(id, visible) {
  await getDb()('workspaces').where('id', id).update({
    ribbon_visible: visible ? 1 : 0,
  });
}

async function updateRibbonMembership(id, { visible, ribbonSortOrder }) {
  await getDb()('workspaces').where('id', id).update({
    ribbon_visible: visible ? 1 : 0,
    ribbon_sort_order: ribbonSortOrder,
  });
}

async function updateRibbonSortOrders(workspaceIds) {
  const db = getDb();
  await db.transaction(async (trx) => {
    for (let index = 0; index < workspaceIds.length; index += 1) {
      await trx('workspaces').where('id', workspaceIds[index]).update({
        ribbon_sort_order: index,
      });
    }
  });
}

async function maxSortOrder() {
  const row = await getDb()('workspaces').max('sort_order as max').first();
  return row && row.max != null ? row.max : -1;
}

async function maxRibbonSortOrder() {
  const row = await getDb()('workspaces')
    .where('ribbon_visible', 1)
    .select(getDb().raw('MAX(COALESCE(ribbon_sort_order, sort_order)) as max'))
    .first();
  return row && row.max != null ? row.max : -1;
}

module.exports = {
  list,
  getById,
  getByRepoPath,
  add,
  remove,
  updateSortOrder,
  updateRibbonVisibility,
  updateRibbonMembership,
  updateRibbonSortOrders,
  maxSortOrder,
  maxRibbonSortOrder,
};
