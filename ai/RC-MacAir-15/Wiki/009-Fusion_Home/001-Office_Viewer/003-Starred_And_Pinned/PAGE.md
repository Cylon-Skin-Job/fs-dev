---
name: Starred And Pinned
description: How the Office view categorizes and persists starred files and pinned folders. Stub - planned; content currently summarized in the Office Viewer parent page.
metadata:
  incoming-edges:
    - Office Viewer
  outgoing-edges:
    - Office Viewer
    - View Activity And Collections
  source-files:
    - fusion-studio-client/src/lib/viewActivity.ts
    - fusion-studio-client/src/lib/viewCollections.ts
  connected-skills: []
  related-trigger-files: []
---

> **Stub.** This page is a breadcrumb. The detail currently lives in the
> [Office Viewer](../PAGE.md) parent under "Activity And Collections"; a
> dedicated build pass will pull it down here.

Covers how the Office view categorizes and persists collection state in the
numbered view capsule (`ai/<machine>/System/Views/<office-view-folder>/state/state.json`):

- `collections.starred` — starred files; a filled `kid_star` glyph renders only when starred (no empty star space reserved);
- `collections.pinnedFolders` — pinned Office folders; "Pinned Folders" is a non-clickable header with clickable rows beneath;
- rename/archive/restore/move/delete flows must update or remove matching references through the shared path-reference helpers (no one-off cleanup inside Office).

See the shared [View Activity And Collections](../../../001-Workspaces_And_Views/013-View_Activity_And_Collections/PAGE.md) for the cross-view model.
