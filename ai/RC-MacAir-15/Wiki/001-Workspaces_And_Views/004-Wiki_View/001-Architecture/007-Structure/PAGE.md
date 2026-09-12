---
name: Wiki Structure
description: File and module map for the wiki viewer, terminal wiki scanner, and frontmatter rendering path.
metadata:
  incoming-edges:
    - Wiki
    - Wiki Architecture
  outgoing-edges: []
  source-files:
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-client/src/components/wiki/TopicList.tsx
    - fusion-studio-client/src/components/wiki/PageViewer.tsx
    - fusion-studio-client/src/components/wiki/EdgePanel.tsx
    - fusion-studio-client/src/lib/front-matter.ts
    - fusion-studio-client/src/lib/wiki-frontmatter.ts
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-server/lib/views/panel-paths.js
    - fusion-studio-server/lib/wiki/wiki-tree.js
    - fusion-studio-server/scripts/query-wiki.js
  connected-skills: []
  related-trigger-files: []
---

## Client Files

- `fusion-studio-client/src/components/wiki/WikiExplorer.tsx` discovers the folder tree and requests page content.
- `fusion-studio-client/src/components/wiki/TopicList.tsx` renders the left outline.
- `fusion-studio-client/src/components/wiki/PageViewer.tsx` renders the viewed page, frontmatter header, Markdown body, and metadata footer.
- `fusion-studio-client/src/components/wiki/EdgePanel.tsx` renders contextual child navigation for selected article folders, including `000-` heading articles.
- `fusion-studio-client/src/state/wikiStore.ts` stores root tree, selected context, viewed page, history, content, loading, and errors.
- `fusion-studio-client/src/lib/front-matter.ts` owns system-wide Markdown frontmatter parsing and Office/Email document setting serialization.
- `fusion-studio-client/src/lib/wiki-frontmatter.ts` normalizes `name`, `description`, and known metadata edge lists for Wiki display.
- `fusion-studio-client/src/lib/resource-path.ts` maps `wiki-viewer` copy/send paths to `ai/<machine>/Wiki`.

## Server Files

- `fusion-studio-server/lib/views/index.js` loads V2 view capsules and resolves `wiki-viewer` content from `content.json`, defaulting to `ai/${machine}/Wiki`.
- `fusion-studio-server/lib/views/panel-paths.js` maps `wiki-viewer` to that resolved content root for file tree/content requests.
- `fusion-studio-server/lib/file-explorer.js` serves tree and content requests from the resolved panel path.
- `fusion-studio-server/lib/wiki/wiki-tree.js` scans wiki folders for terminal access.
- `fusion-studio-server/scripts/query-wiki.js` exposes terminal wiki queries.
- `fusion-studio-server/package.json` provides the `wiki` npm script.

## Content Files

- `ai/<machine>/Wiki/000-Wiki_Guidance/PAGE.md` is the root front page (the root's `000-` heading article); there is no folder-level `Wiki/PAGE.md`.
- `ai/<machine>/Wiki/**/PAGE.md` are navigable pages.
- `ai/<machine>/System/Views/<wiki-view-folder>/content.json` declares the wiki content root.
- `ai/<machine>/System/Views/<wiki-view-folder>/styles/layout.css` styles wiki layout, sidebars, frontmatter headers, and metadata footers.
