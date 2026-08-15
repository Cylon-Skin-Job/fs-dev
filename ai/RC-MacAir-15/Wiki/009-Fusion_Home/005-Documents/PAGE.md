---
name: Document Editing Within Office View
description: The Office document editor — Crepe/Milkdown wrapped by Office-owned controllers. Core rule - never write into ProseMirror's editable content DOM. Split to its own top-level article because the Office view does a lot. Table internals (node view, resize, colors) live in the Tables sub-article.
metadata:
  incoming-edges:
    - Office Viewer
    - Fusion Home
  outgoing-edges:
    - Milkdown
    - Crepe
    - Tables
    - Lessons
    - Markdown Frontmatter Model
  source-files:
    - fusion-studio-client/src/components/office/useCrepeEditor.ts
    - fusion-studio-client/src/components/office/officeInsertMenu.ts
    - fusion-studio-client/src/components/office/OfficeDocumentPage.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentPage.css
    - fusion-studio-client/src/lib/front-matter.ts
  connected-skills: []
  related-trigger-files: []
---

The Office document editor is a Crepe/Milkdown (ProseMirror) editor wrapped by
Office-owned React and DOM controllers. This page covers the editor composition
and the core rule that governs all adornments; the technical details for tables
(node view, resize, colors) live in [Tables](004-Tables/PAGE.md).

## The Core Rule

ProseMirror owns the editable content DOM: the `<td>`/`<th>` cells inside the
table's `<tbody>`. Writing anything onto those cells — an inline style, a class,
a data attribute — makes ProseMirror re-render the cell (discarding the write)
and collapse the selection to the end of the document. Every "clicks don't
work / caret jumps to the bottom / color won't stick" bug traced back to this.

Office adornments therefore never touch cells. They write only to **table
chrome** that sits outside the editable content — the `<table>` element and its
`<colgroup>` — or they work entirely outside the editor through a body-level
overlay or an injected stylesheet. See [Lessons](../000-Fusion_Home/001-Lessons/PAGE.md).

## Editor Composition

`useCrepeEditor.ts` creates the Crepe instance and installs the Office-owned
controllers around it. CodeMirror, LaTeX, block-edit, and Crepe's stock table
feature are disabled; Office supplies its own table node view and menus.

Controllers installed per editor:

- `officeInsertMenu.ts` — right-click insert menu (Table, Image, Divider, lists).
- `officeColorPopover.ts` — the reusable color picker popover.
- `officeTableColors.ts` — cell/row/column background colors.
- `officeTableDisplay.ts` — table-wide overflow display and metadata actions.
- `officeTableContextMenu.ts` — right-click menu inside table cells.
- `officeTableGeometry.ts` — column width resize.
- `officeTableNodeView.ts` — the custom table node view (via `crepe.editor.use`).

`OfficeDocumentPage.tsx` owns the React lifecycle: it parses the frontmatter
envelope, feeds body Markdown into Crepe, auto-saves on a 500 ms debounce, and
plumbs table geometry, color, and display metadata to and from frontmatter.

## Tables

Tables are the most involved part of the editor. Three Office-owned adornments
layer onto the Crepe table without writing into ProseMirror's editable content:

- **Column resize** (`officeTableGeometry.ts`) — column width only; rows size to
  their content. A body-level overlay drag commits one width to the `<colgroup>`
  on release (never live on `pointermove`).
- **Cell / Row / Column background colors** (`officeTableColors.ts`) — resolved
  by a cascade (an explicit cell always wins; otherwise the most-recently
  painted row or column wins) and applied through an injected stylesheet, never
  onto the cells.
- **Table display** (`officeTableDisplay.ts`) — resolves each table's Overflow,
  Truncate, or New line mode and applies it from table chrome through static
  descendant selectors.

All three persist as renderer-owned **sibling** structures in document
frontmatter: `metadata.tables` for widths, `metadata.tableColors` for colors,
and `metadata.tableStyles` for overflow plus later title, border, and alignment
fields. Each controller merges only its owned sibling and preserves the other
siblings, unknown metadata, and opaque future fields. Markdown table content
stays plain; renderer-owned display state lives in frontmatter only.

For the full mechanics — the custom table node view (baked-in `<colgroup>`,
`ignoreMutation`), the overlay/commit-on-release drag loop, the color cascade
ranking, the injected-stylesheet rule shape, and the picker tiers — see
[Tables](004-Tables/PAGE.md). For the traps behind these decisions, see
[Lessons](../000-Fusion_Home/001-Lessons/PAGE.md).

## Children

The editor stack breaks into technology layers and a tables reference, each its own article:

- [Milkdown](001-Milkdown/PAGE.md) - the Markdown/ProseMirror engine underneath the editor: schema, the editable content DOM contract, and why adornments must live outside it.
- [Crepe](002-Crepe/PAGE.md) - the Crepe wrapper around Milkdown: which features Office enables/disables, theming, and the editor composition that mounts the Office-owned controllers.
- [Tables](004-Tables/PAGE.md) - technical reference for the custom table node view (baked-in colgroup, ignoreMutation), column resize via overlay + commit-on-release, table-wide overflow display, and cell/row/column background colors via injected/static stylesheets.

## Related Pages

- [Lessons](../000-Fusion_Home/001-Lessons/PAGE.md) - recurring traps and learned constraints for document editor work (never write into editable cells, write only to table chrome, colors via stylesheet, etc.). Promoted to the Fusion Home domain level.
