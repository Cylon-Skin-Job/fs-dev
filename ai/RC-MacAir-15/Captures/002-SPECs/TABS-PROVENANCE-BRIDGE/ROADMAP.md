# Tabs↔Provenance Bridge — Roadmap

**Status:** `CANDIDATE — SPECS AUTHORED, OWNER APPROVAL PENDING` · **Prepared:** 2026-09-12
**Bundle owner:** owner (RC) · **Next action:** owner review of the BRIDGE-01 candidate, then orchestrator dispatch

This bundle reconciles the planned cross-lane contracts in
`../TABS-PROVENANCE-COORDINATION/` into executables, using the owner decisions in
`DECISIONS.md`. One SPEC at a time; no implementation until the owner approves
the exact SPEC.

## Ordered work

### 1. BRIDGE-01 — Component/Tab Action Context  *(implementable now)*

- **Objective:** attach validated tab/component/presenter/target context to
  UI-originated mutation provenance, reusing the accepted mediated-save carrier
  (`reportedUiContext`) and the accepted governed-fact path.
- **Scope:** renderer context adapter reading live view config; populate/extend
  `reportedUiContext` on mutation commands (save first); server validation +
  persistence of context on the resource fact; schema extension of
  `resource-mutated-v1` / `file-command-accepted-v1`.
- **Explicitly out:** building the SPEC-34 `ui.action`/`uiActionId` subsystem;
  the SPEC-40 canonical API; any provenance rendering UI; retention/pruning;
  non-mutating telemetry; edits to frozen TABS-03 placement types.
- **Prerequisites:** accepted TABS-03 placement chokepoint (client); accepted
  PROV-01 platform (migrations 035/036); accepted mediated-save path.
- **Slices:** defined in SPEC-01 §9 — 01A context adapter + save-path carrier;
  01B server validation/schema/persistence; 01C integration proof and report.
- **Acceptance:** context appears on the durable resource fact for a real user
  save and survives tab close; no second writer to view config; existing
  mediated-save/provenance regressions green; client build + server suite.

### 2. BRIDGE-02 — Chat/Tab/Provenance Integration Contract  *(contract-only now)*

- **Objective:** approve the `ChatActionContext = ComponentActionContext +
  {threadGroupId, threadId, surfaceId}` contract and the non-collapse rules so
  chat can be written to conform (CHAT-H07) instead of retrofitted.
- **Scope:** contract + identity-ownership rules only; no chat implementation.
- **Locks in:** `threadId` remains live-routing/Provenance identity;
  `threadGroupId` owns visible-thread/worksurface; `surfaceId` is transient,
  derived from `componentInstanceId` + mount generation, never persisted or
  treated as session authority; closing a tab/unmounting never deletes chat.
- **Prerequisite:** approved BRIDGE-01.
- **Code lands with:** the chat work (sequencing item 3).

### 3. Chat into the provenance fold  *(owner-gated)*

- Execute the `025-Chat_Composition_Roadmap` packet (SPEC-01→02→03→04), conformed
  to the approved bridge. Chat SPECs must be re-reviewed/overlaid against the
  bridge before dispatch (`CHAT-H01`, `INTERFACE-CONTRACT.md` §BRIDGE-02).

### 4. Views into the provenance fold  *(owner-gated)*

- Decompose/modularize/unify views one by one; unified document tabs with a
  render/raw switch; views as presentation layers over files/folders; app-style
  views with database pointers. Reuses the bridge context machinery.

## Dependency map

```text
accepted TABS-03 (placement chokepoint, client)
accepted PROV-01 (mediated save + facts + ledger)
                       |
                       v
                BRIDGE-01 SPEC  (implementable)
                       |
                       v
                BRIDGE-02 contract  (approval gate)
                       |
                       v
        Chat packet execution -> chat joins provenance
                       |
                       v
        View decomposition/unification -> views join provenance
```

## Release boundary

No SPEC in this bundle starts implementation before explicit owner approval of
its exact candidate. BRIDGE-02 authorizes no chat code. Chat and view tracks
remain owner-gated after the bridge.
