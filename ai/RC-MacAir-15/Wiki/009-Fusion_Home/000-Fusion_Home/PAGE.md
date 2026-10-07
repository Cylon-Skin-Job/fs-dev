---
name: Fusion Home
description: Fusion Home Office and editor-surface guidance, with current profile selection and planned neighboring apps distinguished.
metadata:
  source-files:
    - fusion-studio-client/src/components/ContentArea.tsx
    - fusion-studio-client/src/components/office/OfficeGrid.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentPage.tsx
    - fusion-studio-client/src/state/slices/viewSlice.ts
    - fusion-studio-client/src/components/email/EmailDocumentPage.tsx
    - fusion-studio-server/lib/workspace/create-service.js
  last-modified: "2026-09-28T04:56:08Z"
---

Use this section for the **Fusion Home** templated workspace.

## What Fusion Home Is

Fusion Home is a bundled workspace profile and a documentation home for Office and related editor work. The `fusion-home` startup profile selects Office, Files, Issues, Wiki and Agents; the ordinary `new` profile selects Capture, Files, Wiki, Issues and Agents. A profile definition does not establish which workspaces are registered or which features are complete in a running installation. [View Catalog](../../001-Workspaces_And_Views/023-View_Catalog/PAGE.md) distinguishes mounted surfaces, templates and planned views.

[System Manager](../../001-Workspaces_And_Views/011-System_Manager/PAGE.md) documents the separate System surface and protected-resource boundary. [Workspace Compositions](../../001-Workspaces_And_Views/021-Workspace_Compositions/PAGE.md) describes current template copying and the approved plugin-provisioning direction. Neither link establishes a fixed shipped-workspace inventory.

## Documentation model

This domain separates the Office view from editor-surface subjects such as Documents, Sheets, PDFs and Artifacts. Calendar, Email and ToDo have their own articles, with current availability and future intent labeled in those owners. Office content currently lives under `ai/<machine>/Office/`; [Office Viewer](../001-Office_Viewer/PAGE.md) owns that folder and archive behavior. Connected application content remains authoritative in its service or workspace source, rather than being assumed to live in `fusion.db`.

## Children

### Domain (bite-size)

These four pages capture the "why" for the whole Fusion Home domain — read them when planning. Details live in the view and editor-surface articles below.

- [Lessons](001-Lessons/PAGE.md) - recurring traps and learned constraints (never write into editable cells, write only to table chrome, colors via stylesheet, etc.).
- [Vision](002-Vision/PAGE.md) - where Fusion Home is headed: the curated workspace and app composition, with progressive disclosure.
- [Decisions](003-Decisions/PAGE.md) - durable decisions: the views-vs-editor-surfaces split, column-only resize, colors via injected stylesheet, the override cascade, sibling frontmatter.
- [Changes](004-Changes/PAGE.md) - append-only changelog for the domain.

### Views

- [Office Viewer](../001-Office_Viewer/PAGE.md) - the Office view: grid, layout, search, starred/pinned, thumbnails, paper brightness. Existing implementation; specialist coverage varies.
- [Calendar Viewer](../002-Calendar_Viewer/PAGE.md) - mounted demo UI with incomplete integration; follow the current-status owner.
- [Email](../003-Email/PAGE.md) - mounted mock mailbox UI and document interactions; connected mail integration remains future work.
- [ToDo](../004-ToDo/PAGE.md) - task list view. *Stub — planned.*

### Editor surfaces (built within the Office view)

- [Documents](../005-Documents/PAGE.md) - the document editor (Milkdown/Crepe). Existing implementation and substantial documentation — covers the custom table node view, column resize, and cell/row/column background colors. Read this (and its [Lessons](001-Lessons/PAGE.md)) before touching the Office editor.
- [Sheets](../006-Sheets/PAGE.md) - spreadsheet editor. *Stub — planned; expected to present significant complexity.*
- [Pdfs](../007-Pdfs/PAGE.md) - PDF viewing. *Stub — planned; expected to present significant complexity.*
- [Artifacts](../008-Artifacts/PAGE.md) - HTML artifact viewing (rendering/viewing HTML files and exported artifacts). *Stub — planned.*

## Status

Office and document/table editing have substantial implementation and reference material. Office's Layout, Search and Starred/Pinned subpages remain brief; their existence does not mean each subject is complete. Calendar has a demo UI and incomplete sync path; Email has a mock mailbox and document surfaces. ToDo, Sheets, PDFs and Artifacts here are planning placeholders.

This cleanup verified profile selection and corrected framing, routing and storage claims. It did not rerun editor, calendar or email behavior or recertify every technical article.

## Developer Quick Reference

- **Panel ID:** `office-viewer` — routed to `OfficeGrid` in `fusion-studio-client/src/components/ContentArea.tsx`
- **Content root on disk:** `ai/<machine>/Office/` (with `999-Archive/` for archived items)
- **State keys (Zustand `viewSlice`):** `officeViewerMode`, `officeViewerCurrentFolder`, `officeViewerSelectedPath`, `officeDocumentSidePanel`, `officePaperBrightness`
- **Thumbnail sidecar:** `.thumbnails/` folder alongside each document file
- **WebSocket events:** `office:thumbnail_saved`, `office:thumbnail_error`
- **Email editor files:** `fusion-studio-client/src/components/email/` — simpler WYSIWYG without table plugins

This heading uses a hand-maintained Children list. For any generated navigation elsewhere, use the staged procedure in [Audit Workflow](../../000-Wiki_Guidance/004-Audit_Workflow/PAGE.md); do not run an unbounded live audit.
