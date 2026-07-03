---
name: Chat Identity And Persistence
description: Rules for thread identity, turn identity, exchange storage, and exchange metadata in Fusion Studio chat.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Thread Identity
    - Turn Identity
    - Exchange Storage
    - Chat Exchange Metadata
  source-files:
    - fusion-studio-server/lib/thread/HistoryFile.js
    - fusion-studio-server/lib/thread/ThreadIndex.js
    - fusion-studio-server/lib/db/migrations/001_initial.js
    - fusion-studio-client/src/types/index.ts
  connected-skills: []
  related-trigger-files: []
---

Use this section whenever a feature needs to identify, copy, persist, hydrate,
or mutate a chat turn.

## Identity Map

| Identity | Owner | Purpose |
|---|---|---|
| `threadId` | Fusion Studio | Durable conversation and live stream routing |
| `turnId` | Fusion Studio runtime/client state | In-flight turn correlation before SQLite save is known |
| `exchangeId` | SQLite `exchanges.id` | Saved chat pair id; this is the Chat ID shown in turn chrome |
| `seq` | SQLite per-thread sequence | Stable ordering within a thread |
| Harness session id | Harness adapter/provider | Adapter detail; not user-facing chat identity |

## Persistence Rule

SQLite is the durable source of truth for completed exchanges. RAM and renderer
state are derived caches that can be rebuilt from SQLite.

Do not use DOM state, array indexes, or thread ids as saved exchange identity.
If a feature needs to mutate saved turn data, it needs `exchangeId` and should
verify the supplied `threadId` owns that exchange.

## Children

- [Thread Identity](001-Thread_Identity/PAGE.md)
- [Turn Identity](002-Turn_Identity/PAGE.md)
- [Exchange Storage](003-Exchange_Storage/PAGE.md)
- [Metadata](004-Metadata/PAGE.md)
- [User Metadata](005-User_Metadata/PAGE.md)
