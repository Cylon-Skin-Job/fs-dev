# SPEC-02 — Table Color Metadata Integrity

**Domain:** Direct table-color actions, cascade, cleanup, and cumulative coherence  
**Depends on:** Accepted SPEC-01

## Objective

Complete the table-color domain on top of SPEC-01's already-safe structural reindex: make direct cell/row/column set and clear actions atomic and undoable, prove the full rank/cascade and malformed-rule cleanup contract, and cumulatively verify that structure, sequential history, save, and reopen never detach colors or expose a stale render.

## Existing Contract

- `metadata.tableColors` is a sibling of width metadata.
- Explicit cell color wins; otherwise the higher-rank row/column rule wins, and an equal-rank tie resolves to the row rule.
- `officeTableColors.ts` already contains index-shift helpers. Do not duplicate them merely to match an earlier guessed file location.
- SPEC-01 supplies the only accepted structural mutation result and already attaches exact color plus width/identity transforms. A menu click or command invocation alone is not proof of success; this packet must preserve and deepen that accepted behavior.
- Colors render through an injected stylesheet keyed from table chrome. Direct `<td>/<th>` writes are forbidden.

## Required Reindex Semantics

For a verified insertion at index `i`:

- rules before `i` retain their index;
- rules at and after `i` shift by `+1`; and
- the inserted row/column starts without explicit color rules but inherits the normal row/column cascade where applicable.

For a verified deletion at `i`:

- rules exactly at `i` are removed;
- later rules shift by `-1`; and
- earlier rules retain their index.

The operation applies to cell coordinates plus the matching row or column map. Rank values and unaffected-axis indexes remain unchanged.

Header deletion uses the same ordinary row-index transform; promotion never permutes rows. At `i=0`, remove row-0 cell/row rules and shift every later row coordinate down by one, so metadata from the immediately following row 1 becomes row 0 atomically. `[Header,A,B] → [A as Header,B]` therefore needs no last-row special case. SPEC-08 cumulatively repeats this matrix with a spanning title.

## Vertical Slices

### Slice 02.1 — Pure reindex model and normalization

Harden the accepted pure reindex helpers with immutable inputs/outputs and make the color controller consume SPEC-01's shared `officeTableIdentity.ts`. Test cells, row rules, column rules, rank preservation, missing maps, malformed keys, identity fallback, and first/middle/last indexes on both axes.

When live table dimensions are known, malformed or out-of-range legacy/phantom entries do not render. On the next explicit successful structure or direct color commit targeting that same table, they **must** be pruned in the same `OfficeTableMetadataStep`, after the intended reindex against next-state dimensions: remove noncanonical/negative/out-of-range `row,col` cell keys, row keys outside `0..rows-1`, and column keys outside `0..columns-1`; then remove empty scope maps and remove the target table-color entry if all three maps are empty. Do not prune an untouched table, on open/read/rebuild, or during an unrelated text save. Undo restores the exact pre-commit legacy keys/maps; Redo reapplies intended mutation plus cleanup. A nominally already-effective set/clear is a no-op only when this required cleanup also has zero delta.

**Slice gate:** exhaustive helper tests pass, prove the input object is not mutated, prove exact target-only malformed/out-of-range pruning/empty-entry removal and open-time preservation, prove the exact immediate-next header-promotion mapping, and prove an unmasked second-table row-0/column-2 equal-rank intersection—row `{ color: '#f0e68c', rank: 5 }`, column `{ color: '#add8e6', rank: 5 }`—resolves exactly to row `#f0e68c` rather than column `#add8e6`.

### Slice 02.2 — Verified mutation integration

Migrate direct Cell/Row/Column set and clear actions to one `OfficeTableMetadataStep` per user action. Undo restores the exact prior map/ranks/visible cascade; Redo restores the selected result. Interleaved text history must not consume a color snapshot.

For cumulative structure coverage, consume SPEC-01's preflight-verified transaction and assert its already-active immutable color snapshot remains attached to the same dispatch. The history plugin state and color controller publish/apply the mapping synchronously before first paint. Direct set/clear actions use the same Step as document-unchanged metadata events, defensively verify the target, mark dirty once, and schedule one normal save.

Structural `metadata.tableColors` plus `metadata.tables` atomicity remains active from SPEC-01 for every later packet. This acceptance adds the direct color-action and exhaustive cascade/cleanup guarantees. `metadata.tableStyles` values remain byte/value-preserved; their structural identity refresh does not activate until SPEC-07.

Forced failure/no-op cases must leave serialized `metadata.tableColors` byte-equivalent. Multiple tables with distinct colors must remain isolated.

**Slice gate:** Playwright asserts direct set/clear Undo/Redo for all three scopes plus visible colors and parsed frontmatter for row and column edits at first/middle/last positions, including 1→2 column insertion and a forced failure path. A preinstalled observer plus first-`requestAnimationFrame` assertion proves no frame exposes the post-structure table with pre-structure color coordinates.

### Slice 02.3 — Undo/redo coherence

One structural command must be one observable history unit. Use SPEC-01's synchronized history bridge: Undo restores both the table structure and exact pre-mutation color maps/ranks; Redo restores the exact post-mutation structure/maps. No independent renderer-history command/branch is permitted, and interleaved text events carry no color snapshot.

**Slice gate:** mixed explicit cell + row + column colors retain their cascade at intersections across insert → delete → undo → undo → redo → redo.

### Slice 02.4 — Sequential edits, save, and rebuild

Run multiple mutations before and after a ProseMirror rebuild, save, close, and reopen. Confirm the injected stylesheet resolves the same visible color matrix and that widths/unknown frontmatter are unchanged.

After acceptance behavior passes, update only the exact Tables `PAGE.md` path listed under Expected Changed Areas.

**Slice gate:** the cumulative structure/color Playwright smoke passes after rebuild and reopen; parsed disk metadata and the full visible cascade matrix agree, sequential Undo/Redo restores matching document/renderer snapshots, and widths plus unknown metadata remain byte/value-equivalent.

## Expected Changed Areas

- `fusion-studio-client/src/components/office/officeTableColors.ts`
- new `fusion-studio-client/src/components/office/officeTableIdentity.ts`
- `fusion-studio-client/src/components/office/officeTableGeometry.ts` only to consume the shared identity helper without changing geometry behavior
- SPEC-01 mutation coordinator/helper
- SPEC-01 `officeTableHistory.ts` bridge for the color snapshot payload
- `fusion-studio-client/src/lib/front-matter.ts` only for normalization/pruning boundaries
- `useCrepeEditor.ts` / `OfficeDocumentPage.tsx` only where required to keep one history/save unit
- `fusion-studio-client/e2e/office-table-color-integrity.spec.ts`
- focused pure tests in the named Playwright file
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`

## Acceptance Criteria

- All color scopes reindex exactly according to the contract on both axes.
- Visual and serialized results agree after every mutation.
- Reindex is prepared from the verified undispatched transaction and applied in the same dispatch; the first rendered frame has the correct mapping.
- Failed/no-op mutations do not change colors, dirty state, or save traffic.
- Explicit-cell and ranked row/column precedence is unchanged.
- Equal row/column ranks deterministically resolve to the row rule when no explicit cell rule masks the intersection.
- Every direct set/clear is one metadata Step/history event; Undo/Redo restores exact maps, ranks, visibility, dirty/save behavior, and interleaved text events stay isolated.
- Selecting the already-effective value, or clearing an already-absent rule, creates no Step/dirty/save effect only when mandatory target-table malformed/out-of-range cleanup also has zero delta; otherwise the one cleanup Step/history/dirty/save event is required.
- Undo/redo restores exact structures, maps, ranks, and visible colors.
- Sequential edits and editor rebuilds do not double-shift.
- Multi-table edits affect only the target entry.
- Malformed/out-of-range rules stay nonrendering and byte-preserved until a successful structure/color commit on that table, which deterministically prunes them in the same Undo/Redo event and removes empty maps/entry.
- `metadata.tables`, future/seeded `metadata.tableStyles`, unknown metadata, and Markdown content are preserved except for the intended structural body edit.
- No `<td>`, `<th>`, or `<tr>` attributes/styles/classes are written by the color controller.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/components/office/officeTableColors.ts src/components/office/officeTableIdentity.ts src/components/office/officeTableGeometry.ts src/components/office/officeTableContextMenu.ts src/components/office/officeTableMutations.ts src/components/office/officeTableHistory.ts src/components/office/useCrepeEditor.ts src/components/office/OfficeDocumentPage.tsx src/lib/front-matter.ts e2e/office-table-color-integrity.spec.ts
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts --project=chromium --workers=1
```

All pure color reindex/normalization/identity matrices required by this packet live in `e2e/office-table-color-integrity.spec.ts` (Node-side Playwright tests may omit a page fixture). No additional unnamed test file is permitted.

## Manual Electron Smoke

Run `node e2e/office/run-isolated-electron.mjs --scenario=color-integrity --copies=6`. Set and clear one cell, one intersecting row, and one intersecting column; interleave a text edit; Undo/Redo each direct action; then insert/delete on both axes, undo/redo, save/reopen, and inspect frontmatter. Pass requires identical visual-to-metadata mapping, one history event per action, and no caret jump/rebuild loop.

## Non-Goals

- Changing the cascade model or color picker contents.
- Stable identity across arbitrary duplicate-table reordering (`DF-001`).
- Workspace palettes (SPEC-04/05).
- Width/style metadata changes, versioning, or provenance.

## Worker Handoff

Follow `GUIDANCE.md`. The report must map every matrix branch and history assertion to evidence and return `READY_FOR_ORCHESTRATOR_REVIEW` or `BLOCKED`.
