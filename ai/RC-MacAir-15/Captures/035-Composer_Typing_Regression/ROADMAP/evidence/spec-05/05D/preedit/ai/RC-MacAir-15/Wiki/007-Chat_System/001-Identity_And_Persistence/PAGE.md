---
name: Chat Identity And Persistence
description: Rules for thread identity, turn identity, exchange storage, and exchange metadata in Fusion Studio chat.
metadata:
  last-modified: "2026-09-19T10:34:31Z"
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Thread Identity
    - Turn Identity
    - Exchange Storage
    - Chat Exchange Metadata
  source-files:
    - fusion-studio-server/lib/thread/ThreadManager.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/thread-groups/member-service.js
    - fusion-studio-server/lib/thread/ChatFile.js
    - fusion-studio-server/lib/thread/HistoryFile.js
    - fusion-studio-server/lib/thread/ThreadIndex.js
    - fusion-studio-server/lib/thread-groups/service.js
    - fusion-studio-server/lib/thread-groups/repository.js
    - fusion-studio-server/lib/db/migrations/001_initial.js
    - fusion-studio-client/src/types/index.ts
    - fusion-studio-server/lib/thread-groups/move-service.js
    - fusion-studio-server/lib/view-state/thread-worksurface.js
    - fusion-studio-client/src/components/chat/chatSurfaceContract.ts
    - fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx
    - fusion-studio-client/src/lib/ws/threadGroupRows.ts
  connected-skills: []
  related-trigger-files: []
---

Use this section whenever a feature needs to identify, copy, persist, hydrate, or mutate a visible Thread, a chat session, or a saved turn.

The visible Thread is the body of work: one title and a set of peer chat sessions with a current Main Chat. Internally it is a Thread Group. Each session has an independent conversation and runtime; presenting one as Main Chat or Side Chat does not change that identity.

## Identity Map

| Identity | Owner | Purpose |
|---|---|---|
| `workspaceId` | workspace registry | Durable workspace owner; never a path or basename |
| `viewId` | view registry | Immutable view binding; `null` only for Legacy |
| `threadGroupId` | Thread Group domain | Visible Thread title, immutable workspace/view binding, membership, primary selection, visible ordering, and group-keyed view continuity |
| `threadId` | Fusion Studio session owners | One transcript, runtime, draft, model selection, prompt/Stop target, turns, provenance, and live route |
| `surfaceId` | Connected renderer host | Transient mounted DOM/menu/focus state; never persisted or used as chat authority |
| `sideChatPlacementId` | Side Chat placement service | Durable Side Chat placement key, distinct from `projectionId`, `surfaceId`, `threadId`, and `threadGroupId` |
| `turnId` | Fusion Studio runtime/client state | In-flight turn correlation before SQLite save is known |
| `exchangeId` | SQLite `exchanges.id` | Saved chat pair id; this is the Chat ID shown in turn chrome |
| `seq` | SQLite per-thread sequence | Stable ordering within a thread |
| Harness session id | Harness adapter/provider | Adapter detail; not user-facing chat identity |

`threadGroupId` and `threadId` are different identities even when migration assigns the same legacy string to both. Live frames, Stop, exchanges, provider state, and Agent Tool Provenance continue to use `threadId`/`turnId`; they are never rekeyed to group identity. `sideChatPlacementId` is a durable placement key, not a transcript identity or chat authority. No identity is reconstructed from another's string, title, folder name, panel selection, or current global chat.

Rename and Delete are group actions. Rename changes the visible title through the group service and the manager's compatibility name/mirror path; it does not give a session a new identity. Successful Delete removes the group and its member sessions through the manager's runtime and persistence checks. Send, Stop, and model selection target an exact member session. A reply-specific mutation needs `exchangeId` and its owning `threadId`.

View content continuity belongs to the owning view capsule's `state/state.json`, logically `viewStates[viewId].threadWorksurfaces[threadGroupId]`; it is not a session transcript or a SQLite copy of the view snapshot. The group remains bound to the same workspace and immutable view identity. `viewId: null` selects the separate Legacy population, never borrows the active view, and owns no view worksurface.

Move preserves the existing session's `threadId`, transcript, runtime identity, model history, usage, and provenance. It creates a new empty Main Chat peer with a new `threadId` and `origin_kind='move-to-side-chat-primary'`, without copying conversation context or provider resume state. Main/Side roles describe presentation of peers in the same group. Closing a Side Chat removes its open tab placement by recording a closed disposition; it does not delete the conversation or group membership. Explicit reopening changes placement, not session identity.

## Thread Group Activity And Visible-List MRU

The group owns `thread_groups.updated_at`, the sole visible-list most-recently-used (MRU) clock. The three implemented causes are group creation, an accepted prompt in any member session, and an accepted Move (`move_chat_to_side`):

| Cause | Durable activity key | Kind |
|---|---|---|
| Group creation | `initial:{threadGroupId}` | `initial` |
| Accepted prompt | `prompt:{threadId}:{turnId}` | `prompt-accepted` |
| Accepted Move | `move:{requestId}` | `move-chat-to-side` |

`ThreadManager.createThread` creates the group with its initial clock and activity in one transaction. Prompt acceptance and Move use `recordActivityAndAdvance` in `fusion-studio-server/lib/thread-groups/repository.js`: a new `event_key` inserts one activity and advances the group clock in the same transaction, monotonically even when two activities occur in one millisecond. An existing key does not advance it again. The visible population sorts by `updated_at DESC, group_id ASC`, so equal clocks remain deterministic.

For example, an accepted Move with request ID `move-1` moves session A to Side Chat, creates empty Main peer B, and advances the group's clock once through `move:move-1`. Retrying the same Move with the same request ID and canonical input replays its stored result; it does not advance the clock again. Closing A's tab and explicitly reopening it through `open_member_in_side` also does not advance the clock. Placement delivery or repair is separate from the accepted Move activity.

Passive open, warming, provider completion, Stop, rename, view navigation, tab close, and member reopen do not advance the visible-list clock. Legacy per-session timestamps such as `threads.updated_at` and `resumed_at` remain session metadata; for example, `ThreadManager.recordSavedExchange` updates the session timestamp after a saved exchange without changing group ordering. A Legacy group (`viewId: null`) still uses the group clock for its visible-list ordering.

Prompt acceptance calls `ThreadGroupService.recordPromptAccepted` from `fusion-studio-server/lib/thread/thread-runtime-controller.js` before `message:sent` or provider dispatch. It resolves the group from the accepted session's immutable workspace/thread/turn authority, never from the current panel; a failed activity persist rejects the prompt through the normal acceptance path. The Move writer is `moveChatToSide` in `fusion-studio-server/lib/thread-groups/move-service.js`; member reopen is owned by `fusion-studio-server/lib/thread-groups/member-service.js` and writes no group activity.

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
