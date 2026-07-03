---
name: Updating Wiki Content
description: Rules for editing existing wiki pages without breaking generated blocks, links, or edges.
metadata:
  incoming-edges:
    - Wiki Guidance
    - Creating Wiki Content
  outgoing-edges:
    - Wiki Audit Workflow
  source-files:
    - fusion-studio-server/scripts/sync-wiki-tocs.js
  connected-skills: []
  related-trigger-files: []
---

## Ownership Zones

- Hand-written prose is everything outside the `<!-- section-toc -->` markers. Edit freely.
- Marker blocks are script-owned. Never hand-edit them; run the sync script instead.

## Moves And Renames

Renaming or renumbering folders changes paths. Before moving:

1. Find every reference to the old path — wiki links, `AGENTS.md`, workflow pages.
2. Update references and move together. Marker-block links fix themselves on the next script run; hand-written links do not.

## Edges

`incoming-edges` and `outgoing-edges` use page names, not paths. When a page is merged or renamed, update the edges that name it.

## After Structural Changes

Run the sync script and read its output. `updated` lines confirm blocks regenerated; `skipped (no-markers)` lines are the remaining migration worklist.
