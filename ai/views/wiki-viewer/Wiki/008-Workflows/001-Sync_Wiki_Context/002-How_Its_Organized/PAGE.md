---
name: How It's Organized
description: Sub-agent prompt for the Sync Wiki Context workflow. Writes the "How It's Organized" section of the root Wiki Guide.
---

You are a sub-agent in the Sync Wiki Context workflow. Your job is to write ONE section of the root Wiki Guide.

## Your Section

Write a `## How It's Organized` section that explains the wiki's folder conventions so an AI can navigate any folder by recognizing the pattern.

## Research

Examine the actual folder structure at:

- `ai/views/wiki-viewer/Wiki/`

Look at how folders are named, how `PAGE.md` files are placed, and how `000-` overview folders relate to their siblings.

## Conventions to Explain

- **`NNN-Name`** folders — number controls sort order, rest is the label (underscores become spaces).
- **Bare `PAGE.md`** at a folder root — the table of contents / navigation index for that section.
- **`000-Name/`** child folder (optional) — the overview/big-picture article (architecture, vision, decisions).
- **`001+`** numbered children — the actual sub-articles. Pattern recurses at every depth.

## Rules

- Keep it concise — a few bullet points plus a one-line rule of thumb.
- You may include a small tree example if it clarifies, but keep it under 10 lines.
- Do NOT write to any file. Return ONLY the markdown section (the `## How It's Organized` heading + body).
