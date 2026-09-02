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

## Client To Server

| Message | Purpose |
|---|---|
| `thread:list` | Request MRU thread list for a scope |
| `thread:open` | Passive browse/hydrate an existing thread |
| `thread:open-assistant` | Activate/resume assistant thread or create new one |
| `thread:warm` | Warm a cold runtime based on send intent |
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

The canonical bridge/applier owns mutation, event bus emission, persistence
handoff, and live snapshot updates.

Every accepted in-flight message from `turn_begin` through `turn_end` carries
the prompt-bound `threadId`, `turnId`, and positive integer `streamSeq`.
Messages that can change Working additionally carry `activityRevision`.
Companion transport notifications remain unsequenced and cannot become a
second transcript terminal source.

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
- `fileMutations` contains turn-local file changes captured from event bus file
  change events.

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
