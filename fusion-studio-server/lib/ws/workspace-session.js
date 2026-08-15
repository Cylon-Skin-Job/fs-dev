'use strict';

/**
 * Mirror a server-owned workspace switch into one WebSocket session.
 * Workspace lifecycle events use null for both values when no workspace is
 * active; missing values are normalized to that same inactive state.
 *
 * @param {object} session
 * @param {object|null|undefined} event
 */
function applyWorkspaceSwitchToSession(session, event) {
  session.projectRoot = event?.repoPath ?? null;
  session.currentWorkspaceId = event?.to ?? null;
}

module.exports = { applyWorkspaceSwitchToSession };
