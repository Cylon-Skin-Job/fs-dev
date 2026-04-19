# Thread Lifecycle Hardening — Spec

**Status:** Draft — ready for review.
**Owner:** Open Robin core.
**Related:** `CHAT_HEADER_AND_THREAD_OVERLAY_SPEC.md` §11 (empty-thread cleanup follow-up), `project_harness_migration_state.md` (memory).
**Scope:** Both `project` and `view` scopes (see §3 below for per-scope nuance).

---

## 1. Purpose

Two independent hardening tasks bundled into one spec because they both touch the thread-list / open flow:

- **Part A — Empty-thread cleanup.** When the user starts a new chat or switches to another thread, delete the thread they were on if it never received any messages. Prevents thread-list bloat from the "click new-chat, change mind" flow.
- **Part B — MRU auto-open guard.** When the client auto-opens the most-recent thread on thread-list receipt, skip threads whose harness isn't known to survive resume. This defends against the latent crash in `compat.js:288` (`realProc.pid` on a revived session with no `.process`) that currently requires deleting the offending thread from SQLite to recover.

---

## 2. Current state

### 2a. Empty-thread creation points
- Server's `handleThreadCreate` writes a new entry via `ThreadManager`, which calls `ThreadIndex.insertThread` (`ThreadIndex.js:72-105`) — `messageCount` starts at `0`.
- Client `Sidebar.tsx` "New Thread" button, and the forthcoming chat-header `playlist_add` → CLI picker, both route through `thread:open-assistant` (no existing `threadId` → server creates).
- `messageCount` increments only when messages are recorded via `ThreadManager.js:230, 254`.

### 2b. MRU auto-open site
`thread-handlers.ts:26-46` (client), case `'thread:list'`:

```ts
const hasActive = store.currentThreadIds[scope];
if (!hasActive && msg.threads.length > 0) {
  const mru = msg.threads[0];
  ws.send(JSON.stringify({
    type: 'thread:open-assistant',
    scope,
    threadId: mru.threadId,
  }));
}
```

No filter on the MRU's harness. When the MRU uses a non-Kimi ACP harness (Robin, Codex, etc.), the server's resume path eventually reaches `compat.js:288` which dereferences `.process.pid` on a session that doesn't have `.process` attached, crashing the server.

### 2c. Thread entries carry harness
`ThreadIndex.js:229` hydrates `entry.harnessId` from the `harness_id` column. Typed in `thread/types.js:61`. The client receives this in `thread:list` (via `thread:opened` / `thread:list` payload) — it's available to the MRU auto-open logic.

### 2d. Prior cleanup logic
SPEC-24d ("delete legacy strategies + auto-rename") removed older cleanup strategies. Grep for residual empty-thread-delete logic and either restore or rewrite. If none remains, this spec introduces it fresh.

---

## 3. Part A — Empty-thread cleanup

### 3a. Definition of "empty"
A thread is **empty** when `entry.messageCount === 0`. This is the server-authoritative signal. No client-side heuristics.

- Selecting a CLI (harness) does NOT count as "use" — a thread with `harnessId` set but `messageCount === 0` is still empty.
- A draft in the composer (typed but unsent text) does NOT block cleanup — the text is in local component state only, nothing is persisted. See **Open Question 1** on whether to preserve drafts.

### 3b. Triggers
Cleanup fires when:

1. **New-chat initiated.** User picks a CLI in the chat-header `playlist_add` dropdown (or via the expanded-sidebar "New Thread" button). Before the new thread is created, if the currently-active thread is empty, delete it.
2. **Thread-switch.** User clicks a different thread in the expanded sidebar or in the `subject` thread-jump dropdown. Before the switch lands, if the thread being switched away from is empty, delete it.

Cleanup does NOT fire when:

- The user expands/collapses the sidebar.
- The user refreshes the page (MRU auto-open of an empty thread is legitimate — see Part B).
- The active thread is already non-empty.
- There is no active thread.

### 3c. Scope application
Applies to both `project` and `view` scopes symmetrically. Each scope tracks its own active thread via `currentThreadIds[scope]`; cleanup keyed on the scope of the trigger.

### 3d. Initiation: client-side
The client has the information needed (`messageCount` on the active thread's entry) and already owns both trigger points. Client-side check keeps the server stateless on this decision.

Sequence (new-chat example):

1. User clicks `playlist_add` → picks a CLI.
2. Client checks: is there an active thread, and is its `entry.messageCount === 0`?
3. If yes: send `thread:delete` for the empty thread. Don't wait for the response before sending the new-chat message — `thread:open-assistant` with no `threadId` creates a new one regardless.
4. Send `thread:open-assistant { scope, harnessId, harnessConfig }` to create.
5. Server processes both; client handles `thread:deleted` + `thread:created` in order.

Race tolerance: if `thread:delete` fails on the server (e.g., manager missing), the new thread still gets created. The empty thread persists — acceptable; user can manage it from the sidebar.

### 3e. Thread-switch flow
1. User clicks thread B (not current).
2. Client checks: is the current thread A empty?
3. If yes: send `thread:delete` for A.
4. Send `thread:open-assistant { scope, threadId: B }` to switch.
5. Server processes both.

### 3f. UX
Silent delete. No confirmation — the thread has no messages to lose.

Any subscribers to the thread-list re-render when the server emits `thread:deleted` + the follow-up `thread:list`. The switching-away thread simply won't be in the list afterwards.

---

## 4. Part B — MRU auto-open guard

### 4a. The failure path
1. Server sends `thread:list` on panel activation.
2. Client sees no active thread for scope + list non-empty → picks MRU → sends `thread:open-assistant`.
3. Server's `handleThreadOpenAssistant` → `handleThreadOpen` → resume path for non-Kimi harness.
4. `compat.js:288` dereferences `.process.pid` on a session without `.process` → unhandled crash → server dies.

### 4b. Guard placement
Client side, `thread-handlers.ts:33` block. Cheapest fix, keeps compat.js untouched (per memory: "others ACP (broken); compat.js is safety net; don't touch until server.js decomposed").

### 4c. Whitelist, not blacklist
Skip auto-open unless the MRU thread's `harnessId` is in a **safe-to-auto-resume** set. Today:

```ts
const AUTO_RESUME_SAFE_HARNESSES: ReadonlySet<string> = new Set(['kimi']);
```

Future harnesses join the set only after their resume path is verified.

### 4d. Behavior on skip
If the MRU's harness isn't in the safe set, the client does nothing — the store's `currentThreadIds[scope]` stays `null`, and the user sees whatever the natural "no active thread" UX is for that scope (harness picker inline, or the chat-header `playlist_add` affordance per the chat-header spec).

No toast, no error, no server message. Silent fallback.

### 4e. Missing `harnessId`
If the MRU entry has no `harnessId` (legacy or corrupt entry), treat as unsafe — do not auto-open.

### 4f. Logging
One `console.warn` on skip:

```
[WS] Skipping MRU auto-open: unsafe harness=<harnessId or "(none)"> threadId=<short>
```

---

## 5. Components

### 5a. `thread-handlers.ts` (client) — MRU guard
Add the whitelist constant and the check in the `'thread:list'` case around lines 33-44.

```ts
const AUTO_RESUME_SAFE_HARNESSES: ReadonlySet<string> = new Set(['kimi']);

// ...
if (!hasActive && msg.threads.length > 0) {
  const mru = msg.threads[0];
  const harnessId = mru.entry?.harnessId;
  if (!harnessId || !AUTO_RESUME_SAFE_HARNESSES.has(harnessId)) {
    console.warn(`[WS] Skipping MRU auto-open: unsafe harness=${harnessId ?? '(none)'} threadId=${mru.threadId?.slice(0,8)}`);
    return true;
  }
  // existing auto-open path
}
```

### 5b. `panelStore.ts` — cleanup helper
New action that wraps the "send `thread:delete` if current thread is empty" check:

```ts
/**
 * If the current thread for `scope` exists and has zero messages, send
 * thread:delete for it. Intended to be called just before creating a new
 * thread or switching to another.
 */
cleanupCurrentIfEmpty: (scope: Scope) => void;
```

Reads `currentThreadIds[scope]`, looks up the entry in `threads[scope]`, checks `entry.messageCount === 0`, sends `thread:delete`.

### 5c. Call sites for `cleanupCurrentIfEmpty`

| Location | Trigger |
|----------|---------|
| `CliPickerDropdown.tsx` (from chat-header spec) | Before sending `thread:open-assistant` to create new thread. |
| `Sidebar.tsx` — "New Thread" button handler (`handleCreateThread`) | Same, for the expanded-sidebar path. |
| `Sidebar.tsx` — thread-row click handler | Before switching. |
| `ThreadJumpDropdown.tsx` (from chat-header spec) — thread-row click | Before switching. |
| Floating popup (SPEC-26d) thread-open handler — if it hosts a "new chat" path | Evaluate; likely yes for parity. |

### 5d. No server changes for Part A
Delete uses the existing `thread:delete` handler. Server remains unaware of "empty cleanup" as a distinct concept.

### 5e. No server changes for Part B
The guard is purely client-side. Compat.js stays as-is per migration-state memory.

---

## 6. Interactions with existing flows

### 6a. Auto-rename (SPEC-24d)
Auto-rename happens on first message round-trip. Cleanup fires only when `messageCount === 0` (before any round-trip). No interaction; they're disjoint.

### 6b. Chat-header spec
Part A depends on the `playlist_add` CLI picker path from `CHAT_HEADER_AND_THREAD_OVERLAY_SPEC.md`. That spec §3d notes empty-thread cleanup is deferred — this spec is the "deferred" implementation.

### 6c. Floating popup (SPEC-26d)
View-scope chat is a floating popup. Its "open" action fires `thread:open-assistant` with the MRU. Cleanup-on-switch applies if the popup surfaces a way to pick a different thread.

---

## 7. Open questions

1. **Drafts as "use"?** If the user has typed text in the composer but not sent, should cleanup still fire? Today the composer text lives only in local `ChatInput` state — losing it on cleanup is silent data loss. Options:
   - (a) Cleanup fires regardless. Simple.
   - (b) Track draft presence per thread in the store; skip cleanup if a draft exists.
   - (c) Flush the draft into the about-to-be-deleted thread as a `draft` field so it can be recovered — heavier, probably YAGNI.
2. **View-scope popup cleanup.** Should the floating popup trigger cleanup when it changes thread? The popup's MRU-default model (SPEC-26d) means it can silently land on different threads — possibly surprising for the user to have threads silently deleted behind a closed popup. Lean: apply cleanup consistently; revisit if confusing.
3. **Revive-on-mistake.** Accepted trade-off: cleanup is silent and immediate, with no undo. Confirm this is OK, or do we want a Toast with an undo affordance?
4. **Safe-harness set source of truth.** Hardcoded in client (as above), or fetched from server config so it can be updated without client redeploy? Lean: hardcoded for now; tiny list, client must change anyway when new harnesses ship.
5. **Re-opening a manually-deleted empty thread.** Non-issue — `thread:delete` is the same path whether user-initiated or cleanup-initiated. Confirm there's no divergent client behavior to handle.

---

## 8. Implementation order

1. **Part B first (low risk, stops the latent crash).**
   - Add `AUTO_RESUME_SAFE_HARNESSES` + guard in `thread-handlers.ts`.
   - Smoke test: ensure Kimi MRU auto-opens; non-Kimi MRU is skipped silently.
2. **Part A: cleanup helper.**
   - Add `cleanupCurrentIfEmpty` to `panelStore.ts`.
3. **Part A: wire call sites.**
   - New-chat path (Sidebar "New Thread" + forthcoming `CliPickerDropdown`).
   - Thread-switch path (Sidebar row click + forthcoming `ThreadJumpDropdown`).
4. **Part A: floating popup review.** Audit SPEC-26d handlers; add cleanup if they host eligible triggers.
5. **Grep for prior cleanup logic.** Confirm nothing conflicts with the new path. Remove dead stubs if any survived SPEC-24d.
6. **Manual QA matrix.**
   - Empty thread → new-chat → empty deleted? ✓
   - Empty thread → switch to another → empty deleted? ✓
   - Non-empty thread → new-chat → kept? ✓
   - No active thread → new-chat → no orphan delete attempt? ✓
   - Kimi MRU on panel activation → auto-opens? ✓
   - Robin MRU on panel activation → skipped, no crash? ✓
   - Corrupt entry (missing `harnessId`) MRU → skipped? ✓

---

## 9. Out of scope

- Full compat.js rewrite or server.js decomposition (tracked separately; memory: `project_harness_migration_state.md`).
- Recovering broken non-Kimi threads. Users still have to delete manually or wait for the harness migration.
- Thread-lifecycle semantics beyond empty cleanup (archival, grouping, TTL).
