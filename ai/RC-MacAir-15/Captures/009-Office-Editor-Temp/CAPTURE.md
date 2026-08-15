# CAPTURE — Office Editor Brain Dump

**Date:** 2026-07-10
**Source:** Live session — Office Viewer / Document Editor audit

## Codebase Context (Discovered During Session)

The Office Viewer / Document Editor lives in `~/projects/fs-dev` with 44+ files:

| Area | Details |
|------|---------|
| **Client components** | `fusion-studio-client/src/components/office/` — 19 React files (OfficeGrid, OfficeDocumentPage, OfficeDocumentToolbar, OfficeDocumentTile, etc.) |
| **Editor engine** | Milkdown/Crepe WYSIWYG (`@milkdown/crepe ^7.20.0`) with custom table node view, column resize, color fill, context menus |
| **CSS** | 5 files (OfficeGrid.css, OfficeDocumentPage.css, OfficeDocumentTile.css, document.css, office-viewer.css) |
| **Utilities** | officeThumbnails.ts, officePlainMarkdown.ts, officePaperBrightness.ts, front-matter.ts, milkdown-span-style.ts |
| **State** | officeThumbnailStore.ts (Zustand), viewSlice.ts (panel store), types/index.ts |
| **Electron IPC** | `electron/ipc/document-handlers.cjs` (DOCX/PDF/email export), `electron/export/pdf-engine.cjs` |
| **Server** | thumbnail WS handlers, document-create handler, versioning (Git shadow repo), SQLite migrations |
| **Tests** | workspace-office-thumbnails.test.js, office-viewer-archive-folder.test.js |
| **Existing SPECs** | OFFICE_DOCUMENT_EDITOR_SPEC.md, OFFICE_RECENT_DOCS_SPEC.md, OFFICE_DOCUMENT_VERSIONING_SPEC.md |

---



## Table Behavior: Insert Row Above Bug

Invoking "Insert row above" on the **top row** of a table inserts a **whole extra table** above the current one, rather than inserting a row at the top of the existing table.

**Current behavior:** Creates a new `<table>` element above the current table.  
**Expected behavior:** Inserts a row 0 inside the existing table (shifts all rows down).

**Likely root cause:** The insert-row-above logic in `officeTableContextMenu.ts` or the underlying ProseMirror/Milkdown table plugin may not handle edge case where the cursor is in row index 0 of the current table — it might delegate to an "insert table before" action instead.

**Needs investigation:**
- Does this also happen with "Insert row below" on the bottom row? (suspect no, since bottom row insert is a common path)
- Does the bug reproduce in plain Crepe (without Fusion customizations)?
- Is this in our custom `officeTableNodeView.ts` or in the upstream Milkdown table plugin?

---

## Feature Request: Delete Table Option

We need a **"Delete table"** entry in the right-click table context menu (`officeTableContextMenu.ts`).

### Requirements

- Option appears in the table right-click context menu
- **Confirmation popup** before deletion: "All data inside the table will be lost."
- On confirm: removes the entire table element from the document
- On cancel: no-op, popup closes

### UX Notes

- Should the popup be a modal dialog, a floating confirmation tooltip, or something else?
- Should "Delete table" be grouped with the other destructive actions, or placed separately?
- Do we need an undo step for table deletion?

### Implementation Touch Points

- `officeTableContextMenu.ts` — add menu item
- New component for confirmation popup (or reuse existing pattern)
- ProseMirror transaction to remove the table node

---

## Table Color Metadata: Insert/Delete Row/Column Mismatch

### Problem

Table cell/row/column background colors are stored in frontmatter metadata, keyed by **row and column index**. When a row or column is inserted or deleted, the metadata indices become misaligned:

- **Insert row:** Colors shift down — a row that now has color was originally black, and vice versa.
- **Delete row:** Colors shift up — the wrong rows get colors attached.
- **Insert/delete column:** Same shifting issue on the horizontal axis.
- **Worst case:** Colors appear on completely wrong cells, or disappear entirely.

This makes the color-fill feature unreliable after any structural table edit.

### Required Solution

Before the table re-renders after an insert/delete operation, we must **programmatically recalculate all color metadata** to match the new row/column indices:

1. Determine the insert/delete position and direction (row above/below, column left/right)
2. Read the current color metadata from frontmatter
3. Shift all color indices at or past the insert/delete point
4. Write the corrected metadata back to frontmatter
5. Then allow the re-render

### Implementation Touch Points

- `officeTableColors.ts` — applies colors from metadata to cells
- `officeTableContextMenu.ts` — the insert/delete actions need a pre-render hook
- `front-matter.ts` — `getDocumentTableColors`, `setDocumentTableColors` methods
- Might need a dedicated `reindexTableColors()` utility

### Edge Cases

- Insert row above at row 0: is this the same bug as the "inserts whole table above" issue, or separate?
- Multiple sequential inserts before a re-render
- Mixed row-level and column-level colors (cascade: cell > row > column with rank)
- Undo/redo of insert/delete — does undoing also need to restore old color metadata?

---

## Delete Row: Broken Boundary Behavior

### Bug: Delete Row Below Fails on 2 or Fewer Rows

When a table has 2 rows or fewer, **Delete row below** does not work. Clicking it produces no visible effect (or an error).

### Bug: Delete Row Above Missing on 2 or Fewer Rows

When a table has 2 rows or fewer, **Delete row above** is not present in the context menu at all.

### Likely Root Cause

The context menu builder (`officeTableContextMenu.ts`) conditionally filters out menu items based on row count. Likely has guard logic that hides delete-row-above when at the top boundary, but the condition is too broad — it kicks in for the entire 2-row case rather than only when cursor is in row 0.

Similarly, delete-row-below may silently fail because the underlying ProseMirror transaction rejects deleting the last remaining row (a table must keep at least 1 row), but the error isn't surfaced to the user.

### Possible Fixes

- Allow deletion down to 1 row (any row can be deleted as long as 1 remains). Currently may be gated at 2.
- If the restriction is intentional (table must have at least 2 rows for structural reasons), show a disabled menu item with explanatory tooltip instead of hiding the option.
- Ensure the delete action produces user-visible feedback on failure.

### Implementation Touch Points

- `officeTableContextMenu.ts` — menu item visibility/availability logic
- Underlying ProseMirror table schema — minimum row constraint

---

## Insert Column: Phantom Columns (Metadata Updates but Display Does Not)

### Bug

**Insert column** does not work when the table has a single column. Clicking the option produces no visible change — no new column appears.

However, frontmatter metadata **is** being modified. The color metadata shifts (proving the metadata engine runs), and subsequent delete-column operations revert colors as if phantom columns exist in the metadata that don't appear in the DOM.

### Evidence

- Insert column on single-column table: no visual change
- Colors in frontmatter shift (confirming metadata was modified)
- Delete column reverts colors (metadata modified again)
- Pattern suggests the metadata writes succeed but the ProseMirror table mutation fails silently

### Likely Root Cause

Same class of bug as the insert-row-above and delete-row boundary issues. The ProseMirror table plugin or our custom integration likely has a guard that prevents column insert below a certain column count, but the frontmatter/metadata update fires anyway before the guard rejects the mutation. This creates a **metadata/DOM desync** — the metadata has entries for columns that don't actually exist in the rendered table.

### Possible Fixes

1. Ensure the metadata update only fires AFTER the ProseMirror table mutation succeeds
2. Or: roll back the metadata change if the ProseMirror mutation fails
3. Fix the underlying column boundary guard so single-column tables can receive a second column

### Implementation Touch Points

- `officeTableContextMenu.ts` — the insert column action handler
- `front-matter.ts` — metadata update that fires before/after the table mutation
- ProseMirror table schema — minimum column constraint

### Related Bugs

This is part of a family of boundary bugs:
- Insert row above at top row → whole table (earlier)
- Delete row below fails on ≤2 rows (earlier)
- Delete row above missing on ≤2 rows (earlier)
- Insert column fails on 1 column (this one)
- Likely: delete column boundary issues not yet discovered

### What to Remove

The color picker (`officeColorPopover.tsx`) currently has a "Document colors" section that scrapes hex colors visible in the current document and injects them as swatches. Remove this entirely.

### What to Keep

Only the **Custom colors** section — the user-defined palette (currently likely localStorage-based). The sections should be: None / Google palette (static) / Custom (user).

### Rationale

Per-document colors are noisy, unpredictable, and don't scale. User-defined custom colors are the intentional, curated palette.

---

## New Custom Color Config System (Workspace-Local + Sync)

### Concept

Custom colors should live in a **config file per workspace** (not per-document frontmatter, not localStorage). This mirrors the existing pattern where CSS files in the `ai/` folder are scooped up by the server.

Each workspace gets a dedicated config file in a well-known path:
```
ai/<machine>/System/config/colors.json
```

### The Config File

```json
{
  "custom_colors": ["#FF6B35", "#004E89", "#1A936F", ...],
  "sync_enabled": true
}
```

### Color Picker UI: Sync Toggle

In the custom color picker popover, beneath the custom color swatches, add a row:

```
[ sync_icon / sync_disabled_icon ]  Sync Enabled / Sync Disabled
```

- Shows a Material Icon (`sync` or `sync_disabled`)
- Label reads "Sync Enabled" or "Sync Disabled"
- Click to toggle

### Sync Behavior

| Transition | Behavior |
|---|---|
| **`sync_enabled: false → true`** | 1. Merge this workspace's custom colors into all other synced configs 2. Pull other synced custom colors into this config. Result: all synced workspaces share the same unified palette. |
| **`sync_enabled: true → false`** | Flip flag to false. All current custom colors remain in this config. No further sync. |

### What "Sync" Means

- Server reads all workspace configs where `sync_enabled: true`
- Merged palette = union of all custom_colors from all synced workspaces (deduplicated)
- Each synced workspace's config gets the merged palette written back
- Non-synced workspaces keep their independent custom_colors list

### Implementation Touch Points

- `officeColorPopover.tsx` — remove "Document colors" section, add sync toggle row
- New server-side module for reading/writing color configs (similar to CSS scoop pattern)
- Config file path convention: `ai/<machine>/System/config/colors.json`
- Sync merge logic (deduplication, union merge)
- Workspace config watcher (like the CSS watcher, so changes propagate)
- `front-matter.ts` — verify no lingering per-document color scrape references

---

## Column Resize: Preserve Table Width on Internal Borders

### Problem

Currently, dragging a vertical column border resizes the table width. The table expands or contracts as the user drags. This makes column adjustments messy — the table doesn't stay where it was in the document layout.

### Expected Behavior

- **Dragging an internal column border:** The table total width remains unchanged. Only the two adjacent columns are affected — one gains width, the other loses an equal amount.
- **Dragging the outer edge (leftmost or rightmost border of the table):** Only that outer column changes width. The table width changes, but all other columns remain the same.

### Example

A 3-column table with equal widths (33% / 33% / 33%). User grabs the center column border and drags right:
- Column 1: 33% → 40%
- Column 2: 33% → 26%
- Column 3: 33% → 33% (unchanged)
- Table total: still 100%

### Rules

1. Identify whether the dragged border is internal (between two columns) or external (left edge of col 0 or right edge of last col)
2. If internal: only modify the two adjacent columns. The delta added to one must equal the delta subtracted from the other.
3. If external: resize the outer column + shift the entire table width (current behavior).
4. Constraint: no column should shrink below a minimum width (e.g. 30px). If the drag would violate this, clamp to the minimum.

### Implementation Touch Points

- `officeTableGeometry.ts` — the column-width resize logic. Likely has a `handleMouseMove` or similar that currently adjusts column widths without the internal-vs-external distinction.
- Frontmatter serialization (`front-matter.ts`) — column widths are persisted in table layout metadata. The resize already writes back; this change just modifies what gets written.

### Edge Cases

- Drag past the minimum column width: clamp, table width preserved.
- Drag past the point where the adjacent column would reach minimum: clamp, stop moving the border.
- Single-column table: no internal borders exist, only outer edges. All drags change table width.
- Column width set in px vs %: internal drags should work the same either way (redistribute between the two columns).
- Undo: undoing a column resize should restore the two affected column widths, not the full table layout.

---

## Table Cell Overflow: Default to Truncate with Ellipsis

### Default Behavior

By default, table cells should NOT grow in height when content exceeds cell width. Instead:

```css
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
```

Content clips at the cell boundary. Excess text gets an ellipsis ("…"). Cell height stays fixed regardless of content length.

### Context Menu: Overflow Mode Selector

Add a new item in the table right-click context menu, placed at the top with a divider below it. Uses a nested sub-menu pattern: the top item shows the current mode, clicking opens a sub-menu with all options.

```
format_text_overflow   Overflow              chevron_forward   ← current mode
───────────────────────────────────────────────────────────────
Fit width              Truncate              chevron_forward
subdirectory_arrow_right  New line            chevron_forward
```

| Mode | CSS Behavior | CSS Concept Alignment |
|------|-------------|----------------------|
| **Overflow** (default) | `overflow: hidden; white-space: nowrap;` | Maps to CSS `overflow: hidden` — text overflows the cell boundary and gets clipped. No ellipsis. Cell height fixed. |
| **Truncate** | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` | "Truncation" is the CSS spec term for `text-overflow: ellipsis`. Text clipped at boundary with "...". Cell height fixed. |
| **New line** | `white-space: normal; word-wrap: break-word; overflow: visible;` | Standard text wrapping. Cell height grows to fit content. |

### Implementation Details

- Overflow mode is **table-wide**, not per-cell. Stored in table's frontmatter metadata.
- Default: `"overflow"` for new tables. Existing tables without the key also default to overflow.
- On mode change: update all cells (apply/remove CSS classes on `<td>` elements).
- Frontmatter key: `tableOverflow` with values `"overflow"`, `"truncate"`, `"newline"`.

### Implementation Touch Points

- `officeTableContextMenu.ts` — add overflow sub-menu at top with divider
- `front-matter.ts` — add `tableOverflow` to table layout metadata
- CSS injection or class-based styling on table cells
- `officeTableColors.ts` or a new module — apply overflow mode to cells on render

### Edge Cases

- Mixed overflow modes per-table? No — table-wide setting only.
- What if content has explicit line breaks (`<br>`, newlines) in Truncate mode? `white-space: nowrap` forces single line. Line breaks become spaces.
- Fit text mode: what's the algorithm? Scale font down incrementally until it fits? Set a fixed smaller size? Needs SPEC decision.
- Transitioning from New line to Overflow/Truncate: content that expanded the cell height will be clipped. Cell height stays at whatever it was until next render — may need to reset row height.

---

## Icon Inconsistency: Context Menu Plus Icons

One of the plus icons in the table right-click context menu does not match the others. Needs to be swapped to match.

### Likely Location

Either `officeInsertMenu.ts` (insert row/column/table options) or `officeTableContextMenu.ts`. One icon uses a different Material Symbol variant (e.g. filled vs outlined, or wrong icon name) than the rest of the menu.

---

## Table Context Menu Restructure

Replace the current table right-click context menu with a top-level **Table** menu item (`table_edit` icon, right chevron) that opens a sub-menu with the following structure:

```
table_edit  Table                      chevron_right
│
├── variable_add / variable_remove     Add / Remove header
├── variable_add / variable_remove     Add / Remove footer
│   ─────────────────────────────────────────────────
├── border_all                         Border size
├── border_all                         Border color    → opens color picker
│   ─────────────────────────────────────────────────
├── align_horizontal_left              Align table left
├── align_horizontal_center            Align table center
├── align_horizontal_right             Align table right
│   ─────────────────────────────────────────────────
├── format_text_overflow               Overflow        chevron_right
├── Fit width                          Truncate        chevron_right
├── subdirectory_arrow_right           New line        chevron_right
│   ─────────────────────────────────────────────────
└── delete                             Remove table
```

### Section Breakdown

| Group | Items | Behavior |
|-------|-------|----------|
| **Header / Footer** | Add/Remove header, Add/Remove footer | Toggle — icon changes between `variable_add` and `variable_remove` based on current state. Header = first row styled distinctively. Footer = last row. |
| **Borders** | Border size, Border color | Size: selectable thickness. Color: opens existing color popover. If color is "none": fall back to light grey dotted lines. |
| **Alignment** | Left, Center, Right | Aligns the entire table horizontally within the document. Radio-style — one active at a time. |
| **Overflow** | Overflow, Truncate, New line | Current mode shown at top of sub-menu with chevron. Selecting another mode updates the table-wide setting. (As previously specified.) |
| **Remove** | Remove table | Destructive action. Opens confirmation popup before deleting. |

### Border Color: "None" → Light Grey Dotted Lines

When the user selects "none" (or no color) for border color, table borders render as light grey dotted lines instead of being invisible. This provides a subtle visual grid even without explicit borders.

CSS: `border: 1px dotted #ccc;` (or similar light grey)

### Implementation Notes

- The existing insert row/column context menu items stay as-is (they trigger on cell right-click within the table). The new Table sub-menu is for table-wide settings.
- This restructure replaces the standalone "Delete table" item (now under Table > Remove table) and the overflow sub-menu (now nested under Table). Both still exist — just reorganized.
- Border color uses the same color popover component from `officeColorPopover.tsx`.
- Border size: needs a set of predefined values (e.g., none, 1px, 2px, 3px, 4px). Could use a sub-menu with radio options.

### Implementation Touch Points

- `officeTableContextMenu.ts` — rewrite the menu structure to add the top-level Table item and sub-menu
- `officeColorPopover.tsx` — border color option uses this
- `front-matter.ts` — persist header/footer state, border size, border color, table alignment
- CSS injection — apply border styles and alignment to the table element
- Confirmation popup — reuse pattern from the "Delete table" requirement
