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
const { HistoryFile } = require('../thread/HistoryFile');
const { aggregateExchangeMetadata } = require('../chat-metadata/exchange-metadata-aggregator');

// Pending audit data keyed by threadId
// Map<threadId, { messageId, planMode, contextUsage, tokenUsage, timestamp }>
const pendingAuditData = new Map();

// TTL for pending data (5 minutes) — prevents memory leaks
const PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * Start the audit subscriber.
 * Call this once during server initialization.
 */
function startAuditSubscriber() {
  // Listen for status updates — capture audit metadata
  on('chat:status_update', handleStatusUpdate);

  // Listen for turn end — persist exchange with audit metadata
  on('chat:turn_end', handleTurnEnd);

  // Periodic cleanup of stale pending data
  setInterval(cleanupStalePendingData, 60000);

  console.log('[AuditSubscriber] Started');
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
    capturedAt: auditData?.timestamp ?? Date.now(),
    savedAt: Date.now(),
  };

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
        metadata
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
    } catch (err) {
      console.error('[AuditSubscriber] Failed to save exchange:', err);
      // Fire-and-forget: don't block the event bus
    }
  }

  // Clean up pending data for this thread
  pendingAuditData.delete(event.threadId);
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
  getPendingCount,
  getPendingForThread,
};
