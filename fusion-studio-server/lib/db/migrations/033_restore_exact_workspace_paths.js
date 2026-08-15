/**
 * Migration 033 — Restore exact macOS workspace path casing.
 *
 * Older workspace registration code lowercased the operational repo_path on
 * macOS to make duplicate checks case-insensitive. That spelling is accepted
 * by the default macOS filesystem, but path-sensitive tools can interpret it
 * as outside the active workspace. Restore every reachable row to the exact
 * realpath spelling. Unavailable workspaces remain registered and unchanged.
 */

exports.up = async function (knex) {
  if (process.platform !== 'darwin') return;

  const pathService = require('../../workspace/path-service');
  const rows = await knex('workspaces').select('id', 'repo_path');

  for (const row of rows) {
    if (!row.repo_path) continue;

    let exactPath;
    try {
      exactPath = pathService.canonicalize(row.repo_path);
    } catch {
      continue;
    }

    if (exactPath !== row.repo_path) {
      await knex('workspaces').where('id', row.id).update({ repo_path: exactPath });
    }
  }
};

exports.down = async function (knex) {
  if (process.platform !== 'darwin') return;

  const rows = await knex('workspaces').select('id', 'repo_path');
  for (const row of rows) {
    if (!row.repo_path) continue;
    const lowerPath = row.repo_path.toLowerCase();
    if (lowerPath !== row.repo_path) {
      await knex('workspaces').where('id', row.id).update({ repo_path: lowerPath });
    }
  }
};
