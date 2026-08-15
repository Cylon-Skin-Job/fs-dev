# ISSUES — Office Editor Questions to Resolve

Unresolved questions that need decisions before implementation.

---

## Insert Row Above Bug

- [ ] Does "Insert row below" on the bottom row also exhibit a similar bug (inserting a table below)?
- [ ] Is the bug in our custom code (`officeTableContextMenu.ts`, `officeTableNodeView.ts`) or upstream in Crepe/Milkdown?
- [ ] If upstream, do we fix via a patch or workaround?
- [ ] Are there other row/column boundary edge cases that are broken?

## Delete Table Feature

- [ ] Confirmation popup style: modal dialog, floating tooltip, inline confirmation bar, or something else? (Check if there's an existing popup pattern in Fusion Studio to reuse.)
- [ ] Keyboard shortcut for "Delete table"? (e.g., could intercept Backspace when entire table is selected)
- [ ] Should "Delete table" be undoable? If so, how does the undo stack interact with the table node removal?
- [ ] Where should "Delete table" be positioned in the context menu? (At the bottom as a destructive action, or grouped with other table operations?)
- [ ] Should the confirmation include a count of rows/cells being deleted? ("Delete table with 3 rows and 12 cells?")
- [ ] Any accessibility considerations for the confirmation popup? (focus trap, aria, keyboard dismiss)

## Table Color Metadata Recalculation

- [ ] Should the color reindex happen at the ProseMirror transaction level (before the dom change) or at the Milkdown plugin level (before re-render)?
- [ ] How does the undo stack interact with a corrected color metadata? Does undoing an insert need to restore the pre-insert color indices?
- [ ] Is the "insert row above at row 0 inserts whole table" bug related to color metadata manipulation, or a separate table node issue?
- [ ] Do column-level colors have the same shift problem, or does column insert/delete work differently under the hood?
- [ ] Should we also handle the reverse: when a user removes a color fill, should we clean up orphaned metadata entries?
- [ ] Unit test strategy: how do we simulate insert/delete operations and verify the corrected metadata?
- [ ] Is there a case where multiple colors overlap on the same cell after a shift (cell-level + row-level + column-level cascade)? How should conflicts be resolved?

## Delete Row Boundary Behavior

- [ ] Is the minimum row constraint from ProseMirror's table schema or our own logic?
- [ ] If ProseMirror enforces minimum 2 rows, can we patch it to allow 1 row? Or should we disable the menu item + explain rather than hide it?
- [ ] Why does delete-row-below silently fail instead of surfacing an error? Is the action handler swallowing the exception?
- [ ] Are there analogous boundary bugs for column delete (min columns)?
- [ ] Should we also guard the insert-row-above/below actions at the same time to make boundaries consistent?

## Per-Document Color Scraping Removal

- [ ] Where exactly in `officeColorPopover.tsx` does the "Document colors" scraping happen? (confirm the grep target)
- [ ] Are there any other components that depend on per-document color data? (check `officeTableColors.ts`, `front-matter.ts`)
- [ ] After removal, is localStorage still the right place for custom colors, or does the new file-based config fully replace it?
- [ ] What happens to existing documents that have color metadata in their frontmatter? Do we leave the metadata in place (just not scrape it into the picker), or strip it?

## Custom Color Config System

- [ ] Config file path: is `ai/<machine>/System/config/colors.json` the right convention? Should it be under `Data/` instead since it's runtime state, not source content?
- [ ] Does the server already have a general "config file watcher" pattern (like the CSS scoop)? Can we reuse/extend it, or does this need a new watcher?
- [ ] Sync merge ownership: should the server be the single source of truth, or should the client orchestrate the merge?
- [ ] Deduplication strategy: by hex value (case-insensitive)? What about different formats (#fff vs #ffffff)?
- [ ] Is the sync toggle UI undoable? If a user accidentally toggles sync on, can they revert without data loss?
- [ ] UI: should the sync toggle row be present in the popover at all times, or only visible when custom colors exist?
- [ ] UI: should there be a visual indicator of how many synced workspaces are contributing to the palette?

## Column Resize: Preserve Table Width on Internal Borders

- [ ] Is the current resize logic in `officeTableGeometry.ts` handling drag via ProseMirror transactions or direct DOM manipulation? Determines how to implement the internal-vs-external distinction.
- [ ] Does the current implementation already distinguish between internal and external borders? (e.g., leftmost/rightmost edge vs column dividers)
- [ ] What's the minimum column width? Should it be configurable or hardcoded?
- [ ] Are column widths stored as px or % values in frontmatter? The redistribution math changes depending on unit type.
- [ ] Should there be a visual cursor change when hovering an internal vs external border? (e.g., `col-resize` vs `ew-resize`)
- [ ] Does the undo stack handle partial column-width changes? If undo restores the full layout, that's fine. If it only restores one column, we need to ensure both adjacent columns are grouped in the same undo step.

## Table Cell Overflow Modes

- [ ] Final naming resolved: Overflow / Truncate / New Line — confirmed, maps to CSS terminology.
- [ ] Fit text algorithm: scale font size down? Adjust letter-spacing? What's the shrink strategy and min font size?
- [ ] Should Fit text be scoped as a separate spec decision or is "defer for now" acceptable?
- [ ] Does overflow mode affect print/PDF export? A truncate-mode table in print would lose data.
- [ ] Should the overflow mode be visible in the document frontmatter (for review) or purely internal metadata?
- [ ] Is there an existing table-wide settings pattern in the context menu, or is this the first one?
- [ ] "New line" mode: should it reset row height to auto (grow) or keep a min height?
- [ ] What happens to merged cells in fit/truncate mode?

## Icon Inconsistency

- [ ] Which exact icon is mismatched? (needs visual inspection of `officeInsertMenu.ts` / `officeTableContextMenu.ts`)
- [ ] Is it the wrong Material Symbol name, wrong fill variant (filled vs outlined), or wrong size?
- [ ] Are there any other icon inconsistencies in the context menus besides the plus icons?

## Table Context Menu Restructure

- [ ] Header/footer: what's the visual distinction? Bold text? Different background color? Both?
- [ ] Footer: is it always the last row, or could footer be multiple rows?
- [ ] Border size values: what are the predefined options? (none, 1px, 2px, 3px, 4px?)
- [ ] Border color: does "none" mean the user explicitly selected no color, or just that no border color has been set yet?
- [ ] Light grey dotted line fallback: specific color hex? `#ccc`? `#ddd`? Should it match the theme?
- [ ] Table alignment: is this relative to the document column/page width? How does it interact with text wrapping around tables?
- [ ] Border size + color: per-table setting or can individual cells/rows have different borders?
- [ ] Does the existing insert row/column context menu remain available via right-click on cells? Or does the Table sub-menu replace the entire right-click experience?
- [ ] Should the Table sub-menu show checkmarks/radio dots for the active settings (e.g., current alignment, current overflow mode)?

## Insert Column: Phantom Columns

- [ ] Is the metadata update order the same for insert row? Could the row boundary bugs also produce phantom rows?
- [ ] Does delete column also fail silently on 1 or 2 columns?
- [ ] What is the minimum column count enforced by the ProseMirror table schema?
- [ ] Should we add a guard that prevents metadata writes when the ProseMirror mutation fails?
- [ ] Are there existing phantom columns in stored documents from prior sessions? How do we detect and clean them up?

## General Table Editor Questions

- [ ] Should there be a visual indicator when the cursor is at a boundary where insert row will behave unexpectedly?
- [ ] Are there any other missing table operations we should add while we're in here? (e.g., "Select table", "Split cell", "Merge cells")
