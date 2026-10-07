---
name: Wiki Architecture
description: Overview of the wiki architecture, including the folder-first content contract, UI navigation model, frontmatter metadata, and terminal query path.
metadata:
  source-files:
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-client/src/components/wiki/PageViewer.tsx
    - fusion-studio-client/src/components/wiki/EdgePanel.tsx
    - fusion-studio-client/src/lib/front-matter.ts
    - fusion-studio-client/src/lib/wiki-frontmatter.ts
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-server/lib/wiki/wiki-tree.js
  last-modified: "2026-09-28T04:56:08Z"
---

The wiki architecture is a filesystem-backed reader with deterministic navigation and metadata.

## Layers

- **Filesystem contract:** `ai/<machine>/Wiki/**/PAGE.md` is the canonical content layer.
- **Discovery:** `WikiExplorer` requests folder trees from the server and builds a `WikiNode` tree.
- **State:** `wikiStore` tracks the left-selected context separately from the currently viewed page.
- **Rendering:** shared frontmatter parsing reads the system-wide Markdown envelope; `PageViewer` renders Wiki fields, body Markdown and known nonempty metadata lists. Legacy edge rendering remains compatible, but current authoring uses source files plus a modification timestamp, not edges.
- **Right sidebar:** `EdgePanel` shows child navigation for selected article folders, including `000-` heading articles that have child pages.
- **Terminal access:** `wiki-tree.js` and `wiki.js query` scan the same folder contract outside the browser.

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

<!-- section-toc:start -->
## Technical Articles in this Wiki Section

- [Changelog](../001-Changelog/PAGE.md) - Dated record of important wiki system changes so future work can see how the model evolved.
- [Decisions](../002-Decisions/PAGE.md) - Durable wiki system decisions covering folder structure, navigation behavior, metadata, and the current pre-release source of truth.
- [Lessons](../003-Lessons/PAGE.md) - Lessons learned while stabilizing the wiki system, especially around sidebar behavior, page organization, and metadata.
- [Interface](../004-Interface/PAGE.md) - User-facing wiki interface model, including the three-column layout, contextual right sidebar, rendered frontmatter, and read-only browsing behavior.
- [System](../005-System/PAGE.md) - Filesystem and tooling model for the wiki system, including runtime path resolution, terminal access, and the current `Wiki/` contract.
- [Frontmatter Model](../006-Frontmatter_Model/PAGE.md) - System-wide Markdown frontmatter contract for display names, descriptions, retrieval metadata, and renderer-owned settings.
- [Structure](../007-Structure/PAGE.md) - File and module map for the wiki viewer, terminal wiki scanner, and frontmatter rendering path.
<!-- section-toc:end -->
