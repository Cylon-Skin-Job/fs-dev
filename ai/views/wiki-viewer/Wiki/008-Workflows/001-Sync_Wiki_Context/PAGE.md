---
name: Sync Wiki Context
description: Regenerates the root Wiki Guide by launching 5 parallel sub-agents, each researching one section, then assembling the results.
---

# Sync Wiki Context

Regenerates the hand-written zone of `ai/views/wiki-viewer/Wiki/000-Wiki_Guidance/PAGE.md` — the wiki's front page. Run this when the wiki structure has changed (new domains, migrations completed, stubs populated) and the guide needs to catch up. The contents block between the `section-toc` markers is owned by `sync-wiki-tocs.js` and is not authored by this workflow.

## Steps

1. **Launch 5 sub-agents in parallel.** Hand each one the full text of its corresponding sub-article prompt:

   - [What Is This?](001-What_Is_This/PAGE.md)
   - [How It's Organized](002-How_Its_Organized/PAGE.md)
   - [Domains](003-Domains/PAGE.md)
   - [Wiki System](004-Wiki_System/PAGE.md)
   - [Status](005-Status/PAGE.md)

   Each sub-agent researches the current wiki state and returns a single markdown section. Tell them to return content only — do NOT write to any file.

2. **Trim each returned section** for conciseness. The oracle should be scannable in one screen, not exhaustive.

3. **Assemble** the 5 sections in order into a single file, preceded by this frontmatter:

   ```yaml
   ---
   name: Wiki Guide
   description: The Fusion Studio wiki — architecture, rules, and operations for the desktop workspace app.
   metadata:
     incoming-edges: []
     outgoing-edges: []
     source-files: []
     connected-skills: []
     related-trigger-files: []
   ---
   ```

4. **Write** the assembled content into the hand-written zone (above the `section-toc` markers) of `ai/views/wiki-viewer/Wiki/000-Wiki_Guidance/PAGE.md`, preserving the marker block.

## Notes

- The sub-agent prompts are generalized — they read the current wiki structure at runtime, so this works on re-runs after the wiki evolves.
- Domain links in the Domains section must use relative paths from the wiki root. Link to the domain's `000-` heading article when one exists (e.g., `007-Chat_System/000-Overview_and_References/PAGE.md`); domains with a heading article have no folder-level `PAGE.md`. Otherwise link to the folder-level `PAGE.md` (e.g., `002-Server_And_Runtime/PAGE.md`).
- The Status section requires the most judgment — verify which domains have moved from stub to built-out since the last run.
- The Wiki System section should point to the Wiki View architecture docs, not duplicate them.
