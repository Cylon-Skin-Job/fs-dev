# System View Relocation and Configured Tabs Bundle

**Status:** `CANDIDATE — NOT IMPLEMENTATION AUTHORITY`  
**Prepared:** 2026-09-07  
**Release lane:** View Platform  
**Owner approval:** Required for the exact candidate in `RELEASE-MANIFEST.md`

## Purpose

This bundle closes the remaining view-platform work before the Tabs↔Provenance
bridge and Composable Chat:

1. **VIEW-01** moves complete view capsules from `ai/<machine>/Views/` to the
   protected, canonical `ai/<machine>/System/Views/` control plane; then
2. **VIEW-02** lets a relocated view capsule declare its initial tab, Empty-tab
   choices, plus-button availability, and display-only location policy, and
   adopts the accepted generic tab platform in Capture and File Explorer.

The two SPECs are separate because the first is a server/filesystem/security
migration and the second is a renderer/configuration/visual integration. They
are reviewed together as one release gate but implemented and accepted in
dependency order.

## Normative artifacts

| Artifact | Purpose |
|---|---|
| `SPEC-01-SYSTEM-VIEW-RELOCATION.md` | Canonical path, protected route boundary, journaled cutover, recovery |
| `SPEC-02-VIEW-CONFIGURED-TAB-ADOPTION.md` | Versioned tab policy, safe launcher catalog, Capture/File adoption, visual acceptance |
| `DECISIONS.md` | Reconciled product and implementation decisions |
| `ISSUES.md` | Blocking issues, explicit deferrals, and downstream handoffs |
| `CODE-INVENTORY.md` | Active owners, consumers, tests, and expected overlap |
| `GUIDANCE.md` | Mandatory orchestrator lifecycle, sequencing, and reporting rules |
| `RELEASE-MANIFEST.md` | Exact candidate identity, dependency order, approval gate |
| `CLEAN-ROOM-REVIEW.md` | Independent review ledger and final verdict |

## Authority

Authority is ordered as follows:

1. explicit owner direction through 2026-09-07;
2. repository `AGENTS.md` and routed code standards;
3. active decisions in `../022-Vision_Roadmap/DECISIONS.md`;
4. accepted implementation reports and their exact integrated contracts;
5. active code, which constrains integration but does not override owner intent;
6. this candidate bundle, only after owner approval of its exact candidate ID.

The earlier
`../002-SPECs/SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md` remains requirements
provenance. On approval of this bundle it is superseded as implementation
authority because it carries stale sequencing and expands the public view
mutation protocol beyond what the whole-tree cutover needs.

## Applicable code standards

Router:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`

Routed pages:

- `001-Architecture_Routing/PAGE.md`
- `002-Frontend_UI/PAGE.md`
- `003-State_Management/PAGE.md`
- `004-WebSocket_Protocol/PAGE.md`
- `005-Universal_Event_Bus/PAGE.md`
- `007-Persistence_And_Metadata/PAGE.md`
- `008-Testing_And_Smoke_Slices/PAGE.md`

No standard is superseded. VIEW-01 touches persistence, filesystem routing,
trusted WebSocket admission, and workspace readiness. VIEW-02 is renderer and
file-backed configuration work; it does not add a durable event family.

## Dependency map

```text
Accepted generic tab host + accepted universal tab chrome + accepted TABS-03
                                      |
Accepted trusted Fusion shell --------+
                                      v
                    VIEW-01 System View Relocation
                                      |
                                      v
                    VIEW-02 View-Configured Tab Adoption
                                      |
                         owner visual acceptance
                                      |
                                      v
                   BRIDGE-01 / BRIDGE-02, then Chat
```

PROV-01 is accepted and integrated, but neither VIEW SPEC publishes provenance
facts. The bridge consumes the accepted view/tab results later.

## Release boundary

This bundle does not implement Side Chat, Chat extraction, thread groups,
collections, prompts, plug-ins, dynamic component code, arbitrary view
composition, or Provenance bridge events. It provides the stable view location
and first real tab adopters those later features require.

