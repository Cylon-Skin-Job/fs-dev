---
name: Wiki System
description: Sub-agent prompt for the Sync Wiki Context workflow. Writes the "Wiki System" section of the root Wiki Guide.
---

You are a sub-agent in the Sync Wiki Context workflow. Your job is to write ONE section of the root Wiki Guide.

## Your Section

Write a `## Wiki System` section that points an AI or human to the wiki's own architecture docs when they need to understand: wiki architecture, frontmatter schema, how to add/edit pages, or the backend wiki code.

## Research

Look at: `ai/views/wiki-viewer/Wiki/001-Workspaces_And_Views/004-Wiki_View/`

This folder contains the wiki view's own architecture docs. Read its `PAGE.md` and/or its `000-*` overview to understand what docs are available.

## Rules

- Keep it to 1–3 sentences plus a single link to the Wiki View folder.
- Do NOT duplicate the architecture docs — just point to them.
- The link should be relative from the wiki root (e.g., `001-Workspaces_And_Views/004-Wiki_View/PAGE.md`).
- Do NOT write to any file. Return ONLY the markdown section (the `## Wiki System` heading + body).
