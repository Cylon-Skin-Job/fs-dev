---
name: Search
description: Office view search behaviors and how they adapt the shared viewer search stack. Stub - planned; content currently summarized in the Office Viewer parent page.
metadata:
  incoming-edges:
    - Office Viewer
  outgoing-edges:
    - Office Viewer
    - Viewer Search
  source-files:
    - fusion-studio-client/src/components/office/useOfficeViewerSearch.ts
  connected-skills: []
  related-trigger-files: []
---

> **Stub.** This page is a breadcrumb. The detail currently lives in the
> [Office Viewer](../PAGE.md) parent under "Search"; a dedicated build pass will
> pull it down here.

Covers Office search behavior:

- `useOfficeViewerSearch.ts` adapts Office to the shared `useViewerSearchIndex`;
- search is global across Office, even from an open folder, and includes the archive;
- matching folders render before matching files;
- the shared query parser (spaces = `AND`; explicit `AND`/`OR`/`NOT`, quotes, parentheses).

See the shared [Viewer Search](../../../001-Workspaces_And_Views/012-Viewer_Search/PAGE.md) for the parser, ranking, and extension rules.
