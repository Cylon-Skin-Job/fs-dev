# Session T1L2 — Server WS Handlers + UEB Events

**Track:** 1 (Server). **Layer:** 2 (Handlers + event emission).
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for context. Sections most relevant to this session: §6, §7g, §8a, §11b.
**Dependencies:** Sessions T1L0 and T1L1 must be complete and merged. Specifically: `lib/secrets/api-keys/backend.js` exposes `list / add / update / remove`, `lib/event-bus.js` exists, `lib/secrets.js` exports `KEY_PATTERN`.
**Estimated size:** Medium. Two new files, ~150 lines combined.

---

## Files in scope

### 1. `open-robin-server/lib/secrets/api-keys/handlers.js` (new)

Translates `secrets:api-keys:*` WS messages into backend calls, emits UEB events, and broadcasts state to all connected clients. Mirrors the precedent set by `lib/robin/ws-handlers.js`.

**Required exports:** an object mapping each message type to its handler:

```js
module.exports = {
  'secrets:api-keys:list':   async (ws) => { ... },
  'secrets:api-keys:set':    async (ws, msg) => { ... },
  'secrets:api-keys:delete': async (ws, msg) => { ... },
};
```

Handler responsibilities, per message:

**`secrets:api-keys:list`** — call `backend.list()`, send `secrets:api-keys:state { items: [...] }` to the requesting socket only. No UEB event (read-only).

**`secrets:api-keys:set`** — distinguish add vs update by checking whether the name already exists (use `backend` interface, don't reach into the index-table directly). Then:
- Call `backend.add(...)` or `backend.update(name, ...)`.
- On success: emit one UEB event (`secret:added` or `secret:updated`); broadcast `secrets:api-keys:state` to **all** sockets (call `backend.list()` to get fresh state).
- On thrown `ApiKeysBackendError`: send `secrets:api-keys:error { name, code, message }` to the requesting socket only.

**`secrets:api-keys:delete`** — call `backend.remove(name)`. On success: emit `secret:deleted`; broadcast updated state. On `NOT_FOUND`: send error to requester.

**UEB event payloads** per §7g:

```js
const { emit } = require('../../event-bus');

emit('secret:added',   { kind: 'api-key', name, description, use_when, expires_at, fingerprint });
emit('secret:updated', { kind: 'api-key', name, description, use_when, expires_at, fingerprint, changed_fields });
emit('secret:deleted', { kind: 'api-key', name });
```

`description`, `use_when`, `expires_at` are nullable; pass through whatever the backend returned. **Never include the value field.** The bus adds `id`, `chain_id`, `timestamp` automatically.

**Broadcast helper.** The handler needs a way to send to all connected sockets, not just the requester. Look for the existing pattern — `lib/robin/ws-handlers.js` and the theme handlers both broadcast on mutation. Use the same broadcast primitive (likely a `broadcast(msg)` function exposed somewhere in `lib/ws/` or passed in as a dependency). If the existing pattern uses a factory like `createHandlers(deps)`, follow that.

### 2. `open-robin-server/lib/secrets/index.js` (new)

Registers all sub-module handlers with the WS router. v1 has only API Keys; future sub-modules append to this list.

```js
const apiKeysHandlers = require('./api-keys/handlers');

function register(wsRouter) {
  for (const [type, handler] of Object.entries(apiKeysHandlers)) {
    wsRouter.on(type, handler);
  }
}

module.exports = { register };
```

Match whatever pattern the existing `lib/robin/index.js` uses (or the equivalent). If `wsRouter` is passed differently (e.g., handlers are registered via a `routes` object), match that. Don't invent a new registration pattern — mirror what's already there.

---

## Files NOT in scope

- `lib/secrets/api-keys/backend.js`, `index-table.js`, `fingerprint.js` — done in T1L1, do not modify.
- `lib/secrets.js` — keychain wrapper, no changes here.
- `lib/event-bus.js` — emit pattern only; do not modify the bus.
- `server.js` — Layer 3, next session.
- Anything client-side, anything wiki.

---

## Acceptance criteria

1. **`list` handler.** A WS connection sending `{type:'secrets:api-keys:list'}` receives `{type:'secrets:api-keys:state', items:[...]}` with the current rows from `secrets_index`. Other connected sockets are not notified (read-only).

2. **`set` handler — add path.** A WS connection sending a `secrets:api-keys:set` for a new name results in: keychain entry written; `secrets_index` row inserted; UEB `secret:added` event fired with `kind:'api-key'` and metadata (no value); `secrets:api-keys:state` broadcast to all sockets.

3. **`set` handler — update path.** Same message for an existing name results in: keychain rewritten; `secrets_index` row updated; UEB `secret:updated` fired with correct `changed_fields`; broadcast.

4. **`delete` handler.** Removes from keychain and index; emits `secret:deleted` with `{kind, name}`; broadcasts.

5. **Error paths.** Sending `set` with name `lowercase-bad` returns `secrets:api-keys:error` with `code: 'INVALID_NAME'` to the requesting socket only. Other sockets are not notified. No UEB event fires for failures.

6. **Values never leak.**
   - Subscribe to `*` on the event bus during a full add/update/delete cycle. Inspect every event payload — none contains a `value` field.
   - Capture all WS messages sent during the same cycle. Inspect every payload — none contains a `value` field except the inbound `secrets:api-keys:set` message (which is the user's submission, not the server's reply).
   - `wire-debug.log` and `server.log` after the cycle: grep for the test value's plaintext — zero matches.

7. **`set` distinguishes add vs update via the backend interface.** `grep -E "from.*index-table|require.*index-table" lib/secrets/api-keys/handlers.js` returns zero matches — handlers go through `backend.js` only, never reach into the index table directly.

8. **No DOM, no WS-client logic.** `grep -rE "document\.|window\.|fetch\(" lib/secrets/api-keys/handlers.js lib/secrets/index.js` returns zero matches.

9. **File sizes.** Both new files under 200 lines.

10. **Registration is uniform.** `lib/secrets/index.js` exports `register(router)` matching the precedent established by sibling modules (verify by reading `lib/robin/index.js` or equivalent before writing).

11. **No out-of-scope changes.** `git status` shows changes only to the two new files.

---

## Implementation notes

- Read `lib/robin/ws-handlers.js` first. It's the precedent for "WS handler module that handles a feature's protocol." Match its shape: factory or static export, error patterns, broadcast usage.
- Pure handlers — no `setInterval`, no background work. Each handler is request-driven.
- The `secrets:api-keys:set` handler needs to detect add-vs-update by checking the backend's `list()` (or a `has(name)` helper if the backend exposes one). Don't catch `DUPLICATE` from `add` and retry as `update` — that's a race. Check first, then call the right method.
- For UEB emission, import `emit` from `../../event-bus`. Don't import the whole bus.
- Don't catch generic `Error` and convert to error responses. Catch `ApiKeysBackendError` (the custom class T1L1 defined) specifically. Anything else bubbles — that's a real bug, surface it.

---

## Return format

```
Session T1L2 complete.

Files changed:
  - <git diff stat>

Acceptance criteria:
  1. list handler:                            [pass / fail + notes]
  2. set handler — add:                       [pass / fail + notes]
  3. set handler — update:                    [pass / fail + notes]
  4. delete handler:                          [pass / fail + notes]
  5. Error paths:                             [pass / fail + notes]
  6. Values never leak:                       [pass / fail + notes]
  7. set goes through backend, not index:     [pass / fail + notes]
  8. No DOM, no fetch:                        [pass / fail + notes]
  9. File sizes:                              [pass / fail + notes]
  10. Registration matches precedent:         [pass / fail + notes]
  11. No out-of-scope changes:                [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: T1L3 (server.js wiring + end-to-end smoke).
```
