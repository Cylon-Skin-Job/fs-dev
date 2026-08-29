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
    - fusion-studio-server/lib/thread/canonical-drain-context.js
    - fusion-studio-server/lib/thread/thread-runtime-manager.js
  connected-skills: []
  related-trigger-files: []
---

`turnId` is an in-flight correlation id. It lets the client and server connect
streaming content, reveal completion, stop/finalization state, and the eventual
saved exchange acknowledgement.

## Rule

`turnId` is not a durable chat id. It is useful before SQLite save completes.
After persistence, saved-turn features should bind to `exchangeId`.

Every accepted harness iterator also has a unique, non-serializable `drainId`.
The server binds the generated `turnId` to that drain once and compare-checks
the pair for mutation, Stop, terminalization, and cleanup. A late callback from
an old drain cannot affect a replacement turn.

On the client, `turn_begin` may initialize only an empty addressed thread slot.
A duplicate begin for the same turn is idempotent; a different active turn is
rejected. Every later in-flight message through `turn_end` must match the
addressed current `threadId + turnId` before any store or helper mutation.

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
  reason: "complete" | "interrupted" | "error";
  metadata: Record<string, unknown>;
}
```

The client attaches that payload to the just-finalized assistant message by
`threadId + turnId`.

This acknowledgement is post-terminal correlation, so it does not require a
live `currentTurn`. Metadata acknowledgements similarly correlate by
`threadId + exchangeId` and cannot mutate live helper or activity state.
