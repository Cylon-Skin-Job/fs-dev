/**
 * recent_docs CRUD — Knex data access for the recent documents table.
 *
 * One job: read and write recent_docs rows. No WS logic, no validation beyond schema.
 *
 * Schema lives in migration 021_recent_docs. Columns:
 *   id, workspace_id, file_path, folder, name, panel, opened_at
 */

'use strict';

const { getDb } = require('../db');

const TABLE = 'recent_docs';
const COLUMNS = ['id', 'workspace_id', 'file_path', 'folder', 'name', 'panel', 'opened_at'];

/**
 * List recent docs for a workspace, ordered by most recently opened first.
 * @param {string} workspaceId
 * @param {number} [limit=20]
 * @returns {Promise<{ items: object[], total: number }>}
 */
async function list(workspaceId, limit = 20) {
  const items = await getDb()(TABLE)
    .select(COLUMNS)
    .where({ workspace_id: workspaceId })
    .orderBy('opened_at', 'desc')
    .limit(limit);

  const totalRow = await getDb()(TABLE)
    .where({ workspace_id: workspaceId })
    .count('* as count')
    .first();

  return { items, total: totalRow ? Number(totalRow.count) : 0 };
}

/**
 * Record (upsert) a file as opened, then prune to FIFO limit.
 * @param {string} workspaceId
 * @param {string} filePath
 * @param {string} folder
 * @param {string} name
 * @param {string} panel
 * @param {number} openedAt — Unix timestamp in ms
 */
async function record(workspaceId, filePath, folder, name, panel, openedAt) {
  const db = getDb();
  await db.transaction(async (trx) => {
    await trx(TABLE)
      .insert({
        workspace_id: workspaceId,
        file_path: filePath,
        folder,
        name,
        panel,
        opened_at: openedAt,
      })
      .onConflict(['workspace_id', 'file_path'])
      .merge(['opened_at']);

    const rowsToKeep = await trx(TABLE)
      .select('id')
      .where({ workspace_id: workspaceId })
      .orderBy('opened_at', 'desc')
      .limit(20);

    const keepIds = rowsToKeep.map((r) => r.id);
    if (keepIds.length > 0) {
      await trx(TABLE)
        .where({ workspace_id: workspaceId })
        .whereNotIn('id', keepIds)
        .del();
    }
  });
}

/**
 * Clear all recent docs for a workspace.
 * @param {string} workspaceId
 * @returns {Promise<number>} — rows deleted
 */
async function clear(workspaceId) {
  return getDb()(TABLE).where({ workspace_id: workspaceId }).del();
}

module.exports = { list, record, clear, TABLE, COLUMNS };
