# Remove getDefaultProjectRoot — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Prerequisite for:** Correct multi-workspace behavior. Without this, every path resolution silently falls back to the hardcoded project root, making workspace switching unreliable.
**Depends on:** `WORKSPACE_CONTROLLER_SPEC.md` (landed — workspace registry is the source of truth).

---

## 1. Purpose

`getDefaultProjectRoot()` is a legacy function that reads `config.json`'s `lastProject` or falls back to `path.join(__dirname, '..')`. It was the only way to resolve the project root before multi-workspace existed. Now it is a bug factory: every call site that falls through to it silently ignores the active workspace and serves files from the wrong project.

**This spec removes `getDefaultProjectRoot()` entirely.** The project root comes from exactly one place: the workspace registry via the workspace controller. No active workspace = no project root = empty state.

---

## 2. The replacement: `getProjectRoot(ws)`

One new function replaces all 30+ call sites. It reads `session.projectRoot` from the connection's session (set on connect from the active workspace, updated on `workspace:switched`). If no session exists (boot-time code that runs before any connection), it reads the active workspace's `repo_path` from the workspace controller.

```js
/**
 * Resolve the project root for a given connection, or the server-wide
 * active workspace root when no connection context is available.
 *
 * Returns null when no workspace is active (empty state).
 *
 * @param {import('ws').WebSocket} [ws] - connection context (optional)
 * @returns {string|null}
 */
function getProjectRoot(ws) {
  // Per-connection: session.projectRoot (set on connect, updated on switch)
  if (ws) {
    const session = sessions.get(ws);
    if (session && session.projectRoot) return session.projectRoot;
  }
  // Server-wide fallback: active workspace from the registry
  const workspaceController = require('./lib/workspace/workspace-controller');
  const active = workspaceController.getActiveWorkspace();
  return active ? active.repo_path : null;
}
```

**Callers that receive `ws`** (per-connection handlers): pass it through. The function reads from the session.

**Callers that don't have `ws`** (boot-time pipeline, watchers, cron): call `getProjectRoot()` with no argument. The function reads from the workspace controller.

**When it returns `null`**: the caller must handle the empty state. For boot-time code (watchers, wiki hooks, triggers), skip initialization and log a warning. For per-connection code, send an error to the client.

---

## 3. Call site migration

### 3a. `server.js` — definition + direct calls (9 references)

| Line | Current | Replacement |
|---|---|---|
| 183 | `function getDefaultProjectRoot()` | **Delete.** Replace with `getProjectRoot(ws)` defined above. |
| 120 | `getDefaultProjectRoot()` in panel-file API route | `getProjectRoot()` (no ws in HTTP handler — use server-wide) |
| 194 | `AI_PANELS_PATH = path.join(getDefaultProjectRoot(), ...)` | Remove module-level const. Compute inline where needed: `path.join(getProjectRoot(), 'ai', 'views')`. Or pass through from workspace controller at boot. |
| 215 | `getSessionRoot` fallback | `session.projectRoot` — no fallback to global. Return `null` if no session root and no session.projectRoot. |
| 225 | `getPanelPath` projectRoot | `getProjectRoot(ws)`. If null, return null (panel not resolvable — no active workspace). |
| 249 | Passed to `fileExplorer` factory | Pass `getProjectRoot` instead. |
| 267 | `wss.on('connection')` — initial projectRoot | `getProjectRoot()` from workspace controller. Set as `session.projectRoot`. |
| 359 | Passed to `createClientMessageRouter` | Pass `getProjectRoot` instead. |
| 417 | Passed to `startServer` | Pass `getProjectRoot` instead. |

### 3b. `lib/startup.js` — boot pipeline (13 references)

The startup pipeline runs **once** at boot before any connections. It initializes watchers, wiki hooks, triggers, cron, and the runner heartbeat. All of these operate on the active workspace.

| Current | Replacement |
|---|---|
| `getDefaultProjectRoot()` param | `getProjectRoot` function (no ws arg — reads from workspace controller) |
| `AI_PANELS_PATH` param | Compute from `getProjectRoot()` + `'ai/views'` at call time |

**Critical:** `getProjectRoot()` at boot returns the active workspace from `last_active_workspace_id` (restored by workspace controller in section 3.8 of startup, which runs before the pipeline). If no workspace exists, it returns null and the pipeline should skip gracefully.

The startup function signature changes from:
```js
async function start({ server, sessions, getDefaultProjectRoot, AI_PANELS_PATH })
```
to:
```js
async function start({ server, sessions, getProjectRoot })
```

Each pipeline call that currently uses `getDefaultProjectRoot()` or `AI_PANELS_PATH` switches to `getProjectRoot()`, with a null guard at the top:

```js
function _startPipeline({ sessions, getProjectRoot }) {
  const projectRoot = getProjectRoot();
  if (!projectRoot) {
    console.log('[Server] No active workspace — pipeline skipped');
    return;
  }
  const viewsPath = path.join(projectRoot, 'ai', 'views');
  // ... rest of pipeline uses projectRoot and viewsPath
}
```

### 3c. `lib/ws/client-message-router.js` (6 references)

Already migrated to `session.projectRoot || getDefaultProjectRoot()`. Change to `session.projectRoot` only — no fallback. If `session.projectRoot` is null, the handler should send an error to the client ("No active workspace").

The router's dep injection changes from `getDefaultProjectRoot` to `getProjectRoot`:

```js
// Before
const projectRoot = session.projectRoot || getDefaultProjectRoot();

// After
const projectRoot = session.projectRoot;
if (!projectRoot) {
  ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
  return;
}
```

### 3d. `lib/file-explorer.js` (4 references)

The factory receives `getDefaultProjectRoot` for the symlink security check. Replace with `getProjectRoot`:

```js
// Before
function createFileExplorerHandlers({ getPanelPath, getDefaultProjectRoot })

// After
function createFileExplorerHandlers({ getPanelPath, getProjectRoot })
```

The `isPathAllowed` symlink fallback (line 65) uses it to check if a symlink target is within the project root. Replace with `getProjectRoot()`.

### 3e. `lib/robin/ws-handlers.js` (4 references)

Robin handlers use `getDefaultProjectRoot()` to resolve `ai/views/settings/themes.css` and the settings directory. Replace with `getProjectRoot`:

```js
// Before
module.exports = function createRobinHandlers({ getDb, sessions, getDefaultProjectRoot })

// After
module.exports = function createRobinHandlers({ getDb, sessions, getProjectRoot })
```

Each internal call switches from `getDefaultProjectRoot()` to `getProjectRoot()`. If null, send an error response.

---

## 4. Connection initialization

When a new WebSocket connects (`wss.on('connection')` in server.js), the session's `projectRoot` is set from the active workspace:

```js
const workspaceController = require('./lib/workspace/workspace-controller');
const activeWs = workspaceController.getActiveWorkspace();
const projectRoot = activeWs ? activeWs.repo_path : null;

const session = {
  // ...existing fields...
  projectRoot,
  currentWorkspaceId: activeWs ? activeWs.id : null,
};
```

If `projectRoot` is null (no active workspace), the connection is in empty state. The client receives `workspace:init` with `activeWorkspaceId: null` and renders the empty state UI. No panels, no file trees, no threads.

---

## 5. `getSessionRoot` removal

`getSessionRoot()` and `setSessionRoot()` in server.js are a separate per-panel root override (for when a panel has a custom rootFolder). These should also read from `session.projectRoot` as their fallback instead of `getDefaultProjectRoot()`. But if `session.projectRoot` is null, they return null.

```js
function getSessionRoot(ws, panel) {
  const sessionRoot = sessionRoots.get(ws);
  if (sessionRoot && sessionRoot.panel === panel && sessionRoot.rootFolder) {
    return sessionRoot.rootFolder;
  }
  const connSession = sessions.get(ws);
  return connSession?.projectRoot || null;
}
```

---

## 6. `config.json` `lastProject` field

This field in `server/data/config.json` is the old persistence mechanism for the project root. It is no longer needed — `last_active_workspace_id` in the system DB is the replacement.

**Do not delete `config.json` or the `lastProject` field.** Other config values may still be used. Just stop reading it for project root resolution. If `getDefaultProjectRoot()` is deleted, nothing reads it.

---

## 7. Safety net: Open Robin in the registry

Open Robin is already registered:

```
id: open-robin
label: Open Robin
repo_path: /users/rccurtrightjr./projects/open-robin
```

And `last_active_workspace_id` is set. When the server boots, the workspace controller restores the active workspace from the registry. `getProjectRoot()` returns the active workspace's `repo_path`. There is no gap — the function that replaces `getDefaultProjectRoot()` has a valid value from the first line of boot.

If the user removes all workspaces, `getProjectRoot()` returns null. The pipeline skips. The client shows empty state. Add a workspace to resume.

---

## 8. Pipeline re-initialization on workspace switch

Today the watcher, wiki hooks, triggers, and cron are initialized once at boot against the active workspace. When the user switches workspaces, these are still watching the old workspace's files.

**This spec does NOT solve that.** Re-initializing the pipeline on workspace switch is future work (stop old watchers, start new ones for the new workspace). For now, the pipeline runs against whatever workspace was active at boot. This matches the current behavior — the only change is where the root comes from (registry instead of config.json).

A future spec should add `workspace:switched` listeners to the pipeline components so they restart against the new root. But that's a separate concern.

---

## 9. Files changed

| File | Change |
|---|---|
| `server.js` | Delete `getDefaultProjectRoot()`. Add `getProjectRoot(ws)`. Update all 9 call sites. Update `getSessionRoot` fallback. Set `session.projectRoot` from workspace controller on connect. Change `startServer` params. |
| `lib/startup.js` | Change signature from `getDefaultProjectRoot` to `getProjectRoot`. Replace 13 call sites. Add null guard at pipeline entry. Remove `AI_PANELS_PATH` param (compute inline). |
| `lib/ws/client-message-router.js` | Change dep from `getDefaultProjectRoot` to `getProjectRoot`. Replace 4 fallback sites. Remove `|| getDefaultProjectRoot()` pattern — use `session.projectRoot` directly with null guard. |
| `lib/file-explorer.js` | Change dep from `getDefaultProjectRoot` to `getProjectRoot`. Replace 2 internal calls. |
| `lib/robin/ws-handlers.js` | Change dep from `getDefaultProjectRoot` to `getProjectRoot`. Replace 3 internal calls. |

**Total:** 0 new files, 5 files edited, ~30 line replacements + 1 function deleted + 1 function added.

---

## 10. Verification

1. **Boot with workspaces in registry.** Server starts, workspace controller restores active workspace, pipeline initializes against that workspace's root. No `getDefaultProjectRoot` in any log or code path.

2. **Switch workspaces.** File tree reloads from new root. Panels rediscover from new root. Threads resolve from new root. No stale paths from old workspace.

3. **Remove all workspaces.** Server enters empty state. Pipeline is skipped (or was initialized for the boot-time workspace). Client shows empty state. No crashes from null projectRoot.

4. **Add a workspace from empty state.** Workspace added, becomes active, session.projectRoot set. File tree loads. Panels discover. Everything resolves from the new root.

5. **`grep -r getDefaultProjectRoot` returns zero hits** in the server source (excluding logs and node_modules).
