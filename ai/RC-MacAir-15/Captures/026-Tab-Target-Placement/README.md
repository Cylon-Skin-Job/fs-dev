# TABS-03 Tab Target Placement Bundle

**Status:** `CANDIDATE — NOT IMPLEMENTATION AUTHORITY`  
**Prepared:** 2026-09-04  
**Implementation authority:** None until the owner approves the candidate in
`RELEASE-MANIFEST.md`. The TABS-02A implementation dependency was owner-accepted
on 2026-09-04.

## Purpose

This bundle defines the next Tabs-lane package: one renderer-owned placement
controller for opening a fully resolved presenter/resource target in the
generic component tab host. It gives sidebars, previews, landing surfaces, and
Empty-tab selectors one canonical route without converting any production view.

## Normative artifact index

| Artifact | Purpose | Status | Authority |
|---|---|---|---|
| [TAB_TARGET_PLACEMENT_SPEC.md](./TAB_TARGET_PLACEMENT_SPEC.md) | Executable TABS-03 behavior, slices, failures, and acceptance gates | current candidate | Owner decisions, accepted tab contracts, active-code feasibility |
| [DECISIONS.md](./DECISIONS.md) | Stable decisions and authority classification | current candidate | Reconciled authority; no unresolved product decision |
| [ISSUES.md](./ISSUES.md) | Material issue lifecycle and deferrals | current candidate | Roadmap audit |
| [CODE-INVENTORY.md](./CODE-INVENTORY.md) | Current implementation/test surfaces and constraints | current as of preparation | Active repository inspection |
| [IMPLEMENTATION-GUIDANCE.md](./IMPLEMENTATION-GUIDANCE.md) | Mandatory builder/orchestrator lifecycle and handoff rules | current candidate | Roadmap Creator workflow |
| [RELEASE-MANIFEST.md](./RELEASE-MANIFEST.md) | Ordered hashes, candidate identity, gates, and downstream routes | exact candidate identification and approval gate | Exact candidate bytes |
| [CLEAN-ROOM-REVIEW.md](./CLEAN-ROOM-REVIEW.md) | Independent review findings, repairs, and final verdict | current review evidence | Fresh read-only review |

## Applicable code standards

The repository standards router is:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`

Its applicable routed pages for this renderer-only package are:

- `001-Architecture_Routing/PAGE.md`
- `002-Frontend_UI/PAGE.md`
- `003-State_Management/PAGE.md`
- `008-Testing_And_Smoke_Slices/PAGE.md`

All paths above are relative to the router directory. No standard is superseded
by this package. WebSocket, UEB, and Persistence/SQLite standards are not routed
because this SPEC expressly makes no server, transport, event-bus, database, or
durable-persistence change.

## Dependency map

```text
TABS-00 accepted Universal View Tab Bar
  -> TABS-01 accepted Generic Component Tab Host
    -> TABS-02 accepted Tab Shell Presentation Foundation
      -> TABS-02A accepted Universal Header and Location Rail
        -> TABS-03 Tab Target Placement [this bundle]

TABS-03 accepted + PROV-01 accepted
  -> BRIDGE-01 Component/Tab Action Context
```

The exact TABS-02A implementation is owner-accepted. TABS-03 may be dispatched
only after this exact candidate receives owner approval. Production view
adoption remains separate work.

## Owned and shared contracts

TABS-03 owns the canonical placement request, exact presenter/target matching,
non-destructive current/new disposition, atomic Empty fill or append planning,
activation of an existing target, and the validated controller result boundary.

It shares the accepted generic host's tab/component identities and the corrected
TABS-02A presentation projection. It exports opaque placement context to the
future BRIDGE-01 package but does not publish provenance or UEB events itself.

## Explicit deferrals

- first production adopter and adopter order;
- durable worksurface persistence and restart hydration;
- registration, permission, consent, and revocation control plane;
- UEB publication, provenance facts, actor attribution, and authoritative time;
- presenter-internal navigation history;
- Chat registration or placement;
- resource fetching, saving, filesystem authority, and live file refresh.

These are non-blocking for TABS-03 and retain the future gates recorded in
`ISSUES.md` and the shared coordination ledger.
