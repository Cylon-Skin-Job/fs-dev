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
    - fusion-studio-server/lib/thread-groups/service.js
    - fusion-studio-server/lib/thread-groups/repository.js
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
| `workspaceId` | workspace registry | Durable workspace owner; never a path or basename |
| `viewId` | view registry | Immutable view binding; `null` only for Legacy |
| `threadGroupId` | Thread Group domain | Visible Thread/body of work and visible-list MRU owner |
| `threadId` | Fusion Studio | Durable conversation and live stream routing |
| `sideChatPlacementId` | SPEC-04 Move placement owner | Durable Side Chat placement key, distinct from `projectionId`, `surfaceId`, `threadId`, and `threadGroupId` |
| `turnId` | Fusion Studio runtime/client state | In-flight turn correlation before SQLite save is known |
| `exchangeId` | SQLite `exchanges.id` | Saved chat pair id; this is the Chat ID shown in turn chrome |
| `seq` | SQLite per-thread sequence | Stable ordering within a thread |
| Harness session id | Harness adapter/provider | Adapter detail; not user-facing chat identity |

`threadGroupId` and `threadId` are different types even when migration assigns
the same legacy string to both. Live frames, Stop, exchanges, provider state,
and Agent Tool Provenance continue to use `threadId`/`turnId`; they are never
rekeyed to group identity. `sideChatPlacementId` is the Move-specific durable
placement key and is never a `projectionId`, transcript identity, or chat
authority. No identity is reconstructed from another's string, title, folder
name, panel selection, or current global chat.

Move preserves identity: the moved session keeps its `threadId`, transcript,
runtime, model history, usage, and Provenance, and the new Main Chat is a new
`threadId` peer with `origin_kind='move-to-side-chat-primary'`. Closing or
reopening a Side Chat changes only placement, never session identity or group
membership.

## Thread Group Activity And Visible-List MRU

The group owns its `updated_at`, the sole visible-list MRU clock. Permanently,
only two causes advance it: group creation (`initial` activity) and an accepted
user prompt. Each cause inserts one durable activity row and advances
`updated_at` in one transaction:

- `initial:{threadGroupId}` with `kind='initial'`; and
- `prompt:{threadId}:{turnId}` with `kind='prompt-accepted'`.

The activity insert is idempotent on `event_key`, so a retry of the same
thread/turn never advances MRU twice. Open, warm, provider completion, Stop,
Rename, view navigation, and Side Chat close never advance the clock. The
visible population is ordered `updated_at DESC, group_id ASC`, so equal clocks
remain deterministic.

Prompt acceptance records the `prompt-accepted` activity before `message:sent`
or provider dispatch, using the immutable workspace/thread/turn authority
accepted by Provenance. It never re-reads the current panel to retarget the
turn, and a failed activity persist rejects the prompt through the normal
acceptance path (`SPEC-01 §5.4/§7`).

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
