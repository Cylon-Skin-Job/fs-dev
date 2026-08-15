---
name: Fusion Home
description: Fusion Home is the templated workspace that ships with Fusion Studio. It hosts four views (Office, Calendar, ToDo, Email) plus the editor surfaces built within the Office view (Documents, Sheets, Pdfs, Artifacts). Use this section for those bundled apps.
metadata:
  incoming-edges:
    - Wiki Guide
  outgoing-edges:
    - Lessons
    - Vision
    - Decisions
    - Changes
    - Office Viewer
    - Calendar Viewer
    - ToDo
    - Email
    - Documents
    - Sheets
    - Pdfs
    - Artifacts
  source-files:
    - fusion-studio-client/src/components/ContentArea.tsx
    - fusion-studio-client/src/components/office/OfficeGrid.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentPage.tsx
    - fusion-studio-client/src/state/slices/viewSlice.ts
    - fusion-studio-client/src/components/email/EmailDocumentPage.tsx
  connected-skills: []
  related-trigger-files: []
---

Use this section for the **Fusion Home** templated workspace.

## What Fusion Home Is

Fusion Home is a **templated workspace that ships with the app**. It is not a
per-user workspace that gets created on demand — it is a curated, opinionated
starter workspace bundled with Fusion Studio, and it hosts a handful of office
apps that run on top of the shared SQLite layer.

The apps inside Fusion Home **do not automatically drop into new repos or
workspaces**. A fresh workspace starts with only the default surfaces (see
[Workspaces And Views](../../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md)
for Capture, File Explorer, Wiki, Issues, and Agents). Fusion Home's apps can be
added to other workspaces through user action, but they are not present by
default.

This is the same "templated workspace that ships with the app" model used by
[System Manager](../../006-System_Manager/PAGE.md). The two are peers: Fusion
Home showcases the office/document apps; System Manager shows how Capture and
basic file management / code can be catalogued in a wiki and organized into repo
vs. ai folders.

## The Model: Views vs. Editor Surfaces

Fusion Home has **four actual views**: Office, Calendar, ToDo, Email. A view is
the entry-point surface a user opens.

The **Office view does a lot** — it hosts document editing, spreadsheets, and
PDF/HTML artifact handling. Rather than cram all of that into one article, the
**editor surfaces are split into their own top-level articles** (Documents,
Sheets, Pdfs, Artifacts), each with its own sub-articles. They are built *within*
the Office view, but each gets its own top-level article so it can grow
independently and so any code editor can find context fast.

> **Naming note:** the *folder* name (Documents, Sheets, Pdfs, Artifacts) is the
> short label shown in the sidebar; the article's frontmatter `name` is the
> longer descriptive title shown atop the article (e.g. the Documents folder's
> article is titled "Document Editing Within Office View").

### Content on disk

Fusion Home's Office content lives under `ai/<machine>/Office/` in each workspace,
with `999-Archive/` as a special hidden-from-root folder. See the
[Office Viewer](../001-Office_Viewer/PAGE.md) article for the folder structure,
content root layout, and archive convention.

## Children

### Domain (bite-size)

These four pages capture the "why" for the whole Fusion Home domain — read them when planning. Details live in the view and editor-surface articles below.

- [Lessons](001-Lessons/PAGE.md) - recurring traps and learned constraints (never write into editable cells, write only to table chrome, colors via stylesheet, etc.).
- [Vision](002-Vision/PAGE.md) - where Fusion Home is headed: the templated workspace that showcases office apps on SQLite, with progressive disclosure.
- [Decisions](003-Decisions/PAGE.md) - durable decisions: the views-vs-editor-surfaces split, column-only resize, colors via injected stylesheet, the override cascade, sibling frontmatter.
- [Changes](004-Changes/PAGE.md) - append-only changelog for the domain.

### Views

- [Office Viewer](../001-Office_Viewer/PAGE.md) - the Office view: grid, layout, search, starred/pinned, thumbnails, paper brightness. **Built out** (its own sub-articles cover layout rendering, search, and starred/pinned).
- [Calendar Viewer](../002-Calendar_Viewer/PAGE.md) - calendar view. *Stub — planned.*
- [Email](../003-Email/PAGE.md) - email view. *Stub — planned.* (A simpler document editor exists in `src/components/email/` for editing email-associated documents, but the full email client — inbox, compose, threading — is not built.)
- [ToDo](../004-ToDo/PAGE.md) - task list view. *Stub — planned.*

### Editor surfaces (built within the Office view)

- [Documents](../005-Documents/PAGE.md) - the document editor (Milkdown/Crepe). **Built out** — covers the custom table node view, column resize, and cell/row/column background colors. Read this (and its [Lessons](001-Lessons/PAGE.md)) before touching the Office editor.
- [Sheets](../006-Sheets/PAGE.md) - spreadsheet editor. *Stub — planned; expected to present significant complexity.*
- [Pdfs](../007-Pdfs/PAGE.md) - PDF viewing. *Stub — planned; expected to present significant complexity.*
- [Artifacts](../008-Artifacts/PAGE.md) - HTML artifact viewing (rendering/viewing HTML files and exported artifacts). *Stub — planned.*

## Status

**Built out:** Office Viewer (the view) and Documents (the editor, including the
hard-won table resize and table background-color work). The domain pages
(Lessons, Vision, Decisions, Changes) are seeded with bite-size content.

**Stubs (planned, not yet populated):** Calendar Viewer, Email (the full client),
ToDo, Sheets, Pdfs, Artifacts, and the Office Viewer sub-articles (Layout And
Rendering, Search, Starred And Pinned — currently summarized in the Office
Viewer parent pending a build pass). Deep content is pending a dedicated build
pass.

> **About Email:** The `fusion-studio-client/src/components/email/` directory
> contains a working WYSIWYG editor (`EmailDocumentPage.tsx`) that mirrors the
> Office document editor but without table plugins. This is for editing documents
> attached to emails, not the email client itself. The email *view* (inbox,
> compose, threading) remains unbuilt.

## Developer Quick Reference

- **Panel ID:** `office-viewer` — routed to `OfficeGrid` in `fusion-studio-client/src/components/ContentArea.tsx`
- **Content root on disk:** `ai/<machine>/Office/` (with `999-Archive/` for archived items)
- **State keys (Zustand `viewSlice`):** `officeViewerMode`, `officeViewerCurrentFolder`, `officeViewerSelectedPath`, `officeDocumentSidePanel`, `officePaperBrightness`
- **Thumbnail sidecar:** `.thumbnails/` folder alongside each document file
- **WebSocket events:** `office:thumbnail_saved`, `office:thumbnail_error`
- **Email editor files:** `fusion-studio-client/src/components/email/` — simpler WYSIWYG without table plugins

> Note: this section uses a hand-maintained Children list (matching the
> Workspaces And Views precedent) rather than a `<!-- section-toc -->` marker
> block. Run `node fusion-studio-server/scripts/sync-wiki-tocs.js <workspace>`
> only if you intend to regenerate marker blocks across the whole wiki.
