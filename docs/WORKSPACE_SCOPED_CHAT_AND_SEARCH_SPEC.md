# Workspace-Scoped Chat Threading & Search — Spec

**Status:** Draft — ready for review.  
**Owner:** Open Robin core.  
**Prerequisite for:** Per-workspace chat isolation, cross-workspace chat search, Fusion Studio hub workspace.  
**Depends on:** `MULTI_WORKSPACE_SPEC.md` (workspace registry and switching), `CHAT_SCOPE_SPEC.md` (structured scope strings), migration `008_project_scoped_threads.js`.  
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

Today the `threads` table uses `project_id = basename(projectRoot)` as its workspace discriminator. This is fragile: two workspaces at different paths but with the same basename (e.g. `/Projects/foo` and `/Work/foo`) collide in the database and in the `ThreadManager` cache. Worse, there is no formal relationship between the `threads` table and the `workspaces` registry table, so the system cannot reliably answer "what chats belong to workspace X?"

This spec:
1. Introduces a proper `workspace_id` column on `threads` that references `workspaces.id`.
2. Retires `project_id` as the primary filter (kept for backward compatibility).
3. Fixes a session bug that overwrites the real workspace ID with a path basename.
4. Adds a server-side chat search module scoped by workspace, with opt-in cross-workspace search.

---

## 2. Current State & Bugs

### 2a. `session.currentWorkspaceId` corruption

**Location:** `open-robin-server/lib/ws/client-message-router.js`, inside `thread:open-assistant` handling (line ~131).

```js
session.currentWorkspaceId = path.basename(projectRoot);
```

This overwrites the actual workspace ID (set correctly in `server.js` at connection time and updated on `workspace:switched`) with the directory basename. While they often match today, they diverge when:
- The workspace registry deduplicates IDs (`foo` vs `foo-2`).
- A workspace is renamed but lives at a path whose basename differs from the registry ID.

**Impact:** Event bus scope strings (`workspace:<id>`) emitted by `chat-scope.js` carry the wrong workspace ID. Downstream subscribers (broadcaster, lifecycle controller, audit hooks) route events to the wrong namespace.

### 2b. `project_id` collision risk

**Location:** `open-robin-server/lib/thread/ThreadManager.js` line 53; `ThreadWebSocketHandler.js` lines 53, 74.

```js
this.projectId = path.basename(this.projectRoot);
```

The `threads` table filters on this value. The `projectThreadManagers` and `viewThreadManagers` caches key on it. If two workspaces share a basename, they share SQLite rows and in-memory managers — threads leak across workspaces.

### 2c. No chat search

The `exchanges` table holds every user message and assistant response. There is no query surface for searching across them. Users (and agent tools) cannot ask "what did we decide about the auth flow in past chats?"

---

## 3. Mental Model

A chat thread lives in exactly one workspace. Within that workspace, it is either:
- **Workspace-universal** (`scope='project'`) — visible across all views.
- **View-bound** (`scope='view'`) — tied to one viewer folder.

The database must know the workspace. The filesystem already knows it (paths are relative to `projectRoot`). The gap is in SQLite metadata and the application-layer cache keys.

```
Workspace (workspaces.id)
  ├── scope='project' threads  →  ai/views/chat/threads/<user>/
  └── scope='view' threads     →  ai/views/<viewId>/chat/threads/<user>/
```

---

## 4. Schema Changes

### 4a. Migration 017 — `workspace_id` on `threads`

**File:** `open-robin-server/lib/db/migrations/017_workspace_id_threads.js`

| Step | Action | Rationale |
|---|---|---|
| 1 | `ALTER TABLE threads ADD COLUMN workspace_id TEXT` | New discriminator. Nullable during migration for safety. |
| 2 | For each row in `workspaces`, update `threads.workspace_id = workspaces.id` where `threads.project_id = basename(workspaces.repo_path)` | Backfill. Only unmatched rows stay NULL (orphaned pre-prod data). |
| 3 | `CREATE INDEX threads_workspace_id_idx ON threads(workspace_id)` | Fast workspace-scoped list queries. |
| 4 | `CREATE INDEX threads_workspace_scope_view_idx ON threads(workspace_id, scope, view_id)` | Covers the two hot query patterns: workspace-universal list and view-bound list. |

**Foreign key:** Intentionally omitted. Migration 003's `workspace_themes` FK still references the dropped `workspaces_old` table, so the project already tolerates stale FK strings. Adding a real FK here would require `PRAGMA foreign_keys = OFF` during the ALTER (same pattern as migration 008) and provides little value since the app layer never deletes workspaces that have threads.

### 4b. `project_id` deprecation

`project_id` remains in the schema and continues to be written by `ThreadIndex.create()` for backward compatibility. New code reads from `workspace_id`. Old code that reads `project_id` continues to function until it is refactored. A future migration (out of scope) can drop `project_id` once all consumers are verified.

---

## 5. Application Layer Changes

### 5a. ThreadIndex — filter by `workspace_id`

**File:** `open-robin-server/lib/thread/ThreadIndex.js`

**Constructor signature change:**
```js
// Before
constructor(projectId, scope, viewId)

// After
constructor(workspaceId, scope, viewId)
```

**Query changes:**
| Method | Before | After |
|---|---|---|
| `list()` | `.where('project_id', this.projectId)` | `.where('workspace_id', this.workspaceId)` |
| `create()` | inserts `project_id` | inserts both `project_id` and `workspace_id` |
| `rebuild()` | `.where('project_id', this.projectId)` | `.where('workspace_id', this.workspaceId)` |

### 5b. ThreadManager — accept `workspaceId`

**File:** `open-robin-server/lib/thread/ThreadManager.js`

**Constructor config:**
```js
// New optional field
workspaceId: config.workspaceId || path.basename(this.projectRoot)
```

The fallback preserves backward compatibility for any call sites that are not updated in this pass. `projectRoot` is still required (it drives the filesystem paths for `.md` and `history.json`), and `projectId` is still derived for consumers that need it.

`ThreadIndex` is instantiated with `workspaceId`:
```js
this.index = new ThreadIndex(this.workspaceId, this.scope, this.viewId);
```

### 5c. ThreadWebSocketHandler — key caches by `workspaceId`

**File:** `open-robin-server/lib/thread/ThreadWebSocketHandler.js`

**Cache key changes:**
```js
// Before
const projectId = path.basename(projectRoot);
projectThreadManagers.get(projectId);
viewThreadManagers.get(`${projectId}:${viewId}`);

// After
const cacheKey = workspaceId || path.basename(projectRoot);
projectThreadManagers.get(cacheKey);
viewThreadManagers.get(`${cacheKey}:${viewId}`);
```

**`setPanel` config change:**
```js
// Before
ThreadWebSocketHandler.setPanel(ws, panelId, { projectRoot, viewName });

// After
ThreadWebSocketHandler.setPanel(ws, panelId, {
  projectRoot,
  viewName,
  workspaceId,  // new — passed through to manager factory
});
```

### 5d. Fix `session.currentWorkspaceId` corruption

**File:** `open-robin-server/lib/ws/client-message-router.js`

**Remove:**
```js
session.currentWorkspaceId = path.basename(projectRoot);
```

**Context:** This line lives inside the `thread:open-assistant` branch. `session.currentWorkspaceId` is already initialized correctly in `server.js`:
```js
// server.js — WebSocket connection handler
session.currentWorkspaceId = activeWs ? activeWs.id : null;
```
And it is updated by the per-connection `workspace:switched` listener:
```js
session.currentWorkspaceId = event.to;
```

The overwrite in `client-message-router.js` is vestigial and wrong. Removing it makes the scope resolver (`chat-scope.js`) emit correct workspace IDs for all chat events.

### 5e. Pass `workspaceId` at connection and panel switch

**File:** `open-robin-server/server.js`

In the WebSocket connection handler, pass `workspaceId` into the default `setPanel` call:
```js
ThreadWebSocketHandler.setPanel(ws, 'file-viewer', {
  projectRoot,
  viewName: 'file-viewer',
  workspaceId: activeWs ? activeWs.id : null,
});
```

**Note:** `code-viewer` (the old default panel) is updated to `file-viewer` here. This is the only hardcoded view reference that needs changing for correctness; all other paths are already dynamic relative to `projectRoot`.

**File:** `open-robin-server/lib/ws/client-message-router.js`

In the `set_panel` handler, pass `session.currentWorkspaceId`:
```js
ThreadWebSocketHandler.setPanel(ws, panel, {
  projectRoot,
  viewName: panel,
  workspaceId: session.currentWorkspaceId,
});
```

---

## 6. Chat Search Module

### 6a. Purpose

Enable querying `exchanges` by workspace so users (and future agent tools) can ask about past decisions, recover context, and find previous discussions. Cross-workspace search is possible but not the default.

### 6b. Module: `lib/thread/chat-search.js`

**API surface:**

```js
/**
 * Search exchanges. Defaults to the current workspace.
 * @param {object} options
 * @param {string} [options.workspaceId] — filter to this workspace; omit for cross-workspace
 * @param {string} options.query — text to search for
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @returns {Promise<{total: number, limit: number, offset: number, results: SearchResult[]}>}
 */
async function search({ workspaceId, query, limit = 50, offset = 0 });
```

**Search strategy:** `LIKE` against both `exchanges.user_input` and `exchanges.assistant`, joined to `threads` for metadata. SQLite `LIKE` is case-insensitive by default for ASCII when `PRAGMA case_sensitive_like = OFF` (the default). This is sufficient for the current exchange volume (hundreds to low thousands). If volume grows past ~10k exchanges, a future spec can introduce an FTS5 virtual table without changing this API.

**Result shape:**
```js
{
  exchangeId: 42,
  threadId: '2026-05-09T10-30-00-000',
  threadName: 'Auth flow redesign',
  workspaceId: 'open-robin',
  viewId: 'wiki-viewer',
  scope: 'view',
  seq: 7,
  timestamp: 1715253000000,
  userInput: 'Should we use JWT or session cookies?',
  assistant: { parts: [...] },  // parsed JSON
  metadata: { contextUsage: 0.34, tokenUsage: 1240 }
}
```

### 6c. WebSocket message type: `thread:search`

**Client → Server**
```json
{
  "type": "thread:search",
  "query": "JWT session cookies",
  "workspaceId": "open-robin",
  "limit": 20
}
```

If `workspaceId` is omitted, the server uses `session.currentWorkspaceId` (current workspace default). A client that wants cross-workspace search must explicitly pass `"workspaceId": null` — this is intentional friction.

**Server → Client**
```json
{
  "type": "thread:search_result",
  "query": "JWT session cookies",
  "workspaceId": "open-robin",
  "total": 12,
  "results": [ /* ... */ ]
}
```

**Handler placement:** Add to `thread-crud.js` as `handleThreadSearch`, re-exported through `ThreadWebSocketHandler`.

---

## 7. Files to Change

| File | Change |
|---|---|
| `open-robin-server/lib/db/migrations/017_workspace_id_threads.js` | **New.** Adds column, backfills, creates indexes. |
| `open-robin-server/lib/thread/chat-search.js` | **New.** Search query builder and result formatter. |
| `open-robin-server/lib/thread/ThreadIndex.js` | Constructor arg rename; query filters switch to `workspace_id`. |
| `open-robin-server/lib/thread/ThreadManager.js` | Accept `workspaceId` in config; pass to `ThreadIndex`. |
| `open-robin-server/lib/thread/ThreadWebSocketHandler.js` | Cache keys use `workspaceId`; `setPanel` accepts `workspaceId`. |
| `open-robin-server/lib/thread/thread-crud.js` | Add `handleThreadSearch` wired to `chat-search.js`. |
| `open-robin-server/lib/thread/index.js` | Re-export `chat-search` utilities. |
| `open-robin-server/server.js` | Pass `workspaceId` to `setPanel`; update default panel from `code-viewer` → `file-viewer`. |
| `open-robin-server/lib/ws/client-message-router.js` | Pass `workspaceId` to `setPanel`; **remove** `session.currentWorkspaceId` overwrite. |

---

## 8. Migration Safety

### 8a. Ambiguous basenames

If two workspaces share the same basename (e.g. `/Projects/foo` and `/Work/foo` with IDs `foo` and `foo-2`), the backfill loop must be deterministic:

```js
for (const ws of workspaces) {
  const basename = path.basename(ws.repo_path);
  await knex('threads')
    .where('project_id', basename)
    .whereNull('workspace_id')   // only touch unmatched rows
    .update({ workspace_id: ws.id });
}
```

The workspace with the lower `sort_order` (earlier in the registry list) wins. Rows that cannot be matched stay NULL. This is acceptable because:
- Pre-prod data is disposable per migration 008's directive.
- In practice, the existing dev workspaces (`open-robin`, `karens-lab`, `fusion-home`) have unique basenames.

### 8b. Rollback

`down` migration:
1. Drop `threads_workspace_scope_view_idx`.
2. Drop `threads_workspace_id_idx`.
3. Drop column `workspace_id`.

`project_id` remains, so pre-017 code paths continue to function.

---

## 9. Backward Compatibility

| Layer | Guarantee |
|---|---|
| Database | `project_id` is still written and still indexed. Old queries on `project_id` return the same rows they did before. |
| ThreadManager cache | Falls back to `basename(projectRoot)` when `workspaceId` is omitted. Third-party callers (tests, scripts) that instantiate `ThreadManager` directly are unaffected. |
| WebSocket protocol | No existing message types change shape. `thread:search` is additive. |
| Event bus scope strings | After the `session.currentWorkspaceId` fix, scope strings become *more* correct (they were sometimes wrong before). No subscriber needs to change its parsing logic. |
| Filesystem | `.md` and `history.json` paths are unchanged. They were always workspace-relative. |

---

## 10. Open Questions

1. **FTS5 future:** Do we want a follow-up spec for full-text search (stemming, ranking, snippet extraction) once exchange volume justifies it?
2. **Search UI:** Should the client get a dedicated search panel, or should search be an agent tool callable via the wire protocol?
3. **Cross-workspace visibility:** Should workspace-admins (future role) be able to search all workspaces by default, while regular users default to scoped?
4. **Orphan cleanup:** Should migration 017 also delete `threads` rows whose `workspace_id` remains NULL after backfill?

---

## 11. Verification Checklist

- [ ] Migration 017 runs cleanly against the existing `robin.db`.
- [ ] `thread:list` after workspace switch returns only threads for the new workspace.
- [ ] Creating a thread in workspace A does not appear in workspace B's thread list.
- [ ] `session.currentWorkspaceId` inside `thread:open-assistant` equals the real workspace ID, not a basename.
- [ ] `thread:search` with no `workspaceId` defaults to the current workspace.
- [ ] `thread:search` with `"workspaceId": null` searches across all workspaces.
- [ ] Smoke test (`test/smoke-spec03-spec15.js`) still passes.
- [ ] Server restart script (`restart-kimi.sh`) builds and starts successfully.
