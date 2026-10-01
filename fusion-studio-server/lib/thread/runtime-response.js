/** Publish bounded transport errors without disclosing caught provider values. */
const ThreadWebSocketHandler = require('./ThreadWebSocketHandler');
const SCOPE = 'project';

function sendRuntimeError(ws, message, threadId, recoverable, requestId, code) {
  const workspaceId = ThreadWebSocketHandler.getState(ws)?.threadManager?.workspaceId;
  ws.send(JSON.stringify({ type: 'error', message, scope: SCOPE, threadId, recoverable,
    ...(workspaceId ? { workspaceId } : {}),
    ...(requestId ? { requestId } : {}),
    ...(code ? { code } : {}) }));
}
function reportWarmupFailure(ws, threadId, requestId) {
  console.error('[ThreadRuntime] Thread warm-up failed', {
    threadId,
    marker: 'THREAD_WARM_UP_FAILED',
  });
  sendRuntimeError(ws, 'Thread warm-up failed', threadId, true, requestId);
}

function reportThreadLookupFailure(ws, threadId, requestId) {
  console.error('[ThreadRuntime] Thread lookup failed', {
    threadId,
    marker: 'THREAD_LOOKUP_FAILED',
  });
  sendRuntimeError(ws, 'Thread lookup failed', threadId, true, requestId);
}

function reportPromptAcceptanceFailure(ws, threadId, requestId) {
  console.error('[ThreadRuntime] Prompt acceptance failed', {
    threadId,
    marker: 'PROMPT_ACCEPTANCE_FAILED',
  });
  sendRuntimeError(ws, 'Message could not be accepted', threadId, true, requestId);
}

function reportAcceptedExecutionFailure(ws, threadId, requestId) {
  try {
    sendRuntimeError(ws, 'Accepted prompt could not start', threadId, true,
      requestId, 'accepted_execution_failed');
  } catch (_error) { /* accepted receipt remains authoritative */ }
}

function reportHarnessStopFailure(threadId, drainId) {
  console.warn('[ThreadRuntime] Harness stop failed', {
    threadId,
    drainId,
    marker: 'HARNESS_STOP_FAILED',
  });
}

function reportInterruptedSynthesisFailure(threadId, drainId) {
  console.error('[ThreadRuntime] Interrupted-turn synthesis failed', {
    threadId,
    ...(drainId ? { drainId } : {}),
    marker: 'INTERRUPTED_TURN_SYNTHESIS_FAILED',
  });
}

function reportLegacyStopFailure(threadId) {
  console.warn('[ThreadRuntime] Legacy harness stop failed', {
    threadId,
    marker: 'LEGACY_HARNESS_STOP_FAILED',
  });
}

function reportSessionRetirementFailure(threadId) {
  console.error('[ThreadRuntime] Provider session retirement failed', {
    threadId,
    marker: 'PROVIDER_SESSION_RETIREMENT_FAILED',
  });
}


module.exports = { sendRuntimeError, reportWarmupFailure, reportThreadLookupFailure, reportPromptAcceptanceFailure, reportAcceptedExecutionFailure, reportHarnessStopFailure, reportInterruptedSynthesisFailure, reportLegacyStopFailure, reportSessionRetirementFailure };
