/**
 * @module thread-runtime-controller
 * @role Accept prompts through server-owned thread runtime state.
 */

const ThreadWebSocketHandler = require('./ThreadWebSocketHandler');
const { getWireForThread, unregisterWire } = require('../wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');

// RCC-0095: all threads are workspace-scoped. The 'project' scope literal
// is kept on runtime keys and outbound messages for wire compatibility.
const SCOPE = 'project';

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

async function stopWire(wire, threadId) {
  try {
    if (wire._stopSession) {
      await wire._stopSession();
    } else if (wire.stop) {
      await wire.stop();
    } else if (wire.kill) {
      wire.kill('SIGTERM');
    }
  } finally {
    unregisterWire(threadId);
  }
}

async function ensureReadyRuntime({ ws, session, wireLifecycle, projectRoot, spawnAndSetupWire, runtimeKey, threadId, suppressBusyError = false }) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);

  if (state === RUNTIME_STATES.READY) {
    const readyWire = getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);
    if (readyWire) return readyWire;
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

  if (threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.READY) {
    sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', threadId, true);
    return;
  }

  threadRuntimeManager.markInFlight(runtimeKey);
  const accepted = await ThreadWebSocketHandler.handleMessageSend(ws, {
    content: clientMsg.user_input,
  });
  if (!accepted) {
    threadRuntimeManager.markReady(runtimeKey);
    return;
  }
  console.log('[WS] Message accepted by runtime and tracked in thread');

  session.pendingUserInput = clientMsg.user_input;

  (async () => {
    try {
      for await (const event of wire._sendMessage(clientMsg.user_input, {})) {
        handleCanonicalHarnessEvent(event, ws);
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

  session.currentThreadId = threadId;
  session.currentScope = SCOPE;
  session.currentViewId = null;
  if (!session.currentTurn || session.currentTurn.id !== liveTurn.turnId) {
    session.currentTurn = {
      id: liveTurn.turnId,
      text: liveTurn.fullText || '',
      userInput: liveTurn.userInput || '',
    };
    session.assistantParts = Array.isArray(liveTurn.parts) ? liveTurn.parts : [];
    session.hasToolCalls = session.assistantParts.some(part => part.type === 'tool_call');
  }

  if (handleCanonicalHarnessEvent) {
    handleCanonicalHarnessEvent({
      type: 'turn_end',
      reason: 'interrupted',
      partial: true,
    }, ws);
  }

  if (wire) {
    await stopWire(wire, threadId);
    if (session.wire === wire) session.wire = null;
  }
  threadRuntimeManager.markCold(runtimeKey);
}

module.exports = {
  acceptPromptThroughRuntime,
  ensureReadyRuntime,
  getRuntimeKey,
  stopRuntimeTurn,
  warmRuntimeForIntent,
};
