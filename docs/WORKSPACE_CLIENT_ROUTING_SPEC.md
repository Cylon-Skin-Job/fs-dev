# Workspace Client Routing — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Prerequisite for:** `MULTI_WORKSPACE_SPEC.md` §6a (workspace-controller), §6b (client store).
**Depends on:** `WORKSPACE_BROADCASTER_SPEC.md` (landed — server→client path is live).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

The workspace-broadcaster (Gap 2) solved server→client delivery. This spec solves the opposite direction: **client→server routing** for workspace lifecycle requests.

When the multi-workspace UI sends `workspace:switch_requested`, `workspace:add_requested`, or `workspace:remove_requested`, those WebSocket messages need to arrive on the Universal Event Bus so the workspace-controller can act on them. Today, the client-message-router (`lib/ws/client-message-router.js`) handles thread, file, panel, wire, robin, clipboard, harness, and state messages — but has no `workspace:*` cases.

This spec adds the `workspace:*` routing cases to the client-message-router, completing the full round-trip:

```
Client → WebSocket → client-message-router → emit() → Event Bus
  → workspace-controller subscribes, acts, emits result
  → workspace-broadcaster subscribes → WebSocket → Client
```

---

## 2. What the spec explicitly says (MULTI_WORKSPACE_SPEC §5a)

The multi-workspace spec defines these client-initiated events:

| Event | Payload | Origin |
|---|---|---|
| `workspace:add_requested` | `{ repoPath }` | Switcher view, empty-state tile |
| `workspace:switch_requested` | `{ workspaceId }` | Switcher view |
| `workspace:remove_requested` | `{ workspaceId }` | Switcher view |

These are described as "emitted by client views" — but the event bus is server-side only. The client sends WebSocket messages; the client-message-router translates them to bus events. This spec defines that translation.

---

## 3. WebSocket message format

The client sends JSON messages matching the existing convention: `{ type: string, ...payload }`.

| Client sends | Bus event emitted | Additional fields attached |
|---|---|---|
| `{ type: 'workspace:add_requested', repoPath: '...' }` | `workspace:add_requested` | `connectionId` (for targeted rejection response) |
| `{ type: 'workspace:switch_requested', workspaceId: '...' }` | `workspace:switch_requested` | `connectionId` |
| `{ type: 'workspace:remove_requested', workspaceId: '...' }` | `workspace:remove_requested` | `connectionId` |

**`connectionId` injection:** The client-message-router has access to the per-connection `session.connectionId`. It attaches this to every workspace event so the workspace-controller (future) can emit targeted responses (e.g. `workspace:add_rejected_duplicate` with the requester's `connectionId`, which the workspace-broadcaster delivers to that specific client).

---

## 4. Implementation

### 4a. New section in client-message-router.js

Add a workspace routing block after the existing harness admin section and before the "Unknown message type" fallback. The block handles all `workspace:*` messages:

```js
// ---- Workspace lifecycle (MULTI_WORKSPACE_SPEC) ----

if (clientMsg.type === 'workspace:add_requested') {
  emit('workspace:add_requested', {
    repoPath: clientMsg.repoPath,
    connectionId: session.connectionId,
  });
  return;
}

if (clientMsg.type === 'workspace:switch_requested') {
  emit('workspace:switch_requested', {
    workspaceId: clientMsg.workspaceId,
    connectionId: session.connectionId,
  });
  return;
}

if (clientMsg.type === 'workspace:remove_requested') {
  emit('workspace:remove_requested', {
    workspaceId: clientMsg.workspaceId,
    connectionId: session.connectionId,
  });
  return;
}
```

### 4b. Validation

Minimal validation — the workspace-controller is the authority. The router's job is translation, not enforcement:

- **`workspace:add_requested`**: require `repoPath` is a non-empty string. If missing, send `{ type: 'error', message: 'workspace:add_requested requires repoPath' }` back to the client.
- **`workspace:switch_requested`**: require `workspaceId` is a non-empty string.
- **`workspace:remove_requested`**: require `workspaceId` is a non-empty string.

### 4c. Existing `emit` import

The client-message-router already imports `emit` from the event bus (line 36 in the current file):
```js
const { emit } = require('../event-bus');
```

No new imports needed.

---

## 5. Smoke test

Since the workspace-controller doesn't exist yet, these events will be emitted to the bus but nobody subscribes to them (except the wildcard `*` listener if trigger-loader has any matching rules). The smoke test verifies the routing path works:

1. **From browser console**, send a raw WebSocket message:
   ```js
   ws.send(JSON.stringify({ type: 'workspace:add_requested', repoPath: '/tmp/test-repo' }));
   ```

2. **In server logs**, verify:
   ```
   [WS] Message type: workspace:add_requested Conn: ...
   ```
   The event should be logged by the event bus (if wildcard logging is enabled) or at minimum not produce any errors.

3. **Verify `connectionId` is attached** by adding a temporary `*` listener that logs workspace events:
   ```js
   on('*', (event) => {
     if (event.type.startsWith('workspace:')) console.log('[WorkspaceRoute]', event);
   });
   ```
   The logged event should include `connectionId`.

4. **Verify validation** by sending without required fields:
   ```js
   ws.send(JSON.stringify({ type: 'workspace:add_requested' }));
   ```
   Client should receive `{ type: 'error', message: '...' }`.

---

## 6. What this does NOT do

- **Handle workspace requests.** The router emits events; it doesn't add, switch, or remove workspaces. That's the workspace-controller's job (MULTI_WORKSPACE_SPEC §6a).
- **Add client-side UI.** The switcher view, add modal, and empty state are MULTI_WORKSPACE_SPEC §6b work.
- **Change existing routing.** All current `thread:*`, `file:*`, `set_panel`, `wire:*`, `robin:*`, `clipboard:*`, `harness:*`, and `state:*` handlers are untouched.

---

## 7. Files changed

| File | Change |
|---|---|
| `lib/ws/client-message-router.js` | Add `workspace:*` routing block (~25 lines) after harness admin section |

**Total:** 1 file edited, ~25 lines added.

---

## 8. Full round-trip (after all three gaps are landed)

With all three prerequisites in place, the multi-workspace round-trip is wired:

```
┌─────────────────────────────────────────────────────┐
│ CLIENT                                              │
│                                                     │
│  Switcher View                     workspaceStore   │
│       │                                 ▲           │
│       │ ws.send()                       │ onmessage │
│       ▼                                 │           │
└───────┬─────────────────────────────────┼───────────┘
        │ WebSocket                       │ WebSocket
        ▼                                 │
┌───────┴─────────────────────────────────┼───────────┐
│ SERVER                                  │           │
│                                         │           │
│  client-message-router ──emit()──▶ Event Bus        │
│    (Gap 3 — this spec)               │    │         │
│                                      │    │         │
│                    workspace-controller   │         │
│                    (MULTI_WORKSPACE_SPEC) │         │
│                           │              │         │
│                       emit()             │         │
│                           ▼              │         │
│                       Event Bus          │         │
│                           │              │         │
│                    workspace-broadcaster──┘         │
│                    (Gap 2 — landed)                 │
│                                                     │
│  thread-lifecycle-controller (Gap 1 — landed)       │
│    ├── subscribes to chat:turn_begin/end            │
│    └── emits thread:state_changed/idle_expired      │
│         └── workspace-broadcaster forwards to client│
│                                                     │
└─────────────────────────────────────────────────────┘
```

The only missing piece after this spec is the workspace-controller itself — the module that actually handles workspace CRUD and emits the result events. That is the core of MULTI_WORKSPACE_SPEC §6a.
