---
name: "Provenance Wiki Reconciliation Bundle"
description: "Provenance Wiki Reconciliation Bundle for the documentation-only provenance reconciliation."
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Provenance Wiki Reconciliation

Status: proposed execution bundle; owner approval required after independent planning review. No wiki repair or product implementation is authorized by this preparation status.

## Outcome

A future build starts from durable wiki guidance, can distinguish source-inspected implementation from approved direction and proposals, and asks the owner only about a material unresolved product choice or contradiction. Existing implementation is evidence, not implicit approval. The System database boundary is settled and must not be repeatedly reopened.

## Read order and artifacts

| Artifact | Role / authority |
|---|---|
| [DECISIONS.md](DECISIONS.md) | Recorded owner direction, authority rules, explicit deferrals |
| [BASELINE.md](BASELINE.md), [BASELINE.json](BASELINE.json) | Preparation-time branch and dirty-source evidence; not execution certification |
| [ISSUES.md](ISSUES.md) | Concrete reconciliation work and cross-owner dependencies |
| [SPEC.md](SPEC.md) | One documentation-only SPEC and its execution contract |
| [SLICES.md](SLICES.md) | Seven ordered, bounded slice packets |
| [PAGE-MAP.json](PAGE-MAP.json) | Complete 24-page section inventory plus three supporting pages |
| [VALIDATION.md](VALIDATION.md) | Exact documentation checks and substantive evidence gates |
| [REVIEW.md](REVIEW.md) | Independent planning review receipts; never wiki completion evidence |
| [RELEASE-MANIFEST.md](RELEASE-MANIFEST.md) | Reviewed candidate identity and approval state |

## Roadmap and dependency map

One SPEC: PW-01, documentation reconciliation. Order: S00 evidence → S01 System boundary → S02 governed events/storage → S03 saves/snapshots/rendering → S04 tools/queries → S05 target contracts → S06 integrated guidance. Each slice depends on the preceding accepted slice. This order does not authorize a product roadmap, data migration, or another SPEC.

Inputs: active development source plus accepted Capture 023, Capture 024, and Tabs↔Provenance Bridge contracts; the draft Capture 008 design; recent plugin captures 030/032; current owner direction. Outputs: reconciled Events And Ledger pages, narrowly aligned System/standards guidance, current evidence, and a bounded list of remaining product gaps. Consumers: future feature specification sessions and existing Chat/plugin documentation owners.

## Exact standards routing

Read `AGENTS.md`, `fusion-studio-server/AGENTS.md`, and active wiki guidance `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/{PAGE.md,001-Style_Guide/PAGE.md,002-Creating_Wikis/PAGE.md,003-Updating_Wikis/PAGE.md,004-Audit_Workflow/PAGE.md}`.

Required code-standards router: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Routed pages in that directory: `001-Architecture_Routing/PAGE.md`, `004-WebSocket_Protocol/PAGE.md`, `005-Universal_Event_Bus/PAGE.md`, `006-Harness_Adapters/PAGE.md`, `007-Persistence_And_Metadata/PAGE.md`, `008-Testing_And_Smoke_Slices/PAGE.md`. These constrain the accuracy of architecture descriptions; this SPEC adds no product code. The older accepted-reference doctrine in the UEB standard is itself an explicit reconciliation target, using the scoped supersessions in DECISIONS.md. Read other routed pages if a newly documented claim depends on them; do not silently expand write scope.

## Handoff routes

After approval naming the candidate ID in RELEASE-MANIFEST.md, invoke `$orchestrator` with this folder's SPEC.md. Alternatively invoke `$roadmap-implementation-supervisor` with this INDEX.md and SPEC.md as the approved one-SPEC roadmap. Both use SLICES.md and the same gates. Approval of this plan authorizes documentation execution only. Preparation review and implementation review are separate.
