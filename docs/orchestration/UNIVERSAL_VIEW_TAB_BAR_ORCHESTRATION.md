# Universal View Tab Bar — Orchestration Ledger

## Authority and baseline

- Owner authorization: direct request on 2026-08-27 to execute the located SPEC as a spec orchestrator in an isolated worktree.
- Approved SPEC: `ai/RC-MacAir-15/Captures/002-SPECs/UNIVERSAL_VIEW_TAB_BAR_SPEC.md` (Draft v12; no open decisions).
- Worktree: `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar`
- Branch: `agent/universal-view-tab-bar-spec`
- Base revision: `4f972c563948213e3b459ed52f3d2f69ca203b99`
- Baseline includes an exact snapshot of the owner’s uncommitted tracked and untracked files from the primary checkout. Those bytes are prerequisites/current workspace changes, not orchestrator-authored product work.
- Baseline client build: PASS (`npm run build`).
- Baseline server writer suite: PASS (`npx jest test/view-state/writer.test.js --runInBand`, 5 tests).
- Baseline file-viewer pin suite: FAIL as expected from the SPEC’s known red baseline; first stopped assertion expects removed inline path-action imports.

## Slice ledger

| Slice | Scope | Prerequisites | Pass criteria | Builder | Builder review | Orchestrator review | State |
|---|---|---|---|---|---|---|---|
| S1 | Shell-owned `ViewTabBar`/`ViewTabStrip`, file-viewer adapter/migration, B11 empty-tab behavior, style/test relocation | Owner preliminary UI baseline | Build; updated file-viewer pins; empty tabs are session-only, create-or-focus, fill-in-place, and open drawer; file viewer no longer owns strip/header wrapper | `/root/universal_tabs_s1`; candidate `2190b642…7922e` | p1 finding repaired; `/root/universal_tabs_s1/s1_builder_gate_p2` CLEAN | `/root/universal_tabs_s1_acceptance` CLEAN; independent manifest `770661e7…50947` | accepted |
| S2 | Capture adapter/controller relocation, B1–B10 behavior, transition snapshots, normalization/hydration, two-key server routing | S1 accepted | Build; writer tests; capture behavior/persistence tests; malformed-state tolerance; only prescribed server delta | `/root/universal_tabs_s2`; candidate `20b7f2ad…ebb23` | p1–p3 findings repaired; `/root/universal_tabs_s2/s2_builder_gate_p4` CLEAN | `/root/universal_tabs_s2_acceptance` CLEAN | accepted |
| S3 | Complete §4.1 page-level `FloatingPathActions` migration and dead-rule cleanup; preserve per-item controls | S1 accepted | Build; source assertions; no remaining page-level inline pairs; per-item controls unchanged | `/root/universal_tabs_s3`; candidate `fdbfcd8d…7002c` | `/root/universal_tabs_s3/s3_builder_gate_p1` CLEAN; comment advisory repaired | `/root/universal_tabs_s3_acceptance` CLEAN | accepted |
| Final | Cross-slice integration, required suite, runtime/manual evidence where executable, final clean-room gate | S1–S3 accepted | Full required automated checks and clean final-integration review; all deviations classified | orchestrator | n/a | `/root/universal_tabs_final_acceptance_p2` CLEAN after fail-forward layout repair | accepted |

## Deviations and downstream impacts

S1 accepted mechanical integrations:

- `App.css` explicit rail flex override.
- FileExplorer/FileNode and WebSocket-handler discriminant guards.
- `viewActivity.ts` explicit-null active handling.
- Pure host resolver seam and focused B11 tests.
- File-tree top-offset compensation and relocated CSS/source pins.

Downstream impact: S2 can add capture through the generic adapter contract; S3 remains independent. No owner ruling required.

S2 accepted mechanical integrations:

- `ws-client.ts` genuine-hydration classification.
- `useDocViewerState.ts` live UI-to-durable controller routing.
- `ws/file-handlers.ts` restart-safe capture-tab lifecycle reconciliation.
- Mutation tracking for legacy pane collapse/width persistence.
- Focused controller/runtime tests and archive-oracle repinning.

S2 server product delta is exactly the two prescribed force-override keys. No downstream correction or owner ruling is required.

S3 accepted mechanical integrations:

- Positioned Office content and Agent detail surfaces as the containing blocks for the shared absolute action cluster.
- Removed dead EdgePanel selector arms and the obsolete page-action wrapper rule.
- Repaired the touched `FilePageView` cache-buster hook ordering so hooks remain unconditional.
- Added focused source-contract coverage for the migration and preserved per-item allowlist.

Downstream impact: none. The stale capture-layout comment identified by the builder reviewer was corrected before orchestrator acceptance. No owner ruling is required.

Final-integration fail-forward correction:

- Initial reviewer `/root/universal_tabs_final_acceptance` found that tabbed capture documents hid only the title node while leaving the old 40px `DocViewerChrome` row in flow below the new shell rail.
- The finding was routed to the earliest responsible builder, `/root/universal_tabs_s2`. The repair omits the complete capture chrome row only in tabs mode, moves the existing symlink/star/menu actions into the retained back-arrow subheader, and preserves classic capture and non-capture layouts.
- Runtime coverage now proves classic chrome/identity visibility, zero tabbed chrome rows, visible subheader actions, and rail-bottom/subheader-top adjacency within one pixel.
- Builder reviewer p5 raised an archive Restore concern based on an inaccurate review-packet claim. Restore is deliberately unavailable in the existing flat archive flow, so the introduced unreachable branch was removed rather than inventing behavior. Fresh builder reviewer p6 returned `CLEAN`.
- Fresh aggregate reviewer `/root/universal_tabs_final_acceptance_p2` returned `CLEAN`; this bounded correction requires no owner ruling and has no downstream persistence/server/path-action impact.

## Final integration evidence

- Client production build: PASS.
- Focused affected-source ESLint: PASS.
- Combined generic rail, B11, capture controller, and path-action suite: PASS, 22/22.
- Isolated `RC-MacAir-15` capture runtime plus archive suite: PASS, 2/2 on port 3011.
- Clipboard smoke: PASS, 1/1 on port 3001.
- Full server suite: PASS, 78/78 suites; 672 passed, 1 skipped. Jest emitted its existing post-success open-handle warning.
- Server product diff against the copied owner baseline: exactly `docViewerTabs` and `docViewerActiveTabId` added to `FORCE_VIEW_OVERRIDE_TOP_KEYS`, plus the bounded writer regression test.
- Direct path-button consumers: exactly `FloatingPathActions`, `FileNode`, `FolderNode`, and `TopicList`.
- `git diff --check`: PASS; temporary Playwright configuration absent.
- Runtime-mutated worktree state was restored to the copied pre-test snapshot. The primary checkout remained independent and continued to update its own live state.

Residual: the complete manual Electron B1–B11 and cross-theme/resize visual walk was not performed. Automated runtime coverage includes the repaired capture geometry hotspot. Expanded review also observed the copied-baseline conditional hook in `DocumentPreviewModal`; it predates this candidate and has no demonstrated supported-flow regression, so it is advisory/out of scope.

## Lifecycle evidence

- S1 builder `/root/universal_tabs_s1`: terminal `READY_FOR_ORCHESTRATOR_REVIEW`.
- Builder reviewer p1 `/root/universal_tabs_s1/s1_builder_gate_p1`: terminal with one material finding; incorrect `BLOCKED` label treated as non-clean and repaired per gate policy.
- Builder reviewer p2 `/root/universal_tabs_s1/s1_builder_gate_p2`: terminal `CLEAN`.
- Orchestrator acceptance reviewer `/root/universal_tabs_s1_acceptance`: terminal `CLEAN`.
- S2 builder `/root/universal_tabs_s2`: terminal `READY_FOR_ORCHESTRATOR_REVIEW`.
- S2 builder reviewers p1–p3: terminal with material findings, all repaired fail-forward.
- S2 builder reviewer p4 `/root/universal_tabs_s2/s2_builder_gate_p4`: terminal `CLEAN`.
- S2 orchestrator acceptance reviewer `/root/universal_tabs_s2_acceptance`: terminal `CLEAN`.
- S3 builder `/root/universal_tabs_s3`: terminal `READY_FOR_ORCHESTRATOR_REVIEW`; subsequent advisory-only comment cleanup completed.
- S3 builder reviewer `/root/universal_tabs_s3/s3_builder_gate_p1`: terminal `CLEAN`.
- S3 orchestrator acceptance reviewer `/root/universal_tabs_s3_acceptance`: terminal `CLEAN`.
- Initial final-integration reviewer `/root/universal_tabs_final_acceptance`: terminal with one material capture-layout finding; repaired fail-forward by `/root/universal_tabs_s2`.
- S2 layout builder reviewer p5: terminal with an authority-misaligned Restore finding; dead repair branch removed and review packet clarified.
- S2 layout builder reviewer p6 `/root/universal_tabs_s2/s2_layout_builder_gate_p6`: terminal `CLEAN`.
- Fresh final-integration reviewer `/root/universal_tabs_final_acceptance_p2`: terminal `CLEAN`.
- `close_agent` is unavailable; terminal status is recorded as lifecycle evidence.
