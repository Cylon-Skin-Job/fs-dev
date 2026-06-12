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
  async function persistAssistantMessage(_ws, content, hasToolCalls, metadata, explicitThreadId) {
    const threadId = explicitThreadId || target.threadId;
    const message = { role: 'assistant', content, hasToolCalls };
    if (metadata && Object.keys(metadata).length > 0) {
      await manager.addMessageWithMetadata(threadId, message, metadata);
    } else {
      await manager.addMessage(threadId, message);
    }
  }

  const applier = createCanonicalChatEventApplier({
    session,
    emit,
    resolveWorkspace: resolveScope,
    touchThreadSession: () => manager.touchSession(target.threadId),
    persistAssistantMessage,
    checkSettingsBounce,
    generateTurnId: () => generateId(),
  });

  return createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
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
  const bridge = createAutomationBridge(target, manager, session);

  try {
    await bridge.drainHarnessEvents(wire._sendMessage(input, {}), null);
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
