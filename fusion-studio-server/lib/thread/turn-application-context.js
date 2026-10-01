/** Clear only the exact accepted turn application state. */

function clearAcceptedPromptIfOwned(session, acceptedPrompt) {
  if (session.pendingTurnId !== acceptedPrompt.turnId
    || session.pendingAgentTurnAuthority !== acceptedPrompt.authority
    || session.pendingUserInput !== acceptedPrompt.userInput
    || session.pendingAttachments !== acceptedPrompt.attachments) return false;
  session.pendingTurnId = null;
  session.pendingAgentTurnAuthority = null;
  session.pendingUserInput = null;
  session.pendingAttachments = [];
  return true;
}

function captureBaseTurnOwnership(session, identity) {
  const turn = session.currentTurn;
  if (!turn || turn.id !== identity.turnId || session.currentThreadId !== identity.threadId) return null;
  if (turn.authority && identity.authority && turn.authority !== identity.authority) return null;
  if (turn.authority && !identity.authority
    && (turn.authority.workspaceId !== identity.workspaceId
      || turn.authority.threadId !== identity.threadId
      || turn.authority.turnId !== identity.turnId)) return null;
  return {
    currentTurn: turn,
    assistantParts: session.assistantParts,
  };
}

function clearBaseTurnIfOwned(session, identity, ownership) {
  if (!ownership || session.currentThreadId !== identity.threadId) return false;
  const stillOwned = session.currentTurn === ownership.currentTurn
    && session.assistantParts === ownership.assistantParts;
  const clearedByOwnedFinalizer = session.currentTurn === null
    && Array.isArray(session.assistantParts)
    && session.assistantParts.length === 0;
  if (!stillOwned && !clearedByOwnedFinalizer) return false;
  if (stillOwned) {
    session.currentTurn = null;
    session.assistantParts = [];
  }
  session.hasToolCalls = false;
  session.activeToolId = null;
  session.activeToolName = null;
  session.toolArgs = {};
  session.toolNamesById = {};
  session.bouncedToolCalls = new Set();
  session.contextUsage = null;
  session.tokenUsage = null;
  session.messageId = null;
  session.planMode = false;
  return true;
}

function disposeTurnApplicationContext(context) {
  delete context.connectionRole;
  context.pendingTurnId = null;
  context.pendingAgentTurnAuthority = null;
  context.pendingUserInput = null;
  context.pendingAttachments = [];
  context.currentTurn = null;
  context.assistantParts = [];
  context.hasToolCalls = false;
  context.activeToolId = null;
  context.activeToolName = null;
  context.toolArgs = {};
  context.toolNamesById = {};
  context.bouncedToolCalls = new Set();
  context.contextUsage = null;
  context.tokenUsage = null;
  context.messageId = null;
  context.planMode = false;
  context.wire = null;
  context.projectRoot = null;
}

function projectSessionForTurn(session) {
  const projected = {};
  for (const key of Object.keys(session)) {
    if (key === 'connectionRole') continue;
    projected[key] = session[key];
  }
  return projected;
}


module.exports = { clearAcceptedPromptIfOwned, captureBaseTurnOwnership, clearBaseTurnIfOwned, disposeTurnApplicationContext, projectSessionForTurn };
