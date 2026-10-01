/** Session-owned prompt status recovery. Never resends a prompt. */
import { chatSubmissionOwnerKey, useChatSubmissionStore, type ChatSubmissionAttempt } from '../../state/chatSubmissionStore';
import { usePanelStore } from '../../state/panelStore';
import { useWorkspaceStore } from '../../state/workspaceStore';
import type { WebSocketMessage } from '../../types';
import type { ProductSendResult } from '../ws/product-send';

const ACCEPTANCE_DEADLINE_MS = 15_000;
const STATUS_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

type StatusFrame = WebSocketMessage & {
  action?: string;
  workspaceId?: string;
  threadId?: string;
  requestId?: string;
  code?: string;
  receipt?: {
    workspaceId?: string;
    threadId?: string;
    requestId?: string;
    outcome?: string;
    execution?: string;
    turnId?: string | null;
    content?: string;
    reason?: string | null;
  };
};

interface RecoveryEntry {
  requestId: string;
  kind: 'acceptance' | 'execution';
  deadline?: ReturnType<typeof setTimeout>;
  retry?: ReturnType<typeof setTimeout>;
  responseTimeout?: ReturnType<typeof setTimeout>;
  inFlightGeneration?: number;
  responseEligibleGeneration?: number;
  tries: number;
}

const entries = new Map<string, RecoveryEntry>();
let generation = 0;
let workspaceReady = false;
let sendAction: ((message: Record<string, unknown>, workspaceId: string) => ProductSendResult) | null = null;
let workspaceSubscriptionStarted = false;
let attemptSubscriptionStarted = false;
let resumedBinding: string | null = null;

function bindingIdentity(): string {
  const binding = useWorkspaceStore.getState();
  return JSON.stringify([binding.activeWorkspaceId, binding.workspaceEpoch,
    binding.bindingRevision, binding.bindingSerial]);
}

function invalidateBinding(): void {
  generation += 1;
  workspaceReady = false;
  resumedBinding = null;
  for (const entry of entries.values()) {
    clearTimers(entry);
    entry.tries = 0;
  }
}

function ensureAttemptSubscription(): void {
  if (attemptSubscriptionStarted) return;
  attemptSubscriptionStarted = true;
  useChatSubmissionStore.subscribe((state) => {
    for (const [key, entry] of entries) {
      const attempt = state.attemptsByOwner[key];
      if (attempt?.requestId === entry.requestId
        && (entry.kind === 'execution' ? attempt.phase === 'accepted'
          : attempt.phase === 'pending' || attempt.phase === 'unknown')) continue;
      clearTimers(entry);
      entries.delete(key);
    }
  });
}

function ensureWorkspaceSubscription(): void {
  if (workspaceSubscriptionStarted) return;
  workspaceSubscriptionStarted = true;
  usePanelStore.subscribe((next, previous) => {
    if (next.activeWorkspaceId === previous.activeWorkspaceId) return;
    invalidateBinding();
  });
  useWorkspaceStore.subscribe((next, previous) => {
    if (next.activeWorkspaceId === previous.activeWorkspaceId
      && next.workspaceEpoch === previous.workspaceEpoch
      && next.bindingRevision === previous.bindingRevision
      && next.bindingSerial === previous.bindingSerial) return;
    invalidateBinding();
  });
}

function current(attempt: ChatSubmissionAttempt): boolean {
  const key = chatSubmissionOwnerKey(attempt.workspaceId, attempt.threadId);
  const latest = useChatSubmissionStore.getState().attemptsByOwner[key];
  const entry = entries.get(key);
  return latest?.requestId === attempt.requestId
    && (latest.phase === 'pending' || latest.phase === 'unknown'
      || (latest.phase === 'accepted' && entry?.kind === 'execution'
        && entry.requestId === attempt.requestId));
}

function executionUnknown(attempt: ChatSubmissionAttempt, message: string): void {
  useChatSubmissionStore.getState().feedback(attempt.workspaceId, attempt.threadId, message);
  window.dispatchEvent(new CustomEvent('fusion:prompt-execution-unknown', {
    detail: { workspaceId: attempt.workspaceId, threadId: attempt.threadId, requestId: attempt.requestId },
  }));
}

function clearTimers(entry: RecoveryEntry): void {
  if (entry.deadline) clearTimeout(entry.deadline);
  if (entry.retry) clearTimeout(entry.retry);
  if (entry.responseTimeout) clearTimeout(entry.responseTimeout);
  entry.deadline = undefined;
  entry.retry = undefined;
  entry.responseTimeout = undefined;
  entry.inFlightGeneration = undefined;
  entry.responseEligibleGeneration = undefined;
}

export function settlePromptRecovery(workspaceId: string, threadId: string, requestId: string): void {
  const key = chatSubmissionOwnerKey(workspaceId, threadId);
  const entry = entries.get(key);
  if (!entry || entry.requestId !== requestId) return;
  clearTimers(entry);
  entries.delete(key);
}

function scheduleRetry(attempt: ChatSubmissionAttempt, entry: RecoveryEntry): void {
  if (entries.get(chatSubmissionOwnerKey(attempt.workspaceId, attempt.threadId)) !== entry
    || !current(attempt) || !workspaceReady || !sendAction) return;
  const delay = RETRY_DELAYS_MS[entry.tries - 1];
  if (delay === undefined) return;
  if (entry.retry) clearTimeout(entry.retry);
  entry.retry = setTimeout(() => {
    entry.retry = undefined;
    queryStatus(attempt, entry);
  }, delay);
}

function queryStatus(attempt: ChatSubmissionAttempt, entry: RecoveryEntry): void {
  if (entries.get(chatSubmissionOwnerKey(attempt.workspaceId, attempt.threadId)) !== entry
    || !current(attempt) || !workspaceReady || !sendAction
    || usePanelStore.getState().activeWorkspaceId !== attempt.workspaceId
    || entry.inFlightGeneration === generation) return;
  entry.tries += 1;
  const inquiryGeneration = generation;
  const wasEligible = entry.responseEligibleGeneration === inquiryGeneration;
  entry.inFlightGeneration = inquiryGeneration;
  // A native socket fixture can deliver the reply inside send(). Make that
  // exact response eligible before invoking the transport.
  entry.responseEligibleGeneration = inquiryGeneration;
  if (entry.retry) clearTimeout(entry.retry);
  entry.retry = undefined;
  useChatSubmissionStore.getState().feedback(attempt.workspaceId, attempt.threadId,
    entry.kind === 'execution' ? 'Checking the accepted response status.'
      : 'Checking delivery status. You can keep editing; sending again is paused.');
  let result: ProductSendResult;
  try {
    result = sendAction({ type: 'thread:action', action: 'prompt_receipt_status',
      requestId: attempt.requestId, threadId: attempt.threadId }, attempt.workspaceId);
  } catch {
    result = { status: 'uncertain', reason: 'send_outcome_unknown' };
  }
  // A synchronous ACK, status response, retirement or rebind can settle or
  // replace this inquiry before send returns. Never arm a timer afterward.
  if (entries.get(chatSubmissionOwnerKey(attempt.workspaceId, attempt.threadId)) !== entry
    || entry.inFlightGeneration !== inquiryGeneration || generation !== inquiryGeneration
    || !current(attempt)) return;
  if (result.status === 'not_enqueued') {
    entry.inFlightGeneration = undefined;
    if (!wasEligible) entry.responseEligibleGeneration = undefined;
    if (entry.kind === 'execution') executionUnknown(attempt, 'Message accepted; response status unknown. Check status when connected.');
    else {
      useChatSubmissionStore.getState().unknown(attempt.workspaceId, attempt.threadId, attempt.requestId);
      useChatSubmissionStore.getState().feedback(attempt.workspaceId, attempt.threadId,
        'Delivery status unknown. Check status when connected; sending again is paused.');
    }
    scheduleRetry(attempt, entry);
    return;
  }
  entry.responseTimeout = setTimeout(() => {
    entry.responseTimeout = undefined;
    if (entry.inFlightGeneration !== inquiryGeneration || generation !== inquiryGeneration
      || !current(attempt)) return;
    entry.inFlightGeneration = undefined;
    if (entry.kind === 'execution') executionUnknown(attempt, 'Message accepted; response status unknown. Check status when connected.');
    else {
      useChatSubmissionStore.getState().unknown(attempt.workspaceId, attempt.threadId, attempt.requestId);
      useChatSubmissionStore.getState().feedback(attempt.workspaceId, attempt.threadId,
        'Delivery status unknown. Check status when connected; sending again is paused.');
    }
    scheduleRetry(attempt, entry);
  }, STATUS_TIMEOUT_MS);
}

export function trackPromptAttempt(attempt: ChatSubmissionAttempt): void {
  ensureAttemptSubscription();
  const key = chatSubmissionOwnerKey(attempt.workspaceId, attempt.threadId);
  const old = entries.get(key);
  if (old) clearTimers(old);
  const entry: RecoveryEntry = { requestId: attempt.requestId, kind: 'acceptance', tries: 0 };
  entries.set(key, entry);
  if (attempt.phase === 'pending') {
    entry.deadline = setTimeout(() => {
      entry.deadline = undefined;
      if (!current(attempt)) return;
      useChatSubmissionStore.getState().unknown(attempt.workspaceId, attempt.threadId, attempt.requestId);
      useChatSubmissionStore.getState().feedback(attempt.workspaceId, attempt.threadId,
        'Delivery status unknown. You can edit; sending again is paused until status is known.');
      queryStatus(attempt, entry);
    }, ACCEPTANCE_DEADLINE_MS);
  } else {
    queryStatus(attempt, entry);
  }
}

/** Keep an acknowledged attempt recoverable until its turn actually begins. */
export function trackAcceptedPromptExecution(attempt: ChatSubmissionAttempt): void {
  if (attempt.phase !== 'accepted') return;
  ensureAttemptSubscription();
  const key = chatSubmissionOwnerKey(attempt.workspaceId, attempt.threadId);
  const old = entries.get(key);
  if (old) clearTimers(old);
  const entry: RecoveryEntry = { requestId: attempt.requestId, kind: 'execution', tries: 0 };
  entries.set(key, entry);
  entry.deadline = setTimeout(() => {
    entry.deadline = undefined;
    if (!current(attempt)) return;
    executionUnknown(attempt, 'Message accepted; response status unknown. Check status to recover.');
    queryStatus(attempt, entry);
  }, ACCEPTANCE_DEADLINE_MS);
}

export function finishAcceptedPromptExecution(workspaceId: string, threadId: string, turnId: string): void {
  const key = chatSubmissionOwnerKey(workspaceId, threadId);
  const entry = entries.get(key);
  const attempt = useChatSubmissionStore.getState().attemptsByOwner[key];
  if (!entry || entry.kind !== 'execution' || attempt?.requestId !== entry.requestId
    || attempt.turnId !== turnId) return;
  settlePromptRecovery(workspaceId, threadId, entry.requestId);
  useChatSubmissionStore.getState().feedback(workspaceId, threadId, null);
}

export function hasAcceptedPromptExecutionWatch(workspaceId: string, threadId: string, requestId: string): boolean {
  const entry = entries.get(chatSubmissionOwnerKey(workspaceId, threadId));
  return entry?.kind === 'execution' && entry.requestId === requestId;
}
export function requestPromptStatus(workspaceId: string, threadId: string): void {
  const key = chatSubmissionOwnerKey(workspaceId, threadId);
  const attempt = useChatSubmissionStore.getState().attemptsByOwner[key];
  if (!attempt || (attempt.phase !== 'pending' && attempt.phase !== 'unknown'
    && !(attempt.phase === 'accepted' && hasAcceptedPromptExecutionWatch(workspaceId, threadId, attempt.requestId)))) return;
  let entry = entries.get(key);
  if (!entry || entry.requestId !== attempt.requestId) {
    trackPromptAttempt(attempt);
    entry = entries.get(key);
  }
  if (!entry) return;
  if (!workspaceReady || !sendAction) {
    if (entry.kind === 'execution') executionUnknown(attempt, 'Message accepted; response status unknown. Reconnect to check.');
    else {
      useChatSubmissionStore.getState().unknown(workspaceId, threadId, attempt.requestId);
      useChatSubmissionStore.getState().feedback(workspaceId, threadId,
        'Delivery status unknown. Reconnect to check; sending again is paused.');
    }
    return;
  }
  if (entry.responseTimeout) clearTimeout(entry.responseTimeout);
  if (entry.deadline) clearTimeout(entry.deadline);
  entry.responseTimeout = undefined;
  entry.deadline = undefined;
  entry.inFlightGeneration = undefined;
  entry.tries = 0;
  queryStatus(attempt, entry);
}

export function retirePromptRecoveryConnection(): void {
  invalidateBinding();
  sendAction = null;
  for (const [key, entry] of entries) {
    clearTimers(entry);
    const attempt = useChatSubmissionStore.getState().attemptsByOwner[key];
    if (!attempt || attempt.requestId !== entry.requestId || !current(attempt)) {
      entries.delete(key);
      continue;
    }
    if (entry.kind === 'execution') executionUnknown(attempt, 'Message accepted; response status unknown while disconnected.');
    else {
      useChatSubmissionStore.getState().unknown(attempt.workspaceId, attempt.threadId, attempt.requestId);
      useChatSubmissionStore.getState().feedback(attempt.workspaceId, attempt.threadId,
        'Delivery status unknown while disconnected. You can edit; sending again is paused.');
    }
  }
}

export function resumePromptRecoveryConnection(send: (message: Record<string, unknown>, workspaceId: string) => ProductSendResult): void {
  ensureAttemptSubscription();
  ensureWorkspaceSubscription();
  const binding = bindingIdentity();
  if (workspaceReady && resumedBinding === binding) return;
  generation += 1;
  workspaceReady = true;
  resumedBinding = binding;
  sendAction = send;
  for (const attempt of Object.values(useChatSubmissionStore.getState().attemptsByOwner)) {
    if (!current(attempt) || attempt.workspaceId !== usePanelStore.getState().activeWorkspaceId) continue;
    const key = chatSubmissionOwnerKey(attempt.workspaceId, attempt.threadId);
    let entry = entries.get(key);
    if (!entry || entry.requestId !== attempt.requestId) {
      entry = { requestId: attempt.requestId, kind: attempt.phase === 'accepted' ? 'execution' : 'acceptance', tries: 0 };
      entries.set(key, entry);
    } else {
      clearTimers(entry);
      entry.tries = 0;
    }
    queryStatus(attempt, entry);
  }
}

/** Called only after the workspace switch's authenticated binding was applied. */
export function resumeBoundPromptRecoveryWorkspace(): void {
  if (sendAction) resumePromptRecoveryConnection(sendAction);
}

/** Returns a server-owned ACK frame only for an authenticated, current status reply. */
export function handlePromptStatusFrame(msg: StatusFrame): StatusFrame | null | false {
  if (msg.action !== 'prompt_receipt_status'
    || (msg.type !== 'thread:action:completed' && msg.type !== 'thread:action:error')) return false;
  const receipt = msg.receipt;
  // Error frames from the current server lack workspace identity. Inferring
  // it from the focused panel could misattribute an old-binding reply.
  const workspaceId = msg.workspaceId ?? receipt?.workspaceId;
  const threadId = msg.threadId ?? receipt?.threadId;
  const requestId = msg.requestId;
  if (!workspaceId || !threadId || !requestId) return null;
  const key = chatSubmissionOwnerKey(workspaceId, threadId);
  const attempt = useChatSubmissionStore.getState().attemptsByOwner[key];
  const entry = entries.get(key);
  if (!attempt || attempt.requestId !== requestId || !entry
    || entry.requestId !== requestId || !workspaceReady
    || usePanelStore.getState().activeWorkspaceId !== workspaceId
    || resumedBinding !== bindingIdentity()
    || entry.responseEligibleGeneration !== generation || !current(attempt)) return null;
  // A receipt with a conflicting inner identity belongs to another inquiry.
  // Leave this inquiry's response budget and eligibility untouched.
  if (receipt && (receipt.workspaceId !== workspaceId || receipt.threadId !== threadId
    || receipt.requestId !== requestId)) return null;
  if (msg.type === 'thread:action:completed'
    && (!receipt || (entry.kind === 'execution' && receipt.outcome === 'accepted'
      && receipt.turnId !== attempt.turnId))) return null;
  if (entry.responseTimeout) clearTimeout(entry.responseTimeout);
  if (entry.retry) clearTimeout(entry.retry);
  entry.responseTimeout = undefined;
  entry.retry = undefined;
  entry.inFlightGeneration = undefined;
  if (msg.type === 'thread:action:error') {
    if (entry.kind === 'execution') executionUnknown(attempt, 'Message accepted; response status could not be checked.');
    else {
      useChatSubmissionStore.getState().unknown(workspaceId, threadId, requestId);
      useChatSubmissionStore.getState().feedback(workspaceId, threadId,
        'Delivery status could not be checked. Sending again is paused.');
    }
    scheduleRetry(attempt, entry);
    return null;
  }
  if (!receipt) return null; // Completed frames were validated before clearing the inquiry.
  // This authoritative answer consumes the current possible inquiry. A
  // nonterminal outcome may open a new eligibility window on its next retry.
  entry.responseEligibleGeneration = undefined;
  if (entry.kind === 'execution') {
    if (receipt.outcome !== 'accepted') {
      executionUnknown(attempt, 'Message accepted; response status could not be verified.');
      scheduleRetry(attempt, entry);
      return null;
    }
    if (receipt.execution === 'failed_before_dispatch' || receipt.execution === 'interrupted_before_dispatch') {
      settlePromptRecovery(workspaceId, threadId, requestId);
      useChatSubmissionStore.getState().feedback(workspaceId, threadId,
        'Message accepted, but its response could not start. Review the conversation before sending a new message.');
      window.dispatchEvent(new CustomEvent('fusion:prompt-execution-failed', {
        detail: { workspaceId, threadId, requestId },
      }));
      return null;
    }
    executionUnknown(attempt, receipt.execution === 'unknown_after_dispatch_claim'
      ? 'Message accepted; response execution is uncertain after reconnect. Review the conversation before sending again.'
      : 'Message accepted; waiting for its response to start.');
    if (receipt.execution === 'not_dispatched') scheduleRetry(attempt, entry);
    return null;
  }
  if (receipt.outcome === 'accepted' && typeof receipt.turnId === 'string'
    && typeof receipt.content === 'string') {
    settlePromptRecovery(workspaceId, threadId, requestId);
    const failed = receipt.execution === 'failed_before_dispatch'
      || receipt.execution === 'interrupted_before_dispatch' || Boolean(receipt.reason);
    // The normal message:sent handler owns bubble, draft, and attachment reconciliation.
    queueMicrotask(() => {
      const accepted = useChatSubmissionStore.getState().attemptsByOwner[key];
      if (failed && accepted?.requestId === requestId && accepted.phase === 'accepted') {
        useChatSubmissionStore.getState().feedback(workspaceId, threadId,
          'Message accepted, but its response could not finish. Review the conversation before sending a new message.');
        settlePromptRecovery(workspaceId, threadId, requestId);
      }
    });
    return { type: 'message:sent', workspaceId, threadId, requestId,
      turnId: receipt.turnId, content: receipt.content,
      recoveredFromStatus: true } as StatusFrame;
  }
  if (receipt?.outcome === 'cancelled' || receipt?.outcome === 'rejected') {
    settlePromptRecovery(workspaceId, threadId, requestId);
    useChatSubmissionStore.getState().reject(workspaceId, threadId, requestId,
      receipt.outcome === 'cancelled'
        ? 'Message was not accepted. You can send the current draft again.'
        : 'Message was rejected. Review the current draft and send again.');
    window.dispatchEvent(new CustomEvent('fusion:prompt-acceptance-failed',
      { detail: { workspaceId, threadId, requestId } }));
    return null;
  }
  useChatSubmissionStore.getState().unknown(workspaceId, threadId, requestId);
  useChatSubmissionStore.getState().feedback(workspaceId, threadId,
    'Delivery is still being checked. You can edit; sending again is paused.');
  scheduleRetry(attempt, entry);
  return null;
}

export function noteAcceptedExecutionFailure(workspaceId: string, threadId: string, requestId: string): void {
  const attempt = useChatSubmissionStore.getState().attemptsByOwner[
    chatSubmissionOwnerKey(workspaceId, threadId)];
  if (attempt?.requestId !== requestId) return;
  if (attempt.phase === 'accepted') {
    settlePromptRecovery(workspaceId, threadId, requestId);
    const chat = usePanelStore.getState().projectChats[threadId];
    const began = Boolean(attempt.turnId && (chat?.currentTurn?.id === attempt.turnId
      || chat?.messages.some((message) => message.type === 'assistant'
        && (message.id === attempt.turnId || message.metadata?.turnId === attempt.turnId))));
    // A begun turn retains its authoritative partial and safe terminal error.
    useChatSubmissionStore.getState().feedback(workspaceId, threadId, began ? null
      : 'Message accepted, but its response could not start. Review the conversation before sending a new message.');
  } else if (attempt.phase === 'pending' || attempt.phase === 'unknown') {
    useChatSubmissionStore.getState().unknown(workspaceId, threadId, requestId);
    requestPromptStatus(workspaceId, threadId);
  }
}
