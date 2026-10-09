/** Admit an interactive prompt through its durable receipt before dispatch. */
const { captureRuntimeTarget, activationBindingIsCurrent } = require('./runtime-session-binding');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { randomUUID } = require('crypto');
const { attachClientToWire } = require('../wire/process-manager');
const { normalizeRouteAttachments } = require('./canonical-drain-context');
const promptSubmission = require('./prompt-submission-service');
const { getRuntimeKey } = require('./runtime-identity');
const { ensureReadyRuntime } = require('./runtime-activation');
const { dispatchAcceptedTurn } = require('./runtime-dispatch');
const { sendRuntimeError, reportWarmupFailure, reportThreadLookupFailure, reportPromptAcceptanceFailure, reportAcceptedExecutionFailure } = require('./runtime-response');
const SCOPE = 'project';

function extractSelectionPatch(harnessConfig) {
  if (!harnessConfig || typeof harnessConfig !== 'object') return null;
  const patch = {};
  if (typeof harnessConfig.model === 'string' && harnessConfig.model.trim()) {
    patch.model = harnessConfig.model.trim();
  }
  if (typeof harnessConfig.variant === 'string' && harnessConfig.variant.trim()) {
    patch.variant = harnessConfig.variant.trim();
  } else if (harnessConfig.variant === null) {
    patch.variant = null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function serializeAttachmentsForHarness(userInput, attachments) {
  if (!attachments.length) return userInput;
  const lines = attachments.map((attachment) => `- ${attachment.label}: ${attachment.path}`);
  return `${userInput}\n\nAttached references:\n${lines.join('\n')}`;
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
  const requestId = clientMsg.requestId;

  const target = captureRuntimeTarget(ws, session, projectRoot);
  if (!threadId || !target) {
    sendRuntimeError(ws, 'No active thread', threadId, false, requestId);
    return;
  }
  const workspaceBinding = target.binding;
  if (!activationBindingIsCurrent(ws, workspaceBinding)) {
    sendRuntimeError(ws, 'Workspace unavailable for thread activation', threadId, false, requestId);
    return;
  }
  if (typeof clientMsg.user_input !== 'string' || !clientMsg.user_input) {
    sendRuntimeError(ws, 'Prompt requires a non-empty user_input', threadId, false, requestId);
    return;
  }

  const receiptIdentity = { workspaceId: target.workspaceId, threadId, requestId };
  const admission = await promptSubmission.begin(receiptIdentity, clientMsg);
  if (admission.replayed) {
    if (admission.ok) {
      ws.send(JSON.stringify({ type: 'message:sent', workspaceId: target.workspaceId,
        threadId, scope: SCOPE, requestId,
        turnId: admission.receipt.turnId, content: admission.receipt.content }));
    } else {
      sendRuntimeError(ws, admission.code === 'cancelled' ? 'Prompt cancelled before acceptance'
        : 'Prompt could not be accepted', threadId, true, requestId);
    }
    return;
  }
  if (!admission.ok) {
    sendRuntimeError(ws, admission.code === 'request_mismatch'
      ? 'Request reused with different input' : 'Prompt request invalid', threadId, false,
    requestId, admission.code);
    return;
  }
  const rejectReserved = async (reason) => promptSubmission.reject(receiptIdentity, reason);

  let thread;
  try {
    thread = await target.getThread(threadId);
  } catch {
    await rejectReserved('thread_lookup_failed');
    reportThreadLookupFailure(ws, threadId, requestId);
    return;
  }
  if (!thread) {
    await rejectReserved('thread_not_found');
    sendRuntimeError(ws, `Thread not found: ${threadId}`, threadId, false, requestId);
    return;
  }
  if (!activationBindingIsCurrent(ws, workspaceBinding)) {
    await rejectReserved('workspace_changed');
    sendRuntimeError(ws, 'Workspace unavailable for thread activation', threadId, false, requestId);
    return;
  }
  const selectionPatch = extractSelectionPatch(clientMsg.harnessConfig);
  if (selectionPatch) {
    try {
      await target.updateHarnessConfig(threadId, selectionPatch);
    } catch (err) {
      console.error('[WS] Failed to persist harnessConfig selection');
    }
  }

  const runtimeKey = getRuntimeKey(target, threadId, workspaceBinding.workspaceEpoch);
  let reservation;
  let wire;
  let ownership;
  try {
    reservation = await ensureReadyRuntime({
      ws,
      session,
      wireLifecycle,
      projectRoot,
      spawnAndSetupWire,
      runtimeKey,
      threadId,
      workspaceBinding,
      target,
      reserveForPrompt: true,
      requestId,
    });
  } catch (_error) {
    await rejectReserved('activation_failed');
    reportWarmupFailure(ws, threadId, requestId);
    return;
  }
  ({ wire, ownership } = reservation || {});
  const current = () => threadRuntimeManager.isOwnershipCurrent(ownership)
    && activationBindingIsCurrent(ws, workspaceBinding);
  if (!wire || !current()) {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    await rejectReserved('activation_failed');
    return;
  }

  if (!wire._sendMessage) {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    await rejectReserved('send_unavailable');
    sendRuntimeError(ws, 'Wire does not support ACP sendMessage. Legacy wire format has been retired.', threadId, false, requestId);
    return;
  }

  if (!wire._usesDirectCanonicalEvents || !handleCanonicalHarnessEvent) {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    await rejectReserved('canonical_delivery_unavailable');
    sendRuntimeError(ws, 'Wire does not support direct canonical event delivery. Legacy wire format has been retired.', threadId, false, requestId);
    return;
  }
  if (selectionPatch && typeof wire._applyHarnessConfig === 'function') {
    try {
      wire._applyHarnessConfig(selectionPatch);
    } catch (_error) {
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
      await rejectReserved('selection_failed');
      reportPromptAcceptanceFailure(ws, threadId, requestId);
      return;
    }
  }

  const attachments = normalizeRouteAttachments(clientMsg.attachments);
  const harnessInput = serializeAttachmentsForHarness(clientMsg.user_input, attachments);
  const turnId = randomUUID();
  let activityRecorded = false;
  let acceptedReceipt = null;
  try {
    const activated = await target.activateGroups?.();
    if (!activated?.ok || !current()
      || !await promptSubmission.isReserved(receiptIdentity) || !current()) throw new Error('admission no longer current');
    const activity = await promptSubmission.accept(receiptIdentity, turnId, target.promptActivity);
    activityRecorded = Boolean(activity?.ok);
    acceptedReceipt = activity?.receipt || null;
  } catch (_error) {
    activityRecorded = false;
  }
  if (!activityRecorded) {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    await rejectReserved('acceptance_failed');
    reportPromptAcceptanceFailure(ws, threadId, requestId);
    return;
  }

  const failAcceptedBeforeDispatch = async (reason) => {
    try {
      await promptSubmission.failBeforeDispatch(receiptIdentity, reason);
    } catch (_error) { /* startup recovery marks any remaining unclaimed receipt interrupted */ }
  };

  let accepted = false;
  try {
    accepted = await target.trackMessage({
      threadId,
      content: clientMsg.user_input,
      requestId,
      turnId,
      sendAcknowledgement: false,
      suppressFailureFrame: true,
    });
  } catch {
    accepted = false;
  }
  // The receipt is the acceptance authority. A failed compatibility counter
  try {
    ws.send(JSON.stringify({ type: 'message:sent', workspaceId: target.workspaceId,
      threadId, scope: SCOPE, requestId, turnId: acceptedReceipt.turnId,
      content: acceptedReceipt.content }));
  } catch (_error) { /* receipt readback owns delivery recovery */ }
  if (!accepted || !current()) {
    await failAcceptedBeforeDispatch('metadata_helper_failed');
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    reportAcceptedExecutionFailure(ws, threadId, requestId);
    return;
  }

  try {
    if (!target.ownsSession(threadId, wire)) await target.activate(threadId, wire);
    if (!current()) {
      throw new Error('Workspace changed during prompt ownership transfer');
    }
    attachClientToWire(threadId, wire, projectRoot, ws, {
      workspaceId: session.currentWorkspaceId,
      projectRoot: runtimeKey.projectRoot,
      workspaceEpoch: runtimeKey.workspaceEpoch,
      viewId: null,
    });
    session.wire = wire;
    session.currentThreadId = threadId;
    session.currentScope = SCOPE;
    session.currentViewId = null;
    target.select(threadId);
  } catch {
    await failAcceptedBeforeDispatch('session_activation_failed');
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    reportAcceptedExecutionFailure(ws, threadId, requestId);
    return;
  }
  console.log('[WS] Message accepted by runtime and tracked in thread');

  await dispatchAcceptedTurn({ ws, session,
    sessions: target.sessions, thread, threadId, requestId, clientMsg, wire,
    runtimeKey, ownership, workspaceBinding, projectRoot, attachments, harnessInput, turnId, receiptIdentity,
    failAcceptedBeforeDispatch, handleCanonicalHarnessEvent });
}

module.exports = { acceptPromptThroughRuntime };
