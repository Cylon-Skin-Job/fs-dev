---
name: Wiki System
description: Filesystem and tooling model for the wiki system, including runtime path resolution, terminal access, and the current `Wiki/` contract.
metadata:
  incoming-edges:
    - Wiki
    - Wiki Architecture
  outgoing-edges:
    - Wiki Frontmatter Model
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
ai/views/wiki-viewer/
  Wiki/
    PAGE.md
    001-Workspaces_And_Views/
      PAGE.md
      004-Wiki_View/
        PAGE.md
        001-Architecture/
          PAGE.md
```

## Runtime Resolution

- `wiki-viewer` resolves to `viewRoot/Wiki` when the `Wiki/` folder exists.
- Copy/send-to-chat paths use `ai/views/wiki-viewer/Wiki`.
- The client discovers folders using `file_tree_request`.
- The client loads pages using `file_content_request` for `PAGE.md`.
- The terminal query path uses `fusion-studio-server/lib/wiki/wiki-tree.js`.

## Terminal Access

From the server package:

```bash
node scripts/query-wiki.js --workspace "/Users/rccurtrightjr./projects/fs-dev" --scope current --limit 20
```

## Maintenance Rule

Keep the folder tree as the source of truth. If terminal access, search, or sync tooling is added, it should read from the canonical `Wiki/**/PAGE.md` tree.
