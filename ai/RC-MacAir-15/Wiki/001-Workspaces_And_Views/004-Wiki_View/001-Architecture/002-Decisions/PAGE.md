---
name: Wiki Decisions
description: Durable wiki system decisions covering folder structure, navigation behavior, metadata, and the current pre-release source of truth.
metadata:
  incoming-edges:
    - Wiki
    - Wiki Architecture
  outgoing-edges:
    - Wiki Interface
    - Wiki System
    - Markdown Frontmatter Model
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

## Decisions

- **Use `Wiki/` + `PAGE.md` as the source of truth.** Runtime wiki navigation is derived from the folder tree and page files.
- **Use numeric folders for ordering.** JSON files should not control wiki order.
- **Keep the root guide lightweight.** The root wiki guide can render with an empty right sidebar.
- **Article folders spawn right-sidebar navigation.** This includes `000-` heading articles when they have child pages; the right sidebar is the contextual child map for the selected article.
- **Split context selection from viewed page selection.** Left sidebar selection controls right-sidebar contents; right-sidebar clicks only change the center page.
- **Adopt system-wide YAML frontmatter.** Wiki pages use the same `---` delimited `name`, `description`, and `metadata` envelope as READMEs, skill documents, Office documents, and other searchable Markdown.
- **Render metadata as edge lists.** Incoming edges, outgoing edges, source files, connected skills, and related trigger files form the future deterministic update graph.
- **Keep maintenance docs under one Wiki article tree.** Interface, system, frontmatter, lessons, decisions, and changelog pages live under `Project > Wiki`.

## Open Questions

- Should every existing page receive frontmatter immediately, or should frontmatter be added opportunistically as pages are touched?
- Should terminal wiki search index frontmatter fields before full-text body search?
- Should metadata edge values be raw strings, normalized IDs, or typed paths?
