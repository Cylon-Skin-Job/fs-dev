---
name: Chat Runtime Model
description: Explains how chat threads are opened, warmed, streamed, stopped, persisted, and resumed. Use this page when changing runtime state or thread lifecycle behavior.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Identity And Persistence
    - Chat Rendering And Lifecycle
    - Chat Harness And Event Flow
    - Chat UI
    - Chat Decisions
  source-files:
    - fusion-studio-server/lib/thread/thread-crud.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/thread/thread-runtime-manager.js
    - fusion-studio-server/lib/thread/live-turn-snapshot.js
    - fusion-studio-server/lib/thread/canonical-drain-context.js
    - fusion-studio-server/lib/thread/turn-terminal-error.js
    - fusion-studio-server/lib/thread/HistoryFile.js
    - fusion-studio-server/lib/thread/ThreadIndex.js
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
    - fusion-studio-server/lib/chat-metadata/collectors/attachments.js
    - fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js
    - fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
  connected-skills: []
  related-trigger-files: []
---

How threads are opened, warmed, streamed, stopped, and persisted.

## Shell and server generation

Electron owns one immutable public runtime descriptor per server launch. The
descriptor pairs exact `http://127.0.0.1:<port>` and
`ws://127.0.0.1:<port>` endpoints with a bounded opaque generation. The server
binds only exact IPv4 loopback and reports only its selected port at readiness.

On generation change, the renderer runtime-transport owner aborts outstanding
server HTTP work and closes sockets created for the old generation.
`ws-client.ts` clears response trackers and transient connection state, creates
one new socket, and lets the normal `workspace:init` path rehydrate
authoritative state. Missing or invalid descriptor state is disconnected and
has no browser/page-origin fallback.

Each server generation has a separate ephemeral HMAC master held only in
Electron main and server memory. Electron transfers it once through the
dedicated inherited bootstrap pipe before server readiness. A socket receives
one short-lived challenge and does not release `connected`, `workspace:init`,
or panel configuration until the current shell main frame obtains and returns
an exact one-use proof, the server's full runtime-activation barrier, and
server-side product-session activation succeeds. The barrier opens only after
startup audit, shutdown supervision, and application handler publication.
The authenticated acknowledgement is emitted only after that activation, so a
failed activation or close race cannot release buffered initialization.
Restart retires the old master, connection, pending
proof, and generation together; normal initialization then hydrates only after
fresh authentication. The server's `trusted-shell` role is transient private
connection state, not renderer or persistent state. Pending managed sockets are
not product recipients and cannot observe or participate in workspace, harness,
theme, clipboard, calendar, projection, or targeted product fan-out.
Their connection setup also does not construct the DB-backed wire, activity,
workspace, manager, or application-router graph before proof succeeds. A
managed socket's receiver remains protocol-sized until initialization and
transport activation succeed, then restores the established application-frame
ceiling immediately before acknowledgement. A transport-only registry owns
both pending and active upgraded sockets for
expiry, abnormal-close removal, restart, and normal shutdown. It is never a
product recipient or target source. Shutdown awaits the owned close events and
asynchronous product cleanup before process exit so each activated connection
completes durable session suspension.

At the decoded thread-message boundary, New Chat, assistant activation/resume,
Rename, Delete, Touch, Warm, and prompt-triggered runtime activation require
that exact private role before their current owners
run. Assistant resume is privileged because its current implementation writes
resumed and MRU metadata in addition to launching the stored provider session.
Passive `thread:open` retains standalone hydration without writing `resumed_at`,
`updated_at`, or delayed list state. Legacy Fork is always denied before
thread-manager or provider work, and stored Fork-era provider state is removed
before adapter activation.
Thread identity lookup and every metadata read/write/delete are qualified by
the manager's `workspace_id` and project scope. A foreign workspace thread ID
therefore resolves as unavailable before history, mirror, provider, session,
or list effects; assistant upsert does not reinterpret that foreign identity
as a request to create a new thread.

Passive selection and live-session ownership are separate connection state.
When Warm or a prompt successfully opens a provider session, ownership moves to
that thread for both cold spawn and existing READY-wire reuse, and disconnect
cleanup suspends that exact activation. Deleting a
passively selected thread never closes a different active thread; deleting the
active thread closes it even while another thread is selected for hydration.
Every activation resolves the live session root and requires it to match the
current workspace manager before lookup or spawn. Manager registry identity
includes both workspace id and normalized project root, so a same-id root
relocation cannot reuse old-root persistence or provider state. Each adapter
session also captures that workspace's runtime launch policy, so initializing
the shared adapter for another workspace cannot retarget an existing session's
CLI, model, mode, or configured-secret provider. Ownership transfers and
deletion are serialized per connection across close/open and workspace-switch
boundaries. A separate per-connection workspace-operation lease linearizes
workspace binding with Create/Resume, Rename, Delete, Touch, Warm, and prompt
acceptance through persistence and provider admission. If the action wins it
finishes that bounded admission before binding begins; if binding wins, the
action is denied before manager, database, list, event, or provider effects.
A binding-in-progress session cannot fall back to the socket's
construction root, and a superseded workspace epoch cannot launch a child.
Before a different workspace pair becomes authoritative, the transition
cancels delayed list work, unregisters outbound delivery, suspends the exact
connection-owned provider session, clears the connection wire reference, and
retires selected/activated thread identity. Delayed resume-list work itself
re-enters the same operation lease, so it either finishes while the old
workspace is authoritative or observes retirement and emits nothing.
`wire_ready` is emitted only after the transfer commits; a new wire
whose transfer fails or becomes stale is killed and unregistered without
readiness or clearing a newer owner. Provider stdout, disconnect notification, and in-flight drain
retirement resolve the exact current client owner at delivery/retirement time,
not the connection that originally spawned the wire.
Runtime, wire-delivery, lifecycle, and diagnostic records are all qualified by
workspace id, normalized project root, connection epoch, and thread identity.
An idle same-root provider may cross to a replacement epoch only through the
serialized activation owner's explicit adoption step; raw status, delivery,
and diagnostic lookups never inherit state across roots or epochs. If the
predecessor cannot retire, a same-wire target transfer restores its exact prior
client/epoch owner. If the target exits while predecessor retirement is
awaited, activation rolls back and emits no readiness or delivery ownership.
Passive manager-backed reads use the same live pair check without requiring
trusted mutation authority. After an A-to-B bind, A's retained manager cannot
serve open/list/link/search data while B's panel manager is pending;
normal B reads resume after the exact B manager is installed.
The isolated agent-tool fixture is bound to its startup-provisioned thread,
workspace, and root and holds the same workspace-operation lease across passive
selection, authority creation, filesystem work, canonical events, and result
delivery. It cannot use a retained manager after another workspace binds.

## Persistent Unit

The persistent unit is a thread.

| Table | Purpose |
|---|---|
| `threads` | Metadata: id, workspace, scope, view, name, harness, status, MRU |
| `exchanges` | Rich turn history: user input, assistant parts, metadata, sequence |

Markdown chat files still exist for compatibility and link/view workflows. The
rich renderer hydrates from SQLite exchanges.

## Workspace Open

When a workspace opens, the client requests the project thread list:

```json
{ "type": "thread:list", "scope": "project" }
```

If there is no active project thread and the list is non-empty, the client
passively opens the MRU thread:

```json
{ "type": "thread:open", "scope": "project", "threadId": "..." }
```

This hydrates history without spawning a harness.

## Passive Browse

Clicking an existing thread sends `thread:open`.

Server response:

- `thread:opened`
- rich exchange history
- optional `liveTurn` snapshot when the thread has an active in-memory turn

Passive browse must not warm, spawn, kill, mark resumed, update MRU, or schedule
a list reorder.

## New Thread And Activation

New chat uses `thread:open-assistant` without a `threadId`:

```json
{ "type": "thread:open-assistant", "scope": "project" }
```

The server resolves the default harness from `ai/<machine>/System/config/cli.json`. In the
current OpenCode-only config, no explicit `harnessId` is needed.

`thread:open-assistant` is the assistant activation/create path:

1. If a valid `threadId` is supplied, resume/open that assistant thread.
2. If no valid `threadId` exists, create a new SQLite thread row.
3. Persist the resolved harness id on the thread.
4. Send `thread:created`.
5. Open and hydrate the thread.

Server-side policy rejects explicit disabled or absent harnesses for new thread
creation.

Creation accepts only portable `model` and `variant` fields inside
`harnessConfig`. Provider-session ids, Fork metadata, credentials, and unknown
fields receive the same bounded denial before manager lookup or persistence.
An explicit `variant: null` is a clear operation and is persisted/applied to
the live session rather than silently retaining an earlier effort selection.

Every harness/CLI process and installation/version probe receives its
environment from the central server child-environment policy. The policy copies
only documented common keys and adapter-specific credentials; it does not copy
the host environment wholesale and never forwards shell authority material.
Location/version probes receive no provider credentials, while runtime
credential sets are isolated by adapter (or OpenCode's documented
multi-provider responsibility).
The inventory parses launch syntax and rejects detached aliases, wrappers, ESM
renames, dynamic built-in-module acquisition, shadowed/prebuilt environment
bindings, and any launch whose inline `env` is not directly owned by the
central builder.

## Warm And Cold Runtime

Runtime state is centralized around:

```text
cold -> warming -> ready -> in_flight -> stopping
```

Intent to send can warm a cold runtime:

- input focus
- paste/insert into input
- send fallback
- automation prompt

Passive thread browsing does not warm.

## Prompt Acceptance

Prompt sending goes through `threadRuntimeController.acceptPromptThroughRuntime`.

Current flow:

1. Client sends prompt with `scope`, `threadId`, `user_input`, and optional
   `attachments`.
2. Server checks/warm runtime readiness.
3. Server rejects in-flight/stopping conflicts.
4. Server persists/accepts the user message.
5. Server emits `message:sent`.
6. Client commits the user bubble and clears accepted input.
7. Server serializes a compact attached-reference block for the harness when
   attachment metadata is present.
8. Harness events stream through the canonical path.

At acceptance, the controller also creates one unique `drainId`, a deeply
copied/frozen route context containing the accepted workspace/thread/input and
attachments, and a non-serializable control bound to the exact runtime and
harness. `ThreadRuntimeManager` claims the drain before iterator consumption,
binds the server `turnId` once, and compare-checks every later mutation,
terminalization, Stop, lease touch, exception, and cleanup. Interactive and
automation prompts use the same ownership model.
Adapter session registries and event queues use workspace id, normalized root,
and public thread id together, preventing equal thread ids in two workspaces
from sharing translator state, events, or cleanup.

The client no longer commits the user bubble optimistically on click.

## Turn Metadata

Completed turns persist structured metadata in `exchanges.metadata`.

Metadata assembly is modular:

- runtime emits prompt and turn events with attachment context
- workspace watchers emit file changes with their exact workspace id and root;
  a complete epoch/thread/turn tuple targets only that exact live turn, while a
  normal watcher observation without that tuple is collected only when exactly
  one live turn matches its workspace and root. Partial tuples, foreign roots,
  and ambiguous same-root observations are omitted rather than assigned
  causally. Records remain keyed by workspace, root, epoch, thread, and turn so
  delayed finalization cannot consume a following turn's mutations
- `chat-metadata` collectors contribute focused metadata slices
- the exchange metadata aggregator merges collector output with audit metadata

Do not add new extraction rules directly to runtime, canonical chat applier,
`HistoryFile`, or the audit subscriber. Add a collector instead.

Current collector fields:

- `attachments` from pending `Send to chat` pills
- `mentions` from repo-validated non-`.md` file mentions in user/assistant text
- `fileMutations` from turn-correlated file change events

Status correlation and thread lifecycle state use exact workspace/thread/turn
identity rather than bare thread ids. Workspace retirement waits for the
canonical drain and its tracked audit/ledger effects before a replacement bind;
shutdown likewise drains legacy ledger writes before closing the database.

## Live Turns

The runtime owns an in-memory `liveTurn` snapshot. Canonical events update this
snapshot through the same state path used for persistence.

The JSON-safe snapshot projects accepted input/attachments, assistant/tool
parts, usage, `activity`, `stepCursor`, `seenStepIdentities`,
`activityRevision`, `terminalError`, status, and the authoritative
`streamSeq`. Functions, harness objects, and drain control never enter it.
Each accepted in-flight publication exposes the sequence produced by the same
gated mutation, so a same-or-newer snapshot can reconstruct that frontier.
Terminalization clears transient activity/cursor/ledger/usage; an error
snapshot retains only the validated safe terminal envelope until durable save
catches up.

When a user revisits a thread with an active turn, `thread:opened` can include
`liveTurn`. The client hydrates durable history first, then overlays the live
turn.

## Stop And Interrupt

Stop uses:

```json
{ "type": "turn:stop", "scope": "project", "threadId": "..." }
```

The server owns stop behavior:

- mark runtime stopping
- emit one synthetic interrupted canonical `turn_end`
- persist partial assistant parts through the normal turn-end path
- stop the harness process/session
- cool the runtime

The client should not locally finalize a stopped turn before the server's
terminal event.

## OpenCode Clean Exit Repair

Some OpenCode model paths emit useful content and exit code `0` without
`step_finish`. Fusion treats clean exit after useful output as a terminal event
and synthesizes canonical `turn_end` with metadata:

```text
terminalSource: "process_exit_missing_step_finish"
```

Nonzero exits, process errors, and clean exits with no useful output still fail.
After an accepted `turn_begin`, those failures terminalize exactly once through
the bound drain as `reason: "error"`, `partial: true`; pre-begin failures create
no assistant exchange.

## Automation

Automation hooks can send prompts without a focused UI. They use explicit
workspace/project/thread targets and the same runtime/canonical event path. They
do not call `ws.send` directly and should not interrupt in-flight user turns.
