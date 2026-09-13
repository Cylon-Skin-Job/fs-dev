# SPEC-02 — Chat/Tab/Provenance Integration Contract

**Status:** `CANDIDATE — OWNER APPROVAL REQUIRED`
**Bundle:** `TABS-PROVENANCE-BRIDGE`
**Type:** **contract-only.** This SPEC authorizes no product code; the chat
identity layer it references is entirely unbuilt. Its job is to fix the contract
before chat is written, so chat conforms instead of being retrofitted
(`CHAT-H07`).

**Mission:** Reconcile the planned chat identity tuple with the accepted Tabs
and Provenance interfaces — without collapsing identities — so the future chat
work can attach its actions to the bridge context on the first pass.

## 1. Authorities And Baseline

Read before approval:

- `../../../../../AGENTS.md`;
- bundle `HANDOFF.md`, `DECISIONS.md` (BRG-D02, D05, D08, D10, D11),
  `ROADMAP.md`;
- SPEC-01 (`SPEC-01-COMPONENT-TAB-ACTION-CONTEXT.md`) — the base context;
- `../TABS-PROVENANCE-COORDINATION/INTERFACE-CONTRACT.md` §BRIDGE-02 and
  §Identity ownership, and `CHAT-HANDOFF.md` (CHAT-H01/H02/H03/H06/H07);
- `../../025-Chat_Composition_Roadmap/SPEC-01-THREAD-GROUP-FOUNDATION.md`
  §4/§5.6/§8, `SPEC-02-COMPOSABLE-CHAT-SURFACES.md` §4–§8,
  `SPEC-03-THREAD-WORKSURFACE-CONTINUITY.md` §4;
- `../../022-Vision_Roadmap/THREADS_AND_VIEWS.md` §View-Bound Thread Identity;
- `../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md`.

Baseline fact to record at approval: the chat group/surface layer is **zero
code** — `threadId` is the only implemented chat identity
(`lib/thread/*`, `lib/ws/thread-ws-handlers.js`). No `thread_groups` table, no
`threadGroupId`, no `ChatSurface`/`surfaceId`, no `thread:action`. This SPEC
therefore approves a contract, not an implementation milestone.

## 2. Observable Outcome

The owner approves one `ChatActionContext` contract and one set of identity
rules. The Composable Chat packet (`025`) is updated to consume them and is
independently re-reviewed before CHAT dispatch. No behavior changes in the
running app as a result of this SPEC.

## 3. Scope

### In scope

- the `ChatActionContext` type (SPEC-01 context + chat identity);
- identity ownership and non-collapse rules;
- `surfaceId` derivation and persistence rules;
- omission/degradation behavior;
- the requirement that chat SPECs be overlaid against this contract before
  dispatch;
- the `viewId: null` Legacy semantics for group binding.

### Out of scope (all implementation)

- `thread_groups`/`thread_group_members` schema, backfill, or `thread:action`;
- `ChatSurface`, `ChatMountIdentity`, `fusion.chat-surface`, `surfaceId`;
- group-keyed worksurface `viewStates[viewId].threadWorksurfaces[threadGroupId]`;
- any server command emitting `ChatActionContext`;
- any provenance fact carrying chat identity;
- SPEC-34/SPEC-40 machinery, rendering, or retention.

## 4. Canonical Contract

```ts
type ChatActionContext = ComponentActionContext & {
  threadGroupId: string;
  threadId: string;
  surfaceId: string;
};
```

`ComponentActionContext` is exactly as defined in SPEC-01 §4 (workspace/view
required; tab/component/presenter/target optional). `threadGroupId`, `threadId`,
and `surfaceId` are chat-domain identities, not tab or provenance identities.

`viewId` keeps the base contract's server-validated, non-null view binding. A
group bound to Legacy (`viewId: null`) has no view-bound context and therefore
attaches no `ComponentActionContext`; its chat identities travel in the chat
vocabulary itself (§6 rule 4). No chat identity widens, substitutes, or
reinterprets a SPEC-01 field.

## 5. Identity Ownership And Non-Collapse Rules

| Identity | Owner | Meaning | Must not be treated as |
|---|---|---|---|
| `workspaceId` | workspace/server | workspace boundary | user-supplied authorization |
| `viewId` | view registry | immutable view binding; null = Legacy | folder/title |
| `threadGroupId` | Chat group domain | visible body of work; group-keyed worksurface owner | chat runtime/session ID |
| `threadId` | ThreadManager | transcript, exchanges, harness/runtime, live routing, **Provenance identity** | tab, group, or surface ID |
| `surfaceId` | connected Chat host | one transient mounted Chat UI instance | durable membership, persisted descriptor, or session authority |
| `tabId` / `componentInstanceId` | tab/worksurface adapter | placement identity | thread/group/surface identity |

Rules:

1. **Live routing stays `threadId`.** Adding chat/tab context cannot change
   prompt acceptance, stream routing, Stop, history, or exchange ownership
   (`INTERFACE-CONTRACT.md` §Shared boundaries #3).
2. **Provenance stays `threadId`/`turnId`-keyed.** Grouping, view navigation,
   Main/Side presentation, tab placement, and group deletion never rewrite a
   recorded tool activity's workspace/thread/turn authority
   (`CHAT-RD-009`; SPEC-01 §4). `threadGroupId` is query context only.
3. **`surfaceId` is never durable.** The connected Chat host mints it at mount.
   A component-backed mount derives it from `componentInstanceId` + a runtime
   mount generation (`CHAT-H03`; `025` `SPEC-02-COMPOSABLE-CHAT-SURFACES.md`
   §4/§8). A non-component connected host (`main`/`legacy-main`) mints it from
   that host's runtime mount generation alone and never invents a component
   instance. In every case it is transient, is never persisted, and is never
   sent as session authority.
4. **Close is not delete.** Closing a tab or unmounting a surface never deletes a
   thread, transcript, activity, resource history, snapshot, or group membership
   (`CHAT-H06`; `INTERFACE-CONTRACT.md` #9).
5. **Only durable identities enter persisted tab descriptors.** Transient
   `surfaceId` and runtime mount generation are excluded from any persisted
   component descriptor.
6. **No identity is reconstructed from another's string**, title, folder name,
   panel selection, or current global chat (`CHAT-RD-004`).

The table is the chat-domain projection of `INTERFACE-CONTRACT.md` §Identity
ownership. `componentTypeId`, `presenterId`, and `targetKey` keep their
coordination owners and are consumed through SPEC-01's context; `requestId` and
`projectionId` keep their owners in the chat action vocabulary (`025` SPEC-01
§8.2) and the worksurface/projection contract (`025` SPEC-03 §7/§8) and are
not restated here.

## 6. Attachment Rules

1. When chat emits an action/mutation fact, it attaches the durable portion
   (`workspaceId, viewId, threadGroupId, threadId`, plus any tab/component
   context) exactly as SPEC-01 attaches tab context to mutations.
2. `surfaceId` is transient presentation identity: it may scope a live action
   but must not appear in a durable fact's identity fields; where a fact records
   "where it was mounted," it uses the durable `componentInstanceId` (or omits),
   never `surfaceId` as membership. **Reconciliation:** `INTERFACE-CONTRACT.md`
   §Shared boundaries #2 permits provenance to retain surface identifiers as
   opaque context; this SPEC narrows that permission for chat — `surfaceId` is
   never persisted at all, and durable mount provenance uses the durable
   `componentInstanceId` or is omitted. Recorded here per the coordination
   change rule; the coordination bundle is not edited into authority.
3. Chat facts use the same actor taxonomy (BRG-D05) and the same
   omit-and-continue failure posture; a missing group/surface never blocks
   prompt acceptance or a mutation.
4. **Legacy carries no view-bound context.** A group bound to `viewId: null`
   has no `ComponentActionContext`. Its actions and facts carry `workspaceId`,
   `threadGroupId`, `threadId` (and `turnId` where applicable) through the chat
   vocabulary itself; they never synthesize a `viewId`, tab, or component
   identity, and the omission never blocks prompt acceptance or a mutation
   (SPEC-01 §4/§6 fail-open; `025` SPEC-01 §9).

## 7. Conformance Requirement For Chat

Approval of this SPEC does **not** authorize chat dispatch. It requires:

- the Composable Chat packet (`025`) to be updated or explicitly overlaid
  against this contract, independently reviewed, and owner-approved before
  CHAT-01 dispatch (`INTERFACE-CONTRACT.md` §BRIDGE-02; `CHAT-H01`);
- chat action envelopes, component registration, group projection, and
  worksurface fan-out to conform to `ChatActionContext` on the first pass, with
  no compatibility adapter afterward (`CHAT-H07`);
- the `025` dependency headers to cite **approved BRIDGE-01 and BRIDGE-02** plus
  the owner-released tab platform.

## 8. Dependency-Ordered Slices

None. This SPEC is contract-only; it has no product slices. Its approval gate
is dependency item 2 in `roadmap.json`; code lands with the chat work
(sequencing item 3). Any attempt to implement chat identity under this SPEC is
out of contract.

## 9. Required Verification

- A consistent, unambiguous contract: identity table, non-collapse rules,
  attachment rules, and SPEC-01 base context agree with `025` SPEC-01/02/03 and
  the coordination interface contract, with every divergence reconciled here.
- A fresh read-only clean-room review of this SPEC plus SPEC-01 and the bundle
  returns clean.
- Confirm no `025` packet claims this contract is implemented; confirm the
  overlay requirement is explicit.
- A recorded conformance validation against `INTERFACE-CONTRACT.md`
  §BRIDGE-02/§Identity ownership, the `025` SPEC-01/02/03 identity surfaces, and
  `CHAT-H01`–`CHAT-H07`, with every divergence and disposition recorded in
  `BRIDGE-02-CONFORMANCE-REPORT.md`; the `025` conformance overlay artifact is
  `../../025-Chat_Composition_Roadmap/BRIDGE-02-CONFORMANCE-OVERLAY.md`.

No build/test gates apply (no code). The parent bundle's SPEC-01 owns all
runtime gates.

## 10. Expected Changed Areas

Documentation only:

- this SPEC and the bundle `ROADMAP.md`/`roadmap.json`;
- the future `025` conformance update (owned by the chat roadmap, before its
  dispatch);
- no product file.

## 11. Definition Of Done

SPEC-02 is complete when the owner approves this exact contract, the `025` chat
packet is updated to consume it (or has an explicit, owner-approved overlay), a
fresh clean-room review is clean on the current bytes, and the bundle roadmap
records BRIDGE-02 as approved. No implementation follows from this SPEC by
itself. The conformance evidence is `BRIDGE-02-CONFORMANCE-REPORT.md`; the `025`
overlay artifact is
`../../025-Chat_Composition_Roadmap/BRIDGE-02-CONFORMANCE-OVERLAY.md`.
