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

## Saved Exchange Ack

Use `chat-turn:saved` to attach `exchangeId`, `seq`, `ts`, `partial`, `reason`,
and `metadata` to the finalized assistant message.

The client should update by `threadId + turnId`, not by array index.

## Composer Behavior

After assistant output ends, or after Stop is clicked, the composer remains in
forced-completion mode until the saved exchange ack arrives. It should not
restore Send before saved-turn UI is viable.
