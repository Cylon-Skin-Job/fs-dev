/**
 * bookmarks CRUD — Knex data access for the bookmarks table.
 *
 * One job: read and write bookmark rows. No WS logic, no validation beyond schema.
 *
 * Schema lives in migration 023_bookmarks. Columns:
 *   id, workspace_id, url, title, folder, created_at
 */

'use strict';

const { getDb } = require('../db');

const TABLE = 'bookmarks';
const COLUMNS = ['id', 'workspace_id', 'url', 'title', 'folder', 'created_at'];

/**
 * List bookmarks for a workspace, ordered by most recently created first.
 * @param {string} workspaceId
 * @param {number} [limit=100]
 * @returns {Promise<{ items: object[], total: number }>}
 */
async function list(workspaceId, limit = 100) {
  const items = await getDb()(TABLE)
    .select(COLUMNS)
    .where({ workspace_id: workspaceId })
    .orderBy('created_at', 'desc')
    .limit(limit);

  const totalRow = await getDb()(TABLE)
    .where({ workspace_id: workspaceId })
    .count('* as count')
    .first();

  return { items, total: totalRow ? Number(totalRow.count) : 0 };
}

/**
 * Add a bookmark (upsert on workspace_id + url).
 * @param {string} workspaceId
 * @param {string} url
 * @param {string} title
 * @param {string} [folder='']
 * @returns {Promise<object>} — the inserted/updated row
 */
async function add(workspaceId, url, title, folder = '') {
  const db = getDb();
  const now = Date.now();
  await db(TABLE)
    .insert({ workspace_id: workspaceId, url, title, folder, created_at: now })
    .onConflict(['workspace_id', 'url'])
    .merge(['title', 'folder', 'created_at']);

  return db(TABLE)
    .select(COLUMNS)
    .where({ workspace_id: workspaceId, url })
    .first();
}

/**
 * Remove a bookmark by ID.
 * @param {string} workspaceId
 * @param {number} id
 * @returns {Promise<number>} — rows deleted
 */
async function remove(workspaceId, id) {
  return getDb()(TABLE)
    .where({ workspace_id: workspaceId, id })
    .del();
}

/**
 * Update a bookmark's title or folder.
 * @param {string} workspaceId
 * @param {number} id
 * @param {object} updates — { title?, folder? }
 * @returns {Promise<number>} — rows updated
 */
async function update(workspaceId, id, updates) {
  const patch = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.folder !== undefined) patch.folder = updates.folder;
  if (Object.keys(patch).length === 0) return 0;

  return getDb()(TABLE)
    .where({ workspace_id: workspaceId, id })
    .update(patch);
}

module.exports = { list, add, remove, update, TABLE, COLUMNS };
