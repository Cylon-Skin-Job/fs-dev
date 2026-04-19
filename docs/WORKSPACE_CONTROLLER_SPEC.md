# Workspace Controller — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Implements:** `MULTI_WORKSPACE_SPEC.md` §4a, §4d, §5a, §6a, §7.
**Depends on:** All three gap specs (landed): CHAT_SCOPE_SPEC, THREAD_LIFECYCLE_SPEC, WORKSPACE_BROADCASTER_SPEC, WORKSPACE_CLIENT_ROUTING_SPEC.
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

This is the core module that makes multi-workspace real. The controller subscribes to workspace request events (already routed to the bus by Gap 3), performs CRUD against the `workspaces` table, validates paths, and emits result events (already broadcast to clients by Gap 2).

The controller is split into a **controller** (event-driven orchestrator) and three **services** (pure data, no events). This follows the existing layer boundaries: services never emit events, controllers never call services in other controllers' files.

---

## 2. Current state

### 2a. `workspaces` table

Schema exists (migration 003). Has 7 placeholder rows (`system`, `chat`, `home-office`, etc.) that were never wired to anything beyond theme baselines. `repo_path` column exists but is NULL for all rows. No UNIQUE constraint on `repo_path`.

### 2b. `workspace_themes` table

FKs to `workspaces.id`. Has a `chat` row with a light theme. Must be preserved during migration — any row whose `workspace_id` matches a real workspace (after migration) keeps its theme.

### 2c. `system_config` table

Exists. No `last_active_workspace_id` key yet.

### 2d. Single-workspace assumption

`server.js` line 182: `getDefaultProjectRoot()` reads `config.json`'s `lastProject` or falls back to `path.join(__dirname, '..')`. Every connection uses this single root. The workspace controller will eventually replace this, but **this spec does not change `getDefaultProjectRoot()`**. The controller runs alongside it. The switchover happens when the client UI is built (MULTI_WORKSPACE_SPEC §6b).

---

## 3. DB migration (009_workspace_registry.js)

### 3a. Schema changes

1. **Add `UNIQUE` constraint to `repo_path`.** SQLite requires a table rebuild for this. Follow the pattern from migration 008 (disable FK checks, rename, create new, copy, drop old, rename back).

2. **Add `NOT NULL` to `repo_path`.** After the rebuild, `repo_path` is `text NOT NULL UNIQUE`.

3. **Drop placeholder rows** where `repo_path IS NULL`. These 7 seed rows from migration 003 were never wired to anything load-bearing. Any `workspace_themes` rows that FK to dropped workspace IDs are also deleted (the FK has no CASCADE, so delete themes first).

4. **Insert the dev-time workspace.** Since Open Robin is being developed inside itself, insert one real row pointing to the current project root so the app isn't empty after migration:

```sql
INSERT INTO workspaces (id, label, icon, description, repo_path, sort_order)
VALUES ('open-robin', 'Open Robin', 'code', 'Open Robin development workspace',
        '<canonicalized projectRoot>', 0);
```

The `projectRoot` value is resolved at migration time via `fs.realpathSync()`.

5. **Add `last_active_workspace_id` to `system_config`:**

```sql
INSERT OR IGNORE INTO system_config (key, value, updated_at)
VALUES ('last_active_workspace_id', 'open-robin', <now>);
```

### 3b. Migration safety

- `workspace_themes` rows for dropped workspaces are deleted before the workspace rows.
- The `chat` workspace_theme is preserved only if a workspace with id `chat` survives (it won't — it has no repo_path). If you want to preserve the light theme CSS, save it to a new workspace's theme row. But since the placeholder themes were never user-facing, dropping them is fine.
- Down migration restores the 7 placeholder rows and removes the UNIQUE/NOT NULL constraints. The dev-time workspace row is dropped.

---

## 4. Services

### 4a. `lib/workspace/path-service.js` (~30 lines)

One job: canonicalize paths for dedup comparison.

```js
const fs = require('fs');
const path = require('path');

/**
 * Canonicalize a repo path for storage and comparison.
 * Resolves symlinks and ../ segments via fs.realpathSync().
 * On darwin (case-insensitive FS), lowercases the result.
 *
 * @param {string} rawPath
 * @returns {string} canonicalized absolute path
 * @throws {Error} if path doesn't exist on disk
 */
function canonicalize(rawPath) {
  const resolved = fs.realpathSync(path.resolve(rawPath));
  return process.platform === 'darwin' ? resolved.toLowerCase() : resolved;
}

module.exports = { canonicalize };
```

### 4b. `lib/workspace/registry-service.js` (~80 lines)

CRUD on the `workspaces` table. Pure data — no events, no bus.

```js
const { getDb } = require('../db');

async function list() {
  return getDb()('workspaces').orderBy('sort_order', 'asc');
}

async function getById(id) {
  return getDb()('workspaces').where('id', id).first();
}

async function getByRepoPath(repoPath) {
  return getDb()('workspaces').where('repo_path', repoPath).first();
}

async function add({ id, label, icon, description, repoPath, sortOrder }) {
  await getDb()('workspaces').insert({
    id,
    label,
    icon: icon || 'folder',
    description: description || null,
    repo_path: repoPath,
    sort_order: sortOrder ?? 0,
  });
  return getById(id);
}

async function remove(id) {
  // Delete theme first (FK, no CASCADE)
  await getDb()('workspace_themes').where('workspace_id', id).del();
  const deleted = await getDb()('workspaces').where('id', id).del();
  return deleted > 0;
}

async function updateSortOrder(id, sortOrder) {
  await getDb()('workspaces').where('id', id).update({ sort_order: sortOrder });
}

module.exports = { list, getById, getByRepoPath, add, remove, updateSortOrder };
```

### 4c. `lib/workspace/bootstrap-service.js` (~50 lines)

Scaffolds a minimal `ai/` tree for a repo that doesn't have one yet. Idempotent — if the folders already exist, does nothing.

```js
const fs = require('fs');
const path = require('path');

const DIRS = [
  'ai',
  'ai/views',
  'ai/views/chat',
  'ai/views/chat/threads',
  'ai/system',
];

const FILES = {
  'ai/views/index.json': JSON.stringify({
    views: [
      { id: 'code-viewer', label: 'Code', icon: 'code', rank: 0 }
    ]
  }, null, 2),
};

/**
 * Ensure the minimum ai/ structure exists at repoPath.
 * Idempotent — only creates what's missing.
 *
 * @param {string} repoPath — absolute, canonicalized
 */
function bootstrap(repoPath) {
  for (const dir of DIRS) {
    const full = path.join(repoPath, dir);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
    }
  }
  for (const [rel, content] of Object.entries(FILES)) {
    const full = path.join(repoPath, rel);
    if (!fs.existsSync(full)) {
      fs.writeFileSync(full, content, 'utf8');
    }
  }
}

/**
 * Check whether a repo has the minimum viable workspace structure.
 *
 * @param {string} repoPath
 * @returns {boolean}
 */
function isValidWorkspaceRoot(repoPath) {
  return fs.existsSync(path.join(repoPath, 'ai', 'views', 'index.json'));
}

module.exports = { bootstrap, isValidWorkspaceRoot };
```

---

## 5. Controller

### 5a. File

```
lib/workspace/workspace-controller.js
```

### 5b. Shape

The controller subscribes to bus events at startup and calls services to do the work. It emits result events that the workspace-broadcaster delivers to clients.

```js
const { on, emit } = require('../event-bus');
const { getDb } = require('../db');
const pathService = require('./path-service');
const registry = require('./registry-service');
const bootstrap = require('./bootstrap-service');

let activeWorkspaceId = null;

async function start() {
  // Run launch validator
  await validateRegistry();

  // Restore last active workspace
  await restoreLastActive();

  // Subscribe to request events
  on('workspace:add_requested', handleAddRequested);
  on('workspace:switch_requested', handleSwitchRequested);
  on('workspace:remove_requested', handleRemoveRequested);

  console.log('[WorkspaceController] Started (active: ' + (activeWorkspaceId || 'none') + ')');
}
```

### 5c. Launch validator

On boot, walk every row in `workspaces` and verify the path still exists and is structurally valid:

```
1. const workspaces = await registry.list();
2. For each workspace:
   a. Does repo_path exist on disk? (fs.existsSync)
   b. Does it pass isValidWorkspaceRoot()? (ai/views/index.json exists)
   c. If either fails → registry.remove(workspace.id)
      → emit('workspace:culled_at_launch', { workspaceId, reason })
3. Log summary: "[WorkspaceController] Launch validator: N workspaces, M culled"
```

Silent fail by design (MULTI_WORKSPACE_SPEC §6a) — no error modal, no alert.

### 5d. Restore last active

```
1. Read system_config.last_active_workspace_id
2. If the id exists in the registry (survived validation) → set activeWorkspaceId
3. If culled or absent → fall through to first by sort_order
4. If registry is empty → activeWorkspaceId stays null (empty state)
5. Log: "[WorkspaceController] Restored workspace: X" or "No workspaces"
```

### 5e. handleAddRequested

```
1. Validate repoPath exists on disk → if not, send error to client via bus
2. canonicalize(repoPath)
3. Check registry for existing row with same canonicalized repo_path
4. If duplicate → emit('workspace:add_rejected_duplicate', { existingWorkspace, connectionId })
   (workspace-broadcaster delivers this to the requesting client only)
5. bootstrap(repoPath) — scaffold ai/ if missing
6. Generate workspace id from path.basename(repoPath), ensure unique
7. registry.add({ id, label, repoPath, ... })
8. emit('workspace:added', { workspace })
9. emit('workspace:registry_changed', { workspaces: await registry.list() })
```

### 5f. handleSwitchRequested

```
1. Validate workspaceId exists in registry → if not, send error
2. If workspaceId === activeWorkspaceId → no-op
3. const from = activeWorkspaceId
4. activeWorkspaceId = workspaceId
5. Write last_active_workspace_id to system_config
6. emit('workspace:switched', { from, to: workspaceId })
```

**Note:** This spec does NOT change `getDefaultProjectRoot()` or `projectRoot` on existing connections. That rewiring happens when the client UI sends `set_panel` after receiving `workspace:switched` — the server resolves the new project root from the workspace's `repo_path`. This is future work tied to MULTI_WORKSPACE_SPEC §6b.

### 5g. handleRemoveRequested

```
1. Validate workspaceId exists in registry → if not, send error
2. registry.remove(workspaceId)
3. If removed workspace was active → switch to first remaining by sort_order
   (or null if registry is now empty)
4. emit('workspace:removed', { workspaceId })
5. emit('workspace:registry_changed', { workspaces: await registry.list() })
6. If active changed → emit('workspace:switched', { from: workspaceId, to: activeWorkspaceId })
```

---

## 6. `activeWorkspaceId` and the session

The controller tracks `activeWorkspaceId` as module-level state. This is the **server-wide** active workspace. Today (single connection), this is sufficient.

When multi-workspace UI ships, the active workspace may become **per-connection** (different browser tabs on different workspaces). At that point, `activeWorkspaceId` moves to per-session state and the switching logic updates `session.currentWorkspaceId` (already present from CHAT_SCOPE_SPEC). This spec leaves that door open but doesn't walk through it — the current shape works for single-tab usage.

---

## 7. Read-only getters

```js
function getActiveWorkspaceId()        // returns activeWorkspaceId or null
function getActiveWorkspace()          // returns full row or null
async function listWorkspaces()        // returns all rows sorted by sort_order
```

These are for other server modules that need to know the current workspace without subscribing to events (e.g., `getDefaultProjectRoot()` could eventually call `getActiveWorkspace().repo_path`).

---

## 8. Initialization

In `lib/startup.js`, after workspace-broadcaster (section 3.7) and before `server.listen()`:

```js
// 3.8. Workspace controller — workspace CRUD, launch validator, switch logic.
// Must run before listen() so the registry is validated and activeWorkspaceId
// is set before the first client connects.
const workspaceController = require('./workspace/workspace-controller');
await workspaceController.start();
```

The `start()` is async (launch validator queries DB). The startup sequence already uses `await` for the DB init, so this fits naturally.

---

## 9. Verification

### 9a. Boot

After migration and restart, server logs should show:
```
[DB] robin.db initialized
[WorkspaceController] Launch validator: 1 workspaces, 0 culled
[WorkspaceController] Restored workspace: open-robin
[WorkspaceController] Started (active: open-robin)
```

### 9b. Add workspace (from browser console)

```js
// In browser dev tools — ws is the WebSocket instance
ws.send(JSON.stringify({
  type: 'workspace:add_requested',
  repoPath: '/Users/rccurtrightjr./projects/some-other-repo'
}));
```

Server log should show the add flow. Client should receive `workspace:added` and `workspace:registry_changed` WebSocket frames.

### 9c. Duplicate rejection

```js
ws.send(JSON.stringify({
  type: 'workspace:add_requested',
  repoPath: '/Users/rccurtrightjr./projects/open-robin'
}));
```

Client should receive `workspace:add_rejected_duplicate` with the existing workspace.

### 9d. Switch

```js
ws.send(JSON.stringify({
  type: 'workspace:switch_requested',
  workspaceId: 'some-other-repo'
}));
```

Client should receive `workspace:switched { from: 'open-robin', to: 'some-other-repo' }`.

### 9e. Remove

```js
ws.send(JSON.stringify({
  type: 'workspace:remove_requested',
  workspaceId: 'some-other-repo'
}));
```

Client should receive `workspace:removed` and `workspace:registry_changed`.

### 9f. Launch validator (delete repo folder, restart)

Move the test repo folder, restart server. Log should show `1 culled`. The workspace disappears from the registry.

---

## 10. Files changed

| File | Change |
|---|---|
| `lib/db/migrations/009_workspace_registry.js` | **New** — table rebuild + seed |
| `lib/workspace/path-service.js` | **New** — ~30 lines |
| `lib/workspace/registry-service.js` | **New** — ~80 lines |
| `lib/workspace/bootstrap-service.js` | **New** — ~50 lines |
| `lib/workspace/workspace-controller.js` | **New** — ~150 lines |
| `lib/startup.js` | Add `workspaceController.start()` call |

**Total:** 5 new files (~340 lines), 1 file edited.

---

## 11. What this does NOT do

- **Change `getDefaultProjectRoot()`.** The single-project-root assumption stays intact. The controller runs alongside it. The switchover is a future task tied to the client UI.
- **Build the client UI.** No switcher view, no add modal, no empty state. Those are MULTI_WORKSPACE_SPEC §6b.
- **Handle per-connection workspace state.** Today the active workspace is server-wide. Per-connection support is future work.
- **Add the enforcement settings UI.** The `enforcement.thread_idle_timeout_minutes` and `enforcement.max_workspace_displays_in_ram` controls are future work.
- **Implement the display LRU controller.** That's MULTI_WORKSPACE_SPEC §6a `display-lru-controller.js`, out of scope here.

---

## 12. Relationship to multi-workspace

This spec delivers the server-side workspace lifecycle from MULTI_WORKSPACE_SPEC §6a. After this lands:

- Workspaces can be added, switched, and removed via WebSocket messages.
- The launch validator silently culls stale workspaces on boot.
- `last_active_workspace_id` persists across restarts.
- The full round-trip works: client request → bus → controller → bus → broadcaster → client.
- The remaining work is the **client UI** (§6b) and the **`getDefaultProjectRoot()` switchover** to make workspace switching actually change what the user sees.
