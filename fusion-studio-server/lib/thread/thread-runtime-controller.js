/**
 * @module thread-runtime-controller
 * @role Accept prompts through server-owned thread runtime state.
 */

const ThreadWebSocketHandler = require('./ThreadWebSocketHandler');
const { attachClientToWire, getWireForThread, unregisterWire } = require('../wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { randomUUID } = require('crypto');
const {
  createAgentTurnAuthorityRef,
  getAgentTurnAuthorityRef,
  releaseAgentTurnAuthorityRef,
} = require('../agent-provenance/turn-authority');

// RCC-0095: all threads are workspace-scoped. The 'project' scope literal
// is kept on runtime keys and outbound messages for wire compatibility.
const SCOPE = 'project';

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      kind: typeof item.kind === 'string' ? item.kind : 'file',
      label: typeof item.label === 'string' ? item.label : 'attachment',
      path: typeof item.path === 'string' ? item.path : '',
      sourceName: typeof item.sourceName === 'string' ? item.sourceName : (typeof item.label === 'string' ? item.label : 'attachment'),
      ...(typeof item.panel === 'string' ? { panel: item.panel } : {}),
      ...(typeof item.relativePath === 'string' ? { relativePath: item.relativePath } : {}),
    }))
    .filter((item) => item.path);
}

/**
 * Extract the model/effort selection from a client-provided harnessConfig.
 * Only model and variant are writable per-prompt; everything else is left
 * untouched so session continuity fields are never clobbered.
 * @returns {object|null}
 */
function extractSelectionPatch(harnessConfig) {
  if (!harnessConfig || typeof harnessConfig !== 'object') return null;
  const patch = {};
  if (typeof harnessConfig.model === 'string' && harnessConfig.model.trim()) {
    patch.model = harnessConfig.model.trim();
  }
  if (typeof harnessConfig.variant === 'string' && harnessConfig.variant.trim()) {
    patch.variant = harnessConfig.variant.trim();
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function serializeAttachmentsForHarness(userInput, attachments) {
  if (!attachments.length) return userInput;
  const lines = attachments.map((attachment) => `- ${attachment.label}: ${attachment.path}`);
  return `${userInput}\n\nAttached references:\n${lines.join('\n')}`;
}

function getRuntimeKey(manager, threadId) {
  return {
    workspaceId: manager.workspaceId,
    scope: SCOPE,
    threadId,
  };
}

function sendRuntimeError(ws, message, threadId, recoverable) {
  ws.send(JSON.stringify({ type: 'error', message, scope: SCOPE, threadId, recoverable }));
}

function markReadyIfRuntimeStillActive(runtimeKey) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.IN_FLIGHT) {
    threadRuntimeManager.markReady(runtimeKey);
  }
}

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

async function stopWire(wire, threadId) {
  const bounded = (promise, timeoutMs) => new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, timeoutMs);
    timer.unref?.();
    Promise.resolve(promise).then(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(true);
    }, () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(false);
    });
  });
  try {
    if (wire._stopSession) {
      const stopped = await bounded(wire._stopSession('SIGTERM'), 2_000);
      if (!stopped) await bounded(wire._stopSession('SIGKILL'), 1_000);
    } else if (wire.stop) {
      const stopped = await bounded(wire.stop('SIGTERM'), 2_000);
      if (!stopped) await bounded(wire.stop('SIGKILL'), 1_000);
    } else if (wire.kill) {
      wire.kill('SIGTERM');
      const closed = await bounded(new Promise((resolve) => wire.once?.('close', resolve)), 2_000);
      if (!closed) {
        wire.kill('SIGKILL');
        await bounded(new Promise((resolve) => wire.once?.('close', resolve)), 1_000);
      }
    }
  } finally {
    unregisterWire(threadId);
  }
}

async function ensureReadyRuntime({ ws, session, wireLifecycle, projectRoot, spawnAndSetupWire, runtimeKey, threadId, suppressBusyError = false }) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);

  if (state === RUNTIME_STATES.READY) {
    const readyWire = getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);
    if (readyWire && !readyWire.killed) return readyWire;
    if (readyWire?.killed) {
      console.warn(`[ThreadRuntime] Discarding closed ready wire for thread ${threadId}; warming a replacement`);
      if (getWireForThread(threadId) === readyWire) unregisterWire(threadId);
      if (session.wire === readyWire) session.wire = null;
    }
    threadRuntimeManager.markCold(runtimeKey);
  }

  if (state === RUNTIME_STATES.WARMING) {
    try {
      const warmedWire = await threadRuntimeManager.getWarmPromise(runtimeKey);
      return warmedWire || getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);
    } catch (err) {
      threadRuntimeManager.markCold(runtimeKey);
      sendRuntimeError(ws, err?.message || 'Thread warm-up failed', threadId, true);
      return null;
    }
  }

  if (state === RUNTIME_STATES.IN_FLIGHT || state === RUNTIME_STATES.STOPPING) {
    if (!suppressBusyError) {
      sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', threadId, true);
    }
    return null;
  }

  const warmPromise = spawnAndSetupWire({
    ws,
    session,
    wireLifecycle,
    threadId,
    projectRoot,
  });
  threadRuntimeManager.markWarming(runtimeKey, warmPromise);

  try {
    const wire = await warmPromise;
    threadRuntimeManager.markReady(runtimeKey);
    return wire;
  } catch (err) {
    threadRuntimeManager.markCold(runtimeKey);
    sendRuntimeError(ws, err?.message || 'Thread warm-up failed', threadId, true);
    return null;
  } finally {
    threadRuntimeManager.clearWarmPromise(runtimeKey);
  }
}

async function warmRuntimeForIntent({
  ws,
  session,
  clientMsg,
  wireLifecycle,
  projectRoot,
  spawnAndSetupWire,
}) {
  const threadId = clientMsg.threadId;
  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManager;
  if (!threadId || !manager) {
    sendRuntimeError(ws, 'No active thread', threadId, false);
    return;
  }

  const thread = await manager.getThread(threadId);
  if (!thread) {
    sendRuntimeError(ws, `Thread not found: ${threadId}`, threadId, false);
    return;
  }

  const runtimeKey = getRuntimeKey(manager, threadId);
  await ensureReadyRuntime({
    ws,
    session,
    wireLifecycle,
    projectRoot,
    spawnAndSetupWire,
    runtimeKey,
    threadId,
    suppressBusyError: true,
  });
}

async function acceptPromptThroughRuntime({
  ws,
  session,
  clientMsg,
  wireLifecycle,
  projectRoot,
  spawnAndSetupWire,
  handleCanonicalHarnessEvent,
}) {
  const threadId = clientMsg.threadId;
  console.log('[WS] PROMPT received:', clientMsg.user_input?.slice(0, 50), 'threadId:', threadId?.slice(0, 8));

  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManager;
  if (!threadId || !manager) {
    sendRuntimeError(ws, 'No active thread', threadId, false);
    return;
  }

  const thread = await manager.getThread(threadId);
  if (!thread) {
    sendRuntimeError(ws, `Thread not found: ${threadId}`, threadId, false);
    return;
  }

  // Apply per-prompt model/effort selection to the thread before the turn.
  // Persists into harness_config so cold restarts keep the selection.
  const selectionPatch = extractSelectionPatch(clientMsg.harnessConfig);
  if (selectionPatch) {
    try {
      await manager.updateHarnessConfig(threadId, selectionPatch);
    } catch (err) {
      console.error('[WS] Failed to persist harnessConfig selection:', err?.message || err);
    }
  }

  const runtimeKey = getRuntimeKey(manager, threadId);
  const wire = await ensureReadyRuntime({
    ws,
    session,
    wireLifecycle,
    projectRoot,
    spawnAndSetupWire,
    runtimeKey,
    threadId,
  });
  if (!wire) return;

  session.currentThreadId = threadId;
  session.currentScope = SCOPE;
  session.currentViewId = null;
  threadState.threadId = threadId;

  if (!wire._sendMessage) {
    sendRuntimeError(ws, 'Wire does not support ACP sendMessage. Legacy wire format has been retired.', threadId, false);
    return;
  }

  if (!wire._usesDirectCanonicalEvents || !handleCanonicalHarnessEvent) {
    sendRuntimeError(ws, 'Wire does not support direct canonical event delivery. Legacy wire format has been retired.', threadId, false);
    return;
  }

  // Push the per-prompt model/effort selection live onto the wire so the
  // current session picks it up without a re-spawn.
  if (selectionPatch && typeof wire._applyHarnessConfig === 'function') {
    wire._applyHarnessConfig(selectionPatch);
  }

  if (threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.READY) {
    sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', threadId, true);
    return;
  }

  threadRuntimeManager.markInFlight(runtimeKey);
  const attachments = normalizeAttachments(clientMsg.attachments);
  const harnessInput = serializeAttachmentsForHarness(clientMsg.user_input, attachments);
  const accepted = await ThreadWebSocketHandler.handleMessageSend(ws, {
    content: clientMsg.user_input,
  });
  if (!accepted) {
    threadRuntimeManager.markReady(runtimeKey);
    return;
  }
  console.log('[WS] Message accepted by runtime and tracked in thread');

  const turnId = randomUUID();
  session.pendingTurnId = turnId;
  try {
    const harnessId = thread.entry?.harnessId;
    if (!harnessId || wire._harnessId !== harnessId) throw new Error('resolved harness identity mismatch');
    session.pendingAgentTurnAuthority = await createAgentTurnAuthorityRef({
      workspaceId: manager.workspaceId,
      threadId,
      turnId,
      harnessId,
      provider: wire._provider || harnessId,
      workspaceRoot: manager.projectRoot,
    });
  } catch {
    session.pendingAgentTurnAuthority = null;
    console.warn('[AgentProvenance] agent_turn_authority_unavailable');
  }

  attachClientToWire(threadId, wire, projectRoot, ws, {
    workspaceId: session.currentWorkspaceId,
    viewId: null,
  });

  session.pendingUserInput = clientMsg.user_input;
  session.pendingAttachments = attachments;
  const turnAuthority = session.pendingAgentTurnAuthority;
  const acceptedPrompt = {
    turnId,
    authority: turnAuthority,
    userInput: clientMsg.user_input,
    attachments,
  };
  const turnApplicationContext = {
    ...session,
    currentWorkspaceId: manager.workspaceId,
    currentThreadId: threadId,
    projectRoot: manager.projectRoot || projectRoot,
    wire,
    pendingAgentTurnAuthority: turnAuthority,
    pendingTurnId: turnId,
    pendingUserInput: clientMsg.user_input,
    pendingAttachments: [...attachments],
    currentTurn: null,
    assistantParts: [],
    hasToolCalls: false,
    toolArgs: {},
    toolNamesById: {},
    bouncedToolCalls: new Set(),
  };

  (async () => {
    try {
      if (typeof handleCanonicalHarnessEvent.drainHarnessEvents === 'function') {
        await handleCanonicalHarnessEvent.drainHarnessEvents(wire._sendMessage(harnessInput, {}), ws, {
          turnAuthority,
          turnApplicationContext,
        });
      } else {
        for await (const event of wire._sendMessage(harnessInput, {})) {
          await handleCanonicalHarnessEvent(event, ws);
        }
      }
      markReadyIfRuntimeStillActive(runtimeKey);
    } catch (err) {
      markReadyIfRuntimeStillActive(runtimeKey);
      console.error('[WS] Harness sendMessage failed:', err);
      const errorMessage = err?.message || '';
      if (err?.code === -32004 || /Authentication failed/i.test(errorMessage)) {
        ws.send(JSON.stringify({
          type: 'auth_error',
          scope: SCOPE,
          threadId,
          message: errorMessage || 'Authentication failed. Run `kimi login` in your terminal.',
          error: err,
        }));
      } else {
        sendRuntimeError(ws, errorMessage || 'Harness send failed', threadId, true);
      }
    } finally {
      clearAcceptedPromptIfOwned(session, acceptedPrompt);
      releaseAgentTurnAuthorityRef(turnAuthority);
      disposeTurnApplicationContext(turnApplicationContext);
    }
  })();
}

async function stopRuntimeTurn({ ws, session, clientMsg, handleCanonicalHarnessEvent }) {
  const threadId = clientMsg.threadId;
  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManager;
  if (!threadId || !manager) {
    sendRuntimeError(ws, 'No active thread', threadId, false);
    return;
  }

  const runtimeKey = getRuntimeKey(manager, threadId);
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.STOPPING) return;
  if (state !== RUNTIME_STATES.IN_FLIGHT) {
    sendRuntimeError(ws, 'Thread runtime is not currently streaming.', threadId, true);
    return;
  }

  const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
  if (!liveTurn) {
    sendRuntimeError(ws, 'No live turn is available to stop.', threadId, true);
    return;
  }

  const wire = getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);
  threadRuntimeManager.markState(runtimeKey, RUNTIME_STATES.STOPPING);

  const authority = getAgentTurnAuthorityRef({
    workspaceId: manager.workspaceId,
    threadId,
    turnId: liveTurn.turnId,
  });
  const stopIdentity = authority || {
    workspaceId: manager.workspaceId,
    threadId,
    turnId: liveTurn.turnId,
  };
  const pendingAuthority = session.pendingAgentTurnAuthority;
  const pendingBelongsToStop = session.pendingTurnId === liveTurn.turnId
    && (authority
      ? pendingAuthority === authority
      : (!pendingAuthority
        ? session.currentThreadId === threadId
        : pendingAuthority.workspaceId === manager.workspaceId
          && pendingAuthority.threadId === threadId
          && pendingAuthority.turnId === liveTurn.turnId));
  const pendingOwnership = pendingBelongsToStop ? {
    turnId: liveTurn.turnId,
    authority: pendingAuthority,
    userInput: session.pendingUserInput,
    attachments: session.pendingAttachments,
  } : null;
  const hasOwnedFinalizer = typeof handleCanonicalHarnessEvent?.finalizeTurn === 'function';
  const canReconstructWithoutNavigationLoss = !hasOwnedFinalizer
    && (!session.currentThreadId || session.currentThreadId === threadId)
    && (!session.currentTurn || session.currentTurn.id === liveTurn.turnId);
  if (canReconstructWithoutNavigationLoss
    && (!session.currentTurn || session.currentTurn.id !== liveTurn.turnId)) {
    if (!session.currentThreadId) session.currentThreadId = threadId;
    session.currentTurn = {
      id: liveTurn.turnId,
      text: liveTurn.fullText || '',
      userInput: liveTurn.userInput || '',
    };
    session.assistantParts = Array.isArray(liveTurn.parts) ? liveTurn.parts : [];
    session.hasToolCalls = session.assistantParts.some(part => part.type === 'tool_call');
  }
  if (session.currentTurn?.id === liveTurn.turnId && !session.currentTurn.authority && authority) {
    Object.defineProperty(session.currentTurn, 'authority', {
      value: authority,
      enumerable: false,
    });
  }
  const baseTurnOwnership = captureBaseTurnOwnership(session, {
    workspaceId: manager.workspaceId,
    threadId,
    turnId: liveTurn.turnId,
    authority,
  });

  let finalization = Promise.resolve();
  if (handleCanonicalHarnessEvent) {
    const terminalEvent = {
      type: 'turn_end',
      reason: 'interrupted',
      partial: true,
    };
    finalization = hasOwnedFinalizer
      ? Promise.resolve(handleCanonicalHarnessEvent.finalizeTurn(terminalEvent, ws, stopIdentity))
      : Promise.resolve(handleCanonicalHarnessEvent(terminalEvent, ws));
  }

  let stopping = Promise.resolve();
  if (wire) {
    stopping = stopWire(wire, threadId).then(() => {
      if (session.wire === wire) session.wire = null;
    });
  }
  await Promise.allSettled([finalization, stopping]);
  if (pendingOwnership) clearAcceptedPromptIfOwned(session, pendingOwnership);
  clearBaseTurnIfOwned(session, {
    threadId,
    turnId: liveTurn.turnId,
    authority,
  }, baseTurnOwnership);
  releaseAgentTurnAuthorityRef(authority);
  threadRuntimeManager.markCold(runtimeKey);
}

module.exports = {
  acceptPromptThroughRuntime,
  ensureReadyRuntime,
  getRuntimeKey,
  stopRuntimeTurn,
  warmRuntimeForIntent,
};
