# Pending New Chat Intent and Signal-Gated Commit — SPEC

**Date:** 2026-09-02
**Status:** Implementation-ready as the New Chat sub-SPEC after the composable-chat group foundation exists.
**Owner:** Fusion Studio chat core.
**Related:** `COMPOSABLE_THREADED_CHAT_SPEC.md` and the current Chat System Wiki.
**Sequence:** Execute inside Composable Chat Slice 3 after the group/member/primary commit primitive exists; do not schedule this document as a prerequisite to that foundation.

---

## 0. Clean-Session Implementation Brief

Clicking **New Chat** creates only a client-memory pending intent. It does not
create a SQLite thread row, Markdown mirror, exchange, provider session, or
durable visible-thread group. The first send starts a server-managed draft
attempt with a bounded recovery journal but no durable chat artifacts.
Fusion commits the new underlying chat session and visible thread only after a
provider emits an explicit committing signal.

This SPEC covers only ordinary New Chat. Moving a current Main Chat into a Side
Chat intentionally creates its new empty Main Chat immediately and is governed
by `MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`, not by this signal-gated pending flow.

---

## 1. Product Contract

1. Clicking New Chat creates a stable `PendingChatIntent.id` in renderer RAM.
2. The pending row and empty composer are selectable without creating durable
   server or provider state.
3. New Chat does not warm or spawn a harness. The provider starts only when the
   user sends from the pending intent.
4. A pending send uses one client-generated `draftId` for that attempt. After
   accepting the request, the server allocates and returns a reserved future
   `threadId`; neither identity implies that the thread has committed.
5. The first explicit provider signal marked `commitsDraft` commits the session.
   A provider session identity may be such a signal even when it carries no
   assistant text.
6. Requests, local acknowledgements, `wire_ready`, synthetic/local
   `turn_begin`, placeholders, warm-up, retry text, and timers never commit.
7. The server owns prompt acceptance, commit, failure, cancellation, and
   terminal state. Frontend timeouts may change display copy only.
8. A pre-commit failure leaves no chat/session/group/exchange row, Markdown
   mirror, or committed provider-session association and preserves a retryable
   composer. A bounded terminal draft-attempt journal row may remain for
   idempotency, crash reconciliation, and retention-controlled diagnostics.
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
15. The pending intent owns its selected model/variant in renderer RAM. First
    send snapshots that portable selection, the server validates and journals
    it, and commit transfers the normalized value to the new session. Provider
    session identity/runtime metadata is a separate server-owned namespace and
    is never accepted from the client as harness configuration.

---

## 2. Identities and State

### 2.1 Pending intent

```ts
type PendingHarnessSelection = {
  model: string | null;
  variant: string | null;
};

type PortableHarnessSelection = {
  model: string;
  variant: string | null;
};

type PendingChatIntent = {
  id: string;
  workspaceId: string;
  viewId: string;
  harnessId: string;
  harnessSelection: PendingHarnessSelection;
  createdAt: number;
  composerText: string;
  attachmentIds: string[];
  status: 'editing' | 'creating' | 'failed';
};
```

`id` is renderer identity for the pending row. It survives browsing among
committed chats within the same workspace/view for the lifetime of the pending
intent, but it is not durable across app refresh.

`model: null` is permitted only while editing and means “use the effective
server default.” Acceptance resolves it to a concrete allowed model and a
compatible nullable variant; `ActiveDraftAttempt.harnessSelection` and every
committed-session acknowledgement carry that normalized result.

### 2.2 Draft attempt

```ts
type ActiveDraftAttempt = {
  draftId: string;
  intentId: string;
  reservedThreadId: string; // allocated by the server after acceptance
  workspaceId: string;
  viewId: string;
  harnessId: string;
  harnessSelection: PortableHarnessSelection; // server-normalized snapshot
  state:
    | 'starting'
    | 'accepted'
    | 'reconcile_required'
    | 'committed_awaiting_turn_end'
    | 'finalized'
    | 'failed'
    | 'cancelled';
};
```

`draftId` scopes exactly one send attempt. The server-allocated
`reservedThreadId` becomes the real session `threadId` only at commit. The
backend owns allocation, terminal attempt state, and idempotency.

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
  "viewId": "...",
  "harnessId": "opencode",
  "harnessConfig": {
    "model": "provider/model-id",
    "variant": "high"
  },
  "userInput": "...",
  "attachments": []
}
```

The server validates the trusted mutation authority established in Composable
Chat Slice 1, its server-bound workspace/view context, harness
policy/capability, model/variant compatibility, idempotency, and payload shape
before starting the transient harness. The only client-accepted
`harnessConfig` keys are `model` and nullable `variant`; provider session IDs,
resume/runtime fields, credentials, unknown keys, and Fork-era fields are
rejected. A missing/null model resolves through the effective server config.
The request cannot assert its own origin, grant, permission, or consent. Prompt
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

`thread:draft:*` is a deliberate new domain family. At first send there is no
durable `threadId`, so ordinary `prompt` cannot address a thread, while
`thread:action` is reserved for actions on an existing group or session. The
existing top-level `thread:*` router still owns dispatch, but it delegates this
family to a focused draft handler/service rather than adding draft lifecycle to
the already broad thread CRUD module. Provider-native committing signals remain
inside adapters and canonical translation.

Required server-to-client messages:

| Message | Meaning |
|---|---|
| `thread:draft:accepted` | Server accepted one attempt; no durable chat exists yet. |
| `thread:draft:committed` | Provider crossed the commit gate and Fusion durably created the session/group. |
| `thread:draft:failed` | Attempt ended before commit; retryable input is returned by correlation, not echoed to logs. |
| `thread:draft:cancelled` | Backend proved the attempt ended without commit. |
| `thread:draft:conflict` | Duplicate/stale request resolved to the authoritative attempt state. |

Required client commands are `thread:draft:send` and
`thread:draft:cancel`. Cancel carries only the draft/intent correlation and
asks the backend to resolve the cancel-versus-commit race; it never declares
the terminal result. Repeated cancel is idempotent and returns the stored
authoritative attempt state.

Both commands consume the exact per-launch Electron/preload/WebSocket
trusted-shell handshake and server-owned workspace binding defined by
`COMPOSABLE_THREADED_CHAT_SPEC.md` §8.4. This sub-SPEC adds no second token,
origin assertion, authentication route, or custom-view bridge; its handler is
unreachable for mutation until the common connection guard succeeds.

Every message carries `workspaceId`, `viewId`, `intentId`, `draftId`, and the
server-allocated `reservedThreadId`/committed `threadId` where applicable. The
client routes by those identities before mutating state.

Repeated `thread:draft:send` with the same `draftId` is idempotent. The server
returns the stored authoritative attempt result and never starts a second
provider process or creates a second thread.

`thread:draft:committed` is the correlated response for the requesting pending
intent. After the same database commit, the server also fans the authoritative
view-bound thread-group/list snapshot through the existing thread-list handler
family to every open window in the workspace. Other windows do not receive the
requester's renderer-only `intentId` as their state owner. A reconnecting client
hydrates the authoritative list normally; delivery failure never replays the
provider action or commit.

Requester delivery, each workspace-recipient delivery, and optional post-commit
UEB publication such as a canonical `thread:created` fact are mutually
failure-isolated. None may gate, roll back, or rewrite the committed result.

Shared client/server protocol types, router registration, handler registration,
and central logging redaction are part of the public route. Provider-native
signals do not appear in product messages.

---

## 5. Commit Gate and Persistence

### 5.1 Before a committing signal

Clicking New Chat remains renderer-RAM-only. On first send, before starting the
external provider, the server creates or reuses one bounded durable
`thread_draft_attempts` journal row:

| Field | Contract |
|---|---|
| `draft_id` | Primary idempotency key supplied by the client attempt. |
| `intent_id` | Correlates the renderer pending intent; not durable thread identity. |
| `reserved_thread_id` | Unique future session ID allocated by the server. |
| `workspace_id` / `view_id` | Authoritative target resolved and validated by the server. |
| `harness_id` | Server-approved adapter identity. |
| `portable_harness_config_json` | Bounded server-normalized `{model, variant}` only. It contains no provider session/runtime identity, credential, or unknown key and is immutable for this `draft_id`. |
| `state` | `starting`, `accepted`, `reconcile_required`, `committed_awaiting_turn_end`, `finalized`, `failed`, or `cancelled`. Session identity is durable at `committed_awaiting_turn_end`; exchange persistence is complete only at `finalized`. |
| `provider_session_id` | Nullable bounded recovery identity; never exposed as product protocol. |
| `failure_code` | Nullable redacted diagnostic code; no prompt/provider payload. |
| timestamps | Created, updated, and nullable terminal timestamps. |

The journal's status row stores no prompt text, attachment bodies, provider
payloads, hidden context, or transcript. It is not a visible thread and does not
participate in thread lists or MRU. A retention policy may remove terminal rows
only after the idempotency/reconciliation window.

Crash-safe completion also requires the exact user submission. In the same
pre-provider transaction, the draft service writes one private
`thread_draft_payloads` row owned by the attempt service:

| Field | Contract |
|---|---|
| `draft_id` | Primary key and foreign key to the attempt. |
| `user_input` | Exact bounded canonical input the user chose to send. |
| `attachments_json` | Exact normalized attachment descriptors needed by the canonical exchange path. |
| `created_at` | Recovery-retention timestamp. |

This payload follows the same local at-rest policy as committed exchange
content, is excluded from list/search/config APIs and every log/redaction
projection, and is never exposed as a recovery-table payload. Before commit no
other window receives it. After commit, the normal authorized active-turn
snapshot may project the accepted user content for that `threadId`; clients
never read `thread_draft_payloads` directly. Any attachment object needed after
restart must already be durable through Fusion's existing attachment owner
before the provider starts; the payload stores its immutable descriptor, not a
second unmanaged copy. The session-identity commit retains this payload.
The canonical terminal/turn-end persistence owner consumes it as the user side
of exactly one exchange and deletes the recovery row when that exchange and the
`finalized` journal state are durable. Failed/cancelled pre-commit settlement
deletes it after the result is fixed. Every nonterminal state, including
`reconcile_required` and `committed_awaiting_turn_end`, retains it so restart can
reproduce the exact accepted turn without asking the provider to invent or echo
user content.

Before a committing signal, do not create:

- a `threads` row;
- a visible thread-group/member/primary-event row;
- an `exchanges` row;
- a Markdown chat mirror;
- a durable provider-session association; or
- an MRU update.

### 5.2 Session-identity commit

The draft commit service consumes the first canonical provider event whose
adapter metadata explicitly says `commitsDraft=true`. It then, idempotently:

1. creates the underlying session through the canonical transaction-capable
   thread manager and inserts its pending mirror-creation journal row in that
   same SQLite transaction, supplying the authoritative new group's
   workspace/view compatibility binding and canonical workspace runtime scope;
2. creates the view-bound visible group, membership, and initial-primary event;
3. stores the immutable journaled `harness_id` and portable `{model, variant}`
   on the new session, then separately stores only the adapter-reported provider
   session binding/runtime metadata; no client field can populate that
   provider-owned namespace;
4. commits no final filesystem mirror inside the SQLite transaction;
5. inserts the initial idempotent group-activity event and updates the group's
   cached rail MRU as durable user activity, without changing `messageCount`;
   and
6. marks the draft-attempt journal `committed_awaiting_turn_end` while retaining
   the private recovery payload;
7. returns `thread:draft:committed` so the requester can install durable
   identity;
8. emits the normal `message:sent` acknowledgement that alone commits the user
   bubble in renderer state; and
9. releases any later buffered live frames only after those two requester
    messages have been queued in that order.

After the structural transaction commits, `ThreadManager` applies the durable
mirror-creation row defined by Composable Chat using its atomic writer. The
`thread:draft:committed` result includes
`mirrorStatus: 'persisted' | 'repair_required'`. Mirror failure cannot undo the
committed provider/session/group identity or start another provider; it leaves
the row pending for startup/workspace-reattach repair. A same-`draftId` retry
returns the same committed identity plus the journal's current mirror status.
No final mirror exists before commit, and a crash after file rename is settled
by the journal rather than inferred from renderer state.

The committing signal creates no `exchanges` row and does not increment
`messageCount`. Canonical turn-end persistence remains the sole owner of those
facts. It reads the retained recovery payload as the accepted user side, joins
it with the canonical assistant/terminal result, writes exactly one exchange,
updates `messageCount` and the Markdown mirror through their existing owners,
marks the attempt `finalized`, and deletes the recovery payload as one
coordinated durable finalization. A missing-reply/error terminal follows that
same path and still produces one standard terminal exchange. Duplicate commit
or terminal signals are idempotent by `draftId`, `threadId`, and canonical turn
identity.

The service must preserve all mirrors and use migrations for any schema change.
It must not reproduce raw thread insertion logic.

Although current storage serializes portable selection and provider binding in
one `harness_config` JSON object, the manager writes them through separate
allowlists. Commit constructs that object from the journaled portable selection
plus the adapter's authoritative provider identity; it never spreads the draft
request object or lets provider metadata overwrite `model`/`variant`. The
commit response includes the normalized selection so the renderer transfers it
from `intentId`-keyed state to the new `threadId`-keyed composer state.

### 5.3 Failure after provider-side creation

If an external provider creates a session but Fusion fails before its durable
commit, update the attempt journal with the bounded provider identity and
`reconcile_required` state when possible. Startup/reconnect recovery examines
only nonterminal journal rows, reloads the exact private recovery payload, asks
the owning adapter only for bounded terminal/session-identity reconciliation,
and either completes the same idempotent local commit or settles the attempt
failed/cancelled. The accepted user turn always comes from Fusion's recovery
payload, never provider transcript scraping. Do not expose a half-created
thread. The retry/reconciliation path must not start another provider session
until the first attempt's terminal state is known. If an adapter cannot
reconcile an external session, surface a terminal recoverable failure, delete
the recovery payload after settlement, and require an explicit new attempt;
never guess that the old provider session is safe to reuse.

### 5.4 Failure after local commit but before turn end

An attempt in `committed_awaiting_turn_end` is a durable visible session with an
accepted pending turn, not a completed exchange. Startup/reconnect recovery
reads the private recovery payload server-side and exposes the pending accepted
turn only through the normal authorized active-turn snapshot for the committed
`threadId`, never from `exchanges` or a draft-payload API. It asks the owning
adapter to resume or reconcile the same provider session. A recovered canonical
terminal finalizes exactly one exchange through §5.2. If the adapter can prove
only that the session ended without a reply, Fusion finalizes the standard
missing-reply/error exchange. It never starts a second provider session or
writes a provisional user-only exchange.

### 5.5 Markdown

SQLite remains canonical chat storage. The generated Markdown file is a
required compatibility/audit mirror owned by `ThreadManager`. Provisional
assistant output never writes transcript content before canonical turn-end.
Session-identity commit may create the required empty compatibility file; the
terminal persistence owner writes its first exchange content and later rebuilds
from SQLite when needed. Record the existing markdown-sync status in the
session's Fusion-owned harness metadata.

---

## 6. Runtime and Rendering

- The transient starter is separate from committed-thread
  `spawnThreadWire()`/resume behavior.
- Canonical provider translation preserves `commitsDraft`; compatibility
  bridges must not drop the flag.
- Provider status before commit may be shown only as transient pending-row
  status. It is not transcript content.
- The pending composer model/variant is keyed by `intentId`; after commit the
  acknowledged normalized selection moves to `threadId`-keyed state. It is
  never stored under a panel/view-only key that another mounted chat can mutate.
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
- Successful session-identity commit is durable user activity and updates the
  group-owned rail timestamp through its initial activity event; only canonical
  turn-end changes `messageCount`.
- For every later prompt on a committed session, server-owned prompt acceptance
  inserts the canonical-turn group-activity event before `message:sent` or
  provider dispatch. Duplicate acceptance is idempotent; failure restores the
  prompt and does not reorder the rail. Saved-turn/session timestamps never
  replace the group row as the visible-list owner.
- Warm/resume/runtime activation is not MRU activity.

---

## 8. Vertical Implementation Slices

### Slice 1 — RAM-only New Chat

Create/select/dismiss a pending row through the public New Chat UI. Prove no
server request, SQLite row, group row, Markdown file, provider process, or MRU
write occurs on click. Prove view/workspace identity stays explicit and two
pending/committed composers do not share panel-keyed model/variant state.

### Slice 2 — Pre-commit draft route

Send through `thread:draft:send`, validate adapter capability and authority,
create/reuse the bounded attempt journal, allocate the reserved ID on the
server, validate and persist the normalized portable model/variant beside the
private recovery payload through their owning services, start
the transient harness, and render accepted/failure status. Prove a pre-commit
failure or cancel leaves no durable chat artifacts, preserves retryable input,
deletes the terminal recovery payload, and leaves only the retention-controlled
terminal journal row. Prove an uncredentialed/raw socket, custom view, harness
child, wrong-workspace connection, or request-supplied provenance/grant cannot
create the attempt journal or start the provider.

### Slice 3 — Signal-gated commit

Pass one real/fake committing provider signal through translation, the commit
service, thread manager, group persistence, durable mirror-creation journal and
atomic writer, MRU, WebSocket response, and renderer hydration. Then pass canonical turn-end through
the existing exchange/Markdown/count owner. Prove duplicate signals and
requests create exactly one visible thread and session and exactly one exchange
only after turn-end. Prove the committed session and acknowledgement contain
the journaled model/variant plus the adapter's provider identity in separate
allowlisted namespaces, with no client-supplied provider field accepted.

### Slice 4 — Navigation and terminal races

Exercise browse-away/late-commit, abandon/cancel-versus-commit, send-elsewhere,
provider failure, and committed missing-reply behavior through the public UI and
restart/readback. Inject process loss after provider-side session creation and
prove journal-driven reconciliation neither loses the authoritative result nor
starts a second provider session. Prove no late result steals focus or mutates
another composer.

### Slice 5 — Cleanup and end-to-end acceptance

Remove eager-create bypasses, stale global pending state, duplicate MRU writers,
and compatibility routes that can create an empty durable ordinary New Chat on
click. Run server tests, client build/focused tests, and the Electron acceptance
walk.

---

## 9. Required Verification

- New Chat click is RAM-only.
- Unsupported/disabled harnesses cannot start a pending draft.
- A non-default pending model/variant is snapshotted by `intentId`, validated
  against server policy, stored immutably on the attempt, used for the provider
  call, and transferred to the committed session/`threadId` composer state.
  A null model resolves to a concrete allowed default; an invalid model/variant
  fails before provider start or durable chat creation.
- Draft `harnessConfig` rejects provider session IDs, runtime/resume/credential
  fields, Fork-era fields, and unknown keys. Commit combines only the journaled
  portable selection with adapter-owned provider identity, and neither
  namespace overwrites the other.
- Only a server-verified trusted-shell action can start a draft in this SPEC.
  Automation origin remains disabled. Raw sockets, custom views/iframes,
  harness children, stale credentials, wrong-workspace connections, and
  client-asserted origin/grant fields fail before journal or provider creation.
- `wire_ready`, local/synthetic events, timers, and status text do not commit.
- The first declared committing signal creates exactly one session, visible
  group, membership, primary event, and empty Markdown mirror, but zero
  exchanges and no message-count increment.
- The following canonical terminal/turn-end writes exactly one exchange,
  increments message count once, finalizes the journal, updates the Markdown
  mirror, and deletes the private recovery payload. Duplicate commit or terminal
  delivery changes none of those cardinalities.
- Pre-commit error/cancel creates none of those artifacts.
- Duplicate send/signal delivery is idempotent.
- Prompt acceptance and the user bubble remain server-owned.
- Missing assistant content after commit ends visibly and remains durable.
- Process death after SQLite commit/before mirror write and after atomic
  no-clobber mirror install/before journal acknowledgement returns the same
  committed identity on retry and repairs exactly one mirror. No precommit
  final mirror or ambiguous
  orphan is silently adopted or deleted.
- Fail the initial empty-mirror write, allow canonical turn-end to write the
  nonempty transcript under the shared mirror lease, then run startup repair:
  the creation row becomes applied and the transcript bytes remain unchanged.
- Navigation and cancellation races settle from backend truth.
- Late commit updates the correct view without stealing focus.
- The requester receives correlated commit then `message:sent` before later live
  frames; another open window receives the authoritative group/list update
  without receiving renderer-local pending intent state.
- Injected requester-send, individual-recipient, and optional UEB failures do
  not prevent remaining delivery attempts or change committed state; reconnect
  hydration converges without repeating provider work.
- Process loss after provider-side session creation recovers from the bounded
  journal plus exact private submission payload, or terminates visibly without
  starting a duplicate provider session. Recovery never reconstructs the user
  turn from provider transcript output.
- Canonical post-commit finalization or pre-commit failure/cancel removes the
  private recovery payload at the specified boundary; all nonterminal states,
  including `committed_awaiting_turn_end`, retain it and no logs, thread lists,
  search results, or direct recovery API expose it. After commit, authorized
  windows see the accepted turn only through the ordinary thread snapshot.
- Process loss after local session commit but before turn-end restores the
  accepted pending turn from the journal/payload, never from `exchanges`, and
  finalizes or visibly terminates it without a duplicate exchange or provider
  session.
- Message count and MRU follow their single-owner policies.
- After migration, accepting a prompt in an older committed group creates one
  canonical-turn activity event and advances the group-owned rail MRU before
  provider dispatch; duplicate acceptance, finalization, and session timestamp
  compatibility writes do not advance it again.
- Restart hydrates the committed thread and never resurrects RAM-only intent.
- Two mounted committed chats and one pending intent retain independent
  model/variant menus and next-prompt selections; no panel/view-only key leaks
  one selection into another.
- Logs do not expose prompts, attachments, provider payloads, or secrets.

---

## 10. Out of Scope

- Move Chat to Side Chat and Side Chat tabs (owned by
  `MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`);
- automatic naming and attachment-aware names/icons;
- folders, tags, custom collections, and configurable New labels;
- templates, CWD overrides, per-view instructions, and launch recipes;
- automation-origin creation and its future server-stored grant model;
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
