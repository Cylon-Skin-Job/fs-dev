---
name: Wiki View
description: A folder-first workspace reference view and route to specialist Wiki documentation.
metadata:
  source-files:
    - fusion-studio-client/src/components/ContentArea.tsx
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-server/lib/wiki/wiki-tree.js
  last-modified: "2026-09-28T04:56:08Z"
---

The **Wiki** view presents the workspace's `ai/<machine>/Wiki` tree as navigable articles. Its built-in React surface reads folder-backed `PAGE.md` files through the workspace file route. The template is one of the five selected for a newly created workspace. The article folder and its frontmatter describe content; the view instance controls where the Wiki content root resolves. See [View Architecture](../../002-View_Architecture/PAGE.md) for that distinction.

## Current status and limits

`wiki-viewer` is in the bundled template catalog and the fixed React component map. This is a source-inspected mounting fact, not certification of every page or a future plugin implementation. Current wiki content lives under the machine-scoped `ai` tree; the intended editable instance and protected plugin boundary are explained in [View Configuration And Agents](../../022-View_Configuration_And_Agents/PAGE.md).

The [Wiki architecture](../001-Architecture/000-Architecture/PAGE.md) and its children are retained specialist references. They were not rewritten or recertified by this Workspaces And Views reconstruction. Use the [Wiki Style Guide](../../../000-Wiki_Guidance/001-Style_Guide/PAGE.md) for current article authoring metadata and navigation rules.

<!-- section-toc:start -->
## Technical Articles in this Wiki Section

- [Architecture](../001-Architecture/000-Architecture/PAGE.md) - Overview of the wiki architecture, including the folder-first content contract, UI navigation model, frontmatter metadata, and terminal query path.
<!-- section-toc:end -->
