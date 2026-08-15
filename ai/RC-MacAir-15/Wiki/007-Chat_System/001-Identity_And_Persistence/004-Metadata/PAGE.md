---
name: Chat Exchange Metadata
description: Durable metadata stored on SQLite exchanges and how post-save user metadata must be patched.
metadata:
  incoming-edges:
    - Chat Identity And Persistence
    - Chat User Metadata
  outgoing-edges:
    - Chat User Metadata
  source-files:
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
    - fusion-studio-server/lib/chat-metadata/collectors/attachments.js
    - fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js
    - fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
    - fusion-studio-server/lib/thread/HistoryFile.js
  connected-skills: []
  related-trigger-files: []
---

`exchanges.metadata` stores structured metadata for a saved chat pair.

## Current Turn-End Fields

- `attachments`
- `mentions`
- `fileMutations`
- `contextUsage`
- `tokenUsage`

Turn-end metadata is assembled by focused collectors and the metadata
aggregator. Do not add collector behavior to runtime, canonical appliers,
`HistoryFile`, or UI components.

## Post-Save User Metadata

Bookmarks and notes are user-authored metadata updates after an exchange has
already been saved. They should be handled by a focused post-save exchange
metadata update service, not by turn-end collectors.

Update services must:

- read current metadata
- normalize legacy arrays to objects
- patch only the requested fields
- preserve unrelated metadata keys
- verify `threadId` owns `exchangeId`
- return the full updated metadata object for hydration
