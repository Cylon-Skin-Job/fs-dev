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
const viewReadiness = require('../views/readiness-runtime');

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
  const bindingRevision = Object.prototype.hasOwnProperty.call(workspacePair, 'bindingRevision')
    ? workspacePair.bindingRevision
    : workspaceController.getActiveWorkspaceBindingRevision();
  if (!Number.isSafeInteger(bindingRevision) || bindingRevision < 1) {
    throw new Error('workspace_binding_revision_unavailable');
  }
  console.log('[WS] workspace_init_building');
  const { resolveCliConfig } = require('../cli-config');
  const activeRoot = Object.prototype.hasOwnProperty.call(workspacePair, 'repoPath')
    ? workspacePair.repoPath
    : getProjectRoot();
  const cliConfig = activeRoot ? await resolveCliConfig(activeRoot, null) : {};
  let themes = [];
  let activeThemeId = null;
  let styles = {};
  const workspaceState = require('../workspace/workspace-state');
  const workspaceStates = {};
  const unavailableViewRegistries = {};
  for (const workspace of workspaces) {
    const repoPath = workspace.repoPath || workspace.repo_path;
    if (!repoPath) continue;
    try {
      await viewReadiness.ensureWorkspaceViewReadiness({
        workspaceId: workspace.id,
        projectRoot: repoPath,
      });
      await viewReadiness.withViewReadinessLease({
        workspaceId: workspace.id,
        projectRoot: repoPath,
      }, async () => {
        const allowedViewIds = views.listViews(repoPath, { strictReadiness: true });
        const savedState = workspaceState.get(workspace.id, { repoPath, allowedViewIds });
        if (savedState) workspaceStates[workspace.id] = savedState;
      });
    } catch (_error) {
      unavailableViewRegistries[workspace.id] = viewReadiness.boundedViewRegistryUnavailable();
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
    bindingRevision,
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
    ...(activeRoot && activeWorkspaceId && !unavailableViewRegistries[activeWorkspaceId]
      ? { viewCapsules: views.buildViewCapsulesProjection(activeRoot, activeWorkspaceId) }
      : {}),
    ...(Object.keys(unavailableViewRegistries).length > 0 ? { unavailableViewRegistries } : {}),
  };
}

/**
 * Build the panel_config message: project root info plus panel content
 * roots (the client needs these to build absolute paths for
 * copy-to-clipboard). The client sends set_panel to identify itself;
 * when projectRoot is null the client renders the empty state.
 *
 * @param {string|null} projectRoot - per-connection root at connect time
 * @param {string|null} workspaceId - canonical bound workspace identity
 * @returns {object}
 */
async function buildPanelConfig(projectRoot, workspaceId = null, workspaceEpoch = null) {
  const base = {
    type: 'panel_config',
    projectRoot,
    projectName: projectRoot ? path.basename(projectRoot) : null,
    ...(typeof workspaceId === 'string' && typeof workspaceEpoch === 'string'
      ? { workspaceId, workspaceEpoch }
      : {}),
  };
  if (!projectRoot || !workspaceId) return { ...base, panelRoots: {} };
  try {
    await viewReadiness.ensureWorkspaceViewReadiness({ workspaceId, projectRoot });
    return await viewReadiness.withViewReadinessLease({ workspaceId, projectRoot }, async () => {
      const panelRoots = {};
      const viewIds = views.listViews(projectRoot, { strictReadiness: true });
      for (const viewId of viewIds) {
        const root = views.resolveContentPath(projectRoot, viewId);
        if (root) panelRoots[viewId] = root;
      }
      return {
        ...base,
        panelRoots,
        viewCapsules: views.buildViewCapsulesProjection(projectRoot, workspaceId),
        // SPEC-02 §4: strict per-view tab policies. Views without a `tabs`
        // object are absent from the map (absence = legacy behavior); a
        // malformed present `tabs` object yields only that view's bounded
        // `unavailable` entry and never fails this frame.
        tabPolicies: views.buildTabPoliciesProjection(projectRoot, viewIds),
      };
    });
  } catch (_error) {
    return { ...base, viewRegistryUnavailable: viewReadiness.boundedViewRegistryUnavailable() };
  }
}

async function buildViewRegistryUpdated(projectRoot, workspaceId, registry) {
  await viewReadiness.ensureWorkspaceViewReadiness({ workspaceId, projectRoot });
  return viewReadiness.withViewReadinessLease({ workspaceId, projectRoot }, async (lease) => (
    buildViewRegistryUpdatedUnderLease(projectRoot, registry, lease, { workspaceId })
  ));
}

function buildViewRegistryUpdatedUnderLease(projectRoot, registry, lease, binding = {}) {
  if (
    !lease
    || typeof lease.release !== 'function'
    || typeof lease.projectRoot !== 'string'
    || path.resolve(lease.projectRoot) !== path.resolve(projectRoot)
    || lease.phase !== 'journal_verified'
    || lease.verified !== true
    || typeof binding.workspaceId !== 'string'
    || binding.workspaceId.length === 0
  ) {
    const error = new Error('View registry unavailable');
    error.code = 'view_registry_unavailable';
    throw error;
  }
  return {
    type: 'workspace:view_registry_updated',
    workspaceId: binding.workspaceId,
    ...(typeof binding.workspaceEpoch === 'string'
      ? { workspaceEpoch: binding.workspaceEpoch }
      : {}),
    registry,
    viewCapsules: views.buildViewCapsulesProjection(projectRoot, binding.workspaceId),
  };
}

module.exports = {
  buildWorkspaceInit,
  buildPanelConfig,
  buildViewRegistryUpdated,
  buildViewRegistryUpdatedUnderLease,
};
