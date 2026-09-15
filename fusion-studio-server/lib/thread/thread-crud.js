/**
 * Thread CRUD Handlers
 *
 * Extracted from ThreadWebSocketHandler.js — exposes handleThreadOpenAssistant
 * (the unified create-or-resume dispatcher) and handleThreadSearch. Group
 * Rename/Delete/Copy Link/View Markdown moved to the canonical `thread:action`
 * route (slices 01B/01C); the raw `thread:copyLink` route and the obsolete
 * `thread:touch` MRU bump were removed with no aliases.
 *
 * handleThreadCreate and handleThreadOpen remain as private helpers inside
 * the factory, called only by handleThreadOpenAssistant. They are not
 * exported — external callers must use the dispatcher so upsert semantics
 * are enforced.
 *
 * RCC-0095: all threads are workspace-scoped (single workspace chat).
 * Outbound messages still carry scope: 'project' for wire compatibility.
 *
 * Uses a factory pattern so the coordinator can inject shared state (Maps)
 * and helper functions. All functions close over the same scope, which is
 * critical because handleThreadOpenAssistant calls handleThreadCreate /
 * handleThreadOpen, and handleThreadCreate calls handleThreadOpen internally.
 */

/**
 * @param {object} deps
 * @param {Map} deps.wsState - Per-WS state map (shared with coordinator)
 * @param {Function} deps.sendThreadList - Send thread list to client
 * @param {Map} deps.pendingReorderTimers - Pending reorder timers (shared with coordinator)
 * @param {number} deps.REORDER_DELAY_MS - Delay for thread list refresh
 */
const { search: searchExchanges } = require('./chat-search');
const { threadRuntimeManager } = require('./thread-runtime-manager');
const { resolveCliPolicy } = require('../cli-config');

function getRuntimeKey(manager, threadId, workspaceEpoch) {
  return {
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
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
async function resolveVisibleTarget(manager, { threadGroupId = null, threadId = null } = {}) {
  const service = manager.threadGroups;
  if (!service || typeof service.resolveOpenTarget !== 'function') {
    if (!threadId) return { ok: true, target: null };
    return {
      ok: true,
      target: {
        threadId,
        projection: {
          threadGroupId: null,
          workspaceId: manager.workspaceId ?? null,
          viewId: null,
          currentPrimaryThreadId: threadId,
        },
      },
    };
  }
  return service.resolveOpenTarget({ threadGroupId, threadId });
}

function createCrudHandlers({
  wsState,
  sendThreadList,
  pendingReorderTimers,
  REORDER_DELAY_MS,
  runDelayedThreadList = (_ws, _state, operation) => operation(),
}) {

  /**
   * Generate a timestamp-based thread ID.
   *
   * Format: YYYY-MM-DDTHH-MM-SS-mmm (e.g. "2026-04-08T14-30-22-123")
   *
   * This format is:
   * - Filesystem-safe (no colons — colons break on Windows and some tooling)
   * - Lexicographically sortable (chronological sort by string comparison)
   * - Human-readable at a glance
   * - Millisecond-precise (collision-resistant within a single process;
   *   two threads created in the same millisecond is not a concern for
   *   human-driven chat creation)
   *
   * Local time, not UTC. A chat created at 2:34 PM Pacific shows `14-30` in
   * its ID, not `21-30`. Matches user intuition for "when did I create that
   * chat".
   *
   * @returns {string}
   */
  function generateThreadId() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${yyyy}-${mm}-${dd}T${hh}-${mi}-${ss}-${ms}`;
  }

  /**
   * Handle thread:create message.
   * @param {import('ws').WebSocket} ws
   * @param {object} msg
   * @param {string} [msg.name]
   * @param {string} [msg.harnessId] - Harness selection ('kimi' | 'claude-code' | 'gemini' | 'qwen' | 'codex')
   * @param {object} [msg.harnessConfig] - BYOK configuration
   */
  async function handleThreadCreate(ws, msg) {
    const state = wsState.get(ws);
    if (!state) {
      ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
      return;
    }

    const manager = state.threadManager;
    if (!manager) {
      ws.send(JSON.stringify({ type: 'error', message: 'No ThreadManager' }));
      return;
    }

    // Generate thread ID — timestamp-based, filesystem-safe, lexicographically
    // sortable. See generateThreadId() above for format.
    const threadId = generateThreadId();
    const name = msg.name || null;
    const { mintThreadGroupId } = require('../thread-groups/ids');
    // Groups and sessions receive independently minted opaque host IDs (§4).
    const groupId = mintThreadGroupId();

    try {
      // No group binding may happen before the registry-owned stable view-ID
      // preflight succeeds (§6/CHAT-RD-013).
      if (typeof manager.ensureGroupsActivated === 'function') {
        const activation = await manager.ensureGroupsActivated();
        if (!activation.ok) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'view_id_preflight_repair_required',
            message: 'View identity repair required',
            diagnostics: activation.diagnostics || [],
          }));
          return null;
        }
      }

      const policy = await resolveCliPolicy(manager.projectRoot);
      if (msg.harnessId && !policy.allowedHarnesses.includes(msg.harnessId)) {
        throw new Error(`Harness '${msg.harnessId}' is not allowed by ai/<machine>/System/config/cli.json`);
      }
      const harnessId = msg.harnessId || policy.defaultHarness;

      // An optional already-resolved view target is validated through the
      // registry; absent/valid-less → Legacy `view_id = NULL`. The target never
      // creates a file, folder, project, view, template, or CWD binding.
      let viewTarget = { ok: true, viewId: null };
      if (msg.viewId !== undefined && msg.viewId !== null) {
        viewTarget = manager.threadGroups.resolveViewTarget(msg.viewId);
      }
      if (!viewTarget.ok) {
        ws.send(JSON.stringify({
          type: 'error',
          code: 'view_not_found',
          message: 'Requested view is not available',
        }));
        return null;
      }

      // Create thread + one-member group atomically with harness selection.
      const { threadId: createdId, entry } = await manager.createThread(threadId, name, {
        harnessId,
        harnessConfig: msg.harnessConfig,
        groupId,
        viewId: viewTarget.viewId,
        requestId: msg.requestId,
        action: msg.requestId ? 'create' : undefined,
        targetHash: groupId,
        actionResult: { threadGroupId: groupId, threadId },
      });

      ws.send(JSON.stringify({
        type: 'thread:created',
        threadId: createdId,
        threadGroupId: groupId,
        // Durable view binding of the new group; `null` is the explicit Legacy
        // population (never inferred from the active panel).
        viewId: viewTarget.viewId,
        panel: state.viewName,
        scope: 'project',
        thread: entry
      }));

      // Send updated list. A view-bound group must refresh its OWN population
      // (viewId) so the production view chrome's rail shows the new group; a
      // Legacy create keeps the exact existing Legacy list behavior.
      await sendThreadList(ws, viewTarget.viewId);

      // Automatically open the new thread
      await handleThreadOpen(ws, { threadId: createdId, threadGroupId: groupId }, {
        recordActivationMetadata: true,
      });

      return createdId;

    } catch (err) {
      console.error('[ThreadWS] Create failed:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  /**
   * Handle thread:open message.
   * @param {import('ws').WebSocket} ws
   * @param {object} msg
   * @param {string} msg.threadId
   * @param {object} [options]
   * @param {boolean} [options.recordActivationMetadata=false]
   */
  async function handleThreadOpen(ws, msg, options = {}) {
    const state = wsState.get(ws);
    if (!state) {
      ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
      return;
    }

    const manager = state.threadManager;
    if (!manager) {
      ws.send(JSON.stringify({ type: 'error', message: 'No ThreadManager' }));
      return;
    }

    // Visible-row open carries `threadGroupId`; the server resolves and returns
    // the authoritative current primary plus both identities. An exact-member
    // open may carry `threadId`, but membership is verified. Unknown explicit
    // group/member IDs return not_found and never create a replacement.
    const resolved = await resolveVisibleTarget(manager, {
      threadGroupId: msg.threadGroupId || null,
      threadId: msg.threadId || null,
    });
    if (!resolved.ok) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'view_id_preflight_repair_required',
        message: 'View identity repair required',
        diagnostics: resolved.diagnostics || [],
      }));
      return null;
    }
    if (!resolved.target) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'not_found',
        message: `Thread not found: ${msg.threadGroupId || msg.threadId || ''}`,
      }));
      return null;
    }
    const { projection } = resolved.target;
    const threadId = projection.currentPrimaryThreadId;

    // Check if thread exists
    const thread = await manager.getThread(threadId);
    if (!thread) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'not_found',
        message: `Thread not found: ${threadId}`,
      }));
      return null;
    }

    // If this thread is already active elsewhere, that's fine (multiple tabs can view same thread)
    // But only one wire process per thread (managed by ThreadManager)

    state.threadId = threadId;
    threadRuntimeManager.ensureRuntime(getRuntimeKey(manager, threadId, state.workspaceEpoch));

    if (options.recordActivationMetadata) {
      await manager.index.markResumed(threadId);
    }

    // Send thread history (both formats during transition)
    const history = await manager.getHistory(threadId);
    const richHistory = await manager.getRichHistory(threadId);

    // Extract context usage from the last exchange's metadata
    const exchanges = richHistory?.exchanges || [];
    const lastExchange = exchanges.length > 0 ? exchanges[exchanges.length - 1] : null;
    const contextUsage = lastExchange?.metadata?.contextUsage ?? null;
    const liveTurn = threadRuntimeManager.getLiveTurn(
      getRuntimeKey(manager, threadId, state.workspaceEpoch),
    );

    // Passive open is a read: it hydrates persisted history plus the live
    // snapshot without changing provider or delivery ownership. A trusted
    // activation route is the only place allowed to transfer a live wire.

    console.log(`[ThreadWS] Opening thread ${threadId.slice(0,8)}, exchanges: ${exchanges.length}, lastExchange metadata:`, lastExchange?.metadata);
    console.log(`[ThreadWS] Sending contextUsage:`, contextUsage);

    ws.send(JSON.stringify({
      type: 'thread:opened',
      threadId,
      threadGroupId: projection.threadGroupId,
      workspaceId: projection.workspaceId,
      viewId: projection.viewId,
      panel: state.viewName,
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
      await manager.index.touch(threadId);
      const existingTimer = pendingReorderTimers.get(ws);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        pendingReorderTimers.delete(ws);
        runDelayedThreadList(ws, state, () => sendThreadList(ws)).catch(err => {
          console.error('[ThreadWS] Delayed sendThreadList failed:', err);
        });
      }, REORDER_DELAY_MS);
      pendingReorderTimers.set(ws, timer);
    }

    console.log(`[ThreadWS] Opened thread ${threadId} (panel: ${state.panelId}, harness: ${thread.entry?.harnessId || 'unknown'})`);
    return threadId;
  }

  /**
   * Handle thread:open-assistant message — the unified create-or-resume verb.
   *
   * Upsert semantics: if msg.threadId is provided and the thread exists in the
   * index, resume it (fires thread:opened). Otherwise, create a new thread
   * (fires thread:created, then thread:opened via handleThreadCreate's chained
   * call to handleThreadOpen).
   *
   * This is the single entry point for opening any assistant thread —
   * it replaces the old split create/open/open-daily/open-agent protocol.
   * The "assistant" suffix matches the Chat Assistants vs Background
   * Workers taxonomy in ai/<machine>/Agents/ — background workers
   * use the runner path (lib/runner/) and never touch thread:* messages.
   *
   * @param {import('ws').WebSocket} ws
   * @param {object} msg
   * @param {string} [msg.threadId] - If present and valid, resume. Otherwise create.
   * @param {string} [msg.name] - Optional display name for new threads (default null).
   * @param {string} [msg.harnessId] - Harness selection for new threads ('kimi' | 'claude-code' | 'gemini' | 'qwen' | 'codex').
   * @param {object} [msg.harnessConfig] - BYOK configuration for new threads.
   */
  async function handleThreadOpenAssistant(ws, msg) {
    const state = wsState.get(ws);
    if (!state) {
      ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
      return;
    }

    const manager = state.threadManager;
    if (!manager) {
      ws.send(JSON.stringify({ type: 'error', message: 'No ThreadManager' }));
      return;
    }

    // A visible-row resume carries `threadGroupId`. Unknown explicit IDs return
    // not_found and never create a replacement.
    if (msg.threadGroupId) {
      const resolved = await resolveVisibleTarget(manager, {
        threadGroupId: msg.threadGroupId,
        threadId: msg.threadId || null,
      });
      if (!resolved.ok) {
        ws.send(JSON.stringify({
          type: 'error',
          code: 'view_id_preflight_repair_required',
          message: 'View identity repair required',
          diagnostics: resolved.diagnostics || [],
        }));
        return null;
      }
      if (!resolved.target) {
        ws.send(JSON.stringify({ type: 'error', code: 'not_found', message: `Thread not found: ${msg.threadGroupId}` }));
        return null;
      }
      return handleThreadOpen(
        ws,
        { threadGroupId: msg.threadGroupId, threadId: resolved.target.threadId },
        { recordActivationMetadata: true },
      );
    }

    // Upsert: if client supplied a threadId and it exists, resume it.
    // Otherwise create a new thread.
    if (msg.threadId) {
      const existing = await manager.getThread(msg.threadId);
      if (existing) {
        return handleThreadOpen(ws, msg, { recordActivationMetadata: true });
      }
      if (typeof manager.index?.existsOutsideWorkspace === 'function'
        && await manager.index.existsOutsideWorkspace(msg.threadId)) {
        ws.send(JSON.stringify({ type: 'error', message: `Thread not found: ${msg.threadId}` }));
        return null;
      }
      // threadId provided but thread doesn't exist — fall through to create.
      // This handles the race where a client tries to resume a freshly-deleted
      // thread. Creating a new one is the least-surprising outcome.
      console.warn(
        `[ThreadWS] thread:open-assistant with unknown threadId ${msg.threadId} — creating new`
      );
    }

    // No threadId, or threadId not found → create a new thread.
    return handleThreadCreate(ws, msg);
  }

  /**
   * Handle thread:search — query exchanges across threads.
   * WORKSPACE_ISOLATION_SPEC §11c.
   * @param {import('ws').WebSocket} ws
   * @param {object} msg
   * @param {string} msg.query
   * @param {string} [msg.workspaceId] - When present, must match the current workspace
   * @param {number} [msg.limit]
   * @param {number} [msg.offset]
   */
  async function handleThreadSearch(ws, msg) {
    try {
      const state = wsState.get(ws);
      const workspaceId = state?.threadManager?.workspaceId;
      if (typeof workspaceId !== 'string' || !workspaceId
        || (msg.workspaceId !== undefined && msg.workspaceId !== workspaceId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
        return;
      }

      const { total, results } = await searchExchanges({
        workspaceId,
        query: msg.query,
        limit: msg.limit ?? 50,
        offset: msg.offset ?? 0,
      });

      ws.send(JSON.stringify({
        type: 'thread:search_result',
        query: msg.query,
        workspaceId,
        total,
        results,
      }));
    } catch (err) {
      console.error('[ThreadWS] Search failed:', err);
      ws.send(JSON.stringify({
        type: 'thread:search_result',
        query: msg.query,
        workspaceId: msg.workspaceId ?? null,
        total: 0,
        results: [],
        error: err.message,
      }));
    }
  }

  return {
    handleThreadOpen,
    handleThreadOpenAssistant,
    handleThreadSearch,
  };
}

module.exports = { createCrudHandlers };
