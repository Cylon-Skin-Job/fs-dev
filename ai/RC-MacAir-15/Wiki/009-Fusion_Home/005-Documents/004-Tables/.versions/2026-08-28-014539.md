---
name: "Tables: Structure, Lifecycle, Node View, Resize, Alignment, Overflow, Borders, and Background Colors"
description: Technical reference for Office tables - atomic whole-table insertion/removal, reliable adjacent row/column commands, the custom ProseMirror table node view, column resize, wrapper-relative table alignment, table-wide overflow, layout-neutral table borders, and cell/row/column background colors. Read this before changing table structure, lifecycle, rendering, resize, alignment, overflow, borders, or coloring.
metadata:
  incoming-edges:
    - Document Editing Within Office View
  outgoing-edges:
    - Lessons
    - Markdown Frontmatter Model
  source-files:
    - fusion-studio-client/src/components/office/officeTableNodeView.ts
    - fusion-studio-client/src/components/office/officeTableGeometry.ts
    - fusion-studio-client/src/components/office/officeTableColors.ts
    - fusion-studio-client/src/components/office/officeTableColorPolicy.ts
    - fusion-studio-client/src/components/office/officeTableColorRender.ts
    - fusion-studio-client/src/components/office/officeColorPopover.ts
    - fusion-studio-client/src/state/officePaletteStore.ts
    - fusion-studio-client/src/lib/ws/office-palette-handlers.ts
    - fusion-studio-server/lib/office/palette-service.js
    - fusion-studio-server/lib/office/palette-paths.js
    - fusion-studio-server/lib/ws/office-palette-handlers.js
    - fusion-studio-client/src/components/office/officeTableContextMenu.ts
    - fusion-studio-client/src/components/office/officeTableConfirmDialog.ts
    - fusion-studio-client/src/components/office/officeInsertMenu.ts
    - fusion-studio-client/src/components/office/officeTableInsertion.ts
    - fusion-studio-client/src/components/office/officeTableMutations.ts
    - fusion-studio-client/src/components/office/officeTableRemoval.ts
    - fusion-studio-client/src/components/office/officeTableHistory.ts
    - fusion-studio-client/src/components/office/officeTableIdentity.ts
    - fusion-studio-client/src/components/office/officeTableDisplay.ts
    - fusion-studio-client/src/components/office/officeTableHardbreak.ts
    - fusion-studio-client/src/components/office/officeTableBreakCodec.ts
    - fusion-studio-client/src/components/office/officeTableTitleCodec.ts
    - fusion-studio-client/src/components/office/officeTableOverflowProjection.ts
    - fusion-studio-client/src/components/office/officeTableBorderProjection.ts
    - fusion-studio-client/src/lib/front-matter.ts
  connected-skills: []
  related-trigger-files: []
---

This is the **technical reference** for tables in the Office document editor. For the editor overview, see [Documents](../PAGE.md); for the traps behind these decisions, see [Lessons](../../000-Fusion_Home/001-Lessons/PAGE.md).

Everything here follows one rule: **never write into ProseMirror's editable
content DOM** (the `<td>`/`<th>` cells). Table adornments touch only table chrome
(`<table>`, `<colgroup>`) or live entirely outside the editor (overlay /
injected stylesheet).

## Table Node View

`officeTableNodeView.ts` replaces Crepe's stock table rendering while keeping
Milkdown's table schema and row/column commands. Its DOM is:

```text
div.rv-office-table-block
  div.rv-office-table-wrapper
    table.rv-office-table
      colgroup            (baked in, outside contentDOM)
      tbody.content-dom   (contentDOM — ProseMirror-owned)
```

Two decisions matter:

- The `<colgroup>` is created in the node view constructor and its `<col>` count
  is synced to the table's column count. It is part of the table from birth, so
  ProseMirror treats it as chrome rather than a foreign element bolted on later.
- `ignoreMutation` returns `true` for **all** attribute mutations. The geometry,
  color, and display layers write styles/attributes onto table chrome; the node
  view must ignore them, or ProseMirror rebuilds the table on every write (a
  self-sustaining rebuild loop).

## Column Resize

`officeTableGeometry.ts` handles column width only. Row heights are intentionally
not resizable — rows size to their content.

- An N-column table has N+1 logical overlay boundaries: two outer edges and
  N-1 internal edges. Logical width comes from `TableMap`/the baked colgroup,
  so a physically spanning header does not remove column definitions or resize
  boundaries.
- An internal drag redistributes one integer layout-pixel delta between only
  its adjacent columns and preserves total width. An outer drag changes only
  the outer column and total table width. The client delta is divided by the
  drag-start table scale, and the minimum and scale are frozen for that gesture.
- The frozen column minimum is the square minimum sampled from the first
  regular cell in the first data row, never a header/title cell:
  `ceil(max(computed min-height, used line-height + block padding))`. A
  `line-height: normal` or non-pixel used value is resolved with a short-lived
  Office-owned offscreen probe under `document.body`, outside ProseMirror.
  Invalid/non-positive samples cancel without a commit.
- Canonical cells use `border-box`, `0.25ch` padding on each inline side, and a
  matching automatic height floor. The visible 1px grid is inset paint with no
  layout border, so presentation stroke is absent from the minimum. A one-line
  cell at the clamp is square; multiline content may increase row height but
  cannot increase the frozen column minimum. No row height is saved.
- Resize handles live in a body-level overlay (`.rv-office-table-overlay`,
  `position: fixed`, `pointer-events: none`). Each column line gets a full-height
  invisible grab strip (`.rv-office-col-grab`) positioned in viewport coordinates
  from `getBoundingClientRect`, carrying the `col-resize` cursor and a dashed
  guide.
- Dragging moves **only** the overlay guide. The table is not touched during the
  drag.
- On release, the new width is written once to the `<colgroup>`'s `<col>`
  elements (with `table-layout: fixed`) through one metadata history Step and
  persisted to `metadata.tables`. Cancellation, lost capture, a disconnected
  target, and zero-effective movement clean up without a Step, dirty mark, or
  save.
- For narrower tables, outer resize reapplies the selected wrapper-relative
  alignment after committing widths: Left preserves the left edge, Right the
  right edge, and Center the center. Both outer handles preview the resulting
  aligned rectangle. At or above wrapper width, the scroll origin remains
  reachable and the stored alignment remains active. No position/offset field
  is stored, and internal or outer resize never resets alignment.
- A `MutationObserver` re-applies saved widths after ProseMirror rebuilds a
  table. Because it only writes attributes (which the node view ignores), it
  cannot feed a rebuild loop.

## Table Menu and Row/Column Structure Commands

The table context menu keeps the adjacent Insert/Delete Row and Insert/Delete
Column actions in the root. Its nested **Table** submenu contains **Add title
row**; **Border size** and **Border color**; the one radio group **Align table
left**, **Align table center**, and **Align table right**; **Overflow**; and
**Remove table**, with a divider between those groups.
Pointer movement opens the submenu without moving the editor selection.
Up/Down, Right or Enter/Space, Left, and Escape preserve the nested-menu focus
contract, including restoring the exact invoking editor selection when the
stack closes.

A successful row or column action is preflighted against a proposed ProseMirror
transaction, verified to change exactly one target dimension by one, and
dispatched once. That same history event carries the matching color, width, and
table-style identity snapshots; native Undo/Redo therefore restores the table
content and renderer metadata together.

The structural invariants are:

- A table keeps one schema header row, at least one data row, and at least one
  column.
- Inserting above row 0 creates a blank header and converts the former header
  into the first data row inside the same table. It does not create a second
  Markdown table.
- Deleting a header promotes the immediately following physical row, preserving
  its content and cell shape. It is unavailable if promotion would leave no
  data row.
- Inserting beside the only column performs the visible one-to-two-column
  transition. Adjacent column deletion remains available until one column is
  left.
- Boundary-invalid actions remain visible but disabled, with an explanation.
  A rejected or forced no-op click leaves the document, all frontmatter, dirty
  state, and save traffic unchanged.

Row and column changes reindex exact `tableColors` coordinates. Present width
arrays insert a copy of the selected anchor width or remove the exact deleted
slot; absent layout entries are not invented. Successful changes refresh the
shared table identity across widths, colors, and present `tableStyles` while
preserving unknown metadata and style fields. Save/reopen serializes one valid
GFM table and restores the same dimensions, content, widths, colors, display
mode, and identity on first render.

## Table Title Rows

The Table submenu always begins with **Add title row**. The command is disabled
whenever physical row 0 has one cell, including a one-column table and an
existing title. On an ordinary multi-column table it inserts one blank editable
header cell spanning the complete logical `TableMap` width, demotes the former
header to the first data row, and places the caret in the new title. The
structure change and the literal `metadata.tableStyles[].titleRow: true` marker
share one `OfficeTableMetadataStep`, native history event, publication, and save
while preserving widths, colors, overflow, unknown fields, and sibling tables.

When the context menu opens on a verified title, **Add title row**, **Insert Row
Above**, **Delete Row Above**, and all adjacent column insert/delete actions stay
visible but disabled without explanation text. One title-context-only **Delete
Row** appears in the root delete group immediately before **Delete Row Above**.
It removes row 0 only when at least three physical rows exist, promotes the
immediate next row to the schema header, clears only the title marker, and keeps
one data row. Outside a verified title context, that exact **Delete Row** item is
absent. Ordinary and quarantined tables continue to use the adjacent header
promotion protocol.

Markdown remains valid GFM. Saving a verified N-column title writes an N-cell
header surrogate: cell 0 contains the title, cells 1 through N-1 are empty, the
delimiter alignments come from the demoted logical header, and that former
header is the first data row. Before `crepe.create()` and the first visible
editor frame, literal `titleRow: true` rehydrates a safe surrogate with at least
three physical rows into one `<th colspan="N">`. Reopen does not create history,
dirty state, a save, or a frontmatter rewrite, and a second serialization is
stable.

A marked surrogate fails closed when continuation header cells contain content,
the logical width or table shape is unsafe, or fewer than three physical rows
exist. Its complete ordinary header/content stays lossless and the table enters
local stale quarantine with a nonfatal diagnostic; shape changes alone cannot
silently reactivate it. A row/column structural edit or a row-0 content edit
clears the stale marker in that same history event, while outside-row-0 content
and presentation edits preserve it. Explicit **Add title row** losslessly
demotes the stale header and replaces the marker with literal true. Undo/Redo
restores the exact structure, marker/quarantine, diagnostic, metadata, and
selection.

Title geometry remains logical-grid based: an N-column title retains N
`<colgroup>` columns and N+1 resize boundaries, and its used width equals the
sum of the N logical columns. Cell Background still targets physical/logical
`(0,0)` and Column Background still targets logical column 0; covered title
columns do not fabricate cells or color bands. Column mutations update the
title colspan and retain the marker even at logical width one. These effects use
table chrome, schema transactions, and injected stylesheets; no controller
writes classes, styles, data attributes, or replacement nodes into editable
`<th>`, `<td>`, or `<tr>` DOM.

## Whole-Table Insertion and Removal

Opening the Insert menu, moving over its grid, opening the table submenu, and
opening or dismissing the Remove Table confirmation are complete no-ops for the
document, metadata, dirty state, save traffic, and persisted bytes. The
right-click target is captured without dispatching a selection transaction.
Remove Table opens an Office-owned body-level modal. Cancel and Escape close it
and restore the exact invoking focus/selection without changing the document;
outside interaction leaves the modal open and does not change its focus or any
editor state.

An accepted whole-table insertion or removal is one verified composite
ProseMirror transaction and one native history event:

- Insertion first captures the intended top-level document position from the
  actual pointer coordinate, including visible whitespace between blocks where
  the event target is the editor root. It then intercepts the stock table
  command and verifies that it proposes exactly one table with the chosen
  dimensions while every existing table remains in order. Existing
  `metadata.tables`, `metadata.tableColors`, and present `metadata.tableStyles`
  identities at and after the insertion index shift by one. The new blank table
  receives no phantom entry in any collection.
- Removal captures the exact table at invocation, revalidates that target at
  confirmation, and verifies that the proposed transaction removes only that
  table. Its entries are removed from every present table-scoped collection and
  all later identities shift down. Selection resolves deterministically to a
  valid nearby text position/block rather than remaining in deleted content.
- A stale target, rejected command, invalid proposal, or unavailable metadata
  is a complete no-op. No partial document or frontmatter change is published.
- The verified document steps and one `OfficeTableMetadataStep` dispatch
  together. Forward, Undo, and Redo each publish metadata once, mark dirty once,
  and schedule one normal save.

Insertion before, between, and after existing tables and removal of the first,
middle, and last table therefore keep widths, colors, opaque `tableStyles`
values, unknown frontmatter, and surviving table fingerprints attached to the
same logical tables. Save/reopen restores the same table order and collection
mapping.

## Table Overflow Modes

`officeTableDisplay.ts` gives each table one table-wide mode through
**Table > Overflow**:

- **Overflow** (`overflow`) is the default for new tables, keyless tables, and
  missing or invalid stored values. Cell paragraphs stay on one constrained
  visual line and clip without an ellipsis.
- **Truncate** (`truncate`) keeps the same constrained one-line layout and
  shows an ellipsis when content exceeds the column.
- **New line** (`newline`) keeps explicit breaks and permits ordinary wrapping
  within the constrained column.

The baked `<colgroup>` remains authoritative. Tables with stored column widths
keep the table width equal to their column sum; fixed layout prevents long cell
content from expanding a column. A geometry-keyless table remains constrained
by its current wrapper width, and choosing an overflow mode does not create a
width entry.

Canonical table-cell `<br>` content is semantic Markdown, not presentation
metadata. The Office table-cell codec parses it as one explicit hardbreak node
and saves it canonically as `<br>`. A stable hardbreak node view always retains
the same wrapper and child `<br>`. Overflow and Truncate hide that child and
present one normal collapsible U+0020 space, so both segments remain on one
line; New line exposes the native break. Switching modes changes only the
table's display metadata and table-chrome selector. It does not rewrite cell
content, create replacement nodes, or set/persist row heights.

The selected mode is stored in `metadata.tableStyles`, participates in the
same native metadata history event as the menu action, and survives structural
identity changes, editor rebuilds, save, and reopen. Its output projection is
described below.

## Table Presentation In Output

Office PDF/DOCX download, PDF/DOCX email attachment, and Preview/Print bind one
immutable body-Markdown snapshot to one normalized table-presentation
descriptor. The descriptor contains document/table source hashes, logical
widths, optional column widths, overflow, verified title state, and normalized
border width/color. It is an optional IPC mode used only by Office: if either
member of the exact mode/descriptor pair is missing, malformed, or does not
match the Markdown source and converter semantics, output fails without legacy
fallback. Saved Markdown remains the GFM surrogate plus Office frontmatter.

PDF and Preview/Print share one presentation transform. They honor selected
column widths and the current table overflow mode: Overflow remains one clipped
line without an ellipsis, Truncate remains one line with an ellipsis, and New
line permits wrapping and preserves native hardbreaks. DOCX uses the same bound
source and presentation metadata but deliberately retains full reflowable cell
content rather than clipping or truncating it.

A safe marked title surrogate becomes one full-width title cell in PDF and
DOCX. A stale or unsafe title marker is not merged, so continuation content is
never lost. Real and Default borders emit the normalized numeric width and
color on all required table edges. Explicit None remains a dotted guide only
inside the editor and emits no border in PDF, Preview/Print, or DOCX. Table
alignment and cell-background export are not part of this output projection.

## Table Borders

Every table has one effective editor border width and color. **Table > Border
size** offers exactly 1px, 2px, 3px, and 4px. **Table > Border color** reuses
the Office color picker: a Google or workspace Custom swatch stores a lowercase
hex color, while **None** stores explicit YAML null. Missing or invalid width
defaults to 1px; missing or invalid color is **Default**. Default and real color
paint a solid grid. None paints a dotted `#ccc` editor guide at the retained
width and paints no border in print/output media. Choosing None never resets
the width, and choosing a width never changes the effective color.

Border paint is table chrome, not document structure. The renderer sets
table-owned CSS variables and data attributes, while absolute cell
pseudo-elements draw each internal and outer edge exactly once. It never writes
border classes, styles, data attributes, or replacement nodes on editable
`<th>`, `<td>`, or `<tr>` DOM. Border width therefore does not change column
widths, row heights, the square resize minimum, title colspan, overflow,
alignment, backgrounds, or any other used geometry.

Direct border edits use the same verified table identity and one
`OfficeTableMetadataStep` path as other table presentation actions. A stored
canonical selection is a true no-op. An accepted change publishes and saves
once, participates in native Undo/Redo, and preserves width/color siblings,
title, overflow, alignment, unknown style fields, width arrays, background
coordinates, and unrelated tables. Resize, row/column structure changes,
title-row add/delete, editor rebuild, save, and reopen all retain the border on
the same logical table.

`officeTableBorderProjection.ts` is the pure downstream projection boundary.
For each live table, in document order, it emits exactly
`{ borderWidth, borderColor }`, where the width is 1–4 and the color is a
lowercase hex, explicit null, or the string `default`. It rematches stored
identity against the live table structure, does not mutate input, and exposes
no table index, fingerprint, title, overflow, alignment, unknown style field,
IPC, export, or output behavior.

## Table Alignment

Every table resolves one effective wrapper-relative placement from
`metadata.tableStyles[].tableAlignment`:

- **Left** (`left`) sets logical start margin `0` and end margin `auto`.
- **Center** (`center`) sets both logical margins to `auto`.
- **Right** (`right`) sets logical start margin `auto` and end margin `0`.

Missing, keyless, or invalid values resolve from the current effective page
alignment in memory without an eager frontmatter rewrite. Page Left maps to
table Left, page Center to table Center, page Right to table Right, and page
Justify to table Center. The three Table-submenu choices use
`align_horizontal_left`, `align_horizontal_center`, and
`align_horizontal_right`, expose the effective choice as one radio group, and
use the same verified live-table target as other table presentation actions.
Selecting an already-effective value is a complete no-op. An effective change
updates only the target style entry through one `OfficeTableMetadataStep`, one
native history event, one renderer publication, and the normal save path.

Page alignment uses a consumer-neutral effective-value flow policy that is
wired to tables only. For each page action, every table whose current effective
value equals the old effective page value moves to the new effective value in
the same metadata Step, publication, dirty mark, save, Undo, and Redo unit.
Tables with a different value remain pinned. Pinning has no stored flag or
rank: equality with a later page value automatically rejoins flow. Therefore
Center↔Justify changes no table-style value, Left→Justify moves Left followers
to Center, Justify→Right moves Center followers to Right, and leaving effective
Center for Left or Right moves every effective-Center follower. Missing,
invalid, and keyless storage stays untouched while its effective value follows
the page dynamically.

Alignment applies only to `<table>` chrome. It does not change column widths,
total table width, cell text alignment or content, Markdown, prose flow,
backgrounds, overflow, title markers, borders, sibling tables, or unknown
frontmatter. It never floats or wraps prose around a table and stores no
position or offset. Rebuild, structure edits, duplicate-header siblings,
resize, non-100% editor zoom, Undo/Redo, save, and reopen preserve the selected
table's placement independently.

For a table narrower than its wrapper, outer resize preserves the selected
left edge, center, or right edge after the width commit; internal resize keeps
the existing total. Alignment-only changes preserve the exact committed width
array. A table at or wider than the wrapper may make the three choices visually
indistinguishable, but the stored state remains active and horizontal scrolling
can still reach both the origin and the far edge.

## Table Background Colors

`officeTableColors.ts` connects the context menu and metadata Step to the pure
decisions in `officeTableColorPolicy.ts`. `officeTableColorRender.ts` resolves
the stored rules and produces the injected stylesheet. The Cell / Row / Column
Background controls all use this one model.

The visible fill of cell `(r, c)` resolves in this order:

1. An explicit cell hex or explicit `none` mask wins.
2. Otherwise, the covering row or column with the higher `rank` wins. An
   equal-rank tie resolves to the row.
3. Otherwise, the cell has no fill.

A cell paint normally writes that explicit hex. If the chosen color already
matches the winning band, a stale cell entry is deleted because it is
redundant. If it matches a losing band, that band is moved to `max(rank) + 1`
instead of adding a cell entry only when no other cell's visible fill would
change; otherwise the action safely falls back to one explicit cell.

A row or column paint deletes every explicit cell entry on that entire band,
then writes the band color at `max(rank) + 1`. This makes the most recent band
action win crossings without retaining conflicting cell bytes.

Cell **None** writes the explicit string `'none'` when a row or column still
covers the cell; an uncovered cell needs no mask, so its explicit entry is
deleted. Row/Column **None** deletes the selected band and deletes its explicit
cells, except that each crossing with a surviving opposite band receives an
explicit `'none'` mask. The scalar is serialized exactly with single quotes,
never as YAML null or unquoted `none`.

Each Cell / Row / Column set or clear is one `OfficeTableMetadataStep` in the
native ProseMirror history event. Undo restores the exact previous maps, ranks,
and visible cascade; Redo restores the selected result. Ordinary text history
events carry no color snapshot. Forward, Undo, and Redo each publish once, mark
the document dirty once, and schedule one normal save. Selecting an already
effective value or clearing an absent rule is a true no-op only when the target
table also needs no metadata cleanup.

Color-coordinate maintenance is deterministic. Inserting at index `i` shifts
rules at and after `i`; the inserted row or column starts without explicit
rules and inherits the normal cascade. Deleting at `i` removes rules on that
index and shifts later rules down. The transform covers cell coordinates plus
the matching row or column map without changing ranks or the unaffected axis.

Malformed, noncanonical, negative, and out-of-range rules never render and are
not rewritten on open, rebuild, or an unrelated text save. A legacy row or
column without `rank` renders as rank 0. The next successful structure or
direct-color commit on that table prunes invalid rules against the verified
next-state dimensions and writes every rank-less band on that target as
explicit rank 0 inside the same metadata Step. Empty maps and entries are
removed. Undo restores the exact pre-cleanup values; other tables are left
untouched.

Colors are **applied through an injected stylesheet, never onto the cells**. The
controller tags each `<table>` with a `data-rv-tid` attribute (table chrome) and
emits one CSS rule per resolved cell into a `<style>` element:

```css
[data-rv-tid="…"] > tbody > tr:nth-child(R) > :nth-child(C) { background-color: … !important; }
```

The picker popover is file-backed and ordered as **None**, the 80-color
**Google palette**, the always-visible **Sync** control, and **Custom** colors.
The active workspace's `ai/<machine>/System/config/colors.json` is the selector
and contains `sync_enabled` plus its complete local ordered list. When
`sync_enabled` is `false`, that local file is the selected palette. When it is
`true`, the selected palette is the single machine-global
`System_Manager/global-configs/office-custom-color-pallete/colors.json` file.
No union, fanout, or cross-workspace convergence occurs.

The picker shows only the first 20 selected colors while the complete ordered
list remains on disk. Entries after 20 stay latent and promote into view as
earlier colors are removed. The `+` action is present only when that complete
normalized list has fewer than 20 colors. A custom swatch exposes one nearby
**Remove** action on right-click; removing a palette entry never changes fills
already stored in table metadata.

Adding or removing a custom color is one acknowledged server mutation against
only the currently selected file. Success from Add both saves the color and
applies it to the table captured when Add began through the same metadata Step
used by other table-color actions. Failure or a stale table target does not fill
the document. A Sync toggle writes only the local file's `sync_enabled` value,
preserves both local and global arrays byte-for-byte, and immediately projects
the newly selected array. Open, workspace switch, reconnect, and refresh each
read the selector and selected file once; external file edits do not push live
updates. Selected-source read or write failures surface an error and do not
overwrite either file. Legacy localStorage palette bytes and document-color
scraping are not read, migrated, or cleared by the active picker.

## Persisted Frontmatter

Column widths, colors, and table-wide display styles are sibling structures
under `metadata`, so each controller merge preserves the other siblings and
unknown metadata:

```yaml
metadata:
  tables:
    - tableIndex: 0
      fingerprint: table-abc123
      columns: [180, 260, 140]
  tableColors:
    - tableIndex: 0
      fingerprint: table-abc123
      cells: { '0,1': '#ffe08a', '2,0': 'none' }
      rows: { '2': { color: '#d6ebff', rank: 5 } }
      columns: { '0': { color: '#ffd6d6', rank: 3 } }
  tableStyles:
    - tableIndex: 0
      fingerprint: table-abc123
      tableOverflow: overflow
      tableAlignment: right
      borderWidth: 4
      borderColor: '#4a86e8'
```

Entries are matched to live tables by `tableIndex` and `fingerprint`
(`front-matter.ts`). Markdown table content stays plain Markdown; renderer-owned
display geometry, color, and style live in the three sibling collections.
`metadata.tableStyles` is owned by the table-display controller for overflow,
title, border, and alignment fields. Sequential edits publish the
exact renderer metadata synchronously before paint; disk persistence follows
through the single normal scheduled save. A full page reload or fresh
application process rehydrates the acknowledged disk bytes without
double-shifting coordinates or changing sibling collections, unknown
frontmatter values, or Markdown table content.
