/**
 * Screenshot service — pure data access for workspace_screenshots table.
 *
 * One job: CRUD on screenshot blobs. No events, no DOM, no bus.
 */

const { getDb } = require('../db');

async function save(workspaceId, pngBuffer, panelId) {
  const db = getDb();
  await db('workspace_screenshots')
    .insert({
      workspace_id: workspaceId,
      screenshot_png: pngBuffer,
      panel_id: panelId || null,
      captured_at: Date.now(),
    })
    .onConflict('workspace_id')
    .merge(['screenshot_png', 'panel_id', 'captured_at']);
}

async function get(workspaceId) {
  return getDb()('workspace_screenshots').where('workspace_id', workspaceId).first();
}

async function remove(workspaceId) {
  const deleted = await getDb()('workspace_screenshots').where('workspace_id', workspaceId).del();
  return deleted > 0;
}

async function list() {
  return getDb()('workspace_screenshots').select('workspace_id', 'panel_id', 'captured_at');
}

module.exports = { save, get, remove, list };
