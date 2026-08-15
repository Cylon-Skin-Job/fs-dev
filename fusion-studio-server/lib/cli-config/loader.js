/**
 * CLI-config file loaders (CLI_CONFIG_SPEC §7b).
 *
 * Reads `ai/<machine>/System/config/cli.json` (workspace policy) and
 * `ai/<machine>/Views/<prefix>-<viewId>/state/cli.json` (per-view display overrides).
 * Missing or malformed files return `{}`; the resolver maps empty workspace
 * policy to OpenCode-only.
 */

const path = require('path');
const fs = require('fs').promises;
const aiPaths = require('../workspace/ai-paths');

const OPENCODE_ONLY_CONFIG = Object.freeze({
  defaultHarness: 'opencode',
  harnesses: Object.freeze({
    opencode: Object.freeze({
      enabled: true,
      name: 'OpenCode',
      materialIcon: 'all_inclusive',
      accentColor: '#10B981',
      order: 0,
    }),
  }),
});

function defaultWorkspaceConfig() {
  return {
    defaultHarness: OPENCODE_ONLY_CONFIG.defaultHarness,
    harnesses: {
      opencode: { ...OPENCODE_ONLY_CONFIG.harnesses.opencode },
    },
  };
}

function workspacePath(projectRoot) {
  return path.join(aiPaths.getSystemConfigRoot(projectRoot), 'cli.json');
}

function viewPath(projectRoot, viewId) {
  const viewFolder = findV2ViewFolder(projectRoot, viewId);
  return path.join(viewFolder || aiPaths.getMachineViewsRoot(projectRoot), 'state', 'cli.json');
}

function findV2ViewFolder(projectRoot, viewId) {
  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  try {
    const entries = require('fs').readdirSync(viewsRoot, { withFileTypes: true });
    const match = entries.find((entry) => entry.isDirectory() && (
      entry.name === viewId || entry.name.endsWith(`-${viewId}`)
    ));
    return match ? path.join(viewsRoot, match.name) : null;
  } catch {
    return null;
  }
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
    await fs.writeFile(tmp, `${JSON.stringify(defaultWorkspaceConfig(), null, 2)}\n`);
    await fs.rename(tmp, file);
  }
}

module.exports = {
  workspacePath,
  viewPath,
  loadWorkspaceConfig,
  loadViewConfig,
  ensureWorkspaceFile,
  defaultWorkspaceConfig,
};
