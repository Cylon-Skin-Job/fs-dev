# Workspace Broadcaster — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Prerequisite for:** `MULTI_WORKSPACE_SPEC.md` §6a, §6b.
**Depends on:** `THREAD_LIFECYCLE_SPEC.md` (landed — `thread:state_changed` is available for smoke test).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

The wire-broadcaster (`lib/wire/wire-broadcaster.js`) handles server→client delivery for `chat:*` events, routing by `threadId` to the specific WebSocket that owns the thread. But workspace lifecycle events (`workspace:switched`, `workspace:registry_changed`, etc.) have no `threadId` — they need to reach **all connected clients** or a **specific requesting client**.

This spec adds a workspace-broadcaster that completes the server→client return path for workspace and thread lifecycle events. It follows the identical architectural pattern as wire-broadcaster: subscribe to bus events at startup, deliver to WebSocket clients, no state.

**Smoke test value:** The thread-lifecycle-controller already emits `thread:state_changed` events. The workspace-broadcaster can forward these to connected clients immediately, proving the all-client broadcast pattern before multi-workspace ships.

---

## 2. Delivery modes

Workspace events fall into two delivery categories:

| Mode | Mechanism | Use case |
|---|---|---|
| **Broadcast** | Send to every connected WebSocket with `readyState === OPEN` | Registry changes, workspace switches — all clients need to stay in sync |
| **Targeted** | Send to the specific WebSocket that triggered the action | Rejection modals, error responses — only the requester sees them |

The broadcaster receives a `getAllClients()` function at init time (returns all open WebSocket instances from the `sessions` Map in `server.js`). For targeted delivery, the originating event must carry a `connectionId` so the broadcaster can match it.

---

## 3. Events

### 3a. Broadcast events (all clients)

These events are emitted by the workspace-controller (future) and thread-lifecycle-controller (landed). Every connected client receives them.

| Bus event | Wire message type | Payload forwarded |
|---|---|---|
| `workspace:added` | `workspace:added` | `{ workspace }` |
| `workspace:removed` | `workspace:removed` | `{ workspaceId }` |
| `workspace:registry_changed` | `workspace:registry_changed` | `{ workspaces }` |
| `workspace:switched` | `workspace:switched` | `{ from, to }` |
| `workspace:culled_at_launch` | `workspace:culled_at_launch` | `{ workspaceId, reason }` |
| `thread:state_changed` | `thread:state_changed` | `{ threadId, workspace, state, previousState }` |

### 3b. Targeted events (requesting client only)

These are responses to a specific client's action. The originating event must include `connectionId` (set by client-message-router when translating a WebSocket message to a bus event).

| Bus event | Wire message type | Payload forwarded |
|---|---|---|
| `workspace:add_rejected_duplicate` | `workspace:add_rejected_duplicate` | `{ existingWorkspace }` |

### 3c. Internal-only events (not broadcast)

These events stay on the bus — subscribers act on them server-side but clients don't need them:

| Bus event | Why not broadcast |
|---|---|
| `workspace:state_changed` | Internal bookkeeping, no client display impact |
| `workspace:loaded` | Display LRU controller internal state |
| `workspace:display_evicted` | Display LRU controller internal state |
| `thread:idle_expired` | Eviction signal for server-side controller, not client-visible |

---

## 4. Module

### 4a. File

```
lib/ws/workspace-broadcaster.js
```

Lives alongside `lib/wire/wire-broadcaster.js`. Same architectural shape: subscribe to bus events at startup, deliver to clients, no state.

### 4b. Shape

```js
const { on } = require('../event-bus');

/**
 * @param {object} deps
 * @param {() => WebSocket[]} deps.getAllClients
 *   Returns all connected WebSocket instances with readyState === OPEN.
 * @param {(connectionId: string) => WebSocket|null} deps.getClientByConnectionId
 *   Returns the specific WebSocket for a targeted event, or null.
 * @returns {{ started: boolean }}
 */
function createWorkspaceBroadcaster({ getAllClients, getClientByConnectionId }) {

  function broadcastAll(wireMessage) {
    const clients = getAllClients();
    const payload = JSON.stringify(wireMessage);
    for (const ws of clients) {
      ws.send(payload);
    }
  }

  function sendTargeted(connectionId, wireMessage) {
    const ws = getClientByConnectionId(connectionId);
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(wireMessage));
  }

  // --- Broadcast subscriptions ---

  on('workspace:added', (event) => {
    broadcastAll({ type: 'workspace:added', workspace: event.workspace });
  });

  on('workspace:removed', (event) => {
    broadcastAll({ type: 'workspace:removed', workspaceId: event.workspaceId });
  });

  on('workspace:registry_changed', (event) => {
    broadcastAll({ type: 'workspace:registry_changed', workspaces: event.workspaces });
  });

  on('workspace:switched', (event) => {
    broadcastAll({ type: 'workspace:switched', from: event.from, to: event.to });
  });

  on('workspace:culled_at_launch', (event) => {
    broadcastAll({ type: 'workspace:culled_at_launch', workspaceId: event.workspaceId, reason: event.reason });
  });

  on('thread:state_changed', (event) => {
    broadcastAll({
      type: 'thread:state_changed',
      threadId: event.threadId,
      workspace: event.workspace,
      state: event.state,
      previousState: event.previousState,
    });
  });

  // --- Targeted subscriptions ---

  on('workspace:add_rejected_duplicate', (event) => {
    if (!event.connectionId) return;
    sendTargeted(event.connectionId, {
      type: 'workspace:add_rejected_duplicate',
      existingWorkspace: event.existingWorkspace,
    });
  });

  console.log('[WorkspaceBroadcaster] Started');
  return { started: true };
}

module.exports = { createWorkspaceBroadcaster };
```

### 4c. Dependency injection

The broadcaster needs two getters. Both are derived from the `sessions` Map in `server.js`:

**`getAllClients()`** — returns every open WebSocket:

```js
function getAllClients() {
  const clients = [];
  for (const [ws] of sessions) {
    if (ws.readyState === 1) clients.push(ws);
  }
  return clients;
}
```

**`getClientByConnectionId(connectionId)`** — returns the WebSocket for a specific connection:

```js
function getClientByConnectionId(connectionId) {
  for (const [ws, session] of sessions) {
    if (session.connectionId === connectionId && ws.readyState === 1) return ws;
  }
  return null;
}
```

These two functions are defined wherever `sessions` is accessible (either in `server.js` or exported from a small helper). They are passed to the broadcaster at init time.

---

## 5. Initialization

In `lib/startup.js`, after wire-broadcaster and thread-lifecycle-controller:

```js
// 3.7. Workspace broadcaster — bus → WebSocket fan-out for workspace and
// thread lifecycle events. Must subscribe before listen() so events from
// boot (workspace:culled_at_launch) are delivered.
const { createWorkspaceBroadcaster } = require('./ws/workspace-broadcaster');
createWorkspaceBroadcaster({ getAllClients, getClientByConnectionId });
```

The `getAllClients` and `getClientByConnectionId` getters need to be threaded from `server.js` into `startup.js`. The simplest path: add them to the `start()` options object alongside the existing `sessions` parameter. Or define them inside `startup.js` using the already-injected `sessions` Map.

---

## 6. Smoke test

The thread-lifecycle-controller already emits `thread:state_changed` on every turn begin/end. With the workspace-broadcaster running:

1. Open the app in a browser with dev tools open (Network → WS tab, or Console).
2. Send a chat message.
3. In the WebSocket frames, you should see:
   - `{ type: "thread:state_changed", threadId: "...", state: "in_flight", ... }` on turn begin.
   - `{ type: "thread:state_changed", threadId: "...", state: "idle", ... }` on turn end.

This proves: bus event → broadcaster → WebSocket → client. The same path that `workspace:switched` will take when multi-workspace ships.

**The client doesn't need to act on these events yet.** They'll appear in the WebSocket frames as unhandled messages. When the multi-workspace client store subscribes, the delivery path is already working.

---

## 7. What this does NOT do

- **Emit workspace events.** The broadcaster only listens and delivers. The workspace-controller (MULTI_WORKSPACE_SPEC §6a) is the emitter.
- **Handle client→server workspace requests.** That's Gap 3 (client-message-router workspace cases), a separate spec.
- **Add client-side handling.** The client store (`workspaceStore.ts` from MULTI_WORKSPACE_SPEC §6b) is future work. For now, the events arrive on the WebSocket and are ignored.
- **Replace wire-broadcaster.** Wire-broadcaster handles `chat:*` events routed by threadId. Workspace-broadcaster handles `workspace:*` and `thread:*` events broadcast to all clients. They coexist.

---

## 8. Files changed

| File | Change |
|---|---|
| `lib/ws/workspace-broadcaster.js` | **New file** — ~80 lines |
| `lib/startup.js` | Add `createWorkspaceBroadcaster()` call; thread `getAllClients` / `getClientByConnectionId` from `sessions` |
| `server.js` | Expose `getAllClients` / `getClientByConnectionId` helpers (or pass `sessions` to startup and let it derive them) |

**Total:** 1 new file (~80 lines), 2 files edited (small additions).

---

## 9. Relationship to multi-workspace

This spec delivers the server→client broadcast infrastructure that MULTI_WORKSPACE_SPEC §6b's client store (`workspaceStore.ts`) will consume. Once landed:

- `workspace:switched` events will reach the client when the workspace-controller emits them.
- `workspace:registry_changed` events will keep all browser tabs in sync.
- `workspace:add_rejected_duplicate` will surface the "already exists" modal.
- The delivery path is proven via the `thread:state_changed` smoke test — no guesswork when multi-workspace ships.
