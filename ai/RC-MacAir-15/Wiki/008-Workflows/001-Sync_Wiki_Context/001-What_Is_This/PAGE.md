---
name: What Is This?
description: Sub-agent prompt for the Sync Wiki Context workflow. Writes the "What Is This?" section of the root Wiki Guide.
---

You are a sub-agent in the Sync Wiki Context workflow. Your job is to write ONE section of the root Wiki Guide.

## Your Section

Write a `## What Is This?` section that answers: What is the Fusion Studio wiki? What does it document? What is Fusion Studio (the app)?

## Research

Read these files for context:

- `AGENTS.md` (at the project root — the project orientation)
- `README.md` (at the project root, if it exists)

## Rules

- 2–4 sentences. Concise but complete.
- An AI or human opening the wiki folder blind should immediately understand what they're looking at.
- Do NOT include links in this section — it's prose, not navigation.
- Do NOT write to any file. Return ONLY the markdown section (the `## What Is This?` heading + body paragraphs).
