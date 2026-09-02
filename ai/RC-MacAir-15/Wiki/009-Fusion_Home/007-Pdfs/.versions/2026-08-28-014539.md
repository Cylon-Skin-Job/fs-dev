---
name: PDF Viewing Within Office View
description: PDF viewing surface built within the Office view in Fusion Home. Stub - planned; expected to present significant complexity.
metadata:
  incoming-edges:
    - Fusion Home
  outgoing-edges:
    - Fusion Home
    - Artifacts
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

> **Stub.** This page is a breadcrumb. Deep content is pending a dedicated
> build pass.

This article covers **PDF viewing** built within the
[Office Viewer](../001-Office_Viewer/PAGE.md) view in
[Fusion Home](../000-Fusion_Home/PAGE.md). Because the Office view does a lot,
PDFs are split to their own top-level article (peer to
[Documents](../005-Documents/PAGE.md), [Sheets](../006-Sheets/PAGE.md), and
[Artifacts](../008-Artifacts/PAGE.md)) so it can grow its own sub-articles. It
runs on the shared SQLite layer and does not drop into new workspaces
automatically but can be added by user action.

HTML rendering of converted/exported files is a separate concern, covered under
[Artifacts](../008-Artifacts/PAGE.md).

This surface is expected to present significant complexity. Scope and
architecture are pending a dedicated build pass.
