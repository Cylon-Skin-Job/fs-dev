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

## Names: Sidebar Label vs. Article Title

The folder name and the frontmatter `name` serve two different surfaces — keep
them deliberately different:

- **Folder name (`NNN-Name`)** is the **sidebar label** — the short link in the
  left navigation. Keep it short, scannable, and stable; it is the page's
  identity for sorting and linking. Underscores become spaces, so `005-Documents`
  reads as "Documents" and `008-Artifacts` reads as "Artifacts".
- **Frontmatter `name`** is the **article title** shown atop the page. It may be
  longer and more descriptive than the folder name. A folder `005-Documents` may
  carry `name: Document Editing Within Office View`; a folder `004-Tables` may
  carry `name: "Tables: Node View, Resize, and Background Colors"`.

The short folder label keeps the sidebar clean; the longer `name` gives the
reader (and the AI) a precise title in context.

### Quote any value that contains a colon

The viewer parses frontmatter as **strict YAML** (gray-matter), so a `name` (or
any scalar value) that contains a colon **must be quoted**, or the entire
frontmatter block is rejected and the page will not render. An unquoted
`name: Tables: Node View` reads as a nested mapping and fails parsing.

```yaml
# broken — page will not render
name: Tables: Node View, Resize, and Background Colors

# correct
name: "Tables: Node View, Resize, and Background Colors"
```

When in doubt, quote any value containing YAML-special characters (`: `, a
leading `-` or `?`, `{`, `[`, `#`, `&`, `*`, `!`, `|`, `>`).

## Heading Articles

One file, two zones, two audiences:

- Above `<!-- section-toc:start -->`: hand-written guidance — intent, preferences, decisions, reading order.
- Between the markers: generated contents, maintained by `fusion-studio-server/scripts/sync-wiki-tocs.js`. Never hand-edit inside the markers.

Humans get guidance plus chrome navigation; AI agents reading the raw file get the same guidance plus the routed map.

## Intent vs Knowledge

A heading article's sub-topics are the intent layer: vibe, decisions, lessons, and preferences — read when planning. Articles under a section are the knowledge layer: hard facts about how the code works — read when implementing.

## Frontmatter Contract

The `name`, `description`, and `metadata` frontmatter envelope is the system-wide Markdown contract, not a Wiki-only convention. Use it for Wiki pages, READMEs, skill documents, Office documents, and any Markdown file expected to be searchable or machine-routable.

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

Domain-specific structured data also lives under `metadata`. Office document display settings, for example, use `metadata.display`; Office table dimensions use `metadata.tables`.

## Content Rules

- Durable knowledge only. Never reference implementation specs, plan docs, or other ephemeral artifacts. When a spec matters for a task, the user supplies the pointer.
- `source-files` lists actual code files, never documents.
- Keep articles right-sized. Sparse clusters merge into one sub-article under their true parent; split a page only when one topic outgrows it.
- If a statement stays true when nothing is running, it belongs with the static contracts; if it describes a transition, it belongs with the lifecycle article.
- Do not hard-wrap ordinary prose inside a paragraph. The wiki renderer treats single newlines as visible line breaks, so inline text and links must stay on the same physical line unless the break is intentional. Use a blank line for a new paragraph, list syntax for lists, and explicit line breaks only when the rendered line break is part of the content.
