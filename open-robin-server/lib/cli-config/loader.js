/**
 * CLI-config file loaders (CLI_CONFIG_SPEC §7b).
 *
 * Reads `ai/views/settings/cli.json` (workspace) and
 * `ai/views/<viewId>/settings/cli.json` (per-view). Returns `{}` on missing
 * or malformed. Logs a warning on parse failure. Never throws.
 */

const path = require('path');
const fs = require('fs').promises;

function workspacePath(projectRoot) {
  return path.join(projectRoot, 'ai', 'views', 'settings', 'cli.json');
}

function viewPath(projectRoot, viewId) {
  return path.join(projectRoot, 'ai', 'views', viewId, 'settings', 'cli.json');
}

async function readJsonOrEmpty(filePath, label) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    console.warn(`[cli-config] ${label} not a plain object: ${filePath} — treating as empty`);
    return {};
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    console.warn(`[cli-config] invalid ${label} at ${filePath}: ${err.message} — treating as empty`);
    return {};
  }
}

async function loadWorkspaceConfig(projectRoot) {
  return readJsonOrEmpty(workspacePath(projectRoot), 'workspace cli.json');
}

async function loadViewConfig(projectRoot, viewId) {
  if (!viewId) return {};
  return readJsonOrEmpty(viewPath(projectRoot, viewId), `per-view cli.json (${viewId})`);
}

async function ensureWorkspaceFile(projectRoot) {
  const file = workspacePath(projectRoot);
  try {
    await fs.access(file);
  } catch {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    await fs.writeFile(tmp, '{}\n');
    await fs.rename(tmp, file);
  }
}

module.exports = {
  workspacePath,
  viewPath,
  loadWorkspaceConfig,
  loadViewConfig,
  ensureWorkspaceFile,
};
