# Dependency Ledger

**Updated:** 2026-09-04  
**Status vocabulary:** `planned`, `ready`, `implementing`, `owner_review`, `blocked`, `accepted`, `superseded`

## Dependency graph

```text
accepted Universal View Tab Bar
  -> TABS-01 Generic Component Tab Host
       -> TABS-02 Tab Shell Presentation Foundation
            -> TABS-02A Universal Tab Header and Location Rail
                 -> TABS-03 Tab Target Placement

accepted Provenance/UEB baseline
  -> PROV-01 Agent Tool Provenance

TABS-03 + PROV-01
  -> BRIDGE-01 Component/Tab Action Context
       -> BRIDGE-02 Chat/Tab/Provenance Integration Contract
            -> owner-accepted Tab Platform milestone
                 -> CHAT-01 Composable Threaded Chat
                 -> CHAT-02 Move Chat to Side Chat
                 -> CTRL-01 System View Capsule Foundation
                      -> CHAT-03 View-Configured Thread Collections

PROV-01 + later registration/permission authority
  -> PROV-02 Component Registration and Permission Control Plane

TABS-03 + BRIDGE-01 + PROV-02
  -> VIEW-* one-view-at-a-time declarative adoption
```

`CHAT-01` is owner-blocked on both the Tabs and Provenance foundations plus the reconciled bridge contract. Its current implementation-ready document is requirements input, not authorization to dispatch against the pre-bridge shape. It incorporates Pending New Chat after its group commit primitive exists. `CHAT-03` is independent of `CHAT-02`. Full declarative view/plugin conversion remains blocked until the registration, validation, permission, and trust foundation represented by `PROV-02` is specified, approved, implemented, and accepted; `PROV-01` alone does not satisfy that separate gate.

## Current packages

| ID | Package | Lane | Requires | Exports or outcome | Status | Evidence / blocker |
|---|---|---|---|---|---|---|
| TABS-00 | Universal View Tab Bar | Tabs | — | Shell-owned rail, active tabpanel, accepted Capture/File adapters | `accepted` | Commit `9f89aea`; report referenced by the Generic Host SPEC |
| TABS-01 | [Generic Component Tab Host](../GENERIC_COMPONENT_TAB_HOST_SPEC.md) | Tabs | TABS-00 | Serializable component descriptor, first-party resolver seam, empty reservation/fill lifecycle | `accepted` | Owner-accepted, uncommitted implementation and evidence in `../GENERIC_COMPONENT_TAB_HOST_ORCHESTRATOR_REPORT.md` |
| TABS-02 | [Tab Shell Presentation Foundation](../TAB_SHELL_PRESENTATION_FOUNDATION_SPEC.md) | Tabs | TABS-01 | Explicit Home/Content roles, derived centered Home, shell-owned Content location rail, tabbed Empty | `accepted` | Owner-accepted, uncommitted implementation and evidence in `../TAB_SHELL_PRESENTATION_FOUNDATION_ORCHESTRATOR_REPORT.md` |
| TABS-02A | [Universal Tab Header and Location Rail](../UNIVERSAL_TAB_HEADER_AND_LOCATION_RAIL_SPEC.md) | Tabs | TABS-02 | Universal single-tab identity, active breadcrumb rail, optional presenter-owned history controls, role-free shell derivation | `accepted` | Owner-accepted 2026-09-04; exact evidence and aggregate `f91b7cb7eb6263040c39c1931fbeef401c68c98e4157476c32eb6636f2210a35` are in `../UNIVERSAL_TAB_HEADER_AND_LOCATION_RAIL_ORCHESTRATOR_REPORT.md`; implementation remains uncommitted |
| TABS-03 | [Tab Target Placement](../../026-Tab-Target-Placement/TAB_TARGET_PLACEMENT_SPEC.md) | Tabs | TABS-02A | Typed presenter/target request, match-and-recenter, non-destructive current/new placement, validated controller chokepoint | `ready` | Dependency is owner-accepted; the exact review and approval gates are recorded in the candidate release manifest, and orchestration waits for both |
| PROV-00 | MVP Provenance, governed subscriptions, mediated save, File Viewer projection | Provenance | — | Governed UEB/ledger and first live resource projection | `accepted` | Accepted predecessor aggregate `15c18e67df1d9a69ef96fea6819ade662de23b1f41234c824eb2e92351237590` |
| PROV-01 | Agent Tool Provenance | Provenance | PROV-00 | Agent activities, resource edges/checkpoints, timestamps, facts, query surface, File Viewer proof | `accepted` | Owner-accepted 2026-09-04 after final integration review `CLEAN`; report at `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar/ai/RC-MacAir-15/Captures/024-Agent-Tool-Provenance/SPEC-01-IMPLEMENTATION-REPORT.md` |
| CHAT-01 | [Composable Threaded Chat](../COMPOSABLE_THREADED_CHAT_SPEC.md) | Chat | owner-accepted Tab Platform milestone, PROV-01, BRIDGE-01, BRIDGE-02 | Portable `ChatSurface`, view-bound one-member thread groups, first-party chat registration, group-keyed content continuity conforming to the agreed provenance/tab context | `blocked` | Owner has blocked Chat until the tab platform is complete; the exact milestone contents and current SPEC reconciliation must be approved before dispatch |
| CHAT-01A | [Pending New Chat Intent](../PENDING_CHAT_INTENT_SPEC.md) | Chat | CHAT-01 group commit primitive | Signal-gated creation inside Composable Chat Slice 3 | `blocked` | Sub-SPEC; never dispatched as a prerequisite to CHAT-01 |
| CHAT-02 | [Move Chat to Side Chat](../MOVE_CHAT_TO_SIDE_CHAT_SPEC.md) | Chat + Tabs projection | TABS-01, CHAT-01 | Second group member, Side Chat component placement, recovery, legacy Secondary Chat retirement | `blocked` | Waits for independent acceptance of both prerequisites |
| CTRL-01 | [System View Capsule Foundation](../SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md) | View control plane | CHAT-01 | Canonical `System/Views`, registry/path authority, protected mutation routes | `blocked` | Waits for CHAT-01 stable view identity and trusted-shell mutation authority |
| CHAT-03 | [View-Configured Thread Collections](../VIEW_CONFIGURED_THREAD_COLLECTIONS_SPEC.md) | Chat + view configuration | CHAT-01, CTRL-01 | Effective thread presentation config, ranked assignments, Archive, shared menus | `blocked` | Independent of CHAT-02 |
| BRIDGE-01 | Component/Tab Action Context | Coordination bridge | TABS-03, PROV-01 | Opaque tab/component/presenter/resource context on accepted actions and facts | `planned` | Requires the validated placement-controller chokepoint and an accepted Provenance interface; Generic Host alone is insufficient |
| BRIDGE-02 | Chat/Tab/Provenance Integration Contract | Coordination bridge | BRIDGE-01 plus current Chat requirements | Required group/session/surface context and action/projection rules without changing chat routing or tab authority | `planned` | Must be approved before CHAT-01 dispatch and preserve `threadGroupId`, `threadId`, and `surfaceId` separation |
| PROV-02 | Component Registration and Permission Control Plane | Provenance/control plane | PROV-01 plus accepted registry design | DB-authoritative registrations, schema references, requested/effective permissions, consent and revocation | `planned` | Not delivered by PROV-01; owner planning required |
| VIEW-WIKI | Wiki tab-native adoption | View adoption | TABS-03, BRIDGE-01, PROV-02 or an explicitly approved first-party-only exception | Wiki presenter targets, link placement, breadcrumb policy, live resource refresh | `planned` | First-adopter order and inclusion in the pre-Chat milestone remain owner decisions |
| VIEW-FILE | File Explorer tab-native adoption | View adoption | TABS-03, BRIDGE-01, applicable Provenance/control-plane projection | Empty-first launch, file presenter targets, live File Viewer updates | `planned` | Preserve current File Viewer behavior until its own SPEC |
| VIEW-CAPTURE | Capture tab-native adoption | View adoption | TABS-03, BRIDGE-01, PROV-02 | Landing-to-multiple transition and preview-to-addressed-target placement | `planned` | One-view SPEC required |
| VIEW-OFFICE | Office/Email tab-native adoption | View adoption | placement contract, BRIDGE-01, save/edit provenance policy | Addressed document/message tabs with dirty-buffer-safe refresh | `planned` | Must not overwrite dirty buffers |

## Dependency rules

1. A package may be planned against an unaccepted predecessor, but implementation waits for the predecessor's exact accepted report.
2. A worker cannot clear its own external dependency. It records exported evidence; the coordination owner updates this ledger.
3. Discovery does not widen the active package. Cross-lane needs become bridge work or an owning-lane follow-up.
4. Different views migrate in separate SPECs unless an approved roadmap demonstrates identical ownership, behavior, and proof.
5. Accepted foundation behavior is consumed through its public contract; later workers do not recreate it locally.
