# Workspace Switcher & Isolation — Master Spec

**Status:** Draft — under review.  
**Owner:** Fusion Studio core.  
**Prerequisite for:** Fusion Studio Electron packaging, per-workspace chat isolation, hub-workspace template system.  
**Depends on:** `MULTI_WORKSPACE_SPEC.md`, `CHAT_SCOPE_SPEC.md`, `WORKSPACE_SWITCHER_EVALUATION_AND_FUSION_STUDIO_PLAN.md`.  
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

The workspace switcher UI works, but the **runtime isolation underneath is broken**. After switching workspaces, the server can still resolve files, spawn chat wires, and emit bus events against the **previous** workspace. The client can still build paths and request content from the **previous** workspace. These leaks are subtle — they don't crash, they just silently serve the wrong content.

This spec defines the complete fix for workspace isolation:
1. **Session hygiene** — eliminate stale closures and corrupted workspace IDs.
2. **Client state sync** — ensure the client learns the new `projectRoot` after every switch.
3. **Database integrity** — bind threads to `workspaces.id` instead of `basename(repo_path)`.
4. **Chat search** — enable querying past conversations by workspace.
5. **Rebranding path** — decide when to refactor `open-robin` → `fusion-studio` relative to workspace work.
6. **Electron implications** — how single-process packaging changes the session model.

---

## 2. Terminology

| Term | Meaning |
|---|---|
| **Workspace** | A registered repo/folder with an entry in the `workspaces` table. Exactly one is "active" server-wide at any moment. |
| **View panel** | A display surface inside a workspace: `file-viewer`, `wiki-viewer`, `doc-viewer`, etc. Switching view panels does NOT switch workspaces. |
| **Browser tab** | A separate browser window or tab connected via WebSocket. Today, **all tabs share the same active workspace** — switching in one tab force-switches all others. |
| **Project root** | The absolute filesystem path of the active workspace (`workspaces.repo_path`). |

---

## 3. Bug Registry

### Bug 1: Stale `projectRoot` closure corrupts session on new thread open

**Severity:** Critical — causes cross-workspace file and chat leaks.  
**File:** `open-robin-server/lib/ws/client-message-router.js`, `thread:open-assistant` branch.  
**Root cause:** `createClientMessageRouter` captures `projectRoot` in a closure at connection time. After a workspace switch, `session.projectRoot` is updated by the event bus listener, but the closure variable is not.

```js
// CORRUPTION — uses stale connection-time closure, not session state
session.currentWorkspaceId = path.basename(projectRoot);
const wire = spawnThreadWire(threadId, projectRoot, scopeContext);
```

**Impact after switch:**
- `session.currentWorkspaceId` reverts to the old workspace's basename.
- `chat-scope.js` emits bus events with the wrong workspace ID.
- The AI wire reads files from the **old** workspace.
- New threads are written to the **old** workspace's `ai/views/chat/threads/`.

**Fix (SPEC, not code):** Remove the overwrite. Use `session.projectRoot` and `session.currentWorkspaceId` exclusively inside `thread:open-assistant`.

---

### Bug 2: Client `projectRoot` never updates on workspace switch

**Severity:** Critical — client builds paths against wrong workspace.  
**File:** `open-robin-client/src/lib/ws/workspace-handlers.ts`, `workspace:switched` handler.  
**Root cause:** The handler updates `activeWorkspaceId`, resets file tree/styles, and triggers panel rediscovery, but **never calls `setProjectRoot()`**. The `msg.repoPath` field from the server is ignored.

**Impact:**
- `panelStore.projectRoot` remains stale.
- `resolveAbsolutePath()` in `resource-path.ts` returns old workspace paths.
- Copy-path buttons, wiki links, and any client-side path construction point to the wrong filesystem location.

**Fix (SPEC, not code):** On `workspace:switched`, call `store.setProjectRoot(msg.repoPath)` before `rediscoverPanels()`.

---

### Bug 3: Server never re-sends `panel_config` after workspace switch

**Severity:** Medium — client has no authoritative source for new root.  
**File:** `open-robin-server/lib/ws/workspace-broadcaster.js`.  
**Root cause:** `workspace:switched` broadcasts `{ type, from, to, repoPath }` but does **not** send `panel_config`. The client only knows `projectRoot` from the initial connection message.

**Impact:** Even if Bug 2 is fixed, the client is relying on an incidental field (`repoPath`) rather than the standard `panel_config` message. Other message types (e.g. future HTTP handoff) expect the client to know its `projectRoot` from `panel_config`.

**Fix (SPEC, not code):** After broadcasting `workspace:switched`, send `panel_config` to all connected clients with the new `projectRoot` and `projectName`.

---

### Bug 4: `project_id` collision in SQLite and cache

**Severity:** High — two workspaces with same basename share threads.  
**Files:** `open-robin-server/lib/thread/ThreadManager.js`, `ThreadWebSocketHandler.js`, `ThreadIndex.js`.  
**Root cause:** The `threads` table discriminates by `project_id = basename(projectRoot)`. Thread manager caches key by the same value. No formal relationship to `workspaces.id`.

**Impact:**
- `/Projects/foo` and `/Work/foo` share SQLite rows.
- `projectThreadManagers` Map returns the same manager for both.
- Threads created in one workspace appear in the other.

**Fix (SPEC, not code):** Add `workspace_id` to `threads`, backfill from `workspaces`, filter all queries by `workspace_id`, key caches by `workspaceId`.

---

### Bug 5: `code-viewer` stale default panel reference

**Severity:** Low — causes missing default panel on new workspaces.  
**File:** `open-robin-server/server.js`, WebSocket connection handler.  
**Root cause:** The default panel at connection time is hardcoded to `code-viewer`, which was renamed to `file-viewer` in a prior refactor. `views.resolveChatConfig(projectRoot, 'code-viewer')` returns `null` on workspaces that only have `file-viewer`.

**Impact:** New WebSocket connections to `fusion-home` don't get a default panel set, so `ThreadManager` isn't initialized until the client sends `set_panel`.

**Fix (SPEC, not code):** Change `code-viewer` → `file-viewer` in the connection handler.

---

## 4. Design Decisions

### 4a. Browser tabs share one active workspace (today)

The current architecture broadcasts `workspace:switched` to **all** connected clients. This means:
- Tab A switches to workspace X → Tab B is force-switched to X too.
- This is documented as "sufficient for today's single-tab reality" in `workspace-controller.js`.

**Electron implication:** In Electron, there is only one renderer process (one "tab"). The force-switch behavior becomes a non-issue. The broadcast model can be preserved for future multi-window Electron, but it's not a blocker for packaging.

**SPEC decision:** Keep the broadcast model. Do not add per-tab workspace isolation in this phase.

### 4b. Rebranding: postpone or preface?

`open-robin` appears in ~15 hardcoded locations across server and client. The categories:

| Category | Count | Workspace-risk? |
|---|---|---|
| Product name in wire protocol / harness client info | 4 | **No** — cosmetic |
| Directory names (`open-robin-server`, `open-robin-client`) | 2 | **Yes** — server.js static path, runner prompt builder |
| macOS keychain account name | 2 | **Yes** — secrets would be stored under old name |
| Migration seed data | 2 | **No** — easily updated |
| Comments and docs | 5 | **No** |

**Risk assessment:** The workspace isolation changes touch `server.js`, `client-message-router.js`, and `ThreadWebSocketHandler.js`. The rebranding also touches `server.js` (static file path) and `client-message-router.js` (wire client name). There is **overlap in files but not in logic**. Rebranding does not change how workspace switching works.

**SPEC decision:** Postpone rebranding. Do workspace isolation first. Rebranding is a global find-replace + test pass that can be done later with AI assistance. The one exception: update `code-viewer` → `file-viewer` now because it's a correctness bug, not a branding change.

### 4c. HTTP routes vs. WebSocket handlers

HTTP routes (`/api/view-config`, `/api/panel-file`) call `getProjectRoot()` with no `ws` argument, so they always resolve against the **server-wide active workspace**. In a multi-browser-tab world, this is dangerous. In Electron (single window), it's fine.

**SPEC decision:** Do not add per-connection HTTP context in this phase. Document the limitation: HTTP routes are only safe because Electron has one window. If multi-window is added later, HTTP routes must become session-aware (cookies, headers, or query params).

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

**No foreign key.** The project already has a broken FK (`workspace_themes` → `workspaces_old`). Adding a real FK here provides no value since the app layer never deletes workspaces that have threads.

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

This gives every client an authoritative `projectRoot` update via the standard message type.

### 6c. Client: update `projectRoot` on `workspace:switched`

**File:** `open-robin-client/src/lib/ws/workspace-handlers.ts`

Before `rediscoverPanels(ws)`:
```ts
if (msg.repoPath) {
  usePanelStore.getState().setProjectRoot(msg.repoPath);
}
```

Alternatively, rely on the `panel_config` message from 6b and update `ws-client.ts` to handle `panel_config` at any time (not just at connection). Either approach works; 6b + `ws-client.ts` is cleaner because it uses the standard message type.

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

## 8. Chat Search Module

### 8a. Purpose

Enable querying `exchanges` by workspace so users (and future agent tools) can search past conversations. Cross-workspace search is possible but not the default.

### 8b. Module: `lib/thread/chat-search.js`

```js
async function search({ workspaceId, query, limit = 50, offset = 0 })
```

- `workspaceId` omitted → defaults to current workspace (from session).
- `workspaceId: null` explicitly → searches across all workspaces.
- Strategy: `LIKE` on `exchanges.user_input` and `exchanges.assistant`, joined to `threads`.
- Result includes thread name, workspace, view, timestamp, and parsed message content.

**FTS5:** Out of scope for this spec. If exchange volume exceeds ~10k, a follow-up spec can add an FTS5 virtual table without changing the API.

### 8c. WebSocket message: `thread:search`

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

## 9. Electron Packaging Implications

### 9a. Single renderer = single WebSocket

In Electron, there is one browser window (one renderer process). The "all tabs force-switch" behavior becomes irrelevant. The workspace switcher can still exist as a UI element, but there's only one client to broadcast to.

### 9b. Bundled hub workspace

The Electron binary ships with `Fusion-Home/` embedded. On first launch:
1. Copy the bundled workspace to the user's home directory (e.g. `~/Fusion-Home/`).
2. Register it in the `workspaces` table with `id: 'fusion-home'`.
3. Set it as `last_active_workspace_id`.

**Path resolution:** The server runs inside Electron's main process. `getProjectRoot()` resolves to the user's copied path, not the bundled path inside the app bundle. This is already how `projectRoot` works — it's dynamic.

### 9c. Server and client paths

Today:
- `server.js` serves static files from `../open-robin-client/dist`.
- `lib/runner/prompt-builder.js` reads from `projectRoot/open-robin-server/AGENTS.md`.

In Electron:
- Static files are served from inside the app bundle (path TBD by Electron build).
- `AGENTS.md` should be read from the app bundle, not the workspace.

**SPEC note:** These are rebranding concerns, not workspace isolation concerns. Documented here for awareness but out of scope for this spec.

### 9d. macOS keychain

Today: `account = "open-robin"`.  
In Electron: `account = "fusion-studio"` (or bundle identifier).

**SPEC note:** Changing the keychain account name means existing secrets won't be found. This is acceptable for a rebrand + packaging event, but users should be warned. Out of scope for workspace isolation.

---

## 10. Files to Change

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
| `open-robin-client/src/lib/ws/workspace-handlers.ts` | Update `projectRoot` from switch message before rediscovery. |
| `open-robin-client/src/lib/ws-client.ts` | Handle `panel_config` at any time (not just connection). |

---

## 11. Verification Checklist

- [ ] Migration 017 runs cleanly and backfills correctly.
- [ ] After workspace switch, `session.currentWorkspaceId` matches the new workspace ID (not a basename).
- [ ] After workspace switch, opening a new assistant thread spawns the wire against the **new** workspace.
- [ ] After workspace switch, `panelStore.projectRoot` on the client equals the new workspace path.
- [ ] `thread:list` returns only threads for the current workspace.
- [ ] Creating a thread in workspace A does not appear in workspace B.
- [ ] `thread:search` defaults to current workspace; `workspaceId: null` searches all.
- [ ] Smoke test passes.
- [ ] Server restart script builds and starts successfully.

---

## 12. Open Questions

1. **Orphan cleanup:** Should migration 017 delete `threads` rows whose `workspace_id` remains NULL after backfill?
2. **Search UI:** Dedicated client panel, or agent tool callable through wire protocol?
3. **Multi-window Electron:** If future Electron adds multiple windows, should each window have its own active workspace? This would require per-connection HTTP context and abandoning the server-wide active workspace model.
4. **FTS5:** At what exchange volume should we graduate from `LIKE` to full-text search?
