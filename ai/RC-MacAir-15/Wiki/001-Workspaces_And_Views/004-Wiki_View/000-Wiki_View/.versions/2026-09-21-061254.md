---
name: Wiki
description: Start here when working on the Fusion Studio wiki. This page summarizes the current folder-first wiki model, interface behavior, metadata contract, and development map.
metadata:
  incoming-edges:
    - Wiki Guide
    - Workspaces And Views
  outgoing-edges:
    - Wiki Architecture
    - Wiki Interface
    - Wiki System
    - Markdown Frontmatter Model
  source-files:
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-client/src/components/wiki/TopicList.tsx
    - fusion-studio-client/src/components/wiki/PageViewer.tsx
    - fusion-studio-client/src/components/wiki/EdgePanel.tsx
    - fusion-studio-client/src/lib/wiki-frontmatter.ts
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-server/lib/wiki/wiki-tree.js
    - fusion-studio-server/scripts/query-wiki.js
  connected-skills:
    - path-safety
    - version-hygiene
  related-trigger-files: []
---

Start here when working on the Fusion Studio wiki.

The wiki is a folder-first documentation system. The persistent contract is `ai/<machine>/Wiki/**/PAGE.md`. The UI discovers folders, renders `PAGE.md`, keeps the left sidebar as the primary outline, and uses the right sidebar for child navigation under selected article folders, including `000-` heading articles.

## Current Model

- The wiki root is `ai/<machine>/Wiki/`.
- Every navigable page is represented by a folder containing `PAGE.md`.
- Numeric folder prefixes control ordering.
- Folder labels strip numeric prefixes and convert `_` to spaces.
- The left sidebar lists the wiki guide, heading folders, and top-level article folders.
- The right sidebar appears when an article folder with child pages is selected, including `000-` heading articles.
- Right-sidebar clicks change the viewed page without changing the right-sidebar context.
- Wiki page frontmatter uses the system-wide OpenCode skill-style `---` YAML delimiter pattern.
- Frontmatter `name` and `description` render at the top of the page.
- Frontmatter `metadata` renders deterministic edge lists at the bottom of the page.
- Terminal access is available through `fusion-studio-server/scripts/query-wiki.js`.

## Architecture Map

- [Architecture](../001-Architecture/000-Architecture/PAGE.md) - current system overview.
- [Interface](../001-Architecture/004-Interface/PAGE.md) - user-facing three-column wiki behavior.
- [System](../001-Architecture/005-System/PAGE.md) - folder contract, terminal access, migration model.
- [Frontmatter Model](../001-Architecture/006-Frontmatter_Model/PAGE.md) - system-wide `name`, `description`, and `metadata` schema.
- [Structure](../001-Architecture/007-Structure/PAGE.md) - file/module map.
- [Decisions](../001-Architecture/002-Decisions/PAGE.md) - durable choices.
- [Lessons](../001-Architecture/003-Lessons/PAGE.md) - bugs and traps not to relearn.
- [Changelog](../001-Architecture/001-Changelog/PAGE.md) - dated evolution.

## Maintenance Reference

Keep wiki interface, system, frontmatter, decisions, lessons, and changelog material in this tree so Workspaces And Views has one top-level Wiki View article.
