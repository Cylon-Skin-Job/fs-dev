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

// Store active sessions (ws -> session state)
const sessions = new Map();

const sessionRoots = new Map();

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
    if (session && session.projectRoot) return session.projectRoot;
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

  // __panels__ pseudo-panel: resolves to ai/views/ (for client discovery)
  if (panel === '__panels__') {
    const viewsRoot = views.getViewsRoot(projectRoot);
    if (fs.existsSync(viewsRoot)) return viewsRoot;
    return null;
  }

  // __apps__ pseudo-panel: resolves to ai/apps/ (for client app discovery)
  if (panel === '__apps__') {
    const appsRoot = path.join(projectRoot, 'ai', 'apps');
    if (fs.existsSync(appsRoot)) return appsRoot;
    return null;
  }

  // __settings__ pseudo-panel: resolves to ai/system/styles/ (for global theme/settings)
  if (panel === '__settings__') {
    const settingsRoot = path.join(projectRoot, 'ai', 'system', 'styles');
    if (fs.existsSync(settingsRoot)) return settingsRoot;
    return null;
  }

  // __workspace__ pseudo-panel: resolves to ai/system/workspace/ for the
  // live workspace view registry.
  if (panel === '__workspace__') {
    const workspaceRoot = path.join(projectRoot, 'ai', 'system', 'workspace');
    if (fs.existsSync(workspaceRoot)) return workspaceRoot;
    return null;
  }

  // Delegate to the view resolver system.
  // Each display type has its own resolver module that knows where
  // the content root is for that view type.
  const context = { sessionRoot: getSessionRoot(ws, panel) };
  const resolved = views.resolveContentPath(projectRoot, panel, context);
  if (resolved && fs.existsSync(resolved)) return resolved;

  // Fallback: raw ai/views/{id}/ folder (for views not yet in the system)
  const fallback = path.join(views.getViewsRoot(projectRoot), panel);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

module.exports = {
  sessions,
  getProjectRoot,
  setSessionRoot,
  getSessionRoot,
  clearSessionRoot,
  getPanelPath,
};
