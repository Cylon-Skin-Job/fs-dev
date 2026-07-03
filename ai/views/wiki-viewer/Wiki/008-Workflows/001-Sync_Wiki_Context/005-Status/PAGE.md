---
name: Status
description: Sub-agent prompt for the Sync Wiki Context workflow. Writes the "Status" section of the root Wiki Guide.
---

You are a sub-agent in the Sync Wiki Context workflow. Your job is to write ONE section of the root Wiki Guide.

## Your Section

Write a `## Status` section that notes the current migration/buildout state of the wiki — which domains are fully built out, which are stubs (planned but not populated), and which are legacy/transitional.

## Research

The wiki root is at `ai/views/wiki-viewer/Wiki/`.

For each top-level domain folder:
1. Check if it has actual child article folders (not just a bare `PAGE.md` with "Planned Children" text).
2. **Fully built out** — has real child folders with `PAGE.md` content.
3. **Stub** — `PAGE.md` describes planned children but no actual child folders exist yet.
4. **Legacy/transitional** — content being migrated into other domains. Often has "Migration Sources" in its `PAGE.md`.

Check the legacy buckets specifically:
- `001-Project` — read its `PAGE.md`. Are its children migration sources for other domains?
- `002-System_Tools` — read its `PAGE.md`. Is content being moved elsewhere?

## Format

Group into three categories with concise bullet lists:

```markdown
**Fully built out:** Domain A, Domain B, ...

**Stubs (planned, not yet populated):** Domain C, Domain D, ...

**Legacy (content being migrated):**
- [Project](001-Project/PAGE.md) — brief note on what's being moved.
- [System Tools](002-System_Tools/PAGE.md) — brief note.
```

End with a one-line rule: "Write new content into the durable domains. Leave legacy buckets as read-only sources."

## Rules

- This section requires the most judgment — verify the actual state, don't trust old descriptions.
- Keep it concise — a reader should understand the migration state at a glance.
- Do NOT write to any file. Return ONLY the markdown section (the `## Status` heading + body).
