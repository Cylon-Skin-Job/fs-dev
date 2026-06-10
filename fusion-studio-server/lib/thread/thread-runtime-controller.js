/**
 * @module thread-runtime-controller
 * @role Accept prompts through server-owned thread runtime state.
 */

const ThreadWebSocketHandler = require('./ThreadWebSocketHandler');
const { getWireForThread, unregisterWire } = require('../wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');

function getScope(clientMsg, session) {
  return clientMsg.scope === 'project' ? 'project' : (session.currentScope || 'view');
}

function getRuntimeKey(manager, scope, threadId) {
  const key = {
    workspaceId: manager.workspaceId,
    scope,
    threadId,
  };
  if (scope === 'view') {
    key.viewId = manager.viewId;
  }
  return key;
}

function sendRuntimeError(ws, message, scope, threadId, recoverable) {
  ws.send(JSON.stringify({ type: 'error', message, scope, threadId, recoverable }));
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

async function ensureReadyRuntime({ ws, session, wireLifecycle, projectRoot, spawnAndSetupWire, runtimeKey, threadId, scope, suppressBusyError = false }) {
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
      sendRuntimeError(ws, err?.message || 'Thread warm-up failed', scope, threadId, true);
      return null;
    }
  }

  if (state === RUNTIME_STATES.IN_FLIGHT || state === RUNTIME_STATES.STOPPING) {
    if (!suppressBusyError) {
      sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', scope, threadId, true);
    }
    return null;
  }

  const warmPromise = spawnAndSetupWire({
    ws,
    session,
    wireLifecycle,
    threadId,
    scope,
    projectRoot,
  });
  threadRuntimeManager.markWarming(runtimeKey, warmPromise);

  try {
    const wire = await warmPromise;
    threadRuntimeManager.markReady(runtimeKey);
    return wire;
  } catch (err) {
    threadRuntimeManager.markCold(runtimeKey);
    sendRuntimeError(ws, err?.message || 'Thread warm-up failed', scope, threadId, true);
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
  const scope = getScope(clientMsg, session);
  const threadId = clientMsg.threadId;
  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManagers?.[scope];
  if (!threadId || !manager) {
    sendRuntimeError(ws, `No active ${scope} thread`, scope, threadId, false);
    return;
  }

  const thread = await manager.getThread(threadId);
  if (!thread) {
    sendRuntimeError(ws, `Thread not found: ${threadId}`, scope, threadId, false);
    return;
  }

  const runtimeKey = getRuntimeKey(manager, scope, threadId);
  await ensureReadyRuntime({
    ws,
    session,
    wireLifecycle,
    projectRoot,
    spawnAndSetupWire,
    runtimeKey,
    threadId,
    scope,
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
  const scope = getScope(clientMsg, session);
  const threadId = clientMsg.threadId;
  console.log('[WS] PROMPT received:', clientMsg.user_input?.slice(0, 50), 'threadId:', threadId?.slice(0, 8), 'scope:', scope);

  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManagers?.[scope];
  if (!threadId || !manager) {
    sendRuntimeError(ws, `No active ${scope} thread`, scope, threadId, false);
    return;
  }

  const thread = await manager.getThread(threadId);
  if (!thread) {
    sendRuntimeError(ws, `Thread not found: ${threadId}`, scope, threadId, false);
    return;
  }

  const runtimeKey = getRuntimeKey(manager, scope, threadId);
  const wire = await ensureReadyRuntime({
    ws,
    session,
    wireLifecycle,
    projectRoot,
    spawnAndSetupWire,
    runtimeKey,
    threadId,
    scope,
  });
  if (!wire) return;

  session.currentThreadId = threadId;
  session.currentScope = scope;
  session.currentViewId = scope === 'view' ? (manager.viewId || threadState.panelId || threadState.viewName || null) : null;
  if (threadState.threadIds) {
    threadState.threadIds[scope] = threadId;
  }

  if (!wire._sendMessage) {
    sendRuntimeError(ws, 'Wire does not support ACP sendMessage. Legacy wire format has been retired.', scope, threadId, false);
    return;
  }

  if (!wire._usesDirectCanonicalEvents || !handleCanonicalHarnessEvent) {
    sendRuntimeError(ws, 'Wire does not support direct canonical event delivery. Legacy wire format has been retired.', scope, threadId, false);
    return;
  }

  if (threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.READY) {
    sendRuntimeError(ws, 'Thread runtime is busy. Wait for the current turn to finish.', scope, threadId, true);
    return;
  }

  threadRuntimeManager.markInFlight(runtimeKey);
  const accepted = await ThreadWebSocketHandler.handleMessageSend(ws, {
    content: clientMsg.user_input,
    scope,
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
          scope,
          threadId,
          message: errorMessage || 'Authentication failed. Run `kimi login` in your terminal.',
          error: err,
        }));
      } else {
        sendRuntimeError(ws, errorMessage || 'Harness send failed', scope, threadId, true);
      }
    }
  })();
}

async function stopRuntimeTurn({ ws, session, clientMsg, handleCanonicalHarnessEvent }) {
  const scope = getScope(clientMsg, session);
  const threadId = clientMsg.threadId;
  const threadState = ThreadWebSocketHandler.getState(ws);
  const manager = threadState?.threadManagers?.[scope];
  if (!threadId || !manager) {
    sendRuntimeError(ws, `No active ${scope} thread`, scope, threadId, false);
    return;
  }

  const runtimeKey = getRuntimeKey(manager, scope, threadId);
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.STOPPING) return;
  if (state !== RUNTIME_STATES.IN_FLIGHT) {
    sendRuntimeError(ws, 'Thread runtime is not currently streaming.', scope, threadId, true);
    return;
  }

  const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
  if (!liveTurn) {
    sendRuntimeError(ws, 'No live turn is available to stop.', scope, threadId, true);
    return;
  }

  const wire = getWireForThread(threadId) || (session.currentThreadId === threadId ? session.wire : null);
  threadRuntimeManager.markState(runtimeKey, RUNTIME_STATES.STOPPING);

  session.currentThreadId = threadId;
  session.currentScope = scope;
  session.currentViewId = scope === 'view' ? (manager.viewId || threadState.panelId || threadState.viewName || null) : null;
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
