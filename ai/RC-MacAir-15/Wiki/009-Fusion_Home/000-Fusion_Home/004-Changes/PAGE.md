---
name: Fusion Home Changes
description: Changelog for the Fusion Home domain - what has been built, moved, or restructured. Append-only log.
metadata:
  incoming-edges:
    - Fusion Home
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Append-only changelog for the Fusion Home domain. Newest first.

## 2026-07 — Section created, Office knowledge migrated

- Created the `009-Fusion_Home` section as a top-level domain (peer to
  Workspaces And Views and System Manager), framed as the templated workspace
  that ships with the app.
- Split the Office surface into **four views** (Office Viewer, Calendar Viewer,
  Email, ToDo) and **editor surfaces as top-level articles** (Documents, Sheets,
  Pdfs, Artifacts), because the Office view does a lot.
- Migrated the document-editor knowledge out of the old `014-Office_Viewer`
  article into [Documents](../../005-Documents/PAGE.md) with sub-articles
  ([Milkdown](../../005-Documents/001-Milkdown/PAGE.md),
  [Crepe](../../005-Documents/002-Crepe/PAGE.md),
  [Tables](../../005-Documents/004-Tables/PAGE.md)).
- Promoted the editor traps page to the domain-level
  [Lessons](../001-Lessons/PAGE.md).
- Landed **column-only table resize** (overlay + commit-on-release) and
  **cell/row/column background colors** (cascade + injected stylesheet). See
  [Decisions](../003-Decisions/PAGE.md) and [Lessons](../001-Lessons/PAGE.md).
- The old `001-Workspaces_And_Views/014-Office_Viewer` is now a redirect; the
  Workspaces And Views heading is light-reframed around the default surfaces.
