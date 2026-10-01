/**
 * Thread CRUD Handlers
 *
 * Extracted from ThreadWebSocketHandler.js — exposes handleThreadOpenAssistant
 * (the unified create-or-resume dispatcher) and handleThreadSearch. Group
 * Rename/Delete/Copy Link/View Markdown moved to the canonical `thread:action`
 * route (slices 01B/01C); the raw `thread:copyLink` route and the obsolete
 * `thread:touch` MRU bump were removed with no aliases.
 *
 * Creation/assistant activation compose the exact-session passive open owner.
 * Passive reads hydrate history without activating a provider.
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
const { createThreadOpenHandler, resolveVisibleTarget } = require('./thread-open-handler');
const { resolveCliPolicy } = require('../cli-config');

function createCrudHandlers({
  wsState,
  sendThreadList,
  pendingReorderTimers,
  REORDER_DELAY_MS,
  runDelayedThreadList = (_ws, _state, operation) => operation(),
}) {
  const captureTarget = manager => ({ workspaceId: manager.workspaceId,
    resolveTarget: manager.threadGroups?.resolveOpenTarget?.bind(manager.threadGroups) });
  const handleThreadOpen = createThreadOpenHandler({ readOpenContext(ws) {
    const state = wsState.get(ws);
    if (!state) return null;
    const manager = state.threadManager;
    if (!manager) return { unavailable: true };
    const target = captureTarget(manager);
    return {
      identity: { workspaceId: manager.workspaceId, projectRoot: manager.projectRoot },
      workspaceEpoch: state.workspaceEpoch, panelId: state.panelId, viewName: state.viewName,
      resolveTarget: request => resolveVisibleTarget(target, request),
      getThread: id => manager.getThread(id), readHistory: id => manager.getHistory(id),
      readRichHistory: id => manager.getRichHistory(id),
      markResumed: id => manager.index.markResumed(id), touch: id => manager.index.touch(id),
      selectThread: id => { state.threadId = id; },
      scheduleThreadList() {
        const previous = pendingReorderTimers.get(ws);
        if (previous) clearTimeout(previous);
        pendingReorderTimers.set(ws, setTimeout(() => {
          pendingReorderTimers.delete(ws);
          runDelayedThreadList(ws, state, () => sendThreadList(ws)).catch(() => {
            console.error('[ThreadWS] Delayed sendThreadList failed');
          });
        }, REORDER_DELAY_MS));
      },
    };
  } });

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
      ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null, message: 'No panel set' }));
      return;
    }

    const manager = state.threadManager;
    if (!manager) {
      ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null,
        workspaceEpoch: state.workspaceEpoch, message: 'No ThreadManager' }));
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
            requestId: msg.requestId || null,
            workspaceEpoch: state.workspaceEpoch,
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
          requestId: msg.requestId || null,
          workspaceEpoch: state.workspaceEpoch,
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
        requestId: msg.requestId || null,
        workspaceId: manager.workspaceId,
        workspaceEpoch: state.workspaceEpoch,
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
      await handleThreadOpen(ws, { threadId: createdId, threadGroupId: groupId, requestId: msg.requestId }, {
        recordActivationMetadata: true,
      });

      return createdId;

    } catch (err) {
      console.error('[ThreadWS] Create failed:', err);
      ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null,
        workspaceEpoch: state.workspaceEpoch, message: err.message }));
    }
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
      ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null, message: 'No panel set' }));
      return;
    }

    const manager = state.threadManager;
    if (!manager) {
      ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null,
        workspaceEpoch: state.workspaceEpoch, message: 'No ThreadManager' }));
      return;
    }

    // A visible-row resume carries `threadGroupId`. Unknown explicit IDs return
    // not_found and never create a replacement.
    if (msg.threadGroupId) {
      const resolved = await resolveVisibleTarget(captureTarget(manager), {
        threadGroupId: msg.threadGroupId,
        threadId: msg.threadId || null,
      });
      if (!resolved.ok) {
        ws.send(JSON.stringify({
          type: 'error',
          requestId: msg.requestId || null,
          workspaceEpoch: state.workspaceEpoch,
          code: 'view_id_preflight_repair_required',
          message: 'View identity repair required',
          diagnostics: resolved.diagnostics || [],
        }));
        return null;
      }
      if (!resolved.target) {
        ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null,
          workspaceEpoch: state.workspaceEpoch, code: 'not_found', message: `Thread not found: ${msg.threadGroupId}` }));
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
        ws.send(JSON.stringify({ type: 'error', requestId: msg.requestId || null,
          workspaceEpoch: state.workspaceEpoch, message: `Thread not found: ${msg.threadId}` }));
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
