---
name: "Provenance Reconciliation Issue Ledger"
description: "Provenance Reconciliation Issue Ledger for the documentation-only provenance reconciliation."
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Reconciliation issues

Status describes planning disposition, not wiki repair completion. `propagated_pending_review` means the repair contract is present in this SPEC; it does not mean the affected wiki is fixed.

| ID | Finding / authority | Affected surface and required handling | Slice / state |
|---|---|---|---|
| PW-I01 | Older accepted-reference admission presented as current; MVP-D14 and current `subscriptions/admission.js` differ. | Primary overview/model/bus/ledger pages plus UEB standard; document scoped current trusted admission and preserve broader unapproved branches as such. | S02 / propagated_pending_review |
| PW-I02 | Snapshot storage presented as future despite prewrite save protection and post-tool checkpoint stores. | Explain both storage paths, bounded UTF-8 eligibility, hashes, failures and lack of general restore. | S03/S04 / propagated_pending_review |
| PW-I03 | Blanket fail-open prose conflicts with approved preimage requirement (`save-controller.js:485–534`). | Separate operational save safety from optional context and post-execution evidence. | S02/S03 / propagated_pending_review |
| PW-I04 | Proposed `ledger_events`/historical proof graph obscures current `event_log`, `resource_provenance_events`, tool rows/edges/snapshots. | Map actual tables/writers/readers; retain legacy whitelist and heuristic attribution limitations. | S02/S04 / propagated_pending_review |
| PW-I05 | BRIDGE-01 save context exists while general `ui.action` remains deferred. | Trace renderer context → server validation → durable operation/facts → queries; don't claim human causality, universal command coverage, or audit UI. | S03/S05 / propagated_pending_review |
| PW-I06 | Source helper or server response mistaken for a visible feature. | Check query callers, response consumers, projection/refetch and consuming view; record missing UI without implementing it. | S03/S04 / propagated_pending_review |
| PW-I07 | New System-only boundary missing; calendar has active conditional write/read paths in fusion.db. | Record boundary and current gap in existing Server hub and provenance guidance; no migrations or data deletion. | S01 / propagated_pending_review |
| PW-I08 | Drafts, clean reports, and implementation headers represent different evidence/authority. | Explicit overlays for MVP, agent and bridge; never promote every old gate or latest design capture to current policy. | S00/S01/S05 / propagated_pending_review |
| PW-I09 | Capture-linked durable wiki requires reconstruction of specs. | Retain evidence mapping in C, explain contracts directly in wiki, link durable pages. Preserve generated blocks. | All / propagated_pending_review |
| PW-I10 | Chat and view identity dependencies are concurrently owned. | Read current state; record exact boundary and claimed conflict in CROSS-SECTION-DEPENDENCIES.md, never edit protected pages/capture. | S04/S06 / deferred to Chat owner for any external repair |
| PW-I11 | Plugin captures mix authority levels and older gate descriptions. | Read 030/032, expose System/producer boundary and future emission gaps locally; report corrections to plugin owner, do not rewrite their artifacts. | S05/S06 / deferred external propagation |
| PW-I12 | Navigation generator referenced by guidance is missing. | No structure changes; byte-preserve generated blocks and record existing stale navigation separately. | S00/S06 / propagated_pending_review |
| PW-I13 | “System is frozen” could wrongly assert append-only DB or erase current deletion behavior. | Mutable control records and historical purpose are distinct. Explain preservation target and any relevant current deletion limitations without new lifecycle policy. | S01/S04 / propagated_pending_review |

## Materiality and future follow-up

A documented code/intent gap is not a documentation failure when both sides are accurate and its future owner/trigger is explicit. It becomes a release blocker if the wiki presents either side as the other, invents approval, or lacks sufficient evidence to be used safely. Old branch experiments are not executable prerequisites; see BASELINE.md. Future product work remains under PW-O01–05 in DECISIONS.md.
