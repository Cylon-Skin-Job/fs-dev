# SPEC-06 — Table Menu Foundation and Removal

**Domain:** Extensible table-wide submenu and whole-table insertion/removal lifecycle  
**Depends on:** Accepted SPEC-05

## Objective

Add the top-level Table submenu to the existing cell context menu and deliver its first complete action: Remove table with accessible confirmation, verified target deletion, coherent metadata/history, save/reopen correctness, and no regression to existing cell/row/column controls. Complete the same collection-index lifecycle for the existing whole-table insert grid so later style metadata cannot attach to the wrong table.

Later SPECs add Overflow, Add title row, Borders, and Alignment to this submenu. This SPEC must not show inert placeholders for them.

## Menu Contract

- `Table` appears at the top with `table_edit` and a right chevron.
- In this SPEC, its submenu contains only `Remove table` with the delete icon, separated as a destructive action.
- Existing Cell/Row/Column Background and adjacent Insert/Delete actions remain available in the root cell context menu.
- Nested menus stay within the viewport and support pointer plus keyboard:
  - Up/Down moves within a menu;
  - Right or Enter/Space opens a submenu;
  - Left in a submenu closes only that submenu and focuses its parent trigger; Left at the root does nothing; and
  - Escape from any nonmodal menu layer closes the entire root/submenu stack and restores the exact invoking editor cell/selection.

## Removal Contract

Selecting Remove table opens the ratified `OD-010` Office-styled accessible confirmation surface containing exactly:

> All data inside the table will be lost.

The surface is modal: initial focus is Cancel, Tab/Shift+Tab remain contained, outside click does not dismiss, Escape and Cancel are complete no-ops, and focus returns to the invoking editor context.

- Cancel and Escape close with no document, metadata, dirty-state, or save change and return focus to the exact invoking editor cell/selection—not the closed menu or a generic context-menu element.
- Confirm removes the table captured when the menu opened—not a later selection or whichever table is currently focused.
- If the captured target cannot still be verified, abort safely with nonfatal feedback and no state change.
- Menu/confirmation opening captures a mapped position/identity without dispatching a selection or mutation transaction and without dirty/save effects.
- On Confirm, build the supported ProseMirror deletion transaction without dispatch, verify its next document removes exactly the captured table, compute the next collection snapshot, append `OfficeTableMetadataStep`, then dispatch once. Defensively assert the live result; never remove DOM nodes directly and never use `window.confirm`.
- Undo restores content plus all width/color/style metadata and Redo removes them again as one observable history action.

## Table-Collection Metadata Contract

For the preflight-verified table deletion, prepare the following next snapshot before the one dispatch:

1. remove the deleted table's entry from `metadata.tables`, `metadata.tableColors`, and any present/seeded `metadata.tableStyles`;
2. decrement later `tableIndex` values;
3. refresh fingerprints/indexes for remaining live tables without transferring entries across them; and
4. preserve unknown frontmatter and all unaffected table bytes/values.

Create/reuse a generic table-collection delete/reindex helper so SPEC-07 can consume it for `tableStyles`. Failure/cancel/stale-target paths dispatch no transaction and leave all collections byte-equivalent.

For a whole-table insertion through the existing Office insert grid, opening/preparing the grid also dispatches nothing. Build its insertion transaction against an ephemeral selection, verify the undispatched next document, prepare the same generic collection snapshot, append the metadata Step, and dispatch once. Increment existing entries at/after the exact inserted table index, refresh remaining live table fingerprints/indexes without transferring values, and create no width/color/style entry for the new table until its owning controller has an explicit value to persist. Insertion failure is a complete no-op. Undo/Redo restores the exact pre/post collection indexes and values through the shared history bridge. Test insertion before, between, and after distinct tables; existing insert behavior remains available throughout prior SPEC regressions.

## Canonical Lifecycle Fixture

The accepted scenario is `table-lifecycle`, case `table-lifecycle`, no variants, default one copy, in workspace-A file `Table Lifecycle.md`. Its exact envelope values/order are name `Table Lifecycle`, description `Office E2E table-lifecycle/table-lifecycle`, `fixtureScenario:'table-lifecycle'`, `fixtureCase:'table-lifecycle'`, `fixtureCopy:1`, and `preserveUnknown:'keep-me'`. It uses these ordered canonical tuples:

```text
(life-a,life-a,2,2)
(life-b,life-b,3,2)
(life-c,life-c,2,2)
```

For each tuple, emit exact heading `## <id>`, one blank line, an N=2 pipe-table header `<id>-h0|<id>-h1`, plain `---|---` delimiter, and data rows `<id>-rKc0|<id>-rKc1` for K=`1..R-1`, with the standard spaces/pipes shown here:

```markdown
## <id>

| <id>-h0 | <id>-h1 |
| --- | --- |
| <id>-r1c0 | <id>-r1c1 |
```

`life-b` alone appends exact third row `| life-b-r2c0 | life-b-r2c1 |`. After frontmatter emit `Before table-lifecycle.`, each heading/table block separated by one blank line, `After table-lifecycle.`, and one final LF; file encoding is UTF-8 without BOM and LF-only.

Its exact renderer fragment under `metadata`, after the fixture envelope's `preserveUnknown`, is:

```yaml
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-life-a', columns: [100, 140] }
    - { tableIndex: 1, fingerprint: 'fixture-life-b', columns: [120, 160] }
    - { tableIndex: 2, fingerprint: 'fixture-life-c', columns: [140, 180] }
  tableColors:
    - { tableIndex: 0, fingerprint: 'fixture-life-a', cells: { '0,0': '#aa0000' } }
    - { tableIndex: 1, fingerprint: 'fixture-life-b', cells: { '0,0': '#00aa00' } }
    - { tableIndex: 2, fingerprint: 'fixture-life-c', cells: { '0,0': '#0000aa' } }
  tableStyles:
    - { tableIndex: 0, fingerprint: 'fixture-life-a', fixtureSeed: 'keep-style-0' }
    - { tableIndex: 1, fingerprint: 'fixture-life-b', fixtureSeed: 'keep-style-1' }
    - { tableIndex: 2, fingerprint: 'fixture-life-c', fixtureSeed: 'keep-style-2' }
```

The builder treats this section—not SPEC-00—as the manifest oracle. The already accepted shared generator/copy mechanism remains implementation infrastructure and must reproduce these values exactly.

## Vertical Slices

### Slice 06.1 — Nested Table menu foundation

Build accessible nested-menu primitives inside the Office table context menu, render Table > Remove table only, handle viewport positioning and focus/keyboard navigation, and prove existing root actions remain functional.

**Slice gate:** pointer and full keyboard navigation pass in corners/edges of the viewport; no inert future controls exist.

### Slice 06.2 — Confirmation lifecycle

Implement `officeTableConfirmDialog.ts` outside ProseMirror DOM with labelled/described roles and the exact ratified `OD-010` initial-focus, focus-containment, Escape/cancel, outside-click, and focus-restoration behavior.

**Slice gate:** Merely opening the menu/confirmation plus Cancel, Escape, and outside behavior each dispatch zero editor transactions and produce zero document/metadata/dirty/save changes while passing keyboard assertions.

### Slice 06.3 — Verified captured-target deletion

Capture a stable editor position/bookmark and table identity on invocation without dispatch. On Confirm, preflight the proposed deletion and next collection snapshot, append the metadata Step, dispatch once, then defensively assert table count/content. Abort stale targets before dispatch.

The stale-target branch is exercised without a test-only runtime hook. In the Node-side portion of `e2e/office-table-remove.spec.ts`, build a real ProseMirror `EditorState` S0 from `table-lifecycle`, capture the same bookmark/identity used by production, create S1 by applying a normal in-memory ProseMirror deletion transaction that removes that table, then call the exported pure deletion planner against S1 and the S0 capture. It must return exactly `{ applied: false, reason: 'STALE_TARGET' }`; dispatch/callback/save spies remain zero and all collection bytes remain equal. Browser automation separately changes selection while the modal is open to prove selection cannot redirect a still-valid capture.

**Slice gate:** deleting first/middle/last of three distinct tables removes only the invoked one; the exact S0→S1 planner test proves stale abort; changing browser selection while confirmation is open cannot redirect deletion; a first-`requestAnimationFrame` assertion sees matching content/metadata; exactly one history event and one save occur.

### Slice 06.4 — Metadata, history, save/reopen

Apply both insertion and deletion table-collection contracts plus ratified undo behavior, mark dirty/save once per operation, then save/reopen. Run prior structure/color/geometry smokes and, after acceptance, update only the exact Tables `PAGE.md` path listed under Expected Changed Areas.

**Slice gate:** the table-lifecycle fixture passes insert/remove/cancel/confirm/stale-target, exact collection reindex, one-event history, dirty/save counters, and reopen assertions together with all prior cumulative smokes; the authorized Tables Wiki delta states only accepted behavior.

## Expected Changed Areas

- `officeTableContextMenu.ts`
- new `officeTableConfirmDialog.ts` and `OfficeDocumentPage.css`
- `officeInsertMenu.ts` verified whole-table insertion integration
- `front-matter.ts` table-collection helper
- `officeTableHistory.ts` table-collection snapshot payload
- `useCrepeEditor.ts` / `OfficeDocumentPage.tsx` only for modal/history/save integration
- `fusion-studio-client/e2e/office-table-remove.spec.ts`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`

No server/WS/API change is required.

## Acceptance Criteria

- Table submenu placement, icon, nesting, viewport, pointer, keyboard, and focus behavior match the contract.
- No future placeholder controls appear; all existing root operations still work.
- Warning text is exact; cancel/Escape are complete no-ops.
- Confirm removes only the originally invoked table using editor state, never direct DOM deletion.
- Insertion/removal menu opening and cancellation dispatch nothing; each accepted whole-table mutation is one preflighted composite dispatch, one history event, one dirty transition/save, and has no stale first frame.
- Stale/invalid target aborts without metadata/dirty/save change.
- Metadata collections remove/reindex exactly once after verified success and preserve unaffected/unknown data.
- Whole-table insertion before/between/after reindexes every existing width/color/seeded-style entry without misattachment and creates no phantom entry for the new table.
- Undo/redo exactly match ratified `OD-007`.
- Save/reopen yields expected remaining Markdown tables and attached width/color/style metadata.
- Modal/menu cleanup leaves no listener, overlay, or focus leak.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/components/office/officeTableContextMenu.ts src/components/office/officeTableConfirmDialog.ts src/components/office/officeInsertMenu.ts src/components/office/officeTableHistory.ts src/components/office/useCrepeEditor.ts src/components/office/OfficeDocumentPage.tsx src/lib/front-matter.ts e2e/office-table-remove.spec.ts
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts e2e/office-palette-persistence.spec.ts e2e/office-palette-sync.spec.ts e2e/office-table-remove.spec.ts --project=chromium --workers=1
```

No new server implementation is owned here, but the accepted palette server gate remains cumulative. From `fusion-studio-server/`:

```bash
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js
```

## Manual Electron Smoke

Run `node e2e/office/run-isolated-electron.mjs --scenario=table-lifecycle --copies=12`; each copy contains the exact three-table manifest in this SPEC. Open by pointer/keyboard; exercise every ratified dismissal/focus path; confirm first/middle/last on separate copies; change selection while confirmation is open; insert before/between/after on separate copies; apply ratified undo/redo; save/reopen; and inspect metadata. Live stale-target invalidation is justified `N/A` in Electron because the modal intentionally blocks every supported concurrent mutation path; its required evidence is the exact real-EditorState automated planner test above, never a production test hook. Pass requires exact target/metadata/focus/collection behavior.

## Non-Goals

- Overflow, title row, borders, alignment, and presentation output (SPEC-07–11).
- Multi-table bulk removal, keyboard deletion shortcut, row/cell count in warning.
- Context-menu redesign outside this extensible foundation.
- Server, versioning, or provenance work.

## Worker Handoff

Follow `GUIDANCE.md`; include cancel/stale-target byte-equivalence, insertion/deletion collection maps, and focus/history evidence. Return `READY_FOR_ORCHESTRATOR_REVIEW` or — only for Tier-3 conditions under the run protocol's decision ladder — evidence-backed `BLOCKED`; bank Tier-2 questions via `NEEDS_RULING` in the report file and keep working.
