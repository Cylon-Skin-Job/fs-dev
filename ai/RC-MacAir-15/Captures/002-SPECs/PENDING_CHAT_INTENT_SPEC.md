# Pending New Chat Intent and Signal-Gated Commit — SPEC

**Date:** 2026-09-02
**Status:** Implementation-ready for New Chat.
**Owner:** Fusion Studio chat core.
**Related:** `COMPOSABLE_THREADED_CHAT_SPEC.md` and the current Chat System Wiki.

---

## 0. Clean-Session Implementation Brief

Clicking **New Chat** creates only a client-memory pending intent. It does not
create a SQLite thread row, Markdown mirror, exchange, provider session, or
durable visible-thread group. The first send starts a transient draft attempt.
Fusion commits the new underlying chat session and visible thread only after a
provider emits an explicit committing signal.

This SPEC covers only ordinary New Chat. Moving a current primary chat into a
side tab intentionally creates its new empty primary immediately and is governed
by `COMPOSABLE_THREADED_CHAT_SPEC.md`.

---

## 1. Product Contract

1. Clicking New Chat creates a stable `PendingChatIntent.id` in renderer RAM.
2. The pending row and empty composer are selectable without creating durable
   server or provider state.
3. New Chat does not warm or spawn a harness. The provider starts only when the
   user sends from the pending intent.
4. A pending send uses one `draftId` for that attempt and a reserved future
   `threadId`; neither implies that the thread has committed.
5. The first explicit provider signal marked `commitsDraft` commits the session.
   A provider session identity may be such a signal even when it carries no
   assistant text.
6. Requests, local acknowledgements, `wire_ready`, synthetic/local
   `turn_begin`, placeholders, warm-up, retry text, and timers never commit.
7. The server owns prompt acceptance, commit, failure, cancellation, and
   terminal state. Frontend timeouts may change display copy only.
8. A pre-commit failure leaves no SQLite row, Markdown mirror, visible-thread
   group, or provider-session association and preserves a retryable composer.
9. After commit, normal chat lifecycle rules apply: `message:sent` owns the user
   bubble, saved exchanges own message count, and terminal events own completion.
10. If the provider commits but returns no visible assistant content, Fusion
    persists the committed thread and renders the standard missing-reply/error
    terminal state. It must not erase the accepted user turn.
11. A late commit after the user browses elsewhere adds the committed row but
    does not steal focus.
12. Existing durable chats continue through the normal Send path.
13. Only harness adapters that explicitly declare support for this signal-gated
    draft contract may be offered for pending New Chat. OpenCode is the first
    target; fake adapters may be used in tests.
14. Thread-list ordering and durable `updated_at` change together under one MRU
    policy. Passive viewing, warming, or runtime resume is not user activity.

---

## 2. Identities and State

### 2.1 Pending intent

```ts
type PendingChatIntent = {
  id: string;
  workspaceId: string;
  viewId: string;
  harnessId: string;
  createdAt: number;
  composerText: string;
  attachmentIds: string[];
  status: 'editing' | 'creating' | 'failed';
};
```

`id` is renderer identity for the pending row. It survives browsing among
committed chats within the same workspace/view for the lifetime of the pending
intent, but it is not durable across app refresh.

### 2.2 Draft attempt

```ts
type ActiveDraftAttempt = {
  draftId: string;
  intentId: string;
  reservedThreadId: string;
  workspaceId: string;
  viewId: string;
  harnessId: string;
  state: 'starting' | 'accepted' | 'committed' | 'failed' | 'cancelled';
};
```

`draftId` scopes exactly one send attempt. `reservedThreadId` becomes the real
session `threadId` only at commit. The backend owns terminal attempt state and
idempotency.

### 2.3 Visible-thread attachment

Under `COMPOSABLE_THREADED_CHAT_SPEC.md`, a committed ordinary New Chat creates:

- one underlying session through the canonical thread manager;
- one visible thread group bound to the immutable `viewId`;
- one ordinal-1 membership row; and
- one initial primary event.

These records commit together through the owning commit service. Before that
boundary, none of them exist.

---

## 3. User Experience

### 3.1 New Chat click

The client:

1. verifies that the server supplied an enabled/default harness with declared
   signal-gated draft support;
2. creates a RAM-only pending intent;
3. shows/selects the pending row in the active view's thread rail; and
4. focuses an empty composer.

No WebSocket create/open request is sent merely because the button was clicked.

### 3.2 First send

The client snapshots the exact pending intent, text, and attachment IDs and
sends a canonical draft request:

```json
{
  "type": "thread:draft:send",
  "draftId": "...",
  "intentId": "...",
  "reservedThreadId": "...",
  "viewId": "...",
  "harnessId": "opencode",
  "userInput": "...",
  "attachments": []
}
```

The server validates workspace/view authority, harness policy/capability,
idempotency, and payload shape before starting the transient harness. Prompt
and attachment content use the existing central redaction policy.

### 3.3 Navigation and abandonment

- Browsing an existing committed chat does not by itself abandon an editing
  pending intent.
- Creating another New Chat, switching workspace, refreshing, or explicitly
  dismissing the pending row abandons an editing intent.
- Abandoning an active `creating` attempt sends cancellation and waits for the
  backend's committed-versus-cancelled resolution.
- Sending on another committed chat while a draft is creating must resolve that
  same race before the other prompt is accepted.
- A committed result that arrives after navigation updates the correct view's
  list but never changes the user's current selection.

---

## 4. Server Protocol

Required server-to-client messages:

| Message | Meaning |
|---|---|
| `thread:draft:accepted` | Server accepted one attempt; no durable chat exists yet. |
| `thread:draft:committed` | Provider crossed the commit gate and Fusion durably created the session/group. |
| `thread:draft:failed` | Attempt ended before commit; retryable input is returned by correlation, not echoed to logs. |
| `thread:draft:cancelled` | Backend proved the attempt ended without commit. |
| `thread:draft:conflict` | Duplicate/stale request resolved to the authoritative attempt state. |

Every message carries `workspaceId`, `viewId`, `intentId`, `draftId`, and
`reservedThreadId`/committed `threadId` where applicable. The client routes by
those identities before mutating state.

Repeated `thread:draft:send` with the same `draftId` is idempotent. The server
returns the stored authoritative attempt result and never starts a second
provider process or creates a second thread.

Shared client/server protocol types, router registration, handler registration,
and central logging redaction are part of the public route. Provider-native
signals do not appear in product messages.

---

## 5. Commit Gate and Persistence

### 5.1 Before a committing signal

Allowed state is transient attempt/runtime state only. Do not create:

- a `threads` row;
- a visible thread-group/member/primary-event row;
- an `exchanges` row;
- a Markdown chat mirror;
- a durable provider-session association; or
- an MRU update.

### 5.2 Commit

The draft commit service consumes the first canonical provider event whose
adapter metadata explicitly says `commitsDraft=true`. It then, idempotently:

1. creates the underlying session through the canonical thread manager;
2. creates the view-bound visible group, membership, and initial-primary event;
3. stores the provider session identity/harness configuration;
4. persists the accepted user turn through the normal exchange path;
5. creates/rebuilds the Markdown mirror through the thread manager;
6. updates message count and MRU under their existing owners; and
7. returns `thread:draft:committed` before normal live frames continue.

The service must preserve all mirrors and use migrations for any schema change.
It must not reproduce raw thread insertion logic.

### 5.3 Failure after provider-side creation

If an external provider creates a session but Fusion fails before its durable
commit, record only bounded recovery diagnostics needed to reconcile the
attempt. Do not expose a half-created thread. The retry/reconciliation path must
be idempotent and must not start another provider session until the first
attempt's terminal state is known.

### 5.4 Markdown

SQLite remains canonical chat storage. The generated Markdown file is a
required compatibility/audit mirror owned by `ThreadManager`. Provisional
assistant output never writes a durable mirror before commit. After commit,
rebuild from SQLite when needed and record the existing markdown-sync status in
the session's Fusion-owned harness metadata.

---

## 6. Runtime and Rendering

- The transient starter is separate from committed-thread
  `spawnThreadWire()`/resume behavior.
- Canonical provider translation preserves `commitsDraft`; compatibility
  bridges must not drop the flag.
- Provider status before commit may be shown only as transient pending-row
  status. It is not transcript content.
- After commit, every live frame routes by the committed `threadId` and existing
  `turnId + streamSeq` rules.
- A session identity can commit the thread without rendering an assistant
  bubble. Visible content still requires canonical content/tool/status events.
- Backend terminal events, not frontend timers, decide failed/cancelled/missing
  reply state and whether composer text is restored.

---

## 7. MRU and Counts

- `messageCount` means saved exchange/turn count, never individual role-message
  count.
- Exchange persistence is the write owner for message count.
- Repair legacy counts from `exchanges` before showing mixed old/new lists.
- New Chat click and passive browse do not update MRU.
- Successful draft commit is durable user activity and updates the rail and
  SQLite timestamp together.
- Warm/resume/runtime activation is not MRU activity.

---

## 8. Vertical Implementation Slices

### Slice 1 — RAM-only New Chat

Create/select/dismiss a pending row through the public New Chat UI. Prove no
server request, SQLite row, group row, Markdown file, provider process, or MRU
write occurs on click. Prove view/workspace identity stays explicit.

### Slice 2 — Pre-commit draft route

Send through `thread:draft:send`, validate adapter capability and authority,
start the transient harness, and render accepted/failure status. Prove a
pre-commit failure or cancel leaves no durable artifacts and preserves retryable
input.

### Slice 3 — Signal-gated commit

Pass one real/fake committing provider signal through translation, the commit
service, thread manager, group persistence, exchange storage, Markdown mirror,
MRU, WebSocket response, and renderer hydration. Prove duplicate signals and
requests create exactly one visible thread and session.

### Slice 4 — Navigation and terminal races

Exercise browse-away/late-commit, abandon/cancel-versus-commit, send-elsewhere,
provider failure, and committed missing-reply behavior through the public UI and
restart/readback. Prove no late result steals focus or mutates another composer.

### Slice 5 — Cleanup and end-to-end acceptance

Remove eager-create bypasses, stale global pending state, duplicate MRU writers,
and compatibility routes that can create an empty durable ordinary New Chat on
click. Run server tests, client build/focused tests, and the Electron acceptance
walk.

---

## 9. Required Verification

- New Chat click is RAM-only.
- Unsupported/disabled harnesses cannot start a pending draft.
- `wire_ready`, local/synthetic events, timers, and status text do not commit.
- The first declared committing signal creates exactly one session, visible
  group, membership, primary event, accepted exchange, and Markdown mirror.
- Pre-commit error/cancel creates none of those artifacts.
- Duplicate send/signal delivery is idempotent.
- Prompt acceptance and the user bubble remain server-owned.
- Missing assistant content after commit ends visibly and remains durable.
- Navigation and cancellation races settle from backend truth.
- Late commit updates the correct view without stealing focus.
- Message count and MRU follow their single-owner policies.
- Restart hydrates the committed thread and never resurrects RAM-only intent.
- Logs do not expose prompts, attachments, provider payloads, or secrets.

---

## 10. Out of Scope

- Move Chat to Side Chat and side-chat tabs (owned by the composable chat SPEC);
- automatic naming and attachment-aware names/icons;
- folders, tags, custom collections, and configurable New labels;
- templates, CWD overrides, per-view instructions, and launch recipes;
- Create Project, Project Viewer provisioning, and project/content folder or
  starter-file creation; New Chat consumes an existing registered view context
  and does not perform those operations;
- transcript export and automatic context summaries; and
- new provider adapters beyond declaring/testing the generic capability seam.

---

## 11. No Open Decisions

The New Chat behavior needed for implementation is resolved. A newly discovered
choice that changes commit timing, persistence, provider capability policy,
failure visibility, or focus behavior returns to the owner. Ordinary internal
details remain with the builder inside the standards above.
