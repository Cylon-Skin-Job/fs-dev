---
name: State Management Standards
description: Rules for store ownership, backend state authority, hydration, and avoiding duplicated state checks.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Frontend UI Standards
    - WebSocket Protocol Standards
    - Persistence And Metadata Standards
  source-files:
    - fusion-studio-client/src/state/
    - fusion-studio-client/src/lib/ws/
  connected-skills: []
  related-trigger-files: []
---

Use this page before adding or changing client stores, hydration logic, runtime
state, or frontend state-derived disabled behavior.

## Rule

State has one owner. Other layers may read it or request changes through the
owner, but they do not recreate ownership locally.

## Ownership

Backend owns durable thread state, persistence, runtime readiness, harness
selection, and capability errors.

Client stores own render state, selected thread IDs, active panels, local
attachments, and hydrated message snapshots.

Connected host components read store state and call established actions. They
do not directly patch unrelated store slices. Portable presentation components
receive that state and behavior through props/callbacks and do not import the
store.

Per-view UI state lives in `viewStates[view]` and persists through the view
state WebSocket path. Use the shared helpers for view-local facts:

- `viewActivity.ts` for recents, navigation, and tabs.
- `viewCollections.ts` for starred files and pinned folders.
- `useFileTileMenu.ts` for shared file-tile menu behavior across Capture and
  Office.

Content worksurfaces that vary by visible thread remain view-local state. Store
them in the owning view capsule, for example:

```ts
viewStates[viewId].threadWorksurfaces[threadGroupId]
```

The value may contain versioned tabs, locations, selections, and scroll state.
It must not contain transcripts, harness runtime, chat drafts, thread-list
visibility, or other shell chrome. SQLite may own thread-group structure and
membership, but it must not become a second owner for this view-local snapshot.

Fusion-owned view-state persistence uses the narrow view-state service even
when capsules live under the protected System tree. That authority must not be
re-exported as a generic agent/harness file-write capability.

Keep chat identities separate: `threadGroupId` selects the visible body of
work; `threadId` routes one chat session; `surfaceId` scopes transient mounted
UI. Session-owned render/runtime state is keyed by `threadId`, not by the
currently selected group or panel.

Do not create a second state owner for Recent, Starred, Archive, Pinned, or
open-tab behavior inside an individual view component.

## Forbidden Bypasses

- deriving backend capability from provider-specific client fields
- copying runtime validation rules into UI hooks
- storing the same authoritative fact in two places without a clear source of
  truth
- clearing or hydrating chat state outside existing thread WebSocket handlers
- treating local UI state as proof that a backend mutation succeeded
- storing recents or starred files in SQLite when the fact is view-local UI
  state
- storing a group-keyed content worksurface in SQLite when the owning view
  already persists it in `state/state.json`
- duplicating Capture and Office file menu logic instead of using the shared
  tile menu/controller

## Required Checks

- Which store slice owns this frontend state?
- Which backend table or runtime manager owns the durable state?
- Is hydration already handled by a WebSocket message handler?
- Does the action need a backend acknowledgement before UI state changes?
- Can this state be derived instead of stored?
- If this is view-local, should it be activity or collections under
  `state/state.json`?
- If it varies by visible thread, is it keyed under
  `viewStates[viewId].threadWorksurfaces[threadGroupId]`?

## Related Pages

- [Code Standards](../000-Code_Standards/PAGE.md)
- [Frontend UI Standards](../002-Frontend_UI/PAGE.md)
- [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md)
- [Persistence And Metadata Standards](../007-Persistence_And_Metadata/PAGE.md)
- [Themes And State](../../002-Themes_And_State/PAGE.md)
- [View Activity And Collections](../../../001-Workspaces_And_Views/013-View_Activity_And_Collections/PAGE.md)
- [Chat Runtime Model](../../../007-Chat_System/006-Runtime_Model/PAGE.md)
