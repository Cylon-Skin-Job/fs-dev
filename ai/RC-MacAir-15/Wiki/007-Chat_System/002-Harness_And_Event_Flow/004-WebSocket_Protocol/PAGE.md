---
name: Chat WebSocket Protocol
description: WebSocket and canonical event contracts for Fusion Studio chat. Use this page when changing client/server messages, canonical harness events, stream routing, or chat-turn messages.
metadata:
  incoming-edges:
    - Chat Harness And Event Flow
  outgoing-edges:
    - Legacy Wire Terminology
  source-files:
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-server/lib/ws/thread-ws-handlers.js
    - fusion-studio-client/src/types/index.ts
    - fusion-studio-client/src/types/chat-wire.ts
    - fusion-studio-client/src/lib/ws-client.ts
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
    - fusion-studio-client/src/lib/ws/stream-handlers.ts
    - fusion-studio-client/src/lib/ws/frontier.ts
    - fusion-studio-client/src/lib/ws/chat-diagnostic-handlers.ts
    - fusion-studio-server/lib/ws/chat-turn-diagnostic-handlers.js
    - fusion-studio-client/src/lib/chat-action.ts
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
  connected-skills: []
  related-trigger-files: []
---

WebSocket messages are Fusion Studio application protocol, not raw harness
protocol.

## Runtime endpoint ownership

The production renderer never constructs its WebSocket from `window.location`
or a fixed host/port. Electron preload returns the exact current
`{ generation, httpOrigin, webSocketUrl }` descriptor only to the committed
`fusion-shell://app` main frame. `src/lib/runtime-transport.ts` validates and
owns it, creates the socket, constructs every server-backed HTTP/resource URL,
and aborts old-generation work. `ws-client.ts` remains the application-message
router and consumes that transport owner.

Endpoint possession is not connection authority. The 00A descriptor contains
no secret. On each socket the server sends one bounded
`shell-auth:challenge`; the current shell main frame obtains an exact
generation-bound HMAC proof through guarded preload IPC and returns
`shell-auth:proof`. The server validates origin, generation, connection and
nonce binding, expiry, closed shapes, one-use state, and constant-time equality
before recording `trusted-shell` only on its private connection session.
Product initialization is released only after proof success and after the
server startup audit, shutdown supervision, and application handler publication
have all completed. The socket remains absent from broadcast and
targeted-recipient lookup until initialization has completed and product-session
activation succeeds. Only then does the server
emit `shell-auth:authenticated`; buffered initialization is never releasable
after activation failure or a close race. Before proof, connection setup creates
no wire, message, workspace, manager, or application-router owner. Authentication messages
are transport commands, not product facts, and never enter UEB, Provenance,
persistence, or application stores. The thread-domain guard reads only this
private live connection role. It rejects New Chat, assistant activation/resume,
Rename, Delete, Touch, Warm, and prompt-triggered activation before their normal owners run; request fields, model or
harness output, persisted values, and provenance/event metadata cannot grant
authority. Exact assistant resume is included because the activation owner writes
resumed/MRU metadata. Passive `thread:open` only hydrates history/live state and
writes neither resume/MRU metadata nor delayed list fan-out. List, history,
diagnostics, and other established reads retain standalone/untrusted compatibility.
Search is passive only for the connection's exact current workspace binding;
an explicit foreign or absent binding returns the fixed unavailable response.
`thread:fork` is always unavailable and is not a trusted capability.
After authority, thread identity is resolved only inside the connection's
workspace and project scope. Foreign thread IDs cannot hydrate history or reach
assistant upsert, Warm, prompt, Rename, Delete, Touch, mirror, or provider
effects.
Manager-backed passive open, list, link, and search reads likewise
require the manager to match the active live session root, workspace id, and
epoch. During binding or before the new panel installs its matching manager,
they return a fixed unavailable response without lookup, history, reclaim, or
list effects; a matching standalone/untrusted connection retains normal reads
inside that exact current workspace.
The isolated agent-tool test route applies that same live-pair and serialized
lease rule and additionally accepts only its process-provisioned workspace,
root, and thread identity before any fixture effect.
Warm, prompt, and assistant-open activation also resolve the current live
session root rather than the root captured when the socket was constructed.
Create/resume, Rename, Delete, Touch, Warm, and prompt acceptance share one
per-connection workspace-operation lease with workspace binding. An operation
already admitted completes its bounded persistence, response, and provider
admission before binding begins; an operation queued after binding revalidates
the exact state, session root, workspace id, manager, and epoch and is denied
before its owner. Binding-in-progress and superseded-epoch requests cannot
fall back to the construction root. `wire_ready` follows the activation commit; failed or superseded new
wires are stopped and unregistered before any readiness frame.
Workspace transition retires the old selected/activated identity, delayed
resume-list delivery, provider session, wire routing owner, and session wire
reference before the new bind frame makes its workspace pair authoritative.

Managed sockets begin with a 4 KiB WebSocket receiver and decoder ceiling, so
an unauthenticated peer cannot make the server buffer or parse application-sized
frames. Only successful initialization and transport activation restore the
established application payload ceiling, before the authenticated acknowledgement.

A deliberately standalone server has no launch master and cannot mint
`trusted-shell`; its existing diagnostic/read behavior remains available as an
untrusted development surface. Reconnect and server restart always require a
fresh challenge, renderer nonce, proof, and launch generation.
All upgraded sockets are separately owned by a transport lifecycle registry so
normal shutdown terminates pending and active transports without publishing
pending sockets to product fan-out. Shutdown awaits both transport close and
the resulting asynchronous product cleanup before exiting, which preserves
exactly-once activated cleanup through durable thread-session suspension.

## Client To Server

| Message | Purpose |
|---|---|
| `thread:list` | Request MRU thread list for a scope |
| `thread:open` | Passive browse/hydrate an existing thread |
| `thread:open-assistant` | Activate/resume assistant thread or create new one |
| `thread:warm` | Trusted-shell-only warm of a cold runtime based on send intent |
| `thread:action` | Perform a canonical visible-thread or chat-session action |
| `prompt` | Send user input and optional attachment metadata to a specific thread |
| `turn:stop` | Interrupt an in-flight turn |
| `chat-turn:diagnostic:get` | Explicitly retrieve one bounded redacted report for an exact thread/turn/id |
| `chat-turn:metadata:update` | Post-save user metadata update for a saved exchange |

Prompt payloads may include attachment metadata:

```json
{
  "type": "prompt",
  "threadId": "...",
  "user_input": "Explain this startup flow.",
  "attachments": [
    {
      "kind": "file",
      "label": "file:server.js",
      "path": "/repo/server.js",
      "sourceName": "server.js"
    }
  ]
}
```

The visible textarea remains plain user text. Attachment pills are separate UI
state until send.

## Server To Client

| Message | Purpose |
|---|---|
| `thread:created` | New thread metadata was created |
| `thread:opened` | Thread history and optional live turn are hydrated |
| `thread:action:completed` | Canonical action completed with authoritative state |
| `thread:action:error` | Canonical action failed or conflicted without ambiguous client state |
| `wire_ready` | Runtime is ready for prompt delivery |
| `message:sent` | Server accepted/persisted user prompt |
| `exchange_metadata` | Just-completed exchange metadata is available for RAM refresh |
| `chat-turn:saved` | Saved exchange acknowledgement with `exchangeId` |
| `chat-turn:metadata:updated` | Full metadata after post-save user metadata update |
| `chat-turn:metadata:error` | Failed post-save metadata update |
| `fusion:prompt-acceptance-failed` | Prompt was rejected before acceptance |
| `fusion:turn-ended` | Terminal turn event reached client state |
| `chat-turn:diagnostic:report` | One validated redacted V1 report after an explicit request |
| `chat-turn:diagnostic:unavailable` | Fixed value-free denial for every unavailable class |

## Canonical Harness Events

Harness-specific output is translated into canonical events before chat
application:

```text
turn_begin
step_begin
content
thinking
tool_call
tool_call_args
tool_result
subagent_event
status_update
turn_end
```

The canonical bridge/applier is the only provider-output owner for mutation,
event bus emission, persistence handoff, and live snapshot updates. CLI
adapters yield canonical events to that owned iterator and never publish a
second legacy status or terminal event directly. Adapter queues use the exact
workspace/root/thread session key, and wire output, exit notification, and
drain retirement follow the registry/manager's current client owner after a
successful ownership transfer.

Every accepted in-flight message from `turn_begin` through `turn_end` carries
the prompt-bound `threadId`, `turnId`, and positive integer `streamSeq`.
Messages that can change Working additionally carry `activityRevision`.
Companion transport notifications remain unsequenced and cannot become a
second transcript terminal source.

Lifecycle fan-out carries the prompt-bound workspace id, canonical root, bind
epoch, thread id, and turn id. The server delivers it only to clients whose
active session and installed thread manager still match that exact tuple.

## Client Route And Frontier Gate

The client keys live namespaces by `threadId + turnId`. A snapshot at sequence
N installs atomically as an already-revealed baseline; frames at or below N are
dropped, frames above N buffer, and only a contiguous N+1 frontier drains.
Gaps are never guessed. A newer snapshot may advance through a gap, while an
older snapshot cannot regress visible state. Hydrating one thread cannot reset
another thread's helpers or frontier.

Route and turn validation runs before helper/store mutation. `turn_begin` has
the separate empty/same/different initialization rules; `chat-turn:saved` and
metadata acknowledgements use post-terminal correlation rather than the live
turn gate.

## Diagnostic Privacy

Diagnostic lookup requires the exact server-authorized
`workspaceId + threadId + turnId + diagnosticId` tuple and returns at most one
validated report. Missing, expired, rejected, malformed, or failed retrievals
share one unavailable shape. No report appears in thread-open, history,
lifecycle, or metadata frames. The central client WebSocket logger strips the
entire report before console/captured-log forwarding and retains only type,
availability, and opaque route identifiers.

## Exchange Metadata

SQLite exchanges store structured metadata alongside user input and assistant
parts. Current chat metadata fields include:

```json
{
  "attachments": [],
  "mentions": [],
  "fileMutations": [],
  "contextUsage": null,
  "tokenUsage": null
}
```

- `attachments` comes from `Send to chat` pills.
- `mentions` contains repo-validated non-markdown file mentions from the just
  completed user/assistant text.
- `fileMutations` contains file changes captured from event bus observations
  that either carry the complete exact workspace/root/epoch/thread/turn tuple
  or match exactly one live turn for their workspace and root. Ambiguous or
  partially qualified observations are omitted rather than assigned causally.

The harness receives a compact attached-reference block appended to the prompt,
while SQLite keeps the structured metadata for UI and autocomplete hydration.

Post-save user metadata updates, such as bookmarks and notes, use the
`chat-turn:*` family and patch saved exchange metadata after persistence.

## Routing Rule

Chat streams route by `threadId` first. Scope, workspace, and view context are
metadata for ownership and storage. They are not the primary live-stream routing
key.

## Visible-thread and session actions

Keep one `thread:action` command family. A group action such as
`move_chat_to_side` carries `threadGroupId` and
`expectedPrimaryThreadId`. A provider-backed session action such as `compact`
carries `threadId`. The handler validates whichever identity set the action
requires; do not create a separate `thread-group:*` transport family.

Durable action responses go to the requester after commit. The server also
fans the authoritative result out to every open window in the workspace. An
optional UEB fact such as `thread:primary_changed` is post-commit and cannot
gate the response, persistence, or fan-out.

Requester acknowledgement, each workspace-recipient send, and UEB publication
run as separate failure-isolated post-commit deliveries. Failure or closure of
one socket never prevents attempts to the other sockets. A client that misses
the fact rehydrates authoritative group state through normal reconnect/init;
delivery failure never repeats the underlying action.

## Harness Policy

New-thread harness selection is constrained by `ai/<machine>/System/config/cli.json`.
Manual WebSocket attempts to create a disabled or absent harness thread should be
rejected server-side.

Existing historical threads use their stored `harness_id` when resumed; do not
migrate them by changing policy.

Public creation and prompt-selection `harnessConfig` accepts only portable
`model` as a non-empty string and `variant` as either a non-empty string or
explicit `null`; null clears an earlier persisted/live variant. Provider session ids, Fork metadata, credentials,
and unknown fields are rejected before lookup or persistence. Runtime loading
also removes legacy Fork state before any adapter sees stored configuration;
ordinary OpenCode session ids without Fork markers retain exact-session resume.

All production harness launches and harness/CLI installation or version probes
build their child environment through `lib/harness/child-environment.js`.
Only common process/config/locale/network keys and explicit adapter credential
keys are copied. Location and version probes receive no provider credentials;
each runtime adapter receives only its own supported credential keys (with
OpenCode retaining its explicit multi-provider set). Shell launch masters,
bootstrap metadata, runtime generations,
proof/challenge/nonces, connection roles, test injection, Electron descriptor
data, and unknown host variables are excluded.
The static inventory parses CommonJS and ESM syntax, rejects property/detached
aliases, wrapper escapes, dynamic built-in-module acquisition, shadowed or
prebuilt environments, and associates each launch call with its exact inline
builder-owned environment instead of relying on a launch count.

## Terminal Events

`turn_end` means the stream is done producing content. It does not mean the UI
has finished revealing all content or that SQLite persistence has been
acknowledged.

OpenCode-specific repair: if OpenCode exits code `0` after useful output but
without `step_finish`, Fusion synthesizes canonical `turn_end` and marks:

```text
terminalSource: "process_exit_missing_step_finish"
```

Exit code `0` itself is not `turn_end`; the harness repair converts a known
clean-exit contract gap into canonical completion.

## Adding Messages

When adding a message family:

- add server router delegation in `client-message-router.js`
- add client type union entries in `fusion-studio-client/src/types/index.ts`
- add client handlers in the appropriate WS handler module
- add redaction rules for sensitive payload paths
- route by explicit `threadId` where chat state is involved

## Reply Chrome Messages

The saved exchange acknowledgement is `chat-turn:saved`:

```ts
{
  threadId: string;
  turnId: string;
  exchangeId: number;
  seq: number;
  ts: number;
  partial: boolean;
  reason: "complete" | "interrupted" | "error";
  metadata: Record<string, unknown>;
}
```

Post-save metadata updates use:

```text
chat-turn:metadata:update
chat-turn:metadata:updated
chat-turn:metadata:error
```
