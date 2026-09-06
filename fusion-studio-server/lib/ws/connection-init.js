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
 * config, themes, pre-read shared CSS layers, and workspace shell state.
 *
 * @param {(ws?: import('ws').WebSocket) => string|null} getProjectRoot
 * @returns {Promise<object>}
 */
async function buildWorkspaceInit(getProjectRoot, workspacePair = {}) {
  const workspaces = await workspaceController.listWorkspaces();
  const activeWorkspaceId = Object.prototype.hasOwnProperty.call(workspacePair, 'workspaceId')
    ? workspacePair.workspaceId
    : workspaceController.getActiveWorkspaceId();
  console.log('[WS] activeWorkspaceId:', activeWorkspaceId, 'workspaces count:', workspaces.length);
  const { resolveCliConfig } = require('../cli-config');
  const activeRoot = Object.prototype.hasOwnProperty.call(workspacePair, 'repoPath')
    ? workspacePair.repoPath
    : getProjectRoot();
  console.log('[WS] activeRoot:', activeRoot);
  const cliConfig = activeRoot ? await resolveCliConfig(activeRoot, null) : {};
  let themes = [];
  let activeThemeId = null;
  let styles = {};
  const workspaceState = require('../workspace/workspace-state');
  const workspaceStates = {};
  for (const workspace of workspaces) {
    const repoPath = workspace.repoPath || workspace.repo_path;
    const allowedViewIds = repoPath ? views.listViews(repoPath) : [];
    const savedState = workspaceState.get(workspace.id, { repoPath, allowedViewIds });
    if (savedState) {
      workspaceStates[workspace.id] = savedState;
    }
  }
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
      'file-viewer.css', 'capture-viewer.css', 'tints.css',
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
  const activeWs = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  return {
    type: 'workspace:init',
    workspaceId: workspacePair.workspaceId ?? activeWorkspaceId ?? null,
    workspaceEpoch: workspacePair.workspaceEpoch ?? null,
    fileSaveProtocolVersion: 1,
    resourceProvenanceProtocolVersion: 1,
    agentActivityProtocolVersion: 1,
    fileViewerReadProtocolVersion: 1,
    workspaces,
    activeWorkspaceId,
    activeRepoPath: activeRoot || null,
    workspaceType: activeWs ? activeWs.type : 'code',
    sourceMachineName: aiPaths.getLocalMachineName(),
    homePath: require('os').homedir(),
    cliConfig,
    themes,
    activeThemeId,
    styles,
    workspaceStates,
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
