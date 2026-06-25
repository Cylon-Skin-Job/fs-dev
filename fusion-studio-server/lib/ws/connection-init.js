/**
 * Initial connection payload builders.
 *
 * Assembles the workspace:init and panel_config messages a new
 * WebSocket connection needs before panel discovery runs. Extracted
 * from server.js per SPEC-01g.
 *
 * Pure assembly — builders return message objects; server.js does the
 * ws.send(). buildPanelConfig takes projectRoot as an argument at call
 * time (per-connection root is mutable), never captured at load time.
 */

const path = require('path');
const fsPromises = require('fs').promises;

const workspaceController = require('../workspace/workspace-controller');
const views = require('../views');
const aiPaths = require('../workspace/ai-paths');

/**
 * Build the workspace:init message: registry, active workspace, CLI
 * config, themes, pre-read shared CSS layers, and cached view states.
 *
 * @param {(ws?: import('ws').WebSocket) => string|null} getProjectRoot
 * @returns {Promise<object>}
 */
async function buildWorkspaceInit(getProjectRoot) {
  const workspaces = await workspaceController.listWorkspaces();
  const activeWorkspaceId = workspaceController.getActiveWorkspaceId();
  console.log('[WS] activeWorkspaceId:', activeWorkspaceId, 'workspaces count:', workspaces.length);
  const { resolveCliConfig } = require('../cli-config');
  const activeRoot = getProjectRoot();
  console.log('[WS] activeRoot:', activeRoot);
  const cliConfig = activeRoot ? await resolveCliConfig(activeRoot, null) : {};
  let themes = [];
  let activeThemeId = null;
  let styles = {};
  const stateCache = require('../workspace/state-cache');
  const cachedStates = stateCache.loadAll();
  if (activeRoot) {
    try {
      const themesService = require('../theme/themes-service');
      themes = await themesService.list(activeRoot);
      const active = themes.find(t => t.active);
      activeThemeId = active ? active.id : null;
    } catch (_) {}
    // Pre-read shared CSS layers so the client can inject synchronously
    const styleFiles = [
      'variables.css', 'themes.css', 'components.css', 'views.css',
      'file-viewer.css', 'doc-viewer.css', 'tints.css',
    ];
    const settingsDir = aiPaths.getSystemStylesRoot(activeRoot);
    await Promise.all(
      styleFiles.map(async (file) => {
        try {
          const css = await fsPromises.readFile(path.join(settingsDir, file), 'utf8');
          styles[file] = css;
        } catch {
          styles[file] = '';
        }
      })
    );
  }
  const activeWs = workspaceController.getActiveWorkspaceSync();
  return {
    type: 'workspace:init',
    workspaces,
    activeWorkspaceId,
    activeRepoPath: activeWs ? activeWs.repo_path : null,
    workspaceType: activeWs ? activeWs.type : 'code',
    homePath: require('os').homedir(),
    cliConfig,
    themes,
    activeThemeId,
    styles,
    cachedStates,
  };
}

/**
 * Build the panel_config message: project root info plus panel content
 * roots (the client needs these to build absolute paths for
 * copy-to-clipboard). The client sends set_panel to identify itself;
 * when projectRoot is null the client renders the empty state.
 *
 * @param {string|null} projectRoot - per-connection root at connect time
 * @returns {object}
 */
function buildPanelConfig(projectRoot) {
  const panelRoots = {};
  if (projectRoot) {
    const viewIds = views.listViews(projectRoot);
    for (const viewId of viewIds) {
      const root = views.resolveContentPath(projectRoot, viewId);
      if (root) panelRoots[viewId] = root;
    }
  }

  return {
    type: 'panel_config',
    projectRoot,
    projectName: projectRoot ? path.basename(projectRoot) : null,
    panelRoots,
  };
}

module.exports = { buildWorkspaceInit, buildPanelConfig };
