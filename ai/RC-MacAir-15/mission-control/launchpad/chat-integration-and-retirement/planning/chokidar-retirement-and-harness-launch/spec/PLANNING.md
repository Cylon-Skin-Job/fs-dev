# SPEC Candidate Creation — Coordination

## Assignment and intake

- **Planning ID:** CHAT-AR-SPEC-CHOKIDAR-RETIREMENT-001
- **Role:** Roadmap Creation Supervisor
- **Owner authorization:** In the source thread, the owner said “Send to SPEC creation.” This authorizes candidate creation and its planning gates; it does not approve implementation.
- **Manager / final recipient:** owner in this planning session
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`
- **Memory CWD:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`
- **Owned output root:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement/planning/chokidar-retirement-and-harness-launch/spec/`
- **Read-only implementation checkout:** `/Users/rccurtrightjr./projects/fs-dev`
- **Current source branch / HEAD:** `agent/exact-workspace-paths` / `d15792920731f85e45b743519d4af2b807d95a9c`
- **Original source conversation:** “Map Fusion–OpenCode chat failure states,” local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`; built-in `read_thread` verified title/CWD, current authorization (“Send to SPEC creation”), and relevant settled later owner directions. No history cursor advanced.

### Accepted inputs (current fingerprints verified at intake)

- First Draft revision 2: `../FIRST-DRAFT.md`, SHA-256 `98329563e1ac24d1eeaa5753ad9490c10057cf9e9a065e912663ae1f3e907a9c`.
- Revision-2 independent draft validation: `../reports/independent-draft-review-revision-2.md`, SHA-256 `177264f784c3765e3ff05e44fad02737bf42ea8b6b1fcfe5f4abe81280dd9ff4`, `DRAFT_VALIDATED_FOR_DISCUSSION` with no material findings.
- Revision-2 stage report: `../reports/stage-first-draft-revision-2.md`, SHA-256 `db4a1908bfa28162919133769f692c0e35cbf42f97209b9b4fa81bbd3687e728`.
- SPEC-handoff preflight: `../reports/preflight-spec-handoff-revision-2.md`, SHA-256 `de1ddfb43b211c0fd7e976c15fbc3be3c9f5f1791974946a8f43899b75dea337`, `READY_WITH_EXPLICIT_GAPS`.
- Complete scoped document sweep: `../../../.document-sweeps/runs/b294252fbab94747bf3e577244d305a1/report.md`, SHA-256 `03644d972eaec758a9868927c03ee2e6969ea210a7ce98619a330b0f9531a1c7`, no material handoff gaps.
- Owner direction amendment: `../reports/owner-direction-file-changed-ledger.md`, current SHA-256 `b564b62e86d968d56ae39e60f9f51be9e9e9cd5ff341dfcd901557fb5157e9e2`.
- Current parent coordination packet: `../PLANNING.md`, SHA-256 `f3e8a8f92235c2014be3b2baa8fcca1ff2a7c0aee0b96168014a376afde21e89`. Preserve it as source; do not update it from this creation run.
- Plugin Foundation current decisions/references: `../../../../plugin-foundation/DECISIONS.md` D-015/D-016 (SHA-256 `838000a77890343ed480a7bfa7eb76517ce21c027e7f9e94960e1e5ff7ddf182`) and `REFERENCES.md` REF-018/REF-019 (SHA-256 `e8c5ba393f0c3d1f412756d45be83cf5e73798e838f58fd3b9dd6de4aecdfc49`), plus I-016/I-017/I-019 and relevant INTENT/TICKET.

Preflight and sweep concluded that PF-01/02/03 are resolved for this scope and PF-04 is bounded technical candidate work, not a blocker to start. RV2-A01 assigns explicit Wiki/source-map and test/startup-inventory update ownership/timing in the candidate. No owner scope choice remains open.

## Settled outcome and boundaries

Create the smallest useful executable candidate, preferably one bounded SPEC, for: remove Chokidar, its watch registrations and obsolete dependent startup/refresh calls; disable only ledger recording of `file:changed`; then verify normal public chat operation with actual OpenCode child/response/persisted exchange in the later approved implementation. If the real post-removal chat check fails, the implementation must diagnose that concrete failure within scope rather than declare success based on descriptor evidence alone.

Settled behavior to preserve: unrelated listeners and event classes remain; workspace/thread ledger history remains; direct screenshot button, correlated PNG save and pending attachment remain; old macOS screenshot-folder import is retired; existing mediated save preimages/versioning, shadow Git checkpoints and admitted tool-completion observations remain. Apple Calendar's unfinished directory watcher may retire only if no server/renderer wait or race depends on its callback; separately opt-in Google polling and other Calendar functions remain distinct. Chokidar's automatic filesystem observations stop; do not recreate a detector or require replacement readiness. Half-hour/event-triggered snapshots, repo-local SQLite, new UEB/subscription trigger delivery and grants remain future work owned elsewhere, not acceptance dependencies. Together.ai retry/warm-up remains separate and unconfirmed. SPEC-06 and unrelated accepted work remain closed.

No product/test/Wiki/database writes, app/server restart, chat resend/provider request, Alpha operation, Git publish/deploy, central/sibling record write, or checkpoint state operation is allowed in this candidate-creation run. Canonical Wiki is read-only; the SPEC assigns its later updates to implementation. Do not add speculative spawn/transport/failure-UX redesign, descriptor scanning, or a stress program by association.

## Stage and release gates

- Stage 2 orchestrator owns `reports/stage-candidate.md`, assignments, evidence reconciliation and repairs.
- One `mc-roadmap-author` owns the normative candidate file(s) only.
- One fresh `mc-planning-validator` with `mode: candidate-stage` owns a separate stage review.
- The author owns candidate-byte identification and creates the manifest with the prescribed helper as part of the bundle. This supervisor checks it after stage validation. Manifest, stage/release reports and this coordination file remain outside the normative set.
- After a materially clean stage, a distinct fresh `mc-planning-validator` with `mode: release` reviews the complete current candidate and manifest, independently of author/stage reviewers. Repair only through assigned owners and revalidate affected work with fresh review.
- Stop at `CANDIDATE_READY_FOR_OWNER_APPROVAL`. Owner approval is required before any implementation task or product change.

## Current checkpoint

**Owner update, 2026-10-03T23:47:57Z:** The owner assigned the current reviewed candidate to an implementation orchestrator and authorized a completion message to the source conversation. Status is now `APPROVED_FOR_IMPLEMENTATION`; see [exact-candidate owner approval receipt](OWNER-APPROVAL.md). This supersedes the awaiting-approval disposition in the historical creation checkpoint below. Implementation dispatch is being recorded separately; approval is not implementation completion or owner acceptance.

Intake accepted; Stage 2 `stage:candidate` was assigned to runtime child `/root/spec_candidate_stage`, with one author and fresh independent stage reviews after source repairs. Current candidate `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144` passed candidate-stage validation and independent release validation. Stage evidence is `reports/stage-candidate.md`, `reports/stage-candidate-addendum-r3.md` and `reports/stage-candidate-review-r3.md`; release report is `reports/release-validation.md` (SHA-256 `973540e7b35ec9f2991a50b876d508baed1d6093edc64c00bd2a4bcda3d81297`). Current manifest check returns `matches: true` with no mismatches. The candidate is `CANDIDATE_READY_FOR_OWNER_APPROVAL`; no owner approval or implementation dispatch is recorded. No persistent child-task UUID was created. Source checkout remains dirty overall (489 paths reported at intake), but identified product paths were clean in scoped status. Preserve concurrent edits. No product source or Wiki file was modified during this creation run.
