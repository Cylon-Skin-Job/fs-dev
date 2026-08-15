# SPEC-09 — Table Borders

**Domain:** Table-wide border thickness and color presentation  
**Depends on:** Accepted SPEC-08

## Objective

Let each table independently select and persist a table-wide border width and color through the Table submenu. Explicit color None produces an editor-only dotted `#ccc` guide at the selected width and no border in print/output. Borders must render without editable-cell DOM writes and without disturbing backgrounds, logical title spans, widths, or other styles.

## Width and Color Contract

`Table > Border size` exposes exactly `1px`, `2px`, `3px`, and `4px`. Width and color are orthogonal; there is no size-level None and no opacity field/control.

Missing border metadata preserves the current default solid `1px rgba(28, 28, 28, 0.18)` without eagerly rewriting. Explicit `borderColor: null` is distinct from missing and means:

- editor screen: dotted `#ccc` at the selected `borderWidth`;
- emulated print and SPEC-11 Preview/Print/PDF/DOCX/email output: no border.

Changing width while None is active immediately thickens/thins the dotted editor guide and retains null. Choosing a real color changes the same selected width to solid; it never resets width. Choosing None retains width. This non-crossing model is the complete precedence rule.

For a missing or invalid color field, the `Border color` menu-row summary is exactly `Default`; opening the None/Google/Custom picker checks no swatch. Default is a compatibility state, not a fourth picker source or a new persisted value. After an explicit real color or None is chosen, that explicit value is active. There is no separate Reset/Default control in this packet.

## Persistence and Rendering

Extend `metadata.tableStyles`:

```yaml
borderWidth: 2
borderColor: '#004e89' # lowercase #rrggbb, or null for explicit None
```

Use CSS variables/data attributes on `<table>` chrome and descendant selectors to paint inner and outer cell edges. The selected stroke is inset/layout-neutral inside the SPEC-03 border-box geometry: changing 1↔4px, real↔None, or color cannot change any used row/cell/column/table rectangle, persisted width, or `Hmin/Wmin`. Do not set border style/class/attributes on `<td>`, `<th>`, or `<tr>`. Setters merge these fields with overflow/title/alignment. The implementation may use descendant pseudo/background/inset paint, but its rendered edge pixels and table-chrome effective variables—not a layout-affecting cell border—are authoritative.

Partial fields normalize deterministically: missing/invalid width resolves in memory to `1`; missing/invalid color resolves to the legacy `rgba(28, 28, 28, 0.18)` solid color; explicit `null` alone selects None at the resolved width. Thus a present valid width with missing color uses that width plus the legacy solid color, and a present real color with missing width uses solid 1px. Defaults do not eagerly rewrite.

On a user border mutation, write the selected field and canonicalize only the two owned border fields: retain a valid untouched sibling, remove an invalid sibling so it falls back to missing/default, and leave an absent sibling absent. Preserve every other style/layout/color/unknown key. A click on an already-effective value is a no-op only when the relevant stored field is already canonical; choosing `1px` over raw `borderWidth:99`, for example, is one canonicalizing metadata Step. Opening, reading, or merely computing invalid/default state never rewrites bytes.

## Vertical Slices

### Slice 09.1 — Seeded border rendering and normalization

Normalize only widths `1|2|3|4` and lowercase six-digit colors/null. Render seeded tables with both fields missing, valid-width-only, real-color-only, explicit-null with missing/present width, invalid width/color, and every accepted solid width.

Extend `e2e/office/fixture-scenarios.mjs` with scenario `borders`, case `borders`, no variants, default one copy, and workspace-A file `Borders.md`. The complete frontmatter begins with these exact UTF-8/LF bytes and key order (the scenario-specific collections shown below replace the comment before the closing delimiter):

```yaml
---
name: 'Borders'
description: 'Office E2E borders/borders'
metadata:
  fixtureScenario: 'borders'
  fixtureCase: 'borders'
  fixtureCopy: 1
  preserveUnknown: 'keep-me'
  # scenario-specific collections below
---
```

With default `--copies=1`, emit the unnumbered canonical `Borders.md` / frontmatter `name: 'Borders'` with `fixtureCopy: 1`. Only when `N>1`, emit N files for `i=1..N`: filename `Borders--copy-${i zero-padded to 2}.md`, frontmatter name `Borders--copy-${i zero-padded to 2}`, `fixtureCopy: i`, and the corresponding fixture file ID. Workspace registrations and every other byte remain unchanged. The first eleven tables use these tuples in exact order:

```text
(border-missing,border-missing,2,2)
(border-width-only,border-width-only,2,2)
(border-color-only,border-color-only,2,2)
(border-null-no-width,border-null-no-width,2,2)
(border-null-width,border-null-width,2,2)
(border-invalid-width,border-invalid-width,2,2)
(border-invalid-color,border-invalid-color,2,2)
(border-width-1,border-width-1,2,2)
(border-width-2,border-width-2,2,2)
(border-width-3,border-width-3,2,2)
(border-width-4,border-width-4,2,2)
```

For each of those eleven tuples, substitute its ID into this exact byte template; every tuple has `R=2` and `C=2`, so no additional row or column is implied:

```markdown
## <id>

| <id>-h0 | <id>-h1 |
| --- | --- |
| <id>-r1c0 | <id>-r1c1 |
```

After those eleven generated tables, append this exact twelfth GFM table, including its deliberately empty title continuation cells:

```markdown
## border-title

| Border Title |  |  |
| :--- | ---: | :---: |
| border-title-h0 | border-title-h1 | border-title-h2 |
| border-title-r1c0 | border-title-r1c1 | border-title-r1c2 |
```

The complete scenario-specific metadata after `preserveUnknown` is exactly:

```yaml
  tables:
    - { tableIndex: 11, fingerprint: 'fixture-border-title', columns: [100, 120, 140], style: { fixtureLegacy: 'keep-border-title-layout' } }
  tableColors:
    - { tableIndex: 11, fingerprint: 'fixture-border-title', cells: { '0,0': '#ffeeaa' }, columns: { '1': { color: '#d6ffd6', rank: 3 } } }
  tableStyles:
    - { tableIndex: 1, fingerprint: 'fixture-border-1', borderWidth: 2 }
    - { tableIndex: 2, fingerprint: 'fixture-border-2', borderColor: '#004e89' }
    - { tableIndex: 3, fingerprint: 'fixture-border-3', borderColor: null }
    - { tableIndex: 4, fingerprint: 'fixture-border-4', borderWidth: 4, borderColor: null }
    - { tableIndex: 5, fingerprint: 'fixture-border-5', borderWidth: 99, borderColor: '#004e89' }
    - { tableIndex: 6, fingerprint: 'fixture-border-6', borderWidth: 2, borderColor: '#xyzxyz' }
    - { tableIndex: 7, fingerprint: 'fixture-border-7', borderWidth: 1, borderColor: '#4a86e8' }
    - { tableIndex: 8, fingerprint: 'fixture-border-8', borderWidth: 2, borderColor: '#4a86e8' }
    - { tableIndex: 9, fingerprint: 'fixture-border-9', borderWidth: 3, borderColor: '#4a86e8' }
    - { tableIndex: 10, fingerprint: 'fixture-border-10', borderWidth: 4, borderColor: '#4a86e8' }
    - { tableIndex: 11, fingerprint: 'fixture-border-title', titleRow: true, tableOverflow: 'newline', tableAlignment: 'right', borderWidth: 4, borderColor: '#4a86e8', fixtureSeed: 'keep-border-title' }
```

Immediately after the closing frontmatter delimiter emit `Before borders.`, one blank line, each of the twelve heading/table blocks in the stated order with exactly one blank line between adjacent blocks, one blank line after block 12, `After borders.`, and one final LF. Equivalently, the body framing is `Before borders.\n\n<block-0>\n\n...\n\n<block-11>\n\nAfter borders.\n`. The complete file is UTF-8 without BOM and LF-only. This section—not SPEC-00 or the active generator—is the normative byte oracle. Table 0 is deliberately style-keyless. Table 11 must rehydrate as the valid SPEC-08 one-cell `colspan=3` title, retain logical widths `[100,120,140]`, and start with a real 4px border. The title cell is one background target at `(0,0)`; the column-1 rule paints only logical column 1 in data rows and creates no stripe across the span. `tableAlignment:'right'` is an opaque future-domain preservation seed in SPEC-09: preserve it but do not render, normalize, or expose Alignment before SPEC-10. Slice 09.3 changes table 11 to None and back while every sibling/unknown value remains exact. No implicit title table, index, fingerprint, body, or metadata may be invented by the builder.

**Slice gate:** every complete/partial/invalid combination has exact effective and stored menu state; table-chrome variables and rendered pixels match width/style/color on inner/outer edges, only the target table changes, and no cell DOM mutation or used-geometry delta occurs.

### Slice 09.2 — Border size menu

Add `Table > Border size` as a radio/checkmarked submenu with `1px..4px`, followed by Border color in the exact group/order from `GUIDANCE.md`. Always show the selected width. When color is None, accessible text states that the editor guide uses that width and output has no border. Selecting width dispatches one metadata Step and preserves color.

**Slice gate:** every accepted size passes live rendering, active state, disk readback, and reopen before continuing.

### Slice 09.3 — Border color picker and None

Add `Table > Border color`, reusing the post-SPEC-04/05 None/Google/Custom popover. Real values persist normalized and render solid at the selected width. None persists explicit null, renders dotted `#ccc` at that same width only on screen, and computes no border in emulated print. Width and color selections each form one metadata history event. Undo/Redo restores exact stored/effective fields; interleaved text stays separate.

**Slice gate:** Google color, workspace custom color, and None each pass target isolation, frontmatter, independent Undo/Redo with interleaved text, save/reopen, and active/effective state.

### Slice 09.4 — Cross-feature regression

Resize, preserve the opaque alignment seed, change overflow, add/delete a title row, recolor cells/rows/columns, structurally edit, undo/redo, rebuild, and emulate print. Add a pure projection returning exactly `{ borderWidth: 1|2|3|4, borderColor: '#rrggbb'|null|'default' }`; it performs no IPC or export work and is consumed by SPEC-11. Border state survives and never wipes another domain. After acceptance, update only the exact Tables `PAGE.md` path listed under Expected Changed Areas.

**Slice gate:** all ratified size/color/None combinations pass exact screen/print pixels, table-chrome variables, zero used-geometry delta (including columns already at the square minimum), menu-state, history, sibling-preservation, structure, rebuild, and reopen assertions together with every prior cumulative smoke; only verified border behavior is added to the Tables Wiki.

## Expected Changed Areas

- `front-matter.ts`
- `officeTableDisplay.ts`
- `officeTableContextMenu.ts`
- `officeColorPopover.ts` only for a generic caller contract, not palette redesign
- `OfficeDocumentPage.css`
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs`
- `fusion-studio-client/e2e/office-table-borders.spec.ts`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`

## Acceptance Criteria

- Supported widths are exactly `1|2|3|4` and no opacity/size-None state exists.
- A missing field preserves the legacy solid default; explicit color None yields dotted `#ccc` at the selected width on screen and no border in emulated print/output descriptor.
- Real colors normalize to lowercase six-digit hex and use the selected thickness.
- While color is None, changing width changes the dotted guide; choosing a real color makes that same width solid.
- All inner/outer borders of only the selected table update consistently.
- Every stroke is layout-neutral: border changes preserve exact cell/row/column/table rectangles, the true-square minimum, and persisted widths.
- Active menu/picker state, computed CSS, parsed frontmatter, and reopen state agree.
- Every size/color/None selection is one metadata Step/history event with exact Undo/Redo and interleaved-text isolation.
- Selecting an already-effective canonical stored size/color creates no Step/dirty/save effect; an explicit selection over an invalid raw owned field canonicalizes once.
- Missing/default and invalid values cause zero open/read-only writes; raw file bytes remain identical until an accepted user mutation.
- Cell background colors remain visible and retain their SPEC-02C resolution.
- The `borders` fixture contains exactly widths `1..4`, the independent color/None matrix, and deterministic normalization cases.
- Widths, overflow, title marker/codec, alignment seed fields, colors, unknown metadata, and Markdown are preserved.
- No per-cell/per-row/per-side border controls or cell DOM writes are introduced.
- SPEC-09 changes no Preview/PDF/DOCX/email conversion path; actual artifact behavior is implemented and accepted only by SPEC-11.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/lib/front-matter.ts src/components/office/officeTableDisplay.ts src/components/office/officeTableContextMenu.ts src/components/office/officeColorPopover.ts e2e/office/fixture-scenarios.mjs e2e/office-table-borders.spec.ts
node --test e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts e2e/office-palette-persistence.spec.ts e2e/office-palette-sync.spec.ts e2e/office-table-remove.spec.ts e2e/office-table-overflow.spec.ts e2e/office-table-title-row.spec.ts e2e/office-table-borders.spec.ts --project=chromium --workers=1
```

From `fusion-studio-server/`, run the cumulative accepted palette gate:

```bash
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js
```

## Manual Electron Smoke

Run `node e2e/office/run-isolated-electron.mjs --scenario=borders --copies=6`. Apply every width and several Google/custom colors to ordinary/title-row tables, interleave text and Undo/Redo width/color/None events, change width while None, resize, toggle other styles, emulate print, save/reopen, and inspect at normal/high zoom. Actual exported artifacts are SPEC-11. Pass requires exact history isolation, dotted-screen/no-print fallback, consistent grids/title edges, and no lost metadata.

## Non-Goals

- Size-level None, opacity, per-side/cell/row borders, arbitrary dash styles, rounded corners.
- Palette storage/sync changes, schema changes, versioning, or provenance.

## Worker Handoff

Follow `GUIDANCE.md`; Return `READY_FOR_ORCHESTRATOR_REVIEW` or — only for Tier-3 conditions under the run protocol's decision ladder — evidence-backed `BLOCKED`; bank Tier-2 questions via `NEEDS_RULING` in the report file and keep working.
