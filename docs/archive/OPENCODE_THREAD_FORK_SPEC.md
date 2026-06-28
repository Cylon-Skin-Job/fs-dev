# OpenCode Thread Fork Spec

**Archived:** This is a historical click-time pending fork plan. Do not
implement it directly. Current New Chat/Fork persistence behavior is defined in
`../PENDING_CHAT_INTENT_SPEC.md`; keep only the verified OpenCode
`--session <sourceSessionId> --fork` mechanics here as background.

Implementation spec for wiring OpenCode's native current-head session fork into
Fusion Studio. This spec is scoped to the fork lifecycle itself plus the small
UI move that exposes Fork from composer chrome instead of assistant reply
chrome.

**Supersession note:** Click-time persisted pending fork creation is superseded
by `PENDING_CHAT_INTENT_SPEC.md`. Fork click should now create only a RAM
pending intent; validation, source snapshot, Fusion persistence, and OpenCode
`--fork` happen on first send after the harness streams a real event. The
OpenCode `--session <sourceSessionId> --fork` mechanics and session-id cautions
below remain relevant to the send-time commit path.

## Goal

Let the user prepare a fork from the current OpenCode-backed chat thread without
creating durable Fusion or OpenCode state until first send. On first send,
Fusion validates the source thread, starts OpenCode with `--fork`, and commits
the new Fusion fork only after the harness streams a real event.

This implementation scope is OpenCode's native current-head fork only. Forking
from an earlier chat turn is out of scope.

## Verified OpenCode Behavior

Installed OpenCode exposes native session fork through the `run` command:

```bash
opencode run --session <sessionID> --fork "prompt"
opencode run --continue --fork "prompt"
```

`opencode run --help` says:

```text
--fork  fork the session before continuing (requires --continue or --session)
```

Important boundaries:

- `--fork` is used when continuing an existing OpenCode session.
- The CLI help exposes current/head session fork, not message-level fork.
- No installed CLI option was found for `--fork-at <messageID>`, `--until`,
  or any other mid-thread branch point.
- `opencode export <sessionID>` and `opencode import <file>` exist, but
  export/truncate/import is not confirmed as a supported fork-from-earlier-turn
  path and must remain experimental until explicitly proven.
- OpenCode stores its own session state in SQLite at
  `~/.local/share/opencode/opencode.db`. Fusion must not write OpenCode's
  database directly.

## Fusion Terms

| Term | Meaning |
|---|---|
| Fusion thread id | `threads.thread_id`; Fusion-owned routing and persistence id. |
| OpenCode session id | Provider session id stored in `threads.harness_config.opencodeSessionId`. |
| Chat id / exchange id | Saved SQLite `exchanges.id`; identifies one saved chat pair. |
| Source thread | Existing Fusion thread being forked. |
| Fork thread | New Fusion thread created by the fork action. |
| Pending fork | A fork thread that has been created in Fusion but has not yet sent the first prompt that causes OpenCode to fork. |

## UX Placement

Fork is currently present only as a disabled assistant-reply overflow-menu
stub. That stub must be removed. Fork is not a per-reply action.

Assistant reply chrome should have no overflow menu after the reply chrome
reorganization. The target assistant reply row is:

```text
content_copy   text_to_speech   bookmark   link_2   compress
```

Reply chrome changes are tracked in:

```text
ASSISTANT_REPLY_CHROME_PLAN.md
```

Add the Fork affordance to the composer meta row under the chat input, nested
in the existing left icon strip immediately to the left of the microphone
button.

Current icon order target:

```text
clipboard   screenshots   recent files   emoji   fork_right   mic
```

The Fork control should use the existing composer icon/button aesthetic:

- Material icon: `fork_right`
- Same workspace/theme CSS variables as the other composer icon triggers.
- New class names are preferred so the user can customize it independently.
- Tooltip/title: `Fork thread`
- Disabled while the current thread is accepting a prompt, streaming,
  stopping, finalizing, or lacks a saved OpenCode session id.

## Thread Naming

When the user clicks the composer Fork control, Fusion creates a new thread
immediately and switches to it.

The new thread name is:

```text
Fork: {{Original name}}
```

The original name must be the resolved user-facing source thread name at fork
time. If `threads.name` is null, use the same display fallback the thread list
uses, then store that resolved value in fork metadata so later source-thread
renames do not change the fork label unexpectedly.

The fork thread keeps this name unless the user manually renames it.

## Pending Fork Storage

The new Fusion thread must store enough information to perform the OpenCode
fork later, even if the user closes the app before sending the first prompt.

Use the existing `threads.harness_config` JSON as the storage surface. No schema
migration is required for this implementation.

Suggested shape:

```json
{
  "pendingFork": {
    "type": "opencode-current-head",
    "status": "pending",
    "sourceThreadId": "thread-source",
    "sourceThreadName": "Original name",
    "sourceExchangeId": 123,
    "sourceExchangeSeq": 7,
    "sourceOpenCodeSessionId": "ses_source",
    "requestedAt": "2026-06-25T04:30:00.000Z",
    "requestedFrom": "composer-fork-button"
  }
}
```

After the first prompt successfully creates the OpenCode fork, preserve durable
provenance and store the new OpenCode session id:

```json
{
  "opencodeSessionId": "ses_new_fork",
  "forkProvenance": {
    "type": "opencode-current-head",
    "status": "created",
    "sourceThreadId": "thread-source",
    "sourceThreadName": "Original name",
    "sourceExchangeId": 123,
    "sourceExchangeSeq": 7,
    "sourceOpenCodeSessionId": "ses_source",
    "createdOpenCodeSessionId": "ses_new_fork",
    "requestedAt": "2026-06-25T04:30:00.000Z",
    "createdAt": "2026-06-25T04:35:00.000Z",
    "requestedFrom": "composer-fork-button"
  }
}
```

Do not store `sourceOpenCodeSessionId` as the fork thread's active
`opencodeSessionId`. The source id is only the fork base. The fork thread's
active `opencodeSessionId` is the new session id returned by OpenCode after
the first `--fork` run.

## Fork Creation Flow

**Legacy note:** This section describes the earlier click-time persisted pending
fork implementation. For new implementation work, follow
`PENDING_CHAT_INTENT_SPEC.md`: fork click is RAM-only and the durable fork is
created on first-send stream-gated commit.

### User Clicks Fork

1. User is on an idle, saved OpenCode-backed source thread.
2. User clicks composer `fork_right`.
3. Client sends a server-owned thread fork request.
4. Server validates:
   - source thread exists in the current workspace
   - source thread `harness_id` is `opencode`
   - source thread has `harness_config.opencodeSessionId`
   - source thread is not accepting a prompt, in flight, stopping, or finalizing
   - latest source exchange is saved if provenance should pin the current head
5. Server creates a new Fusion thread:
   - `harness_id = "opencode"`
   - `name = "Fork: {{Original name}}"`
   - `message_count` copied from the source thread history being duplicated
   - `status = "suspended"` or existing new-thread default
   - `harness_config.pendingFork = ...`
6. Server duplicates the source thread's saved Fusion exchanges into the new
   fork thread so the renderer can show the prior conversation history.
7. Server returns `thread:forked` with explicit fork metadata after the copied
   exchanges are durable. The client must not reuse the existing
   `thread:created` empty-thread clear path unless it also immediately hydrates
   the copied exchanges in the same flow.
8. Client switches to the new thread and hydrates the duplicated history. A
   brief empty/loading state while the database write and hydration complete is
   acceptable.

No OpenCode process needs to run at click time. If the user never sends a
message, no OpenCode fork is created.

### User Sends First Prompt In Pending Fork

1. Server accepts the prompt through the normal prompt-acceptance path.
2. Runtime startup reads `threads.harness_config.pendingFork`.
3. OpenCode harness starts the first run with:

   ```bash
   opencode run --format json --dir <projectRoot> --session <sourceOpenCodeSessionId> --fork "<user prompt>"
   ```

4. Runtime config still applies normally:
   - `--model <provider/model>` if configured
   - `--thinking` if configured
   - `--pure` if configured
5. When OpenCode emits the returned `sessionID`, Fusion treats it as the fork
   thread's active `opencodeSessionId`.
6. Fusion updates the fork thread `harness_config`:
   - remove `pendingFork`
   - set `opencodeSessionId` to the new returned session id
   - set `forkProvenance`
7. The turn streams, persists, and finalizes through the normal chat turn path.

### User Opens Pending Fork Later

If the app restarts or the user switches threads before sending:

1. Thread list still shows the fork thread as `Fork: {{Original name}}`.
2. Opening the thread hydrates the duplicated source history plus pending fork
   metadata.
3. Sending the first prompt consumes `pendingFork` exactly as above.

## Server API Shape

Use a dedicated WebSocket message rather than overloading reply chrome actions.

Client request:

```json
{
  "type": "thread:fork",
  "sourceThreadId": "thread-source"
}
```

`sourceExchangeId` is optional. The composer Fork action normally omits it
because Fork is not launched from a specific assistant reply. When omitted, the
server resolves the latest saved exchange from the source thread for provenance.
This is still an OpenCode current-head fork; the exchange id is metadata for
Fusion, not an OpenCode message-level branch point.

Server response:

```json
{
  "type": "thread:forked",
  "threadId": "thread-new",
  "thread": {
    "name": "Fork: Original name",
    "messageCount": 7,
    "status": "suspended",
    "harnessId": "opencode",
    "harnessConfig": {
      "pendingFork": {
        "type": "opencode-current-head",
        "status": "pending",
        "sourceThreadId": "thread-source",
        "sourceThreadName": "Original name",
        "sourceExchangeId": 123,
        "sourceExchangeSeq": 7,
        "sourceOpenCodeSessionId": "ses_source"
      }
    }
  }
}
```

If any caller supplies `sourceExchangeId`, the server must still treat it as
provenance only unless a separately proven OpenCode message-level fork path
exists.

The fork response must either include the copied rich exchanges or be followed
immediately by a normal `thread:opened` event for the fork thread. The current
client `thread:created` handler clears chat state for a new empty thread, so
fork implementation needs a distinct `thread:forked` handler or an explicit
open-after-copy sequence.

## Harness Changes

`fusion-studio-server/lib/harness/opencode/index.js` currently builds run args
from the active OpenCode session id:

```text
opencode run --format json --dir <projectRoot> --session <opencodeSessionId> "<prompt>"
```

Add a pending-fork path without changing normal resume behavior.

Rules:

- Normal thread with `opencodeSessionId`:

  ```text
  --session <opencodeSessionId>
  ```

- Pending fork thread with no active `opencodeSessionId`:

  ```text
  --session <pendingFork.sourceOpenCodeSessionId> --fork
  ```

- Pending fork thread must capture the first returned OpenCode `sessionID` as
  the new active `opencodeSessionId`.
- Do not set the runtime session object's `openCodeSessionId` to the source id.
  Keep the source id separate, otherwise the existing first-session-id capture
  path will think the session is already known and may fail to persist the new
  forked session id.
- Once the new id is persisted, normal follow-up prompts use:

  ```text
  --session <createdOpenCodeSessionId>
  ```

Suggested harness session state:

```js
{
  openCodeSessionId: storedSessionId || null,
  pendingFork: harnessConfig.pendingFork || null,
  pendingForkConsumed: false
}
```

Suggested config update on first returned session id:

```js
updateHarnessConfig({
  opencodeSessionId: newOpenCodeSessionId,
  pendingFork: null,
  forkProvenance: {
    ...pendingFork,
    status: 'created',
    createdOpenCodeSessionId: newOpenCodeSessionId,
    createdAt: new Date().toISOString()
  }
});
```

The exact merge semantics must preserve unrelated `harness_config` keys. A
cleared pending fork may be represented by deleting `pendingFork` or by storing
`pendingFork: null`; all readers must treat null and missing as the same
non-pending state.

## Fusion History Duplication

This implementation clones the source thread's saved Fusion exchanges into the
new fork thread when the fork thread is created.

Why:

- OpenCode owns the provider-side current-head fork state.
- Fusion owns local rendering from its `exchanges` table.
- OpenCode will duplicate provider-side session state only after the first fork
  prompt.
- Until then, Fusion still needs local rows so the fork thread visually opens
  with the same prior conversation history.
- Future chat pairs in the fork thread are saved only to the fork thread.

Clone scope:

- Copy saved exchanges from the source thread up to the resolved
  `sourceExchangeId`.
- Assign the copied rows to the new fork thread id.
- Preserve `seq`, `user`, `assistant`, timestamps, and metadata unless a
  migration or table constraint requires generating new primary ids.
- Do not reuse SQLite primary ids; the fork thread gets its own exchange rows.
- The duplicated rows may preserve bookmark/note metadata so the visible fork
  history matches the source at fork time.
- Store fork provenance in `harness_config` so downstream code can distinguish
  copied history from newly generated fork-thread turns when needed.

This intentionally creates duplicate searchable exchange content across the
source and fork threads. That is acceptable for this scope because the user
expects the fork thread to be a full visual duplicate at the fork point.

## Disabled And Error States

Disable or hide the composer Fork control when:

- no current thread exists
- current thread harness is not OpenCode
- current thread lacks `harness_config.opencodeSessionId`
- current thread is accepting a prompt, streaming, stopping, or finalizing
- source thread is not in the current workspace

If a click races with state changes and required data is missing, use the same
active-action fallback:

```text
Error: Data Unavailable
```

If pending fork first-send fails before OpenCode returns a new session id,
preserve `pendingFork` so the user can retry.

If OpenCode returns a session id and then the turn later fails, keep the new
`opencodeSessionId` and `forkProvenance`; the fork was created.

## Security And Privacy

- Do not inspect or expose provider API tokens.
- Do not write OpenCode's SQLite database directly.
- Do not log full prompts, reasoning text, or tool output as part of fork
  metadata.
- Fork metadata may store ids, timestamps, source thread name, and source
  exchange id.
- If source thread name could contain sensitive text, it is already visible in
  the UI; keep it out of low-level debug logs.

## Code Standards Check

Standards source:

```text
ai/views/wiki-viewer/Wiki/005-Enforcement/001-Code_Standards/PAGE.md
ai/views/wiki-viewer/Wiki/005-Enforcement/003-Chat_Styling_And_Workspace_CSS/PAGE.md
```

This implementation must follow the one-job-per-file and layer-boundary rules.

Server placement:

- Do not implement fork by expanding the existing new-chat flow in
  `thread-crud.js`; that file already owns normal create/open policy and is
  over the preferred size threshold.
- Add a dedicated fork service/helper, for example
  `fusion-studio-server/lib/thread/thread-fork-service.js`, whose one job is to
  create a persisted pending fork thread from a source thread. Source
  validation, fork thread creation, exchange copying, and payload shaping are
  private steps of that job. It should not send WebSocket messages.
- Add only thin routing/glue to `fusion-studio-server/lib/ws/thread-ws-handlers.js`:
  receive `thread:fork`, call the fork service, send `thread:forked` or an
  error, and refresh/open as specified.
- Keep `ThreadManager`, `ThreadIndex`, and `HistoryFile` changes small and
  generic. Do not add fork-specific orchestration to those classes.
- Do not add fork behavior to `client-message-router.js` beyond its existing
  handler-map dispatch; it is already a router, not a fork controller.

Client placement:

- Keep `ChatAreaFooter.tsx` presentational. It may render a Fork button from
  props, but it must not read stores, send WebSocket messages, or inspect
  thread metadata directly.
- Do not materially grow `useChatArea.ts`; it is already above the preferred
  file-size threshold. If Fork eligibility and click handling require more than
  minimal wiring, put that one responsibility in a small hook/controller such
  as `useComposerForkAction.ts`.
- Add `thread:forked` handling in the WebSocket thread handler rather than
  special-casing fork in unrelated stream or metadata handlers.
- Add only the needed client type fields for `harnessConfig` and `thread:forked`.
  Do not split the large central types file as part of this feature; that would
  be unrelated refactor scope.
- Composer Fork CSS should reuse existing composer icon classes where possible.
  Any new CSS must use `.rv-` classes and CSS variables with fallbacks.

Scope control:

- Do not implement Text to Speech, Compress, Create Ticket, or per-message
  OpenCode branching while doing this work.
- Do not create generic shared abstractions for one-off fork logic unless a
  second current consumer appears.
- Each vertical slice must leave the app buildable and have its focused smoke
  check before the next slice starts.

## Vertical Slices

Each slice should leave the app in a coherent state and should have a narrow
smoke test before moving to the next slice.

### Slice 1 - Reply Chrome Cleanup

Remove assistant-reply overflow chrome and leave existing active reply actions
working.

Changes:

- Remove `more_horiz` and the reply overflow menu from assistant replies.
- Move `link_2` Chat ID into the inline reply action row.
- Move `compress` into the inline reply action row as a disabled stub.
- Remove the disabled reply-level `fork_right` stub.
- Remove the separate Add/View Note reply action.
- Remove Create Ticket from reply chrome.
- Keep bookmark modal note editing intact.

Smoke tests:

- Completed assistant replies render:

  ```text
  content_copy   text_to_speech   bookmark   link_2   compress
  ```

- No reply `more_horiz` button or menu renders.
- Chat ID still copies SQLite `exchanges.id`.
- Bookmark modal still opens and can edit bookmark plus note.
- No Fork, Add/View Note, or Create Ticket action appears under replies.
- Client build passes: `npm run build` in `fusion-studio-client`.

### Slice 2 - Composer Fork Button Shell

Add the composer-level Fork affordance without creating fork threads yet.

Changes:

- Render `fork_right` in the composer icon row immediately left of Mic.
- Keep the button disabled in this slice; it is a visible shell until the
  server endpoint and click integration land.
- Use the same composer icon styling and tooltip/title `Fork thread`.
- Do not wire a click path that mutates thread state in this slice.

Smoke tests:

- Composer row shows:

  ```text
  clipboard   screenshots   recent files   emoji   fork_right   mic
  ```

- Fork is disabled for non-OpenCode, missing-session, prompt-acceptance,
  streaming, stopping, and finalizing states.
- Fork is still disabled for an otherwise eligible idle OpenCode thread until
  Slice 4 wires the server-backed click path.
- Clicking the visible shell does not create a reply action or mutate the
  current thread.
- Client build passes.

### Slice 3 - Server Fork Endpoint And History Clone

Add `thread:fork` handling that creates the new Fusion thread, stores pending
fork metadata, and copies source exchanges for local rendering.

Changes:

- Add `thread:fork` request handling.
- Validate workspace ownership, OpenCode harness id, saved source
  `opencodeSessionId`, and idle source-thread state.
- Resolve the latest saved source exchange for fork provenance.
- Create `Fork: {{Original name}}`.
- Store `pendingFork.sourceOpenCodeSessionId` on the fork thread.
- Do not set the fork thread's active `opencodeSessionId` yet.
- Copy saved source exchanges up to the fork point into the fork thread with
  new SQLite primary ids.
- Preserve visible exchange content and metadata in the copied rows.
- Return `thread:forked`.

Smoke tests:

- Server test: valid OpenCode source creates a fork thread named
  `Fork: {{Original name}}`.
- Server test: new thread has `pendingFork.sourceOpenCodeSessionId` and no
  active `opencodeSessionId`.
- Server test: copied exchanges belong to the new thread and keep visible
  user/assistant content, sequence, timestamps, and metadata.
- Server test: missing source session id returns a recoverable error.
- Server test: non-OpenCode source thread is rejected.
- Server tests pass for the fork endpoint and exchange-copy helper.

### Slice 4 - Client Fork Click Integration

Wire the composer Fork button to the server endpoint and switch to the forked
thread after creation.

Changes:

- On click, send `thread:fork` with `sourceThreadId`.
- Handle `thread:forked`.
- Add the returned thread to thread state/list.
- Switch the active chat to the new fork thread.
- Hydrate/render duplicated history. A brief empty/loading state while the DB
  copy and hydration complete is acceptable.
- Enable Fork only when the current thread is idle, OpenCode-backed, and has a
  saved `harness_config.opencodeSessionId`.

Smoke tests:

- Fork is enabled for an eligible idle OpenCode thread.
- Clicking Fork on an eligible thread creates and opens
  `Fork: {{Original name}}`.
- The fork thread visually shows the duplicated source conversation history.
- The fork thread has no active `opencodeSessionId` before first send.
- Switching away and back still shows the duplicated history.
- Client build passes.

### Slice 5 - OpenCode Pending Fork Harness Path

Teach the OpenCode harness to consume pending fork metadata on first prompt and
capture the new provider session id.

Changes:

- Runtime startup passes `harness_config.pendingFork` to the OpenCode harness.
- Pending fork threads emit:

  ```text
  --session <pendingFork.sourceOpenCodeSessionId> --fork
  ```

- Do not set `session.openCodeSessionId` to the source id.
- Capture the first returned OpenCode `sessionID` as the fork thread's active
  `opencodeSessionId`.
- Clear `pendingFork` and preserve `forkProvenance`.
- Keep normal resume behavior unchanged for non-pending OpenCode threads.

Smoke tests:

- Harness unit/smoke: normal thread still emits `--session <current>`.
- Harness unit/smoke: pending fork emits `--session <source> --fork`.
- Harness unit/smoke: first returned session id becomes active
  `opencodeSessionId`.
- Harness unit/smoke: `pendingFork` is cleared and `forkProvenance` is saved.
- Server tests pass.

### Slice 6 - Restart And First-Send Integration

Verify the complete delayed-fork lifecycle when the user forks but sends no
prompt immediately.

Changes:

- Ensure pending fork metadata persists through thread switches and app restart.
- Ensure copied Fusion history persists and hydrates before first send.
- Ensure first send after restart consumes `pendingFork`.
- Ensure follow-up prompts use the newly created OpenCode session.

Smoke tests:

- Create a fork thread and do not send a prompt.
- Switch threads and return; duplicated history is visible.
- Restart Fusion and open `Fork: {{Original name}}`; duplicated history is
  visible and `pendingFork` remains.
- Send the first prompt; OpenCode receives `--session <source> --fork`.
- The returned OpenCode session id is saved as the fork thread's active
  `opencodeSessionId`.
- Send a follow-up prompt; it uses the new fork session, not the source
  session.

### Slice 7 - Full Regression Smoke

Run one end-to-end pass across the UI cleanup and fork lifecycle.

Smoke tests:

- Assistant reply chrome has no overflow menu and no reply-level Fork.
- Copy reply, Chat ID copy, and bookmark note editing still work.
- Composer Fork is positioned immediately left of Mic.
- Fork is inert until source thread is idle/finalized.
- Fork creates and opens a full visual duplicate of the source thread.
- First prompt in the fork creates the provider fork and stores the new
  OpenCode session id.
- Run:

  ```bash
  cd fusion-studio-client
  npm run build
  ```

- Run:

  ```bash
  cd fusion-studio-server
  npm test
  ```

## Dependencies And Silent-Fail Risks

These are the implementation dependencies that can fail quietly if only the
happy path is wired.

- WebSocket routing: add `thread:fork` to
  `fusion-studio-server/lib/ws/thread-ws-handlers.js` and add `thread:forked`
  to the client message type union and `handleThreadMessage` switch. Without
  the client case, the server can create the fork successfully while the UI
  appears to do nothing.
- Client state shape: the server already emits `entry.harnessConfig` when a
  thread has config, but `fusion-studio-client/src/types/index.ts` does not
  currently declare `ThreadEntry.harnessConfig`. Add a typed shape before the
  composer uses it to decide whether Fork is enabled.
- Fork create/copy/open ordering: create the thread, copy exchanges, update
  `message_count` and MRU state, then send `thread:forked` and hydrate/open
  the thread. Opening through the existing `thread:created` path before copy
  will clear the chat as an empty thread.
- SQLite clone constraints: do not copy `exchanges.id`. Preserve `seq` only
  within the new thread, where the existing unique constraint is
  `(thread_id, seq)`. Keep thread creation, `pendingFork`, copied exchanges,
  and `message_count` in one transaction or explicitly clean up a partially
  created fork on failure.
- Message count: `threads.message_count` is a thread-list display field and is
  currently mutated separately from rich exchange inserts. Set it consistently
  with the source/thread-list convention; do not leave a copied-history fork at
  `0`.
- Markdown chat file: `ThreadManager.createThread()` also creates an empty
  markdown `ChatFile`. The renderer prefers rich SQLite exchanges, so copied
  SQLite history will display, but legacy consumers of the markdown file would
  see an empty chat unless the fork flow also copies or rebuilds that file.
  Decide this explicitly during implementation.
- Copied metadata and ids: copied exchanges get new `exchangeId` values, so
  Chat ID copy in the fork returns fork-local ids, not source ids. Preserving
  bookmark/note metadata means bookmark/search surfaces may show source and
  fork duplicates; this is acceptable for the current full-visual-duplicate
  requirement.
- Pending fork storage: `ThreadManager.updateHarnessConfig()` performs a
  shallow merge. If `pendingFork` is cleared with `null`, all readers must
  treat null the same as missing. If deletion semantics are required, add a
  helper instead of assuming merge removes keys.
- OpenCode session capture: never assign
  `pendingFork.sourceOpenCodeSessionId` to the fork runtime's active
  `openCodeSessionId`. Doing so prevents the existing first-session-id capture
  path from saving the new forked OpenCode `sessionID`.
- First-prompt failure handling: if the first prompt fails before OpenCode
  returns a new session id, keep `pendingFork` so retry still forks from the
  source. If a new session id was returned and persisted before a later stream
  failure, keep the new active `opencodeSessionId` and clear `pendingFork`.
- Idle validation race: the button should be disabled in the client, but the
  server must also reject a fork if the source thread starts accepting,
  streaming, stopping, or finalizing between render and click.
- Logging: `thread:fork` metadata can include source names and session ids.
  Extend redaction/logging rules as needed so debug logs do not expose
  provider session ids or note bodies from copied metadata.

## Acceptance Criteria

- Fork is removed from assistant reply chrome.
- Assistant reply chrome has no overflow menu.
- Fork appears in the composer icon row immediately left of the microphone
  button.
- Fork creates a new Fusion thread named `Fork: {{Original name}}`.
- The new thread stores pending fork metadata before any prompt is sent.
- The new thread contains duplicated Fusion exchange history from the source
  thread up to the fork point.
- Pending fork metadata survives thread switches and app restart.
- The first prompt from a pending fork thread invokes OpenCode with
  `--session <sourceOpenCodeSessionId> --fork`.
- The new OpenCode `sessionID` returned by that run is stored as the fork
  thread's active `opencodeSessionId`.
- Follow-up prompts in the fork thread continue the new forked OpenCode
  session, not the source session.
- No implementation writes directly to OpenCode's SQLite database.
