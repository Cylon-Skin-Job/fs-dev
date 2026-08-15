# Office Editor Bundle Review History

**Document role:** Non-normative review evidence only  
**Builder input:** No  
**Current bundle status:** `APPROVED`

This file does not add, remove, or interpret implementation requirements. A builder receives only one released SPEC plus the frozen `GUIDANCE.md`. `SPEC.md`, `ROADMAP.md`, `GUIDANCE.md`, `DECISION-LEDGER.md`, and SPEC-00 through SPEC-11 remain normative.

## Superseded Review Record

An earlier 00–10 draft received clean reviews, but later owner rulings materially changed the palette, title-row, border, square-minimum, and output contracts and added SPEC-11. Those earlier clean verdicts do not apply to the current normative bundle.

## Current Review Cycle

The first current-cycle independent contract and testability passes both returned `NOT CLEAN`. They identified grounded gaps rather than new owner questions: exact later fixtures, pre-SPEC-08 span testing, palette partial-error shape, final removal-recovery coverage, exact byte-ceiling construction, output descriptor/source identity, active Email-caller compatibility, actual Electron PDF automation, config-directory fsync, and modal focus wording.

The repair batch propagated those findings across the owning SPECs, `GUIDANCE.md`, `ROADMAP.md`, and `DECISION-LEDGER.md`. Current mechanical checks find 12 ordered SPECs, required terminal sections in every SPEC, balanced fences, valid local Markdown links, and no product-code changes. These checks are preliminary only.

A second builder/testability probe identified declaration-resolution, preload/package-boundary, fixture self-containment, lint-ownership, output-UI reachability, and copy-rule gaps; those grounded findings were repaired. Its final current-byte SPEC-00–10 probe reported no remaining builder/testability blocker except the then-open OQ-001.

The owner answered OQ-001 on 2026-07-12: when the context menu is invoked on the spanning title cell, `Add title row`, `Insert Row Above`, `Delete Row Above`, `Insert Column Left`, `Insert Column Right`, `Delete Column Left`, and `Delete Column Right` stay visible but disabled, with no explanation text. Ordinary Delete Row remains the removal path for the title row. That ruling has now been propagated, so the bundle is back in validation rather than waiting on product intent.

No clean verdict or frozen candidate exists yet. After the repair batch is complete, entirely fresh reviewers must inspect the raw normative artifacts without this history, and any subsequent normative edit invalidates their verdicts.

## Scope Integrity

- No product code is changed by bundle preparation.
- Document versioning remains excluded.
- Provenance remains preparation-only, outside the roadmap, and is not a dependency.
- Existing unrelated worktree changes remain untouched.

## Owner Approval Record — 2026-07-12

The owner explicitly approved candidate `OE-009-RC1` as-is on 2026-07-12, waiving the remaining fresh-reviewer back-validation pass described above. The release ceremony flipped every normative member's Release state (and bundle/roadmap status fields) to `APPROVED`, recomputed all 16 SHA-256 hashes, and recorded the owner as approval authority in `RELEASE-MANIFEST.md`. Implementation execution under the roadmap orchestrator begins with SPEC-00. Builder model policy set by owner: GPT 5.6 Sol (high reasoning) for complex SPECs, GPT 5.6 Terra (medium reasoning) for medium/light SPECs.

## Owner Ruling — 2026-07-12 (SPEC-01 scope extension)

During SPEC-01 execution, the worker surfaced a packet gap: SPEC-01 must deliver the `structure/metadata` fixture variant promised by SPEC-00's catalog contract, but the accepted SPEC-00 lifecycle only implements variant selection for palette scenarios, and SPEC-01's Expected Changed Areas do not include `fixture-lifecycle.mjs`. The owner ruled on 2026-07-12: SPEC-01 is granted a bounded extension to minimally extend `fusion-studio-client/e2e/office/fixture-lifecycle.mjs` (plus its lifecycle tests in `fixture-lifecycle.test.mjs`) to accept declared non-palette scenario variants and pass the selected variant into document rendering — nothing else. All SPEC-00 regression gates and clean-room review apply to the extension. The normative bundle files remain byte-unchanged; this ruling is execution-time authority recorded here.

## Owner Ruling — 2026-07-12 (SPEC-01 second bounded scope expansion)

The owner authorized (typed "allow" in the executing Codex session, relayed to the roadmap orchestrator): `fusion-studio-client/src/components/office/useCrepeEditor.ts` is added to SPEC-01 Slice 01.1's authorized change area, limited to combined metadata publication through the existing frontmatter callbacks and exactly one existing dirty/autosave schedule per Forward/Undo/Redo, including its lint/test coverage. Grounding: GUIDANCE §3.4 requires one renderer callback, one dirty transition, and one save schedule per metadata-Step application; the frozen packet's file list omitted the editor-lifecycle file that owns those callbacks. Full validation and clean-room gates apply. Normative bundle bytes remain unchanged; this is execution-time authority recorded here.

## Standing Delegation — 2026-07-12 (bounded-correction scope rulings)

To avoid stalling on future packet file-list gaps, the owner delegates bounded-correction scope rulings to the roadmap orchestrator (Claude session) under ALL of these conditions: (1) the approved bundle's own normative text already requires the behavior, and the gap is only that the packet's Expected Changed Areas omitted a file that behavior necessarily lives in; (2) the change is minimal, stays within approved product intent, and adds no new product behavior decisions; (3) full validation, regression, and clean-room gates apply to the expansion; (4) every such ruling is recorded in this file with its grounding. Product-intent questions, contract changes, and anything failing these conditions still go to the owner.

## Ruling Ratification — 2026-07-13 (SPEC-01 third bounded expansion)

Under the owner's standing delegation (2026-07-12), the roadmap orchestrator ratifies the bounded `officeTableNodeView.ts` integration expansion reported in SPEC-01's handoff: `columnCountOf` now derives from logical `TableMap.width` instead of first-row physical cell count, plus the minimal exports/typing that integration required. Grounding: GUIDANCE §3.2 normatively requires all column-count/colgroup/width/handle logic to use logical TableMap width, never first-row physical cell count; the SPEC-01 packet omitted the file that computation lives in. Full gates and clean-room review covered the change.

## Owner Ruling — 2026-07-13 (SPEC-01 fixture variants ratified; delegation expanded)

The owner ratified the two additional structure fixture variants (`structure/partial-widths`, `structure/raw-metadata`) in `fixture-scenarios.mjs` and their consuming browser tests as part of SPEC-01's accepted revision. Grounding: the behaviors they test are normatively required (SPEC-01 malformed-rule pruning; GUIDANCE §3.3 never-render/never-rewrite/opaque-preservation; width-anchor handling for partial arrays); the deviation was the fixture vehicle, not the behavior; the never-render assertion is inherently browser-level. The structure scenario's accepted catalog surface is therefore `metadata`, `partial-widths`, and `raw-metadata`.

The owner further expanded the standing delegation: the roadmap orchestrator may ratify agent scope expansions WITHOUT owner consultation when ALL of: (1) the expansion does not break the intention of the overall ROADMAP; (2) the work is additive and useful rather than adding unnecessary complexity or bug surface; (3) full validation and clean-room gates cover it; (4) the ratification and grounding are recorded here. Product-intent changes and anything failing these conditions still go to the owner.

## Owner Product Ruling — 2026-07-14 (color precedence changed to last-choice-wins)

After SPEC-02's interactive smoke, the owner changed the table-color precedence contract: the rank-based cascade (explicit cell wins; higher rank between row/column; equal-rank tie to row) is superseded by **last choice wins with pruning** — a direct color application overrides what it covers, and rules it fully covers are removed from the frontmatter (e.g., painting a row deletes the individual cell rules inside that row so the whole row matches). Grounding: owner statement 2026-07-14; rationale: users forget individually-applied cells, and stale narrow rules surprise them. This supersedes the cascade sentences in GUIDANCE §3.3 and SPEC-02 for all future work; frozen bundle bytes remain unchanged, and SPEC-02 as-built remains accepted against the contract that was ratified when it was built. The change lands as amendment SPEC-02B (owner-approved before dispatch).

## Owner Product Ruling — SPEC-02C model

On 2026-07-15 the owner ratified the SPEC-02C color model, superseding SPEC-02B's precedence/pruning semantics: uniform last-action rules S1–S10 (explicit `none` reserved for cells only; row/column clears delete the entry and materialize `none` only at colored crossings; paints prune covered cells and win by monotonic rank; S8 hygiene and S9 structural reindex ride every Step; S10 tidy-paint keeps frontmatter minimal with a mandatory no-side-effect guard). The owner also mandated the policy/mechanics split (pure storage-agnostic officeTableColorPolicy + officeTableColorRender, sheets-portable seam) and the minimal-frontmatter design principle (metadata is AI-read context). The contract lives at ~/projects/Fusion-Home/oe009-run/SPEC-02C/SPEC-02C.md (APPROVED). Document cleared four independent clean-room passes (2 NOT CLEAN with repairs, 2 CLEAN). Frozen bundle bytes unchanged.

## Supervisor Ruling — 2026-07-16 (SPEC-03 stale handle-count oracle; standing downstream-oracle authorization)

Under delegation v2, the supervisor rules: the cumulative assertion expecting 3 resize handles on a 3-column table is a stale oracle — GUIDANCE §3.2 normatively requires logical-width handle boundaries ("N col elements and N+1 resize boundaries"), and SPEC-03's outer-edge contract makes 4 the correct count. The SPEC-03 orchestrator is authorized to update that test-only oracle (and any other accepted-SPEC oracle whose asserted behavior the SPEC-03 contract intentionally changes), citing the normative sentence per change, with the updates listed in the handback. Further, per the owner's 2026-07-16 direction, the three-tier decision ladder in oe009-run/PROTOCOL.md is standing authority for this and all later packets: Tier-1 downstream oracle updates never justify stopping a session.

## Owner Ruling — 2026-07-16 (release-control retirement)

The owner retired the hash-manifest/freeze ceremony ("I am a solo developer with an app that is not in production"). SPEC and GUIDANCE files are living documents, edited directly by the Roadmap Implementation Supervisor under the standing delegations, with material changes logged here. Packets drop integrity attestations. The decision ladder (oe009-run/PROTOCOL.md) governs agent stop behavior.

## Owner Ruling — 2026-07-17 (SPEC-03 smoke deferral and SPEC-04 sequencing)

After reviewing the SPEC-03 completion packet and supervisor evidence, the owner authorized proceeding with SPEC-04 while temporarily unable to perform the owner-hands Electron geometry smoke. SPEC-03's exact candidate hashes were reverified; fresh build, expanded lint, and `git diff --check` passed; the independent supervisor validation passed 219/219 cumulative browser tests and 34/34 lifecycle tests. The supervisor therefore accepts SPEC-03 for dependency sequencing with one explicit residual: its interactive Electron geometry smoke is deferred, not waived or represented as passed. Because SPEC-04 is a dormant workspace-palette read/watch foundation with low geometry coupling, this exception authorizes SPEC-04 only. The deferred SPEC-03 smoke must pass before SPEC-06 is delegated and remains required by the final roadmap completion gate. A material smoke finding invalidates SPEC-03 and requires dependency-aware reevaluation of later accepted work.

## Owner Ruling — 2026-07-18 (SPEC-04 smoke deferral and SPEC-05 sequencing)

After the independent SPEC-04 supervisor review matched all 22 accepted file identities and the integrated composite, passed server 61/61, cumulative Chromium 224/224, lifecycle 35/35, build, lint, diff, and cleanup gates, the owner replied `Accepted. Let's begin 5.` immediately after the supervisor offered a sequencing-only deferral. This explicitly accepts SPEC-04 for SPEC-05 sequencing with its five owner-hands Electron palette-foundation click-throughs deferred, not waived or represented as passed. The exception authorizes SPEC-05 only. Both the deferred SPEC-03 geometry smoke and SPEC-04 palette-foundation smoke must pass before SPEC-06 is delegated and remain required by the final roadmap completion gate. A material smoke finding invalidates the responsible accepted SPEC and triggers dependency-aware reevaluation.

## Live Smoke Result — 2026-07-19 (SPEC-04 invalidated; SPEC-03 remains incomplete)

The supervisor executed the deferred isolated Electron checks through the live Mac UI. SPEC-03 produced valid evidence for a 100% internal drag, exact-total adjacent redistribution, one-release persistence, Undo/Redo, reopen persistence, and 80% rendering, but the Computer Use drag surface rejected every later drag with `-10005 noWindowsAvailable`; the unexecuted outer/clamp/cancel/125% matrix remains pending and no product failure is inferred from that tool limitation.

SPEC-04's valid palette variant produced a material live failure: A → B → C switched successfully, but returning C → A left the Office view indefinitely at `Loading files...` even though the isolated server remained connected and accepted the A workspace switch. A separate clean valid run confirmed the picker baseline (None, 80 swatches, Add only, no Sync/Remove/file-backed swatch), opened the existing custom editor without saving, and proved byte-identical A/B/C color configs. Under the 2026-07-18 owner ruling, the workspace/panel rehydration failure invalidates SPEC-04 acceptance and prevents SPEC-06 sequencing. Exact evidence is in `oe009-run/SPEC-03/LIVE-SMOKE-RESULT.md` and `oe009-run/SPEC-04/LIVE-SMOKE-RESULT.md`.

## Owner Approval — 2026-07-19 (OE-009 recovery candidate)

The owner explicitly approved recovery candidate `OE-009-RECOVERY-RC1` after a fresh clean-room approval-readiness reviewer returned `CLEAN` with zero unresolved material findings. The approved route is strictly: execute SPEC-04R and reaccept original SPEC-04 behavior; then execute SPEC-05R on a changed candidate and accept the complete original SPEC-05 behavior; independently complete VERIFY-03 before SPEC-06. This approval authorizes execution and the bounded composite builder-input amendment recorded in `RECOVERY-ROADMAP.md`. It does not mark SPEC-04 or SPEC-05 implemented, repaired, reaccepted, or complete, and it does not waive the remaining SPEC-03 geometry evidence.

## Recovery Execution Record — 2026-07-20 (SPEC-04R implementation complete; supervisor reacceptance pending)

SPEC-04R implementation and its automated, manual, and isolated runtime gates completed on the 19-file integrated product/test candidate `2cc940163eddc66844228452b7eb815aed19cadafca48a0a76d94ff0a1bab47d`. The repair restored workspace-bound filesystem rehydration for cyclic, rapid, same-folder, nested-folder, and open-document switches without accepting stale prior-workspace responses or leaving matching failures pending. The full original SPEC-04 evidence was rerun, including the five original isolated Electron palette variants plus the recovery `dormant-divergent-true` variant, with exact config-byte/hash, picker-baseline, restart, external-watch, and cleanup evidence.

This execution record does not reaccept SPEC-04 or complete the recovery roadmap. The SPEC-05 coordinator remains dormant and unaccepted; SPEC-05R still owns restoring and validating its runtime activation on a changed candidate. Roadmap Implementation Supervisor reacceptance, the orchestrator acceptance/final-integration gates, and the corresponding `ROADMAP-LEDGER.md` update remain pending.

## Supervisor Reacceptance — 2026-07-20 (SPEC-04R accepted; original SPEC-04 reaccepted)

The Roadmap Implementation Supervisor accepted SPEC-04R after inspecting the complete orchestrator packet and terminal child ledger, independently recomputing the exact 19-file product/test composite `2cc940163eddc66844228452b7eb815aed19cadafca48a0a76d94ff0a1bab47d` and 20-file orchestrator candidate `98da0443688e9dbc7aba7ee38aab6ac73607af8d6127be8a7dfddc160d6eb7b8`, and rerunning the exact `[slice 04R.3]` isolated Chromium gate successfully (`1/1`, including a 1,753-module setup build). The supervisor also verified no retained fixture root, port-3311 listener, isolated runner, Electron app, server, watcher, or palette temp remained.

Every 04R slice has terminal builder-owned and orchestrator-owned adaptive review evidence; the final SPEC integration reviewer returned `CLEAN` on discovery pass 1 with zero findings. The preserved full gate remains server syntax `5/5`, Jest `63/63`, lifecycle `36/36`, cumulative Chromium `231/231`, and all six sequential Electron variants with exact byte/hash, picker-baseline, cyclic/rapid rehydration, restart, zero-fanout, and cleanup evidence. Therefore SPEC-04R is `accepted` and original SPEC-04 is reaccepted on the recovered product/test composite.

This is not recovery-roadmap completion. SPEC-05 remains historically `IMPLEMENTATION_UNSTABLE`; dependency-unblocked SPEC-05R still owns a changed-candidate retry-lifecycle repair, restoration of coordinator activation, and completion of the original SPEC-05 contract. VERIFY-03 also remains required before SPEC-06. The unavailable `close_agent` capability is recorded as degraded lifecycle hygiene, not a substantive blocker.

## Recovery Execution Result — 2026-07-20 (SPEC-05R `IMPLEMENTATION_UNSTABLE`)

Fresh orchestrator `/root/spec05r` executed the approved changed-candidate SPEC-05R after SPEC-04R acceptance. Slice 05R.1 produced a genuinely changed terminal eight-file composite `8f92619d02efa63e830b8d5dc50d25c669faa697bc053813940638e2ac9a32c2`, restored the single coordinator startup path, and passed its exact tagged (`14` matched) and unfiltered (`135/135`) five-file Jest gates, syntax, open-handle, whitespace, and cleanup checks. Those green automated results do not establish acceptance.

The adaptive review history found repeated high defects in retry ownership and durability identity. After three discovery passes and the sole reserved confirmation pass, the terminal reviewer proved that durability debt can be cleared against equal canonical bytes under a replacement file inode or replacement parent/file identity. The observed path reported reconciliation success, emptied debt, marked the owned token verified, and left no retry timer even though the original owned rename's trusted write context was no longer present. This violates the exact requirement that equal bytes alone cannot confirm durability.

The builder and orchestrator therefore returned terminal `IMPLEMENTATION_UNSTABLE` without a prohibited fifth pass. Slices 05R.2 and 05R.3, picker cutover, eight Electron variants, Wiki updates, and final SPEC integration were not started. Original SPEC-05 and SPEC-05R remain unaccepted; the current changed bytes are preserved as failure evidence, not an accepted runtime. All spawned children are terminal, cleanup is clear, and unavailable `close_agent` remains non-blocking lifecycle evidence. A new owner-approved recovery invocation is required before implementation can continue.

## Owner Approval — 2026-07-21 (`OE-009-RECOVERY-RC2`)

The owner explicitly approved recovery candidate `OE-009-RECOVERY-RC2` after fresh planning reviewer `/root/recovery_rc2_review_1` returned terminal `CLEAN` with zero material findings or advisories. RC2 authorizes one new changed-candidate SPEC-05R2 execution and fresh adaptive review budget focused on identity-bound durability debt. It preserves the complete original SPEC-05/SPEC-05R product contract, accepted SPEC-04R baseline, eight Electron variants, VERIFY-03 requirement, and SPEC-06 block.

Approval does not accept the current coordinator bytes. The prior 05R terminal composite and all earlier failed review records remain historical evidence. SPEC-05 becomes accepted only after the fresh SPEC-05R2 orchestrator, runtime/manual gates, final integration, and supervisor acceptance pass.

## Recovery Execution Result — 2026-07-21 (SPEC-05R2 `IMPLEMENTATION_UNSTABLE`)

Fresh orchestrator `/root/spec05r2` executed owner-approved `OE-009-RECOVERY-RC2`. Slice 05R2.1 passed and is retained at composite `ff292c194682b04c57d1e2ddebc858114feb4612e55c6727a77495cbc5189b0c`. The chain also produced green cumulative evidence including server suites, client build/lint, lifecycle, cumulative Chromium, and all eight sequential Electron variants before final integration review.

Final integration nevertheless found a High background reconciliation wire/state defect rooted in Slice 05R2.2: watcher/startup/registry failures could remain internally retrying while clients observed `ok` instead of the required request-free error followed by degraded state. The orchestrator invalidated 05R2.2 and dependent 05R2.3 and routed a fresh lower-gate repair.

That repair gate did not converge. Discovery 1 found two High affected-workspace scoping defects. After repair, discovery 2 found two High plus one Material across three classes: terminal no-write rejection incorrectly entering retry/degraded flow, incomplete recovery affected-set scoping, and direct pre-plan global reconciling. Because the trend expanded rather than narrowed and introduced a new High failure class, the `spec-review-gate` instability rule prohibited discovery 3. No further repair was made.

SPEC-05R2 is terminal `IMPLEMENTATION_UNSTABLE`; 05R2.2 and 05R2.3 are unaccepted/invalidated, original SPEC-05 remains incomplete, and SPEC-06 remains blocked. All builders/reviewers are terminal and run-owned cleanup is clear; unavailable `close_agent` is recorded as degraded lifecycle hygiene only.

## Owner Workflow and Product Ruling — 2026-07-21 (fail forward; palette selector)

The owner retired arbitrary security-theater and instability fail points for this local, single-owner, unreleased project. Owner edits and dirty files are authorized current state; hashes are provenance only. Review findings, stale tests, omitted file lists, needed integration, finding novelty, severity trends, or pass counts create repair work—not terminal instability. Builders may complete mechanically necessary or bounded out-of-scope integration, but every deviation must be reported with its reason, files, tests, observable effect, risk, and downstream impact. The orchestrator assesses deviations and routes corrections; review repeats on current bytes until clean or a genuine authority/execution blocker remains.

The supervisor must present the owner everything delivered by each SPEC—including all deviations, tests, audits, residuals, and downstream effects—and obtain explicit owner acceptance before starting the next SPEC.

The owner also superseded the SPEC-04/05 continuous watcher/convergence/retry/journal design. `sync_enabled` is only a source selector. True reads/writes the one machine-global `System_Manager/global-configs/office-custom-color-pallete/colors.json`; false reads/writes the workspace-local `ai/<machine>/System/config/colors.json`. Toggling changes only the local selector and preserves both arrays. Drift is irrelevant. Workspace open/switch reads the selected source; there is no background watch, merge, fanout, reconciliation, retry scheduler, journal, timestamp, or recovery state machine. SPEC-05R and SPEC-05R2 are retired as execution authority, and historical `IMPLEMENTATION_UNSTABLE` results no longer block completing the replacement SPEC-05 contract.

## Owner Approval — 2026-07-22 (fail-forward workflow revision)

The owner approved the revised roadmap execution contract after an explicit clean-room loop over the complete active authority chain. Pass 1 found five material residuals: the bundle entry point still enforced release-manifest hashes, the run protocol capped cumulative suites at two executions, lower-gate deviation classification depended circularly on orchestrator classification, report protocols collapsed authority blockers into `BLOCKED`, and the decision ledger still called the retired palette convergence design current. All five were corrected. A fresh pass-2 reviewer returned `CLEAN` with zero unresolved material findings across fail-forward repair, terminal status separation, scope/deviation routing, owner acceptance, audit-loop separation, historical-authority retirement, and the global/local palette selector.

Approval makes the current `SPEC.md`, `GUIDANCE.md`, `ROADMAP.md`, `DECISION-LEDGER.md`, `ROADMAP-LEDGER.md`, `PROTOCOL.md`, Codex workflow skills, and custom SPEC-agent definitions the execution authority. It does not accept SPEC-05 product code. The next Roadmap Implementation Supervisor must resume at SPEC-05 on current bytes, use a fresh SPEC orchestrator, repair forward until clean, assess all deviations/downstream effects, and present the complete SPEC-04/05 result plus remaining SPEC-03 smoke residual to the owner before SPEC-06.

## VERIFY-03 Completion — 2026-07-22

After accepting SPEC-05, the owner explicitly authorized a temporary
real-Electron automation driver to satisfy the exact 125%, numeric,
persistence, and cancellation branches while retaining a short owner visual
guide check. The targeted geometry Chromium file passed `25/25`. The
fixture-owned Electron driver then passed the complete remaining boundary/zoom
matrix, both 38px clamps, zero-delta/Escape/blur/pointer-cancel no-ops, rapid
release commit accounting, zero-pixel horizontal-scroll alignment,
long-content frozen-minimum behavior, persisted frontmatter checks, and exact
cleanup on integrated candidate
`0499242a8227b782ce4ef33899ea4b36ae91fe10c9c6533ac5fc6824138f7d75`.

The first manual visual launch was interrupted by a harness-pipe `EPIPE` and
was recorded as infrastructure, not a product failure. A detached relaunch
then reached manual-ready state without dependence on the chat pipe. The owner
performed the `Geometry-Three` divider gesture and reported `Passed`,
confirming smooth dashed-guide motion and release-only table mutation. The
runner subsequently reported graceful shutdown and exact-root cleanup.

VERIFY-03 is therefore passed with no remaining geometry residual. Together
with the earlier explicit SPEC-05 acceptance, all prerequisites for SPEC-06
are satisfied.

## SPEC-06 Acceptance — 2026-07-24

Fresh orchestrator `/root/spec_06_table_menu` completed SPEC-06 on repaired
candidate
`10970888829f249dd0151fc74140fcc062b6f1ad708090e69bedec7d14055fc5`.
The first owner smoke exposed a real editor-root coordinate defect: right-click
in visible whitespace discarded a valid depth-zero ProseMirror position and
could insert a table at a document boundary. The fail-forward repair preserved
that coordinate, added deterministic post-removal selection, reproduced the
failure before repair, and passed fresh builder, orchestrator acceptance, final
integration, and supervisor review.

Current-byte evidence passed tagged SPEC-06 `12/12`, cumulative Chromium
`237/237`, metadata/history `8/8`, fixture `1/1`, client build at 1,758
modules, and current server selector `29/29`.

During the final owner retest, the owner questioned whitespace between the
`life-*` labels. Direct inspection of the saved Markdown, ProseMirror node tree,
and rendered DOM proved there was no hidden paragraph or leftover table node:
the labels are adjacent H2 headings using Crepe's existing heading margin. The
owner then inserted a table between ordinary text, removed it, confirmed no
whitespace defect, classified the heading concern as a false alarm, and
explicitly reported `Passed`.

The final isolated root was removed; its CDP port 53103 and TCP 3311 were clear
with no owned process. SPEC-06 is accepted and SPEC-07 is dependency-unblocked.

## SPEC-07 Acceptance — 2026-07-25

Fresh orchestrator `/root/spec_07_overflow` completed SPEC-07 on the 23-file
candidate
`8fc2bb21eb10b4abea5a51df31c65202cbb0fa78af8e8f1314ede6cbfbce3164`.
The implementation delivers the exact Overflow, Truncate, and New line table
display modes; normalized `tableStyles` persistence; canonical table-cell
`<br>` handling; independent history and save behavior; structural identity
through row, column, insertion, and removal operations; and the bounded
projection and print contract.

Fail-forward review repaired missing structural Undo/Redo coverage and a
late-failure validation-harness cleanup defect. Fresh builder, orchestrator,
final-integration, and independent supervisor gates returned `CLEAN`. Current
evidence includes cumulative client `250/250`, focused overflow `13/13`,
fixture/output/failure cleanup `3/3`, server selector `29/29`, a 1,761-module
build, exact and expanded lint, persistence/reopen coverage, and isolated
Electron readiness.

The owner completed the four-copy isolated Electron smoke and reported “All
good” on 2026-07-25. The app then quit gracefully with code 0; isolated root
`fusion-office-e2e-t7rvVc` was removed, CDP 60545 and TCP 3311 were clear, and
no owned process remained.

SPEC-07 is accepted with no residual. The owner explicitly ordered: “Do not
proceed to 8.” SPEC-08 therefore remains pending on owner hold even though its
SPEC-07 dependency is satisfied.
