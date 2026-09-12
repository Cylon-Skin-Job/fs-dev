---
name: Wiki System
description: Filesystem and tooling model for the wiki system, including runtime path resolution, terminal access, and the current `Wiki/` contract.
metadata:
  incoming-edges:
    - Wiki
    - Wiki Architecture
  outgoing-edges:
    - Markdown Frontmatter Model
    - Wiki Structure
  source-files:
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/wiki/wiki-tree.js
    - fusion-studio-server/scripts/query-wiki.js
    - fusion-studio-client/src/lib/resource-path.ts
  connected-skills: []
  related-trigger-files: []
---

The wiki system is local-first and folder-first.

## Current Contract

```text
ai/<machine>/System/Views/<wiki-view-folder>/
  manifest.md
  content.json
  styles/

ai/<machine>/Wiki/
  000-Wiki_Guidance/
    PAGE.md
  001-Workspaces_And_Views/
    PAGE.md
    004-Wiki_View/
      PAGE.md
      001-Architecture/
        PAGE.md
```

## Runtime Resolution

- `wiki-viewer` resolves through its capsule `content.json`.
- The default wiki content root is `ai/${machine}/Wiki`.
- Wiki content is not nested under the numbered `System/Views/<wiki-view-folder>/` capsule.
- Copy/send-to-chat paths use `ai/<machine>/Wiki`.
- The client discovers folders using `file_tree_request`.
- The client loads pages using `file_content_request` for `PAGE.md`.
- The terminal query path uses `fusion-studio-server/lib/wiki/wiki-tree.js`; it resolves the established machine identity's V2 wiki capsule under `ai/<machine>/System/Views` before scanning the resolved wiki root.

## Terminal Access

From the server package:

```bash
node scripts/query-wiki.js --workspace "/Users/rccurtrightjr./projects/fs-dev" --scope current --limit 20
```

## Maintenance Rule

Keep the folder tree as the source of truth. If terminal access, search, or sync tooling is added, it should read from the canonical `Wiki/**/PAGE.md` tree.

Do not nest wiki content inside the view capsule or reintroduce a generated `content/` mirror as the runtime source of truth.
