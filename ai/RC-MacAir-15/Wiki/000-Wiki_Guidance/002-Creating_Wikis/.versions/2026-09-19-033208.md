---
name: Creating Wiki Content
description: Steps for adding new sections, heading articles, main articles, and sub-articles.
metadata:
  incoming-edges:
    - Wiki Guidance
    - Wiki Style Guide
  outgoing-edges:
    - Wiki Style Guide
    - Updating Wiki Content
  source-files:
    - fusion-studio-server/scripts/sync-wiki-tocs.js
  connected-skills: []
  related-trigger-files: []
---

## New Section

1. Create `Wiki/NNN-Section_Name/`.
2. Create `NNN-Section_Name/000-Section_Name/PAGE.md` — frontmatter, hand-written guidance prose, and an empty marker block:

```markdown
<!-- section-toc:start -->
<!-- section-toc:end -->
```

3. Run the sync script. It fills the contents block and re-points parent contents at the new front page.

A section without a `000-` heading article renders as a non-clickable label in the viewer and has no front page. Do not create a folder-level `PAGE.md` for a section that has a heading article.

## New Main Article

1. Create `NNN-Article_Name/PAGE.md` with real content — never a bare table of contents.
2. End with a `## Children` link list when the article has sub-articles.
3. Run the sync script so parent contents blocks pick the article up.

## New Sub-Article

Create `NNN-Sub_Name/PAGE.md` under the article and add it to the parent's `## Children` list by hand.

## Sync Script

```bash
node fusion-studio-server/scripts/sync-wiki-tocs.js /path/to/workspace
```

Manual-run only. It maintains marker blocks in heading articles, generates TOC pages only for legacy folders without heading articles, and logs `skipped (no-markers)` for heading articles that have not opted in yet.
