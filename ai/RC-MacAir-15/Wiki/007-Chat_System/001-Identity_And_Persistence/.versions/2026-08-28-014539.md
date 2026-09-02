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
    - fusion-studio-server/lib/thread/ChatFile.js
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

## Markdown Mirrors

`ChatFile.js` writes repo-local markdown mirrors for audit/export workflows.
These files are not the durable chat database. Future writes belong under
`ai/<machine>/Data/Chatlogs/threads/<threadId>.md`; the top-level machine
folder is the machine/user discriminator, so there is no additional username
folder under `threads/`.

Markdown mirrors are generated from SQLite exchange history. After a completed
exchange is saved, the backend rewrites the primary markdown mirror from
SQLite. Assistant markdown metadata carries `turnId` plus a `chatMirror` block
with `threadId`, `exchangeId`, `seq`, and `turnId`.

<!-- children:start -->
## Children

- [Thread Identity](001-Thread_Identity/PAGE.md) - Thread id ownership, routing, workspace scope, and what thread id must not be used for.
- [Turn Identity](002-Turn_Identity/PAGE.md) - Runtime turn identity before SQLite persistence has produced a saved exchange id.
- [Exchange Storage](003-Exchange_Storage/PAGE.md) - SQLite exchange row rules, Chat ID meaning, sequence, and source-of-truth behavior.
- [Chat Exchange Metadata](004-Metadata/PAGE.md) - Durable metadata stored on SQLite exchanges and how post-save user metadata must be patched.
- [Chat User Metadata](005-User_Metadata/PAGE.md) - User-authored metadata for saved chat exchanges — bookmarks, notes, search/recall, and redaction.
<!-- children:end -->
