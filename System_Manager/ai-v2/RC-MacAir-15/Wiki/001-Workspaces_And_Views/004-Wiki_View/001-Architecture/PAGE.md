---
name: Wiki Architecture
description: Overview of the wiki architecture, including the folder-first content contract, UI navigation model, frontmatter metadata, and terminal query path.
metadata:
  incoming-edges:
    - Wiki
  outgoing-edges:
    - Wiki Interface
    - Wiki System
    - Wiki Frontmatter Model
    - Wiki Structure
  source-files:
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-client/src/components/wiki/PageViewer.tsx
    - fusion-studio-client/src/components/wiki/EdgePanel.tsx
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-server/lib/wiki/wiki-tree.js
  connected-skills: []
  related-trigger-files: []
---

The wiki architecture is a filesystem-backed reader with deterministic navigation and metadata.

## Layers

- **Filesystem contract:** `ai/<machine>/Wiki/**/PAGE.md` is the canonical content layer.
- **Discovery:** `WikiExplorer` requests folder trees from the server and builds a `WikiNode` tree.
- **State:** `wikiStore` tracks the left-selected context separately from the currently viewed page.
- **Rendering:** `PageViewer` parses wiki frontmatter, renders the body Markdown, and displays metadata edges.
- **Right sidebar:** `EdgePanel` shows child navigation for top-level article folders only.
- **Terminal access:** `wiki-tree.js` and `query-wiki.js` scan the same folder contract outside the browser.

## Data Flow

1. The client loads `wiki-viewer`.
2. `WikiExplorer` requests the root wiki folder.
3. The server resolves `wiki-viewer` to `ai/<machine>/Wiki/`.
4. Folder responses are converted into `WikiNode` objects.
5. Selecting an item in the left sidebar sets the context node.
6. Clicking a page in the right sidebar changes the viewed node only.
7. `PageViewer` loads the viewed node's `PAGE.md`.
8. Frontmatter renders above and below the Markdown body.

## Current Boundary

The wiki viewer reads and renders local files. Editing remains a file operation or future ticket-driven workflow; the viewer does not directly mutate wiki files.
