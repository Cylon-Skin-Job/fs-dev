# Tabs↔Provenance Bridge — Owner Decisions

> These records capture explicit owner direction from the 2026-09-12 BRIDGE-01
> design session. They become implementation authority only when the owner
> approves the exact release candidate for the affected SPEC.

## Owner Decisions

### BRG-D01 — Bridge mission: action → provenance

- **Authority:** owner decision, 2026-09-12
- **Status:** settled

Provenance exists so anything that has taken place can be searched and found.
The bridge's core direction is **action → provenance**: record user/system
mutations and attach the tab/view/component context in which they happened.
Agent tool provenance (PROV-01) attaching to surfaces stays **state/query**, not
a bridge build.

### BRG-D02 — BRIDGE-01 extends the UI-action context with `ComponentActionContext`

- **Authority:** owner decision, 2026-09-12
- **Status:** settled

BRIDGE-01 adds the generic tab/component dimension
(`workspaceId, viewId, tabId, componentTypeId, componentInstanceId,
presenterId?, targetKey?`) to the UI-originated action context. The shape is
reconciled from `../TABS-PROVENANCE-COORDINATION/INTERFACE-CONTRACT.md`
(optional `presenterId`/`targetKey` there; final optionality is a SPEC detail).

### BRG-D03 — Granularity: T1+T2 durable, T3 not (resolves TPC-O03)

- **Authority:** owner decision, 2026-09-12
- **Status:** settled — supersedes/answers `TPC-O03` in the coordination bundle

- **T1 — domain mutations** (file save/delete/move, thread/group actions,
  project create, agent tool writes): durable, searchable.
- **T2 — the UI action that caused a mutation**: durable, attached to the T1
  record as context/evidence.
- **T3 — ambient interaction** (click, focus, open-tab, scroll, reorder,
  navigation): not durably recorded.

**Bus and ledger are independent tests.** Anything with potential
trigger/reaction value may transit the UEB firehose (ephemeral, no retention) so
subscribers can react. Only T1, T2, and trigger-run results are retained in the
ledger. Scroll/geometry is neither.

### BRG-D04 — Non-mutating click/trigger telemetry is out of BRIDGE-01 scope

- **Authority:** owner decision, 2026-09-12
- **Status:** settled

A pure click with no mutation is not emitted as canonical provenance. If the
future trigger system needs it, a later article defines a separate bus-only
telemetry type. (Matches the UI Action Provenance Module's own boundary:
"Non-mutating UI telemetry is out of scope unless a later article defines a
separate type.")

### BRG-D05 — Actors adopt the existing taxonomy

- **Authority:** owner decision, 2026-09-12 (grounded in
  `../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md`)
- **Status:** settled

`actor.type` ∈ `human, assistant, trigger, scheduler, script, sync, import,
agent, system, external, unknown` is adopted unchanged. Tab/component identity
lives in `context`, **never** in `actor`. Automation actors are recognized but
deferred: `automation.runId` + `automation.kind` are reserved common fields, and
their generation ABI is owned by open decision `AUT-D03`.

### BRG-D06 — No rendering surface in the bridge

- **Authority:** owner decision, 2026-09-12
- **Status:** settled

BRIDGE-01 builds no provenance display UI. A future table-viewing apparatus
(and the audit-query domain, blocked on `AUD-D01`) owns user visibility into the
database. The bridge is plumbing: attach context, publish facts, make them
queryable.

### BRG-D07 — No pruning in the bridge

- **Authority:** owner decision, 2026-09-12 (consistent with PROV-01 `ATP-D14`)
- **Status:** settled

BRIDGE-01 performs no retention/pruning. The eventual shared tiered-retention
policy (recent-unconditional → latest-per-day → prune; one shared
implementation) owns it. Closing a tab or deleting a group never erases
provenance (`Interface Contract` boundary #9; `CHAT-RD-009`/`CHAT-RD-016`).

### BRG-D08 — Context is an immutable snapshot stored in the database

- **Authority:** owner decision, 2026-09-12
- **Status:** settled

At command time the renderer reads the **live view config** (`state.json` under
`viewStates[viewId]`) and stamps tab/component/presenter/target into the command
envelope. The server writes that context into the provenance fact in
**SQLite**. Nothing re-reads the view config afterward; the tab may be gone and
the fact still reads correctly. The bridge writes nothing back to the view
config — live tab state and historical fact have separate stores and owners.

### BRG-D09 — Blast-radius scoping: reuse the existing carrier, defer the `ui.action` subsystem

- **Authority:** owner decision, 2026-09-12 (after code inventory)
- **Status:** settled

The draft UI Action Provenance Module (SPEC-34) and the canonical
`publishCanonical`/`AcceptedCanonicalRef` API (SPEC-40) are **not implemented**;
they are blocked on owner decisions `UEB-D01`/`RSC-D17`, and the entire
`ui.action`/`uiActionId` renderer envelope is design-only. BRIDGE-01 does **not**
build that subsystem now.

Instead BRIDGE-01 reuses the accepted mediated-save path, which already carries
a schema-supported `reportedUiContext {viewId, viewInstanceId}` on
`resource.mutated@1`/`file.command_accepted@1` — currently plumbed but never
populated. Populate/extend it with tab/component/presenter/target from the
tab-owner layer. The frozen TABS-03 placement types
(`componentTabPlacement*`) are **not** edited; the insertion point is the
owner/host layer (`ConnectedTabOwnerPorts`/`ConnectedTabOwnerRuntime`,
`runIntent`), which already carries `workspaceId`/`viewId`.

### BRG-D10 — Two SPECs, one live and one contract-only

- **Authority:** owner decision, 2026-09-12
- **Status:** settled

- **BRIDGE-01 — Component/Tab Action Context:** implementable now (per BRG-D09).
- **BRIDGE-02 — Chat/Tab/Provenance Integration Contract:** contract-only now;
  the entire chat group/surface layer is zero-code, so there is nothing to
  implement against. Its code lands with the chat work.

### BRG-D11 — Downstream direction and sequence

- **Authority:** owner direction, 2026-09-12
- **Status:** settled (direction only; each step remains owner-gated)

Sequence: **bridge contracts → chat system works → bring chat into the
provenance fold → decompose/modularize/unify views one by one and bring them
into the fold.**

Working model for the view work, captured here for orientation: a view is a
presentation layer over files and folders that can open within a tab or in their
own tab; app-style views are similar but carry database pointers. Unified
document tabs add a render/raw switch. See
`../../022-Vision_Roadmap/THREADS_AND_VIEWS.md`, `../../029-Composable_Views/composable-views-vision.md`,
`../../027-Files_Editing_and_Design_Inheritance/` (D-019, CAP-025), and the parked
successor tab SPEC in `../../028-System-View-Relocation-And-Configured-Tabs/BRIDGE-01-HANDOFF.md` §5.
