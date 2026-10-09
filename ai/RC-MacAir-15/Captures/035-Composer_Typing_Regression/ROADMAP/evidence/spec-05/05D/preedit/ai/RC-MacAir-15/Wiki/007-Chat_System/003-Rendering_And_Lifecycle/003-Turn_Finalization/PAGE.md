---
name: Turn Finalization
description: Difference between terminal stream events, reveal completion, SQLite save, and UI completion.
metadata:
  incoming-edges:
    - Chat Rendering And Lifecycle
  outgoing-edges:
    - Stop And Interrupted Turns
    - Reply Action Chrome
  source-files:
    - fusion-studio-client/src/state/slices/chatSlice.ts
    - fusion-studio-client/src/lib/ws/turn-lifecycle.ts
    - fusion-studio-client/src/components/MessageList.tsx
    - fusion-studio-server/lib/thread/turn-terminal-error.js
    - fusion-studio-server/lib/audit/audit-subscriber.js
    - fusion-studio-server/lib/thread/HistoryFile.js
  connected-skills: []
  related-trigger-files: []
---

Turn finalization has multiple gates.

```text
assistant output ended
  + live reveal completed
  + SQLite exchange saved
  + exchangeId delivered to client
  = saved-turn UI can become active
```

`turn_end` means the stream is terminal. It does not by itself mean saved-turn
actions are viable.

For `reason: "error"`, the server preserves accumulated assistant/tool output,
clears Working, stores one fixed safe terminal envelope, and publishes one
sequenced `turn_end`. The client immediately flushes queued partial output and
finalizes atomically instead of waiting for typing/tool animation. The visible
order is output, one turn error, then reply chrome. Normal completion retains
the reveal-complete gate; Stop remains interrupted rather than failed.

An error envelope is never a stream segment, assistant part, or tool error.
Invalid client-bound data maps to the fixed generic safe catalog row without
copying unknown fields. A post-terminal `error`/`auth_error` is notification or
acceptance-failure correlation only and cannot create a second row or mutate a
replacement prompt.

## Saved Exchange Ack

Use `chat-turn:saved` to attach `exchangeId`, `seq`, `ts`, `partial`, `reason`,
and `metadata` to the finalized assistant message.

The client should update by `threadId + turnId`, not by array index.

## Composer Behavior

After assistant output ends, or after Stop is clicked, the composer remains in
forced-completion mode until the saved exchange ack arrives. It should not
restore Send before saved-turn UI is viable.
