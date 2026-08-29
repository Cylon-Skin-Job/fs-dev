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
    - fusion-studio-server/lib/thread/live-turn-snapshot.js
  connected-skills: []
  related-trigger-files: []
---

Canonical events are Fusion Studio's provider-neutral chat vocabulary.

Common canonical harness events include:

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

The canonical chat event applier converts these into app-level chat state and
emits `chat:*` events.

## Step And Frontier Contract

`step_begin` carries a stable server-issued identity and normalized start time.
The runtime checks the source identity against a full-turn seen ledger before
time normalization, so delayed replay cannot become a fresh step. It updates
the transient activity/cursor/ledger projection and never creates a thinking
or content part.

Whitespace-only input that would create a new thinking or content part is
suppressed inside the accepted mutation before snapshot update, publication,
or persistence. Once a real same-type part exists, later chunks are preserved
exactly.

`LiveTurnSnapshot.streamSeq` is the single whole-turn frontier. `turn_begin`
starts it at 1; each accepted in-flight publication advances it exactly once
inside the gated snapshot mutation and carries the resulting value.
`activityRevision` orders only Working transitions and never reorders or
suppresses valid output. `streamRevision` does not exist.

## Compatibility Status

This canonical chat path intentionally remains the documented pre-SPEC-40b2
`chat:*` compatibility path. It does not call canonical admission, create
accepted-only references, publish to canonical-only ledger subscribers, or
invent provenance relationships. Disabled legacy adapters remain unchanged;
their sequence-less compatibility frames are tolerated, not retrofitted.

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
