# Thread Lifecycle Controller — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Prerequisite for:** `MULTI_WORKSPACE_SPEC.md` §3b, §5b, §6a.
**Depends on:** `CHAT_SCOPE_SPEC.md` (landed — `workspace` field is now structured).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

The multi-workspace spec (§5b) needs a thread lifecycle controller that tracks per-thread state (IDLE vs IN_FLIGHT) via the Universal Event Bus. Today, the existing `SessionManager` handles idle timeouts via direct callbacks within each `ThreadManager` instance — but it has no turn-awareness, no bus integration, and no hot-reload support.

This spec adds a **bus-driven observer** that:
1. Subscribes to existing `chat:turn_begin` / `chat:turn_end` events (resolving MULTI_WORKSPACE_SPEC §13 TODO #4).
2. Tracks per-thread state: IDLE or IN_FLIGHT.
3. Manages a configurable idle timer per thread.
4. Emits new `thread:*` events that downstream consumers can subscribe to.

This is **additive** — the existing `SessionManager` continues to function unchanged. The lifecycle controller observes the same turns through a different channel (bus events vs direct calls). When multi-workspace ships, `SessionManager` can be deprecated in favor of this bus-driven pattern.

---

## 2. Naming resolution (MULTI_WORKSPACE_SPEC §13 TODO #4)

The multi-workspace spec proposed `thread:turn_start` / `thread:turn_end` as input events but noted they "may already exist under different names." They do:

| Spec proposed | Existing event | Resolution |
|---|---|---|
| `thread:turn_start` | `chat:turn_begin` | Subscribe to `chat:turn_begin` |
| `thread:turn_end` | `chat:turn_end` | Subscribe to `chat:turn_end` |

**The thread-lifecycle-controller subscribes to `chat:*` events as inputs. It emits `thread:*` events as outputs.** No new input events are created. The `thread:` namespace is exclusively for lifecycle state changes produced by this controller.

---

## 3. State machine

Each tracked thread is in one of two states:

```
                chat:turn_begin
  IDLE  ─────────────────────────▶  IN_FLIGHT
   ▲                                    │
   │                                    │
   └────────────────────────────────────┘
              chat:turn_end
           (starts fresh idle timer)
```

- **IDLE** — No active turn. Idle timer is running. Thread is eligible for eviction when the timer fires.
- **IN_FLIGHT** — A turn is in progress. Timer is suspended. Thread cannot be evicted.

**Entry:** A thread enters tracking on its first `chat:turn_begin`. There is no explicit "register" call.

**Exit:** A thread exits tracking when:
- Its idle timer fires → `thread:idle_expired` emitted.
- Its wire disconnects (future: `wire:disconnected` event, out of scope for this spec).

---

## 4. Events

### 4a. Input events (existing — no changes)

| Event | Relevant payload fields | Used by controller |
|---|---|---|
| `chat:turn_begin` | `threadId`, `workspace` | Transition to IN_FLIGHT; suspend timer |
| `chat:turn_end` | `threadId`, `workspace` | Transition to IDLE; start fresh timer |
| `settings:enforcement_changed` | `key`, `value` | Hot-reload timeout value (§5) |

### 4b. Output events (new)

| Event | Payload | When emitted |
|---|---|---|
| `thread:state_changed` | `{ threadId, workspace, state, previousState }` | Every IDLE↔IN_FLIGHT transition |
| `thread:idle_expired` | `{ threadId, workspace, idleMs }` | When an IDLE thread's timer fires |

`state` is one of: `'idle'`, `'in_flight'`.

`workspace` is the structured scope string from CHAT_SCOPE_SPEC (e.g. `workspace:open-robin` or `workspace:open-robin, wiki-viewer`), carried through from the originating `chat:*` event.

**Note:** `thread:idle_expired` does not evict the thread — it is a signal. A future thread-eviction-controller (MULTI_WORKSPACE_SPEC §6a) will subscribe and handle the actual cleanup. For now, the event is emitted and logged. This keeps the lifecycle controller's job pure: observe and signal.

---

## 5. Hot reload

When `settings:enforcement_changed` fires with `key === 'enforcement.thread_idle_timeout_minutes'`:

1. Store the new timeout value.
2. For every thread in **IDLE** state: clear the old timer and start a fresh timer using the **new** timeout, starting **from now** (not from the thread's original `lastActivity`).
3. For every thread in **IN_FLIGHT** state: do nothing (their timers are already suspended).

This matches MULTI_WORKSPACE_SPEC §3d decision #4: no surprise evictions on save.

**When timeout is set to 0:** Timers are disabled entirely. All existing timers are cleared. No `thread:idle_expired` events will fire until the timeout is set back to a positive value.

---

## 6. Module

### 6a. File

```
lib/thread/thread-lifecycle-controller.js
```

One file, one job: observe turns via the bus, manage IDLE/IN_FLIGHT state, emit lifecycle events.

### 6b. Shape

```js
const { on, emit } = require('../event-bus');

// In-memory state: threadId → { state, workspace, timer, lastTransition }
const threads = new Map();

let idleTimeoutMinutes = 45; // default, overridden by settings

function start(config = {}) {
  if (config.idleTimeoutMinutes !== undefined) {
    idleTimeoutMinutes = config.idleTimeoutMinutes;
  }

  on('chat:turn_begin', handleTurnBegin);
  on('chat:turn_end', handleTurnEnd);
  on('settings:enforcement_changed', handleSettingsChanged);

  console.log('[ThreadLifecycle] Started (timeout: ' + idleTimeoutMinutes + 'min)');
}
```

### 6c. Handlers

**`handleTurnBegin(event)`**
```
1. Extract threadId, workspace from event.
2. If threadId not in threads Map → create entry with state=IN_FLIGHT, workspace.
3. If threadId exists and state is IDLE → clear timer, set state=IN_FLIGHT.
4. If threadId exists and state is already IN_FLIGHT → no-op (nested turn, shouldn't happen but safe).
5. Emit thread:state_changed { threadId, workspace, state: 'in_flight', previousState }.
```

**`handleTurnEnd(event)`**
```
1. Extract threadId, workspace from event.
2. If threadId not in threads Map → ignore (turn_end without turn_begin, shouldn't happen).
3. Set state=IDLE, update workspace (in case it changed mid-session).
4. Start fresh idle timer.
5. Emit thread:state_changed { threadId, workspace, state: 'idle', previousState: 'in_flight' }.
```

**`handleSettingsChanged(event)`**
```
1. If event.key !== 'enforcement.thread_idle_timeout_minutes' → ignore.
2. Update idleTimeoutMinutes to event.value.
3. For each thread in IDLE state → clear timer, start fresh timer with new timeout from now.
4. Log: "[ThreadLifecycle] Timeout updated to Xmin, rebased N idle timers".
```

**Timer callback (when idle timer fires)**
```
1. Look up thread entry.
2. If state !== IDLE → ignore (race: turn started between timer set and fire).
3. Emit thread:idle_expired { threadId, workspace, idleMs }.
4. Remove thread from Map (no longer tracked).
5. Log: "[ThreadLifecycle] Thread X idle expired after Ymin".
```

### 6d. Read-only getters (for debugging / future consumers)

```js
function getThreadState(threadId)     // returns entry or null
function getTrackedCount()            // returns threads.size
function getIdleCount()               // returns count where state === 'idle'
function getInFlightCount()           // returns count where state === 'in_flight'
```

### 6e. Exports

```js
module.exports = {
  startThreadLifecycle,    // call once at server boot
  getThreadState,
  getTrackedCount,
  getIdleCount,
  getInFlightCount,
};
```

---

## 7. Initialization

Called once in `lib/startup.js` (or `server.js` boot sequence), **after** the event bus is available and **after** the audit subscriber / wire broadcaster have started:

```js
const { startThreadLifecycle } = require('./thread/thread-lifecycle-controller');
startThreadLifecycle({ idleTimeoutMinutes: 45 });
```

The default timeout (45) comes from the enforcement settings. If the settings system is available at boot, read from it; otherwise use the default and let hot-reload adjust when settings load.

---

## 8. What this does NOT do

- **Evict threads.** The controller emits `thread:idle_expired` but does not kill wires or persist state. That's the thread-eviction-controller's job (MULTI_WORKSPACE_SPEC §6a), which is out of scope here.
- **Replace SessionManager.** The existing `SessionManager` continues to run its own timeouts via direct callbacks. Both systems coexist. The lifecycle controller is an observer, not an actor.
- **Touch the client.** No client-side changes. The new `thread:*` events stay server-side for now. When multi-workspace ships, the workspace-broadcaster will forward relevant events to the client.
- **Add enforcement settings UI.** The `enforcement.thread_idle_timeout_minutes` setting is defined in MULTI_WORKSPACE_SPEC §4b. This spec just subscribes to changes — it doesn't create the setting or its UI.

---

## 9. Verification

After implementation, verify with server logs:

1. **Start server, open a thread, send a message.**
   - Log should show: `[ThreadLifecycle] thread:state_changed → in_flight` on `chat:turn_begin`.
   - Log should show: `[ThreadLifecycle] thread:state_changed → idle` on `chat:turn_end`.

2. **Wait for idle timeout (set to 1 minute for testing).**
   - Log should show: `[ThreadLifecycle] Thread X idle expired after 1min`.

3. **Send a message during IN_FLIGHT, verify timer is suspended.**
   - No idle expiration should fire while a turn is active, even if it runs for 30 minutes.

4. **Open two threads, verify independent tracking.**
   - Each thread should have its own timer. Thread A expiring does not affect Thread B.

**Temporary test helper (remove after verification):**

To test without waiting 45 minutes, the startup call can pass `{ idleTimeoutMinutes: 1 }` temporarily. Or the controller can expose a `_setTimeoutForTesting(minutes)` method that rebases all idle timers (same logic as hot-reload).

---

## 10. Files changed

| File | Change |
|---|---|
| `lib/thread/thread-lifecycle-controller.js` | **New file** — ~120 lines |
| `lib/startup.js` (or `server.js`) | Add `startThreadLifecycle()` call in boot sequence |

**Total:** 1 new file, 1 file edited (1 line added).

---

## 11. Relationship to multi-workspace

This spec delivers MULTI_WORKSPACE_SPEC §6a's `thread-lifecycle-controller.js` and resolves §13 TODO #4. Once landed:

- The `thread:state_changed` event is available for the thread-runtime-state module to subscribe to.
- The `thread:idle_expired` event is available for the thread-eviction-controller to subscribe to.
- The hot-reload pattern (§3d) is proven: settings → bus event → controller adjusts live.
- The naming question is settled: `chat:*` = wire protocol events, `thread:*` = lifecycle state events.
