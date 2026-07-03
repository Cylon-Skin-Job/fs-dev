---
name: Turn Identity
description: Runtime turn identity before SQLite persistence has produced a saved exchange id.
metadata:
  incoming-edges:
    - Chat Identity And Persistence
  outgoing-edges:
    - Exchange Storage
  source-files:
    - fusion-studio-client/src/state/slices/chatSlice.ts
    - fusion-studio-client/src/lib/ws/turn-lifecycle.ts
    - fusion-studio-server/lib/thread/live-turn-snapshot.js
  connected-skills: []
  related-trigger-files: []
---

`turnId` is an in-flight correlation id. It lets the client and server connect
streaming content, reveal completion, stop/finalization state, and the eventual
saved exchange acknowledgement.

## Rule

`turnId` is not a durable chat id. It is useful before SQLite save completes.
After persistence, saved-turn features should bind to `exchangeId`.

## Save Acknowledgement

When persistence succeeds, the server should send `chat-turn:saved`:

```ts
{
  threadId: string;
  turnId: string;
  exchangeId: number;
  seq: number;
  ts: number;
  partial: boolean;
  reason: "completed" | "interrupted";
  metadata: Record<string, unknown>;
}
```

The client attaches that payload to the just-finalized assistant message by
`threadId + turnId`.
