/**
 * Audit Subscriber — event bus listener for message audit trails.
 *
 * Subscribes to chat events and persists exchange metadata to SQLite.
 * The event bus flows freely; this subscriber filters and decides what to store.
 *
 * Flow:
 *   1. chat:status_update → store messageId, planMode in pending map
 *   2. chat:turn_end → correlate by threadId, persist with audit metadata
 */

const { on, emit } = require('../event-bus');
const { performance } = require('perf_hooks');
const { HistoryFile } = require('../thread/HistoryFile');
const { getProjectThreadManager, awaitThreadManagerReady } = require('../thread/thread-manager-registry');
const { aggregateExchangeMetadata } = require('../chat-metadata/exchange-metadata-aggregator');
const { resolveTerminalErrorForReason } = require('../thread/turn-terminal-error');

// Pending audit data keyed by threadId
// Map<threadId, { messageId, planMode, contextUsage, tokenUsage, timestamp }>
const pendingAuditData = new Map();

// TTL for pending data (5 minutes) — prevents memory leaks
const PENDING_TTL_MS = 5 * 60 * 1000;
let cleanupTimer = null;
let unsubscribeFns = [];
let bindAgentExchanges = false;
let unsubscribeTurnEnd = null;
const inFlightAuditSaves = new Set();
let auditSaveFailure = null;

function bindingAuthorityFor(event) {
  if (!bindAgentExchanges
    || typeof event?.workspaceId !== 'string'
    || event.workspaceId.length === 0
    || typeof event?.turnId !== 'string'
    || event.turnId.length === 0) return null;
  return Object.freeze({ workspaceId: event.workspaceId, turnId: event.turnId });
}

/**
 * Start the audit subscriber.
 * Call this once during server initialization.
 */
function startAuditSubscriber({ enableAgentExchangeBinding = false } = {}) {
  if (cleanupTimer) return stopAuditSubscriber;
  bindAgentExchanges = enableAgentExchangeBinding === true;
  auditSaveFailure = null;

  // Listen for status updates — capture audit metadata
  unsubscribeFns.push(on('chat:status_update', handleStatusUpdate));

  // Listen for turn end — persist exchange with audit metadata
  unsubscribeTurnEnd = on('chat:turn_end', trackTurnEnd);
  unsubscribeFns.push(unsubscribeTurnEnd);

  // Periodic cleanup of stale pending data
  cleanupTimer = setInterval(cleanupStalePendingData, 60000);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

  console.log('[AuditSubscriber] Started');
  return stopAuditSubscriber;
}

function stopAuditSubscriber() {
  for (const unsubscribe of unsubscribeFns) {
    unsubscribe();
  }
  unsubscribeFns = [];
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  pendingAuditData.clear();
  bindAgentExchanges = false;
  unsubscribeTurnEnd = null;
}

function trackTurnEnd(event) {
  const task = handleTurnEnd(event);
  inFlightAuditSaves.add(task);
  task.then(
    () => { inFlightAuditSaves.delete(task); },
    (error) => {
      inFlightAuditSaves.delete(task);
      if (!auditSaveFailure) auditSaveFailure = error;
    },
  );
  return task;
}

async function drainAuditSaves({
  timeoutMs = 5_000,
  deadline = null,
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (unsubscribeTurnEnd) {
    unsubscribeTurnEnd();
    unsubscribeFns = unsubscribeFns.filter((unsubscribe) => unsubscribe !== unsubscribeTurnEnd);
    unsubscribeTurnEnd = null;
  }
  const startedAt = monotonicNow();
  const localDeadline = Math.min(
    startedAt + Math.max(0, timeoutMs),
    Number.isFinite(deadline) ? deadline : Number.POSITIVE_INFINITY,
  );
  while (inFlightAuditSaves.size > 0) {
    const remaining = Math.max(0, localDeadline - monotonicNow());
    if (remaining <= 0) return Object.freeze({ drained: false });
    let timer;
    const settled = await Promise.race([
      Promise.allSettled([...inFlightAuditSaves]).then(() => true),
      new Promise((resolve) => {
        timer = setTimer(() => resolve(false), remaining);
        timer?.unref?.();
      }),
    ]);
    if (timer) clearTimer(timer);
    if (!settled) return Object.freeze({ drained: false });
  }
  if (auditSaveFailure) throw auditSaveFailure;
  return Object.freeze({ drained: true });
}

/**
 * Handle status_update event — store audit metadata for later correlation.
 * @param {Object} event
 * @param {string} event.threadId
 * @param {string} event.messageId
 * @param {boolean} event.planMode
 * @param {number} event.contextUsage
 * @param {Object} event.tokenUsage
 */
function handleStatusUpdate(event) {
  if (!event.threadId) return;

  pendingAuditData.set(event.threadId, {
    messageId: event.messageId ?? null,
    planMode: event.planMode ?? false,
    contextUsage: event.contextUsage ?? null,
    tokenUsage: event.tokenUsage ?? null,
    timestamp: Date.now(),
  });
}

/**
 * Handle turn_end event — persist exchange with correlated audit metadata.
 * @param {Object} event
 * @param {string} event.threadId
 * @param {string} event.turnId
 * @param {string} event.fullText — assistant response text
 * @param {boolean} event.hasToolCalls
 * @param {string} event.userInput — original user message
 * @param {Array} event.parts — assistant response parts
 */
async function handleTurnEnd(event) {
  if (!event.threadId) return;

  const auditData = pendingAuditData.get(event.threadId);

  // Build metadata object (works even if no status_update was received)
  const auditMetadata = {
    messageId: auditData?.messageId ?? null,
    planMode: auditData?.planMode ?? false,
    contextUsage: auditData?.contextUsage ?? null,
    tokenUsage: auditData?.tokenUsage ?? null,
    turnId: event.turnId ?? null,
    reason: event.reason || 'complete',
    partial: Boolean(event.partial),
    capturedAt: auditData?.timestamp ?? Date.now(),
    savedAt: Date.now(),
  };

  // SPEC-03 Slice B (parent §4.13): persist ONLY exchange.metadata.terminalError
  // — the safe envelope, RE-VALIDATED here because the bus payload is never
  // trusted blindly. aggregateExchangeMetadata's existing spread carries it
  // into the persisted exchange metadata. Non-error metadata keeps its exact
  // prior byte shape with NO terminalError key (matching the wire choice:
  // the key is omitted, not nulled). No assistant part is ever created for
  // the error — parts/fullText flow exactly as before.
  const durableTerminalError = resolveTerminalErrorForReason(
    event.reason || 'complete',
    event.terminalError
  );
  if (durableTerminalError) {
    auditMetadata.terminalError = durableTerminalError;
  }

  // Persist to SQLite via HistoryFile
  if (event.userInput && event.parts) {
    try {
      const metadata = await aggregateExchangeMetadata({
        threadId: event.threadId,
        turnId: event.turnId,
        workspace: event.workspace,
        workspaceId: event.workspaceId,
        projectRoot: event.projectRoot,
        userInput: event.userInput,
        assistantParts: event.parts,
        attachments: event.attachments || [],
        existingMetadata: auditMetadata,
      });
      const historyFile = new HistoryFile(event.threadId);
      const savedExchange = await historyFile.addExchange(
        event.threadId,
        event.userInput,
        event.parts,
        metadata,
        bindingAuthorityFor(event),
      );
      if (!savedExchange?.exchangeId) {
        throw new Error(`Saved exchange missing exchangeId for thread ${event.threadId}`);
      }
      emit('chat:exchange_metadata', {
        workspace: event.workspace,
        workspaceId: event.workspaceId,
        scope: event.scope || 'project',
        threadId: event.threadId,
        turnId: event.turnId,
        ts: Date.now(),
        userInput: event.userInput,
        metadata,
      });
      emit('chat-turn:saved', {
        workspace: event.workspace,
        workspaceId: event.workspaceId,
        scope: event.scope || 'project',
        threadId: event.threadId,
        turnId: event.turnId,
        exchangeId: savedExchange.exchangeId,
        seq: savedExchange.seq,
        ts: savedExchange.ts,
        partial: event.partial,
        reason: event.reason,
        metadata,
      });
      await finalizeSavedExchange(event, savedExchange);
    } catch (err) {
      console.error('[AuditSubscriber] Failed to save exchange:', err);
      pendingAuditData.delete(event.threadId);
      throw err;
    }
  }

  // Clean up pending data for this thread
  pendingAuditData.delete(event.threadId);
}

async function finalizeSavedExchange(event, savedExchange) {
  if (!event.projectRoot || !event.threadId) return;

  try {
    const manager = getProjectThreadManager(event.projectRoot, event.workspaceId);
    await awaitThreadManagerReady(manager);
    await manager.recordSavedExchange(event.threadId, savedExchange.seq);
    await manager.syncChatlogMirrorFromHistory(event.threadId);
  } catch (err) {
    console.error('[AuditSubscriber] Failed to finalize saved exchange:', err);
  }
}

/**
 * Remove stale pending data to prevent memory leaks.
 */
function cleanupStalePendingData() {
  const now = Date.now();
  for (const [threadId, data] of pendingAuditData.entries()) {
    if (now - data.timestamp > PENDING_TTL_MS) {
      pendingAuditData.delete(threadId);
    }
  }
}

/**
 * Get pending audit data count (for debugging/monitoring).
 * @returns {number}
 */
function getPendingCount() {
  return pendingAuditData.size;
}

/**
 * Get pending audit data for a thread (for debugging).
 * @param {string} threadId
 * @returns {Object|null}
 */
function getPendingForThread(threadId) {
  return pendingAuditData.get(threadId) ?? null;
}

module.exports = {
  startAuditSubscriber,
  stopAuditSubscriber,
  getPendingCount,
  getPendingForThread,
  drainAuditSaves,
};
