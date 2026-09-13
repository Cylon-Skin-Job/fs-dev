# Tabs↔Provenance Bridge Bundle

**Status:** `CANDIDATE — OWNER APPROVAL REQUIRED`
**Prepared:** 2026-09-12
**Release lane:** Bridge (Tabs ↔ Provenance)
**Owner approval:** required for the exact candidate in `RELEASE-MANIFEST.md`

## Purpose

Reconcile the planned cross-lane contracts in
`../TABS-PROVENANCE-COORDINATION/` into executables, using the owner decisions
from the 2026-09-12 design session (`DECISIONS.md`). Two SPECs, dependency-
ordered, one executable now and one contract-only:

1. **BRIDGE-01** (`SPEC-01-COMPONENT-TAB-ACTION-CONTEXT.md`) — attach validated
   tab/component/presenter/target context to UI-originated mediated-save
   provenance, reusing the accepted save path and governed-fact mechanism.
2. **BRIDGE-02** (`SPEC-02-CHAT-TAB-PROVENANCE-INTEGRATION.md`) — approve the
   `ChatActionContext` contract and identity rules so the future chat work
   conforms on the first pass. Contract-only; no code.

Specs are implemented and accepted in dependency order; BRIDGE-02 does not
dispatch until BRIDGE-01 is owner-accepted.

## Normative artifacts

| Artifact | Purpose |
|---|---|
| `BUNDLE-INDEX.md` | This index: purpose, authority, dependency map, boundary |
| `HANDOFF.md` | Self-contained resume entry point for a fresh session |
| `DECISIONS.md` | Owner decisions BRG-D01…D11 and their authority |
| `GUIDANCE.md` | Mandatory builder/orchestrator lifecycle for BRIDGE-01 |
| `ROADMAP.md` | Ordered work and dependency map |
| `roadmap.json` | Machine-readable sequence mirror of `ROADMAP.md` |
| `SPEC-01-COMPONENT-TAB-ACTION-CONTEXT.md` | BRIDGE-01 executable SPEC |
| `SPEC-02-CHAT-TAB-PROVENANCE-INTEGRATION.md` | BRIDGE-02 contract-only SPEC |

`RELEASE-MANIFEST.md` is evidence about the candidate and is excluded from the
candidate identity.

## Authority

Ordered:

1. explicit owner direction through 2026-09-12 (`DECISIONS.md`);
2. repository `AGENTS.md` and routed code standards;
3. accepted PROV-01 and TABS-03 implementation reports and their exact contracts;
4. `../TABS-PROVENANCE-COORDINATION/INTERFACE-CONTRACT.md` (planned baseline);
5. active code, which constrains integration but not intent;
6. this candidate bundle, only after owner approval of its exact candidate ID.

## Applicable code standards

Router: `../../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`.
Routed pages: `001-Architecture_Routing`, `003-State_Management`,
`004-WebSocket_Protocol`, `005-Universal_Event_Bus`,
`007-Persistence_And_Metadata`, `008-Testing_And_Smoke_Slices`.
No standard is superseded. SPEC-01 touches the renderer, WebSocket save path,
event-registry schemas, and persistence. SPEC-02 is documentation only.

## Dependency map

```text
accepted TABS-03 (placement chokepoint, client)
accepted PROV-01 (mediated save + facts + ledger)
                       |
                       v
                BRIDGE-01 (SPEC-01, executable)
                       |
                       v
                BRIDGE-02 (SPEC-02, contract-only)
                       |
                       v
        Chat packet execution -> chat joins provenance
                       |
                       v
        View decomposition/unification -> views join provenance
```

## Release boundary

This bundle does not implement the SPEC-34 `ui.action` subsystem, the SPEC-40
canonical API, provenance rendering, retention policy, non-mutating telemetry,
or chat/view identity. It provides the context-attachment mechanism and the chat
contract that later work consumes. No implementation begins before owner
approval of a SPEC's exact candidate.
