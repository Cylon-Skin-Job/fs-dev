# SPEC-10 — Table Alignment

**Domain:** Table-wide horizontal placement  
**Depends on:** Accepted SPEC-09

## Objective

Let each table align left, center, or right under the owner-approved reference-frame/wrapping/outer-resize contract without changing column widths, total table width, cell text alignment, content, or any other table metadata. Alignment must persist and remain stable through resize, rebuild, save/reopen, zoom, and horizontal overflow.

## Owner Amendment — Page-Alignment Flow (2026-08-04)

This amendment supersedes the unconditional keyless/default-Left behavior below
for page settings Left, Center, and Right.

- A new or keyless table renders at the current page alignment.
- When the page alignment changes from `P_old` to `P_new`, every table whose
  current effective table alignment equals `P_old` moves to `P_new` as part of
  that same page-setting action.
- A table whose effective alignment differs from `P_old` remains unchanged and
  is considered value-pinned user behavior.
- Pinning is deliberately not durable metadata, a rank, or a separate flag. If
  a later page setting becomes equal to a previously pinned table, that table
  has rejoined the page flow and moves on the next page-alignment change.
- Example: with page Left and one table Right, Left → Center leaves the table
  Right; Center → Right also leaves it Right; Right → Center then moves every
  Right table to Center.
- Direct table-alignment choices remain target-only. The flow rule does not
  change widths, content, cell text alignment, structure, presentation
  siblings, unknown metadata, or unrelated tables.

The page setting also exposes `justify`, while table alignment supports only
Left, Center, and Right. The owner rules that Justify maps to effective table
alignment Center. Compute the flow comparison through this exact mapping:
Left → Left, Center → Center, Right → Right, Justify → Center. Therefore
Center ↔ Justify is a table no-op; Left → Justify moves effective-Left followers
to Center; Justify → Right moves effective-Center followers to Right; and
Center → Left or Right moves every effective-Center follower to that value.

This value-follow algorithm is common page behavior for future alignable block
consumers. Implement it as a small consumer-neutral policy/planner and make
tables its first consumer. Dividers, images, and code blocks are explicitly
future consumers and must not be wired or behaviorally changed by SPEC-10.

## Alignment Contract

Persist `tableAlignment: left | center | right` in the table's existing `metadata.tableStyles` entry for direct or cascaded explicit table values. Under the owner amendment, missing/invalid values resolve in memory through the current page-to-table mapping without an eager file rewrite, including Justify → Center.

Apply position only to `<table>` chrome:

| Value | Effective margins |
|---|---|
| `left` | `margin-inline-start: 0; margin-inline-end: auto` |
| `center` | `margin-inline-start: auto; margin-inline-end: auto` |
| `right` | `margin-inline-start: auto; margin-inline-end: 0` |

Alignment is relative to the current Office table wrapper/document content width. It does not wrap prose around a table. If a table is as wide as or wider than the available width, alignment may be visually indistinguishable but the active state persists; the existing wrapper remains horizontally scrollable.

Outer-edge resize commits widths first. For tables narrower than the wrapper, the selected alignment then determines final placement: Left preserves the wrapper-relative left edge, Right preserves the right edge, and Center preserves the center. Both outer handles remain width gestures and the overlay previews the resulting aligned edge geometry; no position/offset field is stored. At/above wrapper width, auto margins resolve to a reachable scroll origin while stored/active alignment remains unchanged. Alignment never modifies the committed width array.

## Vertical Slices

### Slice 10.1 — Seeded placement and normalization

Extend normalization/display application, then seed multiple narrower tables with different alignments. Confirm missing/default behavior and oversized-table scrolling.

Extend `e2e/office/fixture-scenarios.mjs` with scenario `alignment`, case `alignment`, no variants, default one copy, and workspace-A file `Alignment.md`. Its complete frontmatter begins with these exact bytes/key order; insert the scenario-specific collections shown below after `preserveUnknown` and before the closing delimiter:

```yaml
---
name: 'Alignment'
description: 'Office E2E alignment/alignment'
metadata:
  fixtureScenario: 'alignment'
  fixtureCase: 'alignment'
  fixtureCopy: 1
  preserveUnknown: 'keep-me'
  # scenario-specific collections below
---
```

With default `--copies=1`, emit the unnumbered canonical `Alignment.md` / frontmatter `name: 'Alignment'` with `fixtureCopy: 1`. Only when `N>1`, emit N files for `i=1..N`: filename `Alignment--copy-${i zero-padded to 2}.md`, frontmatter name `Alignment--copy-${i zero-padded to 2}`, `fixtureCopy: i`, and the fixture file ID derived from that filename. No other byte changes. Create these canonical tuples in exact order:

```text
(align-left,align-left,2,2)
(align-center,align-center,2,2)
(align-right,align-right,2,2)
(align-wrapper-width,align-wrapper-width,2,2)
(align-oversized,align-oversized,2,2)
(align-keyless,align-keyless,2,2)
```

For each tuple, substitute its ID into this exact byte template:

```markdown
## <id>

| <id>-h0 | <id>-h1 |
| --- | --- |
| <id>-r1c0 | <id>-r1c1 |
```

After frontmatter use exact framing `Before alignment.\n\n<block-0>\n\n...\n\n<block-5>\n\nAfter alignment.\n`; the entire file is UTF-8 without BOM and LF-only. Seed this exact scenario-specific metadata after `preserveUnknown`:

```yaml
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-align-0', columns: [160, 160] }
    - { tableIndex: 1, fingerprint: 'fixture-align-1', columns: [160, 160] }
    - { tableIndex: 2, fingerprint: 'fixture-align-2', columns: [160, 160] }
    - { tableIndex: 3, fingerprint: 'fixture-align-3', columns: [318, 318] }
    - { tableIndex: 4, fingerprint: 'fixture-align-4', columns: [420, 420] }
    - { tableIndex: 5, fingerprint: 'fixture-align-5', columns: [160, 160] }
  tableStyles:
    - { tableIndex: 0, fingerprint: 'fixture-align-0', tableAlignment: 'left' }
    - { tableIndex: 1, fingerprint: 'fixture-align-1', tableAlignment: 'center' }
    - { tableIndex: 2, fingerprint: 'fixture-align-2', tableAlignment: 'right' }
    - { tableIndex: 3, fingerprint: 'fixture-align-3', tableAlignment: 'center' }
    - { tableIndex: 4, fingerprint: 'fixture-align-4', tableAlignment: 'right' }
```

`align-keyless` has no style entry and resolves through the current effective page-to-table alignment mapping. This section—not the active generator—is the alignment fixture oracle. The document/paragraph alignment setting continues to control content flow and supplies the page setting consumed by the shared alignment-flow policy; it never changes cell text alignment. Once every predecessor packet is accepted, add scenario `full`, no variants, as the deterministic composition below; it may not introduce new product semantics.

The `full` manifest is exact:

| Workspace | Included accepted seed definitions |
|---|---|
| A (initially active) | `structure`, `color-integrity`, `geometry`, `table-lifecycle`, `overflow`, `title-row`, `borders`, and `alignment`, plus the A document/config from `palette/valid` |
| B | Only the B document/config from `palette/valid` |
| C | Only the C document/config from `palette/valid` |

All three configs begin valid, distinct, and explicit false-sync so the final smoke can deliberately enable convergence. `full` excludes `malformed-cold`, `malformed-after-valid`, `read-only`, `over-20-read`, `over-20-external`, `file-too-large`, `contributor-read-failure`, `destination-write-failure`, and `remove-partial`; their owning SPEC smokes remain mandatory separately. For `full`, `--workspaces=3` is required. The default `--copies=1` keeps every included template's unnumbered canonical filename/name and `fixtureCopy:1`. Only when `N>1`, `--copies=N` creates N numbered copies of every included document template in its assigned workspace; those copies differ only in filename, frontmatter `name`, `fixtureCopy`, and the derived fixture file ID under this packet's exact rule. It does not duplicate workspace registrations or config files. Unknown workspace counts or any variant are rejected.

**Slice gate:** table rectangles show correct left/center/right placement relative to the wrapper while every column width and all cell `text-align` values remain identical.

### Slice 10.2 — Table submenu interaction

Add Left/Center/Right radio/checkmarked entries under `Table`, using `align_horizontal_left`, `align_horizontal_center`, and `align_horizontal_right`, in the exact group/order from `GUIDANCE.md`. Selecting one dispatches one `OfficeTableMetadataStep`, updates only the target table, marks dirty once, saves once, and shows the active state. Undo/Redo restores exact placement; interleaved text history remains separate.

**Slice gate:** each option passes live rectangle math, menu state, independent Undo/Redo with interleaved text, disk readback, and reopen for two independent tables.

### Slice 10.3 — Geometry and zoom integration

For each alignment, perform internal and both outer-edge resizes from SPEC-03, including the ratified minimum clamps and non-100% zoom. Confirm the exact `OD-009` anchored edge/center and guide rectangles after commit/rebuild without width drift. An oversized table remains reachable by wrapper scrolling and does not acquire inaccessible negative overflow.

**Slice gate:** before/after width arrays are identical across alignment-only changes and preserved across resize/alignment/reopen sequences within one layout pixel.

### Slice 10.4 — Final cross-SPEC regression and documentation

Run the complete Office suite for SPEC-00 through SPEC-10, then the Electron manual matrix for menu, removal, overflow, title row, borders, alignment, resize, colors, structural edits, undo/redo, and save/reopen. SPEC-11 remains responsible for final output artifacts. After acceptance, update only the exact Tables and Office Viewer `PAGE.md` paths listed under Expected Changed Areas.

**Slice gate:** every exact automated command and isolated Electron scenario in this SPEC passes with persisted readback and no live-workspace mutation; final menu composition and all cross-domain/history/emulated-print/geometry invariants hold, and only the two authorized Wiki pages are updated to verified behavior.

## Expected Changed Areas

- `front-matter.ts`
- `officeTableDisplay.ts`
- `officeTableContextMenu.ts`
- `OfficeDocumentPage.css`
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs`
- `fusion-studio-client/e2e/office-table-alignment.spec.ts`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/001-Office_Viewer/PAGE.md`

## Acceptance Criteria

- Each table independently persists the exact Left/Center/Right contract; missing/keyless state inherits the current effective page-to-table alignment mapping.
- Alignment changes only table placement. Column widths, table width, cell text alignment/content, and Markdown remain unchanged.
- Menu state, computed margins/rectangles, parsed frontmatter, and reopen state agree.
- Every alignment selection is one metadata Step/history event with exact Undo/Redo and interleaved-text isolation.
- Selecting the already-active alignment creates no Step/dirty/save effect.
- Internal/outer resize never resets alignment; alignment never resets widths.
- Reference frame, prose wrapping, outer-resize anchoring, and oversized behavior exactly match the Alignment Contract.
- Multiple tables, rebuilds, structural edits, zoom, print, and save/reopen pass.
- The `alignment` fixture encodes only ratified `OD-009`; `full` composes only accepted predecessor definitions and remains deterministic.
- All `metadata.tables`, `metadata.tableColors`, other `tableStyles` fields, and unknown frontmatter remain intact.
- No floating/wrapping/indent controls or cell DOM writes are introduced.
- The page-alignment flow policy is reusable, but SPEC-10 activates only tables;
  dividers, images, code blocks, and other future consumers remain unchanged.

## Exact Validation

From `fusion-studio-server/`, run the cumulative palette/config gate:

```bash
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js
```

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/lib/front-matter.ts src/components/office/officeTableDisplay.ts src/components/office/officeTableContextMenu.ts e2e/office/fixture-scenarios.mjs e2e/office-table-alignment.spec.ts
node --test e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-table-alignment.spec.ts --project=chromium --workers=1
npx playwright test --config=playwright.office.config.ts e2e/office-*.spec.ts --project=chromium --workers=1
```

The final glob must resolve only to the isolated Office browser suite. Record the expanded test list plus all cumulative Node/Jest files in the worker report. The roadmap is not complete if only the browser glob passes.

## Manual Electron Smoke

Run `node e2e/office/run-isolated-electron.mjs --scenario=full --workspaces=3 --copies=8`. Use the alignment documents for narrow/full/oversized placement and then every other document in the exact manifest above for the complete structure/color/geometry/menu/removal/overflow/title-row/border matrix; use the three valid explicit-false palette configs for enable/add/disable convergence without fault injection; interleave text and Undo/Redo metadata actions; save/reopen. Pass requires exact manifest/copy counts, correct history isolation, positioning, stable widths, usable scrolling, palette convergence/isolation, and no cross-table/domain regression.

## Non-Goals

- Cell text alignment, floating tables, prose wrapping, indentation, page-margin controls, vertical alignment.
- Changing wrapper scroll architecture, width units, versioning, or provenance.

## Worker Handoff

Follow `GUIDANCE.md`. The report must include the complete through-SPEC-10 Office regression plus numeric alignment/outer-drag rectangles and return `READY_FOR_ORCHESTRATOR_REVIEW` or — only for Tier-3 conditions under the run protocol's decision ladder — evidence-backed `BLOCKED`; bank Tier-2 questions via `NEEDS_RULING` in the report file and keep working.
