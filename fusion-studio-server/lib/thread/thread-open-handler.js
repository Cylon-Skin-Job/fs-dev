'use strict';

// Passive exact-session history hydration; group selection remains authoritative.
const { threadRuntimeManager } = require('./thread-runtime-manager');

function getRuntimeKey(identity, threadId, workspaceEpoch) {
  return {
    workspaceId: identity.workspaceId,
    projectRoot: identity.projectRoot,
    workspaceEpoch,
    scope: 'project',
    threadId,
  };
}

/**
 * Resolve a visible open/rename/delete target through the Thread Group service.
 *
 * Production ThreadManagers always own `threadGroups`; the fallback only keeps
 * direct handler fixtures that inject a minimal manager working. It is a test
 * adapter, not a production bypass: the real service verifies group membership.
 */
async function resolveVisibleTarget({ workspaceId, resolveTarget }, { threadGroupId = null, threadId = null } = {}) {
  if (typeof resolveTarget !== 'function') {
    if (!threadId) return { ok: true, target: null };
    return {
      ok: true,
      target: {
        threadId,
        projection: {
          threadGroupId: null,
          workspaceId: workspaceId ?? null,
          viewId: null,
          currentPrimaryThreadId: threadId,
        },
      },
    };
  }
  return resolveTarget({ threadGroupId, threadId });
}

function createThreadOpenHandler({ readOpenContext }) {
  /**
   * Handle thread:open message.
   * @param {import('ws').WebSocket} ws
   * @param {object} msg
   * @param {string} msg.threadId
   * @param {object} [options]
   * @param {boolean} [options.recordActivationMetadata=false]
   */
  async function handleThreadOpen(ws, msg, options = {}) {
    const context = readOpenContext(ws);
    if (!context) {
      ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null, message: 'No panel set' }));
      return;
    }

    if (context.unavailable) {
      ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null, message: 'No ThreadManager' }));
      return;
    }

    // Visible-row open carries `threadGroupId`; the server resolves and returns
    // the authoritative current primary plus both identities. An exact-member
    // open may carry `threadId`, but membership is verified. Unknown explicit
    // group/member IDs return not_found and never create a replacement.
    const resolved = await context.resolveTarget({
      threadGroupId: msg.threadGroupId || null,
      threadId: msg.threadId || null,
    });
    if (!resolved.ok) {
      ws.send(JSON.stringify({
        type: 'error',
        requestId: msg.requestId || null,
        code: 'view_id_preflight_repair_required',
        message: 'View identity repair required',
        diagnostics: resolved.diagnostics || [],
      }));
      return null;
    }
    if (!resolved.target) {
      ws.send(JSON.stringify({
        type: 'error',
        requestId: msg.requestId || null,
        code: 'not_found',
        message: `Thread not found: ${msg.threadGroupId || msg.threadId || ''}`,
      }));
      return null;
    }
    const { projection } = resolved.target;
    const threadId = resolved.target.threadId;

    // Check if thread exists
    const thread = await context.getThread(threadId);
    if (!thread) {
      ws.send(JSON.stringify({
        type: 'error',
        requestId: msg.requestId || null,
        code: 'not_found',
        message: `Thread not found: ${threadId}`,
      }));
      return null;
    }

    // If this thread is already active elsewhere, that's fine (multiple tabs can view same thread)
    // But only one wire process per thread (managed by ThreadManager)

    if (msg.historyOnly !== true) {
      context.selectThread(threadId);
      // Passive hydration reads existing exact runtime state; it owns no new runtime lifetime.
    }

    if (options.recordActivationMetadata) {
      await context.markResumed(threadId);
    }

    // Send thread history (both formats during transition)
    const history = await context.readHistory(threadId);
    const richHistory = await context.readRichHistory(threadId);

    // Extract context usage from the last exchange's metadata
    const exchanges = richHistory?.exchanges || [];
    const lastExchange = exchanges.length > 0 ? exchanges[exchanges.length - 1] : null;
    const contextUsage = lastExchange?.metadata?.contextUsage ?? null;
    const liveTurn = threadRuntimeManager.getLiveTurn(
      getRuntimeKey(context.identity, threadId, context.workspaceEpoch),
    );

    // Passive open is a read: it hydrates persisted history plus the live
    // snapshot without changing provider or delivery ownership. A trusted
    // activation route is the only place allowed to transfer a live wire.

    console.log(`[ThreadWS] Opening thread ${threadId.slice(0,8)}, exchanges: ${exchanges.length}, lastExchange metadata:`, lastExchange?.metadata);
    console.log(`[ThreadWS] Sending contextUsage:`, contextUsage);

    ws.send(JSON.stringify({
      type: 'thread:opened',
      ...(msg.historyOnly === true ? { historyOnly: true } : {}),
      requestId: msg.requestId || null,
      workspaceEpoch: context.workspaceEpoch,
      threadId,
      threadGroupId: projection.threadGroupId,
      workspaceId: projection.workspaceId,
      viewId: projection.viewId,
      panel: context.viewName,
      scope: 'project',
      thread: thread.entry,
      history: history?.messages || [],  // Legacy format
      exchanges: exchanges,  // Rich format with tool calls
      liveTurn,
      contextUsage  // Restore context usage from last exchange
    }));

    if (options.recordActivationMetadata) {
      // Activation changes durable resume/MRU metadata. Passive browsing only
      // hydrates history and live state and schedules no list/fan-out work.
      await context.touch(threadId);
      context.scheduleThreadList();
    }

    console.log(`[ThreadWS] Opened thread ${threadId} (panel: ${context.panelId}, harness: ${thread.entry?.harnessId || 'unknown'})`);
    return threadId;
  }

  return handleThreadOpen;
}
module.exports = { createThreadOpenHandler, resolveVisibleTarget };
