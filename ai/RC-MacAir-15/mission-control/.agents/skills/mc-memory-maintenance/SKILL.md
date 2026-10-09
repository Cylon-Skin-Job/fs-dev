---
name: mc-memory-maintenance
description: Initialize, migrate or maintain an explicitly selected Mission Control working-memory folder, its Markdown records and static index. Use for schema changes, source-backed reconciliation or structured Capture routing; use Capture for current conversation and Checkpoint for registered history. Does not dispatch agents or implement product work.
---

# Memory Maintenance

Perform the assigned durable-record operation in the exact folder named by the owner or current assignment. Read applicable AGENTS.md files, local index, relevant bulletin and declared document dependencies. If the folder is incomplete, repair only the assigned local contract; do not resolve upward into MC’s own memory as a substitute.

Read [record rules and schema](references/records.md) for authority thresholds, routing and schema changes. This procedure replaces the necessary record-maintenance portion of Second Brain v1; it does not adopt that umbrella role or dispatch subagents. Research is a separate bounded assignment using applicable tools and procedures.

## Initialize or migrate

1. Establish the exact destination and purpose. For a new Launchpad domain, adapt `<MC-home>/launchpad/template/AGENTS.md`: replace its inert-template preamble with the actual main/side role contract, domain scope and sources. The adjacent five core documents, REFERENCES.md, CHANGE_SURFACE.md, CONTRACTS.md, BULLETIN.md and index.json provide starter structures. Use the three extensions when relevant; omit unused ones and their index entries rather than populating them artificially. Adapt titles, authority/prompt prose, categories and relative root paths to the selected folder; replace prompts with substantive records or honest unresolved state. Preserve existing project schemas rather than overwriting them. Never activate the template itself.
2. Survey the selected source notes and instructions only. Preserve their content roles, stable IDs, owner decisions, open questions and provenance; newer explicit owner direction wins for the contract it addresses.
3. Establish substantive synthesis, intent, decisions, issues and proposals as warranted. Preserve established local filenames and schema; do not create empty extensions. Create a static index and local bulletin. Keep task UUIDs and checkpoint cursors outside the index.
4. Record source-to-destination ownership and revisions, repair links and relative root paths, and identify the canonical destination for future edits. Do not silently leave two competing live copies. Source deletion or relocation requires the migration assignment’s authority; otherwise preserve the source and mark the remaining cutover explicitly.
5. Validate and return the re-entry path, migrated scope, unresolved contradictions and next safe action. Do not invent a registered main task or checkpoint cursor.

## Maintain or evolve

Re-read targets before writing and respect file/section ownership. Classify claims by evidence and authority; keep uncertain owner choices open. Make the smallest coherent change, preserve source backlinks, and update index metadata only when paths, document roles, H2 headings or record schemas change. Use the record reference for earned schema extensions and structured CAP-NNN routing. Keep current state in Markdown, not the static index.

## Helpers and verification

Run paths relative to this skill directory, passing the actual folder explicitly:

```text
python3 <skill-folder>/scripts/validate_index.py <working-folder>
python3 <skill-folder>/scripts/route_capture.py <working-folder> check
```

The second command is only for a compatible structured Capture schema. It is not a reason to normalize an existing narrative synthesis. For compatible promotion/routing/closure, inspect `route_capture.py --help` and use `--dry-run` before a write when useful. The helper allocates IDs and edits records; the agent supplies semantics and authority. It is not a concurrent-writer lock.

Report sources, changed files, checks and outcomes, unresolved intent and the next action. Do not invoke clean-room review, create sessions, edit product code or advance a history cursor as an incidental part of this skill.
