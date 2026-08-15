---
name: Lessons
description: Domain-level traps and learned constraints for Fusion Home. Currently editor-focused (never write into editable cells, write only to table chrome, colors via stylesheet, no row resizing); grows as the other views and editor surfaces are built.
metadata:
  incoming-edges:
    - Fusion Home
    - Documents
    - Office Viewer
  outgoing-edges:
    - Documents
  source-files:
    - fusion-studio-client/src/components/office/officeTableGeometry.ts
    - fusion-studio-client/src/components/office/officeTableColors.ts
    - fusion-studio-client/src/components/office/officeTableNodeView.ts
    - fusion-studio-client/src/components/office/officeColorPopover.ts
    - fusion-studio-client/src/components/office/useCrepeEditor.ts
    - fusion-studio-client/src/components/office/OfficeDocumentPage.css
  connected-skills: []
  related-trigger-files: []
---

Things not to relearn, for the Fusion Home domain. The entries below are
editor-focused today (from the [Documents](../../005-Documents/PAGE.md) work);
add new sections here as Calendar, Email, ToDo, Sheets, Pdfs, and Artifacts get
built.

## Never Write Into Editable Table Cells

Writing an inline style, class, or attribute onto a `<td>`/`<th>` makes
ProseMirror re-render the cell (discarding the write) and collapse the selection
to the document end. Invisible caret, "clicks don't work," typing jumping to the
bottom, and colors not sticking were all this one cause.

## Write Only To Table Chrome, Outside The Content DOM

The `<table>` element and its `<colgroup>` sit outside ProseMirror's contentDOM
and are safe to write directly — this is why column resize works. Cells, rows,
and their contents are content DOM; adorn them from an overlay or a stylesheet,
never in place.

## Cell Colors Apply Through A Stylesheet, Not Inline Styles

Colors are painted by tagging the `<table>` with `data-rv-tid` and emitting
`tr:nth-child(R) > :nth-child(C)` rules into an injected `<style>` element. Do
not "simplify" this back to `cell.style.backgroundColor` — that is the bug it was
built to avoid.

## Row Heights Are Not Resizable

Row-height resizing was removed by design; rows size to their content. The old
approach wrote `cell.style.height` into the content DOM, which is exactly the
forbidden write. Do not reintroduce `metadata.tables[].rows`.

The one automatic exception is a CSS-only minimum floor paired to column
resize: at pointerdown, sample the first regular cell in the first data row and
freeze `Hmin = Wmin = ceil(max(computed min-height, used line-height + block
padding))`. Resolve `normal`/non-pixel used values with an Office-owned
offscreen probe outside the editor. Never derive this minimum from a spanning
header, live multiline height, horizontal padding, or presentation stroke.

## Keep The Square Minimum Inside The Cell Box

Canonical table cells are `border-box`. Their total inline breathing room is
exactly `0.5ch` (`0.25ch` per side), inside the square, and direct cell
paragraphs do not add block padding or margins to the one-line minimum. The
grid is inset paint rather than a layout border. This keeps a one-line clamped
cell square across editor zoom while longer content can still grow the row.

## Ignore Attribute Mutations In The Table Node View

`officeTableNodeView.ignoreMutation` returns `true` for all attribute mutations.
The geometry and color layers write inline styles/attributes onto table chrome;
if the node view reacts to them, ProseMirror rebuilds the table on every write in
a self-sustaining loop (observed as thousands of rebuilds per second while idle).

## Bake The Colgroup Into The Node View

The `<colgroup>` is created in the node view constructor, not inserted later.
Inserting a foreign `<colgroup>` after render made ProseMirror treat the DOM as
dirty and rebuild the table. Create it up front and only ever set `<col>` widths.

## Drag The Overlay, Commit Once On Release

Column resize moves a body-level dashed guide during the drag and writes the real
width to `<colgroup>` exactly once on `pointerup`. Do not apply widths live on
`pointermove` — per-frame writes to the table churn the editor.

## The Virtual Caret Needs An Explicit Color On The Light Paper

Crepe's dark theme colors the ProseMirror virtual caret light, which vanishes on
the fixed-light Office paper. Set `--prosemirror-virtual-cursor-color` on
`.rv-office-document-editor .milkdown .ProseMirror` (higher specificity than
`.ProseMirror-focused`, on the same element) so the override wins.

## Colors And Widths Are Sibling Frontmatter, Not One Blob

`metadata.tables` (widths) and `metadata.tableColors` are separate structures so a
resize commit never wipes colors and vice versa. Do not fold color into the table
layout entries.

## The Renderer Console Is Readable From The Shell

Electron pipes the renderer console to a log file (`os.tmpdir()/electron-renderer.log`).
Add tagged `console.log`, restart, have the user reproduce once, then `grep` the
file — far better than asking a non-technical user to open DevTools or read an
on-screen overlay.
