---
name: Thread Identity
description: Thread id ownership, routing, workspace scope, and what thread id must not be used for.
metadata:
  incoming-edges:
    - Chat Identity And Persistence
  outgoing-edges:
    - Turn Identity
    - Exchange Storage
  source-files:
    - fusion-studio-server/lib/thread/thread-crud.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
  connected-skills: []
  related-trigger-files: []
---

`threadId` is the durable conversation id and the live stream routing key.

It belongs to Fusion Studio, not to the harness provider. Workspace and view
context describe where the thread belongs, but live chat messages route by
`threadId`.

## Used For

- Opening and hydrating a conversation.
- Routing live stream events.
- Finding the correct per-thread client state slot.
- Verifying that a saved exchange belongs to the expected thread.

## Not Used For

- Copying Chat ID from reply chrome.
- Mutating a specific saved exchange by itself.
- Replacing SQLite `exchanges.id`.
- Representing provider/harness session identity.

If a UI action is bound to one assistant reply, it needs the saved exchange id
once persistence completes.
