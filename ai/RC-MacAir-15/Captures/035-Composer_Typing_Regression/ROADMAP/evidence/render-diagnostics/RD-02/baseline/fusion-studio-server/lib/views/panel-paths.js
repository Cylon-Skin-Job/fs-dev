/**
 * Panel path resolution + per-connection session registries.
 *
 * Extracted from server.js per SPEC-01g. Owns the two server-wide Maps:
 *
 *   sessions     — ws → connection session state (created in server.js's
 *                  connection handler, read by startup.js broadcasters and
 *                  the file explorer). There must be exactly ONE instance;
 *                  every consumer must reference the Map exported here.
 *   sessionRoots — ws → { panel, rootFolder } overrides set via set_root.
 *
 * getProjectRoot has dual mode: with a ws argument it resolves the
 * per-connection root (mutated on workspace:switched); without, the
 * server-wide active workspace. Preserve the optional-parameter
 * signature exactly — both modes have callers.
 */

const path = require('path');
const fs = require('fs');

const workspaceController = require('../workspace/workspace-controller');
const views = require('./index');
const aiPaths = require('../workspace/ai-paths');

// Store active sessions (ws -> session state)
const sessions = new Map();

const sessionRoots = new Map();
const REGISTRY_INDEPENDENT_PANEL_IDS = new Set(['__apps__', '__settings__']);

/**
 * Whether getPanelPath() may consult the workspace view registry for this ID.
 * Keep registry-independent pseudo-panels explicit so callers can avoid
 * blocking unrelated app/settings reads when view readiness is unavailable.
 */
function panelPathRequiresViewReadiness(panel) {
  return !REGISTRY_INDEPENDENT_PANEL_IDS.has(panel);
}

function isDirectory(targetPath, { strictFilesystemErrors = false } = {}) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (error) {
    if (strictFilesystemErrors && !['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error;
    return false;
  }
}

function getLegacySystemRoot(projectRoot) {
  return path.join(projectRoot, 'ai', 'system');
}

function getLegacyWorkspaceRoot(projectRoot) {
  return path.join(getLegacySystemRoot(projectRoot), 'workspace');
}

function getLegacySettingsRoot(projectRoot) {
  return path.join(getLegacySystemRoot(projectRoot), 'styles');
}

/**
 * Resolve the project root for a given connection, or the server-wide
 * active workspace root when no connection context is available.
 *
 * Returns null when no workspace is active (empty state). Callers must
 * handle null — boot pipeline skips, per-connection handlers send an error.
 *
 * @param {import('ws').WebSocket} [ws] - connection context (optional)
 * @returns {string|null}
 */
function getProjectRoot(ws) {
  if (ws) {
    const session = sessions.get(ws);
    if (session) return session.projectRoot || null;
  }
  const active = workspaceController.getActiveWorkspaceSync();
  return active ? active.repo_path : null;
}

function setSessionRoot(ws, panel, rootFolder) {
  sessionRoots.set(ws, { panel, rootFolder });
  console.log(`[Session] Panel '${panel}' root set to: ${rootFolder}`);
}

function getSessionRoot(ws, panel) {
  const sessionRoot = sessionRoots.get(ws);
  if (sessionRoot && sessionRoot.panel === panel && sessionRoot.rootFolder) {
    return sessionRoot.rootFolder;
  }
  // Per-connection projectRoot is the only source of truth; null = empty state.
  const connSession = sessions.get(ws);
  return (connSession && connSession.projectRoot) || null;
}

function clearSessionRoot(ws) {
  sessionRoots.delete(ws);
}

function resolveReadablePanelPath(projectRoot, panel, sessionRoot) {
  // __panels__ pseudo-panel: resolves to ai/<machine>/System/Views/ (for client discovery)
  if (panel === '__panels__') {
    const viewsRoot = views.getViewsRoot(projectRoot);
    if (isDirectory(viewsRoot)) return viewsRoot;
    return null;
  }

  // __apps__ pseudo-panel: resolves to ai/apps/ (for client app discovery)
  if (panel === '__apps__') {
    const appsRoot = path.join(projectRoot, 'ai', 'apps');
    if (fs.existsSync(appsRoot)) return appsRoot;
    return null;
  }

  // __settings__ pseudo-panel: resolves to ai/<machine>/System/styles/ (for global theme/settings)
  if (panel === '__settings__') {
    const settingsRoot = aiPaths.getSystemStylesRoot(projectRoot);
    if (isDirectory(settingsRoot)) return settingsRoot;
    const legacySettingsRoot = getLegacySettingsRoot(projectRoot);
    if (isDirectory(legacySettingsRoot)) return legacySettingsRoot;
    return null;
  }

  // __workspace__ pseudo-panel is virtual for V2 view metadata; this fallback
  // only exists for non-view workspace files under System/workspace.
  if (panel === '__workspace__') {
    const workspaceRoot = path.join(aiPaths.getSystemRoot(projectRoot), 'workspace');
    if (isDirectory(workspaceRoot)) return workspaceRoot;
    const legacyWorkspaceRoot = getLegacyWorkspaceRoot(projectRoot);
    if (isDirectory(legacyWorkspaceRoot)) return legacyWorkspaceRoot;
    return null;
  }

  // Delegate to the view resolver system.
  // Each display type has its own resolver module that knows where
  // the content root is for that view type.
  const context = { sessionRoot };
  const resolved = views.resolveContentPath(projectRoot, panel, context);
  if (resolved && fs.existsSync(resolved)) return resolved;
  return null;
}

function getPanelPath(panel, ws) {
  const projectRoot = getProjectRoot(ws);
  if (!projectRoot) return null;
  return resolveReadablePanelPath(projectRoot, panel, getSessionRoot(ws, panel));
}

/**
 * Resolve a read-only panel path against an already captured project root.
 * HTTP callers have no per-connection selected-folder state, so this retains
 * getPanelPath(panel)'s null session-root semantics without consulting the
 * mutable global active-workspace cache again.
 */
function getRootBoundPanelPath(projectRoot, panel) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) return null;
  return resolveReadablePanelPath(projectRoot, panel, null);
}

/**
 * Resolve a filesystem-backed panel root for a mutation from an already
 * authoritative workspace-registry root. Unlike getPanelPath(), this path
 * never consults per-connection set_panel/session root hints.
 */
function getAuthoritativePanelPath(projectRoot, panel, { strictFilesystemErrors = false } = {}) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) return null;
  const directory = (target) => isDirectory(target, { strictFilesystemErrors });

  if (panel === '__panels__') {
    const viewsRoot = views.getViewsRoot(projectRoot);
    return directory(viewsRoot) ? viewsRoot : null;
  }
  if (panel === '__apps__') {
    const appsRoot = path.join(projectRoot, 'ai', 'apps');
    return directory(appsRoot) ? appsRoot : null;
  }
  if (panel === '__settings__') {
    const settingsRoot = aiPaths.getSystemStylesRoot(projectRoot);
    if (directory(settingsRoot)) return settingsRoot;
    const legacySettingsRoot = getLegacySettingsRoot(projectRoot);
    return directory(legacySettingsRoot) ? legacySettingsRoot : null;
  }
  if (panel === '__workspace__') {
    const workspaceRoot = path.join(aiPaths.getSystemRoot(projectRoot), 'workspace');
    if (directory(workspaceRoot)) return workspaceRoot;
    const legacyWorkspaceRoot = getLegacyWorkspaceRoot(projectRoot);
    return directory(legacyWorkspaceRoot) ? legacyWorkspaceRoot : null;
  }

  const resolved = views.resolveContentPath(projectRoot, panel, {
    includeHidden: true,
    sessionRoot: projectRoot,
    strictFilesystemErrors,
  });
  if (resolved && directory(resolved)) return resolved;
  return null;
}

module.exports = {
  sessions,
  getProjectRoot,
  setSessionRoot,
  getSessionRoot,
  clearSessionRoot,
  getPanelPath,
  getRootBoundPanelPath,
  getAuthoritativePanelPath,
  panelPathRequiresViewReadiness,
};
