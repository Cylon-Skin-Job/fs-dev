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
    - fusion-studio-client/src/lib/wiki-frontmatter.ts
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-server/lib/wiki/wiki-tree.js
    - fusion-studio-server/scripts/query-wiki.js
  connected-skills: []
  related-trigger-files: []
---

## Client Files

- `fusion-studio-client/src/components/wiki/WikiExplorer.tsx` discovers the folder tree and requests page content.
- `fusion-studio-client/src/components/wiki/TopicList.tsx` renders the left outline.
- `fusion-studio-client/src/components/wiki/PageViewer.tsx` renders the viewed page, frontmatter header, Markdown body, and metadata footer.
- `fusion-studio-client/src/components/wiki/EdgePanel.tsx` renders contextual child navigation for selected top-level article folders.
- `fusion-studio-client/src/state/wikiStore.ts` stores root tree, selected context, viewed page, history, content, loading, and errors.
- `fusion-studio-client/src/lib/wiki-frontmatter.ts` parses `name`, `description`, and metadata edge lists.
- `fusion-studio-client/src/lib/resource-path.ts` maps `wiki-viewer` copy/send paths to `ai/views/wiki-viewer/Wiki`.

## Server Files

- `fusion-studio-server/lib/views/index.js` resolves `wiki-viewer` content to `viewRoot/Wiki`.
- `fusion-studio-server/lib/file-explorer.js` serves tree and content requests.
- `fusion-studio-server/lib/wiki/wiki-tree.js` scans wiki folders for terminal access.
- `fusion-studio-server/scripts/query-wiki.js` exposes terminal wiki queries.
- `fusion-studio-server/package.json` provides the `wiki` npm script.

## Content Files

- `ai/views/wiki-viewer/Wiki/000-Wiki_Guidance/PAGE.md` is the root front page (the root's `000-` heading article); there is no folder-level `Wiki/PAGE.md`.
- `ai/views/wiki-viewer/Wiki/**/PAGE.md` are navigable pages.
- `ai/views/wiki-viewer/settings/layout.css` styles wiki layout, sidebars, frontmatter headers, and metadata footers.
