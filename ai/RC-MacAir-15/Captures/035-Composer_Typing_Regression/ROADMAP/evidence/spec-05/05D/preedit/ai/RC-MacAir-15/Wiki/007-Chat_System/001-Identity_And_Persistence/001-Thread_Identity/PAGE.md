---
name: Thread Identity
description: Thread id ownership, routing, workspace scope, and what thread id must not be used for.
metadata:
  last-modified: "2026-09-19T10:34:31Z"
  incoming-edges:
    - Chat Identity And Persistence
  outgoing-edges:
    - Turn Identity
    - Exchange Storage
  source-files:
    - fusion-studio-server/lib/thread/thread-crud.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
    - fusion-studio-server/lib/thread-groups/service.js
    - fusion-studio-server/lib/thread-groups/repository.js
    - fusion-studio-server/lib/thread-groups/move-service.js
    - fusion-studio-server/lib/view-state/thread-worksurface.js
    - fusion-studio-client/src/components/chat/chatSurfaceContract.ts
    - fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx
    - fusion-studio-client/src/lib/ws/threadGroupRows.ts
  connected-skills: []
  related-trigger-files: []
---

A visible Thread is a body of work containing peer chat sessions. The internal Thread Group owns the title, membership, current Main Chat selection, visible ordering, and immutable workspace/view binding. A session owns one conversation; Main Chat and Side Chat describe where that session is presented.

## Identity And Action Ownership

| Identity | Use it for | Do not use it for |
|---|---|---|
| `threadGroupId` | Visible Thread rename/delete, membership and primary selection, group-keyed view continuity | Live prompt, Stop, or stream routing |
| `threadId` | One session's transcript, runtime, draft, acknowledged model selection, prompt/Stop targeting, turns, and provenance | A visible group row or a saved reply ID |
| `surfaceId` | Transient mounted DOM, menu, and focus state | Durable storage, wire routing, or session authority |
| `sideChatPlacementId` | The durable Side Chat tab placement | Session/group identity or a transient mounted instance |
| `exchangeId` | A saved exchange, qualified by its owning `threadId` | A whole conversation or visible Thread |

`threadId` belongs to Fusion Studio, not the harness provider. It remains the live stream routing key and the key for session-specific renderer state. Workspace authority qualifies the session; view context describes its group's binding. Do not derive a session from whichever panel or global chat happens to be selected.

Opening a visible row by `threadGroupId` resolves its current primary session. An exact-session address remains distinct, even if a migrated group and its original session happen to have equal strings. Rename addresses the group's visible title; successful Delete removes the whole group and its member sessions through the server-owned lifecycle. Neither is a tab-close operation.

## View Continuity And Placement

A group's workspace/view binding is immutable. `viewId: null` means the explicit workspace Legacy population, not the active view. A view-bound group's content continuity lives in the owning view capsule's `state/state.json` at the logical key `viewStates[viewId].threadWorksurfaces[threadGroupId]`. Legacy has no view worksurface. Transcripts, drafts, runtime state, and shell thread-list visibility are not content snapshots.

Move keeps the existing session and presents it in a Side Chat content tab, then creates a new empty Main peer in the same group. It does not copy the old transcript, conversation context, or provider resume identity into the new session. Closing that tab records a closed placement disposition; the session, transcript, provenance, and membership remain. Reopening the member addresses that same session. A remount mints a new transient `surfaceId`; the durable `sideChatPlacementId` remains a separate identity.

See [Identity And Persistence](../PAGE.md) for storage ownership and [Runtime Model](../../006-Runtime_Model/PAGE.md) for session lifecycle. If an action is bound to one saved assistant reply, use `exchangeId` and verify its `threadId`, rather than substituting any group, placement, or provider ID.
