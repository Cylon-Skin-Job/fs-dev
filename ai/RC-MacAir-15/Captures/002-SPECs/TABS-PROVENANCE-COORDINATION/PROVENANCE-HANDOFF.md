# Provenance Lane Handoff

**Writer:** Provenance worker  
**Status:** approved Agent Tool Provenance implementation active outside this worktree

## Lane ownership

Provenance owns normalized observed activities, resource edges and snapshots, timestamps, fact admission, governed UEB publication/subscription, ledger projection, query surfaces, and the future registration/permission trust control plane. It does not own tab layout, component rendering, worksurface placement, thread-group behavior, or view migration.

## Current exported contract

- The accepted predecessor provides governed subscriptions, mediated-save provenance, and File Viewer projection.
- Approved candidate `AGENT-TOOL-PROV-616b34ab8f748fd2` adds agent tool activities, resource checkpoints, distinct lifecycle clocks, progressive query, and OpenCode-to-File-Viewer proof.
- Agent observations are timestamped facts, not claims that a tool caused a file state.
- Full arguments/results remain progressively disclosed through existing exchange records.
- External filesystem watching, UI/manual provenance, scripts/triggers, arbitrary permissions, and dynamic component registration remain out of scope.

## Required incoming contracts

- From Tabs: accepted TABS-03 stable opaque container/component/presenter/target context and one validated placement-controller chokepoint. TABS-01 alone does not export that action boundary.
- From Chat: explicit separation of group, session, and mounted-surface identities.
- From registration planning: DB-authoritative definitions for requested/effective permission, consent, revocation, component/schema identity, and locked/user-modifiable boundaries.

## Seeded findings

| ID | Finding | Classification | Affected package | Evidence |
|---|---|---|---|---|
| PROV-H01 | Agent Tool Provenance does not complete the registration/permission/trust foundation required for declarative view conversion. | `dependency_update` | PROV-02, VIEW-* | Approved candidate scope and deferred ATP-DI10 |
| PROV-H02 | Tab/component/group/surface identifiers can be later query context, but they are not principals, resources, or causal proof. | `contract_update` | BRIDGE-01, BRIDGE-02 | Current observational provenance model |
| PROV-H03 | Layout, focus, and rail changes should not be emitted as file mutation facts. | `contract_update` | BRIDGE-01 | Fact-versus-cause boundary |
| PROV-H04 | Existing approved candidate bytes must not be widened to add Tabs or Chat context during implementation. | `no_cross_lane_change` | PROV-01 | Approved release manifest |

## Worker update template

| ID | Date | Current revision/report | Export or discovery | Cross-lane need | Blocking? | Evidence path |
|---|---|---|---|---|---|---|
