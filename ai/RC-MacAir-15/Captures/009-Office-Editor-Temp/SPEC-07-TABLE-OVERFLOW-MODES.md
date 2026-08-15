# SPEC-07 — Table Overflow Modes

**Domain:** Table-wide cell text overflow presentation and persistence  
**Depends on:** Accepted SPEC-06

## Objective

Give each table an independent, persisted Overflow, Truncate, or New line mode through the Table submenu. Missing metadata and new tables default to Overflow. Rendering must survive editor rebuild, structural edits, save/reopen, and printing according to `OD-005`, without writing into editable cells or persisting row heights.

## Normative Modes

| UI label | Stored value | Screen semantics |
|---|---|---|
| Overflow | `overflow` | One constrained visual line, clipped without an ellipsis |
| Truncate | `truncate` | One constrained visual line, clipped with a visible ellipsis when content overflows |
| New line | `newline` | Native explicit breaks plus normal wrapping within the constrained column |

Overflow is the ratified default. The stale `Default to Truncate` heading in `CAPTURE.md` is superseded by `DECISIONS.md`.

## Shared Table-Style Contract

This SPEC introduces the reusable sibling collection:

```yaml
metadata:
  tables: []
  tableColors: []
  tableStyles:
    - tableIndex: 0
      fingerprint: table-abc123
      tableOverflow: overflow
```

Add a normalized `DocumentTableStyle` model plus `get/setDocumentTableStyles` and an Office table-display controller. The controller matches tables through the shared table identity helper, sets `data-rv-table-overflow` to exactly one of `overflow | truncate | newline` only on `<table>` chrome, and renders descendant rules through static/injected CSS.

The screen CSS contract is exact:

```css
.rv-office-table[data-rv-table-overflow] { table-layout: fixed; }
.rv-office-table[data-rv-table-overflow='overflow'] :is(th, td),
.rv-office-table[data-rv-table-overflow='truncate'] :is(th, td) {
  overflow: hidden;
}
.rv-office-table[data-rv-table-overflow='overflow'] :is(th, td) > p {
  min-width: 0; max-width: 100%;
  overflow: hidden; text-overflow: clip; white-space: nowrap;
}
.rv-office-table[data-rv-table-overflow='truncate'] :is(th, td) > p {
  min-width: 0; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rv-office-table[data-rv-table-overflow='newline'] :is(th, td),
.rv-office-table[data-rv-table-overflow='newline'] :is(th, td) > p {
  overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: break-word;
}
.rv-office-table[data-rv-table-overflow='overflow'] [data-rv-hardbreak='explicit'] > br,
.rv-office-table[data-rv-table-overflow='truncate'] [data-rv-hardbreak='explicit'] > br {
  display: none;
}
.rv-office-table[data-rv-table-overflow='overflow'] [data-rv-hardbreak='explicit']::after,
.rv-office-table[data-rv-table-overflow='truncate'] [data-rv-hardbreak='explicit']::after {
  content: ' ';
}
```

Print media does not override these mode selectors. Emulated editor print therefore preserves Overflow clipping/no ellipsis, Truncate clipping/ellipsis, and New line wrapping exactly. SPEC-11 carries the same normalized mode through the actual Markdown→Pandoc Print/PDF path; this SPEC does not falsely claim that editor `@media print` reaches that path.

The baked `<colgroup>` remains authoritative. Fixed layout prevents content from expanding a column. When a normalized `metadata.tables.columns` entry exists, accepted SPEC-03 behavior fixes the table/minimum width to the sum of those layout-pixel widths; a geometry-keyless table remains constrained by its current wrapper width and this SPEC does not create a geometry entry merely to set overflow. The canonical fixture supplies `[96,96]`, so each table is exactly 192 layout pixels before borders and its long-cell overflow precondition is deterministic.

CSS cannot turn a native `<br>` into a space merely by applying `white-space: nowrap`. Install one Office-only, stable ProseMirror node view for Milkdown `hardbreak` nodes. Its `update()` must reuse the wrapper and synchronize the branch if `isInline` changes:

- `isInline: false` renders exactly `<span data-type="hardbreak" data-is-inline="false" data-rv-hardbreak="explicit"><br></span>`; and
- `isInline: true` preserves Milkdown soft-break semantics as `<span data-type="hardbreak" data-is-inline="true" data-rv-hardbreak="inline"> </span>` with one literal U+0020 and no native `<br>`.

The DOM representation does not change when table mode changes. The two single-line selectors hide only the explicit wrapper's child `<br>` and generate one collapsible U+0020 on that wrapper. Inherited `nowrap` collapses adjacent whitespace to one visual space; do not use `white-space: pre` on the pseudo-element. New line has no hardbreak override and therefore uses the native child break. Print media retains the selected branch; inline soft breaks keep their normal Markdown-space meaning in every mode.

Add a paired, narrowly scoped table-cell break codec and install every part before `crepe.create()` performs initial parsing:

1. Prepend a parse transformer through `remarkPluginsCtx` ahead of Milkdown's `remarkPreserveEmptyLinePlugin`; an ordinarily appended `$remark` plugin is too late. Only lowercase exact inline-HTML nodes `<br>`, `<br/>`, `<br />`, or `<br >` within an mdast GFM `tableCell` become `break` and therefore `hardbreak(isInline: false)`. Escaped text and every other HTML node remain under current behavior.
2. Set `remarkStringifyOptionsCtx.handlers.break`. When `state.stack.includes('tableCell')`, emit canonical `<br>`; otherwise delegate to the public `defaultHandlers.break`. Milkdown's `isInline: true` branch emits a text newline rather than a `break` node, so it never enters this handler. Do not inspect only the immediate parent because Milkdown inserts a paragraph between the explicit break and `tableCell`. Declare `mdast-util-to-markdown` as a direct client dependency if `defaultHandlers` is imported; do not rely on its current transitive installation.
3. Extend `paragraphSchema` narrowly. Delegate to its installed serializer except when `state.top()?.type === 'tableCell'` and the paragraph's final child is an explicit hardbreak; in that branch serialize the complete paragraph content so Milkdown's current terminal-break elision cannot drop it. Do not change empty paragraphs, ordinary paragraphs, or `isInline: true` soft breaks.

Opening alone does not save, while the next successful document save canonicalizes any accepted spelling to `<br>`. Leading, internal, trailing, and consecutive table-cell breaks must all retain their count and order through parse/save/reparse; breaks outside tables remain under Milkdown's current Markdown behavior. Thus mode changes alter only renderer metadata/node-view CSS: the ProseMirror document, hardbreak-node count, semantic cell text, and canonical Markdown breaks survive Undo/Redo, copy, save, and reopen.

The hardbreak node view is the sole bounded content-rendering exception in `GUIDANCE.md` §3.2: it is installed once as ProseMirror-owned DOM and never imperatively changed by the table controller. No mode may write cell/row attributes, classes, inline styles, text, replacement nodes, or row heights.

Setters merge only their owned field. Each normalized `tableStyles` entry retains unrecognized entry keys byte/value-equivalently for forward compatibility; it must also preserve future `titleRow`, border, and alignment fields, widths, colors, unknown outer frontmatter, and Markdown body. Missing/invalid `tableOverflow` resolves in memory to `overflow` without eagerly rewriting a file.

## Canonical Overflow Fixture

The accepted scenario is `overflow`, case `overflow`, no variants, default one copy, in workspace-A file `Overflow.md`. Its exact envelope values/order are name `Overflow`, description `Office E2E overflow/overflow`, `fixtureScenario:'overflow'`, `fixtureCase:'overflow'`, `fixtureCopy:1`, and `preserveUnknown:'keep-me'`. Its exact UTF-8/LF body after the closing frontmatter delimiter, including one final LF, is:

```markdown
Before overflow.

## overflow-a

| overflow-a-h0 | overflow-a-h1 |
| --- | --- |
| FirstLineSegmentABCDEFGHIJ<br>SecondLineSegmentKLMNOPQRST | overflow-a-r1c1 |

## overflow-b

| overflow-b-h0 | overflow-b-h1 |
| --- | --- |
| overflow-b-r1c0 | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 |

After overflow.
```

Table 0 has no `tableStyles` entry. Table 1 has the Truncate entry below. The exact renderer fragment under `metadata`, after `preserveUnknown`, is:

```yaml
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-overflow-a', columns: [96, 96] }
    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', columns: [96, 96] }
  tableStyles:
    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', tableOverflow: 'truncate', fixtureSeed: 'keep-overflow' }
```

The builder treats this section—not SPEC-00—as the fixture oracle. The first table's missing style entry exercises the default `overflow`; its canonical `<br>` must not be parsed until this SPEC's codec/node view is installed before `crepe.create()`.

## Vertical Slices

### Slice 07.1 — Normalized persistence and seeded rendering

Implement the `metadata.tableStyles` normalization/controller foundation, the stable hardbreak node view, and the paired GFM-table break codec, then render fixtures with two tables in different seeded modes. Reapply table-chrome attributes after ProseMirror rebuilds.

**Slice gate:** parsed/serialized frontmatter round-trips valid values, rejects invalid values to the default, and preserves all sibling/unknown metadata. Codec tests cover the four accepted spellings plus leading, internal, trailing, and consecutive positions; they assert explicit ProseMirror hardbreak counts/order, canonical `<br>` output, byte-identical second serialization, one intact GFM table, and unchanged unrelated HTML/out-of-table/soft-break behavior. The canonical fixture above is opened only after the codec/node view is installed, first proves one `hardbreak(isInline: false)`, then renders table 0 as default Overflow and table 1 as Truncate at two 96-pixel columns. Tests assert the exact table-chrome attribute/computed rules, stable explicit and inline wrapper branches/update behavior, and no `<td>/<th>/<tr>` attribute/style/class mutation.

### Slice 07.2 — Table submenu interaction and save

Add `Table > Overflow` with `format_text_overflow` as a nested radio/checkmarked submenu with all three mode choices and a visible current mode. Place it in the exact final group/order from `GUIDANCE.md`. Selection dispatches one `OfficeTableMetadataStep`, updates only the target table, marks dirty once, schedules one normal save, and leaves the parent context-menu interaction coherent. Undo/Redo restores the exact prior/next mode; an interleaved text event remains a separate history unit.

**Slice gate:** select each mode, interleave text, Undo/Redo the mode and text events independently, assert live computed style and active menu state, wait for save, reopen, and assert parsed disk metadata plus the same rendering.

### Slice 07.3 — Transition and structural resilience

Switch repeatedly between New line and both single-line modes. In the canonical fixture, first assert the target paragraph's `scrollWidth > clientWidth` so the clip/ellipsis precondition is proven. The explicit-break cell must render `FirstLineSegmentABCDEFGHIJ SecondLineSegmentKLMNOPQRST` on exactly one line in Overflow/Truncate, with no visual hard break and no ProseMirror/Markdown rewrite; Overflow has no ellipsis and Truncate has a visible ellipsis. In New line the same stable hardbreak wrapper exposes its unchanged child `<br>`, produces at least two text line boxes, and has greater paragraph/cell content height. Do not store or set row heights; leaving New line must not retain a stale explicit height.

Insert/delete rows and columns, insert a whole table before and between styled tables through the existing insert grid, edit table text to trigger a rebuild, and verify each existing table's mode remains attached while the new table resolves to the default without a phantom entry. Row-0/header mutation must refresh the style entry's fingerprint without changing its mode.

This acceptance activates `metadata.tableStyles` identity participation in row/column structural transactions. From this point onward, each verified row/column mutation carries the accepted color, width/identity, and style-identity transforms together in the one dispatch; whole-table insertion/removal continues to reindex every present collection under SPEC-06.

**Slice gate:** long text, explicit breaks, whole-table and row/column structural mutations, rebuild, save, and reopen all pass.

### Slice 07.4 — Print behavior and full regression

Apply the WYSIWYP print contract within the editor surface: emulated print retains the selected mode and exact hardbreak presentation without changing saved metadata. Add a pure projection that emits one exact `{ tableIndex: number, fingerprint: string, overflow: 'overflow'|'truncate'|'newline' }` entry per live/serialized table in document order, including keyless defaults; it uses the accepted shared matcher, contains no HTML/CSS, and performs no IPC/export. SPEC-11 consumes the normalized `overflow` value while replacing persistent fingerprint with its own source binding. Do not change Electron IPC/export in this packet. The existing Pandoc path still receives body Markdown until SPEC-11 is accepted.

Rerun structure, color, geometry, palette, sync, and Table-menu smokes. After acceptance, update only the two exact Documents/Tables `PAGE.md` paths listed under Expected Changed Areas with the authorized deltas below.

**Slice gate:** screen and emulated-print assertions prove identical selected mode/default/width/explicit-break behavior without changing saved metadata; the descriptor projection matches table order/identity; save/reopen and all prior cumulative smokes pass; the two authorized Wiki pages describe the accepted third sibling and on-screen overflow contract without claiming the not-yet-built Electron bridge.

## Expected Changed Areas

- `fusion-studio-client/src/lib/front-matter.ts`
- new `fusion-studio-client/src/components/office/officeTableDisplay.ts`
- new `fusion-studio-client/src/components/office/officeTableHardbreak.ts` and `officeTableBreakCodec.ts`
- `useCrepeEditor.ts` and `OfficeDocumentPage.tsx` for controller lifecycle/save readback
- `officeTableContextMenu.ts`
- `OfficeDocumentPage.css`
- `fusion-studio-client/e2e/office-table-overflow.spec.ts`
- `fusion-studio-client/package.json` and `package-lock.json` only to declare `mdast-util-to-markdown` directly when its public `defaultHandlers` is imported
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/PAGE.md`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`

**Authorized target-state documentation delta:** The current Documents page describes `metadata.tables` and `metadata.tableColors` as the two renderer-owned sibling collections. After runtime acceptance, add `metadata.tableStyles` as the third sibling, owned by the table-display controller for overflow and later title/border/alignment fields, and state that each controller merge preserves the other siblings and unknown metadata. The Tables page gains the exact three modes, default, constrained-width behavior, `<br>` behavior, and persistence. SPEC-11 owns actual Print/PDF/DOCX documentation. No other Wiki page is authorized by this SPEC.

## Acceptance Criteria

- Every table independently supports exactly the three named/stored modes.
- New/keyless/invalid entries resolve to Overflow without an open-only file rewrite.
- Active menu state, computed screen style, parsed frontmatter, and reopen state agree.
- Each mode selection is one metadata Step/history event; Undo/Redo and interleaved text restore only their matching state and schedule coherent saves.
- Selecting the already-active mode creates no Step/dirty/save effect.
- Transitioning out of New line leaves no explicit/persisted row height.
- The canonical fixture proves constrained overflow (`scrollWidth > clientWidth` on the cell paragraph), exact one-space semantic-hardbreak presentation for both single-line modes in screen/emulated print, visible ellipsis only for Truncate, native multiline breaks for New line, one stable wrapper/node count, and unchanged ProseMirror content/canonical Markdown across mode-only history.
- Structural edits and editor rebuilds preserve the target table's mode.
- No cell/row DOM attributes, classes, inline styles, text, or replacement nodes are written; only the explicitly authorized stable ProseMirror hardbreak node view exists inside content.
- Setting overflow cannot erase widths, colors, other table-style fields, or unknown metadata.
- Emulated editor print honors the selected mode; the normalized descriptor needed by SPEC-11 is exact and saved mode never changes.
- Fit Text and per-cell modes do not appear.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/lib/front-matter.ts src/components/office/officeTableDisplay.ts src/components/office/officeTableHardbreak.ts src/components/office/officeTableBreakCodec.ts src/components/office/officeTableContextMenu.ts src/components/office/useCrepeEditor.ts src/components/office/OfficeDocumentPage.tsx e2e/office-table-overflow.spec.ts
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts e2e/office-palette-persistence.spec.ts e2e/office-palette-sync.spec.ts e2e/office-table-remove.spec.ts e2e/office-table-overflow.spec.ts --project=chromium --workers=1
```

From `fusion-studio-server/`, run the cumulative accepted palette gate:

```bash
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js
```

The Playwright suite must use `page.emulateMedia({ media: 'print' })` for the print assertion; assert exact computed styles, table/cell/paragraph used widths, line-box counts/heights, paragraph `scrollWidth > clientWidth`, visual ellipsis by a screenshot or equivalent rendered-pixel assertion, unchanged ProseMirror hardbreak and canonical Markdown `<br>` counts, stable wrapper identity/update behavior, copy/Undo/Redo/save/reopen behavior, and forbidden cell mutations before/after mode changes. Generated pseudo-content is absent from `innerText`/`textContent`: prove its single visual space by comparing the horizontal Range gap against a same-font U+0020 reference while both neighboring text ranges have the same line-box Y coordinate.

## Manual Electron Smoke

Run `node e2e/office/run-isolated-electron.mjs --scenario=overflow --copies=4`. Use this SPEC's constrained canonical tables in all modes, interleave/Undo/Redo a text edit and mode changes, confirm the exact explicit-break/ellipsis behavior, save, close, and reopen. The pure descriptor has no production UI or debug surface in this packet and is accepted only through the automated projection assertions above; it is not a manual observation. Actual topbar Print output is deliberately deferred to SPEC-11. Pass requires correct history isolation, clipping/ellipsis/wrapping, no row-height residue, and unchanged saved mode.

## Non-Goals

- Fit Text, per-cell modes, persisted row heights, merged-cell redesign.
- Presentation-aware Pandoc/DOCX/PDF output (SPEC-11).
- Title row, border, or alignment controls beyond preserving their seeded fields.
- A new Shift-Enter/table-cell hardbreak authoring command; this SPEC reads, presents, and preserves semantic `<br>` content, while authoring is `DF-006`.
- Versioning or provenance.

## Worker Handoff

Follow `GUIDANCE.md`; Return `READY_FOR_ORCHESTRATOR_REVIEW` or — only for Tier-3 conditions under the run protocol's decision ladder — evidence-backed `BLOCKED`; bank Tier-2 questions via `NEEDS_RULING` in the report file and keep working.
