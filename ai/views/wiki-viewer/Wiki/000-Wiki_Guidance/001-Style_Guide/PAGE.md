---
name: Wiki Style Guide
description: Structure, naming, frontmatter, and content rules for writing Fusion Studio wiki pages.
metadata:
  incoming-edges:
    - Wiki Guidance
  outgoing-edges:
    - Creating Wiki Content
    - Updating Wiki Content
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

## Folder Scheme

- `NNN-Name` — sort prefix + label. The number controls order; underscores become spaces in the title.
- `000-Name/` — the heading article: a folder's front page. Strictly `000-`; there is no fallback to `001-`.
- Folders with a `000-` child have **no folder-level `PAGE.md`**. The heading article is the page.
- Main articles (no `000-` child) put real content in their folder `PAGE.md` and link sub-articles at the end under `## Children`.
- Sub-articles are leaf pages. The pattern recurses at every depth.

## Heading Articles

One file, two zones, two audiences:

- Above `<!-- section-toc:start -->`: hand-written guidance — intent, preferences, decisions, reading order.
- Between the markers: generated contents, maintained by `fusion-studio-server/scripts/sync-wiki-tocs.js`. Never hand-edit inside the markers.

Humans get guidance plus chrome navigation; AI agents reading the raw file get the same guidance plus the routed map.

## Intent vs Knowledge

A heading article's sub-topics are the intent layer: vibe, decisions, lessons, and preferences — read when planning. Articles under a section are the knowledge layer: hard facts about how the code works — read when implementing.

## Frontmatter Contract

Every page carries name, description, and metadata:

```yaml
name: Chat Reply Payloads
description: One actionable line. Say when to use the page, not just what it is.
metadata:
  incoming-edges: []   # page names that link here
  outgoing-edges: []   # page names this page links to
  source-files: []     # real code files only
  connected-skills: []
  related-trigger-files: []
```

## Content Rules

- Durable knowledge only. Never reference implementation specs, plan docs, or other ephemeral artifacts. When a spec matters for a task, the user supplies the pointer.
- `source-files` lists actual code files, never documents.
- Keep articles right-sized. Sparse clusters merge into one sub-article under their true parent; split a page only when one topic outgrows it.
- If a statement stays true when nothing is running, it belongs with the static contracts; if it describes a transition, it belongs with the lifecycle article.
