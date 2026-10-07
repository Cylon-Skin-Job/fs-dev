# Ordered execution packets

## Common protocol — mandatory for every slice

One writer at a time. The orchestrator starts a fresh `spec-slice-builder` for each new slice. Give that builder the full normative bundle, current execution baseline, exact slice ownership, approved candidate and prior accepted dependencies. Every descendant inherits the invoking root thread's model and reasoning effort. Workers are not alone in the shared dirty checkout; preserve other work and reconcile fresh bytes before writing.

Each builder implements one bounded documentation slice, including mechanically necessary integration within PAGE-MAP scope, self-reviews, runs required checks, records every deviation and downstream effect, and spawns only fresh read-only `clean-room-reviewer` threads (never another builder). Repair forward and repeat affected checks/fresh review until first materially CLEAN pass; no arbitrary pass ceiling. Return READY_FOR_ORCHESTRATOR_REVIEW with actual changed paths, final hashes, source/claim evidence, checks, deviations, review identities/results and limitations.

The orchestrator independently inspects returned work and obtains a separate fresh clean-room review. Stop at first CLEAN acceptance pass; otherwise route material repairs through the builder, then fresh builder-owned review and fresh orchestrator-owned review. Never accept solely from the builder's report, preparation CLEAN, a marker file or idle status. All material acceptance repairs, including S05 repairs of earlier work, use this same two-owner review chain. New slice means new builder; current slice repairs can return to its builder. Record intermediate review failures, repairs and final outcomes without erasing history.

Keep EXECUTION.md with S00-S05 states, builder/reviewer identities, evidence paths, hashes, commands, deviations and impact. Owner decisions that are genuinely new are raised without inventing defaults; only affected work waits. Do not reopen D01-D12.

## S00 — Evidence and safe-edit preparation

Dependencies: approved candidate. Own only capture-local tooling/evidence, no live wiki edits.

Read all mandatory SOURCES entries and current page baselines. Record HEAD, inspected source hashes, source scope/limitations and each mapped page's present/absent status. Snapshot census of existing .versions and relevant read-only authority files. Add claim evidence for material current facts along actual producers/consumers; archived status labels do not prove implementation.

Prepare a capture-local checker and narrowly scoped safe writer/stamper/generation helper as needed, satisfying VALIDATION. Existing Capture036 tools may be read/reused as an implementation choice, but copy/adapt locally; never overwrite old receipts or rely on obsolete exact page lists. All new tooling must be limited to documentation artifacts and isolated staging. Obtain the same independent builder/orchestrator gates as other slices.

Acceptance: baseline exclusive-created; validator rejects representative bad metadata/link/snapshot/scope/stamp cases; every D/C/AC has planned output; all absent/existing pages accounted for. Source facts are inspection only, not runtime certification.

## S01 — Vocabulary, ownership and decisions

Dependency: S00 accepted. Own PAGE-MAP S01 creates (overview, decisions, platform boundaries).

Write human-readable entry and layer roles; explicit current/approved/open labels; exact shell/file-type versus extensible presentation distinction. Link planned pages using checker-recognized pending targets until created. Explain current renderer/server separation without implying product refactoring happened. Record open choices O01-O07 as future gates.

Acceptance: D01-D06 plus relevant D07-D11 boundaries have coherent owner routing; no “everything runs on server” or universal arbitrary-code component registration; no duplicate section-root page; metadata and safe edit evidence valid. Run slice S01 checks and both independent reviews.

## S02 — Templates and composable presentation

Dependency: S01 accepted. Own PAGE-MAP S02 creates.

Explain protected contribution code versus copied editable template, server provisioning and customizable workspace selection; link detailed context/provisioning to WV owners. Describe standard library and plugin contributions at configure/compose/custom-code levels. Include a clearly illustrative Capture collection example with explicit data/actions/host boundary. Source-check existing tab owner/launcher paths as bounded foundations, not general plugin support.

Acceptance: D04-D09/D12 and C02/C03/C05 coherent; no invented manifest/schema, permissions by folder name, plugin lifecycle implementation or mandatory six-view/component inventory. Run slice S02 checks and both reviews.

## S03 — Containers, data actions and custom regions

Dependency: S02 accepted. Own PAGE-MAP S03 creates.

Explain tab/drawer/window host versus content, current/new-tab canonical file presentation and return-to-collection ownership. Preserve Chat decisions by links, no redesigned side-chat drawer/list behavior. Explain app storage versus System and command/result/fact flow with required-prewrite/optional-context/postwrite distinctions intact. Explain hybrid target and existing iframe branch limits; no unimplemented bridge claims.

Acceptance: D02/D03/D06/D10/D11, C04/C07/C08 reflected; no replacement file editor or universal atomicity/raw DB/bus capability. Runtime interface choices remain open. Run slice S03 checks and both reviews.

## S04 — Reconcile workspace/view articles

Dependency: S03 accepted. Own purpose-limited PAGE-MAP S04 updates.

In current WV pages, propagate template and platform component boundaries. Narrow WV-O06 to mechanisms after recording view-folder CWD, project orientation, own-view harness context and manual cross-view reads as settled intended behavior. Keep current observed project-root startup and WV-G04 gap unless fresh code proves otherwise. Preserve all other WV gap IDs/status and current code facts. Files/Custom pages gain short target routes, not broad rewrites.

Acceptance: all mapped shared-page deltas stay within purpose; unrelated paragraphs byte-preserved except required metadata/generation. No contradiction between new section and WV; no implication owner accepted earlier SPEC completion or current product shipped target. Run slice S04 checks and both reviews.

## S05 — Gaps, navigation, timestamps and final integration

Dependency: S04 accepted. Own gap register and wiki guidance patch; generated links/metadata/final stamp and necessary accepted-contract repairs on all mapped outputs through review chain.

Create bounded PP-G gaps for component host/contributions, shell/file reuse generalization, hybrid platform interface and external-store mediation as evidence warrants; use WV links for instance/provisioning/context gaps. Record current observation strength, not speculative missing-code absolutes. Run staged audit twice; import only mapped generated blocks. Stamp actual changed articles with one current UTC time, recording exact preimages, before/after hashes and non-timestamp equivalence. Reread relevant source hashes and reassess material drift. Complete all acceptance/decision coverage and final check reports.

Acceptance: final checker zero failures and pending links; staged markers idempotent; metadata/links/source references/preimages/receipts valid; all six slices separately accepted; fresh final integration review CLEAN on final stamped bytes in addition to S05's builder and acceptance reviews. If integration review requires changes, builder repair + both reviews + fresh affected integration review.

HANDOFF.md must state SPEC_READY_FOR_OWNER_REVIEW, exact output list/hashes and timestamp receipt, six slice/review records, final integration reviewer and checks, source-only evidence scope, deviations with downstream effects, open gates and excluded coverage. Do not report product completion, owner acceptance, or start another SPEC.
