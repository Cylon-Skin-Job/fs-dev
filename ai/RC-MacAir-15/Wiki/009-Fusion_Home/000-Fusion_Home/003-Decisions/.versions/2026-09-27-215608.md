---
name: Fusion Home Decisions
description: Durable decisions for the Fusion Home domain - the views-vs-editor-surfaces split, table resize/columns-only, colors via injected stylesheet, the override cascade, and sibling frontmatter.
metadata:
  incoming-edges:
    - Fusion Home
  outgoing-edges:
    - Documents
    - Tables
    - Lessons
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Bite-size durable decisions for the Fusion Home domain. Details live in
[Documents](../../005-Documents/PAGE.md) and [Tables](../../005-Documents/004-Tables/PAGE.md);
the traps behind them live in [Lessons](../001-Lessons/PAGE.md).

## Structure

- **Four actual views** (Office, Calendar, ToDo, Email) plus **editor surfaces
  split into their own top-level articles** (Documents, Sheets, Pdfs, Artifacts)
  because the Office view does a lot. Each editor surface is built within the
  Office view but gets its own article and sub-articles.
- **Folder name = sidebar label; frontmatter `name` = descriptive article title.**
  Any frontmatter value containing a colon must be quoted (strict YAML).

## Tables

- **Column resize only.** Row resizing was dropped — it wrote into editable cells
  and fed a rebuild loop. Rows size to content.
- **Never write into ProseMirror's editable content DOM.** Adornments touch only
  table chrome (`<table>`, `<colgroup>`) or live outside the editor (overlay /
  injected stylesheet).
- **Colors apply through an injected stylesheet**, keyed on a `data-rv-tid` table
  attribute — never as inline cell styles.
- **Override cascade:** an explicit cell always wins; otherwise the row/column
  with the higher `rank` (monotonic, bumped on every paint) wins; "None" deletes
  the entry.
- **Sibling frontmatter:** widths in `metadata.tables`, colors in
  `metadata.tableColors`, so a resize commit never wipes colors.

## Editor

- **Milkdown + Crepe** with Office-owned controllers; CodeMirror, LaTeX,
  block-edit, and Crepe's stock table feature are disabled.
- **Bake the `<colgroup>` into the node view** and **ignore all attribute
  mutations**, so chrome writes don't trigger a rebuild loop.
