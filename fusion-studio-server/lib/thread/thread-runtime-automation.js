/**
 * @module thread-runtime-automation
 * @role Headless runtime status and prompt sending for server automation callers.
 */

const { v4: generateId } = require('uuid');
const { resolveScope } = require('../chat-scope');
const { checkSettingsBounce } = require('../enforcement');
const { emit } = require('../event-bus');
const { spawnThreadWire } = require('../harness/compat');
const { createCanonicalChatEventApplier } = require('../wire/canonical-chat-event-applier');
const { createCanonicalHarnessEventBridge } = require('../wire/canonical-harness-event-bridge');
const { getWireForThread, registerWire } = require('../wire/process-manager');
const { getDb } = require('../db');
const { createAgentActivityRepository } = require('../agent-provenance/activity-repository');
const { getSharedAgentActivityOwner } = require('../agent-provenance/activity-owner');
const {
  createAgentTurnAuthorityRef,
  getAgentTurnAuthorityRef,
} = require('../agent-provenance/turn-authority');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const {
  awaitThreadManagerReady,
  getThreadManagerForTarget,
} = require('./thread-manager-registry');

function normalizeTarget(target) {
  if (!target || !target.workspaceId || !target.projectRoot || !target.threadId) {
    throw new Error('Automation target requires workspaceId, projectRoot, and threadId');
  }
  // RCC-0095: all threads are workspace-scoped ('project').
  return {
    workspaceId: target.workspaceId,
    projectRoot: target.projectRoot,
    scope: 'project',
    viewId: null,
    threadId: target.threadId,
  };
}

function getRuntimeKey(target) {
  return {
    workspaceId: target.workspaceId,
    scope: 'project',
    threadId: target.threadId,
  };
}

function getDeferReason(state) {
  if (state === RUNTIME_STATES.WARMING) return 'warming';
  if (state === RUNTIME_STATES.IN_FLIGHT) return 'in_flight';
  if (state === RUNTIME_STATES.STOPPING) return 'stopping';
  return null;
}

function getAutomationRuntimeStatus(rawTarget) {
  const target = normalizeTarget(rawTarget);
  const runtimeKey = getRuntimeKey(target);
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  const deferReason = getDeferReason(state);
  const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
  return {
    state,
    canSend: !deferReason,
    deferReason,
    hasLiveTurn: Boolean(liveTurn),
    liveTurn,
  };
}

function createHeadlessSession(target) {
  return {
    currentWorkspaceId: target.workspaceId,
    projectRoot: target.projectRoot,
    currentThreadId: target.threadId,
    currentScope: target.scope,
    currentViewId: target.viewId,
    pendingUserInput: null,
    currentTurn: null,
    assistantParts: [],
    hasToolCalls: false,
    activeToolId: null,
    toolArgs: {},
    contextUsage: null,
    tokenUsage: null,
    messageId: null,
    planMode: false,
  };
}

function createAutomationBridge(target, manager, session) {
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
    session,
    emit,
    resolveWorkspace: resolveScope,
    touchThreadSession: () => manager.touchSession(target.threadId),
    checkSettingsBounce,
    generateTurnId: () => generateId(),
    activityOwner,
  });

  return createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
    resolveTurnIdentity: (event) => {
      const pendingAuthority = session.pendingAgentTurnAuthority;
      const currentAuthority = session.currentTurn?.authority;
      const currentIsLive = currentAuthority
        && getAgentTurnAuthorityRef(currentAuthority) === currentAuthority;
      const pendingIsLive = pendingAuthority
        && getAgentTurnAuthorityRef(pendingAuthority) === pendingAuthority;
      const authority = event?.type === 'turn_begin'
        ? (pendingIsLive ? pendingAuthority : null)
          || (currentIsLive ? currentAuthority : null)
          || pendingAuthority
          || currentAuthority
        : (currentIsLive ? currentAuthority : null)
          || (pendingIsLive ? pendingAuthority : null)
          || pendingAuthority
          || currentAuthority;
      if (authority) return authority;
      return {
        workspaceId: session.currentWorkspaceId,
        threadId: session.currentThreadId,
        turnId: session.currentTurn?.id || session.pendingTurnId,
      };
    },
  });
}

async function warmAutomationRuntime(target, manager, runtimeKey) {
  const scopeContext = {
    workspaceId: target.workspaceId,
    viewId: target.viewId,
  };
  const warmPromise = (async () => {
    const wire = spawnThreadWire(target.threadId, target.projectRoot, scopeContext);
    registerWire(target.threadId, wire, target.projectRoot, null, scopeContext);
    if (wire._harnessPromise) await wire._harnessPromise;
    if (!wire._sendMessage) {
      throw new Error('Wire does not support ACP sendMessage. Legacy wire format has been retired.');
    }
    if (!wire._usesDirectCanonicalEvents) {
      throw new Error('Wire does not support direct canonical event delivery. Legacy wire format has been retired.');
    }
    await manager.openSession(target.threadId, wire, null);
    return wire;
  })();

  threadRuntimeManager.markWarming(runtimeKey, warmPromise);
  try {
    const wire = await warmPromise;
    threadRuntimeManager.markReady(runtimeKey);
    return wire;
  } catch (err) {
    threadRuntimeManager.markCold(runtimeKey);
    throw err;
  } finally {
    threadRuntimeManager.clearWarmPromise(runtimeKey);
  }
}

async function ensureAutomationWire(target, manager, runtimeKey) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.READY) {
    const wire = getWireForThread(target.threadId);
    if (wire) return wire;
    threadRuntimeManager.markCold(runtimeKey);
  } else {
    const deferReason = getDeferReason(state);
    if (deferReason) {
      const err = new Error(`Thread runtime is ${deferReason}`);
      err.deferReason = deferReason;
      throw err;
    }
  }
  return warmAutomationRuntime(target, manager, runtimeKey);
}

async function persistAutomationUserPrompt(manager, target, input) {
  await manager.addMessage(target.threadId, {
    role: 'user',
    content: input,
    hasToolCalls: false,
  });
  await manager.index.touch(target.threadId);
}

async function sendAutomationPrompt(rawTarget, input) {
  const target = normalizeTarget(rawTarget);
  const status = getAutomationRuntimeStatus(target);
  if (status.deferReason) {
    return {
      accepted: false,
      deferred: true,
      reason: status.deferReason,
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  const manager = getThreadManagerForTarget(target);
  await awaitThreadManagerReady(manager);
  const thread = await manager.getThread(target.threadId);
  if (!thread) {
    return {
      accepted: false,
      deferred: false,
      error: `Thread not found: ${target.threadId}`,
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  const runtimeKey = getRuntimeKey(target);
  let wire;
  try {
    wire = await ensureAutomationWire(target, manager, runtimeKey);
  } catch (err) {
    if (err?.deferReason) {
      return {
        accepted: false,
        deferred: true,
        reason: err.deferReason,
        threadId: target.threadId,
        scope: target.scope,
      };
    }
    return {
      accepted: false,
      deferred: false,
      error: err?.message || 'Thread warm-up failed',
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  if (threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.READY) {
    return {
      accepted: false,
      deferred: true,
      reason: getDeferReason(threadRuntimeManager.getRuntimeState(runtimeKey)) || 'in_flight',
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  threadRuntimeManager.markInFlight(runtimeKey);
  await persistAutomationUserPrompt(manager, target, input);

  const session = createHeadlessSession(target);
  session.pendingUserInput = input;
  const turnId = generateId();
  session.pendingTurnId = turnId;
  try {
    const harnessId = thread.entry?.harnessId;
    if (!harnessId || wire._harnessId !== harnessId) throw new Error('resolved harness identity mismatch');
    session.pendingAgentTurnAuthority = await createAgentTurnAuthorityRef({
      workspaceId: manager.workspaceId,
      threadId: target.threadId,
      turnId,
      harnessId,
      provider: wire._provider || harnessId,
      workspaceRoot: manager.projectRoot || target.projectRoot,
    });
  } catch {
    session.pendingAgentTurnAuthority = null;
    console.warn('[AgentProvenance] agent_turn_authority_unavailable');
  }
  const bridge = createAutomationBridge(target, manager, session);
  const turnAuthority = session.pendingAgentTurnAuthority;
  const turnApplicationContext = {
    ...session,
    wire,
    pendingAgentTurnAuthority: turnAuthority,
    pendingAttachments: Array.isArray(session.pendingAttachments)
      ? [...session.pendingAttachments]
      : [],
    currentTurn: null,
    assistantParts: [],
    hasToolCalls: false,
    toolArgs: {},
    toolNamesById: {},
    bouncedToolCalls: new Set(),
  };

  try {
    await bridge.drainHarnessEvents(wire._sendMessage(input, {}), null, {
      turnAuthority,
      turnApplicationContext,
    });
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.IN_FLIGHT) {
      threadRuntimeManager.markReady(runtimeKey);
    }
    return {
      accepted: true,
      deferred: false,
      threadId: target.threadId,
      scope: target.scope,
    };
  } catch (err) {
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.IN_FLIGHT) {
      threadRuntimeManager.markReady(runtimeKey);
    }
    return {
      accepted: false,
      deferred: false,
      error: err?.message || 'Harness send failed',
      threadId: target.threadId,
      scope: target.scope,
    };
  }
}

module.exports = {
  getAutomationRuntimeStatus,
  sendAutomationPrompt,
  _createHeadlessSession: createHeadlessSession,
  _getRuntimeKey: getRuntimeKey,
};
