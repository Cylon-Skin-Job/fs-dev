---
name: Office Viewer
description: Documents the Office viewer filesystem model, document editor, thumbnails, paper brightness, search, activity, collections, and table presentation behavior.
metadata:
  incoming-edges:
    - Fusion Home
    - View Architecture
    - Viewer Search
    - View Activity And Collections
    - Markdown Frontmatter Model
    - Themes and State
  outgoing-edges:
    - Documents
    - Layout And Rendering
    - Search
    - Starred And Pinned
    - View Architecture
    - Viewer Search
    - View Activity And Collections
    - Markdown Frontmatter Model
    - Themes and State
  source-files:
    - fusion-studio-client/src/components/office/OfficeGrid.tsx
    - fusion-studio-client/src/components/office/OfficeGrid.css
    - fusion-studio-client/src/components/office/OfficeViewerHeader.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentTile.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentTile.css
    - fusion-studio-client/src/components/office/OfficeDocumentPage.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentPage.css
    - fusion-studio-client/src/components/office/OfficeDocumentTopbar.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentToolbar.tsx
    - fusion-studio-client/src/components/office/useOfficeViewerSearch.ts
    - fusion-studio-client/src/components/office/useCrepeEditor.ts
    - fusion-studio-client/src/components/office/officeInsertMenu.ts
    - fusion-studio-client/src/components/office/officeTableContextMenu.ts
    - fusion-studio-client/src/components/office/officeTableGeometry.ts
    - fusion-studio-client/src/components/office/officeTableDisplay.ts
    - fusion-studio-client/src/components/office/officeTableNodeView.ts
    - fusion-studio-client/src/components/office/officeTableColors.ts
    - fusion-studio-client/src/components/office/officeColorPopover.ts
    - fusion-studio-client/src/components/PaperBrightnessControl.tsx
    - fusion-studio-client/src/lib/front-matter.ts
    - fusion-studio-client/src/lib/officePaperBrightness.ts
    - fusion-studio-client/src/lib/officeThumbnails.ts
    - fusion-studio-client/src/lib/viewActivity.ts
    - fusion-studio-client/src/lib/viewCollections.ts
    - fusion-studio-client/src/hooks/useFileTileMenu.ts
    - fusion-studio-server/lib/file-explorer.js
    - fusion-studio-server/lib/http/panel-file-route.js
    - fusion-studio-server/lib/ws/workspace-request-handlers.js
  connected-skills: []
  related-trigger-files: []
---

Use this page for Office viewer behavior. Office is a built-in React view, not a custom iframe view.

## Content Root

`office-viewer` resolves to the workspace Office root:

```text
ai/<machine>/Office
```

Office supports loose files at the root, folders, nested folders, and loose files inside any folder. Normal folder listings hide the archive folder. Archive mode lists it directly:

```text
ai/<machine>/Office/999-Archive
```

Do not use `Trash` for Office. The durable folder convention matches Capture: archive content goes to `999-Archive`.

## Grid Interface

`OfficeGrid.tsx` owns the Office home/folder/archive/search surface.

- The left sidebar is full-time chrome with Home, Recent, Starred, Pinned Folders, and Archive.
- Pinned Folders is a non-clickable section header; pinned folder rows under it are clickable.
- Home and folder views separate folders and files into sections. Empty sections are omitted.
- Folder cards and file cards share the same width rhythm.
- File cards use screenshot thumbnails when available; missing thumbnails render a missing-thumbnail state instead of silently falling back to markdown preview rendering.
- The New menu supports New Folder, Import File, Import Folder, and New Document.
- Folders and files use the shared menu behavior where possible: rename, archive/restore, delete, star/unstar for files, and pin/unpin for Office folders.

## Search

Office search uses the shared local viewer search stack.

- `useOfficeViewerSearch.ts` adapts Office to `useViewerSearchIndex.ts`.
- Search is global across Office, even when started from an open folder.
- Archive content is included.
- Matching folders render before matching files.
- Search uses the shared query parser: spaces imply `AND`; explicit `AND`, `OR`, `NOT`, quotes, and parentheses are supported.
- Opening a search result exits search and navigates to the selected folder or file.

See [Viewer Search](../../001-Workspaces_And_Views/012-Viewer_Search/PAGE.md) for the shared parser, ranking, filter stubs, and extension rules.

## Activity And Collections

Office uses the shared per-view state model in the numbered view capsule:

```text
ai/<machine>/Views/<office-view-folder>/state/state.json
```

Office records opened documents in `activity.recents`. Recents are grouped by Today, Yesterday, Earlier This Week, Earlier This Month, Last Month, then month/year. The old Recent Docs SQLite path is retired for this UI.

Office file stars live in `collections.starred`. Office pinned folders live in `collections.pinnedFolders`. Files render a filled `kid_star` glyph only when starred; unstarred files do not reserve empty star space.

Rename, archive, restore, move, and delete flows must update or remove matching activity and collection references through the shared path-reference helpers. Do not add one-off cleanup logic inside Office.

## Document Editor

Office documents are Markdown files edited through Crepe/Milkdown, wrapped by Office-owned React and DOM controllers. The editor is documented as its own top-level article, [Documents](../005-Documents/PAGE.md), because it is large enough to warrant its own sub-articles (Milkdown, Crepe, Lessons).

`OfficeDocumentPage.tsx` owns document lifecycle:

- parses and preserves the system-wide frontmatter envelope;
- passes body Markdown into Crepe through `useCrepeEditor.ts`;
- auto-saves on a 500 ms debounce;
- supports manual save with Cmd/Ctrl+S;
- records checkpoint saves for long edit sessions;
- captures a document thumbnail before navigating away;
- persists document display settings under `metadata.display`;
- persists table geometry under `metadata.tables`, table backgrounds under
  `metadata.tableColors`, and table-wide presentation under
  `metadata.tableStyles`.

Office intentionally removes CodeMirror and LaTeX from Crepe. It also treats backticks as normal visible text instead of converting them into rendered inline code for the Office authoring surface. Users who want raw Markdown behavior should use Capture or File Explorer.

## Document Output

Office captures the editor body, current display settings, and current table
geometry/colors/styles synchronously as one immutable output snapshot. It
serializes that same snapshot both as canonical full Markdown for save and
milestone history and as body Markdown plus an Office-only table-presentation
descriptor. PDF/DOCX download and email attachments and Preview/Print require
the exact `presentationMode: office-tables`/descriptor pair. A missing member,
invalid descriptor, or source mismatch fails before output and never falls
back to legacy conversion. The Email editor and non-Office callers retain their
legacy payloads and converters.

The Office Export dropdown order is **Export DOCX**, **Export PDF**, **Email
Markdown**, then **Preview PDF**. DOCX and PDF retain their Folder and Email
submenus. **Email Markdown** is one direct action, with no download submenu; it
sends the snapshot's exact canonical Markdown including frontmatter. Pointer
and native keyboard activation close the dropdown once, and all output actions
remain guarded while an output is pending.

Office download and email use the same format-specific transformer, while
Preview/Print uses the same presentation-aware PDF path as PDF output. The
output boundary preserves the existing save/milestone behavior and sanitized
download names. Temporary Mail attachments and Preview/Print files are unique,
contained under the application temp root, and registered for bounded cleanup
plus application-quit cleanup. Legacy payloads keep their existing conversion
and handoff behavior, but their Mail and Print artifacts use the same contained,
retry-safe cleanup registry.

## Insert And Table Menus

Office does not use Crepe's stock floating block-edit handle.

The Office insert menu is a right-click menu for empty lines or regular text lines. It exposes:

- Table
- Image
- Divider
- Bullet List
- Ordered List
- Check List

The Office table context menu is a right-click menu inside table cells. Cell,
row, and column background and adjacent structure operations remain in the root
menu. Its nested **Table** submenu contains, in order: **Add title row**;
**Border size** and **Border color**; **Align table left**, **Align table
center**, and **Align table right**; **Overflow**; and **Remove table**. The
three alignment choices are one radio group and report the active table state.

Table row/column structure still uses Milkdown table commands and schema. Office owns the visible menu and interaction design around those commands.

## Table Geometry, Presentation, And Colors

Column resize and table presentation/background colors are Office-owned adornments
layered onto the Crepe table. They work without writing into ProseMirror's
editable content — see [Documents](../005-Documents/PAGE.md) for the full
mechanics and [Lessons](../000-Fusion_Home/001-Lessons/PAGE.md) for the constraints.

- `officeTableGeometry.ts` handles **column width only** — rows size to their
  content. Resize handles are a body-level overlay on each column line; dragging
  moves a dashed guide, and the width is written once to the table's `<colgroup>`
  on release, then persisted to `metadata.tables`.
- `officeTableDisplay.ts` handles table-wide **Overflow / Truncate / New line**,
  title markers, borders, and **Left / Center / Right** placement. Alignment is
  wrapper-relative table chrome: Left uses start `0`/end `auto`, Center uses
  `auto`/`auto`, and Right uses start `auto`/end `0`. It never changes cell text
  alignment, widths, content, prose flow, or writes a position offset. Missing
  or invalid alignment follows the current effective page alignment without an
  eager document rewrite: page Left maps to table Left, page Right to table
  Right, and page Center or Justify to table Center. A page-alignment action
  atomically moves only tables whose current effective value equals the old
  effective page value; differing values stay pinned until equality with a
  later page value makes them followers again.
- `officeTableColors.ts` handles **Cell / Row / Column background colors**,
  resolved by a cascade (an explicit cell wins; otherwise the most-recently
  painted row or column) and applied through an injected stylesheet keyed to a
  `data-rv-tid` table attribute. Colors persist to `metadata.tableColors`.

The persisted shapes are sibling structures in document frontmatter, so a
resize, background, or table-wide presentation commit never wipes another
domain:

```yaml
metadata:
  tables:
    - tableIndex: 0
      fingerprint: table-abc123
      columns: [180, 260, 140]
  tableColors:
    - tableIndex: 0
      fingerprint: table-abc123
      cells: { '0,1': '#ffe08a' }
  tableStyles:
    - tableIndex: 0
      fingerprint: table-abc123
      tableOverflow: overflow
      tableAlignment: right
```

Internal resize preserves total width; either outer handle changes the outer
column and table width. For a narrower table, resize reapplies the selected
wrapper-relative left edge, center, or right edge. At or above wrapper width,
the scroll origin and far edge stay reachable while stored alignment remains
unchanged. Alignment-only changes never change the committed width array.

Do not encode table geometry, backgrounds, or table presentation as inline
HTML/CSS in the Markdown body, and never write display attributes onto editable
cells or rows. Markdown table content stays plain; renderer-owned display state
lives in frontmatter and participates in native table metadata Undo/Redo.

## Thumbnails

Office thumbnail sidecars are stored beside the document's containing folder:

```text
Office/<folder>/.thumbnails/<DocumentName.md>.png
```

For a root-level document:

```text
Office/.thumbnails/<DocumentName.md>.png
```

The client captures a clean, untinted screenshot of the document page before navigation. The server handles `office:thumbnail_save` and writes the PNG under `.thumbnails`. HTTP panel-file routes intentionally allow `.thumbnails` while other dot directories remain hidden/protected.

When Office documents are renamed, archived, restored, or deleted, thumbnail sidecars should move or be removed with the document. Keep thumbnail path behavior centralized in `officeThumbnails.ts` and server mutation handlers.

## Paper Brightness

Office paper brightness is persisted as view-local `officePaperBrightness`.

The setting applies a subtle overlay to document pages and Office thumbnails so bright white paper can be muted in dark UI. Thumbnail capture temporarily disables the overlay so saved thumbnails remain pure and can be re-tinted live when the user changes brightness later.

The brightness range is intentionally narrow. It should mute white paper, not turn the page gray.

## Children

These sub-articles break the Office view's own behavior into focused pages (deep content pending a dedicated build pass):

- [Layout And Rendering](001-Layout_And_Rendering/PAGE.md) - how the grid, folder/file cards, sidebar, and tile rendering work.
- [Search](002-Search/PAGE.md) - Office search behaviors and how they adapt the shared viewer search stack.
- [Starred And Pinned](003-Starred_And_Pinned/PAGE.md) - how starred files and pinned folders are categorized and persisted.

## Related Pages

- [Documents](../005-Documents/PAGE.md) - the document editor (Milkdown/Crepe), split to its own top-level article because the Office view does a lot.
- [Fusion Home](../000-Fusion_Home/PAGE.md) - the templated workspace this view ships with.
- [View Architecture](../../001-Workspaces_And_Views/002-View_Architecture/PAGE.md) - view capsules, content roots, and built-in React view boundaries.
- [Viewer Search](../../001-Workspaces_And_Views/012-Viewer_Search/PAGE.md) - shared local search behavior.
- [View Activity And Collections](../../001-Workspaces_And_Views/013-View_Activity_And_Collections/PAGE.md) - recents, stars, pinned folders, and path-reference cleanup.
- [Markdown Frontmatter Model](../../001-Workspaces_And_Views/004-Wiki_View/001-Architecture/006-Frontmatter_Model/PAGE.md) - system-wide frontmatter envelope.
- [Themes And State](../../005-Enforcement/002-Themes_And_State/PAGE.md) - view-local state and style boundaries.
