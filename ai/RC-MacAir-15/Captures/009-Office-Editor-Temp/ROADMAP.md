# Office Editor Implementation Roadmap

**Roadmap status:** `APPROVED`  
**Fail-forward revision:** `OWNER APPROVED 2026-07-22`
**Candidate ID:** `OE-009-RC1`  
**Release state:** `APPROVED`  
**Execution model:** Fail-forward implementation with sequential owner acceptance
**Builder input:** One SPEC + `GUIDANCE.md` from the same approved candidate

## 1. Outcome

Deliver reliable Office table editing and table-wide presentation controls, plus System Manager global or workspace-local custom colors selected by each workspace's `sync_enabled` flag, and presentation-aware Print/PDF/DOCX output. Each SPEC owns one domain and includes automated validation plus an isolated Office-editor smoke test. Implementation fails forward through repairs and documented deviations; the owner reviews and explicitly accepts every completed SPEC before the next begins.

This roadmap packages the requirements captured on 2026-07-10. It does not authorize implementation by itself.

## 2. Authority Map

| Priority | Authority | Use |
|---|---|---|
| 1 | Current explicit owner decisions | Product intent and scope, including the versioning/provenance exclusions |
| 2 | Ratified contract in this SPEC bundle | Observable behavior for builders |
| 3 | Current Fusion Studio Wiki | Durable editor/table architecture and invariants |
| 4 | Active code and tests | Feasibility, integration points, and migration constraints; never product intent by itself |
| 5 | `CAPTURE.md`, `DECISIONS.md`, `ISSUES.md`, checkpoints | Requirements evidence used to prepare this bundle |
| 6 | `999-Archive` Office documents | Historical context only; they do not override current code, Wiki, or owner direction |

Current architecture authorities:

- `AGENTS.md`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/001-Office_Viewer/PAGE.md`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/PAGE.md`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/000-Fusion_Home/001-Lessons/PAGE.md`

## 3. Bundle Index

| Order | SPEC | Domain | Prerequisites | Current status |
|---:|---|---|---|---|
| 00 | [SPEC-00-OFFICE-EDITOR-TEST-HARNESS.md](SPEC-00-OFFICE-EDITOR-TEST-HARNESS.md) | Isolated Office browser fixture and reusable smoke harness | None | Accepted historical prerequisite |
| 01 | [SPEC-01-TABLE-STRUCTURE-COMMANDS.md](SPEC-01-TABLE-STRUCTURE-COMMANDS.md) | Row/column command correctness and success reporting | SPEC-00 | Accepted |
| 02 | [SPEC-02-TABLE-COLOR-METADATA-INTEGRITY.md](SPEC-02-TABLE-COLOR-METADATA-INTEGRITY.md) | Direct color actions, cascade, cleanup, and cumulative integrity | SPEC-01 | Accepted; color semantics superseded by accepted SPEC-02C |
| 03 | [SPEC-03-TABLE-COLUMN-GEOMETRY.md](SPEC-03-TABLE-COLUMN-GEOMETRY.md) | Internal and outer-edge column resizing | SPEC-02C | Accepted; VERIFY-03 passed 2026-07-22 |
| 04 | [SPEC-04-WORKSPACE-CUSTOM-COLORS.md](SPEC-04-WORKSPACE-CUSTOM-COLORS.md) | Global/local palette file foundation and selected-source projection | SPEC-03 | Historical implementation/recovery accepted; selector amendment joins SPEC-05 owner review |
| 05 | [SPEC-05-CUSTOM-COLOR-SYNC.md](SPEC-05-CUSTOM-COLOR-SYNC.md) | Atomic picker cutover, selector toggle, and selected-source Add/Remove | SPEC-04 | Accepted by owner 2026-07-22 |
| 06 | [SPEC-06-TABLE-MENU-AND-REMOVAL.md](SPEC-06-TABLE-MENU-AND-REMOVAL.md) | Extensible Table submenu and whole-table lifecycle | SPEC-05 + passing VERIFY-03 | Accepted by owner 2026-07-24 |
| 07 | [SPEC-07-TABLE-OVERFLOW-MODES.md](SPEC-07-TABLE-OVERFLOW-MODES.md) | Overflow / Truncate / New line rendering and persistence | SPEC-06 | Accepted by owner 2026-07-25 |
| 08 | [SPEC-08-TABLE-TITLE-ROW.md](SPEC-08-TABLE-TITLE-ROW.md) | Structural Add title row behavior and GFM-compatible round trip | SPEC-07 | Accepted by owner 2026-08-02 |
| 09 | [SPEC-09-TABLE-BORDERS.md](SPEC-09-TABLE-BORDERS.md) | Table-wide border width/color presentation | SPEC-08 | Accepted by owner 2026-08-03 |
| 10 | [SPEC-10-TABLE-ALIGNMENT.md](SPEC-10-TABLE-ALIGNMENT.md) | Left/center/right table placement | SPEC-09 | Accepted by owner 2026-08-07 on repaired candidate |
| 11 | [SPEC-11-TABLE-PRESENTATION-OUTPUT.md](SPEC-11-TABLE-PRESENTATION-OUTPUT.md) | Presentation-aware Print, PDF, DOCX, and email bridge | SPEC-10 | Released for execution after SPEC-10 owner acceptance |

`ROADMAP-LEDGER.md` carries detailed evidence and residuals for these summary states. SPEC-06 additionally requires a passing VERIFY-03 record.

## 4. Dependency Graph

```text
SPEC-00 isolated test harness
  -> SPEC-01 table structure commands
    -> SPEC-02 color metadata integrity
      -> SPEC-03 column geometry
        -> SPEC-04 global/local palette source foundation
          -> SPEC-05 atomic picker cutover and selector/Add/Remove controls
            -> SPEC-06 Table menu and whole-table lifecycle
              -> SPEC-07 overflow modes
                -> SPEC-08 title row
                  -> SPEC-09 borders
                    -> SPEC-10 alignment
                      -> SPEC-11 presentation output bridge
```

The order is intentionally serial even where research could occur in parallel. A later builder may not bypass an unaccepted predecessor or a separately stated blocking validation gate such as VERIFY-03.

## 5. Cross-SPEC Contracts

These contracts are expanded in `GUIDANCE.md` and in the affected SPECs:

1. Markdown remains the canonical document body. Table presentation stays in normalized frontmatter. SPEC-08 uses one narrow frontmatter-marked GFM surrogate to round-trip a spanning title row; SPEC-11 consumes normalized renderer metadata without writing presentation HTML/CSS into the saved Markdown body.
2. ProseMirror owns `<td>`, `<th>`, `<tr>`, and their contents. Office presentation code may tag table chrome and use an injected descendant stylesheet; it may not imperatively mutate editable cell DOM. SPEC-07 owns the bounded hardbreak node-view/codec; SPEC-08 owns the separate bounded title-row schema/GFM-surrogate codec. Neither changes content in response to a presentation-mode selection or authorizes controller DOM mutation.
3. `metadata.tables`, `metadata.tableColors`, and the new `metadata.tableStyles` remain sibling structures. A write in one domain must preserve the other two and unknown frontmatter.
4. A structure command is preflighted from its undispatched ProseMirror transaction and dispatched once. SPEC-01 immediately carries `tableColors` plus `tables` width/identity transforms so its visible command repair is safe to accept. SPEC-06 covers every present collection for whole-table insertion/removal, and SPEC-07 adds `tableStyles` to row/column mutations. Every active transform is attached to the same composite history event and published synchronously in the one dispatch. Failed preflight is always a complete no-op; no-stale-frame claims apply to every active domain.
5. `sync_enabled` selects a source; it does not initiate synchronization. True uses only `System_Manager/global-configs/office-custom-color-pallete/colors.json`; false uses only the workspace's `ai/<machine>/System/config/colors.json`. Add/Remove write only the selected source, toggling preserves both arrays, and drift is irrelevant. Clients never submit filesystem paths. There is no cross-workspace fanout, merge, watcher, reconciliation, retry scheduler, journal, or timestamp protocol.
6. All automated UI tests use the isolated Office fixture from SPEC-00, never the developer's live `fs-dev` workspace content or database.
7. Each feature updates the current Office Wiki only after code and acceptance behavior agree.
8. In the final state, whole-table insertion/removal reindexes every present table-scoped collection. Row-only mutations preserve renderer values while refreshing identity in every activated collection; column mutations reindex activated colors and widths at the verified index and refresh shared identity. `GUIDANCE.md` defines the exact staged activation table so an earlier builder is not assigned a later domain.
9. In the final state, every direct document renderer-metadata edit is one invertible `OfficeTableMetadataStep`; this activates with its owning packet—color set/clear in SPEC-02, resize in SPEC-03, overflow in SPEC-07, title-row structure/marker in SPEC-08, borders in SPEC-09, and alignment in SPEC-10. Ordinary Undo/Redo then restores that action without consuming adjacent text history. Workspace palette/config state is not part of document Undo.
10. Office PDF/DOCX/Print payloads opt into the bounded bridge with both an explicit `office-tables` mode and a normalized descriptor alongside canonical Markdown. Whole-body/table-source hashes, logical widths, and converter semantic matrices bind every entry before transformation. Absence of both fields preserves existing Email/other legacy callers; exactly one is invalid. No renderer-supplied HTML or CSS crosses IPC.

## 6. Per-SPEC Acceptance Cycle

For each SPEC, the orchestrator must enforce this cycle:

1. Confirm the previous SPEC has explicit owner acceptance and the current packet has no indispensable unresolved owner decision.
2. Give one fresh builder the current SPEC and current living `GUIDANCE.md`.
3. Builder completes slices in order, including mechanically necessary integration even when the packet omitted a file or task, and records every deviation.
4. Builder self-reviews and runs applicable targeted checks; validated findings are repaired and affected checks rerun.
5. Independent builder-owned and orchestrator-owned reviewers inspect current bytes. Review continues through repair until the first clean pass, with no arbitrary pass ceiling or instability verdict based on discovery count, novelty, severity trend, hashes, or owner edits.
6. Orchestrator runs the SPEC acceptance commands and smoke, classifies every deviation, and reports its effect on accepted and future work.
7. Supervisor independently inspects the implementation, evidence, deviations, and downstream impact; corrections return to the orchestrator and are reviewed again.
8. Supervisor gives the owner the complete plain-language SPEC report: delivered behavior, changes, tests, reviews, all deviations/out-of-scope work, impact, residuals, and evidence paths.
9. Only explicit owner acceptance marks the SPEC accepted and permits the next SPEC to start.

Terminal `BLOCKED` is reserved for genuine execution impossibility; `AUTHORITY_BLOCKED` is reserved for an indispensable owner decision that cannot be inferred. Stale tests, dirty files, owner edits, changed hashes, omitted file lists, validation failures, and review findings are work to complete and report, not reasons to abandon the SPEC.

## 7. Global Completion Gate

The roadmap is complete only when:

- SPEC-00 through SPEC-11 are individually accepted in order;
- targeted client checks, server tests, and all Office Playwright smoke files pass together;
- an Electron desktop smoke confirms menu positioning, pointer resize, keyboard/focus behavior, save/reopen persistence, exact PDF/DOCX/Print presentation output, and no visible regression;
- the current Office Wiki describes the accepted behavior;
- no versioning or provenance files were changed by this roadmap;
- no temporary adapters, fixture workspaces, test databases, palette watcher processes, retry schedulers, convergence coordinators, or removal journals remain;
- the final implementation review finds no cross-SPEC drift or metadata-domain overwrite.

## 8. Parallel-Safe Work

Before implementation, read-only research, fixture design, and test-case preparation may be parallelized. Implementation is not parallel-safe because the SPECs intentionally build on the same table controllers, frontmatter serializers, context menu, and Office editor lifecycle. The orchestrator must accept them sequentially.
