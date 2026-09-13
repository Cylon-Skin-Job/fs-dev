# BRIDGE-02 Conformance Overlay — 025 Chat Composition Packet

**Status:** `NORMATIVE OVERLAY — BINDING ON OWNER APPROVAL OF THE BRIDGE-02 CANDIDATE AND THIS 025 CANDIDATE`
**Bundle:** `025-Chat_Composition_Roadmap`
**Prepared:** 2026-09-13
**Authority:** owner-accepted BRIDGE-01 (`SPEC-01-COMPONENT-TAB-ACTION-CONTEXT.md`, commit `16ccecf`) and the BRIDGE-02 `ChatActionContext` contract (`../002-SPECs/TABS-PROVENANCE-BRIDGE/SPEC-02-CHAT-TAB-PROVENANCE-INTEGRATION.md`; living candidate identity recorded in `../002-SPECs/TABS-PROVENANCE-BRIDGE/RELEASE-MANIFEST.md`).

This overlay is contract/documentation only. It authorizes no product code, no
chat implementation, no thread-group, `ChatSurface`, `surfaceId`, or
`thread:action` work, and it does not by itself unblock CHAT-01 dispatch. It is
the "updated or explicitly overlaid" instrument required before dispatch by
BRIDGE-02 SPEC §7, `INTERFACE-CONTRACT.md` §BRIDGE-02, and `CHAT-H01`/`CHAT-H07`.

## 1. Purpose And Effect

- The `025` packet consumes one `ChatActionContext` contract rather than
  inventing tab/provenance/chat context ad hoc. The contract is owned by
  BRIDGE-02; this overlay states how the packet consumes it and what each
  dispatch must satisfy.
- The overlay becomes binding only when the owner approves the BRIDGE-02
  candidate and the owner approves this overlaid `025` candidate. Until then it
  is a draft conformance instrument and no `025` SPEC may dispatch relying on it.
- Conformance is first-pass: chat action envelopes, component registration,
  group projection, and worksurface fan-out conform when written, with no
  compatibility adapter afterward (`CHAT-H07`).
- No field is added to `ComponentActionContext` or any BRIDGE-01 schema by this
  overlay or by the `025` packet. `ChatActionContext` is the BRIDGE-02
  composition `ComponentActionContext + {threadGroupId, threadId, surfaceId}`.

## 2. Identity Rules The Packet Consumes

| Identity | Owner | Packet rule |
|---|---|---|
| `workspaceId` | workspace/server authority | Server-derived, never accepted as renderer authorization; workspace boundary only. |
| `viewId` | view registry | Immutable view binding; `null` only for Legacy; a Legacy group attaches no view-bound `ComponentActionContext`. |
| `threadGroupId` | Thread Group domain | Visible Thread/body of work and group-keyed worksurface key; never a chat runtime/session, routing, or Provenance identity. |
| `threadId` | ThreadManager | Transcript, exchanges, harness/runtime, live routing, and **Provenance identity**; never replaced by a tab/group/surface/placement ID. |
| `surfaceId` | connected Chat host | One transient mounted UI instance; never persisted, never sent as session authority, never durable membership, never in a descriptor, envelope, result, record, or fan-out. |
| `tabId` / `componentInstanceId` / `componentTypeId` / `presenterId` / `targetKey` | tab/worksurface/presenter owners | Placement/presentation/resource context only; never chat, Provenance, or authority identity. |
| `requestId` | initiating action/controller | Idempotent retry identity carried by chat actions; never proof an effect occurred. |
| `projectionId` | durable projection owner (Provenance) | Idempotent cross-owner placement/delivery instruction; never a tab-state snapshot. |
| `sideChatPlacementId` | SPEC-04 Move placement owner | `Move`-specific durable placement key (`CHAT-RD-012`); distinct from `projectionId`, `surfaceId`, `threadId`, and `threadGroupId`. |

Rules:

1. Live routing, prompt acceptance, Stop, history, exchanges, and tool
   Provenance remain `threadId`/`turnId`-addressed. Grouping, view navigation,
   Main/Side presentation, tab placement, and group deletion never rewrite a
   recorded tool activity's workspace/thread/turn authority (`CHAT-RD-009`).
2. No identity is reconstructed from another's string, title, folder name,
   panel selection, or current global chat (`CHAT-RD-004`).
3. Context is fail-open: a missing/malformed/stale context is omitted or
   degraded and never blocks prompt acceptance or a mutation.
4. `surfaceId` derivation: the connected host mints it at mount. A
   component-backed mount derives it from `componentInstanceId` + a runtime
   mount generation; a non-component host (`main`/`legacy-main`) mints it from
   its own runtime mount generation and never invents a component instance.

## 3. CHAT-H01…H07 Dispositions

| ID | Disposition in this packet |
|---|---|
| CHAT-H01 | Dependency headers now cite owner-accepted BRIDGE-01 and owner-approved BRIDGE-02 through this overlay (§4.1). Dispatch authority is the `025` packet as overlaid; the legacy `../002-SPECs/COMPOSABLE_THREADED_CHAT_SPEC.md` header is requirements provenance only. |
| CHAT-H02 | Placement (`tabId`/`componentInstanceId`) and `host` cannot redefine chat identity; session routing stays `threadId` (§2; SPEC-02 §4). |
| CHAT-H03 | The registration descriptor omits transient `surfaceId`; the resolver mints it from `componentInstanceId` + mount generation (§4.3). |
| CHAT-H04 | Move Chat is SPEC-04 scope; no cross-lane change required here. |
| CHAT-H05 | Collections sequencing is SPEC-03/SPEC-04 scope beyond this overlay's identity conformance. |
| CHAT-H06 | `surfaceId` is never durable membership; closing a tab/unmounting a surface removes placement only and never deletes chat or Provenance (§4.5). |
| CHAT-H07 | Action envelopes, component registration, group projection, and worksurface fan-out conform on the first pass; no compatibility adapter afterward (§4.2–§4.5). |

## 4. Area Conformance Requirements

### 4.1 Dependency headers

Every `025` SPEC header and authority section cites owner-accepted BRIDGE-01
(commit `16ccecf`) and owner-approved BRIDGE-02, consumed through this overlay
without local additions or reinterpretation, plus the owner-released accepted
Tab Platform milestone where applicable. No `025` SPEC dispatch may rely on the
legacy Composable Threaded Chat header for authorization.

### 4.2 Action envelopes

Every durable chat action (`thread:action`; SPEC-01 §8.2, SPEC-04 §4/§8) carries
the available `ChatActionContext` durable portion:

- server-derived `workspaceId`;
- validated `viewId`, or Legacy `null` with no view-bound context;
- `threadGroupId` for group scope and exact `threadId` for member scope;
- tab/component/presenter/target only when a component-backed initiating host
  supplied them.

`surfaceId` never appears in an envelope, persisted action result, idempotency
record, or fan-out. `thread:action:completed|error` echoes
request/action/authoritative identifiers. Missing context never gates the
action; `threadId` remains the routing/Provenance identity.

### 4.3 Component registration

The `fusion.chat-surface` descriptor input carries durable identities only
(workspace, nullable view, group, session, host) and no transient `surfaceId`,
store, socket, callback, path, import, or authority claim. The connected
resolver validates the descriptor/schema and the workspace/view/group/member
tuple, then mints a transient `surfaceId` per §2 rule 4 and never persists it.
Persisted tab descriptors contain durable identities only.

### 4.4 Group projection

`ThreadGroupProjection`, member projections, and search results carry durable
identities only. `threadGroupId` is the visible-row/worksurface key and query
context, never a chat-runtime/session or Provenance identity; no `surfaceId`
appears. Legacy is an explicit `viewId: null` population, never a fallback to
the active panel. Projections never authorize an action.

### 4.5 Worksurface fan-out

Group-keyed worksurface state is addressed by `{workspaceId, viewId,
threadGroupId}` only, with no Legacy entry. Neither the adapter content lane nor
the service-managed placement lane contains `surfaceId`, transcript/runtime
state, or placement-authority claims. State-changed and action fan-out carry
qualified durable identities and lane revisions only. Closing a tab/unmounting a
surface removes placement only and never deletes a thread, transcript, activity,
resource history, snapshot, or group membership. Group deletion follows the
accepted cleanup/retention contracts and never cascades into Provenance.

## 5. Dispatch Gate

CHAT-01 may dispatch only when all hold: SPEC-00 is accepted/integrated
(2026-09-07); the owner-released Tab Platform milestone is recorded; BRIDGE-01 is
owner-accepted; the BRIDGE-02 candidate and this overlaid `025` candidate are
owner-approved; and the overlaid packet has a fresh clean-room review on its
current bytes. `ISSUES.md` records the gate state as `CHAT-I-035`.

## 6. Evidence

- `../002-SPECs/TABS-PROVENANCE-BRIDGE/BRIDGE-02-CONFORMANCE-REPORT.md` —
  BRIDGE-02 validation findings and dispositions.
- `CLEAN-ROOM-REVIEW.md` and `RELEASE-MANIFEST.md` — this candidate's review
  and identity record.
