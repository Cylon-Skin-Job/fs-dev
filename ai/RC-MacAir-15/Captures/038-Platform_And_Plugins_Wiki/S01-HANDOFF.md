# S01 — Vocabulary, ownership and decisions

Candidate **PPW01-0159a35a4ecb7fd3**. Builder `/root/pp_s01_builder`. S00 accepted prerequisite. Status: **READY_FOR_ORCHESTRATOR_REVIEW**. Builder-owned gate: **CLEAN**, first pass. S01 only, no S02 work.

## Actual changes and current article hashes

All paths below are under `ai/RC-MacAir-15/Wiki/011-Platform_And_Plugins/`. These three absent-baseline pages were created through `wiki-edit.py`, with `--expect absent --slice S01 --phase content`; no existing article was overwritten and no predecessor snapshot was required. Full repository paths and hashes are in S01-OUTPUTS.json; S01-WRITES.json records exact commands/results, and EDIT-RECEIPTS.json contains three completed content receipts.

| Page | SHA-256 |
|---|---|
| `000-Platform_And_Plugins/PAGE.md` | `f944a61010c0e297c214949d93001020f9aa162edb902f80e609ca09e841061d` |
| `000-Platform_And_Plugins/001-Decisions/PAGE.md` | `5f04075e98ed8763a3ca304d82b7dc3a9872d081eda8a586d3843cf096a6e714` |
| `001-Platform_Boundaries/PAGE.md` | `fe65bdde7c7438a019d8a0991d934c4b85259955f793777e3035cf488506c5d3` |

Capture-local additions: S01-overview-proposal.md, S01-decisions-proposal.md, S01-boundaries-proposal.md, S01-WRITES.json, S01-OUTPUTS.json, S01-HYGIENE.json, S01-SOURCE-INSPECTION.json, S01-SELF-REVIEW.md, S01-BUILDER-REVIEW-01.md, this handoff and new uniquely named validator reports under runs/. Updated shared execution artifacts: CLAIMS.json, COVERAGE.json and append-only EDIT-RECEIPTS.json. Existing S00 evidence, normative packet, EXECUTION.md, source files and other worktree changes are preserved.

## Acceptance mapping

- **S01 vocabulary/status:** overview `six-roles` and `how-to-read-this-section` satisfy C01/D01. The canonical overview is the `000-` heading article; no duplicate section-root PAGE.md exists.
- **S01 D01–D06 and boundaries:** decisions `approved-direction` records all twelve decisions; boundaries `approved-ownership-model`, `extending-presentation` and `file-and-collection-ownership` keep shell, services, client presentation, canonical file renderer/type registry, collection state and save/history owners separate. No arbitrary executable registration or second tab store is implied.
- **S01 relevant D07–D11:** boundaries `instance-and-capability-ownership`, `data-and-custom-regions` and `chat-stays-with-chat`, with decisions `interpretations-replaced-or-retained`, preserve editable template/protected plugin, own/manual context, System storage, provenance failure timing and exact Side Chat direction.
- **S01 open gates:** decisions `open-choices-and-decision-gates` records O01–O07 with owners/triggers, without selecting schema, path, ABI, isolation, inventory or rollout.
- **Source evidence:** PP-CUR01 now anchors `current-source-inspected-foundation`; the inspected route is ContentArea/ContentFrame → ViewTabBar. Approved/open claims have actual anchors; detailed future output claims remain planned. CLAIMS/COVERAGE records partial C02/C04–C10 and AC01–AC08 portions, not whole-SPEC completion. C03 examples remain for S02/S03.
- **Metadata/edit safety:** three valid source-only envelopes, quoted actual UTC edit timestamps, empty generated body, absent preimages and completed receipts. Final generator/stamp acceptance remains S05.

## Self-review, checks and smoke evidence

Read repository guidance, exact standards hub/six routed pages and four Wiki guidance pages; approved packet, current S00 evidence, live workspace/Chat/Events/System authority and applicable source. S01-SOURCE-INSPECTION.json records 25 exact fresh read hashes; all compared unchanged immediately before review. S01-SELF-REVIEW.md records semantic owner checks. No live-page repair was needed in self-review; evidence anchors were made specific before independent review.

From repository root:

1. Three `python3 .../wiki-edit.py write <mapped-page> <S01-proposal> --expect absent --slice S01 --phase content` commands: PASS, exact arrays and outputs in S01-WRITES.json. Writer atomically created and reread each output.
2. `python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/validate-wiki.py slice S01`: PASS, `runs/20260923T125441302654Z-slice-S01.json`, 3 changed live pages, 22 incoming pages, 19 map entries, 444 preserved existing snapshots, 13 permitted exact later-target pending link occurrences, zero failures/warnings.
3. Direct Python whitespace/conflict-marker/ephemeral-token sweep over actual untracked pages: PASS, all 3, zero hits; S01-HYGIENE.json. `git ls-files -- <three S01 article paths>` returned no tracked files. `git diff --check -- <actual tracked changed paths>` is N/A because this slice has only untracked creates.
4. SHA-256 reread of all 3 output articles and 25 inspected source/authority paths: PASS, no drift before review.
5. Reviewer independently ran read-only `verify('slice', 'S01')` against current article and coverage bytes: PASS, zero failures/warnings, same counts. The earlier stored report predated a coverage-anchor refinement; it is preserved, not substituted.
6. After recording the terminal CLEAN conclusion in claim/coverage evidence, reran the exact slice command: PASS, `runs/20260923T125905344223Z-slice-S01.json`, same counts and zero failures/warnings. No article/source changes or product findings invalidated the clean review.

Applicable smoke is the real safe-writer readback plus parser/link/source/snapshot validator and manual reader-route inspection. Tooling bytes are unchanged, so accepted S00 fixture/generator evidence remains valid. Product tests/build, server/Electron/app launch, runtime manual smoke, screenshots, database, Alpha and Git publishing were not run: explicitly excluded by this documentation scope, not reported as passes. Final generation/stamp and final zero-pending validation are deferred to S05 as specified.

## Deviations, downstream impact and limits

No scope/product deviation or out-of-map wiki touch. Permitted implementation choice: capture-local evidence/proposals plus supplemental S01 decision anchors in CLAIMS/COVERAGE while retaining future mappings/statuses. Proposed classification: **accepted**; the orchestrator owns authoritative classification. No adapters added, removed or changed.

Thirteen pending link occurrences target exact future PAGE-MAP creates; overview generated navigation is deliberately empty. S02/S03/S05 must supply those pages, S04 reconciles workspace context wording, and S05 generates/stamps with fresh receipts. These are authorized intermediate dependencies, not waived final checks. The source-inspected foundation proves only its named current route; no shipped plugin provisioning, generalized component host, view-local harness assembly, iframe bridge, full System protection or external-store atomicity is certified. O01–O07 stay open. Existing specialist and dated Chat implementation prose remain outside recertification; durable Chat decisions are linked without repeating stale host claims. No owner acceptance or product implementation is claimed.

## Independent reviewer and lifecycle

Fresh reviewer `/root/pp_s01_builder/s01_review_1` returned terminal **CLEAN** with no material findings or required repairs. It was created with `fork_turns: none`, role `clean-room-reviewer`, inherited root model/effort and no prior conclusions. Pre-spawn agent inventory showed no prior/conflicting reviewer. Post-result inventory confirmed `completed` before handoff; the tool inventory exposes no `close_agent`, so no closure call is possible. Lifecycle disposition is recorded, and missing closure is not a blocker. Full result and evidence-note disposition are in S01-BUILDER-REVIEW-01.md. Stop after this first materially clean pass. Orchestrator acceptance remains separate.
