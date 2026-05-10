# Handoff Report: Workspace Isolation & Workspace-Keyed Client State

**Status:** Implemented and running  
**Date:** 2026-05-09  
**Primary Spec:** `docs/WORKSPACE_ISOLATION_AND_KEYED_STATE_SPEC.md`  
**Server:** http://localhost:3001 (PID from `./restart-kimi.sh`)

---

## What Was Implemented

### Phase 1: Server Isolation Fixes

| File | Change |
|------|--------|
| `open-robin-server/lib/db/migrations/017_workspace_id_threads.js` | **New.** Adds `workspace_id` to `threads`, backfills from `workspaces` via basename matching, creates two indexes. |
| `open-robin-server/lib/thread/ThreadIndex.js` | Constructor takes `workspaceId`. Queries filter by `workspace_id`. `create()` inserts both columns. |
| `open-robin-server/lib/thread/ThreadManager.js` | Accepts `workspaceId`; passes to `ThreadIndex`. |
| `open-robin-server/lib/thread/ThreadWebSocketHandler.js` | Cache keys by `workspaceId`. `setPanel` creates new project manager when workspace changes. |
| `open-robin-server/lib/ws/client-message-router.js` | Removed stale `session.currentWorkspaceId` overwrite. Added `thread:search` route. |
| `open-robin-server/lib/ws/workspace-broadcaster.js` | Broadcasts `panel_config` after switch. Reads CSS files and includes `styles` payload for instant theme switching. |
| `open-robin-server/server.js` | Fixed `code-viewer` → `file-viewer`. Passes `workspaceId` to `setPanel`. Includes `styles` in `workspace:init`. |

### Phase 2: Client Workspace-Keyed State

| File | Change |
|------|--------|
| `open-robin-client/src/state/panelStore.ts` | `activeWorkspaceId`, `workspaceState`, `activateWorkspace()`. Top-level properties stay as rendering source-of-truth. Convenience selectors exported. |
| `open-robin-client/src/state/fileStore.ts` | `workspaceTrees`, `activateWorkspace()`. Tree state is workspace-keyed; tabs stay global. |
| `open-robin-client/src/state/wikiStore.ts` | `workspaceTopics`, `activateWorkspace()`. Wiki index is workspace-keyed. |
| `open-robin-client/src/lib/ws/workspace-handlers.ts` | Instant switch on cache hit. Sends `set_panel` for cached `currentPanel`. Injects inline CSS. |
| `open-robin-client/src/hooks/useSharedWorkspaceStyles.ts` | `injectWorkspaceStyles(payload)` for synchronous CSS injection. |

### Phase 3: Chat Search

| File | Change |
|------|--------|
| `open-robin-server/lib/thread/chat-search.js` | **New.** `search({ workspaceId, query, limit, offset })`. |
| `open-robin-server/lib/thread/thread-crud.js` | `handleThreadSearch` handler. |
| `open-robin-server/lib/thread/index.js` | Re-exports `search`. |
| `open-robin-server/lib/ws/client-message-router.js` | Routes `thread:search`. |

---

## Verification Checklist (from original spec)

| Item | Status | Notes |
|------|--------|-------|
| Migration 017 runs cleanly | ✅ | 11/11 threads backfilled |
| `session.currentWorkspaceId` matches new workspace | ✅ | Fixed stale closure overwrite |
| New assistant thread spawns against new workspace | ✅ | Uses `session.projectRoot` |
| `panelStore.projectRoot` equals new path after switch | ✅ | `panel_config` broadcast + `repoPath` seed |
| `thread:list` returns only current workspace threads | ✅ | `workspace_id` filter in ThreadIndex |
| Thread in workspace A does not appear in B | ✅ | Manager keyed by workspaceId |
| Wiki empty state on switch | ⚠️ | Requires manual browser test |
| Copy-path uses correct path after switch | ⚠️ | Requires manual browser test |
| No ENOENT errors after switch | ⚠️ | Requires manual browser test |
| `thread:search` defaults to current workspace | ✅ | `workspaceId` omitted → current manager's id |
| Smoke test passes | ✅ | `./restart-kimi.sh` succeeds |

---

## Unfinished Work — Complete Inventory

### 1. Workspace Cache Persistence (Highest Priority)

**Problem:** `workspaceState` is RAM-only. On browser refresh, every workspace is a "first visit" again.

**User Request:** Store workspace configuration in SQLite so it loads on reload.

**Approach Chosen:** Server-side SQLite + hydrate on connect (Electron context, local server, negligible latency).

**New Table Needed:**
```sql
CREATE TABLE workspace_client_state (
  workspace_id TEXT PRIMARY KEY,
  panel_configs TEXT,        -- JSON: PanelConfig[]
  current_panel TEXT,
  threads_json TEXT,         -- JSON: { project: Thread[], view: Thread[] }
  current_thread_ids TEXT,   -- JSON: { project: string|null, view: string|null }
  view_states TEXT,          -- JSON: Record<string, ViewUIState>
  updated_at INTEGER
);
```

**Files to Touch:**
- `open-robin-server/lib/db/migrations/018_workspace_client_state.js`
- `open-robin-server/lib/workspace/state-cache-service.js` (new — read/write cache)
- `open-robin-server/server.js` — include cached state in `workspace:init`
- `open-robin-server/lib/ws/workspace-broadcaster.js` — save cache before/after switch broadcast
- `open-robin-client/src/state/panelStore.ts` — hydrate from `workspace:init` cache on startup
- `open-robin-client/src/lib/ws/workspace-handlers.ts` — hydrate cache on `workspace:init`

**Out of scope for persistence:** Chat message history (reloaded from server), open file tabs, scroll positions.

**Related Spec to Write:** `docs/WORKSPACE_CACHE_PERSISTENCE_SPEC.md`

---

### 2. Component Selector Migration

**Problem:** 195 `usePanelStore` call sites still read top-level properties (`currentPanel`, `projectRoot`, `threads`). The convenience selectors (`getCurrentWorkspaceState`, `getCurrentPanel`, etc.) exist but are unused.

**Risk:** If the compatibility layer (top-level derived properties) is ever removed, all 195 call sites break.

**Scope:** Migrate critical components first (App, ChatArea, Sidebar, FileExplorer, FileViewer, ThreadJumpDropdown, SecondaryChat). Non-critical components (ThemePicker, TicketBoard, etc.) can wait.

**Files to Touch:** ~8–15 component/hook files in `open-robin-client/src/`

---

### 3. 500ms Background Panel Prefetch

**Problem:** Spec §8e describes prefetching non-active panel configs 500ms after landing to make panel switching instant. This was skipped because `set_panel` has side effects (closes view threads).

**Blocker:** Need a read-only `get_panel_config` message (or reuse `file_content_request` for `index.json`/`content.json`) that doesn't mutate server state.

**Files to Touch:**
- `open-robin-server/lib/ws/client-message-router.js` — add `get_panel_config` handler
- `open-robin-client/src/lib/ws/workspace-handlers.ts` — trigger prefetch timer after switch
- `open-robin-client/src/state/panelStore.ts` — cancel prefetch on user interaction

---

### 4. HTTP Routes Workspace-Aware

**Problem:** `/api/view-config` and `/api/panel-file` call `getProjectRoot()` with no connection context, so they resolve against the server-wide active workspace.

**Impact:** In single-window Electron, irrelevant. In future multi-window, a background window making an HTTP request during a switch could get the wrong workspace's data.

**Decision from Spec §4c:** Documented as accepted limitation for now. Fix only when multi-window Electron becomes a priority.

---

### 5. Rebranding (`open-robin` → `fusion-studio`)

**Problem:** `open-robin` appears in ~15 hardcoded locations across server and client.

**Decision from Spec §4b:** Postponed. Only `code-viewer` → `file-viewer` was fixed. Rebranding is a global find-replace + test pass.

---

### 6. Real-Time File/Wiki Sync

**Problem:** File tree and wiki topics are fetched on demand. No watchers keep client state in sync with disk.

**Decision from Spec §22:** Out of scope. The file watcher (`lib/watcher/`) already detects changes server-side, but there is no WebSocket push to update the client automatically.

---

### 7. Cross-Workspace Search UI

**Problem:** `thread:search` backend exists but there is no client UI for it.

**Decision from Spec §11c:** Out of scope. The handler is wired and callable via WebSocket. A future spec can add a search panel or agent tool integration.

---

### 8. LRU Eviction for Workspace Cache

**Problem:** Every visited workspace stays in RAM forever.

**Decision from Spec §4d:** Accepted for now. 5-10 workspaces with 5 panels each = negligible RAM. A future spec can add LRU eviction when the cache grows.

---

### 9. Delete Orphaned Threads

**Problem:** Migration 017 leaves rows with `workspace_id IS NULL` if no workspace basename matched.

**Open Question from Spec §15:** Should unmatched rows be deleted? Currently they are logged as a warning and left in place. They do not appear in queries (which filter by `workspace_id`), so they are harmless but pollute the table.

---

### 10. `project_id` Column Removal

**Problem:** Both `project_id` and `workspace_id` exist. A developer might accidentally query `project_id` instead of `workspace_id`.

**Decision from Spec §5a:** `project_id` is kept for backward compatibility. All reads switched to `workspace_id`. A future migration can drop `project_id` once all consumers are verified.

---

## Architecture Decisions Preserved

1. **Browser tabs share one active workspace** — All tabs force-switch together. Safe for single-window Electron.
2. **No controller/catalog layer** — SPEC-20 explicitly rejected store decoupling for Zustand-based React apps. Convenience selectors are the abstraction boundary.
3. **CSS stays in local folders** — Editable by users/AI, file-watched, version-controlled. Instant switching is achieved by inlining CSS in WebSocket messages, not by moving CSS to the database.
4. **HTTP routes remain server-wide** — Single-window Electron makes this safe.

---

## Files That Changed (This Session)

```
open-robin-server/lib/db/migrations/017_workspace_id_threads.js   (new)
open-robin-server/lib/thread/chat-search.js                        (new)
open-robin-server/lib/thread/ThreadIndex.js
open-robin-server/lib/thread/ThreadManager.js
open-robin-server/lib/thread/ThreadWebSocketHandler.js
open-robin-server/lib/thread/index.js
open-robin-server/lib/thread/thread-crud.js
open-robin-server/lib/ws/client-message-router.js
open-robin-server/lib/ws/workspace-broadcaster.js
open-robin-server/server.js
open-robin-client/src/hooks/useSharedWorkspaceStyles.ts
open-robin-client/src/lib/ws/workspace-handlers.ts
open-robin-client/src/state/fileStore.ts
open-robin-client/src/state/panelStore.ts
open-robin-client/src/state/wikiStore.ts
```

---

## How to Verify After Handoff

```bash
# Restart
cd ~/Projects/open-robin && ./restart-kimi.sh

# Check DB schema
sqlite3 open-robin-server/data/robin.db ".schema threads"

# TypeScript
cd open-robin-client && npx tsc --noEmit
```

---

## Next Session Recommended Priority

1. **Component selector migration** — 195 call sites still read top-level properties. Migrate critical components (App, ChatArea, Sidebar, FileExplorer, FileViewer, ThreadJumpDropdown, SecondaryChat).
2. **Manual browser testing** — Verify wiki empty state, copy-path, ENOENT on switch, panel restore after refresh.
3. **File watcher cache invalidation** — When panels are added/removed on disk, invalidate the JSON cache entry so next load triggers rediscovery.
4. **500ms panel prefetch** — Add read-only `get_panel_config` message, prefetch non-active panels after switch.
