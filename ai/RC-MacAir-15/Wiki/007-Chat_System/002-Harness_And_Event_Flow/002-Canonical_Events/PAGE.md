---
name: Canonical Events
description: Canonical harness and chat events used after provider-specific output has been translated.
metadata:
  incoming-edges:
    - Chat Harness And Event Flow
  outgoing-edges:
    - Universal Event Bus
    - Chat WebSocket Protocol
  source-files:
    - fusion-studio-server/lib/harness/types.js
    - fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
  connected-skills: []
  related-trigger-files: []
---

Canonical events are Fusion Studio's provider-neutral chat vocabulary.

Common canonical harness events include:

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

The canonical chat event applier converts these into app-level chat state and
emits `chat:*` events.

## Tool Results

Canonical `tool_result` payloads carry provider-neutral result fields:

```text
output
statusMessage
display
returnedDiff
isError
files
```

`statusMessage` is optional displayable diagnostic/status text. Harness adapters
should omit provider titles, command labels, lifecycle words, and text already
present in `output`.

Do not infer `isError` from words such as `fatal`. Use canonical error metadata
that the harness adapter derived from reliable provider signals such as exit
code or explicit error status.

## Rule

Frontend code should not parse provider-native output. It should receive
application WebSocket messages derived from canonical chat events.
