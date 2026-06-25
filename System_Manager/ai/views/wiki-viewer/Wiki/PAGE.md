---
name: Wiki Guide
description: Universal operating guide for traversing, adding, modifying, and connecting folder-first wiki pages.
metadata:
  incoming-edges: []
  outgoing-edges:
    - wiki-frontmatter-contract
    - wiki-folder-contract
    - System Manager
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

This is the operating guide for the folder-first wiki system. Use it whenever a user or AI needs to traverse, add to, reorganize, or modify a workspace wiki.

The wiki root is `ai/views/wiki-viewer/Wiki/`. Every navigable page is a folder with a `PAGE.md` file. Folder names control navigation order and display labels. JSON indexes are not the source of truth.

## Rules

- Use numeric prefixes for ordering: `001-Project`, `002-System_Tools`.
- Use `_` for spaces in display labels.
- Preserve case; hyphens after the numeric prefix remain hyphens.
- Every visible folder should contain `PAGE.md`.
- Link to pages with explicit relative paths ending in `PAGE.md`.
- Do not store secrets, generated state, or one-off task notes here.
- Use wiki frontmatter at the top of durable `PAGE.md` files with `name`, `description`, and `metadata`.
- `metadata` should contain edge lists: `incoming-edges`, `outgoing-edges`, `source-files`, `connected-skills`, and `related-trigger-files`.
- OpenCode skill files use the same `---` YAML frontmatter delimiter pattern in `SKILL.md`.

## Structure

```text
Wiki/
  PAGE.md
  001-Project/
    PAGE.md
    001-Chat/
      PAGE.md
      001-Architecture/
        PAGE.md
        001-Runtime_Model/
          PAGE.md
```

The left sidebar shows the root guide, heading folders, and top-level article folders. The right sidebar appears only for top-level article folders with child sections or articles.

## System Manager

- [System Manager](006-System_Manager/PAGE.md) - assistant-guided workflows for workspace/view management, templates, files, connectors, prompts, skills, and tools.

## AI Traversal

Start at `ai/views/wiki-viewer/Wiki/PAGE.md`, traverse folders by numeric order, and treat each folder with `PAGE.md` as a page. Do not invent navigation from old `index.json`, `topics.json`, `groups`, `sections`, or `articles` files.

## Adding Content

Add content when it is durable: architecture decisions, setup procedures, stable conventions, troubleshooting, glossaries, or safe-edit instructions.

To add a page, choose the parent folder, create the next numbered folder, add `PAGE.md`, and verify it appears in the wiki.
