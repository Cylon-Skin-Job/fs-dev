# Workspace Cache Persistence Spec

**Status:** Draft — ready to implement.  
**Owner:** Fusion Studio core.  
**Scope:** Persist `workspaceState` to SQLite so workspace panel configs, current panel, threads, and view states survive browser refresh / app restart.  
**Depends on:** `WORKSPACE_ISOLATION_AND_KEYED_STATE_SPEC.md` (must be implemented first).  
**Out of scope:** Chat message history (reloaded from server), open file tabs, scroll positions, LRU eviction.

---

## 1. Purpose

Today, `workspaceState` lives only in RAM. When the user refreshes the browser or restarts the Electron app, every workspace becomes a "first visit" again — panels must be rediscovered, threads re-fetched, file trees reloaded. This destroys the "instant switch" experience after restart.

This spec adds a server-side SQLite cache that stores the client's `workspaceState` per workspace. On app startup, the server sends the cached state in `workspace:init`. The client hydrates from it synchronously — no discovery, no spinners.

---

## 2. Mental Model

```
Client RAM          Server SQLite                    Disk (source of truth)
workspaceState      workspace_client_state           ai/views/*/index.json
├── panels          ├── panel_configs (JSON)         ai/settings/themes.css
├── threads         ├── threads_json (JSON)          threads table
├── currentPanel    ├── current_panel
└── viewStates      ├── view_states (JSON)
```

The SQLite cache is a **read-through cache**, not the source of truth. If the cache is stale (e.g., panels were added/removed on disk), the client falls back to discovery.

---

## 3. Schema

### Migration 018 — `workspace_client_state`

**File:** `open-robin-server/lib/db/migrations/018_workspace_client_state.js`

```sql
CREATE TABLE workspace_client_state (
  workspace_id TEXT PRIMARY KEY,
  panel_configs TEXT,        -- JSON array of PanelConfig
  current_panel TEXT,
  threads_json TEXT,         -- JSON: { project: Thread[], view: Thread[] }
  current_thread_ids TEXT,   -- JSON: { project: string|null, view: string|null }
  view_states TEXT,          -- JSON: Record<string, ViewUIState>
  updated_at INTEGER         -- ms timestamp
);

CREATE INDEX workspace_client_state_updated_idx ON workspace_client_state(updated_at);
```

**Rationale:** One row per workspace. `updated_at` allows future LRU eviction to delete oldest rows first.

---

## 4. Server Module: `lib/workspace/state-cache-service.js`

### API

```js
async function load(workspaceId) → WorkspaceClientState | null
async function save(workspaceId, state) → void
async function delete(workspaceId) → void
async function list() → Array<{workspaceId, updatedAt}>
```

### `load(workspaceId)`

1. Query `workspace_client_state` by `workspace_id`.
2. Parse JSON fields.
3. Return `null` if row not found.

### `save(workspaceId, state)`

1. Serialize state fields to JSON.
2. `INSERT ... ON CONFLICT(workspace_id) DO UPDATE ...`
3. Set `updated_at = Date.now()`.

### `delete(workspaceId)`

1. `DELETE FROM workspace_client_state WHERE workspace_id = ?`

---

## 5. Server Integration Points

### 5a. `workspace:init` — hydrate on connect

**File:** `open-robin-server/server.js`

When a WebSocket connects, after loading workspaces and themes:

```js
const stateCache = require('./lib/workspace/state-cache-service');
const cachedStates = {};
for (const ws of workspaces) {
  const cached = await stateCache.load(ws.id);
  if (cached) cachedStates[ws.id] = cached;
}

ws.send(JSON.stringify({
  type: 'workspace:init',
  workspaces,
  activeWorkspaceId,
  // ... existing fields ...
  cachedStates,  // NEW
}));
```

### 5b. `workspace:switched` — save before broadcast

**File:** `open-robin-server/lib/ws/workspace-broadcaster.js`

Before broadcasting `workspace:switched`, save the outgoing workspace's state:

```js
on('workspace:switched', async (event) => {
  // Save the 'from' workspace's cached state (if any clients had it loaded)
  // Note: in single-shared-active-workspace model, all clients share one state,
  // so we can derive the state from any connected client's session.
  
  // ... existing broadcast logic ...
});
```

**Problem:** The server does not currently hold the client's `workspaceState`. The client must **push** its state to the server before/during switch.

**Decision:** Add a `workspace:cache_push` message from client → server.

### 5c. `workspace:cache_push` — client → server

**Client sends:**
```json
{
  "type": "workspace:cache_push",
  "workspaceId": "open-robin",
  "state": {
    "panelConfigs": [...],
    "currentPanel": "wiki-viewer",
    "threads": { "project": [...], "view": [...] },
    "currentThreadIds": { "project": "...", "view": null },
    "viewStates": { "wiki-viewer": {...} }
  }
}
```

**Server handler:** `open-robin-server/lib/ws/client-message-router.js`

```js
if (clientMsg.type === 'workspace:cache_push') {
  const cache = require('../workspace/state-cache-service');
  await cache.save(clientMsg.workspaceId, clientMsg.state);
  return;
}
```

**When to send:**
- On `workspace:switched` — client saves old workspace state to server before switching
- On periodic debounced save (every 5s of inactivity) — optional, catches mid-session crashes
- On explicit `beforeunload` — optional, best-effort

### 5d. `workspace:cache_invalidate` — server → client

When the file watcher detects that panels were added/removed on disk, the server should invalidate the cache so the next load triggers rediscovery.

**File:** `lib/watcher/filters/theme-json-regenerator.js` or a new filter.

```js
const { invalidate } = require('../../workspace/state-cache-service');
await invalidate(workspaceId, 'panels');  // drops panel_configs, current_panel
```

---

## 6. Client Integration Points

### 6a. `panelStore.ts` — push cache on switch

In `activateWorkspace(workspaceId)`:

```ts
activateWorkspace: (workspaceId) => {
  const state = get();
  const oldId = state.activeWorkspaceId;

  // Push old workspace state to server before switching
  if (oldId) {
    const payload = {
      panelConfigs: state.panelConfigs,
      currentPanel: state.currentPanel,
      threads: state.threads,
      currentThreadIds: state.currentThreadIds,
      viewStates: state.viewStates,
    };
    pushWorkspaceCache(oldId, payload);  // fire-and-forget WebSocket send
  }

  // ... existing save/load logic ...
}
```

### 6b. `workspace-handlers.ts` — hydrate from `workspace:init`

```ts
case 'workspace:init': {
  // ... existing init logic ...
  const cachedStates = (msg as any).cachedStates ?? {};
  for (const [wsId, cached] of Object.entries(cachedStates)) {
    panelStore.seedWorkspaceState(wsId, cached as WorkspacePanelState);
  }
  return true;
}
```

### 6c. `panelStore.ts` — `seedWorkspaceState`

New action that populates `workspaceState[workspaceId]` from server cache without activating it. Used during `workspace:init` to pre-warm all workspaces.

```ts
seedWorkspaceState: (workspaceId, state) => set((s) => ({
  workspaceState: { ...s.workspaceState, [workspaceId]: state },
}));
```

---

## 7. Cache Freshness Rules

| Event | Action |
|-------|--------|
| Client switches workspace | Push old state to server, load new state from server cache |
| Client connects | Server sends `cachedStates` for all workspaces in `workspace:init` |
| Panel added/removed on disk | Server invalidates `panel_configs` for that workspace |
| Theme changed on disk | Server invalidates `view_states` for that workspace (tints may have changed) |
| Thread created/renamed/deleted | No invalidation needed — thread list is re-fetched from server on activate |

---

## 8. Backward Compatibility

- Old clients (that don't send `workspace:cache_push`) — server simply has no cache for them. Falls back to current behavior (first visit = discover).
- New clients connecting to old servers (no `cachedStates` in `workspace:init`) — `seedWorkspaceState` is a no-op. Falls back to current behavior.

---

## 9. Files to Change

| File | Change |
|------|--------|
| `lib/db/migrations/018_workspace_client_state.js` | **New.** Schema for cache table. |
| `lib/workspace/state-cache-service.js` | **New.** CRUD + invalidate API. |
| `server.js` | Query cache, include `cachedStates` in `workspace:init`. |
| `lib/ws/workspace-broadcaster.js` | Save cache before/after switch broadcast. |
| `lib/ws/client-message-router.js` | Add `workspace:cache_push` handler. |
| `src/state/panelStore.ts` | Add `seedWorkspaceState()`, `pushWorkspaceCache()`. |
| `src/lib/ws/workspace-handlers.ts` | Hydrate `cachedStates` on `workspace:init`. Push cache on switch. |

---

## 10. Risks & Gotchas

### 10a. Cache Stale Panels

If a user adds a new panel folder on disk, the cache still has the old panel list. The client will render from stale cache and never discover the new panel.

**Mitigation:** File watcher invalidates `panel_configs` on any `ai/views/` change. Client falls back to `rediscoverPanels` if `panelConfigs` is empty or invalid.

### 10b. Large JSON payloads

`threads_json` can be large (100+ threads × metadata). Serializing/deserializing on every switch adds CPU cost.

**Mitigation:** Cache thread lists are typically < 50KB of JSON. Acceptable for local SQLite. If volume grows, cache only `thread_id` + `name` + `status` (summary fields) and let the client fetch full history on demand.

### 10c. Multi-tab cache coherence

In browser (not Electron), two tabs could push different states for the same workspace. Last-write-wins.

**Mitigation:** Single-shared-active-workspace model means all tabs are on the same workspace anyway. In Electron single-renderer, this is a non-issue.

---

## 11. Verification Checklist

- [ ] Migration 018 runs cleanly.
- [ ] After switching workspaces, `workspace:cache_push` arrives at server and row is written.
- [ ] After refresh, `workspace:init` includes `cachedStates`.
- [ ] Client hydrates cached state — panel list appears instantly without discovery spinner.
- [ ] Cached `currentPanel` is restored — correct panel renders on first visit after refresh.
- [ ] File watcher invalidates cache on panel add/remove — next load triggers rediscovery.
- [ ] Old client without `cache_push` still works (falls back to discovery).
- [ ] Smoke test passes.
