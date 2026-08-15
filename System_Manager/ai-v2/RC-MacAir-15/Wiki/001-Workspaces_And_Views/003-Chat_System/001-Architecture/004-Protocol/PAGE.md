---
name: Chat System Protocol
description: WebSocket and canonical event contracts for Fusion Studio chat. Use this page when changing client/server messages, canonical harness events, or stream routing.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
  outgoing-edges:
    - Chat System Runtime Model
    - Chat System Rendering Model
    - Chat System Decisions
  source-files:
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-server/lib/ws/thread-ws-handlers.js
    - fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
    - fusion-studio-client/src/lib/ws/stream-handlers.ts
  connected-skills: []
  related-trigger-files: []
---

Message and event contracts used by the chat system.

## Client To Server

| Message | Purpose |
|---|---|
| `thread:list` | Request MRU thread list for a scope |
| `thread:open` | Passive browse/hydrate an existing thread |
| `thread:open-assistant` | Activate/resume assistant thread or create new one |
| `thread:warm` | Warm a cold runtime based on send intent |
| `prompt` | Send user input to a specific thread |
| `turn:stop` | Interrupt an in-flight turn |

## Server To Client

| Message | Purpose |
|---|---|
| `thread:created` | New thread metadata was created |
| `thread:opened` | Thread history and optional live turn are hydrated |
| `wire_ready` | Runtime is ready for prompt delivery |
| `message:sent` | Server accepted/persisted user prompt |
| `fusion:prompt-acceptance-failed` | Prompt was rejected before acceptance |
| `fusion:turn-ended` | Terminal turn event reached client state |

## Canonical Harness Events

Harness-specific output is translated into canonical events before chat
application:

```text
turn_begin
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

## Routing Rule

Chat streams route by `threadId` first. Scope, workspace, and view context are
metadata for ownership and storage. They are not the primary live-stream routing
key.

## Harness Policy

New-thread harness selection is constrained by `ai/<machine>/System/config/cli.json`.
Manual WebSocket attempts to create a disabled or absent harness thread should be
rejected server-side.

Existing historical threads use their stored `harness_id` when resumed; do not
migrate them by changing policy.

## Terminal Events

`turn_end` means the stream is done producing content. It does not mean the UI
has finished revealing all content.

OpenCode-specific repair: if OpenCode exits code `0` after useful output but
without `step_finish`, Fusion synthesizes canonical `turn_end` and marks:

```text
terminalSource: "process_exit_missing_step_finish"
```

Exit code `0` itself is not `turn_end`; the harness repair converts a known
clean-exit contract gap into canonical completion.
