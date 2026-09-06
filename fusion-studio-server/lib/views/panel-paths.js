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

function isDirectory(targetPath, { strictFilesystemErrors = false } = {}) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (error) {
    if (strictFilesystemErrors && !['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error;
    return false;
  }
}

function readJson(filePath, { strictFilesystemErrors = false } = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (strictFilesystemErrors && error?.code && error.code !== 'ENOENT') throw error;
    return null;
  }
}

function getLegacyViewsRoot(projectRoot) {
  return path.join(projectRoot, 'ai', 'views');
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

function resolveLegacyRelativePath(projectRoot, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) return null;
  const resolved = path.resolve(projectRoot, relativePath);
  const relative = path.relative(path.resolve(projectRoot), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function resolveLegacyPanelContentPath(
  projectRoot,
  panel,
  context = {},
  { strictFilesystemErrors = false } = {},
) {
  const directory = (target) => isDirectory(target, { strictFilesystemErrors });
  const hasV2Views = strictFilesystemErrors
    ? directory(views.getViewsRoot(projectRoot))
    : views.hasV2Views(projectRoot);
  if (hasV2Views) return null;

  const legacyViewRoot = path.join(getLegacyViewsRoot(projectRoot), panel);
  if (!directory(legacyViewRoot)) return null;

  const readOptions = { strictFilesystemErrors };
  const contentConfig = readJson(path.join(legacyViewRoot, 'content.json'), readOptions) || {};
  const indexConfig = readJson(path.join(legacyViewRoot, 'index.json'), readOptions) || {};
  const display = contentConfig.display || indexConfig.type;

  if (panel === 'file-viewer' || display === 'file-explorer') {
    return context.sessionRoot || projectRoot;
  }

  const declaredRoot = contentConfig.root || indexConfig.settings?.contentDir || indexConfig.settings?.systemWikiDir;
  if (typeof declaredRoot === 'string') {
    const resolved = resolveLegacyRelativePath(projectRoot, declaredRoot);
    if (resolved && directory(resolved)) return resolved;
  }

  const wikiRoot = path.join(legacyViewRoot, 'Wiki');
  if ((panel === 'wiki-viewer' || display === 'wiki' || display === 'navigation') && directory(wikiRoot)) {
    return wikiRoot;
  }

  const contentRoot = path.join(legacyViewRoot, 'content');
  if (directory(contentRoot)) return contentRoot;

  return legacyViewRoot;
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

function getPanelPath(panel, ws) {
  const projectRoot = getProjectRoot(ws);
  if (!projectRoot) return null;

  // __panels__ pseudo-panel: resolves to ai/<machine>/Views/ (for client discovery)
  if (panel === '__panels__') {
    const viewsRoot = views.getViewsRoot(projectRoot);
    if (isDirectory(viewsRoot)) return viewsRoot;
    const legacyViewsRoot = getLegacyViewsRoot(projectRoot);
    if (isDirectory(legacyViewsRoot)) return legacyViewsRoot;
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
  const context = { sessionRoot: getSessionRoot(ws, panel) };
  const resolved = views.resolveContentPath(projectRoot, panel, context);
  if (resolved && fs.existsSync(resolved)) return resolved;
  const legacyResolved = resolveLegacyPanelContentPath(projectRoot, panel, context);
  if (legacyResolved && fs.existsSync(legacyResolved)) return legacyResolved;

  return null;
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
    if (directory(viewsRoot)) return viewsRoot;
    const legacyViewsRoot = getLegacyViewsRoot(projectRoot);
    return directory(legacyViewsRoot) ? legacyViewsRoot : null;
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
  const legacyResolved = resolveLegacyPanelContentPath(
    projectRoot,
    panel,
    { sessionRoot: projectRoot },
    { strictFilesystemErrors },
  );
  return legacyResolved && directory(legacyResolved) ? legacyResolved : null;
}

module.exports = {
  sessions,
  getProjectRoot,
  setSessionRoot,
  getSessionRoot,
  clearSessionRoot,
  getPanelPath,
  getAuthoritativePanelPath,
};
