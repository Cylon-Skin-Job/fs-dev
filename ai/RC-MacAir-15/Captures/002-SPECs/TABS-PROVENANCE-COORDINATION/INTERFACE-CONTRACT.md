# Shared Interface Contract

**Status:** initial coordination baseline; not implementation authority  
**Updated:** 2026-09-04

This file records the intersection of accepted or implementation-ready lane contracts. It becomes normative only when an owning SPEC explicitly adopts a rule and completes its approval process.

## Identity ownership

| Identity | Owner | Meaning | Must not be treated as |
|---|---|---|---|
| `workspaceId` | workspace/server authority | Workspace boundary | User-supplied authorization |
| `viewId` | registered view capsule | Immutable view identity, qualified by workspace | Folder name or mutable display label |
| `threadGroupId` | Chat group domain | User-visible body of work and group-keyed worksurface owner | Chat runtime/session ID |
| `threadId` | Chat session/ThreadManager | Transcript, exchanges, harness/runtime, and live routing | Tab, group, or mounted surface ID |
| `surfaceId` | connected Chat host | One transient mounted Chat UI instance | Durable group membership or tab ID |
| `tabId` | owning worksurface/tab adapter | One container and its rail/tabpanel relationship | Thread, resource, or component identity |
| `componentTypeId` | first-party resolver now; future authorized registry | Component implementation class | Import path or permission grant |
| `componentInstanceId` | owning worksurface/tab adapter | One serialized component occurrence and mount seed | Tab ID or resource identity |
| `presenterId` | owning view/presenter registry | How a target is presented | Inference from path extension |
| `targetKey` / resource identity | owning resource/presenter contract | Stable match key for find-or-open behavior | Component instance or filesystem authority |
| `requestId` | initiating controller/action | One invocation and idempotent retry correlation | Proof that an effect occurred |
| `projectionId` | durable projection owner | One idempotent cross-owner placement/delivery instruction | Tab state snapshot |

## Shared boundaries

1. Tabs are presentation context, not actors, principals, permissions, resources, or causation claims.
2. Provenance may retain tab/component/presenter/group/session/surface identifiers as opaque context after validating them against server-owned or connected-owner state. Their presence does not authorize an action.
3. Chat live routing remains keyed by `threadId`. Adding tab or provenance context cannot change prompt acceptance, stream routing, Stop, history, or exchange ownership.
4. The selected group's content worksurface is stored once under the owning view's `viewStates[viewId].threadWorksurfaces[threadGroupId]`. SQLite may store group/session facts and projection instructions but not a duplicate tab snapshot.
5. `ChatSurface` receives explicit identities and actions. It imports no tab store, provenance service, WebSocket owner, or persistence owner.
6. The generic tab host resolves first-party types through an injected allowlist. It does not scan folders, execute config, publish arbitrary events, or grant permissions.
7. Empty-tab reservation/fill and Side Chat placement are different transitions. Move Chat to Side Chat directly applies a committed descriptor through the owning worksurface projection; it does not use the empty launcher lifecycle.
8. A resource mutation, tool activity, thread action, tab placement, and renderer refresh are separate facts with explicit correlation. No layer infers `caused by` from timestamps alone.
9. Closing a tab or unmounting a surface never deletes a thread, transcript, activity, resource history, snapshot, or group membership unless a separately authorized domain action does so.
10. Full dynamic component/view conversion waits for DB-authoritative registration, validation, permissions, consent, and revocation. First-party code registration may proceed only where an approved SPEC explicitly permits it.
11. Tab short labels, view icons, breadcrumb segments, and Back/Forward availability are display and navigation projections. They are not resource identity, target matching, authority, permission, or causal proof. Stable find-or-open behavior uses explicit `presenterId + targetKey` even when display policy omits a terminal filename such as `PAGE.md`.

## Planned join contracts

### BRIDGE-01 — Component/Tab Action Context

The future SPEC begins only after TABS-03 exports the accepted target-placement
controller chokepoint and PROV-01 reports its accepted interface. The Generic
Host alone cannot validate presenter and target context for an action. The
bridge should define a bounded context projection containing only applicable
identifiers:

```ts
type ComponentActionContext = {
  workspaceId: string;
  viewId: string;
  tabId: string;
  componentTypeId: string;
  componentInstanceId: string;
  presenterId?: string;
  targetKey?: string;
};
```

The server/controller supplies authoritative workspace and view context. The renderer may submit correlation identities only through a trusted, validated action route. The exact public shape, persistence, and omission rules remain for the bridge SPEC.

Single/tabbed layout, short labels, icons, breadcrumbs, and presenter-history
availability are deliberately absent from this context. They are presentation
or navigation projections, not principals, resources, permissions, or causal
proof. A later accepted UI-action policy may classify an initiating placement
action without converting the resulting layout or displayed location into a
resource fact.

### BRIDGE-02 — Chat/Tab/Provenance Integration Contract

Before Composable Chat is dispatched, this contract must reconcile the planned Chat identity tuple with accepted Tabs and Provenance interfaces without collapsing it:

```ts
type ChatActionContext = ComponentActionContext & {
  threadGroupId: string;
  threadId: string;
  surfaceId: string;
};
```

`surfaceId` may be derived at mount from `componentInstanceId` plus a runtime generation, as required by Composable Chat. Only durable identities belong in persisted tab descriptors.

The current Chat SPECs are requirements input to this contract. They are not treated as an already-implemented prerequisite. After the bridge is approved, the Composable Chat packet must be updated or explicitly overlaid, independently reviewed, and owner-approved before implementation.

## Change rule

A lane that needs another identity, authority grant, persistence owner, or action field records a handoff finding. It does not add the field to another lane's code or SPEC without reconciliation and affected approval.
