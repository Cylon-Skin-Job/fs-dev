# Pending Chat Intent and Signal-Gated Commit - Spec

**Status:** Implementation-ready.
**Owner:** Fusion Studio chat core.
**Related:** `CHAT_HEADER_AND_THREAD_OVERLAY_SPEC.md`, `THREAD_LIFECYCLE_SPEC.md`,
historical `archive/THREAD_LIFECYCLE_HARDENING_SPEC.md`, historical
`archive/OPENCODE_THREAD_FORK_SPEC.md`.

---

## 0. Clean Session Implementation Brief

This spec is self-contained and authoritative for New Chat, Fork, first-send
commit, provider failure, missing-reply rendering, and MRU timing.

A clean implementation session should assume the current code still contains the
old eager-persistence paths. Do not preserve those paths for the user-facing New
Chat or composer Fork flows. Replace or narrow them as each vertical slice lands.

Authoritative behavior:

- New Chat click creates only a frontend RAM pending intent.
- Composer Fork click creates only a frontend RAM pending fork intent.
- No SQLite thread row, markdown file, exchange row, OpenCode fork record, or
  durable Fusion/provider session association is persisted until the first
  pending-intent send crosses the commit boundary. A transient provider process
  may exist during `thread:draft:send`, but it is not durable state.
- The commit boundary is the first committing provider signal, including a
  provider session identity such as OpenCode `sessionID`.
- A provider session identity commits the thread but does not by itself render
  assistant content.
- `wire_ready`, synthetic/local `turn_begin`, request acknowledgements, warm-up,
  placeholders, and retry/status text do not commit.
- Existing durable threads continue to use normal Send. Do not add special
  `Continue`, `Recover`, `Resend`, or `Retry` composer modes.
- Do not prewarm or spawn a harness when the user clicks New Chat or Fork. The
  provider starts only when the user sends from the pending intent.
- `spawnThreadWire()` remains a committed-thread primitive. Do not make it run
  double duty for pending drafts.
- Pending draft send uses a transient harness starter with a reserved future
  `threadId`. That id is passed to the harness if the harness needs a thread
  identity, but it is not inserted into SQLite until the commit boundary.
- Opening/browsing an existing thread does not abandon a pending intent.
- New Chat, Fork, Send on another chat, workspace switch, and refresh abandon a
  pending intent. If the pending intent is already in `creating` state, these
  actions must also cancel the active backend draft attempt.
- If a pending draft commits after the user browsed away, the committed row is
  added and the pending row is removed, but focus stays where the user moved it.
- If the user sends on another committed thread while a pending draft is
  `creating`, the server resolves draft cancel-vs-commit before accepting the
  committed-thread prompt.
- Backend terminal state is authoritative for active draft attempts. Frontend
  timers may change display copy, but only backend `thread:draft:*` or committed
  turn events may fail, cancel, commit, restore composer text, or finalize a
  missing reply.
- The first production implementation is harness-gated. A harness may use
  pending draft send only after its adapter declares support for the
  signal-gated draft contract and emits explicit `commitsDraft` metadata.
  OpenCode is the first target adapter; fake harnesses may be used for tests.
- Pending UI selection uses stable `PendingChatIntent.id`/`intentId`. `draftId`
  is only for one active send attempt and `thread:draft:*` protocol events.
- The client must receive server-owned `draftHarness` readiness/default data
  before it can enable pending New Chat.
- `messageCount` means exchange/turn count, not individual role-message count.
- Exchange persistence owns `messageCount`; legacy counts must be repaired from
  the `exchanges` table before mixed old/new thread lists are shown.
- Canonical draft events have a fixed provider-neutral schema and the bridge
  must preserve draft commit fields instead of dropping unknown properties.
- Provisional draft turns rebuild markdown from SQLite; dirty markdown state is
  stored under `harness_config.fusion.markdownSyncStatus`.
- Thread-list visual reorder and SQLite `updated_at` writes must happen at the
  same time.
- Passive viewing MRU is delayed; durable user activity MRU is immediate;
  runtime activation/resume/warm is not MRU.

Current code hazards to keep in mind before editing:

- `fusion-studio-client/src/state/panelStore.ts` currently sends
  `thread:open-assistant` from `selectHarness()` and
  `createDefaultAssistantThread()`. Those are the visible New Chat paths and
  must become pending-intent actions.
- `fusion-studio-client/src/components/chat/useChatArea.ts` currently has a
  programmatic `fusion:chat-action` path with `target: 'new'` that waits for
  `thread:opened` and then sends. That path must also use pending intent /
  `thread:draft:send`; otherwise tools can still create empty durable threads.
- `fusion-studio-client/src/components/chat/useComposerForkAction.ts` currently
  sends `thread:fork` on click. Composer Fork must not send a WebSocket request
  on click.
- `fusion-studio-client/src/lib/ws/thread-handlers.ts` currently auto-opens the
  MRU thread when `currentThreadId` is null. Pending targets intentionally have
  no real `currentThreadId`, so auto-open must check `activeChatTarget`.
- `fusion-studio-client/src/config/harness.ts` currently filters selectable
  harnesses by enabled/install status only. Pending New Chat must also require
  `supportsSignalGatedDraft` and a server-owned default.
- `fusion-studio-server/lib/ws/thread-ws-handlers.js` currently routes
  `thread:fork` to click-time persistent fork creation. Remove or narrow that
  composer path.
- `fusion-studio-server/lib/thread/thread-crud.js` currently treats
  `thread:open-assistant` as create-or-resume. Preserve committed-thread resume,
  but do not use this as the New Chat creation path.
- `fusion-studio-server/lib/thread/thread-crud.js`,
  `thread-messages.js`, `ThreadManager.js`, and `ThreadIndex.js` currently have
  multiple MRU writers. They must be classified under one MRU policy.
- `fusion-studio-server/lib/thread/thread-runtime-controller.js` currently calls
  `handleMessageSend()` before provider output. Pending draft send needs a
  separate signal-gated path.
- `fusion-studio-server/lib/harness/opencode/index.js` captures OpenCode
  `sessionID`, but the universal applier does not currently receive it as a
  canonical non-rendering commit signal. Add that explicitly.
- `fusion-studio-client/src/components/MessageList.tsx` renders completed
  assistant chrome from assistant messages and segments. Missing replies must be
  represented by metadata/chrome, not by assistant text.
- Existing tests intentionally encode old behavior. Replace or invert those
  assertions as part of the vertical slices.

Related specs contain historical designs. If they conflict with this file, this
file wins. In particular:

- `archive/THREAD_LIFECYCLE_HARDENING_SPEC.md` Part A describes historical
  empty-thread cleanup. This flow supersedes that by preventing empty New
  Chat/Fork rows from being created.
- `archive/OPENCODE_THREAD_FORK_SPEC.md` contains historical click-time
  pending-fork design. Keep only the OpenCode
  `--session <sourceSessionId> --fork` mechanics and session-id cautions;
  implement fork persistence through this spec.

---

## 1. Purpose

New Chat and Fork should not create durable chat records until the user sends a
message and the harness returns a committing provider signal.

This replaces two brittle behaviors:

- empty persisted New Chat rows that must later be cleaned up
- persisted pending fork threads that can drift from their source thread before
  first send

The new model is a single RAM-only pending chat intent per browser/app
connection, across all workspaces. It is user-visible while the app is open,
but it is not written to SQLite, markdown, or provider state until commit.

---

## 2. Core Rules

1. Only one pending chat intent may exist at a time per browser/app connection,
   across all workspaces.
2. Pending chat intent lives in frontend RAM only.
3. New Chat creates a pending intent, not a server thread.
4. Fork creates a pending intent, not a server fork.
5. Sending from the pending intent starts a signal-gated commit attempt.
6. The commit attempt becomes durable only after the harness returns a
   committing provider signal.
7. If no committing provider signal arrives, nothing is saved.
8. New Chat, Fork, Send on another chat, workspace switch, and refresh abandon
   the pending intent. If a draft commit attempt is active, abandonment sends a
   draft cancel request and the backend stops the transient runtime if commit has
   not already won the race.
9. Opening or browsing another existing thread does not abandon the pending
   intent by itself.
10. Existing committed threads remain normal durable threads.
11. Thread-list MRU order and SQLite MRU writes must happen at the same time.
12. The composer action remains normal Send. Do not add `Continue`, `Recover`,
    `Resend`, or `Retry` button modes for this flow.
13. Programmatic chat actions that target a new chat follow the same rules as the
    visible New Chat button.
14. `spawnThreadWire()` is only for committed threads with existing SQLite rows.
15. Pending draft send must not fake a committed thread row to satisfy existing
    runtime APIs.
16. The server is the only authority for active draft terminal states:
    committed, failed, cancelled, or committed-with-missing-reply.
17. Pending draft send is disabled for harnesses that do not explicitly support
    the signal-gated draft contract.

The abandonment rule is intentional: if the user sends somewhere else, their
unsent New Chat or Fork intent is treated as abandoned work.

---

## 3. Terms

### Pending Chat Intent

A local-only draft chat object:

```ts
type PendingChatIntent = {
  id: string;
  workspaceId: string;
  kind: 'new' | 'fork';
  title: string;
  harnessId: string;
  text: string;
  status: 'draft' | 'creating' | 'cancelling' | 'commit_failed' | 'commit_error';
  activeDraftId?: string;
  lastFailedDraftId?: string;
  lastFailure?: DraftFailure;
  createdAt: number;
  listUpdatedAt: number;
  sourceThreadId?: string;
  sourceThreadName?: string;
};
```

Client stores that support pending chat must also keep a short-lived terminal
mapping for active/cancelling attempts whose visible pending row may already have
been removed:

```ts
type RecentDraftAttempt = {
  draftId: string;
  intentId: string;
  workspaceId: string;
  kind: 'new' | 'fork';
  title: string;
  harnessId: string;
  sourceThreadId?: string;
  createdAt: number;
  abandonedAt?: number;
  abandonReason?: 'new_chat' | 'fork' | 'send_elsewhere' | 'workspace_switch' | 'workspace_close' | 'refresh' | 'client_disconnect';
  selectedTargetAtAbandon?: ChatTarget | null;
  status: 'creating' | 'cancelling' | 'committed' | 'failed' | 'cancelled' | 'commit_error';
  terminalThreadId?: string;
};
```

`sourceThreadId` and `sourceThreadName` exist only for fork intents.

`PendingChatIntent.id` is a stable frontend UI identity for the pending row.
`draftId` is a server protocol identity for one send attempt. They are not the
same thing.

Draft attempt rules:

- Each click of Send from a pending intent creates a new `draftId`.
- While the attempt is active, store that id in `activeDraftId`.
- If the attempt fails before commit, set `status: "commit_failed"`, clear
  `activeDraftId`, store the failed id in `lastFailedDraftId`, and keep the
  editable `text`.
- If the provider accepted the prompt but Fusion fails during commit
  persistence, set `status: "commit_error"`, clear `activeDraftId`, store the
  failure in `lastFailure`, and do not restore the text as an editable retry.
  This is a terminal local persistence error, not a recoverable draft send.
- A later Send from the same pending intent must use a new `draftId`, even if
  the text is unchanged. Reusing `lastFailedDraftId` would replay the server's
  terminal failure by design.
- Server idempotency is scoped to one `draftId` send attempt. It is not the
  retry mechanism for a failed pending intent.
- If the user edits the text after `commit_failed`, keep the same
  `PendingChatIntent.id`, clear `lastFailure`, set `status: "draft"`, and use a
  new `draftId` on the next send.
- When a `creating` pending intent is abandoned, move its active attempt into
  the workspace-routed `recentDraftAttempts` map before removing the visible
  pending row.
- The visible `PendingChatIntent` is connection-global. A workspace switch
  abandons and removes it; do not preserve one pending intent per workspace.
- Recent terminal-attempt records are workspace-routed. Stores may keep
  `recentDraftAttempts` in per-workspace buckets or include `workspaceId` in the
  key, but lookups must not be keyed by bare `draftId` alone once multiple
  workspaces can be open.
- Keep `recentDraftAttempts` entries until a terminal
  `thread:draft:committed`, `thread:draft:failed`, or `thread:draft:cancelled`
  is handled, then retain the terminal record for five minutes for duplicate
  terminal replay before pruning.
- Late terminal events for unknown `draftId` values are ignored after logging;
  they must not create pending UI or steal focus.
- Late terminal events for known `draftId` values must be routed to the
  attempt's `workspaceId`, not the workspace currently visible in the client.

Typed failure shape used by client state:

```ts
type DraftFailure = {
  code: string;
  message: string;
  recoverable: boolean;
  restoreComposer: boolean;
  phase: 'validation' | 'pre_commit' | 'commit' | 'cancel';
};
```

### Connection Identity

`connectionId` is a server-owned internal identity for one WebSocket connection.

Rules:

- The server assigns one `connectionId` when the WebSocket session is created.
- `connectionId` is stable for that socket lifetime and is not reused after the
  socket closes.
- `connectionId` is not a durable user/session id and does not need to be
  exposed to the browser protocol.
- Services that key owner-local state must key by `session.connectionId`, not by
  the `ws` object itself. `wsState` or equivalent may map
  `connectionId -> ws/session` for delivery.
- Active draft attempts, recent terminal replay records, owner-only
  `thread:draft:*` delivery, passive MRU timers, and connection-close cleanup
  all use `connectionId` as the owner key.
- Reconnect creates a new `connectionId`. Pre-commit draft attempts are not
  resumed across reconnect. If commit won before disconnect, the durable thread
  is recovered through normal `thread:list`/`thread:open` hydration.

### Draft Workspace Authority

The server freezes draft workspace authority at `thread:draft:send` acceptance.

Accepted draft attempts store:

```ts
type DraftWorkspaceContext = {
  workspaceId: string;
  projectRoot: string;
  threadManager: ThreadManager;
  threadIndex: ThreadIndex;
  scopeContext: object;
};
```

Rules:

- The server resolves `DraftWorkspaceContext` from the request's validated
  `workspaceId` and server workspace registry before emitting
  `thread:draft:accepted`.
- All validation, reserved id generation, fork snapshot reads, commit
  transaction writes, markdown rebuilds, `thread:list` broadcasts, and late
  terminal frame routing use the frozen `DraftWorkspaceContext`.
- Draft commit must not read mutable fields such as
  `session.currentWorkspaceId`, `session.projectRoot`, or the current
  `ThreadWebSocketHandler.manager` after acceptance to decide where to write.
- If the owner connection later switches workspace, workspace switch still sends
  or implies cancellation for the origin draft. The accepted draft attempt
  remains attached to the original `DraftWorkspaceContext` only for resolving
  that cancel-vs-commit race. If commit wins the race, the late commit writes to
  the origin workspace and broadcasts only to that workspace's subscribers. If
  cancel wins, no durable state is written.
- If the origin workspace is closed/unregistered before the commit latch, cancel
  the pre-commit draft with `thread:draft:cancelled` using
  `reason: "workspace_close"` when the owner connection can still receive it,
  and write nothing durable.
- If workspace close arrives after the commit latch but before commit
  persistence completes, cancellation cannot win. Continue the commit using the
  frozen `DraftWorkspaceContext`; if persistence succeeds, the durable thread
  remains in that workspace's storage and broadcasts only to still-subscribed
  clients. If persistence fails because the workspace storage is no longer
  writable/available, emit `provider_commit_persistence_failed` and leave no
  partial SQLite rows.
- If commit already succeeded before workspace closure, the durable thread
  remains in that workspace's storage.

### Client Pending Row Model

Do not store pending chat rows in the committed `threads: Thread[]` array and do
not store pending chat content in `projectChats[threadId]`.

Current client state is keyed around real durable `threadId` values. Pending
intent state must stay separate so no WebSocket route, stream handler, history
hydrator, or committed-thread selector can accidentally treat a pending intent
id as a server thread id.

Required client model:

```ts
type ChatTarget =
  | { kind: 'thread'; threadId: string }
  | { kind: 'pending'; intentId: string };

type RenderedThreadRow =
  | { rowKind: 'thread'; threadId: string; entry: ThreadEntry }
  | { rowKind: 'pending'; intentId: string; entry: PendingThreadEntry };

type PendingThreadEntry = {
  name: string;
  createdAt: string;
  listUpdatedAt: number;
  messageCount: 0;
  status: 'draft' | 'creating' | 'cancelling' | 'commit_failed' | 'commit_error';
  harnessId: string;
  sourceThreadId?: string;
};
```

Rules:

- `threads: Thread[]` remains committed DB threads only.
- `projectChats` remains keyed by real committed `threadId` only.
- The visible thread list is composed from `threads` plus at most one
  `RenderedThreadRow` for `pendingChatIntent`.
- Active selection must be able to represent a pending draft without assigning
  a fake value to `currentThreadId`. Use `activeChatTarget` or an equivalent
  explicit union. If `currentThreadId` remains for compatibility, it must refer
  only to durable committed threads.
- `activeChatTarget` is RAM-only UI state. Do not persist pending targets into
  `ViewUIState.currentThreadId`, workspace cache, or any durable view metadata.
- `ViewUIState.currentThreadId` remains the last selected durable committed
  thread id. While a pending row is active, `currentThreadId` may be `null` or
  may retain the last committed thread for restoration, but it must not drive
  active rendering when `activeChatTarget.kind === "pending"`.
- Workspace/view hydration restores `currentThreadId` for committed threads but
  never restores a pending row. Pending rows disappear on refresh/restart.
- Auto-open MRU and send guards must check `activeChatTarget`, not only
  `currentThreadId`. A pending target can be active with no committed
  `currentThreadId`.
- Pending selection, row keys, and active chat targets use
  `PendingChatIntent.id` as `intentId`. They must never use `draftId`.
- Primary send, open, stream, hydrate, and thread-menu code must branch on
  `ChatTarget.kind`, not on string prefixes such as `draft:`.
- Pending chat intents are primary-surface only for this implementation.
  `activeChatTarget` refers to the primary chat surface. Secondary chat remains
  committed-thread-only and must not select, open, render, or send from a
  `ChatTarget.kind === "pending"` target.
- Secondary committed-thread opens do not abandon a pending intent. Secondary
  committed-thread sends do abandon pending intent using the same
  `send_elsewhere` rules as primary committed-thread sends.
- After `thread:draft:committed`, always upsert the real committed thread row
  and remove the matching pending row when
  `draftId === pendingChatIntent.activeDraftId` or
  a matching `recentDraftAttempts` entry exists for the frame's `workspaceId`
  and `draftId`.
- Focus does not automatically follow a late commit. Switch `activeChatTarget`
  to `{ kind: 'thread', threadId }` only if the pending intent's `intentId` is
  still the active target when `thread:draft:committed` is handled.
- If the user sent from pending, then browsed a committed thread while the draft
  was `creating`, and the draft later commits, the client must:
  - remove the pending row
  - insert/upsert the committed row into `threads`
  - store or mark the committed thread history for hydration under the real
    `threadId`
  - keep `activeChatTarget` and `currentThreadId` on the thread the user is
    currently viewing
  - not render the first user bubble into the visible chat surface unless the
    committed thread is active
- WebSocket `thread:list` auto-open behavior must be gated on
  `activeChatTarget == null`, not `currentThreadId == null`. A pending chat has
  no durable `currentThreadId` by design, and a later `thread:list` must not
  steal focus from an active pending row.

### Message Count Contract

`threads.message_count`, `ThreadEntry.messageCount`, and
`thread:draft:committed.thread.messageCount` mean exchange/turn count, not
individual role-message count.

Rules:

- One user prompt with a normal assistant reply counts as `1`.
- One user prompt with a provider error or missing reply also counts as `1`.
- A provisional first exchange created at draft commit counts as `1` as soon as
  it is inserted.
- New Chat draft commit normally returns `messageCount: 1`.
- Fork draft commit returns copied source exchange count plus the first user
  exchange. If the source has `7` exchanges, the committed fork returns
  `messageCount: 8`, not `15` or `16`.
- Fork copy code must not multiply copied exchange rows by two.
- If future UI needs individual role-message counts, it must use a separate
  derived field and not reinterpret `messageCount`.

Ownership and migration:

- `threads.message_count` is owned by SQLite exchange persistence, not markdown
  message append helpers.
- `HistoryFile.addExchange()` increments or sets `message_count` once when a
  normal non-provisional committed-thread turn is saved.
- When `HistoryFile.addExchange()` updates `message_count` for a normal
  committed-thread turn, it emits/broadcasts an updated thread entry or
  `thread:list` with the new count. This count broadcast must not update
  `threads.updated_at` and must not create a second MRU reorder.
- For draft commit, `ThreadCommitRepository.commitDraft()` is the only writer of
  `threads.message_count`. `HistoryFile.beginExchange()` must not increment or
  set thread count when called with `{ trx, countOwner: "commitDraft" }`.
- `HistoryFile.finalizeExchange()` does not increment `message_count`; it only
  completes the existing exchange.
- `ThreadManager.addMessage()` and `addMessageWithMetadata()` must stop
  incrementing `message_count` for individual user/assistant markdown messages.
- Draft commit message-count algorithm:
  - New Chat: insert provisional first exchange, then set
    `threads.message_count = 1`.
  - Fork: copy the frozen source exchange rows, insert provisional first
    exchange, then set `threads.message_count = copiedExchangeCount + 1`.
  - Do not increment count again when `HistoryFile.finalizeExchange()` completes
    the provisional row.
- Add a database migration or startup repair that recomputes
  `threads.message_count = count(exchanges where exchanges.thread_id =
  threads.thread_id)` for existing threads before this contract is used.
- Hydration and thread-list responses must use the repaired exchange count. Do
  not mix legacy role-message counts with new exchange counts in the same list.

### Active Draft Commit Attempt

A backend-owned transient send attempt created by `thread:draft:send`.

Rules:

- It is keyed by `{ workspaceId, connectionId, draftId }` for routing and
  idempotency, while active-attempt exclusivity is one pre-commit draft per
  `connectionId`.
- It owns the transient harness session, reserved future `threadId`, timeout,
  cancellation state, buffered canonical events, buffered harness config patches,
  and frozen fork snapshot when applicable.
- It is cancellable until the backend observes the first valid committing
  provider signal.
- Observing the first valid committing provider signal atomically latches the
  attempt into `commit_in_progress`. From that point cancellation cannot win.
- If SQLite persistence later fails after the commit latch, emit
  `provider_commit_persistence_failed`; do not convert the attempt back into a
  cancellable/pre-commit failure.
- Workspace close after the commit latch is treated as a post-latch persistence
  race, not a cancellation. Continue commit against the frozen workspace
  context; on failure, use `provider_commit_persistence_failed`.
- If cancellation wins before the commit latch, the transient runtime stops, the
  reserved future `threadId` is discarded, and no durable chat state is written.
- If the commit latch wins before cancellation, the resulting thread is durable
  when persistence succeeds and must not be deleted merely because the client
  had already moved on.
- Duplicate sends, late cancels, and second active drafts follow the idempotency
  rules in §5.

### Reserved Future Thread Id

A server-generated thread id reserved at `thread:draft:send` time for a pending
intent's possible committed thread.

Rules:

- The reserved id may be passed to a harness session because some harnesses use
  the supplied thread id as local/provider session identity.
- The reserved id is not durable by itself. It must not create a SQLite row,
  markdown file, exchange row, MRU write, thread-list entry, or provider-visible
  history before the commit boundary.
- If the draft commits, the SQLite `threads.thread_id` must use the reserved id.
- If the draft fails or is cancelled before commit, discard the reserved id and
  write nothing.

### Committing Provider Signal

A harness/provider signal commits a pending draft only when the normalized
canonical event explicitly carries `commitsDraft: true`. Commit inference must
not depend on broad string matching or a generic "provider responded" heuristic.

Harness adapters may set `commitsDraft: true` only for this closed allowlist:

- visible assistant content/text
- visible thinking text
- visible tool call start
- visible tool call args
- visible tool result
- provider session identity or acceptance metadata, such as OpenCode `sessionID`

Harness-specific commit requirements may narrow this allowlist. For OpenCode,
the first production target, a draft commit requires provider session identity
(`sessionID`). Visible content, thinking, or tool output received before
`sessionID` must be buffered and replayed after the `sessionID` commits the
thread; it must not commit an OpenCode draft by itself.

All canonical events default to `commitsDraft: false` unless a harness adapter
sets the field explicitly. Provider-specific recognition belongs in the harness
adapter. The universal commit gate should only read the normalized event shape.

Provider session identity should be normalized as a non-rendering canonical event
that commits drafts, for example:

```json
{
  "type": "provider_session_identity",
  "timestamp": 1782510000000,
  "provider": "opencode",
  "sessionId": "ses_...",
  "commitsDraft": true,
  "render": false
}
```

Canonical draft commit event schema:

```ts
type CanonicalDraftEventBase = {
  type:
    | 'provider_session_identity'
    | 'content'
    | 'thinking'
    | 'tool_call'
    | 'tool_call_args'
    | 'tool_result'
    | 'subagent_event'
    | 'status_update'
    | 'assistant_terminal';
  timestamp?: number;
  threadId?: string;
  turnId?: string;
  exchangeId?: number;
  draftId?: string;
  commitsDraft?: boolean;
  render?: boolean;
};

type ProviderSessionIdentityEvent = CanonicalDraftEventBase & {
  type: 'provider_session_identity';
  provider: string;
  sessionId: string;
  render: false;
  commitsDraft: true;
};

type AssistantTerminalEvent = CanonicalDraftEventBase & {
  type: 'assistant_terminal';
  commitsDraft: false;
  render: true;
  requiresCommittedThread: true;
  assistantTerminal: {
    kind: 'provider_error' | 'missing_reply' | 'interrupted';
    severity: 'error' | 'info';
    harnessId?: string;
    provider?: string;
    errorName?: string;
    errorCode?: string | null;
    message: string;
    ref?: string;
    exitCode?: number | null;
    signal?: string | null;
    retryable?: boolean;
  };
};
```

Bridge and applier requirements:

- `canonical-harness-event-bridge.js` must preserve `commitsDraft`, `render`,
  `draftId`, `turnId`, `exchangeId`, provider identity fields, and
  `assistantTerminal` when converting flat harness events into applier payloads.
- `canonical-chat-event-applier.js` must treat `provider_session_identity` as
  non-rendering metadata. It can satisfy the draft commit gate and update
  harness config, but it must not append assistant content.
- `assistant_terminal` is a terminal render-metadata event. It updates live
  exchange chrome and buffered turn metadata with `metadata.assistantTerminal`
  and no synthetic assistant text part, but it does not write SQLite by itself.
  Durable exchange finalization is owned by terminal `chat:turn_end` with
  `persistenceMode: "finalize_provisional"` or `provisionalExchangeId`.
- `render === false` means the event may update metadata or commit state, but
  cannot create a visible assistant segment.
- Events that omit `turnId`/`exchangeId` before commit may be buffered by
  `draftId`; after commit the server must replay them with the committed
  `threadId`, stable `turnId`, and `exchangeId`.
- `subagent_event` is buffered and replayed like other visible stream events
  when it is associated with a visible tool/subagent interaction. It is
  `render: true` but `commitsDraft: false` for OpenCode unless accompanied by
  provider session identity. It must never commit an OpenCode draft by itself.

These do not commit the pending intent:

- `wire_ready`
- local UI placeholders
- request-sent acknowledgements
- transient connection/retry status
- synthetic `turn_begin` events generated before provider output
- warm/runtime setup events
- any canonical event missing `commitsDraft: true`

If a harness currently emits synthetic events before provider output, the
signal-gated commit path must either mark those events as non-committing or
ignore them for commit.

Provider session identity is a committing provider signal even if no visible
text, thinking, or tool output follows. Once a provider returns a session id,
Fusion must create a durable thread and save the first user bubble so local
history matches provider state.

If an OpenCode draft emits visible output but never emits `sessionID` before the
backend first-terminal deadline or process exit, the draft fails pre-commit with
`provider_no_commit`, writes nothing durable, and restores the composer text.
The buffered visible output is discarded because Fusion cannot continue the
provider session safely without `sessionID`.

If an OpenCode draft commits on `sessionID` and later emits another `sessionID`
or config patch, the `DraftCommitService` updates the committed thread's
`harness_config.opencodeSessionId` idempotently. A conflicting later session id
is treated as provider error metadata and logged; it must not silently switch the
thread to a different provider session.

Provider error sequencing is mandatory:

- Raw provider error events are never the canonical committing event.
- If a raw provider error includes provider session identity, the harness adapter
  must first emit or expose `provider_session_identity` with
  `commitsDraft: true`, then emit `assistant_terminal` with
  `commitsDraft: false`.
- If a harness other than OpenCode is explicitly configured to let visible
  output commit before provider session identity, and a raw provider error
  arrives after that visible output committed the draft, emit only the terminal
  metadata event.
- If a raw provider error arrives before any committing provider signal and
  carries no provider session identity, the backend emits `thread:draft:failed`
  and writes nothing durable.

After a valid harness-specific committing signal commits the draft, Fusion
preserves the thread and renders provider failure in the exchange chrome instead
of returning the user text to the composer. The failure display is render
metadata, not assistant message history. For OpenCode, that committing signal is
`provider_session_identity`.

### Transient Provider Status

Connection and retry messages are status, not assistant content. They should not
create a SQLite row, markdown file, exchange row, or assistant message by
themselves.

Examples include provider messages like:

```text
Cannot connect to API: Unable to connect. Retrying in 2s, attempt #3.
```

Harness adapters may translate provider-specific retry notices into a universal
transient status event with fields such as:

```json
{
  "type": "status_update",
  "phase": "provider_retry_wait",
  "severity": "warning",
  "message": "Cannot connect to API: Unable to connect.",
  "retryInMs": 2000,
  "attempt": 3,
  "transient": true,
  "commitsDraft": false
}
```

Public draft-scoped status frame:

```json
{
  "type": "thread:draft:status",
  "workspaceId": "workspace-id",
  "draftId": "client-draft-id",
  "phase": "provider_retry_wait",
  "severity": "warning",
  "message": "Cannot connect to API: Unable to connect.",
  "retryInMs": 2000,
  "attempt": 3,
  "transient": true,
  "commitsDraft": false,
  "display": {
    "primary": "Cannot connect to API; Retrying shortly",
    "indicator": "hourglass"
  }
}
```

Rules:

- `thread:draft:status` is the only public pre-commit status frame.
- It is keyed by `draftId`, not `threadId`, because no durable thread exists.
- It includes `workspaceId` and is routed by `{ workspaceId, draftId }`.
- It can update the pending overlay/status UI for the matching
  `pendingChatIntent.activeDraftId` or matching recent attempt in that
  workspace.
- It must not create `threads`, `projectChats`, messages, exchanges, markdown,
  assistant segments, or committed-thread stream state.
- The client ignores `thread:draft:status` for unknown `draftId` values after
  logging.
- After `thread:draft:committed`, provider status uses normal committed-thread
  status/update events keyed by `threadId`; do not keep sending
  `thread:draft:status` after commit.

Typed status contract:

```ts
type DraftStatusPhase =
  | 'starting'
  | 'provider_connecting'
  | 'provider_retry_wait'
  | 'provider_retry_attempt'
  | 'waiting_first_response'
  | 'stopping';

type DraftStatusSeverity = 'info' | 'warning' | 'error';

type DraftStatusIndicator = 'spinner' | 'orb' | 'hourglass' | 'none';
```

Required phase/display meanings:

| Phase | Required display behavior |
| --- | --- |
| `starting` | Show the creation overlay spinner and primary text such as `Creating Session...`. |
| `provider_connecting` | Keep the pending indicator visible and show connection progress text. |
| `provider_retry_wait` | Remove the orb, show warning/error-colored retry text, and use `display.indicator: "hourglass"`. |
| `provider_retry_attempt` | Restore the pending assistant orb while the retry attempt is actively connecting. |
| `waiting_first_response` | Keep the pending assistant orb or backend-selected first-response indicator while waiting for commit-capable output. |
| `stopping` | Disable additional sends for that pending intent and show stopping progress until a terminal `thread:draft:*` event arrives. |

Adapters must emit only the phase strings above for `thread:draft:status`.
Provider-specific phrases belong in `message` and `display.primary`, not in new
phase names. Unknown phases are logged and ignored by the client rather than
inventing UI.

OpenCode-specific retry text detection belongs in the OpenCode harness adapter.
The universal chat applier should only understand the normalized transient
status shape.

Fusion must not depend on OpenCode streaming a second-by-second retry countdown.
In tested CLI JSON and captured PTY runs, the retry countdown was not emitted as
machine-readable stream data before a committing provider signal.

While a pending draft is waiting for the first committing provider signal,
transient status updates should update the creation overlay copy, for example
changing `Creating Session...` to `Connecting to API...` or showing the provider
retry message as secondary text. If JSON mode exposes no retry events, the
client may show an elapsed-time fallback such as `Still waiting for provider...`;
it must not invent retry counts.

Transient connection/retry UX:

- On normal send attempt, show the pending assistant orb.
- When the harness reports that the provider connection failed but will retry,
  remove the orb and show red status text:

  ```text
  Cannot connect to API; Retrying shortly
  ```

- Show the reusable modular hourglass animation while waiting for retry.
- When a retry attempt starts, restore the pending assistant orb.
- If a retry yields a committing provider signal, commit the draft normally.
- If retries are exhausted before any committing provider signal, the backend
  fails the draft with `thread:draft:failed` and returns the user text to the
  composer.

The connection text and hourglass are pending-state UI. They are never saved as
assistant content. If the provider has already crossed the commit boundary, the
corresponding terminal condition is stored as exchange/turn metadata.

### First Response Timeout

The backend owns the two-stage first-visible-response timeout for active draft
attempts. The timer starts when the server accepts `thread:draft:send`.

The frontend may mirror elapsed time to update display copy, but frontend timers
must not decide terminal state. The frontend must not restore composer text,
mark a draft failed, commit a thread, stop a provider process, or finalize a
missing reply unless the backend sends the corresponding terminal event.

1. Show the pending assistant indicator for up to 10 seconds. This may appear as
   the creation overlay spinner before commit, or as the assistant orb after a
   provider session identity commits the thread.
2. If no visible assistant response or terminal provider failure has arrived,
   replace the pending indicator with red connection text and the reusable
   hourglass animation for up to 10 more seconds.

If a harness-specific commit-capable visible event arrives during either stage,
commit the draft and continue normal committed-turn flow. For OpenCode, visible
assistant/tool/thinking output before `sessionID` is not commit-capable; it is
buffered and does not cancel the pre-session timeout. Post-commit visible output
or post-commit structured terminal provider failure cancels the first-visible
timer and continues the normal committed-turn flow.

If only provider session identity arrives, commit the thread and drop the
creation overlay, but keep the first-visible-response timer running. A session id
means the prompt is accepted; it does not mean an assistant reply exists.

At 20 seconds:

- if no provider session identity or committing provider signal has arrived,
  stop the transient harness process, fail the draft, write nothing durable, and
  return the user text to the composer via `thread:draft:failed`.
- if a provider session identity has arrived but no visible assistant response
  or post-commit structured terminal provider failure has arrived, commit the
  thread if it has not already been committed, save the user prompt and provider
  session id, stop the harness process, and mark the turn as missing an
  assistant reply.

The 20-second deadline is an intentional default, not a frontend magic number.
Implement it as a named backend policy constant or harness/workspace setting so
it can be tuned later. Unless a provider-specific override is configured, the
default remains 10 seconds of pending indicator plus 10 seconds of hourglass
status. Future provider keepalive/progress events may extend this deadline only
if the harness adapter marks them with an explicit normalized field such as
`extendsFirstResponseDeadline: true`.

Post-commit terminal precedence:

| Post-commit condition | Terminal metadata |
| --- | --- |
| Structured provider error arrives after commit, with provider error fields such as error name/code/message/ref | `assistantTerminal.kind = "provider_error"` using the structured fields. This cancels the first-visible timer. |
| Visible assistant/thinking/tool output arrives after commit before terminal failure | No missing-reply marker. Preserve visible output; if a later provider error arrives, store `provider_error` metadata with the partial output. |
| First-visible-response deadline expires after provider session identity and no visible output or structured provider error has arrived | `assistantTerminal.kind = "missing_reply"`. Stop the runtime and finalize the turn as missing reply. |
| Harness process exits after commit with no visible output and no structured provider error before the deadline | Keep waiting until the first-visible-response deadline unless the adapter explicitly emits a structured provider error. At the deadline, classify as `missing_reply`. Process exit code/signal/stderr may be logged in metadata diagnostics, but the rendered kind remains `missing_reply`. |
| Harness process exits after commit after visible output, with no structured provider error | Complete/finalize the turn with the visible output. Process exit diagnostics may be logged but do not become rendered provider-error chrome unless the adapter emitted structured provider error. |
| User Stop arrives after commit and before turn terminal state | Stop the committed runtime and finalize the turn as `assistantTerminal.kind = "interrupted"` with `turnStatus = "interrupted"`, preserving any partial visible output. |

This precedence is intentional for OpenCode: after `sessionID`, an absence of
assistant/tool text is rendered as `Reply not received` unless OpenCode emits a
structured error event. Do not synthesize rendered `provider_error` from process
exit/stderr alone for a no-visible-output post-commit turn.

Committed missing-reply marker:

```text
[material-symbol:error] Reply not received
```

The marker uses the Material Symbol `error` icon and the same red error text
visual language as expanded tool errors. It renders in the exchange chrome where
an assistant reply would normally be represented, but it is not assistant
message content.

The composer returns to idle state after this marker is rendered: stop the
spinning effect, replace Stop with Send, and allow the user to continue the
provider-backed thread.

Continuation uses the normal composer. The user types a fresh message and clicks
Send. Do not introduce special `Continue`, `Recover`, `Resend`, or `Retry`
composer states for missing replies or committed provider failures.

Missing reply is a terminal turn state. The backend must finalize the exchange
with `metadata.turnStatus = "missing_reply"`,
`metadata.missingAssistantReply = true`, and
`metadata.assistantTerminal.kind = "missing_reply"`, so the frontend renders the
normal completed-turn chrome beneath the marker, including controls such as
copy, play audio, and link. This visually tells the user there is nothing left
to wait for while still keeping the assistant message content empty.

Do not save `Reply not received` as assistant text. Store the condition in turn
or exchange metadata so future prompts do not include Fusion's local error marker
as assistant history. If the user expands or clicks the chrome for a missing
reply, show the standard empty-response detail, such as:

```text
No chat text found
```

### Committed Thread

A real thread with a SQLite row, markdown file, and normal thread id. Once a
pending intent is committed, it becomes a normal thread and is available after
navigation or restart.

---

## 4. User Experience

### New Chat

1. User clicks New Chat.
2. Existing pending intent, if any, is abandoned. If the old pending intent is
   only local `draft`, replacement is immediate. If it is `creating`, the client
   may show the replacement pending row immediately, but the backend must not
   accept/start a replacement draft send until the old active attempt reaches
   cancel/fail terminal state or commit wins according to the active-draft
   conflict policy.
3. Client creates a RAM-only pending intent when the selected/default harness is
   draft-ready.
4. Chat content area switches to the pending chat view.
5. User types in the composer.
6. User sends.
7. Chat content area is covered with a modal overlay:

   ```text
   Creating Session...
   ```

   The overlay includes a 3/4 spinning circle.

8. If a committing provider signal arrives:
   - server commits the thread
   - client drops the overlay if the pending view is still active
   - pending row is replaced by the committed thread row
   - user bubble appears if the committed thread is the active chat surface
   - the assistant orb, streamed event, or terminal failure chrome appears if
     the committed thread is the active chat surface
   - pending intent is cleared
9. If no committing provider signal arrives and the attempt fails:
   - no thread is saved
   - overlay text changes to:

     ```text
     Message Send Failed!
     ```

   - overlay disappears after a short failure state
   - original text returns to the input
   - pending intent status becomes `commit_failed`
   - composer remains editable and normal Send returns
   - the next Send reuses the same pending intent row but creates a new
     `draftId`

### Fork Chat

1. User clicks Fork on an eligible OpenCode thread.
2. Existing pending intent, if any, is abandoned using the same local-vs-active
   replacement rules as New Chat.
3. Client creates a RAM-only pending fork intent:

   ```text
   Forked Chat: {{Source Name}}
   ```

4. No server request is sent at click time.
5. No SQLite fork row is created at click time.
6. No OpenCode fork is created at click time.
7. User types and sends.
8. The same `Creating Session...` overlay and signal-gated commit flow applies.

The source thread is resolved, validated, and frozen at send time, not click
time. If the user sends in another chat before sending the fork, the fork intent
is abandoned. That removes the stale fork synchronization problem without later
copying a moving "latest" source state.

### Navigation

Opening or browsing an existing committed thread does not abandon a pending
intent, even if the pending input is empty.

The pending intent may appear as a temporary DOM/list row so the user can return
to it during the current app session. It should behave like an ordinary thread
row for selection and sorting, but it must remain internally marked as
non-durable pending RAM state and must not be written into SQLite.

Empty pending intents are discarded only by the explicit abandonment triggers
below, by creating/replacing them with another New Chat/Fork intent, or by an
explicit future close/delete-pending affordance. Do not silently delete an empty
pending row merely because the user opened another thread.

### Abandonment Triggers

These abandon the current pending intent:

- New Chat
- Fork
- Send on any existing committed chat
- workspace switch
- refresh/reload/app restart

Send inside the pending chat is not abandonment. It is the commit attempt.

If the pending intent is still `draft`, abandonment is frontend-only: discard the
RAM pending intent.

If the pending intent is `creating`, abandonment must also attempt backend
cancellation:

1. Client marks the pending intent `cancelling` or removes it from active UI.
2. Client sends `thread:draft:cancel { workspaceId, draftId, reason }` when the
   WebSocket is still available. For workspace switch, `workspaceId` is the
   origin workspace of the active draft being abandoned, not the destination
   workspace.
3. Backend stops the transient harness runtime if no committing provider signal
   has been committed.
4. Backend emits `thread:draft:cancelled` for an orderly cancel, or no event if
   the connection closed.
5. Backend writes no durable chat state when cancel wins before commit.

Workspace switch is an explicit abandonment/cancel trigger. The frontend removes
the origin pending row from visible UI, tracks the active attempt in
`recentDraftAttempts`, and sends `thread:draft:cancel` with
`reason: "workspace_switch"` for the origin `{ workspaceId, draftId }`.

Refresh, app restart, workspace close, and WebSocket close are implicit cancel
requests for all active draft attempts owned by that connection. Workspace close
uses `reason: "workspace_close"` when an owner-visible terminal frame can be
sent. Because there is only one pre-commit active draft per connection, a
workspace switch or send in any workspace resolves that one active draft before
proceeding.

Stop during `Creating Session...` is explicit draft cancellation. The Stop
button sends `thread:draft:cancel` with `reason: "user_stop"`. If no committing
provider signal has won yet, the backend calls the transient harness stop API,
waits up to `DRAFT_STOP_TIMEOUT_MS`, then force-kills/discards the transient run
if it has not exited. If commit wins before Stop is processed, Stop no longer
means "delete the pending draft"; it becomes normal committed-runtime stop
behavior and the committed thread remains durable.

Race rule: commit wins at the moment the backend observes the first valid
committing provider signal and marks the attempt `commit_in_progress`, before
SQLite writes begin. A later cancel/Stop/abandon request cannot roll back or
prevent that commit; if persistence succeeds, the thread remains durable and
appears in the thread list. If persistence fails after the latch, the terminal
state is `provider_commit_persistence_failed`. If cancel wins before the latch,
no orphan thread may be committed later.

### Send Elsewhere While Draft Is Creating

Sending on an existing committed thread while a pending intent is `creating` is
an abandonment action and must be ordered by the server before the committed
prompt is accepted.

Protocol rule:

- The client should include the active draft attempt when sending elsewhere:

  ```json
  {
    "type": "prompt",
    "workspaceId": "target-workspace-id",
    "threadId": "existing-thread-id",
    "user_input": "message for existing thread",
    "abandonDraftWorkspaceId": "origin-workspace-id",
    "abandonDraftId": "client-draft-id",
    "abandonReason": "send_elsewhere"
  }
  ```

- Final protocol requires `prompt.workspaceId` for the committed target thread.
  The server validates that `threadId` belongs to `workspaceId` before accepting
  the prompt.
- If `abandonDraftId` is present, `abandonDraftWorkspaceId` is also required and
  identifies the origin workspace of the pending draft to cancel/order before
  prompt acceptance.
- If the client sends legacy `prompt` without `abandonDraftId`, the backend must
  still check the connection's single active draft registry entry, regardless of
  workspace, before accepting the committed-thread prompt. Legacy prompts
  without `workspaceId` may be tolerated only by resolving the target thread id
  to exactly one workspace; new code must send `workspaceId`.
- `prompt.user_input` is the canonical committed-thread prompt text field. The
  server may tolerate legacy `content` only as compatibility input, but new code
  must send `user_input`.
- The backend processes this as one ordered action:
  1. attempt to cancel the active pre-commit draft identified by
     `{ abandonDraftWorkspaceId, connectionId, abandonDraftId }`, or the active
     draft for `connectionId` regardless of workspace for legacy prompts without
     explicit abandonment fields
  2. if cancel wins, emit/replay `thread:draft:cancelled` when possible and
     write no durable pending-thread state
  3. if the draft already committed, keep that thread durable and replay/send
     `thread:draft:committed`
  4. accept the committed-thread prompt only after the active draft has reached
     a terminal state or normal runtime busy rules reject the send
- The committed-thread prompt must not call the old eager user-message
  persistence path until the active draft ordering step above completes.
- If the committed-thread target itself is busy, return the existing busy/error
  response after the draft abandonment step has been resolved.

### Thread List And MRU Timing

Pending chat intents should render as ordinary thread-list rows from the user's
point of view. They can be selected, highlighted, sorted, and returned to during
the current app session.

Committed thread order remains server-authoritative and backed by SQLite
`threads.updated_at DESC`. Pending intent order is client-owned RAM state.

`thread:list` protocol requirement:

- Every `thread:list` frame must include `workspaceId`.
- Every committed thread entry in `thread:list` must include
  `entry.threadId = threads.thread_id`. New protocol rows use `threadId`, not
  `id`. The client may tolerate legacy `id` only as a migration read path and
  must normalize it to `threadId` before storing the row.
- Every committed thread entry in `thread:list` must include
  `entry.updatedAt = threads.updated_at`.
- `ThreadIndex._toEntry()` and client `ThreadEntry` types must expose
  `updatedAt`.
- The server still sends `thread:list` already sorted by `updated_at DESC`.
- The client may use `updatedAt` only to merge the optional pending RAM row into
  that server-ordered committed list. It must not reorder committed rows against
  the server order.
- The client routes `thread:list` by `workspaceId`. A background workspace list
  update may update that workspace's cached committed rows, but it must not
  switch the visible workspace or active chat target.

Passive open surface protocol:

```json
{
  "type": "thread:open",
  "workspaceId": "workspace-id",
  "threadId": "real-thread-id",
  "surface": "primary"
}
```

Rules:

- Final protocol requires `surface: "primary" | "secondary"` on passive
  committed-thread open/touch messages that can schedule MRU.
- `thread:opened` echoes `workspaceId`, `threadId`, and `surface`.
- Primary chat row clicks and normal thread opens send `surface: "primary"`.
- Secondary chat opens send `surface: "secondary"`.
- Legacy `thread:open` messages without `surface` are treated as
  `surface: "primary"` during migration only.
- Unknown `surface` values are rejected and must not schedule MRU.
- Pending rows are primary-only and are not valid `thread:open` targets for the
  secondary surface.

Surface clear protocol:

```json
{
  "type": "thread:surface:clear",
  "workspaceId": "workspace-id",
  "surface": "primary",
  "reason": "pending_selected"
}
```

Rules:

- The client sends `thread:surface:clear` when a surface leaves a committed
  thread without opening another committed thread, for example selecting a
  pending row, clearing the chat area, closing secondary chat, or switching to a
  local-only surface.
- Valid reasons are `pending_selected`, `surface_closed`, `workspace_switch`,
  `local_clear`, and `refresh`.
- `ThreadMruService` cancels any delayed passive MRU timer for
  `{ workspaceId, connectionId, surface }` when it receives
  `thread:surface:clear`.
- `thread:surface:clear` does not alter committed thread selection, does not
  write SQLite, and does not emit `thread:list` by itself.
- Legacy clients that do not send `thread:surface:clear` are tolerated only
  during migration; new pending-row selection code must send it before or at the
  same time it switches the primary surface to the pending target.

The rendered list is:

```text
committed DB threads + optional pending RAM thread
```

sorted into one display order.

Current server behavior writes committed-thread MRU immediately, then delays the
visible list reorder by three seconds. That creates a mismatch between RAM/UI and
SQLite. Replace it with this rule:

Constants:

- `MRU_REORDER_DELAY_MS = 3000`.
- The value must live in one shared client/server config module or be sent from
  server to client at startup. Do not duplicate `3000` as unrelated magic
  numbers.
- `DRAFT_STOP_TIMEOUT_MS = 5000`.
- `DRAFT_STOP_TIMEOUT_MS` is the backend deadline for stopping a transient
  draft harness after explicit user Stop or abandonment cancellation. It must
  live beside other thread/runtime timing constants, not as ad hoc handler code.

Server owner:

- Add one `ThreadMruService` owned by the thread WebSocket/runtime layer.
- It is the only server component allowed to define MRU policy and calculate MRU
  timestamps.
- Delayed passive MRU writes are executed by `ThreadMruService`.
- Immediate durable-activity MRU writes normally go through
  `ThreadMruService.touchNow(...)`. Draft commit is the exception: because the
  initial thread row must be inserted transactionally, `ThreadCommitRepository`
  asks `ThreadMruService` for the commit MRU timestamp/policy decision and writes
  `threads.updated_at` inside the same SQLite transaction.
- Timer key is `{ workspaceId, connectionId, surface, threadId }`, where
  `surface` is `primary` or `secondary`.
- Passive selection schedules one timer under that key. Selecting another
  thread on the same `{ workspaceId, connectionId, surface }` cancels the prior
  timer.
- Connection close, workspace switch, or explicit abandon of the surface cancels
  pending passive timers for that connection/workspace.
- When a delayed passive timer fires, `ThreadMruService` writes `updated_at` and
  broadcasts the new committed thread list to all clients subscribed to that
  workspace.
- Immediate durable-activity MRU calls also go through `ThreadMruService` policy
  and broadcast the new list to all workspace subscribers in the same operation.

1. Thread selection changes active chat immediately.
2. No committed-thread MRU DB write happens immediately on selection.
3. If the thread remains viewed long enough to trigger visible reorder, write
   `updated_at = selectionStartedAt + MRU_REORDER_DELAY_MS` and send the
   reordered list at that same time.
4. If the user leaves before the visible reorder threshold, do not write MRU.
5. Pending RAM rows use the same visible timing locally, but never write SQLite.

The three-second delay is therefore the MRU commit delay, not just a delayed
refresh. SQLite and the visible sorted list must change together.

Pending row sort keys:

- `pendingChatIntent.createdAt` is set when New Chat/Fork creates the pending
  intent.
- `pendingChatIntent.listUpdatedAt` is initialized to `createdAt`. Creating a new
  pending intent is an explicit create action, so the row can appear at the top
  immediately using that timestamp.
- Opening/browsing an existing committed thread does not change
  `pendingChatIntent.listUpdatedAt`.
- Selecting the pending row after browsing away changes active chat immediately
  and schedules a local pending-row MRU update for
  `selectionStartedAt + MRU_REORDER_DELAY_MS`.
- If the pending row remains selected until the delay expires, set
  `pendingChatIntent.listUpdatedAt` to that scheduled timestamp and re-sort the
  visible list locally.
- If the user leaves the pending row before the delay expires, cancel the local
  pending-row MRU update.
- Editing pending text does not change `listUpdatedAt`.
- On commit, the durable thread's initial `updated_at` is the server commit
  timestamp returned by `ThreadMruService.getImmediateTimestamp("draft_commit")`
  or equivalent policy helper and written inside the commit transaction by
  `ThreadCommitRepository`. Do not preserve or import the pending row's
  client-only `listUpdatedAt` into SQLite. The committed row is then broadcast
  with the same server-written sort key.

Committed MRU writer classification:

| Source | MRU behavior |
| --- | --- |
| Passive primary thread selection/open | Delayed. Schedule `updated_at` write and list broadcast for `selectionStartedAt + MRU_REORDER_DELAY_MS`; cancel if the user leaves first. |
| Passive secondary thread selection/open | Delayed by the same threshold for that secondary thread, but must not steal primary active selection or create a second immediate touch path. |
| Send on an existing committed thread | Immediate. User-created durable activity writes `updated_at` and broadcasts the reordered list at the same time the prompt is accepted/persisted. |
| Draft commit | Immediate. The first durable exchange is created, so the committed row receives its initial sort key and list broadcast in the commit flow. |
| Secondary chat send | Immediate for the secondary thread because it is durable user activity; active primary/secondary display state is preserved separately from sort order. |
| Runtime activation, resume, warm, or provider startup | Not MRU. These paths must not update `updated_at` unless called from one of the explicit policies above. |
| `thread:touch` | Must be narrowed to an explicit user-visible touch policy. Passive view touches use the delayed policy; durable user activity uses the immediate policy. Do not keep a generic "bump this row now" route for selection cleanup. |

Known current writers that must be classified during implementation:

- `thread-crud.js::handleThreadOpen()` is passive selection and must use the
  delayed policy.
- `thread-messages.js::handleMessageSend()` is durable send activity and may
  write MRU immediately, but only once.
- `ThreadManager.addMessage()` currently increments count and touches MRU; move
  exchange counting to `HistoryFile` and route MRU through `ThreadMruService` so
  this helper does not create duplicate count or MRU writes.
- `ThreadIndex.activate()` currently updates `updated_at`; activation/status
  changes must stop being MRU writes.
- `thread-crud.js::handleThreadTouch()` must be removed, narrowed, or routed
  through the explicit delayed/immediate policy above.

---

## 5. Server Protocol

### No Server Request On Draft Creation

New Chat and Fork click handlers must not call server thread creation APIs.
They only update frontend RAM.

### Harness Support Gate

Pending draft send is opt-in per harness.

Requirements:

- A harness adapter must declare support, for example
  `supportsSignalGatedDraft: true`.
- Server harness config/status payloads must expose draft support to the client.
  The client-visible shape for each harness row is:

  ```ts
  type HarnessStatus = {
    id: string;
    enabled: boolean;
    installed?: boolean;
    builtIn?: boolean;
    supportsSignalGatedDraft?: boolean;
  };
  ```

- The server must expose exactly one authoritative draft harness readiness
  object alongside harness status. It is workspace-scoped, not panel/view
  scoped:

  ```ts
  type DraftHarnessStatus = {
    workspaceId: string;
    ready: boolean;
    defaultDraftHarnessId: string | null;
    reason?: 'loading' | 'no_supported_harness' | 'default_unavailable';
    updatedAt: number;
  };
  ```

- Default selection algorithm:
  1. If harness install/status probes are not loaded, return
     `{ ready: false, defaultDraftHarnessId: null, reason: "loading" }`.
  2. Build candidate list from harnesses where `enabled === true`,
     `(installed === true || builtIn === true)`, and
     `supportsSignalGatedDraft === true`.
  3. If the workspace-level configured default harness is in the candidate list,
     use it as `defaultDraftHarnessId`.
  4. Otherwise use the first candidate ordered by the existing harness catalog
     order.
  5. If no candidates exist, return
     `{ ready: false, defaultDraftHarnessId: null, reason:
     "no_supported_harness" }`.
  6. If a previously selected default becomes unavailable and another candidate
     exists, recompute using the same algorithm. If none exists, use
     `reason: "default_unavailable"` or `no_supported_harness` as appropriate.

- Concrete transport:
  - `/api/harnesses?workspaceId=<workspace-id>` returns
    `{ workspaceId, harnesses: HarnessStatus[], draftHarness:
    DraftHarnessStatus }` for that workspace.
  - A request without `workspaceId` may be tolerated only during migration by
    resolving the current/default workspace unambiguously. New code must pass
    `workspaceId`.
  - The client bootstrap/workspace initialization payload includes the same
    `draftHarness` object and the same per-harness `supportsSignalGatedDraft`
    fields. Do not send only `cliConfig` for this flow.
  - `harness:status_changed` / any WebSocket status refresh that can affect
    enabled or installed state must emit one frame per affected subscribed
    workspace:
    `{ type: "harness:status_changed", workspaceId, harness, draftHarness }`.
    Clients route the frame by `workspaceId`; a background workspace status
    update must not mutate the currently visible workspace's default.
  - The client stores `draftHarness.ready === false` as authoritative. If
    `reason === "loading"` or no `draftHarness` has been received yet, New Chat
    is disabled or shows typed non-destructive feedback without creating a
    pending intent.
  - If the default harness becomes unavailable after startup, the next New Chat
    uses the new server-advertised `draftHarness.defaultDraftHarnessId` when
    `ready === true`, or fails with `draft_no_supported_harness` when
    `ready === false`; existing committed threads are unaffected.
- New Chat must resolve a harness before creating a pending intent:
  - explicit user harness selection wins
  - otherwise use `draftHarness.defaultDraftHarnessId`
  - if `draftHarness.ready !== true`, or the selected/default harness is not
    enabled, installed/built-in, and `supportsSignalGatedDraft`, do not create a
    pending intent; surface `draft_harness_unsupported` for an explicit
    unsupported selection, or `draft_no_supported_harness` when no supported
    default/candidate is available
- The automatic pending New Chat default never depends on a view/panel-local CLI
  delta. If the UI later offers explicit per-view harness choice, that choice is
  sent as an explicit harness selection and still must pass the same
  `supportsSignalGatedDraft` validation. Future view-scoped defaults would need
  a new field such as `viewId` in `DraftHarnessStatus`; do not infer them from
  existing per-view config.
- Supported adapters must normalize commit-capable provider events with explicit
  `commitsDraft: true`.
- Unsupported harnesses must not appear as enabled pending New Chat targets. If
  a client still sends `thread:draft:send` for an unsupported harness, the
  backend rejects it before provider startup with `thread:draft:failed` using
  code `draft_harness_unsupported`.
- Existing committed-thread send/resume behavior for unsupported harnesses is
  unchanged.
- `thread:draft:send` always includes the resolved `draft.harnessId`; the
  backend still validates that harness against the adapter capability and status
  at send time.

First production target: OpenCode. Fake harnesses may implement the contract for
focused server/client tests.

### Draft Send Request

When the user sends from a pending intent, the client sends one request that
contains both the draft metadata and the first prompt:

```json
{
  "type": "thread:draft:send",
  "workspaceId": "workspace-id",
  "draftId": "client-draft-id",
  "draft": {
    "kind": "fork",
    "title": "Forked Chat: Original Name",
    "harnessId": "opencode",
    "sourceThreadId": "source-thread-id"
  },
  "user_input": "first prompt",
  "attachments": []
}
```

For New Chat, `draft.kind` is `new` and `sourceThreadId` is omitted.

`workspaceId` is required on `thread:draft:send`. If the WebSocket is already
scoped to one workspace, the server still stamps that workspace id into the
active draft attempt and echoes it on every `thread:draft:*` frame. The server
must not accept client-provided `listUpdatedAt`, pending row timestamps, or
other client sort keys as durable ordering input.

### Draft Frame Delivery Scope

`thread:draft:*` frames are owner-connection-only. The owner connection is the
WebSocket connection that sent `thread:draft:send`. Every `thread:draft:*` frame
must include `workspaceId`.

Owner-only frames:

- `thread:draft:accepted`
- `thread:draft:status`
- `thread:draft:committed`
- `thread:draft:failed`
- `thread:draft:cancelled`

Rules:

- Do not broadcast `thread:draft:*` frames to other clients in the same
  workspace.
- The owner client routes `thread:draft:*` frames by `{ workspaceId, draftId }`.
  If the user has switched to another workspace, the frame updates only the
  original workspace bucket and must not mutate the currently visible workspace
  or steal focus there.
- Non-owner clients must never see owner-local `draftId`, `intentId`,
  `copiedExchanges`, pending overlay state, or draft failure/cancel status.
- After commit, normal committed-thread frames such as `thread:list`,
  committed stream events after the first draft turn, and hydration responses
  follow existing workspace/thread subscription rules.
- First draft turn exception: after `thread:draft:committed`, the owner
  connection continues receiving first-turn buffered/live stream frames,
  `assistant_terminal`, terminal `turn_end`, and `chat-turn:saved` for the
  committed `threadId` until the provisional exchange reaches terminal
  `turn_end`. This owner-connection delivery exception exists even if the owner
  has browsed another thread or switched visible focus. It ends after terminal
  `turn_end`; future turns and normal committed-thread frames use existing
  workspace/thread subscription rules.
- The owner always receives the owner-only `thread:draft:committed` frame.
- The subsequent `thread:list` broadcast includes `workspaceId` and is delivered
  only to clients currently subscribed to that workspace. If the owner socket
  has switched away, it may not receive that workspace broadcast; it must route
  the owner-only `thread:draft:committed` frame to the origin workspace bucket
  and rely on later `thread:list`/`thread:open` hydration when that workspace is
  active again.
- Non-owner clients discover the new committed thread only through
  workspace-visible committed-thread broadcasts such as `thread:list`, not
  through draft frames.

The server generates a reserved future `threadId` after validating the draft
request. The client does not need to know this id until commit; pre-commit UI
selection continues to route by `intentId`, while active send-attempt protocol
events route by `draftId`.

First implementation constraint: pending draft attachments are out of scope.
Clients must send `attachments: []` for `thread:draft:send`. If the backend
receives non-empty attachments on a pending draft send, it must reject the request
before starting the harness with `thread:draft:failed` using code
`draft_attachments_unsupported`.

Future attachment support will require a concrete staging contract. Until that
contract is implemented, no temporary attachment staging should be added for
pending drafts.

### Draft Accepted

After validating `thread:draft:send` including harness support, attachment
constraints, idempotency, and fork eligibility/snapshot freeze when applicable,
then reserving the future `threadId` and starting the active draft attempt
registry entry, the server sends `thread:draft:accepted` for every accepted
draft:

```json
{
  "type": "thread:draft:accepted",
  "workspaceId": "workspace-id",
  "draftId": "client-draft-id",
  "status": "creating",
  "acceptedAt": 1782510000000,
  "timeoutPolicy": {
    "pendingIndicatorMs": 10000,
    "hourglassMs": 10000,
    "firstTerminalDeadlineAt": 1782510020000
  }
}
```

Rules:

- The backend first-response timer starts at `acceptedAt`.
- Validation failures emit `thread:draft:failed` and do not emit
  `thread:draft:accepted`.
- The frontend mirrors timer display from `acceptedAt` and
  `timeoutPolicy.firstTerminalDeadlineAt`; it does not compute terminal state.
- `thread:draft:accepted` does not create a thread, exchange, markdown file,
  provider session association, or user bubble.
- Duplicate `thread:draft:send` for an active identical draft replays the same
  `thread:draft:accepted` payload.

The timeout policy is backend-owned and may become harness/workspace configurable
later. The response is the client contract for whatever policy is active.

### Draft Commit Success

After the first committing provider signal arrives and the server commits the
thread, the server sends:

```json
{
  "type": "thread:draft:committed",
  "workspaceId": "workspace-id",
  "draftId": "client-draft-id",
  "threadId": "real-thread-id",
  "thread": {
    "threadId": "real-thread-id",
    "name": "Forked Chat: Original Name",
    "createdAt": "2026-06-27T18:15:00.000Z",
    "updatedAt": 1782510000000,
    "messageCount": 2,
    "status": "active",
    "scope": "project",
    "harnessId": "opencode",
    "harnessConfig": {
      "opencodeSessionId": "ses_new_fork",
      "forkProvenance": {
        "type": "opencode-current-head",
        "status": "created",
        "sourceThreadId": "source-thread-id",
        "sourceThreadName": "Original Name",
        "sourceExchangeId": 123,
        "sourceExchangeSeq": 1,
        "sourceOpenCodeSessionId": "ses_source",
        "createdOpenCodeSessionId": "ses_new_fork"
      }
    }
  },
  "initialExchange": {
    "exchangeId": 456,
    "seq": 2,
    "ts": 1782510000000,
    "turnId": "turn_abc",
    "status": "in_flight",
    "user": "first prompt",
    "attachments": [],
    "assistant": { "parts": [] },
    "metadata": {
      "draftId": "client-draft-id",
      "turnId": "turn_abc",
      "provisional": true,
      "turnStatus": "in_flight"
    }
  },
  "copiedExchangeCount": 1,
  "copiedExchanges": [
    {
      "exchangeId": 123,
      "seq": 1,
      "ts": 1782500000000,
      "user": "source prompt",
      "assistant": { "parts": [] },
      "metadata": {}
    }
  ]
}
```

`thread.messageCount` is the actual committed exchange/turn count. For New Chat
it is normally `1`; for Fork it is copied source exchanges plus the first user
exchange.
The `thread` object is the committed `ThreadEntry` shape. It must include
`threadId`, `name`, `createdAt`, `updatedAt`, `messageCount`, `status`, optional
`scope`, `harnessId`, and `harnessConfig`. The top-level
`thread:draft:committed.threadId` must equal `thread.threadId`. New protocol
payloads must not use `thread.id`; legacy `id` tolerance is a client migration
read path only.
Fork provenance lives in `thread.harnessConfig.forkProvenance`.

Fork hydration contract:

- For `draft.kind === "fork"`, `thread:draft:committed` includes
  `copiedExchanges` containing all copied source exchanges in committed `seq`
  order, followed conceptually by `initialExchange`.
- The client renders/hydrates the fork thread from
  `copiedExchanges + initialExchange`. It must not issue a separate `thread:open`
  just to discover copied history for first render.
- For `draft.kind === "new"`, `copiedExchanges` is omitted or `[]` and
  `copiedExchangeCount` is `0`.
- The later authoritative `thread:list` controls list ordering only; it does not
  replace the copied exchange hydration contract.

Commit ordering rules:

- The server sets `thread.updatedAt` to the same value written to
  `threads.updated_at`.
- Draft commit replaces the pending row using `thread.updatedAt` as the
  committed sort key.
- The server broadcasts an authoritative `thread:list` immediately after
  `thread:draft:committed` in the same workspace broadcast cycle. The client may
  optimistically place the committed row from `thread:draft:committed`, but the
  subsequent `thread:list` is the final committed order.
- Final protocol requires `ThreadEntry.threadId` and `ThreadEntry.updatedAt` on
  every committed `thread:list` row and on `thread:draft:committed.thread`.
- During migration only, the client may tolerate legacy rows that lack
  `updatedAt` by preserving the server-provided list order. New draft/MRU code
  must not emit rows without `updatedAt`, and client-side sorting must not fall
  back to `createdAt` for new rows.

`initialExchange` is a provisional SQLite exchange row. It exists so the first
user bubble, live assistant events, reply chrome, and eventual terminal metadata
all share one stable `exchangeId`.

Event ownership and ordering:

1. Backend chooses or reuses a `turnId` for the first prompt before replaying
   any buffered visible events.
2. Server completes the commit transaction:
   - inserts the real thread row using the reserved future `threadId`
   - copies frozen fork history when applicable
   - inserts the provisional first exchange with `assistant: { "parts": [] }`
     and metadata `{ draftId, provisional: true, turnId, turnStatus:
     "in_flight" }`
3. Server registers the committed thread as routable for stream delivery:
   - owner connection maps `threadId` to the current WebSocket/session
   - `getClientForThread(threadId)` or equivalent can resolve the committed
     runtime/client
   - runtime state is marked routable but busy for the committed `threadId`
     until the first draft turn reaches terminal state
   - this registration is internal and does not emit a second visible
     `wire_ready` for the first draft prompt
4. Server sends `thread:draft:committed` to the owner connection only.
5. Client replaces the pending row with the real thread and hydrates fork history
   from `copiedExchanges` when present. It renders the first user bubble from
   `initialExchange` only if the committed thread is the active chat surface;
   otherwise the copied exchanges and initial exchange are stored for later
   hydration/open.
6. Server initializes the canonical live turn using the same `turnId` and
   `exchangeId`.
7. Server emits/replays `chat:turn_begin` for internal live-turn bookkeeping and
   optional client stream state with:

   ```json
   {
     "threadId": "real-thread-id",
     "turnId": "turn_abc",
     "exchangeId": 456,
     "userInput": "first prompt",
     "renderUserBubble": false,
     "userBubbleSource": "thread:draft:committed"
   }
   ```

8. Server replays or continues buffered visible canonical events for the real
   `threadId`, `turnId`, and `exchangeId`.
9. On `turn_end`, the existing provisional exchange row is finalized in place.

Post-commit stream delivery when focus moved away:

- The owner connection continues to receive buffered replay frames, live
  first-turn frames, `assistant_terminal`, terminal `turn_end`, and
  `chat-turn:saved` for the committed `threadId` even if `activeChatTarget` now
  points at another chat.
- The client routes those frames into the committed-thread history cache keyed
  by `threadId`. It must not render them into the visible chat surface unless
  that same `threadId` is active.
- The client must not wait for a later SQLite hydration/open to know the result
  of the first turn when it received the live frames. Hydration remains a
  fallback for reloads, reconnects, non-owner clients, or missed frames.
- Non-owner workspace subscribers receive the authoritative `thread:list` and
  normal committed-thread broadcasts only according to existing subscription
  rules; they do not receive owner-local `draftId` or pending-intent state.

`thread:draft:committed` is the only event that creates the first user bubble for
a pending draft. The server must not also emit the normal committed-thread
`message:sent` event for that same first prompt. If existing stream plumbing
emits a turn-begin/user-accepted event, the frontend must treat it as metadata or
dedupe it by `draftId`/`exchangeId`. A client that sees
`renderUserBubble: false` must not add another user message.

If the committing signal is also a visible event, that event must not be lost.
If the committing signal is session identity only, it is used for persistence and
must not be rendered as assistant content.

### Provisional Exchange Lifecycle

The current persistence path creates SQLite exchanges on `chat:turn_end` as
complete user+assistant rows. Pending draft commit needs a stable
`initialExchange.exchangeId` earlier than `turn_end`, so implementation must add
an explicit provisional exchange path.

Required storage API:

```ts
HistoryFile.beginExchange(threadId, {
  turnId,
  userInput,
  metadata,
}, { trx, countOwner?: 'historyFile' | 'commitDraft' }) -> { exchangeId, seq, ts }

HistoryFile.finalizeExchange(exchangeId, {
  parts,
  metadata,
  status,
}, { trx? }) -> { exchangeId, seq, ts }
```

Turn status contract:

- `metadata.turnStatus` is the canonical persisted, hydrated, and rendered turn
  status for provisional draft exchanges.
- The top-level `initialExchange.status`, any exchange-row `status` column, and
  the `status` argument passed to `HistoryFile.finalizeExchange()` are mirror
  fields. They must equal `metadata.turnStatus` for the same exchange state.
- New code must render terminal chrome from `metadata.turnStatus` and
  `metadata.assistantTerminal`, not from raw provider payloads or a top-level
  status alone.
- `HistoryFile.finalizeExchange()` must reject or normalize through one code
  path if `status` and `metadata.turnStatus` disagree; it must not persist two
  competing statuses.

Allowed turn statuses:

| `metadata.turnStatus` | When used | Required metadata |
| --- | --- | --- |
| `in_flight` | Provisional exchange inserted at draft commit before terminal state. | `provisional: true`, `turnId`; no required `assistantTerminal`. |
| `complete` | Assistant/thinking/tool output completed without terminal provider failure or user interruption. | `missingAssistantReply: false`; omit `assistantTerminal` unless non-rendered diagnostics are needed. |
| `provider_error` | Structured provider failure after commit. Partial visible output may also exist. | `assistantTerminal.kind: "provider_error"`, `missingAssistantReply: false`. |
| `missing_reply` | Post-commit first-response deadline expired with no visible output or structured provider error. | `assistantTerminal.kind: "missing_reply"`, `missingAssistantReply: true`. |
| `interrupted` | User Stop after commit before normal terminal state. Partial visible output is preserved. | `assistantTerminal.kind: "interrupted"`, `missingAssistantReply: false`. |

Rules:

- `beginExchange()` inserts one row into `exchanges` with `user_input`, empty
  assistant `{ "parts": [] }`, and metadata including:

  ```json
  {
    "draftId": "client-draft-id",
    "turnId": "turn_abc",
    "provisional": true,
    "turnStatus": "in_flight"
  }
  ```

- When `countOwner === "commitDraft"`, `beginExchange()` must not mutate
  `threads.message_count`; `ThreadCommitRepository.commitDraft()` sets the final
  count once in the same transaction. For future non-draft provisional use,
  `countOwner` may default to `"historyFile"` and let `beginExchange()` own the
  count.
- `finalizeExchange()` updates that same row's `assistant` and `metadata`; it
  must not insert another row.
- `audit-subscriber.js` must detect `event.exchangeId` or
  `event.provisionalExchangeId` on `chat:turn_end` and call
  `finalizeExchange()` instead of `addExchange()`.
- `assistant_terminal` events do not call `finalizeExchange()` directly. The
  canonical applier stores the terminal metadata in the live turn accumulator;
  the subsequent terminal `chat:turn_end` carries that metadata and owns the
  durable `finalizeExchange()` call.
- `finalizeExchange()` must be idempotent for the same
  `{ exchangeId, turnId, terminalSeq }` or equivalent terminal identity. A
  duplicate terminal `chat:turn_end` for an already-finalized provisional row
  must not append another assistant object, increment `message_count`, rebuild
  duplicate markdown, or emit duplicate chrome state.
- `HistoryFile.addExchange()` remains valid for existing committed-thread turns
  that do not use a provisional row.
- `beginExchange()` must accept a transaction handle for draft commit. It must
  not open an independent DB transaction when called from `commitDraft()`.
- `chat-turn:saved` is emitted after `finalizeExchange()` with the same
  `exchangeId` returned by `thread:draft:committed.initialExchange.exchangeId`.
- Markdown persistence must follow the same ownership rule: commit may write the
  first user prompt, and turn end finalizes/appends assistant output once. Do
  not produce duplicate first-prompt entries in markdown.

Required bus event fields for provisional turns:

```json
{
  "type": "chat:turn_end",
  "threadId": "real-thread-id",
  "turnId": "turn_abc",
  "exchangeId": 456,
  "provisionalExchangeId": 456,
  "persistenceMode": "finalize_provisional",
  "skipLegacyAssistantAppend": true,
  "parts": [],
  "metadata": {
    "turnStatus": "complete",
    "missingAssistantReply": false
  }
}
```

Branching rules:

- `canonical-chat-event-applier.js` checks
  `skipLegacyAssistantAppend === true` or
  `persistenceMode === "finalize_provisional"` before calling
  `persistAssistantMessage()`. If set, it must not call the legacy append path.
- `audit-subscriber.js` checks `persistenceMode === "finalize_provisional"` or
  `provisionalExchangeId` before `addExchange()`. If set, it calls
  `HistoryFile.finalizeExchange()`.
- For normal non-provisional turns, `persistenceMode` is omitted or
  `"add_exchange"`, `provisionalExchangeId` is absent, and legacy complete-row
  persistence can continue until migrated.

Markdown ownership for provisional exchanges:

- A turn with `event.exchangeId` or `event.provisionalExchangeId` is owned by
  exchange finalization. `canonical-chat-event-applier.js` must not call the
  legacy `persistAssistantMessage()` append path for that turn.
- After `HistoryFile.finalizeExchange()` succeeds, rebuild that thread's
  markdown file from SQLite exchanges in `seq` order. Do not append the
  assistant side to an already appended user prompt.
- Normal committed-thread turns without provisional exchange ids may continue to
  use the existing complete-row `addExchange()` and markdown append path until
  that path is migrated, but they still must obey the exchange-count
  `messageCount` contract.
- The markdown rebuild serializer must skip Fusion-only terminal display text
  such as `Reply not received`; it may include structured metadata comments for
  `assistantTerminal`.

### Draft Commit Failure

All validation rejections, unsupported-harness/attachment rejections, fork source
failures, pre-commit provider failures, and pre-commit timeouts use the same
typed failure envelope:

```json
{
  "type": "thread:draft:failed",
  "workspaceId": "workspace-id",
  "draftId": "client-draft-id",
  "code": "provider_no_commit",
  "message": "Message Send Failed!",
  "recoverable": true,
  "restoreComposer": true,
  "phase": "pre_commit"
}
```

Required fields:

- `code`: stable machine-readable code.
- `message`: user-visible text.
- `recoverable`: whether the pending intent remains editable/sendable.
- `restoreComposer`: whether the client should restore the pending text into
  the composer. Validation and pre-commit failures use `true`; provider-accepted
  commit failures use `false`.
- `phase`: `validation`, `pre_commit`, `commit`, or `cancel`.

Client failure outcomes:

| Matching client state | Required behavior |
| --- | --- |
| Active visible pending intent where `draftId === pendingChatIntent.activeDraftId` and no abandonment has happened | Apply the failure envelope normally. If `recoverable && restoreComposer`, keep the pending row, restore/keep text in the composer, set status `commit_failed`, and allow a later Send with a new `draftId`. If `phase === "commit"` or `recoverable === false`, set `commit_error` and do not restore composer text. |
| Matching `recentDraftAttempts` created by abandonment reason `new_chat`, `fork`, `send_elsewhere`, `workspace_switch`, or `workspace_close` | Mark the recent attempt terminal `failed` or `commit_error` according to the envelope, but do not recreate a pending row, do not restore composer text, and do not change focus, even when `restoreComposer === true`. For `workspace_close`, record/log the terminal state only if the owner connection is still alive; otherwise cleanup may complete without client replay. |
| Matching `recentDraftAttempts` created by `refresh` or `client_disconnect` | Record/log terminal state for replay diagnostics only. No RAM pending UI is expected to survive, and composer text is not restored after reconnect. |
| Unknown `{ workspaceId, draftId }` | Log and ignore. Do not create pending UI or committed-thread UI. |

`restoreComposer` applies only to a still-active visible pending intent. It is
not permission to resurrect abandoned pending work.

Common codes:

| Code | Phase | Meaning |
|---|---|---|
| `draft_no_supported_harness` | `validation` | Client/server config has no enabled installed/built-in harness that supports signal-gated drafts. |
| `draft_harness_unsupported` | `validation` | Harness has not opted into signal-gated drafts. |
| `draft_attachments_unsupported` | `validation` | Pending draft send included non-empty attachments. |
| `draft_duplicate_conflict` | `validation` | Same `draftId` was reused with different payload. |
| `draft_busy` | `validation` | Another active draft/runtime prevents this attempt. |
| `provider_no_commit` | `pre_commit` | Harness exited, timed out, or failed before any committing provider signal. |
| `provider_commit_persistence_failed` | `commit` | Provider accepted the prompt, but Fusion failed to persist the committed thread transaction. |
| `fork_source_not_found` | `validation` | Source thread is missing or outside workspace. |
| `fork_source_wrong_harness` | `validation` | Source thread is not OpenCode-backed. |
| `fork_source_missing_session` | `validation` | Source lacks `harness_config.opencodeSessionId`. |
| `fork_source_busy` | `validation` | Source has active accepting/in-flight/stopping/finalizing turn. |
| `fork_source_not_saved` | `validation` | Latest source turn has not reached saved terminal state. |
| `fork_source_snapshot_failed` | `validation` | Backend cannot freeze source rows before provider startup. |

The server must not leave a partial SQLite thread, markdown file, exchange row,
or provider config entry.

Provider-accepted persistence failure:

If a provider session identity or other harness-specific committing signal was
accepted, but `ThreadCommitRepository.commitDraft()` fails before
`thread:draft:committed`, emit owner-only `thread:draft:failed`:

```json
{
  "type": "thread:draft:failed",
  "workspaceId": "workspace-id",
  "draftId": "client-draft-id",
  "code": "provider_commit_persistence_failed",
  "message": "Provider accepted the message, but Fusion could not save the thread.",
  "recoverable": false,
  "restoreComposer": false,
  "phase": "commit"
}
```

Rules:

- Do not restore the user text to the composer; the provider may already have
  accepted it.
- Do not offer automatic resend/retry for that prompt.
- Client state must mark the pending row or recent attempt as `commit_error`,
  not `commit_failed`. `commit_failed` is reserved for recoverable validation or
  pre-commit failures where the prompt can be edited and sent again.
- Stop the transient runtime when possible.
- Write no partial SQLite rows and emit no `thread:draft:committed`.
- Mark the visible pending attempt terminal with an error state explaining that
  local persistence failed after provider acceptance.
- Log provider session identity, draft id, reserved thread id, workspace, and
  error details for manual repair. Do not expose provider session secrets.

### Draft Cancel

If the client cancels an active `creating` draft before commit, the client sends:

```json
{
  "type": "thread:draft:cancel",
  "workspaceId": "workspace-id",
  "draftId": "client-draft-id",
  "reason": "new_chat"
}
```

Valid reasons include `new_chat`, `fork`, `send_elsewhere`, `workspace_switch`,
`workspace_close`, `refresh`, `client_disconnect`, and `user_stop`.

`user_stop` is used when the visible Stop control is pressed while the pending
draft is still in the `Creating Session...` / pre-commit state.

If cancellation wins before commit, the server sends when possible:

```json
{
  "type": "thread:draft:cancelled",
  "workspaceId": "workspace-id",
  "draftId": "client-draft-id",
  "reason": "new_chat",
  "restoreComposer": false,
  "removePendingIntent": true,
  "focusPolicy": "preserve_current"
}
```

The server must stop the transient runtime, discard the reserved future
`threadId`, and write no durable chat state.

Stop requirements:

- On cancel, call the transient run's stop method when available.
- If the run has not stopped within `DRAFT_STOP_TIMEOUT_MS`, force kill or
  destroy the transient runtime/process and mark the draft cancelled if no
  commit signal has won.
- A forced stop before commit still writes no SQLite thread, exchange, markdown,
  or harness config state.
- If commit has already won, do not emit `thread:draft:cancelled`; route the
  user's Stop to the committed runtime and finish the committed turn through the
  normal stopped/terminal path.

Client cancellation outcomes:

| Cancel reason | Pending row outcome | Composer/text outcome | Focus outcome |
| --- | --- | --- | --- |
| `user_stop` | Keep the same `PendingChatIntent.id`, set status back to `draft`, clear `activeDraftId`, and clear transient overlay/status. | Restore/keep the original pending text in the composer. Do not set `lastFailure` and do not show retry/resend UI. | Keep focus on the pending chat if it is still the active target; otherwise do not steal focus. |
| `new_chat` | Remove the old pending row if it still exists. Mark the recent attempt `cancelled` until TTL pruning. | Do not restore old text; the user has replaced it with a new pending intent. | Preserve the user's current target, normally the new pending row. |
| `fork` | Remove the old pending row if it still exists. Mark the recent attempt `cancelled` until TTL pruning. | Do not restore old text; the user has replaced it with the fork intent. | Preserve the user's current target, normally the fork pending row. |
| `send_elsewhere` | Remove the old pending row if it still exists. Mark the recent attempt `cancelled` until TTL pruning. | Do not restore old text; the user chose to send in another committed thread. | Preserve focus on the committed thread where the user sent. |
| `workspace_switch` | Remove the old pending row from the origin workspace if it still exists. Mark the recent attempt `cancelled` until TTL pruning. | Do not restore text into the newly active workspace. | Do not change the currently active workspace or target. |
| `workspace_close` | Remove the old pending row and mark the recent attempt `cancelled` until TTL pruning if the client is still alive. | Do not restore composer text. | Do not change the currently active workspace or target. |
| `refresh` / `client_disconnect` | No RAM pending row is expected to survive. Terminal replay, if any, is only for the same live connection before close. | Do not restore composer text after reconnect. | Hydration restores only committed durable threads. |

`PendingChatIntent.status` intentionally has no `cancelled` value. A cancellation
that preserves the pending intent (`user_stop`) returns it to editable `draft`.
All abandonment cancellations remove the visible pending intent and record
terminal state only in `recentDraftAttempts`.

The server derives `restoreComposer`, `removePendingIntent`, and `focusPolicy`
from the accepted cancel `reason` using the table above. The client should not
infer different behavior from local UI state.

If commit wins before the cancel is processed, the server must not roll back the
committed thread. It may ignore the cancel or send the already-durable
`thread:draft:committed`/terminal turn events. The frontend must not switch the
active chat in response to a late commit for a draft the user has already moved
away from; it should only add/update the durable thread in the list.

### Draft Idempotency And Duplicate Requests

The backend must keep an active/terminal draft attempt registry keyed by
workspace, connection, and `draftId`. Terminal entries should remain available
for a short TTL, such as five minutes, to handle duplicate sends or late client
messages.

For each accepted `thread:draft:send`, the backend stores a canonical attempt
fingerprint before provider startup. Duplicate same-`draftId` requests compare
against that fingerprint.

Canonical fingerprint fields:

```ts
type DraftAttemptFingerprint = {
  protocolVersion: 1;
  workspaceId: string;
  kind: 'new' | 'fork';
  harnessId: string;
  title: string;
  sourceThreadId: string | null;
  userInput: string;
  attachments: [];
};
```

Normalization rules:

- `workspaceId`, `kind`, `harnessId`, `sourceThreadId`, and `title` are the
  server-validated values after normal draft validation and title normalization.
- Title normalization is one shared server helper used by both fingerprinting
  and commit: convert to string, trim leading/trailing whitespace, replace
  internal CR/LF/tab runs with one space, apply the existing thread-title length
  limit, and fall back to `New Chat` for new-chat drafts or
  `Forked Chat: {{Source Name}}` for fork drafts when the normalized title is
  empty.
- `userInput` is compared exactly after JSON decoding. Do not trim, collapse
  whitespace, or otherwise normalize prompt text for idempotency.
- Attachments are out of scope for the first implementation. Omitted
  `attachments` and `attachments: []` both normalize to `attachments: []`.
  Non-empty attachments are rejected before fingerprint acceptance.
- Fork source snapshot rows, source revision metadata, provider session ids,
  reserved future `threadId`, `turnId`, and timestamps are not part of the
  duplicate fingerprint. They are frozen by the first accepted request and
  replayed for exact duplicate requests.
- Unknown protocol fields are not part of the fingerprint. New code should not
  send them; if compatibility code tolerates them, they must not change duplicate
  behavior.

Rules:

- Only one pre-commit active draft attempt may exist per `connectionId`,
  regardless of workspace.
- A duplicate `thread:draft:send` with the same `draftId` and identical payload
  must not start a second transient harness runtime.
- If the duplicate arrives while the attempt is active, replay the original
  `thread:draft:accepted` payload. Do not reset `acceptedAt` or extend
  deadlines. The payload shape is:

  ```json
  {
    "type": "thread:draft:accepted",
    "workspaceId": "workspace-id",
    "draftId": "client-draft-id",
    "status": "creating",
    "acceptedAt": 1782510000000,
    "timeoutPolicy": {
      "pendingIndicatorMs": 10000,
      "hourglassMs": 10000,
      "firstTerminalDeadlineAt": 1782510020000
    }
  }
  ```

- If the duplicate arrives after a terminal result, replay the same terminal
  result when available: `thread:draft:committed`, `thread:draft:failed`, or
  `thread:draft:cancelled`.
- A duplicate `thread:draft:send` with the same `draftId` but different prompt,
  harness, or source metadata is rejected with recoverable error code
  `draft_duplicate_conflict`.
- A second `thread:draft:send` with a different `draftId` while another draft is
  active is treated as replacement abandonment of the earlier draft only after
  the new request passes validation. If the replacement request fails validation,
  emit `thread:draft:failed(newDraftId)` and leave the earlier active attempt
  unchanged. If validation passes, the backend cancels the earlier attempt if it
  has not committed, waits for that earlier attempt to reach terminal state or
  commit-win, then starts the new attempt. If the earlier attempt already
  committed, it remains durable and the new attempt may proceed only if normal
  runtime busy rules allow it.
- `thread:draft:cancel` after `thread:draft:failed` or
  `thread:draft:cancelled` is idempotent and may replay the terminal result.
- `thread:draft:cancel` after `thread:draft:committed` is a no-op for
  persistence. It must not delete or roll back the committed thread.
- WebSocket reconnect does not resume pre-commit draft attempts. Connection
  close cancels uncommitted attempts. If commit already won, the durable thread
  is recovered through normal `thread:list`/`thread:open` hydration.

Active draft conflict policy:

| Situation | Required behavior |
| --- | --- |
| Same connection sends the same `draftId` with identical payload while active | Replay the original `thread:draft:accepted`; do not start a second runtime. |
| Same connection sends the same `draftId` with different payload | Reject with `draft_duplicate_conflict`; keep the original active attempt unchanged. |
| Same pending intent retries after recoverable `commit_failed` | Client mints a new `draftId`; server treats it as a new attempt. |
| New Chat/Fork replaces a local pending intent with no active send | Frontend discards the old RAM intent and creates the new one; no server request is needed. |
| New Chat/Fork while a draft is active pre-commit | Treat as abandonment of the old attempt. The frontend may remove the old visible pending row and show the replacement RAM pending row immediately, but it must send/call cancel for the old `draftId` and must not send `thread:draft:send` for the replacement until the old attempt reaches cancel/fail terminal state or commit wins. |
| Send elsewhere while a draft is active pre-commit | Treat as abandonment of the old attempt. The frontend may move focus to the committed target immediately, but the committed-thread prompt must not be accepted/persisted until the old attempt reaches cancel/fail terminal state or commit wins. |
| Second active draft request from the same connection, in any workspace, with a different `draftId` and no explicit abandoned id | Backend validates the replacement request first. If invalid, fail the new draft and keep the old active attempt unchanged. If valid, cancel the earlier pre-commit attempt if possible, wait for terminal state or commit-win, then accept/start the new attempt. |
| Second active draft from a different connection in the same workspace | Allowed as an independent owner-local draft attempt. Owner-only `thread:draft:*` frames stay on their originating connection; committed `thread:list` broadcasts are workspace-wide. |
| New draft would target a committed runtime/resource that is already busy after an earlier commit won | Reject or delay according to the existing committed-runtime busy policy; use `draft_busy` only for this real runtime/resource conflict, not for ordinary New Chat/Fork replacement. |
| Cancel arrives after terminal failure/cancel | Replay or ignore the terminal result idempotently. |
| Cancel arrives after commit | No rollback; route any stop behavior through committed runtime rules. |

Replacement frame ordering:

This is a defensive backend ordering path for malformed, stale, or racing
clients. Normal frontend behavior must not send replacement
`thread:draft:send(newDraftId)` until the old attempt reaches cancel/fail
terminal state or commit wins.

1. Backend receives replacement `thread:draft:send(newDraftId)` while
   `oldDraftId` is active for the same `connectionId`, regardless of workspace.
2. Backend validates `newDraftId` request without starting a provider and
   without cancelling `oldDraftId`.
3. If validation fails, backend emits `thread:draft:failed(newDraftId)` with the
   typed validation failure and leaves `oldDraftId` active.
4. If validation succeeds, backend records the replacement request as pending
   and starts/calls cancel for `oldDraftId`.
5. If cancel wins before commit, backend emits/replays
   `thread:draft:cancelled(oldDraftId)` when possible, then starts
   `newDraftId`, then emits `thread:draft:accepted(newDraftId)`.
6. If commit wins for `oldDraftId`, backend emits/replays
   `thread:draft:committed(oldDraftId)` and keeps that thread durable. It then
   starts `newDraftId` only if normal runtime busy/resource rules allow it;
   otherwise it fails `newDraftId` with typed `draft_busy`.
7. Backend must not emit `thread:draft:accepted(newDraftId)` before `oldDraftId`
   has reached cancel/commit/fail terminal state. This gives the client one
   ordered state transition instead of overlapping active draft attempts on the
   same connection.

### Provider Failure Display

If the harness returns a structured provider error after a visible event has
already committed the draft, Fusion represents the failure in exchange chrome for
that turn. If the structured provider error includes provider session identity
but no earlier commit signal exists, the adapter must emit provider session
identity first to commit the draft, then emit the terminal failure event.

For OpenCode JSON mode, a known shape is:

```json
{
  "type": "error",
  "sessionID": "ses_...",
  "error": {
    "name": "UnknownError",
    "data": {
      "message": "Unexpected server error. Check server logs for details.",
      "ref": "err_..."
    }
  }
}
```

The OpenCode harness adapter must translate this provider-specific event into a
universal canonical failure event. The universal chat applier and renderer should
not need OpenCode-specific branching to display it.

The failure display should prefer structured provider fields when
available:

- provider/harness name
- error name or code
- error message
- provider reference id
- process exit code/signal only as diagnostics on an already-classified
  `provider_error` or completed visible-output turn; process exit alone does not
  create rendered provider-error chrome when the precedence matrix says
  `missing_reply`

This failure display appears where the assistant reply would normally be
represented, with completed-turn chrome beneath it. It is not assistant message
content, is not sent back as assistant history, is not a draft-send failure, and
must not return the committed prompt to the input as editable replacement text.

### Terminal Assistant Metadata Contract

Provider failure and missing-reply states must use a single universal metadata
shape in canonical events, SQLite exchange metadata, hydration payloads, and
renderer conditions.

Canonical terminal event payload:

```json
{
  "type": "assistant_terminal",
  "timestamp": 1782510000000,
  "turnId": "turn_abc",
  "exchangeId": 456,
  "commitsDraft": false,
  "render": true,
  "requiresCommittedThread": true,
  "assistantTerminal": {
    "kind": "provider_error",
    "severity": "error",
    "harnessId": "opencode",
    "provider": "opencode",
    "errorName": "UnknownError",
    "errorCode": null,
    "message": "Unexpected server error. Check server logs for details.",
    "ref": "err_...",
    "exitCode": null,
    "signal": null,
    "retryable": false
  }
}
```

Missing reply uses the same shape with:

```json
{
  "type": "assistant_terminal",
  "timestamp": 1782510000000,
  "turnId": "turn_abc",
  "exchangeId": 456,
  "commitsDraft": false,
  "render": true,
  "requiresCommittedThread": true,
  "assistantTerminal": {
    "kind": "missing_reply",
    "severity": "error",
    "harnessId": "opencode",
    "provider": "opencode",
    "message": "Reply not received",
    "retryable": false
  }
}
```

Terminal assistant events are post-commit turn-finalization events. They do not
commit a pending draft by themselves.

`assistantTerminal` is the only canonical field name. Do not emit or consume a
`terminal` alias. The same object is copied to
`ExchangeData.metadata.assistantTerminal` during persistence and hydration.

Public WebSocket frame for live rendering:

```json
{
  "type": "assistant_terminal",
  "threadId": "real-thread-id",
  "turnId": "turn_abc",
  "exchangeId": 456,
  "assistantTerminal": {
    "kind": "provider_error",
    "severity": "error",
    "harnessId": "opencode",
    "provider": "opencode",
    "errorName": "UnknownError",
    "errorCode": null,
    "message": "Unexpected server error. Check server logs for details.",
    "ref": "err_...",
    "exitCode": null,
    "signal": null,
    "retryable": false
  },
  "metadata": {
    "turnStatus": "provider_error",
    "assistantTerminal": {
      "kind": "provider_error",
      "severity": "error",
      "harnessId": "opencode",
      "provider": "opencode",
      "errorName": "UnknownError",
      "errorCode": null,
      "message": "Unexpected server error. Check server logs for details.",
      "ref": "err_...",
      "exitCode": null,
      "signal": null,
      "retryable": false
    },
    "missingAssistantReply": false
  },
  "renderAsAssistantChrome": true,
  "assistantText": ""
}
```

Live protocol and persistence rules:

- The server broadcasts `assistant_terminal` before or alongside the terminal
  `turn_end` broadcast for that exchange.
- `wire-broadcaster.js` must include `threadId`, `turnId`, `exchangeId`,
  `metadata`, and `assistantTerminal` on the public frame.
- `stream-handlers.ts` must handle `assistant_terminal` by adding/updating the
  assistant-side chrome for the live exchange without adding assistant text.
- Terminal `chat:turn_end` is the only event that calls
  `HistoryFile.finalizeExchange()` for provisional draft exchanges.
- `turn_end`, `exchange_metadata`, and `chat-turn:saved` may carry the same
  `metadata.assistantTerminal` for persistence/hydration, but they must be
  idempotent with the live `assistant_terminal` frame and must not create
  duplicate chrome.
- The live renderer must not depend on a hidden audit-only event.
- The client treats `assistantText: ""` plus `renderAsAssistantChrome: true` as
  metadata chrome, not model output.

Commit rules:

- A provider error can lead to a committed provider-failure turn only if a
  separate committing provider signal has already occurred, such as provider
  session identity, visible assistant/tool output, or a provider error that
  itself includes provider session identity and is normalized into a commit
  signal first.
- For OpenCode `type: "error"` events that include `sessionID`, the adapter must
  emit or expose provider session identity with `commitsDraft: true`, then emit
  `assistant_terminal` with `commitsDraft: false`.
- If a timeout or process failure happens before any committing provider signal,
  the backend emits `thread:draft:failed` and writes nothing. It must not
  synthesize `assistant_terminal`.
- `missing_reply` is post-commit only. It is created only after provider session
  identity or another committing provider signal already made the thread
  durable.

Exchange metadata keys:

```json
{
  "turnId": "turn_abc",
  "turnStatus": "provider_error",
  "assistantTerminal": {
    "kind": "provider_error",
    "severity": "error",
    "harnessId": "opencode",
    "provider": "opencode",
    "message": "Unexpected server error. Check server logs for details.",
    "ref": "err_..."
  },
  "missingAssistantReply": false
}
```

For missing replies, set:

```json
{
  "turnStatus": "missing_reply",
  "assistantTerminal": {
    "kind": "missing_reply",
    "severity": "error",
    "message": "Reply not received"
  },
  "missingAssistantReply": true
}
```

For committed Stop/interrupted turns, set:

```json
{
  "turnStatus": "interrupted",
  "missingAssistantReply": false,
  "assistantTerminal": {
    "kind": "interrupted",
    "severity": "info",
    "message": "Response stopped",
    "retryable": false
  },
  "partial": true
}
```

Storage and hydration rules:

- The `assistant` column remains `{ "parts": [] }` unless partial visible
  assistant/tool parts were received before the terminal state.
- Never store `Reply not received` or provider error display text as a text part
  unless it was actually model-visible assistant output.
- `ExchangeData.metadata.assistantTerminal.kind === "missing_reply"` or
  `metadata.missingAssistantReply === true` renders Material `error` plus
  `Reply not received`.
- `ExchangeData.metadata.assistantTerminal.kind === "provider_error"` renders
  the provider failure chrome using `assistantTerminal.message` and any
  structured fields.
- `ExchangeData.metadata.assistantTerminal.kind === "interrupted"` or
  `metadata.turnStatus === "interrupted"` renders completed-turn chrome with any
  partial visible assistant/tool output that arrived before Stop. If no visible
  output exists, render a subdued metadata marker such as `Response stopped`,
  not an error marker.
- Completed-turn chrome renders when `turnStatus` is `complete`,
  `provider_error`, `missing_reply`, or `interrupted`.
- `interrupted` is terminal and saved. The first draft turn becomes ready for
  follow-up sends after the interrupted `chat:turn_end` finalizes the
  provisional exchange.

---

## 6. Commit Gate

The server must start the harness in a transient runtime and buffer events until
the first committing provider signal.

Flow:

1. Receive `thread:draft:send`.
2. Validate draft metadata, harness support, idempotency, and attachment
   constraints.
3. Generate a reserved future `threadId`.
4. Generate a stable `turnId` for the first prompt. This `turnId` is used for
   `thread:draft:committed.initialExchange`, `chat:turn_begin`, all replayed
   visible events, and `chat:turn_end`.
5. If this is a fork, resolve and freeze the fork source snapshot:
   - `sourceThreadId`
   - `sourceThreadName`
   - `sourceOpenCodeSessionId`
   - latest saved `sourceExchangeId`
   - latest saved `sourceExchangeSeq`
   - copied source exchange rows through that exchange, including visible
     user/assistant parts and metadata
   - source thread revision timestamp or equivalent if available
6. Freeze `DraftWorkspaceContext`, register the active draft attempt against
   `{ workspaceId, connectionId, draftId }`, and emit
   `thread:draft:accepted` with backend timeout policy and deadlines. The
   backend first-response timer starts at `acceptedAt`.
7. Build a transient runtime for the selected harness using explicit draft
   inputs:
   - `draftId`
   - reserved future `threadId`
   - stable `turnId`
   - `harnessId`
   - transient `harnessConfig`
   - `projectRoot`
   - scope/workspace context
   - first prompt
   - frozen fork source snapshot, if this is a fork
8. Call `startTransientDraftHarness()` once. The adapter starts/sends the first
   prompt from the `firstPrompt` input exactly once. Do not call
   `spawnThreadWire()` for this path, do not call a separate `send()` for the
   first prompt, and do not insert a temporary thread row to satisfy
   committed-thread runtime code.
9. Ignore non-committing local/synthetic events.
10. If a cancellation request or connection close arrives before commit:
   - mark the active attempt cancelled
   - stop transient runtime using the `DRAFT_STOP_TIMEOUT_MS` stop/kill policy
   - discard buffered events/config patches and the reserved future `threadId`
   - emit `thread:draft:cancelled` when possible
   - write nothing durable
11. If the harness errors before a committing provider signal:
   - stop transient runtime
   - send `thread:draft:failed`
   - discard the reserved future `threadId`
   - write nothing durable
12. On first committing provider signal:
   - atomically check the active attempt has not been cancelled and mark it
     `commit_in_progress`
   - create the SQLite thread row with the reserved future `threadId`
   - copy fork history from the frozen source snapshot if this is a fork
   - create a provisional exchange row with the stable `turnId`, user prompt,
     empty assistant parts, and `turnStatus: "in_flight"`
   - persist harness config captured before or during commit
   - commit SQLite
   - create or rebuild the derived markdown file, marking it dirty if that write
     fails
   - send `thread:draft:committed`
   - emit `chat:turn_begin` with `renderUserBubble: false`
   - replay any buffered visible event through the normal stream pipeline
13. If the harness fails after commit:
   - keep the thread
   - preserve any partial streamed output/tool state available
   - classify terminal metadata using Post-Commit Terminal Precedence
   - finalize the exchange so completed-turn chrome renders

Process-level failure metadata such as exit code, signal, stderr, or adapter
error message may be stored as diagnostics under `assistantTerminal.diagnostics`
or internal logs. It must not override the terminal precedence matrix or become
rendered provider-error chrome unless the harness adapter emitted a structured
provider error.

The commit write should be transactionally grouped where SQLite is involved:
thread row, copied fork exchanges, provisional first exchange, message count,
and initial harness config must not be half-written.

Transaction owner:

```ts
ThreadCommitRepository.commitDraft({
  workspaceId,
  threadId,
  thread,
  copiedExchanges,
  initialExchange,
  harnessConfig,
  messageCount,
  updatedAt,
}) -> {
  thread,
  copiedExchanges,
  initialExchange,
}
```

Rules:

- `ThreadCommitRepository.commitDraft()` owns the SQLite transaction.
- It uses one `trx` for inserting the `threads` row, copying fork exchanges,
  inserting the provisional first exchange through
  `HistoryFile.beginExchange(..., { trx, countOwner: "commitDraft" })`,
  setting `threads.message_count` exactly once using the New Chat/Fork algorithm
  above, setting `threads.updated_at` to the timestamp supplied by
  `ThreadMruService` policy, and writing initial `harness_config`.
- Low-level helpers called by `commitDraft()` must accept `{ trx }` and must not
  open independent DB handles for the same write.
- If any SQLite step fails, the transaction rolls back. The server must not emit
  `thread:draft:committed`, must not rebuild markdown, and must not leave partial
  thread/exchange/count/config rows.
- Markdown rebuild runs only after `commitDraft()` returns successfully.

SQLite is the durable source of truth. Markdown chat files are derived artifacts
and cannot participate in the SQLite transaction.

Markdown write rules:

- Do not write or rebuild markdown before the SQLite commit succeeds.
- If SQLite commit fails before `thread:draft:committed`, do not emit
  `thread:draft:committed`. If a provider session was already accepted, emit
  `thread:draft:failed` with code `provider_commit_persistence_failed`,
  `recoverable: false`, and `restoreComposer: false`, then log the orphan-risk
  condition for manual repair.
- If SQLite commit succeeds but markdown write/rebuild fails, keep the committed
  SQLite thread durable and mark the thread's `harness_config` with Fusion-owned
  sync metadata:

  ```json
  {
    "fusion": {
      "markdownSyncStatus": {
        "state": "dirty",
        "reason": "draft_commit_rebuild_failed",
        "dirtyAt": 1782510000000,
        "lastError": "filesystem error message"
      }
    }
  }
  ```

- Preserve existing provider harness config when writing the `fusion` namespace.
  Do not overwrite `opencodeSessionId` or fork provenance.
- Emit `thread:sync_status` with `{ threadId, markdownSyncStatus }` whenever the
  state changes to `dirty` or back to `clean`, and upsert/broadcast the updated
  thread entry so the client has the latest `harnessConfig.fusion` state.
- A repair path named `thread:markdown:rebuild` rebuilds the markdown file from
  SQLite exchanges for one committed thread. On success, set
  `harness_config.fusion.markdownSyncStatus.state = "clean"` or remove the
  status object, then emit `thread:sync_status`.
- Hydration and future sends must read SQLite, not markdown, while
  `harness_config.fusion.markdownSyncStatus.state === "dirty"`.
- A later successful rebuild clears or marks clean the same
  `harness_config.fusion.markdownSyncStatus` object.

Fork source copying must use the frozen source snapshot captured at draft-send
validation, not "latest source thread at commit time." If a source-thread Send
is requested while the fork attempt is still pre-commit, that Send follows the
generic abandonment rule and cancels/resolves the fork before prompt acceptance.
If the fork already committed, it copies only through the frozen
`sourceExchangeId`/`sourceExchangeSeq` that matches the OpenCode
`--session <sourceOpenCodeSessionId> --fork` run. Non-Send source metadata
changes after snapshot freeze do not affect the fork. The backend must not
silently recalculate or copy a newer snapshot at commit time.

After the draft commits, the runtime may attach the active harness session to
the normal committed-thread registry using the same reserved id. From that point
forward the thread is no longer a draft, but follow-up sends still obey the
first-turn busy rule defined below. Once the first draft turn is terminal,
follow-up sends use the normal committed-thread runtime.

### Post-Commit Event Ownership

The first draft turn has exactly one event-drain owner.

Rules:

- `DraftCommitService` owns the `DraftHarnessRun.events` iterator from
  transient harness start until the first draft turn reaches terminal state
  through terminal `chat:turn_end` carrying `persistenceMode:
  "finalize_provisional"` / `provisionalExchangeId`, after
  `HistoryFile.finalizeExchange()` succeeds or idempotently confirms the row is
  already finalized.
- Commit does not transfer ownership of that first-turn iterator to
  `thread-runtime-controller`. After commit, `DraftCommitService` continues to
  map buffered and live first-turn events to the committed `threadId`, stable
  `turnId`, and `exchangeId`, then calls the canonical applier with those
  explicit ids.
- The canonical applier must not infer draft first-turn routing from mutable UI
  fields such as `session.currentThreadId`. Draft replay/applier calls carry
  explicit `threadId`, `turnId`, `exchangeId`, and `draftId`.
- `attachCommittedRuntime()` registers the provider client/session for
  committed-thread lookup, stop, and future sends. It does not start another
  drain of the first-turn event iterator.
- `assistant_terminal` alone does not release first-turn ownership, clear busy
  state, or allow follow-up sends. It is live metadata only until terminal
  `chat:turn_end` finalizes the provisional exchange.
- Follow-up sends on the committed thread are not accepted until the first draft
  turn is terminal and the committed runtime registry marks the attachment ready
  for the next prompt. Before that point, normal runtime busy rules apply.
- After the first draft turn is terminal, `DraftCommitService` releases
  first-turn ownership. Future committed-thread sends own their own event
  streams through the normal committed runtime controller.
- If the transient adapter exits before or immediately after commit, no live
  runtime is attached. The committed thread remains durable, and later sends
  resume through the normal committed-thread path using persisted harness config.

### Runtime Boundary

`spawnThreadWire(threadId, projectRoot, scopeContext)` remains committed-thread
only.

Do not overload it with `draftId`, nullable thread records, or "maybe persisted"
branches. Its current job is to:

- load harness info from an existing persisted `threadId`
- start/resume that committed thread's harness session
- register the wire under that committed `threadId`
- write harness config updates back to that committed thread

Pending draft send needs a separate transient starter, for example:

```ts
type DraftHarnessRun = {
  events: AsyncIterable<CanonicalDraftEventBase>;
  getRuntimeClient?(): object | null;
  getProviderSessionId?(): string | null;
  attachCommittedRuntime?(input: {
    threadId: string;
    workspaceId: string;
    connectionId: string;
    projectRoot: string;
    scopeContext: object;
  }): Promise<CommittedRuntimeAttachment>;
  stop(reason: string): Promise<void>;
};

type CommittedRuntimeAttachment = {
  threadId: string;
  client: object | null;
  ready: boolean;
  send(prompt: string, options?: object): Promise<void>;
  stop(reason: string): Promise<void>;
};

startTransientDraftHarness({
  draftId,
  reservedThreadId,
  harnessId,
  transientHarnessConfig,
  projectRoot,
  scopeContext,
  firstPrompt,
  forkSource,
  onHarnessConfigPatch,
}) -> Promise<DraftHarnessRun>
```

`startTransientDraftHarness()` owns the first prompt. The caller passes
`firstPrompt` once, and the adapter starts/sends that prompt exactly once before
or as part of returning `DraftHarnessRun`. Draft callers must not call a second
`send()` for the first prompt. `CommittedRuntimeAttachment.send()` is only for
future committed-thread sends after the first draft turn has reached a terminal
state and the runtime attachment is marked ready.

That transient starter owns only the pre-commit gap and the first draft turn's
event stream. Shared lower-level helpers are encouraged for provider startup
mechanics, such as runtime-config resolution, harness initialization,
canonical-event normalization, session stop, and config patch capture. The
public committed-thread API should stay narrow so draft behavior does not leak
into normal resume behavior.

### Draft Commit Service Contract

Add a server-owned `DraftCommitService` under the thread/runtime boundary. It is
the only owner of active draft attempts.

Responsibilities:

- Maintain `activeDraftAttempts` keyed by `{ workspaceId, connectionId,
  draftId }` plus one active pre-commit attempt per `connectionId` across all
  workspaces.
- Validate draft request, harness support, attachments, idempotency, and fork
  source snapshot before provider startup.
- Resolve and freeze `DraftWorkspaceContext` before emitting
  `thread:draft:accepted`; all later commit/cancel/failure writes and broadcasts
  use that context, never mutable current-workspace session fields.
- Reserve the future `threadId` and stable `turnId`.
- Start the selected adapter through `startTransientDraftHarness()`, not through
  `spawnThreadWire()`.
- Consume the returned `events` async iterable until terminal process end,
  cancellation, timeout, or committed turn end.
- Buffer canonical events by `draftId` until commit. Buffered events retain the
  canonical fields from §3, including `commitsDraft`, `render`,
  `assistantTerminal`, provider identity fields, `turnId`, and `exchangeId`.
- Convert pre-commit transient `status_update` events into public
  `thread:draft:status` frames keyed by `draftId`.
- Buffer `onHarnessConfigPatch(patch)` calls in memory before commit. Do not
  call persisted `updateHarnessConfig()` while the draft is pre-commit.
- On the first valid committing provider signal, run the commit transaction,
  after atomically transitioning the attempt from active pre-commit to
  `commit_in_progress`. Once this transition succeeds, cancel cannot win.
  Persist buffered harness config patches, register the committed thread as
  routable for the owner connection/runtime, emit `thread:draft:committed` to
  the owner connection, then replay buffered visible/terminal events through
  the canonical applier with the committed `threadId`, stable `turnId`, and
  provisional `exchangeId`.
- After commit, attach the running harness session to the normal committed
  runtime registry under the reserved `threadId` if the adapter run is still
  alive. Attachment must populate the same lookup path used by committed-thread
  sends, including `getClientForThread`/runtime client access and
  thread-to-connection routing. It must mark the runtime routable but busy until
  the first draft turn is terminal, and it must not emit a second visible
  `wire_ready` user event for the draft prompt.
- If the adapter process has already ended after commit, do not attach a live
  runtime; normal reopen/send may resume from persisted harness config.
- Follow-up sends after a live attachment use the attached runtime without
  respawning only after the first draft turn is terminal. If no live attachment
  exists, follow-up sends use normal committed-thread resume from persisted
  harness config.
- On pre-commit cancel/failure/timeout, call `run.stop(reason)` when available,
  enforce `DRAFT_STOP_TIMEOUT_MS` for cancellation, discard buffered
  events/config, discard the reserved `threadId`, and emit the terminal draft
  failure/cancel event.
- Expose `cancelByConnection(connectionId, reason)` for WebSocket close cleanup.
  It cancels every pre-commit active draft owned by that connection and leaves
  already committed attempts durable.

Adapter requirements:

- A harness that declares `supportsSignalGatedDraft` must implement
  `startTransientDraftHarness()` or an equivalent adapter method used only by
  `DraftCommitService`.
- Existing committed-thread `startThread`/`spawnThreadWire()` paths stay
  unchanged except for shared lower-level helpers.
- OpenCode adapter config patches such as `{ opencodeSessionId }` must be sent
  through `onHarnessConfigPatch` during draft runs; the service persists them
  only at or after commit.

---

## 7. SQLite and Markdown Rules

### Before Committing Provider Signal

There must be no writes to:

- `threads`
- `exchanges`
- markdown chat files
- persisted `harness_config`
- durable Fusion/provider session association

Allowed pre-commit state:

- frontend RAM pending intent
- backend active draft attempt memory
- transient harness process/session
- reserved future `threadId` held in memory

All allowed pre-commit state must be discarded on pre-commit failure or
cancellation.

### On Commit

New Chat commit writes:

- `threads` row
- markdown chat file
- provisional first exchange row containing first user prompt, empty assistant
  parts, `turnId`, `draftId`, and `turnStatus: "in_flight"`
- selected `harness_id`
- committed provider session id/config required by the harness. For OpenCode,
  `harness_config.opencodeSessionId` is required at commit.

Fork Chat commit writes:

- `threads` row
- copied source exchanges from the frozen send-time snapshot
- markdown chat file rebuilt from copied history plus the first prompt
- provisional first exchange row containing first user prompt, empty assistant
  parts, `turnId`, `draftId`, and `turnStatus: "in_flight"`
- `forkProvenance`
- selected `harness_id`
- committed provider session id/config required by the harness. For OpenCode,
  the new fork `harness_config.opencodeSessionId` is required at commit.
- new provider session id/config if already known

The fork source snapshot is selected at draft-send validation time, not click
time and not commit time.

### After Commit Failure

If the harness fails after one or more visible events, or after provider session
identity has committed the thread, the thread stays durable. The failed or
missing-reply turn must be represented in durable state well enough that reopen
can show:

- the user prompt
- partial assistant/tool output if any
- failed or missing-reply state
- completed-turn chrome

The original user prompt is immutable after provider commit. For OpenCode, that
lock begins only when `sessionID` commits the draft. For other harnesses, it
begins when the adapter emits an explicit commit-capable provider signal, such
as provider session identity or a visible event marked `commitsDraft: true`.
Visible OpenCode output before `sessionID` is not prompt-locking by itself.
After a later `sessionID` commits the draft, the UI must not offer to delete,
replace, or silently retry that committed first prompt as if it never happened.

After a committed failure or missing reply, the next user action is the normal
Send flow in the same provider-backed thread. Fusion must not add special
`Continue`, `Recover`, `Resend`, or `Retry` controls.

### On Turn End After Draft Commit

When a draft committed with a provisional exchange, `chat:turn_end` must update
that exchange row in place:

- update `assistant` to `{ "parts": [...] }`
- merge audit metadata, token/context usage, terminal metadata, and final
  `turnStatus`
- set `metadata.provisional = false`
- emit `chat-turn:saved` with the same `exchangeId`

It must not call `HistoryFile.addExchange()` for the same user prompt. Normal
committed-thread sends that did not create a provisional exchange may continue
to use the existing complete-row `addExchange()` path.

### OpenCode Empty Assistant Storage

Observed OpenCode `1.17.10` behavior:

- a failed run can create a durable OpenCode session row
- the user prompt can be stored as a user message with a message id and text part
- the assistant side may be absent, or may exist only as an assistant message
  shell with no assistant parts
- a later `opencode run --session <id> ...` can continue that same session and
  append a normal user/assistant exchange after earlier empty assistant shells

Therefore, after Fusion has seen an OpenCode `sessionID`, it must assume the user
prompt may already be part of OpenCode history even if no assistant text was
returned. Fusion should save the local user bubble and store a missing-reply
metadata marker, such as `[material-symbol:error] Reply not received`, rather than
trying to treat the send as unsent. The marker is render metadata, not assistant
history.

Normal Send after a missing reply is valid for OpenCode. Fusion does not need a
special recovery path solely because an earlier assistant reply was empty.

---

## 8. OpenCode Fork Rules

OpenCode current behavior requires `--session <sourceSessionId> --fork` on the
first fork prompt.

Under this spec:

1. Fork click stores only `sourceThreadId` in RAM.
2. Fork send validates the source against the Fork Source Eligibility rules
   below and freezes that source snapshot in the backend active draft attempt.
3. Server validates:
   - source thread exists in current workspace
   - source thread is OpenCode-backed
   - source thread has `harness_config.opencodeSessionId`
   - source thread satisfies the operational eligibility rules below
4. The frozen source snapshot includes:
   - source thread id/name
   - source OpenCode session id
   - latest saved source exchange id/seq
   - source revision timestamp or equivalent if available
5. The transient OpenCode run uses:

   ```text
   opencode run --format json --dir <projectRoot> --session <sourceOpenCodeSessionId> --fork "<first prompt>"
   ```

6. When OpenCode returns a committing provider signal, Fusion commits the fork
   thread.
7. The committed fork copies Fusion history only through the frozen source
   exchange id/seq. It must not recalculate the latest source exchange at commit
   time.
8. When OpenCode returns the new fork `sessionID`, Fusion stores it as the fork
   thread's `opencodeSessionId`.
9. `sourceOpenCodeSessionId` is provenance and fork input only. It must never be
   stored as the fork thread's active `opencodeSessionId`.

### Fork Source Eligibility

Fork validation happens on `thread:draft:send` before OpenCode starts.

Eligible source:

- Source thread exists in the current workspace.
- `harnessId === "opencode"`.
- `harness_config.opencodeSessionId` is present.
- Source runtime is not accepting, in flight, stopping, finalizing, or otherwise
  locked by an active turn.
- Latest source turn, if any, is terminal: `complete`, `provider_error`,
  `missing_reply`, or `interrupted`.
- Legacy source exchanges with missing `metadata.turnStatus` are treated as
  terminal `complete` if they are persisted in SQLite and the source runtime is
  not busy. This matches the old `HistoryFile.addExchange()` behavior, where
  rows were inserted only after turn end.
- Missing `turnStatus` never overrides live runtime state. If runtime state says
  the source is accepting, in flight, stopping, or finalizing, return
  `fork_source_busy` even when the latest saved exchange looks complete.
- Empty source history is allowed if an OpenCode session id exists. In that case
  `sourceExchangeId` is `null`, `sourceExchangeSeq` is `0`, and no Fusion
  exchanges are copied.

Ineligible source failures happen before provider startup, emit
`thread:draft:failed`, and write no durable state:

| Code | Condition |
|---|---|
| `fork_source_not_found` | Source thread is missing or outside the workspace. |
| `fork_source_wrong_harness` | Source thread is not OpenCode-backed. |
| `fork_source_missing_session` | Source lacks `harness_config.opencodeSessionId`. |
| `fork_source_busy` | Source has an active accepting/in-flight/stopping/finalizing turn. |
| `fork_source_not_saved` | Latest source turn exists but has not reached a saved terminal state. |
| `fork_source_snapshot_failed` | Backend cannot freeze source exchange rows before provider startup. |

Snapshot race rules:

- The backend freezes source exchange rows and source session metadata before
  starting OpenCode.
- Once frozen, later non-Send source metadata changes do not affect the fork.
- Any Send on an existing committed thread, including the fork source thread,
  is an abandonment action for a pending or creating fork intent. If the fork
  draft is still pre-commit, the backend cancels it before accepting the source
  send. If the fork already committed, the committed fork remains durable and
  the source send proceeds only if normal runtime busy rules allow it.
- If a separate non-Send source metadata/history mutation somehow lands after
  the fork snapshot is frozen and before the fork attempt is cancelled or
  committed, it does not change the frozen copy source. A committed fork always
  copies the frozen rows only.

No durable `pendingFork` row exists before send. If a committed fork later fails
or produces no assistant reply, the committed thread may retain failure or
missing-reply metadata, but it is no longer an unused pending fork.

---

## 9. Code Audit And Required Replacement

This section identifies current code that must be replaced, modified, or removed.
Do not layer the new flow beside these old flows.

### Frontend

#### `fusion-studio-client/src/state/panelStore.ts`

Current:

- `selectHarness()` clears `currentThreadId` and sends `thread:open-assistant`
  immediately.
- `createDefaultAssistantThread()` sends `thread:open-assistant` immediately.

Required:

- Replace immediate server creation with pending intent creation.
- Add pending intent state/actions:
  - `pendingChatIntent`
  - `recentDraftAttempts`
  - `activeChatTarget`
  - `startPendingNewChat(harnessId)`
  - `startPendingFork(sourceThreadId)`
  - `updatePendingChatText(text)`
  - `abandonPendingChatIntent(reason)`
  - `markPendingChatCreating(draftId)`
  - `markPendingChatCommitFailed(draftId, failure)`
  - `trackRecentDraftAttempt(draftId, snapshot)`
  - `markRecentDraftTerminal(draftId, terminal)`
  - `clearPendingChatIntent(draftId)`
- Keep `threads` and `projectChats` committed-thread-only. Compose pending rows
  into rendered thread-list selectors instead of storing pending rows in
  `threads`.
- Store the visible `pendingChatIntent` as connection-global state: there is at
  most one visible pending row across all workspaces, and workspace switch
  abandons it. Store `recentDraftAttempts` as workspace-routed terminal records.
  A late owner-only draft frame for workspace A must update workspace A's recent
  attempt or committed-thread cache even if workspace B is currently active, and
  it must not create pending UI or change focus in workspace B.
- Keep `currentThreadId` real-thread-only if it remains in the store. Pending
  selection must use `activeChatTarget.kind === "pending"` or an equivalent
  explicit field.
- Existing committed-thread `sendMessage()` must abandon any unrelated pending
  intent before sending to that committed thread.
- Pending intent send must use the new `thread:draft:send` message.
- When abandoning a `creating` pending intent, move the active attempt snapshot
  into `recentDraftAttempts` so late `thread:draft:committed`,
  `thread:draft:failed`, or `thread:draft:cancelled` can be handled without
  recreating pending UI or stealing focus.

#### `fusion-studio-client/src/types/index.ts`

Current:

- `ThreadEntry` describes committed server threads.
- `ExchangeData.user` is a string and `assistant.parts` stores assistant parts.
- WebSocket message types do not model `thread:draft:*`.

Required:

- Keep `ThreadEntry` as committed-thread data.
- Add required `ThreadEntry.threadId` and `ThreadEntry.updatedAt` for final
  committed-thread protocol. Use `threadId` as the row identity and `updatedAt`
  as the committed row sort key. Transitional client compatibility may tolerate
  legacy rows with `id` or missing `updatedAt` only by normalizing `id` to
  `threadId` and preserving server order. Do not sort committed rows by
  `createdAt`.
- Add explicit pending/list target types such as `ChatTarget`,
  `RenderedThreadRow`, and `PendingThreadEntry`.
- Add typed `thread:draft:send`, `thread:draft:accepted`,
  `thread:draft:committed`, `thread:draft:failed`, `thread:draft:cancel`, and
  `thread:draft:cancelled` message shapes.
- Define `DraftInitialExchange` as `ExchangeData`-compatible:
  `exchangeId`, `seq`, `ts`, `user: string`, `assistant: { parts: [] }`,
  `metadata`, plus draft-only fields such as `turnId` and `status`.
- Define terminal metadata types for `assistantTerminal.kind =
  "provider_error" | "missing_reply" | "interrupted"` so renderers do not
  inspect raw provider payloads.

#### `fusion-studio-client/src/components/sidebar/useSidebar.ts`

Current:

- New Chat eventually calls `createDefaultAssistantThread()` or `selectHarness()`.
- Existing thread row click sends `thread:open`.

Required:

- New Chat starts a pending intent and abandons any existing pending intent.
- Thread open may preserve the pending intent.
- Sending from that opened thread later abandons the pending intent.
- Selecting a pending row after viewing a committed thread must send
  `thread:surface:clear` with `surface: "primary"` and
  `reason: "pending_selected"` so delayed passive MRU for the prior committed
  thread is cancelled.

#### `fusion-studio-client/src/components/CliPickerDropdown.tsx`

Current:

- CLI selection calls `onSelect`, which currently creates a persisted thread.

Required:

- CLI selection must start/replace the pending New Chat intent.
- It must not call any server create/open API.
- It must only offer harnesses that are enabled, installed/built-in, and
  `supportsSignalGatedDraft` for pending New Chat creation.

#### `fusion-studio-client/src/config/harness.ts`

Current:

- Selectable harness filtering checks enabled/install/built-in status, but does
  not know whether a harness supports signal-gated draft commit.

Required:

- Extend harness status/config typing with `supportsSignalGatedDraft` and store
  the server-provided workspace-scoped `draftHarness` object, including
  `draftHarness.workspaceId`.
- Add a resolver for pending New Chat harness selection:
  - if the user explicitly selected a harness and it supports signal-gated
    drafts, use it
  - if the user explicitly selected a harness and it does not support
    signal-gated drafts, fail with typed recoverable
    `draft_harness_unsupported`; do not silently fall back to the default
  - if there is no explicit selection, use server-authoritative
    `draftHarness.defaultDraftHarnessId`
  - if readiness is still loading, keep New Chat disabled or show typed
    non-destructive feedback without creating a pending intent
  - after readiness has loaded, if no supported default/candidate is available,
    fail with typed recoverable `draft_no_supported_harness`
- Keep committed-thread resume/send harness availability separate from pending
  New Chat availability. Unsupported harnesses may remain usable for existing
  committed threads if their legacy flow still supports that.

#### `fusion-studio-client/src/components/chat/useComposerForkAction.ts`

Current:

- `handleForkThread()` sends `thread:fork`.
- Server returns `thread:forked` with a persisted fork thread.

Required:

- Replace with pending fork intent creation.
- Do not send a WebSocket request on click.
- Keep client-side disabled checks for obvious invalid states, but server must
  revalidate on draft send.

#### `fusion-studio-client/src/lib/ws/thread-handlers.ts`

Current:

- `thread:created` assumes immediate durable empty thread creation.
- `thread:forked` assumes immediate durable copied fork creation.
- `message:sent` adds user bubble after prompt persistence.
- `thread:list` auto-opens the MRU thread when `currentThreadId` is null.

Required:

- Remove or stop using `thread:forked` for composer fork.
- `thread:list` handling must require/read `workspaceId` and route rows to that
  workspace cache. A list for a non-visible workspace must not replace the
  currently visible workspace list or active target.
- `thread:list` auto-open must check `activeChatTarget == null`, not
  `currentThreadId == null`. Pending selection intentionally has no
  `currentThreadId`, and must not be displaced by MRU auto-open.
- Add `thread:draft:committed` handling:
  - route by `{ workspaceId, draftId }` and ignore/log mismatched workspace
    frames rather than applying them to the currently visible workspace
  - replace the pending `intentId` row with the real thread id when
    `draftId === pendingChatIntent.activeDraftId` or
    a matching recent attempt exists in the frame's `workspaceId`
  - add/upsert thread
  - set current thread id only if that pending `intentId` is still the active
    pending target
  - if the user is viewing another committed thread when commit arrives, keep
    that focus unchanged while removing the pending row and adding the committed
    row in the list
  - hydrate copied fork exchanges from `copiedExchanges` when present
  - render the first user bubble from `initialExchange` only when the committed
    thread is the active chat surface; otherwise store/hydrate it for later open
  - drop overlay
- Do not render a duplicate first user bubble from `message:sent` or
  `turn_begin`. `thread:draft:committed` owns that first bubble.
- Ensure visible events buffered before commit are replayed once under the real
  thread id.
- Add `thread:draft:failed` handling:
  - route by `{ workspaceId, draftId }`
  - apply the Client Failure Outcomes table above before deciding whether any
    pending UI or composer text is allowed to change
  - keep pending intent only when it is still the active visible pending attempt
  - clear `activeDraftId`
  - store `lastFailedDraftId` and typed `lastFailure`
  - if `recoverable === true` and `restoreComposer === true`, restore text to
    composer and return status to editable/sendable `commit_failed`; the next
    Send creates a new `draftId`
  - if `phase === "commit"` or `recoverable === false`, mark status
    `commit_error`, do not restore composer text, and do not offer resend/retry
    for that accepted prompt
  - show failed overlay or terminal pending-row state using the typed failure
    envelope
- Add `thread:draft:cancelled` handling for active draft abandonment.
- `thread:draft:accepted`, `thread:draft:status`, `thread:draft:failed`, and
  `thread:draft:cancelled` use the same `{ workspaceId, draftId }` routing
  rule as `thread:draft:committed`.
- Add handling for committed terminal failure/missing-reply metadata so refresh
  renders the same completed exchange chrome.
- Keep `thread:opened` for existing committed threads.
- If `thread:created` remains for non-chat test/admin paths, it must not be part
  of New Chat UX.

#### `fusion-studio-client/src/components/chat/useChatArea.ts`

Current:

- `currentThreadId` is required to send.
- Composer warm intent warms current real thread.
- `CHAT_ACTION_EVENT` supports `target: 'new'` and currently sends
  `thread:open-assistant`, waits for `thread:opened`, then sends or inserts into
  that real thread.

Required:

- Allow pending intent to render as the active chat surface.
- Send from pending intent must call pending draft send, not committed-thread
  `sendMessage()`.
- Warm intent must not warm or create provider/runtime state for pending intents.
- Programmatic chat actions with `target: 'new'` must use the same pending intent
  and `thread:draft:send` flow as the visible New Chat UX. Do not leave a hidden
  `thread:open-assistant` creation path for tools, prompt cards, or internal
  actions.
- Overlay state must cover the chat content area while commit is in progress.
- Mirror the backend-owned two-stage first-visible-response timer for display
  only:
  - 0-10 seconds: pending assistant indicator
  - 10-20 seconds: red connection text plus reusable hourglass
- Do not let frontend timers fail drafts, restore input text, stop providers, or
  finalize `turnStatus: "missing_reply"` / `missingAssistantReply: true`. Those
  are backend terminal events only.
- On abandonment while pending intent is `creating`, send `thread:draft:cancel`
  when the WebSocket is available.
- On Stop while pending intent is `creating`, send `thread:draft:cancel` with
  `reason: "user_stop"` and wait for backend `thread:draft:cancelled` before
  returning the pending intent to editable `draft`.
- When sending on an existing committed thread while a pending intent is
  `creating`, include `abandonDraftId`/`abandonReason: "send_elsewhere"` on the
  committed-thread `prompt` message along with `workspaceId` for the committed
  target and `abandonDraftWorkspaceId` for the pending origin, or send an
  ordered cancel request before the prompt. The backend remains authoritative
  for the final race outcome.
- Render `[material-symbol:error] Reply not received` as chrome/metadata, not as
  assistant message text.
- Render completed-turn controls under missing-reply chrome.

#### `fusion-studio-client/src/lib/ws/stream-handlers.ts`

Current:

- Live stream routing handles normal content/thinking/tool/turn-end events but
  has no public `assistant_terminal` frame.

Required:

- Add handling for public WebSocket `assistant_terminal`.
- The handler must update the live exchange identified by `threadId`, `turnId`,
  and `exchangeId` with `metadata.assistantTerminal`.
- It must render assistant-side terminal chrome with empty assistant text and
  must not append a model-output text segment.
- It must coexist with later `turn_end`, `exchange_metadata`, or
  `chat-turn:saved` frames carrying the same metadata without duplicate chrome.
- It must not handle pre-commit provider retry/status through committed-thread
  stream routing; those arrive as `thread:draft:status` and are keyed by
  `draftId`.

#### `fusion-studio-client/src/lib/ws/thread-handlers.ts` or pending-draft handler

Required for draft status:

- Handle public `thread:draft:status` frames by matching `draftId` against
  `pendingChatIntent.activeDraftId` or a recent attempt in the same
  `workspaceId`.
- Update only pending overlay/status UI. Do not create committed chat messages,
  assistant segments, `projectChats`, or `threads` entries.
- Ignore/log unknown `draftId` values.

#### `fusion-studio-client/src/components/MessageList.tsx`

Current:

- Completed assistant chrome is rendered only for assistant messages.
- Reply text is extracted from `message.segments`.
- Empty/metadata-only assistant messages still need an exchange identity before
  chrome actions are enabled.

Required:

- Add an explicit metadata-driven render path for terminal missing replies and
  committed provider failures.
- Missing-reply display must show Material `error` plus `Reply not received`
  where an assistant reply would normally appear.
- The stored assistant text for that exchange remains empty.
- Completed-turn chrome still renders beneath the marker so the user can see the
  turn is finished.
- Copy/text/audio/history behavior must not treat `Reply not received` as model
  output. Empty-text actions should use the existing empty-response guard/detail
  such as `No chat text found`.

#### `fusion-studio-client/src/components/ChatInput.tsx`

Current:

- Input text is component-local.

Required:

- Pending intent text must be mirrored into store RAM so navigation can restore
  the half-written message.
- Pending draft attachments are not supported in the first implementation.
- On `thread:draft:failed` with `restoreComposer: true`, the original text must
  be restored to the input.
- On `thread:draft:failed` with `restoreComposer: false`, do not restore the
  old pending text into the current input.
- On `thread:draft:cancelled` with `restoreComposer: true`, the pending intent
  text must be restored/kept in the input and the pending status returns to
  `draft`.
- On `thread:draft:cancelled` with `removePendingIntent: true`, do not restore
  old pending text into the current input.
- After committed failure or missing reply, restore normal idle composer state:
  Stop disappears and Send returns.
- Do not add special `Continue`, `Recover`, `Resend`, or `Retry` button modes.

#### `fusion-studio-client/src/components/ThreadJumpDropdown.tsx`

Current:

- Opening an existing thread sends `thread:open`.

Required:

- Opening an existing thread does not abandon pending intent.
- Any send from the opened committed thread abandons pending intent.

#### `fusion-studio-client/src/state/slices/secondarySlice.ts` and secondary chat UI

Current:

- Secondary chat state is committed-thread-id-only.
- Secondary opens currently use the same `thread:open` shape as primary opens.

Required:

- Keep secondary chat committed-thread-only for this implementation. Do not add
  pending intent selection, pending composer send, or pending row rendering to
  secondary chat.
- Secondary committed-thread open sends `thread:open` with
  `surface: "secondary"` and handles `thread:opened.surface === "secondary"`.
- Secondary committed-thread send abandons/cancels any primary pending intent
  using `send_elsewhere` before accepting the secondary prompt.
- Primary and secondary passive MRU timers must not cancel each other because
  their `surface` values differ.

### Backend

#### `fusion-studio-server/lib/ws/thread-ws-handlers.js`

Current:

- `thread:open-assistant` creates/resumes and then spawns wire.
- `thread:fork` calls `createPendingForkThread()` and persists a fork on click.

Required:

- Remove the composer fork path that persists on `thread:fork`.
- Add `thread:draft:send`.
- Add `thread:draft:cancel`.
- `thread:open-assistant` must no longer be the New Chat creation path. It can be
  removed, narrowed to resume-only, or replaced by explicit committed-thread
  open handling.
- If a legacy client sends `thread:open-assistant` without a known `threadId`,
  the backend must not create a thread. Return a recoverable error such as
  `thread_create_via_open_assistant_disabled`.
- `thread:open-assistant` with a known committed `threadId` may remain as a
  compatibility alias for resume/open only until callers migrate to the explicit
  committed-thread open route.
- Draft send must route to a signal-gated commit service.
- Draft send must pass the validated `workspaceId` to `DraftCommitService`,
  which freezes `DraftWorkspaceContext`. Later workspace switches on the same
  socket must not change where that accepted draft commits.
- WebSocket close must cancel the active pre-commit draft attempt owned by that
  connection, regardless of workspace.
- Register `DraftCommitService.cancelByConnection(connectionId,
  "client_disconnect")` in the WebSocket close cleanup path before removing
  connection state. This stops transient draft runs and writes no durable state
  when cancel wins pre-commit.

#### `fusion-studio-server/lib/thread/DraftCommitService.js` (new)

Required:

- Own the `thread:draft:send` and `thread:draft:cancel` server state machine.
- Maintain the active/terminal draft attempt registry keyed by
  `{ workspaceId, connectionId, draftId }` and duplicate replay TTL.
- Start adapters through `startTransientDraftHarness()` and consume their
  canonical event async iterable as the sole owner of the first draft turn's
  event stream.
- Buffer canonical events and harness config patches by `draftId` before commit.
- For OpenCode, wait for `provider_session_identity.sessionId` before commit;
  buffer earlier visible events but do not commit on them alone.
- Run the SQLite commit transaction, persist buffered config patches, emit
  `thread:draft:committed`, replay buffered events with committed
  `threadId`/`turnId`/`exchangeId`, continue draining live first-turn events
  through the canonical applier, and attach a still-live run to the normal
  committed runtime registry for stop/future-send lookup only.
- The attached runtime must satisfy normal committed-thread lookup/send paths:
  `getClientForThread` or equivalent returns the attached client/runtime,
  readiness is marked for the committed `threadId` only after the first draft
  turn reaches terminal state, and follow-up sends use it without respawn.
- Stop and discard the transient run on pre-commit failure/cancel/timeout.
- On `thread:draft:cancel`, call the transient run stop hook and enforce
  `DRAFT_STOP_TIMEOUT_MS`. If no commit signal has won by the deadline, force
  kill/discard the run, emit owner-only `thread:draft:cancelled`, and write no
  durable state.
- Expose ordered abandon-before-normal-prompt behavior for
  `client-message-router.js`.
- Send `thread:draft:*` frames only to the owner connection. Broadcast only
  committed-thread frames such as `thread:list` to workspace subscribers.

#### `fusion-studio-server/lib/thread/ThreadCommitRepository.js` (new)

Required:

- Own `commitDraft()` and its SQLite transaction.
- Insert thread row, copy fork exchanges, insert provisional first exchange,
  update `message_count`, set `updated_at` using the timestamp supplied by
  `ThreadMruService` policy, and persist initial harness config inside one
  transaction.
- Pass a `trx` handle into `HistoryFile.beginExchange()` and any copy helpers.
- Return the committed `thread`, `copiedExchanges`, and `initialExchange` used
  by `thread:draft:committed`.
- Do not rebuild markdown inside the transaction. Return successfully first;
  post-commit markdown rebuild happens in the derived-artifact step.

#### `fusion-studio-server/lib/harness/harness-status-service.js`

Current:

- Harness status responses expose install/built-in/version/action details, but
  not signal-gated draft capability or draft default ownership.

Required:

- Include `supportsSignalGatedDraft` in each status row returned to
  `/api/harnesses?workspaceId=<workspace-id>` and any equivalent
  workspace/bootstrap payload.
- Expose one authoritative `draftHarness` object during client bootstrap or
  workspace initialization. It must include `workspaceId` and represents the
  workspace default, not a view/panel-local default.
- Include `workspaceId` and draft capability/default-impacting fields in
  per-workspace `harness:status_changed` WebSocket updates so the client can
  enable/disable pending New Chat deterministically for the correct workspace.
- Do not let the client invent a draft default when the server has not provided
  one.

#### `fusion-studio-server/lib/ws/client-message-router.js`

Current:

- `prompt` routes directly to
  `threadRuntimeController.acceptPromptThroughRuntime()`.

Required:

- Before accepting a normal committed-thread `prompt`, check for
  `clientMsg.workspaceId`, validate the target `threadId` belongs to that
  workspace, check for `clientMsg.abandonDraftWorkspaceId` /
  `clientMsg.abandonDraftId`, and check for the single active pre-commit draft
  attempt owned by `connectionId` regardless of workspace.
- When `abandonDraftWorkspaceId` is present, use it for the draft lookup instead
  of assuming the draft origin is the committed prompt's target workspace.
- Resolve the draft abandonment/commit race before calling
  `acceptPromptThroughRuntime()`.
- If cancel wins, proceed with the committed-thread prompt.
- If commit already won, keep the committed draft thread durable, then proceed
  only if normal runtime busy rules allow the committed-thread prompt.
- This route must not persist the committed-thread prompt's user bubble until
  the active draft ordering step completes.

#### `fusion-studio-server/lib/thread/thread-crud.js`

Current:

- `handleThreadCreate()` creates a thread row and markdown file immediately.
- `handleThreadOpenAssistant()` creates when no known `threadId` exists.
- `handleThreadOpen()` writes resume/MRU state immediately, then delays the
  thread-list reorder broadcast.
- `handleThreadTouch()` can immediately bump MRU without distinguishing passive
  view from durable user activity.

Required:

- Remove create-on-open behavior from user-facing chat flow.
- Keep low-level create helpers only for the commit service.
- Unknown `threadId` resume should not silently create a new thread in this flow.
- `handleThreadOpen()` must parse `surface`, normalize legacy missing values to
  `"primary"` during migration, reject unknown values, and echo the normalized
  surface on `thread:opened`.
- Move committed-thread MRU writes to the same timer that changes visible sort
  order. Do not call `touch()` immediately on selection if the list reorder is
  delayed.
- Cancel a pending MRU write if the user leaves the thread before the reorder
  threshold.
- Remove or narrow `thread:touch` so it routes through the explicit MRU policy:
  delayed for passive view, immediate only for durable user activity.

#### `fusion-studio-server/lib/thread/ThreadMruService.js` (new)

Required:

- Own MRU policy and timestamp generation for all `threads.updated_at` MRU
  changes.
- Schedule delayed passive selection timers keyed by
  `{ workspaceId, connectionId, surface, threadId }`.
- Cancel passive timers when the same connection/surface selects another
  thread, disconnects, switches workspace, or abandons that surface.
- Cancel passive timers when `thread:surface:clear` is received for
  `{ workspaceId, connectionId, surface }`.
- Apply immediate durable-activity MRU for committed-thread send and
  secondary-chat send.
- Provide a transaction-safe helper such as
  `getImmediateTimestamp("draft_commit")` for `ThreadCommitRepository` to write
  the initial draft commit `updated_at` inside the same SQLite transaction.
- Broadcast the reordered committed thread list to all workspace subscribers in
  the same operation that writes SQLite.
- Replace direct `index.touch()`/`updatedAt: Date.now()` MRU writes in
  `thread-crud.js`, `thread-messages.js`, `ThreadManager.js`, and
  `ThreadIndex.js`.

#### `fusion-studio-server/lib/thread/WorkspaceThreadBroadcaster.js` (new)

Required:

- Own workspace-wide committed thread-list broadcasts.
- Expose `broadcastThreadList(workspaceId, reason)` and, if needed,
  `sendThreadListToConnection(ws, workspaceId, reason)` for one-socket
  hydration.
- Use the existing `wsState`/workspace subscription registry to find all open
  sockets subscribed to `workspaceId`.
- Load the committed thread list from the server-authoritative thread index
  sorted by `threads.updated_at DESC`; do not accept a client-provided sort
  order.
- Every emitted `thread:list` frame includes the `workspaceId` passed to
  `broadcastThreadList()` or `sendThreadListToConnection()`.
- Include `ThreadEntry.threadId` and `ThreadEntry.updatedAt` on every committed
  row.
- `ThreadMruService`, `DraftCommitService`, normal committed send/count-update
  paths, and markdown sync status changes call
  `WorkspaceThreadBroadcaster.broadcastThreadList(workspaceId, reason)`.
- Existing helper functions such as `sendThreadList(ws)` may remain only as
  one-socket hydration wrappers. They must not be used for workspace-wide
  broadcast paths that should update every subscriber.
- Owner-only `thread:draft:*` frames never go through
  `WorkspaceThreadBroadcaster`; only committed workspace-visible frames do.

#### `fusion-studio-server/lib/thread/thread-messages.js`

Current:

- `handleMessageSend()` persists the prompt and then immediately calls
  `manager.index.touch(threadId)`.

Required:

- Committed-thread send remains immediate MRU activity because the user created
  durable chat content.
- Ensure the send path performs only one MRU write and one thread-list broadcast.
  If `ThreadManager.addMessage()` owns the touch, remove the extra caller touch;
  if the route owns it, remove/narrow the manager touch.

#### `fusion-studio-server/lib/thread/ThreadManager.js`

Current:

- `createThread()` creates SQLite row and empty markdown file.
- `addMessage()` persists user prompt, increments message count, and currently
  touches MRU.

Required:

- Keep these as low-level primitives.
- `addMessage()` must not create duplicate MRU writes when called from
  `handleMessageSend()`.
- `addMessage()` and `addMessageWithMetadata()` must stop incrementing
  `threads.message_count` for individual role-message appends.
- Add a migration/startup repair that recomputes `threads.message_count` from
  the `exchanges` table for existing threads.
- Add or expose a transaction-safe commit helper for:
  - create thread
  - optional fork history copy
  - provisional first exchange row with user prompt, empty assistant parts,
    `turnId`, and `draftId`
  - initial harness config
- Add a separate post-commit derived-artifact helper for markdown rebuild. It
  runs only after SQLite commit succeeds and marks
  `harness_config.fusion.markdownSyncStatus` dirty on failure.
- Do not call `createThread()` directly from New Chat click.

#### `fusion-studio-server/lib/thread/ThreadIndex.js`

Current:

- `activate()` updates `updated_at` while marking a thread active.

Required:

- Activation/status changes are not MRU events. Stop writing `updated_at` from
  generic activation/resume/warm paths unless the caller is explicitly applying
  one of the MRU policies above.

#### `fusion-studio-server/lib/thread/thread-fork-service.js`

Current:

- `createPendingForkThread()` validates source, creates a persisted fork thread,
  stores `pendingFork`, copies exchanges, and writes markdown at click time.

Required:

- Delete or replace `createPendingForkThread()`.
- Replace with send-time helpers:
  - validate fork source at draft-send time
  - freeze source OpenCode session id, latest source exchange id/seq, source
    display name, and source revision timestamp when available
  - resolve source OpenCode session id
  - copy source exchanges from the frozen snapshot inside commit transaction
    after first committing provider signal
  - build `forkProvenance`
- No durable fork is created before the first committing provider signal.

#### `fusion-studio-server/lib/thread/thread-runtime-controller.js`

Current:

- Existing committed-thread prompt path persists user message before draining
  `_sendMessage()`.

Required:

- Do not use this path unchanged for pending draft sends.
- Route pending draft sends to `DraftCommitService`, which starts the transient
  runtime first, waits for a committing provider signal, then persists thread
  plus user prompt.
- The draft-send path must generate a reserved future `threadId` and pass that
  id to the transient harness session without inserting it into SQLite until
  commit.
- Existing committed-thread Send may continue to persist user acceptance before
  streaming. The signal-gated delay is required for pending New Chat/Fork because
  those do not have a durable thread yet.
- `DraftCommitService` owns the 20-second draft send timeout semantics:
  - before provider session identity: stop transient runtime and emit
    `thread:draft:failed`
  - after provider session identity: commit if needed, stop runtime, persist
    missing-reply metadata, and emit terminal completed-turn state
- `DraftCommitService` owns active draft cancellation:
  - before commit: stop transient runtime, discard reserved id, and emit
    `thread:draft:cancelled` when possible
  - after commit: do not roll back; keep durable thread and emit/update normal
    committed-thread events
- Do not rely on frontend timers for terminal decisions.
- Existing committed-thread prompt behavior can remain unless a separate per-turn
  signal-gated persistence spec replaces it.

#### `fusion-studio-server/lib/harness/compat.js`

Current:

- `spawnThreadWire()` loads harness info by persisted `threadId`.

Required:

- Draft send needs a transient harness start path that does not require a
  persisted thread row.
- Do not overload `spawnThreadWire()` for drafts. Keep it for committed threads
  only.
- Add or extract a lower-level provider startup helper that both
  `spawnThreadWire()` and the transient draft starter can call, so provider
  startup code is shared without mixing lifecycle semantics.
- Any harness config patches emitted before commit must be buffered and applied
  when the thread is committed.
- The canonical bridge/applier must support terminal failure and canonical
  missing-reply metadata (`turnStatus: "missing_reply"`,
  `missingAssistantReply: true`, and
  `assistantTerminal.kind: "missing_reply"`) without treating it as assistant
  text.

#### `fusion-studio-server/lib/harness/opencode/index.js`

Current:

- Pending fork is read from persisted `harness_config.pendingFork`.
- `buildRunArgs()` uses `pendingFork.sourceOpenCodeSessionId` for `--fork`.
- OpenCode `sessionID` is captured internally and persisted through
  `updateHarnessConfig`, but it is not currently emitted as a canonical
  non-rendering event.
- Clean exit after only `step_start` currently throws because `step_start` is not
  treated as useful assistant output.

Required:

- Continue supporting fork run args, but accept pending fork metadata from a
  transient draft runtime as well as persisted config for compatibility during
  migration.
- Long term, unused persistent `pendingFork` should not be created by UI flows.
- OpenCode session id patches created before commit must be buffered until a
  real thread exists.
- Emit or expose a universal provider-session-identity signal when OpenCode
  returns `sessionID`. This signal commits the draft but does not render content.
- During a draft run, visible OpenCode content/tool/thinking before `sessionID`
  is emitted to `DraftCommitService` as buffered non-committing data for
  OpenCode. It is replayed only after a later `sessionID` commits the draft.
- If the draft run ends or times out without `sessionID`, return
  `provider_no_commit` and discard buffered visible output.
- Translate OpenCode `type: "error"` JSON events into the universal failure
  shape.
- If per-process OpenCode logs are used for retry UX, normalize them into
  transient status events; do not expose OpenCode log strings directly to the
  universal interpreter.

#### `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js`

Current:

- The bridge maps a closed set of known fields from flat harness events into
  applier payloads and drops unknown fields.

Required:

- Preserve the canonical draft event fields defined in §3:
  `commitsDraft`, `render`, `draftId`, `turnId`, `exchangeId`,
  `assistantTerminal`, provider identity fields, terminal `kind`, and terminal
  error details.
- Add explicit cases for `provider_session_identity` and
  `assistant_terminal`.
- Preserve normalized pre-commit `status_update` events for
  `DraftCommitService`; do not route them through committed-thread
  `status_update` fanout until after commit.
- Do not encode OpenCode-specific logic here; only pass already-normalized
  canonical fields through to the universal applier/commit gate.

#### `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`

Current:

- The universal applier understands content, thinking, tools, status metadata,
  and `turn_end`.
- It does not currently have a first-class non-rendering provider session
  identity event.
- `turn_end` persistence assumes assistant parts represent model-visible reply
  history.

Required:

- Add a universal, provider-neutral way to receive commit metadata such as
  provider session identity.
- Preserve and forward `commitsDraft`, `render`, `draftId`, `turnId`, and
  `exchangeId` from canonical payloads so the draft commit service can make
  deterministic decisions.
- Pre-commit transient `status_update` events are consumed by
  `DraftCommitService` and emitted publicly as `thread:draft:status` keyed by
  `draftId`; they are not applied as committed-thread stream events.
- Add support for an already-committed provisional turn:
  - accept injected/explicit `turnId` and `exchangeId`
  - emit/replay `chat:turn_begin` with `renderUserBubble: false`
  - route content/thinking/tool events against that existing turn
  - include `exchangeId` on `chat:turn_end`
- Skip the legacy `persistAssistantMessage()` append path when ending a
  provisional exchange turn; exchange finalization owns persistence and markdown
  rebuild.
- Do not put OpenCode-specific parsing or retry heuristics in the universal
  applier.
- Add `assistant_terminal` or equivalent canonical handling that maps terminal
  provider failure/missing reply into `metadata.assistantTerminal`, not
  assistant text parts.
- A missing-reply terminal state should still complete the live turn and allow
  downstream renderers to show completed-turn chrome.

#### `fusion-studio-server/lib/wire/wire-broadcaster.js`

Current:

- Public turn-end fanout does not include the full terminal metadata/exchange
  handoff required for live terminal chrome.

Required:

- Broadcast public `assistant_terminal` frames with `threadId`, `turnId`,
  `exchangeId`, `assistantTerminal`, `metadata`, `renderAsAssistantChrome`, and
  empty `assistantText`.
- Include `metadata`, `exchangeId`, `provisionalExchangeId`, and
  `persistenceMode` on terminal `turn_end` frames when present.
- Ensure clients receive the live terminal frame before or alongside terminal
  `turn_end`; do not rely on audit-only `chat-turn:saved` to render live
  failure/missing-reply chrome.

#### `fusion-studio-server/lib/audit/audit-subscriber.js` and `HistoryFile.js`

Current:

- SQLite exchange persistence happens on `chat:turn_end`.
- `HistoryFile.addExchange()` stores `{ parts: [...] }` in the assistant column.

Required:

- Add `HistoryFile.beginExchange()` for draft commit. It inserts the
  provisional row and returns `exchangeId`/`seq`. When called with
  `{ countOwner: "commitDraft" }`, it must not increment or set
  `threads.message_count`; `ThreadCommitRepository.commitDraft()` owns the
  single draft-commit count write.
- Add `HistoryFile.finalizeExchange()` for `chat:turn_end` when
  `event.exchangeId` or `event.provisionalExchangeId` is present. It updates the
  existing row, must not insert a duplicate, and must not increment
  `message_count`.
- Update `HistoryFile.addExchange()` for normal non-provisional turns so it owns
  one exchange-count increment for that completed turn.
- Update `audit-subscriber.js`:
  - if `chat:turn_end.exchangeId` is present, aggregate metadata and call
    `finalizeExchange()`
  - otherwise keep the existing `addExchange()` path for non-provisional turns
  - emit `chat-turn:saved` with the finalized row's existing `exchangeId`
- For committed missing replies, persist the user prompt and an assistant shape
  with empty parts or no text parts, plus metadata such as
  `assistantTerminal.kind = "missing_reply"` and `missingAssistantReply: true`.
- For committed provider failures, persist `assistantTerminal.kind =
  "provider_error"` with the structured fields defined above.
- Do not persist Fusion's `Reply not received` marker as a text part.
- Hydration must reconstruct enough metadata for the client to render the
  missing-reply marker and completed chrome after refresh.
- Provisional exchange markdown output is rebuilt from SQLite after
  `finalizeExchange()`; it does not append via `ChatFile.appendMessage()`.
- If markdown rebuild fails after SQLite succeeds, write
  `harness_config.fusion.markdownSyncStatus.state = "dirty"` without
  overwriting provider harness config, emit `thread:sync_status`, and keep
  future hydration/sends on SQLite.
- Add `thread:markdown:rebuild` or equivalent repair handler that rebuilds one
  committed thread's markdown from SQLite and clears/marks clean the same
  `harness_config.fusion.markdownSyncStatus` object.

### Tests

Current tests that encode old behavior must be replaced:

- `fusion-studio-server/test/ws/thread-fork-handler.test.js`
- `fusion-studio-server/test/thread/thread-fork-service.test.js`
- fork-related cases in `fusion-studio-server/test/harness/opencode/harness-send-message.test.js`
- pending fork smoke tests in `fusion-studio-server/test/harness/opencode/compat-pending-fork-smoke.test.js`
- prompt acceptance tests in `fusion-studio-server/test/thread/thread-runtime-controller.test.js` for draft send behavior
- any client/store test or fixture that proves `target: 'new'` chat actions wait
  for `thread:opened` before sending

Required new tests:

- New Chat click creates no SQLite row.
- Fork click creates no SQLite row and sends no WebSocket request.
- Programmatic `fusion:chat-action` with `target: 'new'` creates no durable row
  before commit and does not call `thread:open-assistant`.
- Pending draft text survives local thread navigation.
- Pending rows are composed into the rendered list without adding entries to
  committed `threads` or `projectChats`.
- Active pending selection uses `activeChatTarget.intentId` or equivalent, not a
  fake `currentThreadId` and not `draftId`.
- `thread:list` MRU auto-open does not steal focus when
  `activeChatTarget.kind === "pending"` and `currentThreadId` is null.
- Draft commits after the user browsed a different committed thread remove the
  pending row and add the committed row without moving focus.
- Late `thread:draft:committed`, `thread:draft:failed`, and
  `thread:draft:cancelled` are handled through `recentDraftAttempts` after
  visible pending UI has been removed.
- Late `thread:draft:failed` after abandonment marks the recent attempt terminal
  but does not recreate pending UI, restore composer text, or steal focus even
  when `restoreComposer: true`.
- Late commit on the same live client session after New Chat replacement, Fork
  replacement, Send elsewhere, or workspace switch does not recreate pending UI
  or steal focus.
- Workspace switch late-frame test starts a draft in workspace A, switches to
  workspace B, lets commit win in A, and verifies workspace B state/focus is
  unchanged while workspace A receives the committed row on hydration/list
  update.
- Server workspace authority test proves a draft accepted in workspace A freezes
  `DraftWorkspaceContext`; after the same connection switches to workspace B, a
  late commit writes SQLite/markdown/thread-list only through workspace A's
  manager/index/project root.
- Workspace-switch race test proves workspace switch sends/calls cancel for the
  origin draft; if cancel wins no durable state is written, and if commit wins
  the commit writes only to the frozen origin `DraftWorkspaceContext`.
- Refresh/app restart/client disconnect clears `recentDraftAttempts`. If commit
  won before disconnect, the thread is recovered later through normal
  `thread:list`/`thread:open` hydration; if cancel/failure won, no durable row
  exists.
- Opening an existing thread after New Chat with empty text preserves the pending
  row and allows returning to it.
- Pending row sort uses `createdAt`/`listUpdatedAt`; selecting pending rows uses
  `MRU_REORDER_DELAY_MS`, not immediate resort.
- Draft commit uses the server commit timestamp supplied by `ThreadMruService`
  policy for durable `threads.updated_at` and never imports client-only pending
  `listUpdatedAt`.
- Harness status/config exposes `supportsSignalGatedDraft` and a server-owned
  `draftHarness` object.
- `/api/harnesses?workspaceId=<workspace-id>`, bootstrap/workspace init, and
  per-workspace `harness:status_changed` all carry the same `draftHarness`
  shape.
- Server default selection uses configured default when supported, otherwise
  falls back to the first enabled installed/built-in draft-capable harness in
  catalog order; configured default unsupported with OpenCode available selects
  OpenCode.
- New Chat without explicit harness uses the advertised default draft harness.
- Unsupported harnesses are disabled/hidden for pending New Chat while remaining
  available for existing committed resume/send flows when applicable.
- Missing draft harness support surfaces typed `draft_no_supported_harness`.
- New Chat is disabled or returns typed non-destructive feedback while draft
  harness support/default status is still unknown.
- Harness status refresh that removes the default draft harness disables pending
  New Chat or resolves a new server-provided default.
- Pre-commit provider retry/status emits `thread:draft:status` keyed by
  `draftId`, updates pending overlay UI, and creates no committed thread/chat
  state.
- New Chat, Fork, Send elsewhere, workspace switch, and refresh abandon pending
  intent.
- Sending on an existing committed thread while a pending draft is `creating`
  orders draft cancellation/late commit before prompt acceptance.
- Draft send with no committing provider signal writes no SQLite thread or
  markdown file.
- Provider-accepted SQLite commit failure emits `thread:draft:failed` with code
  `provider_commit_persistence_failed`, `recoverable: false`, and
  `restoreComposer: false`; it restores no composer text and creates no partial
  rows.
- Provider-accepted persistence failure sets client state to `commit_error`, not
  retryable `commit_failed`, and offers no automatic resend/retry.
- Each Send attempt from a pending intent gets a new `draftId`; retry after
  `commit_failed` does not reuse `lastFailedDraftId`.
- `thread:draft:failed` carries `code`, `message`, `recoverable`,
  `restoreComposer`, and `phase`; client state stores the typed failure.
- Draft commit inserts one provisional exchange row and returns its `exchangeId`
  in `thread:draft:committed.initialExchange`.
- `thread:draft:committed.thread` includes `threadId` and `updatedAt`; client
  uses `threadId` to replace the pending row and `updatedAt` only for committed
  sort merge before accepting the following authoritative `thread:list` order.
- SQLite commit failure after provider `sessionID` emits no
  `thread:draft:committed`, emits `provider_commit_persistence_failed`, leaves
  no partial thread/exchange rows, restores no composer text, and logs the
  orphan-risk condition.
- `chat:turn_end` for a provisional draft finalizes the same exchange row and
  does not call `addExchange()` or create a duplicate row.
- Provisional draft `chat:turn_end` does not call legacy
  `persistAssistantMessage()`/`ChatFile.appendMessage()`; markdown is rebuilt
  from SQLite.
- Provisional `chat:turn_end` carries `persistenceMode:
  "finalize_provisional"`, `provisionalExchangeId`, `exchangeId`, and
  `skipLegacyAssistantAppend: true`.
- Draft send with provider `sessionID` commits, saves the user prompt, and does
  not render `sessionID` as assistant content.
- Commit/cancel race test proves cancellation cannot win after the backend
  observes the first valid committing provider signal and marks the attempt
  `commit_in_progress`; SQLite failure after that latch emits
  `provider_commit_persistence_failed`, not cancel.
- Workspace-close race test proves close before the commit latch cancels with
  `reason: "workspace_close"` and writes nothing durable, while close after
  `commit_in_progress` continues commit against the frozen workspace context or
  emits `provider_commit_persistence_failed` if persistence fails.
- OpenCode draft with visible output before `sessionID` buffers that output,
  does not commit until `sessionID`, then replays it exactly once.
- OpenCode draft with visible output but no `sessionID` fails pre-commit with
  `provider_no_commit` and writes nothing durable.
- OpenCode pre-session visible output does not cancel the pre-session timeout;
  only `sessionID` or another OpenCode commit-capable signal can do that.
- OpenCode synthetic `turn_begin`, `wire_ready`, request ack, warm/setup, and
  pre-session visible events neither commit nor render the first user bubble
  before `thread:draft:committed`.
- Late duplicate/conflicting OpenCode `sessionID` after commit is idempotently
  ignored if same and terminal provider-error metadata if conflicting.
- New Chat draft commit returns `messageCount: 1`.
- Fork draft commit with seven copied exchanges returns `messageCount: 8`, not a
  doubled role-message count.
- Fork draft commit includes `copiedExchanges`; active fork render shows copied
  source history plus first prompt without duplicate bubbles or focus theft.
- Provider-error and missing-reply terminal turns count as one exchange/turn.
- Existing committed-thread normal send increments `messageCount` once per saved
  exchange/turn, not once for user plus once for assistant.
- Normal committed send emits one immediate MRU broadcast on prompt acceptance,
  then a later count-update broadcast on exchange save without a second MRU
  touch/reorder.
- Migration/startup repair recomputes existing thread `messageCount` from
  persisted exchange rows before thread-list hydration.
- Mixed legacy and new threads hydrate with exchange counts only.
- Draft commit emits/replays `chat:turn_begin` after
  `thread:draft:committed`, with the same `turnId`/`exchangeId` and
  `renderUserBubble: false`.
- Canonical bridge/applier preserves `commitsDraft`, `render`, `draftId`,
  `turnId`, `exchangeId`, provider identity fields, and
  `assistantTerminal`.
- Draft send with structured provider error and `sessionID` emits provider
  session identity first, commits, then renders failure chrome without saving the
  error as assistant text.
- Public live WebSocket `assistant_terminal` frame reaches the client with
  `assistantTerminal`, `metadata`, `exchangeId`, and empty `assistantText`; no
  assistant text segment is added.
- Persistence test proves `assistant_terminal` alone does not call
  `HistoryFile.finalizeExchange()`; terminal `chat:turn_end` owns one
  idempotent provisional finalization.
- Persistence test proves `metadata.turnStatus` is canonical, top-level
  exchange/status-column/finalize arguments mirror it exactly, and mismatched
  status values are rejected or normalized through one code path.
- Provider failure and missing-reply hydration use
  `metadata.assistantTerminal`; renderer conditions do not inspect raw provider
  payloads.
- Missing-reply hydration test proves the canonical keys are
  `metadata.turnStatus = "missing_reply"`, `metadata.missingAssistantReply =
  true`, and `metadata.assistantTerminal.kind = "missing_reply"`; no alternate
  alias is accepted in new code.
- Draft send that times out before `sessionID` fails the draft and restores text
  to the composer after the backend emits `thread:draft:failed`.
- Draft send that times out after `sessionID` commits finalizes the exchange
  with `turnStatus: "missing_reply"` and `missingAssistantReply: true`, and
  restores normal Send.
- Terminal precedence tests prove `sessionID` plus no visible output becomes
  `missing_reply` on timeout or process exit without structured provider error,
  while a structured provider error becomes `provider_error`.
- Frontend display timers do not fail, cancel, commit, restore text, or finalize
  missing replies without backend terminal events.
- Active draft cancellation before commit stops the transient runtime and writes
  no SQLite thread, exchange, markdown, or harness config.
- Stop during `Creating Session...` sends `thread:draft:cancel` with
  `reason: "user_stop"`, enforces `DRAFT_STOP_TIMEOUT_MS`, and writes no durable
  state if cancel wins before commit.
- Stop after draft commit finalizes the committed turn with
  `turnStatus: "interrupted"`, preserves partial output, renders completed-turn
  chrome, and allows follow-up sends after terminal `chat:turn_end`.
- Terminal schema test proves `assistantTerminal.severity` accepts `info` for
  `kind: "interrupted"` and canonical events include
  `requiresCommittedThread: true`.
- `thread:draft:cancelled` with `reason: "user_stop"` restores the same pending
  intent to editable `draft` with the original text, while abandonment reasons
  remove the pending row and restore no composer text.
- Active draft registries, MRU timers, and owner-only delivery key off
  `session.connectionId`; reconnect creates a new connection id and does not
  resume pre-commit attempts.
- Server-side WebSocket close during a slow pre-commit draft calls
  `DraftCommitService.cancelByConnection`, stops the transient run, and leaves
  no SQLite/markdown/harness config state.
- Late cancellation after commit does not roll back the committed thread.
- Duplicate `thread:draft:send` with the same `draftId` starts no second
  transient runtime; conflicting duplicate payload is rejected.
- Duplicate idempotency test proves the canonical
  `DraftAttemptFingerprint` treats omitted attachments and `[]` as equal,
  compares `userInput` exactly, and rejects changed prompt/harness/source/title
  with `draft_duplicate_conflict`.
- Duplicate terminal failure for the same `draftId` is replayed, while retrying
  the pending intent with a new `draftId` starts a new attempt.
- Duplicate same-`draftId` send after `thread:draft:committed` replays the
  committed result to the owner connection and does not create a second thread,
  exchange, fork copy, or user bubble.
- Two-client workspace test proves `thread:draft:*` frames are delivered only to
  the owner connection; non-owner clients receive only committed-thread
  broadcasts such as `thread:list`.
- `thread:list` routing test proves every list frame includes `workspaceId` and
  a late origin-workspace list does not mutate the currently visible workspace.
- Workspace broadcaster test proves draft commit, delayed passive MRU, immediate
  committed send MRU, count update, and markdown sync status use
  `WorkspaceThreadBroadcaster.broadcastThreadList(workspaceId, reason)` for all
  subscribers instead of one-socket `sendThreadList(ws)`.
- A second active draft cancels the first pre-commit attempt or obeys normal
  busy rules after commit.
- Replacement ordering test proves a second `thread:draft:send` with different
  `draftId` receives no `thread:draft:accepted` until the earlier active attempt
  has emitted cancel/commit/fail terminal state.
- Replacement validation test proves invalid replacement `thread:draft:send`
  emits `thread:draft:failed(newDraftId)` and leaves the old active draft
  running unchanged.
- Fork draft send validates source at send time.
- Passive committed-thread open leaves `updated_at` unchanged until
  `MRU_REORDER_DELAY_MS` and writes/broadcasts at the same time.
- Every `thread:list` committed row includes `entry.threadId` and
  `entry.updatedAt`; the client uses `threadId` for identity and `updatedAt`
  only to merge pending rows without reordering committed rows against server
  order.
- Final protocol test fails any new server `thread:list` or
  `thread:draft:committed.thread` row without `threadId` or `updatedAt`; legacy
  `id`/missing `updatedAt` tolerance is client-only migration behavior.
- Passive MRU timer is keyed by workspace, connection, surface, and thread; a
  second client viewing another thread does not cancel the first client's timer.
- Secondary thread passive open uses surface `secondary`; primary and secondary
  timers do not cancel each other.
- Existing committed-thread send writes MRU immediately but only once.
- Runtime activation/resume/warm does not update `updated_at`.
- `thread:touch` either goes away or obeys the explicit delayed/immediate MRU
  policy.
- Fork draft send freezes source session/exchange metadata at send time.
- Fork source with legacy exchange metadata missing `turnStatus` is eligible as
  saved/complete when the runtime is idle.
- Fork source with runtime busy is rejected with `fork_source_busy` even if the
  latest saved exchange has missing or complete `turnStatus`.
- Fork draft send copies the frozen source snapshot at commit time, not the
  latest source state.
- Fork draft send abandoned by source-thread send creates no stale fork.
- Source-thread send during active fork draft after snapshot freeze cancels or
  resolves the fork attempt before accepting the source send; if the fork already
  committed, it remains durable.
- Legacy `thread:open-assistant` without a known committed `threadId` creates no
  SQLite row, markdown file, exchange row, harness config, or spawned wire.
- `thread:markdown:rebuild` rebuilds markdown from SQLite and clears/marks clean
  `harness_config.fusion.markdownSyncStatus`.
- Markdown rebuild failure after SQLite commit preserves the durable thread,
  marks `markdownSyncStatus.state = "dirty"`, and emits `thread:sync_status`.
- Non-empty draft attachments are rejected before harness start with
  `draft_attachments_unsupported`.
- Missing-reply hydration renders the Material `error` marker, completed-turn
  chrome, and empty-response detail on expand/click.
- Future prompts after missing reply do not include `Reply not received` as
  assistant history.
- Normal Send can continue an OpenCode session after an earlier missing reply.

---

## 10. Superseded Behavior

This spec supersedes:

- `archive/THREAD_LIFECYCLE_HARDENING_SPEC.md` Part A empty-thread cleanup for
  New Chat. Empty New Chat rows should not exist for this flow.
- `archive/OPENCODE_THREAD_FORK_SPEC.md` click-time pending fork creation. Fork
  click is RAM-only; persistence happens after the first committing provider
  signal from the first fork prompt.

Manual hard delete remains valid for existing durable threads.

---

## 11. Vertical Slices And Smoke Tests

Each slice must remove or narrow the old connected path it replaces. Do not keep
both click-time persistence and RAM-only pending intent active. Each smoke test
must exercise the public user or WebSocket route, not only a helper.

Use these baseline commands as applicable:

```text
cd fusion-studio-server && npm test -- --runInBand <focused-test-file>
cd fusion-studio-client && npm run build
cd fusion-studio-client && npx playwright test <focused-e2e-spec>
```

### Slice 1 - RAM Pending Intent Shell

Goal:

- New Chat creates a RAM-only pending intent and temporary thread-list row.
- Fork creates a RAM-only pending fork intent and sends no WebSocket request.
- Server/client harness config exposes the server-owned `draftHarness` readiness
  object before pending New Chat is enabled.
- Programmatic `fusion:chat-action` with `target: 'new'` creates the same
  RAM-only pending intent instead of opening a real server thread.
- Pending rows are composed into rendered thread-list rows and selected through
  `activeChatTarget.intentId` or equivalent. Do not store pending rows in
  committed `threads`, `projectChats`, fake `currentThreadId` values, or
  `draftId`-keyed UI state.
- Pending text survives switching to existing threads and back.
- New Chat, Fork, Send elsewhere, workspace switch, and refresh abandon pending
  intent according to the rules above.

Boundaries:

- Frontend state owner: `panelStore.ts` or existing chat/thread store owner.
- UI components emit product intent only.
- No `thread:draft:send` route, transient runtime, thread creation route, or
  SQLite write is added in this slice. Updating existing harness/status config
  transport for `draftHarness` readiness is in scope.

Smoke before next slice:

- Client build passes.
- Focused UI or store test proves New Chat/Fork click creates no WebSocket
  thread creation call.
- Client/store test proves New Chat is disabled or returns typed feedback while
  draft harness support/default readiness is unknown.
- Client/store test proves New Chat without an explicit harness uses the
  advertised default draft harness.
- Client/store test proves no supported draft harness produces
  `draft_no_supported_harness` and does not create a pending row.
- Status-refresh test proves removing the default draft harness disables pending
  New Chat or selects the new server-provided default.
- Harness default scope test proves `draftHarness.workspaceId` is workspace-wide
  and not view/panel-local; per-view CLI deltas affect only explicit harness
  choices, not automatic pending New Chat default.
- Server harness test proves configured default unsupported with OpenCode
  available selects OpenCode as `draftHarness.defaultDraftHarnessId`.
- Focused UI or store test proves `target: 'new'` chat actions do not call
  `thread:open-assistant`.
- Focused UI or store test proves pending rows are rendered without mutating
  committed `threads`/`projectChats` and active selection distinguishes
  pending-vs-thread targets using `intentId`.
- Focused UI/store test proves pending intents are primary-surface only:
  secondary chat cannot select/render/send a pending target, secondary committed
  opens do not abandon pending intent, and secondary committed sends abandon
  pending intent with `send_elsewhere`.
- Focused UI/store hydration test proves `activeChatTarget` is RAM-only:
  pending targets are never persisted to `ViewUIState.currentThreadId` or
  workspace cache, and refresh restores only committed `currentThreadId`.
- Focused UI/store test proves a later `thread:list` does not auto-open MRU over
  an active pending target when `currentThreadId` is null.
- Focused UI/store or WS test proves selecting a pending row after viewing a
  committed thread sends `thread:surface:clear` for the primary surface so the
  server cancels delayed passive MRU for the prior committed thread.
- Focused UI/store test proves New Chat with empty text survives opening an
  existing thread and can be reselected.
- Focused UI/store test proves the visible pending intent is connection-global,
  not one per workspace: creating New Chat/Fork in workspace B abandons the
  unsent pending row from workspace A, and workspace switching alone abandons
  the current pending row according to the abandonment rules.
- Focused UI/store test proves pending row sort keys use `createdAt` and delayed
  `listUpdatedAt`, not fake committed-thread `updated_at`.
- Focused UI or store test proves text survives thread switching and is
  abandoned by New Chat/Fork/Send elsewhere.

### Slice 2 - Draft Send Route With Pre-Commit Failure

Goal:

- Add canonical `thread:draft:send` under the existing thread WebSocket handler.
- Add `DraftCommitService`; backend validates draft metadata and can start a
  transient harness runtime through `startTransientDraftHarness()`.
- Backend generates a reserved future `threadId` but does not insert it unless a
  committing provider signal arrives.
- If the harness exits before any committing provider signal, backend emits
  `thread:draft:failed` and writes no durable thread, exchange, markdown file, or
  `harness_config`.
- Client restores original composer text only after backend `thread:draft:failed`
  for a still-active visible pending intent whose failure envelope has
  `restoreComposer: true`; abandoned/recent attempts must not restore text.
- Backend accepts `thread:draft:cancel` and cancels active pre-commit attempts.
- Backend enforces draft idempotency and one active pre-commit draft per
  connection across all workspaces.
- Backend emits `thread:draft:accepted` for every accepted draft with
  `acceptedAt` and timeout policy/deadlines.
- Draft send validates against the server-owned `supportsSignalGatedDraft` and
  authoritative `draftHarness` contract introduced in Slice 1.
- Backend rejects unsupported harnesses and non-empty draft attachments before
  harness startup.
- Normal committed-thread `prompt` handles `abandonDraftId` and resolves active
  draft cancel/late-commit ordering before prompt acceptance.

Boundaries:

- WebSocket protocol remains provider-neutral.
- Backend owns validation and failure routing.
- Backend owns terminal timeout/cancel decisions.
- Transient harness startup must not require a persisted `threadId`.
- `spawnThreadWire()` is not used for pending draft send.
- Harness config patches before commit are buffered by `DraftCommitService`, not
  persisted through `updateHarnessConfig()`.

Smoke before next slice:

- Public WS route test receives `thread:draft:accepted` for every accepted draft
  and verifies accepted deadlines come from the backend.
- Unit/route test proves `DraftCommitService` starts draft runs via
  `startTransientDraftHarness()` and does not call `spawnThreadWire()`.
- Unit test proves pre-commit harness config patches are buffered and discarded
  on pre-commit failure/cancel.
- Public WS/client test proves pre-commit provider retry/status emits
  `thread:draft:status`, updates the pending overlay by `draftId`, and creates
  no committed thread/chat state.
- Public WS/client test proves `thread:draft:status.phase` accepts only the
  typed enum values, maps `provider_retry_wait` to hourglass/red retry text,
  maps `provider_retry_attempt` back to the orb, and logs/ignores unknown
  phases.
- Public WS route test sends `thread:draft:send` with a fake harness that fails
  before session identity and receives `thread:draft:failed`.
- Public WS route test proves `thread:draft:failed` includes `code`, `message`,
  `recoverable`, `restoreComposer`, and `phase`.
- Client/store test proves retry after `commit_failed` uses a new `draftId`.
- Client/server harness test proves an explicit unsupported harness selection
  fails with `draft_harness_unsupported` and does not silently fall back to the
  workspace default.
- Public WS route test rejects unsupported harnesses with
  `draft_harness_unsupported`.
- Public WS route test rejects non-empty draft attachments with
  `draft_attachments_unsupported`.
- Persistence readback proves no SQLite thread/exchange and no markdown file were
  created.
- Public WS route test starts a slow draft, sends `thread:draft:cancel`, receives
  `thread:draft:cancelled`, and proves no durable thread/exchange/markdown,
  or harness config was created.
- Public WS route test presses/simulates Stop during `Creating Session...`,
  sends `thread:draft:cancel` with `reason: "user_stop"`, enforces
  `DRAFT_STOP_TIMEOUT_MS`, receives `thread:draft:cancelled`, and proves no
  durable thread/exchange/markdown or harness config was created when cancel
  wins pre-commit.
- Client/store test proves `user_stop` cancellation restores the pending intent
  to editable `draft` with original text, while abandonment cancellation removes
  the pending row and restores no composer text.
- Server close test starts a slow draft, closes the WebSocket, proves
  `DraftCommitService.cancelByConnection` stops the transient run, and proves no
  durable thread/exchange/markdown or harness config was created.
- Server lifecycle test proves draft attempts and close cleanup are keyed by
  `session.connectionId`, not raw `ws` object identity, and reconnect does not
  resume pre-commit attempts.
- Duplicate-send test proves same `draftId` does not start two transient
  runtimes and conflicting duplicate payload is rejected.
- Cross-workspace active-draft test proves one connection can have only one
  active pre-commit draft across all workspaces; New Chat/Fork/Send in another
  workspace resolves the old draft before the new action is accepted.
- Client/store test proves abandoning a `creating` pending intent moves its
  active attempt into `recentDraftAttempts` with a five-minute terminal replay
  TTL.
- Client/store and WS tests prove late `thread:draft:failed` or
  `thread:draft:cancelled` after New Chat/Fork replacement, Send elsewhere, or
  workspace switch update recent terminal state without recreating pending UI,
  restoring composer text, or changing focus.
- Client/store and WS tests prove late owner-only pre-commit draft frames route
  by `{ workspaceId, draftId }`: a draft started in workspace A cannot mutate
  workspace B after the user switches workspaces.
- Duplicate-send fingerprint test proves omitted attachments and `[]` normalize
  the same, prompt text is exact, and changed prompt/harness/source/title rejects
  with `draft_duplicate_conflict`.
- Duplicate terminal failure replay test proves same failed `draftId` replays the
  failure, while new `draftId` starts a fresh attempt.
- Two-client WS test proves owner-only pre-commit `thread:draft:*` delivery for
  accepted/status/failed/cancelled frames; non-owner clients do not receive
  draft ids or pending state.
- Public WS route test sends a normal committed-thread `prompt` with
  `workspaceId`, `abandonDraftWorkspaceId`, and `abandonDraftId` while a draft
  is creating and proves pre-commit cancellation/failure is resolved before
  prompt acceptance.
- Public WS route test sends a legacy normal `prompt` without `abandonDraftId`
  while the same connection has an active pre-commit draft and proves the server
  still resolves pre-commit cancellation/failure before prompt acceptance.
- Client build passes after handler/type additions.

### Slice 3 - New Chat Commit On Session Identity And Visible Output

Goal:

- First committing provider signal creates the durable thread.
- `sessionID` alone commits and saves the user bubble without rendering
  assistant content.
- Minimal post-session timeout handling is included in this slice: if session
  identity commits and no visible assistant/terminal provider event arrives by
  the backend deadline, finalize the provisional exchange with
  `assistantTerminal.kind = "missing_reply"`. Full visual polish for that chrome
  lands in Slice 4.
- `thread:draft:committed` is the only event that renders the first user bubble;
  no duplicate `message:sent` appears for the same prompt.
- If the user browses another committed thread before commit arrives, the
  committed draft row is added and pending row removed without moving focus.
- Draft commit creates a provisional exchange row and returns its `exchangeId`.
- `thread:draft:committed.thread` includes `threadId` and `updatedAt`, and the
  server follows commit with an authoritative `thread:list` broadcast for final
  committed ordering. This slice proves the draft-commit list payload shape;
  full MRU timing policy remains owned by Slice 6.
- New Chat draft commit sets `messageCount: 1` because `messageCount` is
  exchange/turn count.
- `chat:turn_begin` is replayed after `thread:draft:committed` with the same
  `turnId`/`exchangeId` and `renderUserBubble: false`.
- `chat:turn_end` finalizes the provisional exchange row in place.
- Provisional `chat:turn_end` carries `persistenceMode:
  "finalize_provisional"`, `provisionalExchangeId`, `exchangeId`, and
  `skipLegacyAssistantAppend: true`.
- Provider session identity arrives as universal commit metadata, not raw
  OpenCode protocol in the universal applier.
- Canonical bridge/applier preserves the fixed draft commit event fields:
  `commitsDraft`, `render`, `draftId`, `turnId`, `exchangeId`, provider
  identity, and `assistantTerminal`.
- Visible text/tool/thinking events buffered before commit replay once under the
  real thread id.
- Normal `message:sent`, live snapshot, exchange persistence, and metadata paths
  remain canonical after commit.

Boundaries:

- Commit service uses ThreadManager/owning persistence helpers.
- Harness config patches are buffered until the real thread exists.
- Canonical bridge/applier receives only canonical events or metadata, not raw
  provider protocol.
- This slice is not shippable if session-id-only commits can remain in flight
  indefinitely. Either keep the feature flag disabled or include the minimal
  missing-reply finalization above.

Smoke before next slice:

- Public WS route test with fake `sessionID` commits a new thread, persists the
  user prompt and provider config, and renders no assistant text.
- Public WS route test with fake `sessionID` and no later output finalizes the
  same provisional exchange as `missing_reply` at the backend deadline.
- Universal-applier test proves provider session identity does not create
  visible assistant content.
- Public WS route test with OpenCode fake first text before `sessionID` buffers
  the text, commits only when `sessionID` arrives, then replays the text exactly
  once.
- Public WS route test with OpenCode fake first text and no `sessionID` fails
  pre-commit with `provider_no_commit` and writes nothing durable.
- Public WS route/client handler test proves duplicate user bubble events are
  ignored or never emitted for the first draft prompt.
- Client handler/store test proves late `thread:draft:committed` after browsing
  another thread does not change `activeChatTarget`/`currentThreadId`.
- Client handler/store test proves late `thread:draft:committed` after New
  Chat/Fork replacement, Send elsewhere, or workspace switch removes old recent
  attempt state, updates the committed list/cache, and does not recreate pending
  UI or steal focus.
- Public WS route/client handler test proves `thread:draft:committed` plus
  replayed buffered stream events are delivered to the owner and cached under
  the committed `threadId` when the user browsed away, without rendering into
  the currently active chat surface.
- Duplicate committed replay test proves same committed `draftId` replays
  `thread:draft:committed` to the owner connection and creates no second thread,
  exchange, fork copy, or user bubble.
- Two-client WS test proves committed `thread:list` delivery is workspace
  broadcast-only after draft commit, while owner-local `draftId` and pending
  state remain owner-only.
- Public WS route test proves Send elsewhere / legacy prompt ordering when the
  old draft commit wins: the committed draft remains durable, and the new prompt
  is accepted only if normal runtime busy/resource rules allow it.
- Hydration test proves refresh/client disconnect recovers only committed draft
  threads through normal `thread:list`/`thread:open`; no RAM-only
  `recentDraftAttempts` state is expected after reconnect.
- Public WS route/client handler test proves `thread:draft:committed.thread`
  includes `threadId` and `updatedAt`, and the following `thread:list` provides
  final authoritative committed ordering.
- Runtime handoff test proves a still-live draft run attaches to the normal
  committed runtime registry after commit; a follow-up Send uses the attached
  runtime without respawn or lost events.
- Event-ownership test proves `DraftCommitService` is the only drain owner for
  the first draft turn before and after commit; `thread-runtime-controller` does
  not double-drain the same iterator, and follow-up sends are rejected as busy
  until the first draft turn reaches terminal state.
- Transient harness test proves `startTransientDraftHarness()` sends the first
  prompt exactly once from `firstPrompt`; draft code never calls a second
  `send()` for that first prompt.
- Canonical bridge/applier test proves draft commit fields are preserved through
  bridge payload conversion.
- Storage test proves `HistoryFile.beginExchange()` plus
  `finalizeExchange()` produces one row, not two.
- Transaction test proves `ThreadCommitRepository.commitDraft()` writes thread,
  copied exchanges, provisional exchange, message count, updated_at, and initial
  harness config in one SQLite transaction using a shared `trx`.
- Storage test proves provisional exchange turn end skips
  `persistAssistantMessage()`/`ChatFile.appendMessage()` and rebuilds markdown
  from SQLite.
- Event-bus test proves provisional `chat:turn_end` carries the required
  handoff flags and audit/applier branch on them before legacy persistence.
- Storage/API test proves New Chat draft commit returns `messageCount: 1`.
- Migration/startup test proves legacy `message_count` values are repaired from
  `exchanges` before thread-list hydration.
- Failure-injection test proves markdown rebuild failure after SQLite commit
  marks `harness_config.fusion.markdownSyncStatus.state = "dirty"` and emits
  `thread:sync_status`.
- Failure-injection test proves SQLite commit failure after provider `sessionID`
  emits no `thread:draft:committed`, leaves no partial SQLite rows, and logs the
  orphan-risk condition.
- Failure-injection client test proves SQLite commit failure after provider
  `sessionID` sets pending state to `commit_error`, not recoverable
  `commit_failed`, and restores no composer text.
- SQLite and markdown readback match the committed user prompt and assistant
  output.

### Slice 4 - Provider Failure And Missing Reply Terminal Chrome

Goal:

- OpenCode `type: "error"` translates in the OpenCode adapter to the universal
  failure shape.
- Structured provider error with `sessionID` emits provider session identity
  first, commits, then renders failure chrome without saving error text as
  assistant history.
- Two-stage first-visible-response timeout works:
  - 0-10 seconds: pending indicator
  - 10-20 seconds: red connection text plus reusable hourglass
  - no `sessionID`: draft fails and text returns to composer
  - with `sessionID`: exchange finalizes with
    `turnStatus: "missing_reply"` and `missingAssistantReply: true`
- Missing reply renders Material `error` + `Reply not received`, completed-turn
  chrome, and `No chat text found` detail on expand/click.
- Terminal states persist and hydrate through `metadata.assistantTerminal` and
  `metadata.turnStatus`.
- Stop disappears and Send returns; no Continue/Recover/Resend/Retry modes.

Boundaries:

- Provider error parsing stays in harness adapters.
- Missing-reply and failure displays are exchange metadata, not assistant text.
- Universal renderer consumes only universal failure/missing-reply metadata.

Smoke before next slice:

- Adapter test proves OpenCode JSON `type: "error"` becomes universal failure.
- Public WS route test proves structured error with `sessionID` commits and does
  not persist error text as assistant history.
- Public WS route test proves pre-session timeout writes nothing and restores the
  draft.
- Public WS route test proves post-session timeout persists canonical
  missing-reply metadata (`turnStatus: "missing_reply"`,
  `missingAssistantReply: true`, and
  `assistantTerminal.kind: "missing_reply"`) and hydrates completed-turn chrome.
- Public WS/client stream test proves live `assistant_terminal` frame carries
  `assistantTerminal`, `metadata`, `exchangeId`, and empty `assistantText`, and
  renders chrome without adding assistant text.
- Hydration test proves `assistantTerminal.kind` drives provider failure and
  missing-reply render conditions without raw provider branching.
- Test proves frontend display timers alone cannot mark a draft failed or
  missing-reply without backend terminal events.
- Client build passes after chrome changes.

### Slice 5 - Fork Draft Commit

Goal:

- Fork click remains RAM-only.
- Fork send validates the source against Fork Source Eligibility and freezes
  that source snapshot at draft-send time.
- The transient OpenCode run uses source `opencodeSessionId` plus `--fork`.
- On committing provider signal, server creates the fork thread, copies source
  exchanges from the frozen snapshot at commit time, saves first prompt, stores
  new fork `sessionID`, and writes `forkProvenance`.
- Fork `messageCount` equals copied source exchanges plus the first provisional
  exchange. It is not copied role messages times two.
- Old click-time `createPendingForkThread()` path is deleted or narrowed out of
  composer fork.

Boundaries:

- OpenCode `--fork` syntax remains in the OpenCode adapter/harness boundary.
- Source session id is provenance/input only and must not be stored as the fork
  thread's active session id.

Smoke before next slice:

- UI/store or E2E spy test proves Fork click sends no server request and creates
  no SQLite row.
- Public WS route test proves fork draft send uses `--session <source> --fork`
  and commits only after a committing provider signal.
- Test proves non-Send source metadata/history changes during the transient fork
  run do not change copied fork history beyond the frozen source exchange
  id/seq.
- Public WS route test proves source-thread Send during an active fork draft
  after snapshot freeze cancels/resolves the fork attempt before accepting the
  source Send; if fork commit already won, the fork remains durable.
- Test proves a source whose latest saved exchange has no `metadata.turnStatus`
  is treated as complete when the source runtime is idle.
- Test proves a busy source runtime returns `fork_source_busy` even if the
  latest saved exchange is legacy/complete.
- SQLite readback proves copied source exchanges, first prompt, fork provenance,
  and active fork `opencodeSessionId` are correct.
- Client handler/render test proves active fork `thread:draft:committed`
  hydrates from `copiedExchanges + initialExchange`, rendering copied source
  history plus first prompt without duplicate bubbles or focus theft.
- SQLite/API readback proves a fork from seven source exchanges commits with
  `messageCount: 8`.
- Old fork tests that encode click-time persistence are replaced or removed.

### Slice 6 - MRU Timing Consistency

Goal:

- Thread selection changes active chat immediately.
- `MRU_REORDER_DELAY_MS` is defined once and shared by client/server.
- Committed-thread `updated_at` writes happen only when visible reorder happens.
- Leaving before the visible reorder threshold cancels the MRU write.
- Durable user activity such as committed-thread send and draft commit writes
  MRU immediately and broadcasts the reordered list at the same time.
- Runtime activation/resume/warm paths do not write MRU.
- Pending RAM rows use `createdAt`/`listUpdatedAt` local visible timing but never
  write SQLite.

Boundaries:

- Backend remains authoritative for committed-thread ordering.
- Pending rows remain client RAM state.

Smoke before next slice:

- Server route test proves `updated_at` is unchanged immediately after passive
  open.
- Public WS route test proves `thread:open` accepts/echoes
  `surface: "primary" | "secondary"` on `thread:opened`, treats legacy missing
  surface as `primary`, and rejects unknown surface values without scheduling
  MRU.
- Public WS route test proves `thread:surface:clear` cancels delayed passive
  MRU for `{ workspaceId, connectionId, surface }` without writing SQLite or
  emitting `thread:list`.
- Timer-controlled test proves `updated_at` and list reorder happen together
  after the threshold.
- Timer-controlled test proves leaving before threshold cancels the DB write.
- Route/storage test proves committed-thread send writes MRU immediately, only
  once, and broadcasts the matching sorted list.
- Storage/API test proves normal committed-thread send increments
  `messageCount` once per exchange/turn.
- Broadcast test proves normal committed-thread send emits one immediate MRU
  broadcast on prompt acceptance and a later count-update broadcast on exchange
  save without a second MRU touch.
- Draft commit MRU test proves `ThreadCommitRepository` writes initial
  `updated_at` inside the commit transaction using a timestamp/policy helper
  from `ThreadMruService`, and no second direct MRU write occurs.
- Broadcast test proves draft commit uses the server commit timestamp for
  durable `updated_at`, broadcasts the following `thread:list` through
  `WorkspaceThreadBroadcaster`, and never imports client-only pending
  `listUpdatedAt`.
- Route/storage test proves runtime activation/resume/warm does not change
  `updated_at`.
- Route/storage test proves `thread:touch` is removed or follows the explicit
  delayed/immediate MRU policy.
- Multi-client timer test proves passive selection timers are keyed by
  `{ workspaceId, connectionId, surface, threadId }`; one client's navigation
  does not cancel another client's pending MRU write.
- Secondary-chat timer test proves primary and secondary surfaces have separate
  passive timers and cancellation scopes.
- Broadcast test proves delayed passive MRU and immediate durable-activity MRU
  broadcast the reordered committed list to all workspace subscribers in the
  same operation that writes SQLite.
- Broadcast test proves MRU paths call
  `WorkspaceThreadBroadcaster.broadcastThreadList(workspaceId, reason)` and do
  not use a one-socket `sendThreadList(ws)` helper for workspace-wide updates.
- Timer-controlled client/store test proves pending row `listUpdatedAt` updates
  only after `MRU_REORDER_DELAY_MS` when the pending row remains selected.
- Config test or import test proves client and server use one
  `MRU_REORDER_DELAY_MS` source.
- Client build passes if thread-list rendering changed.

### Slice 7 - Cleanup, Hydration, And End-To-End Smoke

Goal:

- Remove or narrow obsolete New Chat create-on-open and click-time fork paths.
- Legacy `thread:open-assistant` without a known committed `threadId` returns a
  recoverable disabled-create error and creates no row/wire.
- Hydration after refresh renders committed normal turns, provider failures, and
  missing replies correctly.
- Future prompts after missing reply include the user message but not Fusion's
  local `Reply not received` marker as assistant history.
- Normal Send can continue an OpenCode session after missing reply.
- `thread:markdown:rebuild` can repair dirty markdown from SQLite.

Boundaries:

- No dead compatibility shims unless still needed for existing durable threads.
- Any remaining low-level create/fork helper has a named owner and no direct UI
  path.

Smoke before implementation is considered complete:

- Full focused server Jest set for draft send, fork, OpenCode adapter, metadata,
  and MRU behavior passes.
- Client build passes.
- Playwright smoke covers:
  - New Chat draft with no DB row before send
  - pre-commit failure restores input
  - committed missing reply renders completed chrome
  - normal send after missing reply continues the thread
- Restart/hydration smoke proves failure/missing-reply metadata survives reload.
- Public WS route test proves `thread:open-assistant` without a known committed
  `threadId` creates no SQLite row, markdown file, exchange row, harness config,
  or spawned wire.
- Public WS route/storage test proves `thread:markdown:rebuild` repairs a dirty
  thread from SQLite and clears/marks clean markdown sync status.
