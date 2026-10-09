/**
 * Chat scope — resolve the structured workspace string that every chat:*
 * event carries on the Universal Event Bus.
 *
 * See docs/CHAT_SCOPE_SPEC.md.
 *
 *   workspace:<workspace_id>                       ← workspace-universal
 *   workspace:<workspace_id>, <viewer-folder>      ← view-bound
 */

function resolveScope(session) {
  const workspaceId = session?.currentWorkspaceId;
  if (!workspaceId) return 'workspace:unknown';

  if (session.currentScope === 'view' && session.currentViewId) {
    return `workspace:${workspaceId}, ${session.currentViewId}`;
  }
  return `workspace:${workspaceId}`;
}

function parseScope(scope) {
  const parts = scope.split(', ');
  return {
    workspaceId: parts[0].replace('workspace:', ''),
    viewId: parts[1] || null,
    isViewBound: parts.length > 1,
  };
}

module.exports = { resolveScope, parseScope };
