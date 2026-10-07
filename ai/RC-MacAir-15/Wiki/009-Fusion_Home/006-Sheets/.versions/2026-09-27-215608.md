---
name: Spreadsheet Editing Within Office View
description: Spreadsheet view/editor in Fusion Home. Stub - planned; expected to present significant complexity and runs on the shared SQLite layer.
metadata:
  incoming-edges:
    - Fusion Home
  outgoing-edges:
    - Fusion Home
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

> **Stub.** This page is a breadcrumb. Deep content is pending a dedicated
> build pass.

**Sheets** is a planned editor surface built within the
[Office Viewer](../001-Office_Viewer/PAGE.md) view in
[Fusion Home](../000-Fusion_Home/PAGE.md) — the spreadsheet editor. Because the
Office view does a lot, Sheets is split to its own top-level article (peer to
[Documents](../005-Documents/PAGE.md), [Pdfs](../007-Pdfs/PAGE.md), and
[Artifacts](../008-Artifacts/PAGE.md)) so it can grow its own sub-articles. It runs on the shared SQLite layer and does
not drop into new workspaces automatically but can be added by user action.

This surface is expected to present significant complexity (formula model, cell
grid rendering, large-document performance). Scope and architecture are pending
a dedicated build pass.
