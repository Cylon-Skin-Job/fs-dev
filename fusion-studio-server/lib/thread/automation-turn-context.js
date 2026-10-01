/** Compose headless canonical event application context. */
const { v4: generateId } = require('uuid');
const { emit } = require('../event-bus');
const { checkSettingsBounce } = require('../enforcement');
const { getDb } = require('../db');
const { createAgentActivityRepository } = require('../agent-provenance/activity-repository');
const { getSharedAgentActivityOwner } = require('../agent-provenance/activity-owner');
const { createCanonicalChatEventApplier } = require('../wire/canonical-chat-event-applier');
const { createCanonicalHarnessEventBridge } = require('../wire/canonical-harness-event-bridge');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
function createHeadlessTurnApplicationContext(target, wire, turnAuthority, turnId, input) {
  return {
    currentWorkspaceId: target.workspaceId,
    projectRoot: turnAuthority?.canonicalRoot || target.projectRoot,
    currentThreadId: target.threadId,
    currentScope: target.scope,
    currentViewId: target.viewId,
    pendingUserInput: input,
    pendingTurnId: turnId,
    pendingAgentTurnAuthority: turnAuthority,
    pendingAttachments: [],
    currentTurn: null,
    assistantParts: [],
    hasToolCalls: false,
    activeToolId: null,
    activeToolName: null,
    toolArgs: {},
    toolNamesById: {},
    bouncedToolCalls: new Set(),
    contextUsage: null,
    tokenUsage: null,
    messageId: null,
    planMode: false,
    wire,
  };
}

function disposeTurnApplicationContext(context) {
  context.pendingTurnId = null;
  context.pendingAgentTurnAuthority = null;
  context.pendingUserInput = null;
  context.pendingAttachments = [];
  context.currentTurn = null;
  context.assistantParts = [];
  context.wire = null;
  context.projectRoot = null;
}

function createAutomationBridge(turnAuthority = null) {
  let activityOwner = null;
  try {
    const db = getDb();
    const activityRepository = createAgentActivityRepository(db, {
      onDiagnostic: (code) => console.warn(`[AgentProvenance] ${code}`),
    });
    activityOwner = getSharedAgentActivityOwner({
      db,
      activityRepository,
      onDiagnostic: (code) => console.warn(`[AgentProvenance] ${code}`),
    });
  } catch {
    console.warn('[AgentProvenance] agent_activity_owner_unavailable');
  }
  const applier = createCanonicalChatEventApplier({
    emit,
    checkSettingsBounce,
    generateTurnId: () => generateId(),
    activityOwner,
  });

  return createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
    bindDrainTurn: (drainContext, turnId) => threadRuntimeManager.bindTurnToDrain(
      drainContext.control.runtimeKey,
      drainContext.control.drainId,
      turnId
    ),
    resolveTurnIdentity: () => turnAuthority,
  });
}

module.exports = { createHeadlessTurnApplicationContext, disposeTurnApplicationContext, createAutomationBridge };
