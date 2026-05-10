# Workspace Isolation & Workspace-Keyed Client State — Spec

**Status:** Approved — ready to implement.  
**Owner:** Fusion Studio core.  
**Scope:** Server-side workspace isolation + client-side workspace-keyed state architecture. Fixes path corruption on switch. Enables fast workspace switching with preserved panel state.  
**Depends on:** `MULTI_WORKSPACE_SPEC.md`, `CHAT_SCOPE_SPEC.md`.  
**Related:** `WORKSPACE_SWITCHER_EVALUATION_AND_FUSION_STUDIO_PLAN.md` (bug root cause analysis).  
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

Today, workspace switching corrupts file paths because the client holds **one global state** for everything — one `projectRoot`, one wiki topic list, one file tree. When the workspace changes, the global state becomes a mix of old and new data.

This spec replaces the global state model with a **workspace-keyed state** model. Each workspace gets its own cache of panels, file trees, and view content. Switching workspaces simply swaps which cache is active. This:
1. **Fixes the path corruption bug** — old workspace data never leaks into new workspace rendering.
2. **Enables fast switching** — returning to a previous workspace renders from cache instead of reloading from disk.
3. **Preserves panel memory** — each workspace remembers which panel you last had open.
4. **Preloads all panels** — 500ms after landing, non-visible panel configs are fetched in background so panel switching within a workspace is instant.

**Out of scope for this SPEC:** real-time file/wiki sync, file system watchers, clipboard/screenshot performance, rebranding (`open-robin` → `fusion-studio`), LRU eviction, persisting cache to disk, cross-workspace search UI.

---

## 2. Mental Model

```
Client State
├── activeWorkspaceId: 'fusion-home'
│
├── workspaceState = {
│     'open-robin': {
│       projectRoot: '/Users/.../open-robin',
│       panels: { file-viewer: {...}, wiki-viewer: {...} },
│       fileTree: { ... },
│       currentPanel: 'wiki-viewer',
│       threads: { project: [...], view: [...] }
│     },
│     'fusion-home': {
│       projectRoot: '/Users/.../Fusion-Home',
│       panels: { file-viewer: {...} },
│       fileTree: { ... },
│       currentPanel: 'file-viewer',
│       threads: { project: [...], view: [...] }
│     }
│   }
│
└── global (theme, clipboard, connection status)
```

Switching workspaces = `activeWorkspaceId = 'open-robin'`. The UI re-renders from `workspaceState['open-robin']`. No fetch. No spinner.

If a workspace has never been visited, its cache is empty. The client requests panels and file tree on first visit.

---

## 3. Bug Registry (Root Causes Being Fixed)

### Bug 1: Stale `projectRoot` closure corrupts session on new thread open

**Severity:** Critical.  
**File:** `open-robin-server/lib/ws/client-message-router.js`, `thread:open-assistant` branch.  
**Root cause:** `createClientMessageRouter` captures `projectRoot` in a closure at connection time. After a workspace switch, `session.projectRoot` is updated by the event bus listener, but the closure variable is not.

```js
// CORRUPTION — uses stale connection-time closure, not session state
session.currentWorkspaceId = path.basename(projectRoot);
const wire = spawnThreadWire(threadId, projectRoot, scopeContext);
```

**Fix:** Remove the overwrite. Use `session.projectRoot` and `session.currentWorkspaceId` exclusively.

### Bug 2: Client `projectRoot` never updates on workspace switch

**Severity:** Critical.  
**File:** `open-robin-client/src/lib/ws/workspace-handlers.ts`, `workspace:switched` handler.  
**Root cause:** The handler updates `activeWorkspaceId`, resets file tree/styles, and triggers panel rediscovery, but **never calls `setProjectRoot()`**. The `msg.repoPath` field from the server is ignored.

**Impact:** `panelStore.projectRoot` remains stale. `resolveAbsolutePath()` returns old workspace paths. Copy-path buttons point to wrong filesystem locations.

**Fix:** On `workspace:switched`, update `projectRoot` from `msg.repoPath` (or rely on server-sent `panel_config` — see Bug 3).

### Bug 3: Server never re-sends `panel_config` after workspace switch

**Severity:** Medium.  
**File:** `open-robin-server/lib/ws/workspace-broadcaster.js`.  
**Root cause:** `workspace:switched` broadcasts `{ type, from, to, repoPath }` but does **not** send `panel_config`. The client only knows `projectRoot` from the initial connection message.

**Fix:** After broadcasting `workspace:switched`, send `panel_config` to all clients with the new `projectRoot` and `projectName`.

### Bug 4: `project_id` collision in SQLite and cache

**Severity:** High.  
**Files:** `open-robin-server/lib/thread/ThreadManager.js`, `ThreadWebSocketHandler.js`, `ThreadIndex.js`.  
**Root cause:** `threads` table discriminates by `project_id = basename(projectRoot)`. Thread manager caches key by the same value. No formal relationship to `workspaces.id`.

**Fix:** Add `workspace_id` to `threads`, backfill from `workspaces`, filter all queries by `workspace_id`, key caches by `workspaceId`.

### Bug 5: `code-viewer` stale default panel reference

**Severity:** Low.  
**File:** `open-robin-server/server.js`, WebSocket connection handler.  
**Root cause:** Default panel at connection time is hardcoded to `code-viewer`, renamed to `file-viewer` in a prior refactor.

**Fix:** Change `code-viewer` → `file-viewer`.

---

## 4. Design Decisions

### 4a. Browser tabs share one active workspace (preserved)

The current architecture broadcasts `workspace:switched` to **all** connected clients. This means all browser tabs force-switch together.

**Decision:** Keep this model. In Electron (single renderer), it's irrelevant. Future multi-window Electron would need per-window isolation — out of scope.

### 4b. Rebranding postponed

`open-robin` appears in ~15 hardcoded locations. Workspace isolation and rebranding touch some of the same files (`server.js`, `client-message-router.js`) but different logic.

**Decision:** Postpone rebranding. Do workspace isolation first. Rebranding is a global find-replace + test pass that can be done later with AI assistance. The one exception: `code-viewer` → `file-viewer` is fixed in this spec because it's a correctness bug.

### 4c. HTTP routes remain server-wide

HTTP routes (`/api/view-config`, `/api/panel-file`) call `getProjectRoot()` with no `ws` argument, so they always resolve against the **server-wide active workspace**.

**Decision:** Do not add per-connection HTTP context in this phase. Safe in single-window Electron. Documented as a limitation for future multi-window.

### 4d. No LRU eviction

Every visited workspace stays in `workspaceState` RAM forever.

**Decision:** Acceptable for now. 5-10 workspaces with 5 panels each = negligible RAM. A future spec can add LRU eviction.

---

## 5. Schema Changes

### 5a. Migration 017 — `workspace_id` on `threads`

**File:** `open-robin-server/lib/db/migrations/017_workspace_id_threads.js`

| Step | Action | Rationale |
|---|---|---|
| 1 | `ALTER TABLE threads ADD COLUMN workspace_id TEXT` | New discriminator. Nullable during migration for safety. |
| 2 | Backfill: for each `workspaces` row, update `threads.workspace_id = workspaces.id` where `threads.project_id = basename(workspaces.repo_path)` and `workspace_id IS NULL`. | First-match wins for ambiguous basenames. Unmatched rows stay NULL. |
| 3 | `CREATE INDEX threads_workspace_id_idx ON threads(workspace_id)` | Fast workspace-scoped list queries. |
| 4 | `CREATE INDEX threads_workspace_scope_view_idx ON threads(workspace_id, scope, view_id)` | Covers workspace-universal and view-bound list queries. |

**No foreign key.** The project already has a broken FK (`workspace_themes` → `workspaces_old`). Adding a real FK provides no value since the app layer never deletes workspaces that have threads.

**`project_id` deprecation:** Kept in schema and written by `ThreadIndex.create()` for backward compatibility. All reads switch to `workspace_id`. A future migration drops `project_id` once all consumers are verified.

---

## 6. Session Hygiene Fixes

### 6a. Server: stop using stale closure `projectRoot`

**File:** `open-robin-server/lib/ws/client-message-router.js`

Inside `thread:open-assistant`:
- **Delete:** `session.currentWorkspaceId = path.basename(projectRoot);`
- **Use:** `session.currentWorkspaceId` (already correct from connection init + switch listener)
- **Use:** `session.projectRoot` when spawning the wire, not the closure `projectRoot`

The closure `projectRoot` should only be used for the initial `panel_config` message at connection time. After that, `session.projectRoot` is the source of truth.

### 6b. Server: broadcast `panel_config` on workspace switch

**File:** `open-robin-server/lib/ws/workspace-broadcaster.js` (or `server.js` listener)

After broadcasting `workspace:switched`, send to all clients:
```json
{
  "type": "panel_config",
  "projectRoot": "/Users/.../fusion-home",
  "projectName": "fusion-home"
}
```

### 6c. Client: handle `panel_config` at any time

**File:** `open-robin-client/src/lib/ws-client.ts`

Currently `panel_config` is handled at connection time. **New behavior:** Handle it whenever it arrives, updating `workspaceState[workspaceId].projectRoot`.

---

## 7. Application Layer Changes

### 7a. ThreadIndex — filter by `workspace_id`

**File:** `open-robin-server/lib/thread/ThreadIndex.js`

- Constructor: `(workspaceId, scope, viewId)` instead of `(projectId, scope, viewId)`.
- Queries: `.where('workspace_id', this.workspaceId)` instead of `project_id`.
- `create()`: inserts both `project_id` (deprecated) and `workspace_id`.

### 7b. ThreadManager — accept `workspaceId`

**File:** `open-robin-server/lib/thread/ThreadManager.js`

- Config: `workspaceId: config.workspaceId || path.basename(this.projectRoot)` (fallback for compatibility).
- Pass `workspaceId` to `ThreadIndex`.
- `projectRoot` remains required for filesystem paths (`.md`, `history.json`).

### 7c. ThreadWebSocketHandler — key caches by `workspaceId`

**File:** `open-robin-server/lib/thread/ThreadWebSocketHandler.js`

- `getProjectThreadManager(projectRoot, workspaceId)` — new param.
- `getViewThreadManager(viewId, projectRoot, workspaceId)` — new param.
- Cache keys: `workspaceId || basename(projectRoot)`.
- `setPanel` config accepts `workspaceId`.

### 7d. Connection handler — pass `workspaceId`, fix default panel

**File:** `open-robin-server/server.js`

- Pass `workspaceId: activeWs ? activeWs.id : null` to `setPanel`.
- Change default panel from `code-viewer` to `file-viewer`.

### 7e. `set_panel` handler — pass `workspaceId`

**File:** `open-robin-server/lib/ws/client-message-router.js`

- Pass `session.currentWorkspaceId` in `setPanel` config.
- Remove the `session.currentWorkspaceId` overwrite in `thread:open-assistant`.

---

## 8. Client Architecture (Workspace-Keyed State)

### 8a. `panelStore` becomes workspace-keyed

**Current:** Single `panels`, `projectRoot`, `currentPanel`, `threads` at top level.

**New:**
```ts
interface WorkspacePanelState {
  projectRoot: string | null;
  panels: Record<string, PanelState>;
  currentPanel: string | null;
  threads: { project: Thread[]; view: Thread[] };
  currentThreadIds: { project: string | null; view: string | null };
}

interface PanelStore {
  activeWorkspaceId: string | null;
  workspaceState: Record<string, WorkspacePanelState>;
  // global things that don't vary by workspace:
  ws: WebSocket | null;
  secondary: SecondaryChatState | null;
  themes: Theme[];
}
```

**Selectors:**
- `getCurrentWorkspaceState()` → `workspaceState[activeWorkspaceId]`
- `getCurrentPanel()` → `workspaceState[activeWorkspaceId].currentPanel`
- `getCurrentFileTree()` → `workspaceState[activeWorkspaceId].fileTree`

### 8b. `fileStore` becomes workspace-keyed

**Current:** Single global file tree and recent files.

**New:**
```ts
interface FileStore {
  workspaceTrees: Record<string, FileTree>;
  workspaceRecentFiles: Record<string, RecentFile[]>;
}
```

`loadRootTree()` writes to `workspaceTrees[activeWorkspaceId]`.

### 8c. View-specific stores (wiki, issues, agents)

Each view that caches content keys its cache by workspace:
```ts
wikiStore = {
  workspaceTopics: Record<string, Topic[]>
}
```

### 8d. Workspace switch flow

```
User switches workspace
  → workspaceStore sets activeWorkspaceId
  → panelStore checks if workspaceState[workspaceId] exists
      YES → render from cache immediately
      NO  → create empty state, request panels from server
  → if panels exist and currentPanel is set
      → send set_panel for currentPanel
      → render immediately
  → request file tree (background, non-blocking)
```

**No `reset()`. No `rediscoverPanels()` blocking the UI.** The switch is instant if cached.

### 8e. 500ms background panel prefetch

After landing on a workspace (whether from cache or fresh), wait 500ms, then quietly fetch all other panel configs:
```ts
setTimeout(() => {
  for (const panelId of otherPanels) {
    sendSetPanel(panelId); // server returns panel_changed
    storePanelConfig(workspaceId, panelId, config);
  }
}, 500);
```

This makes clicking between panels within a workspace instant.

### 8f. First visit to a workspace

On first visit:
1. Create empty `WorkspacePanelState`.
2. Request `file_tree_request` for `__panels__`.
3. Server discovers panels and returns them.
4. Client sets `currentPanel` to the first panel (or remembers from server-side view state).
5. Request file tree for `currentPanel`.

---

## 9. Panel State Persistence

### 9a. What stays in RAM per workspace

| Data | Persisted? | Where |
|---|---|---|
| Panel list | Yes | `workspaceState[ws].panels` |
| Current panel | Yes | `workspaceState[ws].currentPanel` |
| File tree | Yes | `fileStore.workspaceTrees[ws]` |
| Thread list | Yes | `workspaceState[ws].threads` |
| Wiki topics | Yes | `wikiStore.workspaceTopics[ws]` |
| Issues list | Yes | `issuesStore.workspaceIssues[ws]` |
| Open files / scroll position | No | Future spec |
| Chat message history | No (reloaded from server) | `workspaceState[ws].currentThreadIds` only |

### 9b. What is global (not workspace-keyed)

- WebSocket connection
- Theme / CSS variables
- Clipboard state
- Connection status
- Modal / toast state

---

## 10. Server-Client Contract Changes

### 10a. `workspace:switched` message

Already sent by server. Client currently ignores `repoPath`.

**New behavior:** Client uses `repoPath` to initialize `workspaceState[workspaceId].projectRoot` if the workspace cache doesn't exist yet. If it does exist, `projectRoot` is already known.

### 10b. `panel_config` message

Currently sent once at connection time.

**New behavior:** Also sent after `workspace:switched`. Client updates `workspaceState[workspaceId].projectRoot`.

### 10c. `panel_changed` message

Sent when `set_panel` is processed.

**New behavior:** Client writes panel config into `workspaceState[workspaceId].panels[panelId]`.

### 10d. `file_tree_response` message

**New behavior:** Client writes tree into `fileStore.workspaceTrees[workspaceId]`.

---

## 11. Chat Search Module

### 11a. Purpose

Enable querying `exchanges` by workspace so users (and future agent tools) can search past conversations. Cross-workspace search is possible but not the default.

### 11b. Module: `lib/thread/chat-search.js`

```js
async function search({ workspaceId, query, limit = 50, offset = 0 })
```

- `workspaceId` omitted → defaults to current workspace (from session).
- `workspaceId: null` explicitly → searches across all workspaces.
- Strategy: `LIKE` on `exchanges.user_input` and `exchanges.assistant`, joined to `threads`.
- Result includes thread name, workspace, view, timestamp, and parsed message content.

**FTS5:** Out of scope for this spec. If exchange volume exceeds ~10k, a follow-up spec can add an FTS5 virtual table without changing the API.

### 11c. WebSocket message: `thread:search`

**Client → Server:**
```json
{ "type": "thread:search", "query": "auth flow", "workspaceId": "open-robin", "limit": 20 }
```

**Server → Client:**
```json
{ "type": "thread:search_result", "query": "auth flow", "workspaceId": "open-robin", "total": 12, "results": [...] }
```

Handler added to `thread-crud.js` and re-exported through `ThreadWebSocketHandler`.

---

## 12. Electron Implications

- Single renderer = single client state tree. No cross-tab sync needed.
- Workspace caches persist for the Electron session. On app quit, they are lost.
- Future: persist `workspaceState` to Electron `localStorage` or IndexedDB so panels survive app restart.
- Hotkeys for workspace switching map to `workspaceStore.requestSwitch(id)`.

---

## 13. Files to Change

| File | Change |
|---|---|
| `open-robin-server/lib/db/migrations/017_workspace_id_threads.js` | **New.** Add `workspace_id`, backfill, indexes. |
| `open-robin-server/lib/thread/chat-search.js` | **New.** Search query builder. |
| `open-robin-server/lib/thread/ThreadIndex.js` | Filter by `workspace_id`; constructor takes `workspaceId`. |
| `open-robin-server/lib/thread/ThreadManager.js` | Accept `workspaceId`; pass to `ThreadIndex`. |
| `open-robin-server/lib/thread/ThreadWebSocketHandler.js` | Cache keys by `workspaceId`; `setPanel` accepts `workspaceId`. |
| `open-robin-server/lib/thread/thread-crud.js` | Add `handleThreadSearch`. |
| `open-robin-server/lib/thread/index.js` | Re-export `chat-search`. |
| `open-robin-server/server.js` | Pass `workspaceId` to `setPanel`; fix `code-viewer` → `file-viewer`. |
| `open-robin-server/lib/ws/client-message-router.js` | Pass `workspaceId` to `setPanel`; **remove** stale `session.currentWorkspaceId` overwrite; use `session.projectRoot` for wire spawn. |
| `open-robin-server/lib/ws/workspace-broadcaster.js` | Broadcast `panel_config` after `workspace:switched`. |
| `open-robin-client/src/lib/ws-client.ts` | Handle `panel_config` at any time (not just connection). |
| `open-robin-client/src/lib/ws/workspace-handlers.ts` | Update `projectRoot` from switch message before rediscovery. |
| `open-robin-client/src/state/panelStore.ts` | Refactor to workspace-keyed state. |
| `open-robin-client/src/state/fileStore.ts` | Refactor to workspace-keyed state. |
| `open-robin-client/src/state/wikiStore.ts` (or inline) | Add workspace-keyed topic cache. |

---

## 14. Gotchas & Risks

### 14a. Stale closure bug is silent

The `session.currentWorkspaceId = path.basename(projectRoot)` overwrite does not throw. It silently corrupts scope strings. The fix is a **deletion**, not an addition — easy to miss in code review.

### 14b. Client refactor touches many selectors

Every component that reads `usePanelStore.getState().currentPanel` or `usePanelStore.getState().projectRoot` must be updated to read through `workspaceState[activeWorkspaceId]`. A missed selector will read stale global state.

**Mitigation:** Add convenience selectors (`getCurrentWorkspaceState()`, `getCurrentPanel()`) and migrate all call sites to use them. Do not inline `workspaceState[activeWorkspaceId]` everywhere.

### 14c. 500ms prefetch can race with user interaction

If the user clicks a panel during the 500ms prefetch window, both the user-initiated `set_panel` and the prefetch `set_panel` may fire simultaneously.

**Mitigation:** Cancel prefetch if user interacts with panels. Use `AbortController` or a simple boolean flag.

### 14d. HTTP routes are not workspace-aware

`/api/view-config` and `/api/panel-file` use the server-wide active workspace. If a client makes an HTTP request during a switch (before its session has updated), it may receive the wrong workspace's data.

**Mitigation:** In practice, this window is milliseconds. For now, accept the risk. Document for future multi-window Electron.

### 14e. Migration 017 backfill ambiguity

If two workspaces share the same basename, the backfill loop picks the first match. Orphaned rows (NULL `workspace_id`) are acceptable for pre-prod data but may confuse queries.

**Mitigation:** Log a warning for unmatched rows. Do not delete them automatically — let the user decide.

### 14f. `project_id` vs `workspace_id` coexistence

For a transition period, both columns exist. A developer might accidentally query `project_id` instead of `workspace_id`, reintroducing the collision bug.

**Mitigation:** Add a code comment on `project_id` in the migration: `-- DEPRECATED: use workspace_id`. Update `ThreadIndex` queries first; other modules can migrate incrementally.

---

## 15. Verification Checklist

- [ ] Migration 017 runs cleanly and backfills correctly.
- [ ] After workspace switch, `session.currentWorkspaceId` matches the new workspace ID (not a basename).
- [ ] After workspace switch, opening a new assistant thread spawns the wire against the **new** workspace.
- [ ] After workspace switch, `panelStore.projectRoot` on the client equals the new workspace path.
- [ ] `thread:list` returns only threads for the current workspace.
- [ ] Creating a thread in workspace A does not appear in workspace B.
- [ ] Switch Open Robin → FS Home: wiki shows empty state instantly, no Open Robin topics visible.
- [ ] Switch FS Home → Open Robin: wiki shows Open Robin topics instantly, copy-path copies Open Robin path.
- [ ] No ENOENT errors after switch.
- [ ] `thread:search` defaults to current workspace; `workspaceId: null` searches all.
- [ ] Smoke test passes.
- [ ] Server restart script builds and starts successfully.

---

## 16. For the Next Session

### What was decided in this meeting

1. **Scope is locked:** Server isolation fixes + client workspace-keyed state + 500ms panel prefetch + chat search server module. Real-time sync, file watchers, clipboard performance, and rebranding are OUT.
2. **Rebranding postponed:** `open-robin` strings stay. Only `code-viewer` → `file-viewer` is fixed.
3. **No LRU eviction:** All workspace caches stay in RAM forever.
4. **Single shared active workspace preserved:** All browser tabs force-switch together. Safe for Electron single-window.
5. **500ms prefetch is the cache population mechanism:** Panels are kept warm in RAM after first visit. Switching workspaces renders from cache instantly.

### Recommended implementation order

1. **Server fixes first** (independent of client refactor):
   - Fix stale closure in `client-message-router.js`
   - Broadcast `panel_config` on switch
   - Migration 017
   - Update `ThreadIndex`, `ThreadManager`, `ThreadWebSocketHandler`
2. **Client refactor** (depends on server fixes):
   - Refactor `panelStore` to workspace-keyed
   - Refactor `fileStore` to workspace-keyed
   - Add workspace-keyed wiki/issue/agent stores
   - Update `workspace-handlers.ts` switch flow
   - Add 500ms prefetch logic
3. **Chat search** (can happen in parallel with client refactor):
   - `chat-search.js` module
   - `thread:search` WebSocket handler
   - Wire up in `thread-crud.js`

### Open questions for future sessions

1. Should migration 017 delete `threads` rows whose `workspace_id` remains NULL after backfill?
2. At what exchange volume should `LIKE` search graduate to FTS5?
3. Search UI: dedicated client panel, or agent tool callable through wire protocol?
4. Should the client persist `workspaceState` to IndexedDB for Electron app restart?
5. When do we tackle real-time file/wiki sync with file watchers?
