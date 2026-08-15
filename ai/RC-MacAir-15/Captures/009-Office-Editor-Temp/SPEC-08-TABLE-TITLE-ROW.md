# SPEC-08 — Table Title Row

**Domain:** Structural Add title row behavior and GFM-compatible round trip  
**Depends on:** Accepted SPEC-07

## Objective

Add one exact Table-menu command, **Add title row**, that inserts a full-width editable title at the top of a table without abandoning a valid GFM Markdown body. The option remains visible and becomes disabled whenever the top row already has one physical cell. Removal uses the ordinary Delete Row protocol; there is no Remove Title Row, Header toggle, or Footer feature.

## Structural Contract

Every table retains Milkdown's schema shape: exactly one `table_header_row` followed by at least one `table_row`.

- `Add title row` inserts one blank `table_header` with `colspan=N` at row 0, where N is the current `TableMap.width`, and converts the former header row/cells to data row/cells in the same transaction.
- Place the caret in the new title cell after the accepted dispatch.
- The menu item is always present with `variable_add`. It is disabled with `disabled` and `aria-disabled` whenever `row0.childCount === 1`, regardless of marker state, colspan, or any other row's shape. It is therefore always disabled for a one-column table.
- There is no Remove Header, Remove Title Row, Add/Remove Footer, or Footer item.
- When the context menu is opened directly on a verified marked spanning title cell, keep `Add title row`, `Insert Row Above`, `Delete Row Above`, `Insert Column Left`, `Insert Column Right`, `Delete Column Left`, and `Delete Column Right` visible but disabled, with no explanation text/tooltip. In the root delete group, insert one title-context-only `Delete Row` action with icon `delete` immediately before `Delete Row Above`. It is enabled and invokes the generic current-header deletion/promotion transaction; it is absent outside a verified title context and does not create a general selected-row feature. Title Cell Background still targets `(0,0)`, Column Background still targets logical column 0 under the SPEC-02C render resolution, and overlay resize handles remain available.
- Deleting any header is schema-agnostic: remove row 0 and promote the immediately following physical row to `table_header_row`, preserving its content, marks, alignment, colspan, rowspan, and accepted cell attributes. Never promote/reorder the last row.
- Header deletion is enabled only when at least three physical rows exist, so a data row remains after promotion.

Exact examples:

```text
[Header, A]          delete Header -> disabled
[Header, A, B]       delete Header -> [A as Header, B]
[Title, Header, A]   delete Title  -> [Header as Header, A]
```

After title deletion, Add title row becomes enabled only when the promoted top row has more than one physical cell.

Generic Insert Row Above at row 0 remains SPEC-01's conventional N-cell-header operation for ordinary or stale multi-cell headers. It has no reachable valid-title branch: the verified title has one physical row-0 target and direct invocation there is disabled under the rule above. No programmatic/menu fallback may bypass that disabled state or expand/demote a valid title implicitly.

## GFM Surrogate and Marker

Extend the target table's existing style entry only with:

```yaml
titleRow: true
```

Only literal `true` activates the codec. Absence/invalid values mean an ordinary header. The marker carries no title text; content remains in the document.

### Live → saved Markdown

For a valid marked live title containing one physical cell with `colspan=N`:

- serialize a valid N-cell GFM header surrogate;
- surrogate header cell 0 contains the complete title content;
- cells `1..N-1` are empty;
- derive all N GFM delimiter alignments from the demoted logical row/columns rather than the one title cell; and
- serialize the former header as the first ordinary data row.

Never emit an HTML table or inline presentation HTML/CSS.

### Saved Markdown → live

Before the first visible editor frame, a valid `titleRow:true` marker rehydrates an N-cell surrogate whose continuation cells are empty into one `table_header` with `colspan=N`. Opening/rehydrating creates no history, dirty state, save, or frontmatter rewrite.

Fail closed if any continuation surrogate header cell contains user content, the logical width is invalid, fewer than three physical rows exist, or the table cannot be mapped safely: retain the ordinary N-cell header and every byte/content node, do not merge/discard anything, do not rewrite on open, and expose nonfatal diagnostic state. A marked two-row `[surrogate header, one data row]` is therefore stale rather than a title; this preserves the minimum-row deletion contract. Never infer title status from blank header cells without the literal marker.

An invalid literal marker enters table-local `stale` quarantine for that editor state. While quarantined it is never treated as a title, even if a later edit would otherwise make the header shape valid. Clearing/replacing it follows exact transaction rules:

- any accepted row/column structural mutation on that table clears the stale marker in the same composite metadata Step;
- any content transaction whose changed range intersects the quarantined physical row 0 preflights and clears the marker in that same history event, before an emptied continuation could reactivate it;
- content edits outside row 0 and presentation-only metadata actions cannot change surrogate validity, so they preserve the stale marker/quarantine byte/value-equivalently;
- explicit `Add title row` treats the stale marker as inactive, inserts the new title, demotes the complete stale header without loss, and replaces the stale marker with one valid true marker in the same transaction; and
- Undo restores the exact stale marker, quarantine, structure/content, and diagnostic; Redo reapplies the clear/replacement. Save/reopen after a clearing edit has no marker to reactivate.

The dispatch integration must attach the cleanup Step before applying a row-0 text transaction; a later observer/autosave cleanup or separate history event does not pass. Initial quarantine alone causes no history, dirty state, save, or byte rewrite.

The codec and schema hooks install before `crepe.create()` parses initial Markdown. The second serialization after save/reparse must be byte-identical.

## Composite History and Metadata

Add, title deletion, generic header promotion, and title-related column insert/delete are preflighted Office transactions. Each accepted action carries structure plus the exact `titleRow` before/after snapshot and every metadata domain activated by SPEC-07 in one dispatch/history event.

- Add creates `titleRow:true` while preserving overflow and unknown style keys.
- Deleting a marked title removes only `titleRow`; prune the style entry only if otherwise empty.
- Undo/Redo restores the exact structure, marker, content, selection, colors, widths, overflow, and identities.
- Column insert/delete updates the live title `colspan` to current `TableMap.width`; retain the marker even at logical width 1 so later expansion can restore the spanning title behavior.
- Runtime disabled state always follows physical row-0 cell count, not the marker.
- If a generic promotion exposes a one-cell spanning row as the header, recompute the marker only when that row was the same verified marked title; never infer a new marker from arbitrary content/shape.

Title add/delete route the row-axis structural change through `officeTableColorPolicy.reindexColorRules` (S9: insert shifts coordinates >= i by +1, delete removes i and shifts > i by -1; ranks preserved), then S8 hygiene rides the same Step, so promoted row 1 becomes row 0. Column rules/ranks remain unchanged. A title is one physical color target anchored at logical `(0,0)`: explicit cell `(0,0)`, row 0, and column 0 resolve under the SPEC-02C render model (explicit cell entry -> higher-rank covering row/column, legacy equal rank to row -> none); covered columns `1..N-1` do not fabricate stripes, gradients, or extra cells.

## Logical-Grid Invariants

The title's one physical cell must never collapse logical geometry:

- node-view `<colgroup>` count is `TableMap.width`, not first-row child count;
- width readback and N+1 resize boundaries come from the colgroup/logical grid, not first-row physical cells;
- table fingerprints/identity refresh without transferring metadata to another table; and
- the title spans the exact sum of all N logical column widths.

## Canonical Fixture

Extend the shared catalog with scenario `title-row`, no variants, default one copy. Workspace A file `Title Row.md` is exactly the following UTF-8/LF content using the shared copy-number substitution for `fixtureCopy` and one final LF:

```markdown
---
name: 'Title Row'
description: 'Office E2E title-row/canonical'
metadata:
  fixtureScenario: 'title-row'
  fixtureCase: 'canonical'
  fixtureCopy: 1
  preserveUnknown: 'keep-me'
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-title-ordinary', columns: [90, 110, 130] }
    - { tableIndex: 1, fingerprint: 'fixture-title-valid', columns: [100, 120, 140] }
    - { tableIndex: 4, fingerprint: 'fixture-title-two-row-stale', columns: [95, 115, 135] }
  tableColors:
    - { tableIndex: 0, fingerprint: 'fixture-title-ordinary', cells: { '0,0': '#d6ebff' } }
    - { tableIndex: 1, fingerprint: 'fixture-title-valid', cells: { '0,0': '#ffeeaa' }, columns: { '1': { color: '#d6ffd6', rank: 3 } } }
  tableStyles:
    - { tableIndex: 1, fingerprint: 'fixture-title-valid', titleRow: true, tableOverflow: 'newline', fixtureSeed: 'keep-title-valid' }
    - { tableIndex: 3, fingerprint: 'fixture-title-stale', titleRow: true, tableOverflow: 'truncate', fixtureSeed: 'keep-title-stale' }
    - { tableIndex: 4, fingerprint: 'fixture-title-two-row-stale', titleRow: true, tableOverflow: 'overflow', fixtureSeed: 'keep-title-two-row-stale' }
---
Before title-row.

| ordinary-h0 | ordinary-h1 | ordinary-h2 |
| --- | --- | --- |
| ordinary-r1c0 | ordinary-r1c1 | ordinary-r1c2 |
| ordinary-r2c0 | ordinary-r2c1 | ordinary-r2c2 |

| Quarterly Results |  |  |
| :--- | ---: | :---: |
| Name | Q1 | Q2 |
| Alpha | 10 | 20 |

| one-column-h0 |
| --- |
| one-column-r1c0 |

| Stale Title | KEEP ME |  |
| --- | --- | --- |
| stale-r1c0 | stale-r1c1 | stale-r1c2 |

| Two Row Marked Title |  |  |
| --- | --- | --- |
| only-r1c0 | only-r1c1 | only-r1c2 |

After title-row.
```

Table 1 (zero-based) is the valid title surrogate. Table 3 is stale because continuation content exists. Table 4 is stale because it has only two physical rows. Both stale tables remain ordinary three-cell headers with every byte/content node preserved, no enabled title-context `Delete Row`, and no open rewrite. The valid title's explicit `(0,0)` color paints the one spanning cell; its column-1 rule must not fabricate a stripe across that cell. No footer/header-role field exists.

## Vertical Slices

### Slice 08.1 — Marker normalization and pre-create codec

Implement marker merge/preservation, the GFM surrogate parse/stringify hooks, alignment-vector preservation, valid rehydration, and stale fail-closed behavior.

**Slice gate:** ordinary, valid three-plus-row title, one-column, continuation-content stale, and marked-two-row stale fixtures prove one-table GFM, exact content/alignments, byte-identical second serialization, no open-only effects, no lost content, and quarantined marker state that cannot reactivate from shape alone.

### Slice 08.2 — Add title row interaction

Add the exact `Add title row` item/state, the title-context-only `Delete Row` action and placement, Office-owned composite transactions, caret/focus placement, and one-event history. Do not add any Remove Title/Header, Footer, or general selected-row control.

**Slice gate:** pointer/keyboard activation on an ordinary multi-column table creates one spanning title; one-column and already-one-cell top rows are visibly disabled/no-op. In a verified title context, the seven specified controls are disabled without explanation text; `Delete Row` appears in the exact root-group position, pointer and keyboard each remove the current title in one dispatch, focus/selection lands in the promoted header, and Undo/Redo plus interleaved text remain isolated. Outside that context, no `Delete Row` item is present.

### Slice 08.3 — Deletion, reindex, and logical geometry

Exercise generic deletion/promotion for ordinary and title headers, color transforms, column insert/delete/colspan, row insertion boundaries, shared identities, colgroup, and handles.

**Slice gate:** exact examples above pass; every verified title begins with at least three rows, title deletion promotes the next row while leaving a data row, marker disappears, Add becomes available, all logical widths/handles remain present, and the first animation frame has coherent metadata. On separate continuation-content and two-row stale copies, row/column insert/delete, generic row-0 insertion/deletion, row-0 continuation text deletion, and explicit Add each follow the quarantine/clear/replace rules with exact Undo/Redo and save/reopen.

### Slice 08.4 — Save/reopen and cumulative regression

Save/reopen every fixture, repeat title edits and Undo/Redo, run earlier structure/color/geometry/menu/overflow smokes, and update only the current Tables Wiki page after runtime acceptance.

**Slice gate:** saved body stays valid GFM; valid title rehydrates before paint; stale surrogate is lossless; spanning title width equals the logical column sum; no forbidden DOM write or cross-domain loss occurs.

## Expected Changed Areas

- `fusion-studio-client/src/lib/front-matter.ts`
- new `fusion-studio-client/src/components/office/officeTableTitleCodec.ts`
- `officeTableNodeView.ts`, `officeTableGeometry.ts`, `officeTableIdentity.ts`, `officeTableMutations.ts`, and `officeTableHistory.ts`
- `useCrepeEditor.ts` for pre-create codec/schema installation
- `officeTableContextMenu.ts` and `OfficeDocumentPage.css`
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs`
- `fusion-studio-client/e2e/office-table-title-row.spec.ts`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`

**Authorized target-state documentation delta:** after runtime acceptance, document the exact Add title row/disabled/delete-promotion/GFM-surrogate behavior and remove no current-runtime text before implementation passes.

## Acceptance Criteria

- The exact label is `Add title row`; it is always present and disabled precisely when row 0 has one physical cell.
- Add produces one editable full-width `<th colspan=N>`, demotes the prior header, focuses the title, and creates one composite history/save event.
- No Remove Title/Header or Footer control exists; generic deletion promotes immediately row 1 and preserves a data row.
- When invoked on a verified spanning title cell, `Add title row`, `Insert Row Above`, `Delete Row Above`, `Insert Column Left`, `Insert Column Right`, `Delete Column Left`, and `Delete Column Right` remain visible but disabled with no explanation text; the exact title-context `Delete Row` item is present/enabled in the root delete group and removes the title by generic promotion.
- Live/saved codec, literal marker, alignment vector, fail-closed stale behavior, and no-open-write rules are exact.
- A marked surrogate requires at least three physical rows to become a verified title; a two-row marker is losslessly quarantined as stale and never exposes enabled title deletion.
- A stale marker is quarantined and can never silently reactivate; validity-affecting content/structure edits clear or explicitly replace it in the same history event, with exact Undo/Redo.
- Title/color reindex is performed by `officeTableColorPolicy.reindexColorRules` and the `(0,0)` spanning-cell resolution follows the SPEC-02C render model, deterministically.
- Colgroup, widths, handles, and column mutations remain logical-width aware.
- Undo/Redo, rebuild, save/reopen, and every sibling/unknown metadata field remain coherent.
- No HTML-table serialization, cell-controller DOM mutation, versioning, or provenance is introduced.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/lib/front-matter.ts src/components/office/officeTableTitleCodec.ts src/components/office/officeTableNodeView.ts src/components/office/officeTableGeometry.ts src/components/office/officeTableIdentity.ts src/components/office/officeTableMutations.ts src/components/office/officeTableHistory.ts src/components/office/officeTableContextMenu.ts src/components/office/useCrepeEditor.ts e2e/office/fixture-scenarios.mjs e2e/office-table-title-row.spec.ts
node --test e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts e2e/office-palette-persistence.spec.ts e2e/office-palette-sync.spec.ts e2e/office-table-remove.spec.ts e2e/office-table-overflow.spec.ts e2e/office-table-title-row.spec.ts --project=chromium --workers=1
```

From `fusion-studio-server/`, run the cumulative accepted palette gate:

```bash
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js
```

## Manual Electron Smoke

Run `node e2e/office/run-isolated-electron.mjs --scenario=title-row --copies=8`. Add by pointer/keyboard, verify disabled one-column/already-title states and exact title-context menu placement/absence outside titles, type title content, activate `Delete Row` by pointer and keyboard on separate copies, delete an ordinary header through the existing adjacent protocol, insert/delete columns, interleave text/history, save/reopen, and inspect raw GFM/frontmatter. Pass requires exact promotion, surrogate, geometry, color, focus, and no-loss stale behavior.

## Non-Goals

- Remove Title Row/Header, Header/Footer role styling, Footer, multiple title rows, arbitrary merged-cell UI, repeating print headers.
- General HTML-table/schema migration; only the bounded GFM surrogate is allowed.
- Border/alignment/output implementation (SPEC-09–11), versioning, or provenance.

## Worker Handoff

Follow `GUIDANCE.md`. Report live ProseMirror shapes, saved/reparsed GFM, marker snapshots, logical-width/handle rectangles, color matrices, disabled/focus/history evidence, and exact commands. Return `READY_FOR_ORCHESTRATOR_REVIEW` or — only for Tier-3 conditions under the run protocol's decision ladder — evidence-backed `BLOCKED`; bank Tier-2 questions via `NEEDS_RULING` in the report file and keep working.
