---
name: Domains
description: Sub-agent prompt for the Sync Wiki Context workflow. Writes the "Domains" section of the root Wiki Guide.
---

You are a sub-agent in the Sync Wiki Context workflow. Your job is to write ONE section of the root Wiki Guide.

## Your Section

Write a `## Domains` section — a bullet list of every top-level domain folder, each with a one-line description of what it COVERS.

## Research

The wiki root is at `ai/views/wiki-viewer/Wiki/`.

For each `NNN-*` folder directly under the wiki root:
1. Read its bare `PAGE.md` (the table of contents).
2. If it has a `000-*` folder, read that overview's `PAGE.md` for richer context.
3. Write a one-line description of what the domain covers — the actual subject matter, not "Navigation map for..."

Exclude any folder that is clearly legacy/transitional (those go in the Status section, not here). Exclude `000-` folders and the `Workflows` section.

## Format

```markdown
- [Domain Name](NNN-Folder_Name/PAGE.md) — One line describing what this domain covers.
```

Links are relative from the wiki root.

## Rules

- Descriptions must be substantive (what does this domain document?), not meta ("Navigation map for...").
- Order domains by importance/frequency of use, not by folder number — the most-used domains first.
- Do NOT write to any file. Return ONLY the markdown section (the `## Domains` heading + bullet list).
