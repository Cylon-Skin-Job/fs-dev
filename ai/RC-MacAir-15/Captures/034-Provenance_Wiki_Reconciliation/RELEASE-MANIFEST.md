---
name: PW-01 Release Manifest
description: Reviewed-byte identity and owner approval gate for the documentation-only reconciliation.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Release manifest

Candidate: `PW01-f24d5cd427b9ca14`

Status: **OWNER APPROVED — DOCUMENTATION EXECUTION AUTHORIZED**.

One SPEC: PW-01. Slice order: S00 → S01 → S02 → S03 → S04 → S05 → S06. The owner authorized execution of this candidate in the follow-up request to start a new SPEC orchestrator session and monitor it hourly. This approval applies to documentation only. Any normative change regenerates this candidate and receives affected review; hashes identify bytes, not permission or a reason to discard owner edits.

## Normative artifact identity

Artifact paths are relative to this folder. Hash each file with SHA-256; sort by path; serialize each as path, one TAB, lowercase digest, one LF, UTF-8; hash the concatenation. Candidate ID is `PW01-` plus the first 16 aggregate hex characters. Full aggregate: `f24d5cd427b9ca14558ac488bef173316a24b5c33a0a44ecfb3a68293c123fd5`.

| Artifact | SHA-256 |
|---|---|
| BASELINE.json | `d6e8470175d561fcc8cf7a4b320413b619418f24ed645ef3535771a724610704` |
| BASELINE.md | `30768971b95fa7856e3ca20ba36e01a581e5b7ff1577bfe10f3c5a4e3c34c71d` |
| DECISIONS.md | `ea82ab968a616281085eb10965b25273cf26b1362f4cd88e84046744fba3f39f` |
| INDEX.md | `585fb7904695864f660a6f0fdd27a7484f64a2e10ddf15af62df45015712df02` |
| ISSUES.md | `e3024513cdc7738a150c335eb6d88384463a648f794ab6c3616f0132a22da4ca` |
| PAGE-MAP.json | `6b74b67e62e62066c2dd56616029e9739c8f2123f8d10548b4a89ea8eb13c49b` |
| SLICES.md | `9cac0024dc3131629ccab341210e209562003a961cd012dea85ddbdb58e4b775` |
| SPEC.md | `93fc7f36293094fc82ce9ee133ed272fda09be964004130c28c21d5736467d7d` |
| VALIDATION.md | `17cf6c1d803c595eaf864ad4244a9c72688cf1c9b5e90a0a7e22d47bc90a82d1` |

Machine-readable duplicate: [CANDIDATE.json](CANDIDATE.json). This manifest, CANDIDATE.json and REVIEW.md are receipts, excluded from their own normative hash. Execution artifacts do not yet exist. Source/wiki inputs are recorded by baseline; hashes are evidence only and execution rechecks current bytes.

## Approval and completion boundaries

Recorded owner decisions: PW-D01–09. Non-blocking product deferrals: PW-O01–05, with owners/triggers in DECISIONS.md. No indispensable product choice is needed to document these distinctions truthfully.

Planning review: **CLEAN**, pass 1, `/root/plan_review_01`, on this exact candidate; see REVIEW.md. A clean planning review certifies the plan, not the unrepaired wiki or feature completion. Required execution evidence: all slices accepted through separate builder and orchestrator gates; AC01–10; V1–V6; per-page/claim evidence; snapshots; classified deviations; current-byte final integration review; cross-owner dependency handoff; REPORT.md and explicit owner acceptance before a following SPEC.

Scope is documentation only. Direct handoff: `$orchestrator` with [SPEC.md](SPEC.md). Supervisor handoff: `$roadmap-implementation-supervisor` with [INDEX.md](INDEX.md) as a one-SPEC roadmap. Do not dispatch either until the owner explicitly approves the reviewed candidate.
