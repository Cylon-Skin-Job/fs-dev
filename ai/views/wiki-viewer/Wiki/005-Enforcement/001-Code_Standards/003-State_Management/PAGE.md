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

Components read store state and call established actions. They do not directly
patch unrelated store slices.

## Forbidden Bypasses

- deriving backend capability from provider-specific client fields
- copying runtime validation rules into UI hooks
- storing the same authoritative fact in two places without a clear source of
  truth
- clearing or hydrating chat state outside existing thread WebSocket handlers
- treating local UI state as proof that a backend mutation succeeded

## Required Checks

- Which store slice owns this frontend state?
- Which backend table or runtime manager owns the durable state?
- Is hydration already handled by a WebSocket message handler?
- Does the action need a backend acknowledgement before UI state changes?
- Can this state be derived instead of stored?

## Related Pages

- [Code Standards(../000-Code_Standards/PAGE.md)
- [Frontend UI Standards](../002-Frontend_UI/PAGE.md)
- [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md)
- [Persistence And Metadata Standards](../007-Persistence_And_Metadata/PAGE.md)
- [Themes And State](../../002-Themes_And_State/PAGE.md)
- [Chat Runtime Model](../../../007-Chat_System/000-Overview_and_References/006-Runtime_Model/PAGE.md)

