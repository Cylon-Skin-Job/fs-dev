---
name: Viewer Search
description: Documents local search behavior for folder-backed React views, including shared indexing, query rules, and per-view rendering rules.
metadata:
  incoming-edges:
    - Workspaces And Views
    - View Architecture
    - Server And Runtime
    - Workspaces & Views
  outgoing-edges:
    - View Architecture
    - Server And Runtime
    - View Activity And Collections
  source-files:
    - fusion-studio-client/src/hooks/useViewerSearchIndex.ts
    - fusion-studio-client/src/lib/searchQuery.ts
    - fusion-studio-client/src/components/search/ViewerSearchField.tsx
    - fusion-studio-client/src/components/search/ViewerSearchFilters.tsx
    - fusion-studio-client/src/components/capture/useCaptureViewerSearch.ts
    - fusion-studio-client/src/components/capture/CaptureTiles.tsx
    - fusion-studio-client/src/components/office/useOfficeViewerSearch.ts
    - fusion-studio-client/src/components/office/OfficeGrid.tsx
    - fusion-studio-client/src/state/fileDataStore.ts
  connected-skills: []
  related-trigger-files: []
---

Use this page for local search inside folder-backed React views such as Capture and Office.

This is not browser/web search, and it is not the terminal wiki scanner. Browser/web search belongs to [Browser](../005-Browser/PAGE.md). Wiki-specific terminal discovery belongs to [Wiki View](../004-Wiki_View/000-Wiki_View/PAGE.md).

## Current Model

Viewer search is client-side over the existing file tree/content cache.

`useViewerSearchIndex.ts` owns the shared mechanics:

- request configured root folder trees with `file_tree_request`;
- optionally crawl nested folders;
- request file content with `file_content_request` when a file type needs body search;
- track loading while trees or content are still missing;
- rank matching folder and file items with `rankSearchFields`.

Each view owns a thin adapter that declares roots, exclusions, file eligibility, folder-result behavior, and metadata. Do not create another per-view tree/content/ranking loop when adding search to another folder-backed view.

## Query Rules

`searchQuery.ts` is the parser and ranker.

- Matching is case-insensitive.
- A space between terms means `AND`.
- Explicit `AND`, `OR`, and `NOT` are supported.
- Quoted phrases match as phrases, for example `"ice cream"`.
- Parentheses are supported for grouping.
- Ranking weights title highest, then location, then body text.

The current dropdown controls are header UI scaffolding. The core query search still matches over title, location, and body unless a view adapter or future filter state narrows it.

Search does not filter live on every keystroke after results are submitted. Typing changes the query field; pressing Enter submits the query again and re-runs search. The current visible results remain in place until Enter is pressed.

The shared filter row currently exposes `Type`, `Modified`, `Location`, and `Title only`. `Starred only` was removed. Type/Modified/Location are UI stubs until file metadata and sort/filter backing are expanded.

## Capture Search

Capture search uses `useCaptureViewerSearch.ts`.

- It searches the ordered Capture folders plus `999-Archive`.
- Archive is included intentionally, even though normal root listings hide `999-Archive`.
- File results are rendered in one grid.
- Capture does not surface matching folders as search results.
- Image files participate as title/location matches with empty body text.
- Non-image files request content so body text can participate in matching and ranking.

Capture search should continue to include archived items by default unless the user explicitly changes that product rule.

## Office Search

Office search uses `useOfficeViewerSearch.ts`.

- Office search starts from the Office root plus `999-Archive` and crawls folders recursively.
- Search is global across Office, even when the user starts from an open folder.
- Archive content is included intentionally.
- Folder matches are surfaced first.
- File matches are rendered beneath folder matches.
- Opening a folder or file result exits search and navigates to that result.

Office search is global like Capture search. The only major result-shape difference is that Office surfaces matching folders above matching files.

## Server Boundary

The server does not run these searches. It resolves panel paths and serves tree/content requests.

Server-side root listing rules still matter:

- `doc-viewer` resolves to `ai/${machine}/Captures`; normal root listings hide `999-Archive`, but Capture search includes it by requesting it directly as a configured root.
- `office-viewer` resolves to `ai/${machine}/Office`; normal root listings hide `999-Archive`, but Office search includes it by requesting it directly as a configured root.

If a future view needs server-backed search for scale, document that as a separate architecture change before adding routes or WebSocket messages.

## Extension Rule

To add local viewer search to another folder-backed view:

1. Reuse `ViewerSearchField` and `ViewerSearchFilters` for header chrome where the design matches.
2. Add a view-specific adapter beside the view, modeled after `useCaptureViewerSearch.ts` or `useOfficeViewerSearch.ts`.
3. Feed the adapter into `useViewerSearchIndex`.
4. Keep rendering decisions in the view component.
5. Keep query parsing and ranking in `searchQuery.ts`.

Do not duplicate tree walking, content request, loading, or ranking logic inside the view component.

## Related Pages

- [View Architecture](../002-View_Architecture/PAGE.md) - view identity, content roots, and folder-backed view boundaries.
- [Server And Runtime](../../002-Server_And_Runtime/PAGE.md) - server path resolution and file explorer ownership.
- [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md) - recents, stars, pinned folders, and path-reference cleanup.
