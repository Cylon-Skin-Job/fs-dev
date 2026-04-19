# Chat Scope — Spec

**Status:** Draft — design locked, not yet implemented.
**Owner:** Open Robin core.
**Prerequisite for:** `MULTI_WORKSPACE_SPEC.md` (the `workspace` field in event bus payloads must be correct before multi-workspace switching can work).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

Every `chat:*` event emitted to the Universal Event Bus currently carries `workspace: 'code-viewer'` — a hardcoded string that conflates a view name with a workspace. This is wrong on two levels:

1. **`code-viewer` is a view within a workspace**, not the workspace itself.
2. **The value is hardcoded**, so it can never reflect which workspace or view the chat actually belongs to.

This spec replaces the hardcoded string with a structured scope that correctly identifies where a chat lives: at the workspace level (universal) or bound to a specific viewer folder.

---

## 2. Mental model

There are two kinds of chat:

| Kind | Where threads live on disk | When visible | Example |
|---|---|---|---|
| **Workspace-universal** | `ai/views/chat/threads/<user>/` | Always — main chat panel, popup bubble | The primary conversation surface |
| **View-bound** | `ai/views/<viewer>/chat/threads/<user>/` | Only when that view is open | Wiki chat, agents chat |

**Workspace-universal chats** are the default. The main chat panel and the popup bubble are two UI surfaces for the same workspace-scoped threads. They share history. Switching views does not change the workspace-universal chat.

**View-bound chats** exist only for specific viewers that need their own conversation context (wiki-viewer, agents-viewer). Their threads live inside the viewer's folder tree. They are not visible outside that view.

This matches the existing `ThreadManager` dual-scope model (SPEC-26b): project-scoped threads map to workspace-universal; view-scoped threads map to view-bound.

---

## 3. Scope identifier format

The `workspace` field in event bus payloads becomes a structured scope string:

```
workspace:<workspace_id>                        ← workspace-universal
workspace:<workspace_id>, <viewer-folder>       ← view-bound
```

**Examples:**

| Scope | Meaning |
|---|---|
| `workspace:open-robin` | Universal chat in the open-robin workspace |
| `workspace:open-robin, wiki-viewer` | Chat bound to wiki-viewer in open-robin |
| `workspace:open-robin, agents-viewer` | Chat bound to agents-viewer in open-robin |
| `workspace:my-app` | Universal chat in a different workspace |

**Why a string, not an object?** The event bus payload is flat (`{ type, workspace, threadId, ... }`). A structured string keeps the payload shape unchanged while carrying both dimensions. Subscribers that only care about workspace can split on `, ` and take the first segment. Subscribers that need the view can take the second.

**Parser (one function, used everywhere):**

```js
function parseScope(workspace) {
  const parts = workspace.split(', ');
  return {
    workspaceId: parts[0].replace('workspace:', ''),
    viewId: parts[1] || null,
    isViewBound: parts.length > 1,
  };
}
```

---

## 4. What changes

### 4a. Session state — add `currentWorkspaceId`

The per-connection session object (created in `server.js` line 266) gains one field:

```js
const session = {
  // ... existing fields ...
  currentWorkspaceId: null,   // Set when client sends set_panel or workspace:switched
};
```

**Today (single-workspace):** `currentWorkspaceId` is derived from `path.basename(projectRoot)` at connection time. This is a transitional default that will be replaced by the multi-workspace controller when that spec lands.

**When multi-workspace ships:** `currentWorkspaceId` comes from the workspace registry and updates on `workspace:switched`.

### 4b. Scope resolution — new utility

```
lib/chat-scope.js
```

One file, one job: resolve the scope string for any chat event.

```js
/**
 * Resolve the event bus scope string for the current session.
 *
 * @param {object} session - per-connection session state
 * @returns {string} scope string for event payloads
 */
function resolveScope(session) {
  const workspaceId = session.currentWorkspaceId;
  if (!workspaceId) return 'workspace:unknown';

  const scope = session.currentScope;
  if (scope === 'view' && session.currentViewId) {
    return `workspace:${workspaceId}, ${session.currentViewId}`;
  }
  return `workspace:${workspaceId}`;
}

/**
 * Parse a scope string back into parts.
 *
 * @param {string} scope
 * @returns {{ workspaceId: string, viewId: string|null, isViewBound: boolean }}
 */
function parseScope(scope) {
  const parts = scope.split(', ');
  return {
    workspaceId: parts[0].replace('workspace:', ''),
    viewId: parts[1] || null,
    isViewBound: parts.length > 1,
  };
}

module.exports = { resolveScope, parseScope };
```

### 4c. Session state — add `currentViewId`

The session also needs to track which view the active wire belongs to. This is already partially present as `session.currentScope` (SPEC-26b tracks `'project'` vs `'view'`). What's missing is the view name when scope is `'view'`.

```js
const session = {
  // ... existing fields ...
  currentWorkspaceId: null,
  currentViewId: null,   // e.g. 'wiki-viewer', 'agents-viewer'; null when scope='project'
};
```

**Set in client-message-router** during `thread:open-assistant`:
- `session.currentViewId` is set from the panel/view name when `scope === 'view'`
- Cleared to `null` when `scope === 'project'`

### 4d. Wire message router — replace hardcoded string

Every `emit()` call in `lib/wire/message-router.js` that currently says `workspace: 'code-viewer'` changes to use `resolveScope(session)`.

**Before (9 occurrences):**
```js
emit('chat:turn_begin', { workspace: 'code-viewer', threadId: session.currentThreadId, ... });
```

**After:**
```js
emit('chat:turn_begin', { workspace: resolveScope(session), threadId: session.currentThreadId, ... });
```

**Files changed:**
- `lib/wire/message-router.js` — 9 emit calls (lines 71, 89, 101, 121, 142, 152, 181, 217, 250)

The `resolveScope` import is added at the top of the factory, alongside the existing `emit` injection. Since `message-router.js` receives `session` as a closure dep, `resolveScope(session)` has access to all the fields it needs.

### 4e. Harnesses — replace hardcoded string

Each harness that emits directly to the event bus (bypassing the wire message router) also hardcodes `workspace: 'code-viewer'`. These need the same fix.

**Problem:** Harnesses don't have access to `session`. They receive `threadId` and `projectRoot` at spawn time via `spawnThreadWire(threadId, projectRoot)`.

**Solution:** Add `workspaceId` and `viewId` to the spawn context. The harness receives these as constructor/start parameters and uses them when emitting.

**Spawn signature change:**

```js
// Before
spawnThreadWire(threadId, projectRoot)

// After
spawnThreadWire(threadId, projectRoot, { workspaceId, viewId })
```

The `{ workspaceId, viewId }` context object is optional with a fallback: if omitted, derive `workspaceId` from `path.basename(projectRoot)` and `viewId` from `null`. This keeps backward compat during the transition.

**Files changed:**
- `lib/harness/compat.js` — pass context through to harness constructors
- `lib/harness/kimi/index.js` — line 152: use passed scope instead of `'code-viewer'`
- `lib/harness/robin/index.js` — line 153: same
- `lib/harness/clis/claude-code/index.js` — line 332: same
- `lib/harness/clis/gemini/index.js` — line 363: same
- `lib/harness/clis/codex/index.js` — line 358: same
- `lib/harness/clis/qwen/index.js` — line 389: same

Each harness stores the scope string at construction and uses it in its `bridgeToEventBus` / emit calls.

### 4f. Client message router — populate session fields

In `lib/ws/client-message-router.js`, when `thread:open-assistant` is handled (line 92):

```js
// After resolving threadId and scope...
session.currentWorkspaceId = path.basename(projectRoot);  // transitional
session.currentViewId = (scope === 'view') ? state.panelId : null;
```

And in the `set_panel` handler (line 192):

```js
// When panel changes, update the view context
session.currentViewId = panel;  // will be null-checked by resolveScope based on scope
```

### 4g. Wire process manager — pass scope through registration

`registerWire(threadId, wire, projectRoot, ws)` currently stores per-thread wire metadata. The scope needs to flow through so that any module looking up a wire can also know its scope context.

**Change:**
```js
// Before
registerWire(threadId, wire, projectRoot, ws)

// After
registerWire(threadId, wire, projectRoot, ws, { workspaceId, viewId })
```

The registry entry gains `workspaceId` and `viewId` fields. `getClientForThread` remains unchanged (it returns `ws`). A new `getScopeForThread(threadId)` getter returns the scope string for any subscriber that needs it without access to the session.

---

## 5. Downstream consumers — impact assessment

### 5a. Wire broadcaster (`lib/wire/wire-broadcaster.js`)

**No change needed.** The broadcaster routes by `threadId`, not by `workspace`. It passes through whatever fields the event carries. The client already receives the full event payload including the `workspace` field — it just previously received `'code-viewer'` for everything.

### 5b. Audit subscriber (`lib/audit/audit-subscriber.js`)

**No change needed.** The subscriber keys by `threadId` and doesn't use the `workspace` field at all. If audit reporting later needs workspace grouping, `parseScope(event.workspace)` gives it.

### 5c. Trigger loader (`lib/triggers/trigger-loader.js`)

**No change needed.** Triggers match by event type and payload conditions. If a trigger needs to filter by workspace, the `workspace` field is now meaningful (it was previously useless as a constant).

### 5d. Event bus (`lib/event-bus.js`)

**One small addition.** The `eventKey()` function for same-event-loop suppression currently checks `ticketId`, `threadId`, `runId`. Workspace events introduced by `MULTI_WORKSPACE_SPEC.md` will use `workspaceId` as their key field. Add it now:

```js
function eventKey(data) {
  return data.ticketId ?? data.threadId ?? data.runId ?? data.workspaceId ?? null;
}
```

This is forward-compatible: it doesn't affect existing events (they all have `threadId` which takes precedence), but it prevents future workspace event loops.

### 5e. Event bus module docstring

The header comment is stale. Update to reflect the bus's actual role:

```js
/**
 * Event Bus — central pub/sub for all server-side cross-module communication.
 *
 * This is the backbone of the system. All chat events, workspace lifecycle,
 * thread lifecycle, ticket dispatch, agent runs, and user-defined automations
 * flow through this bus.
 *
 * Emitters: wire message router, all harnesses (kimi, claude-code, gemini,
 *           codex, qwen, robin), client message router, runner, dispatch
 * Listeners: wire-broadcaster, audit-subscriber, trigger-loader,
 *            (future) workspace/thread lifecycle controllers
 */
```

---

## 6. Event payload shape (before/after)

**Before:**
```js
{
  type: 'chat:turn_begin',
  workspace: 'code-viewer',           // hardcoded, wrong
  threadId: 'abc-123',
  turnId: 'def-456',
  userInput: 'hello',
  timestamp: 1712966400000
}
```

**After:**
```js
{
  type: 'chat:turn_begin',
  workspace: 'workspace:open-robin',   // workspace-universal
  threadId: 'abc-123',
  turnId: 'def-456',
  userInput: 'hello',
  timestamp: 1712966400000
}
```

Or for a view-bound chat:
```js
{
  type: 'chat:turn_begin',
  workspace: 'workspace:open-robin, wiki-viewer',  // view-bound
  threadId: 'abc-123',
  turnId: 'def-456',
  userInput: 'hello',
  timestamp: 1712966400000
}
```

---

## 7. Implementation order

The changes are ordered to stay green at each step. No step changes behavior until the final one, and each intermediate step is independently testable.

1. **Create `lib/chat-scope.js`** — `resolveScope()` and `parseScope()`. Pure functions, no side effects.

2. **Add session fields** — Add `currentWorkspaceId` and `currentViewId` to the session object in `server.js`. Default `currentWorkspaceId` to `path.basename(projectRoot)`. No behavior change.

3. **Populate session fields** — Update `client-message-router.js` to set `currentViewId` during `thread:open-assistant` and `set_panel`. No behavior change (fields are written but not read yet).

4. **Update spawn signature** — Add optional `{ workspaceId, viewId }` to `spawnThreadWire` in `compat.js`. Pass through to harness constructors. Harnesses store but don't use yet. No behavior change.

5. **Update wire registry** — Add `workspaceId` and `viewId` to `registerWire` in `process-manager.js`. Add `getScopeForThread()`. No behavior change.

6. **Switch emitters** — Replace all 9 `workspace: 'code-viewer'` occurrences in `message-router.js` with `workspace: resolveScope(session)`. Replace all 6 harness hardcoded values with their stored scope. **This is the behavior change.** All events now carry the correct scope.

7. **Update `eventKey()`** — Add `data.workspaceId` to the dedup function. Forward-compat only.

8. **Update event bus docstring** — Housekeeping.

---

## 8. Files changed (complete list)

| File | Change | Lines affected |
|---|---|---|
| `lib/chat-scope.js` | **New file** — `resolveScope`, `parseScope` | ~30 lines |
| `server.js` | Add `currentWorkspaceId`, `currentViewId` to session; set default | 2 lines added (~267-268) |
| `lib/ws/client-message-router.js` | Set `currentViewId` in `thread:open-assistant` and `set_panel` | ~4 lines |
| `lib/harness/compat.js` | Pass `{ workspaceId, viewId }` context to harness constructors | ~6 lines |
| `lib/wire/process-manager.js` | Add scope fields to `registerWire`, add `getScopeForThread()` | ~10 lines |
| `lib/wire/message-router.js` | Import `resolveScope`; replace 9 hardcoded strings | 10 lines changed |
| `lib/harness/kimi/index.js` | Store and use scope from constructor | ~3 lines |
| `lib/harness/robin/index.js` | Store and use scope from constructor | ~3 lines |
| `lib/harness/clis/claude-code/index.js` | Store and use scope from constructor | ~3 lines |
| `lib/harness/clis/gemini/index.js` | Store and use scope from constructor | ~3 lines |
| `lib/harness/clis/codex/index.js` | Store and use scope from constructor | ~3 lines |
| `lib/harness/clis/qwen/index.js` | Store and use scope from constructor | ~3 lines |
| `lib/event-bus.js` | Add `workspaceId` to `eventKey()`; update docstring | ~5 lines |

**Total:** 1 new file (~30 lines), 12 files edited (~55 lines changed).

---

## 9. What this does NOT change

- **Thread storage paths** — already correct per SPEC-26b (`ai/views/chat/threads/` for project scope, `ai/views/<view>/chat/threads/` for view scope).
- **ThreadManager** — already workspace-aware with dual-scope model. No changes.
- **ThreadWebSocketHandler** — already tracks `panelId`, `viewName`, `threadIds` per scope. No changes.
- **Wire broadcaster** — routes by `threadId`, transparent to `workspace` field.
- **Audit subscriber** — keys by `threadId`, doesn't use `workspace`.
- **Popup bubble behavior** — stays as-is. Popup and main chat are both workspace-universal surfaces reading the same threads.
- **Client-side stores** — receive the new scope string via WebSocket but don't need to parse it until multi-workspace ships.

---

## 10. Relationship to MULTI_WORKSPACE_SPEC.md

This spec is a **prerequisite** for multi-workspace switching. Once this lands:

- The `workspace` field in every event is structurally correct.
- The session knows its workspace ID (currently derived from `projectRoot`, future: from registry).
- The `MULTI_WORKSPACE_SPEC.md` workspace controller can update `session.currentWorkspaceId` on `workspace:switched` and all downstream events automatically carry the new scope.
- The thread lifecycle controller (`MULTI_WORKSPACE_SPEC.md` §5b) can filter events by workspace using `parseScope()`.

Without this spec, multi-workspace would need to simultaneously fix scoping AND add switching — two concerns that are better separated.

---

## 11. Decisions log

1. **Scope format: structured string, not object.** Keeps event payload flat. Subscribers parse only when they need both dimensions. Most subscribers only care about workspace ID.
2. **Transitional default: `path.basename(projectRoot)`.** Today the server runs against one project. Using the directory name as workspace ID matches what the multi-workspace registry will use as its `id` column. When multi-workspace ships, the default is replaced by registry lookup.
3. **Harness scope via spawn context, not session.** Harnesses are child processes — they don't have access to the session object. Passing `{ workspaceId, viewId }` at spawn time is the clean injection point.
4. **Forward-compatible `eventKey()`.** Adding `workspaceId` now prevents a subtle bug when workspace lifecycle events ship later.
