# Tabs Lane Handoff

**Writer:** Tabs worker  
**Status:** Universal header correction owner-accepted; TABS-03 remains gated by its exact review record and owner approval

## Lane ownership

Tabs owns the generic component container, tab collection and identity, empty reservation/fill lifecycle, shell presentation, typed placement, presenter/target matching, and later view-by-view tab adoption. It does not own chat sessions/groups, provenance facts/snapshots, permission grants, or dynamic registration authority.

## Current exported contract

- [Universal View Tab Bar](../UNIVERSAL_VIEW_TAB_BAR_SPEC.md) is the accepted rail foundation.
- [Generic Component Tab Host](../GENERIC_COMPONENT_TAB_HOST_SPEC.md) is owner-accepted in the working tree and defines `tabId`, `componentTypeId`, `componentInstanceId`, bounded JSON input, optional `targetKey`, first-party resolution, and guarded empty-to-filled transition. Its evidence is in `../GENERIC_COMPONENT_TAB_HOST_ORCHESTRATOR_REPORT.md`; commit identity remains pending.
- [Tab Shell Presentation Foundation](../TAB_SHELL_PRESENTATION_FOUNDATION_SPEC.md) is owner-accepted in the working tree. It keeps Empty as lifecycle state, makes Home/Content explicit presentation roles, derives centered Home without production adoption, and records its evidence in `../TAB_SHELL_PRESENTATION_FOUNDATION_ORCHESTRATOR_REPORT.md`.
- [Universal Tab Header and Location Rail](../UNIVERSAL_TAB_HEADER_AND_LOCATION_RAIL_SPEC.md) is owner-accepted in the working tree after implementation, final clean review, and independent owner-side verification. It preserves TABS-02 as the accepted historical baseline while superseding downstream use of its Home/Content role split: one tab always uses centered descriptor identity, every active tab uses a breadcrumb location rail, and optional history remains presenter-owned. Commit identity remains pending.
- [TABS-03 Tab Target Placement](../../026-Tab-Target-Placement/TAB_TARGET_PLACEMENT_SPEC.md) is the next-package candidate; its exact review and approval state is recorded in its release manifest. It owns exact presenter/target dedupe, non-destructive current/new placement, and the validated controller chokepoint required by BRIDGE-01; it adopts no production view.
- `tabId`, `componentInstanceId`, and future chat `surfaceId` are distinct.
- Short labels and breadcrumb segments are display projections, never presenter or target identity.
- The generic host adds no global tab store, persistence owner, backend route, plugin discovery, dynamic import, or production view adoption.
- Unknown/unavailable components remain inert, visible, closable, and recoverable.

## Required incoming contracts

- From Provenance: a future narrow action-context/admission surface, not ambient publisher or database access.
- From Chat: explicit group/session/surface identity and one first-party `ChatSurface` registration.
- From each view: presenter, stable resource target, initial loaded-versus-Empty policy, location projection, launchers, preview behavior, and persistence adapter.

## Seeded findings

| ID | Finding | Classification | Affected package | Evidence |
|---|---|---|---|---|
| TABS-H01 | The Generic Host deliberately models `empty|component`; accepted TABS-02 now supplies the Home/Content/Empty shell presentation without changing that lifecycle union. | `dependency_update` | TABS-02 | Generic Host sections 1, 3, 10, and 11; accepted Tab Shell Presentation report |
| TABS-H02 | Accepted TABS-02 formalizes centered Home becoming a rail tab while retaining the same tab, component, and presenter identities. | `owner_ruling` | TPC-O02 | TPC-D02, TPC-D10, and accepted Tab Shell Presentation report |
| TABS-H03 | Generic Host allows first-party registrations only and cannot satisfy declarative plugin/view conversion. | `dependency_update` | PROV-02, VIEW-* | Generic Host B14 and downstream contracts |
| TABS-H04 | Side Chat placement must append/focus a committed component descriptor directly; it must not duplicate the empty-tab reservation state machine. | `no_cross_lane_change` | CHAT-02 | Move Chat B19 |
| TABS-H05 | BRIDGE-01 cannot depend on Generic Host alone because TABS-01 has no presenter-target action/controller chokepoint. Tab Target Placement must export that boundary first. | `dependency_update` | TABS-03, BRIDGE-01 | Provenance required incoming contract; Shared Interface Contract planned context |
| TABS-H06 | RC accepted the Generic Host implementation on 2026-09-03; no commit or push has yet converted the working-tree result into an immutable dispatch baseline. | `dependency_update` | TABS-02 | Generic Host orchestrator report and owner acceptance |
| TABS-H07 | RC accepted the Tab Shell Presentation implementation on 2026-09-04; both accepted tab foundations remain uncommitted, so TABS-03 must consume their eventual exact commit rather than HEAD alone. | `dependency_update` | TABS-03 | Tab Shell Presentation orchestrator report and owner acceptance |
| TABS-H08 | RC replaced the role-specific shell model with a universal two-row model before production adoption: tab count controls centered versus rail identity, while every active tab supplies a display-only breadcrumb. | `owner_ruling` | TABS-02A, TABS-03 | Universal Tab Header and Location Rail SPEC; Vision Roadmap D-173 |
| TABS-H09 | TABS-03 must wait for the corrective presentation contract and must match only explicit `presenterId + targetKey`; short labels, breadcrumbs, and Wiki index-document omission are display policy. | `dependency_update` | TABS-03, BRIDGE-01 | TABS-02A sections 3.4 and 11.1 |
| TABS-H10 | RC accepted the TABS-02A implementation and its final clean review on 2026-09-04; the exact reviewed aggregate remains the uncommitted implementation identity. | `dependency_update` | TABS-03 | Universal Header orchestrator report status and final aggregate |
| TABS-H11 | TABS-03 is a generic renderer-only controller and public-host test candidate; its release manifest owns the exact review and approval gates. First production adopter and provenance wrapping remain separate SPECs. | `dependency_update` | TABS-03, BRIDGE-01, VIEW-* | TABS-03 bundle under `Captures/026-Tab-Target-Placement/` |

## Worker update template

| ID | Date | Current revision/report | Export or discovery | Cross-lane need | Blocking? | Evidence path |
|---|---|---|---|---|---|---|
