---
name: "Sync Wiki Context"
description: "Refresh the Wiki Guide through five read-only research assignments and one accountable editor."
metadata:
  source-files:
    - fusion-studio-server/scripts/wiki.js
    - fusion-studio-server/lib/wiki/audit/toc-sync.js
  last-modified: "2026-09-28T04:56:08Z"
---

Refresh the hand-written zone of `ai/<machine>/Wiki/000-Wiki_Guidance/PAGE.md` when structure or coverage changes. Reading this workflow does not itself request that it be run.

## Procedure

1. When this workflow is requested, assign five read-only researchers the prompts below. Each returns its section, inspected sources and material uncertainties; none writes files.
2. The coordinator checks all five reports against current wiki owners and source evidence, resolves contradictions and retains explicit open choices. Do not infer shipped behavior from documentation volume.
3. Preserve a complete preimage under `.versions/` before rewriting the Guide. Assemble concise prose above its generated marker block; preserve the block until staged generation. Use `name`, `description`, `metadata.source-files` (usually `[]` for this routing page), and a quoted UTC `metadata.last-modified` set to the actual edit time. Do not author edge metadata.
4. Resolve links relative to the Guide's folder, not the Wiki root: for example `../007-Chat_System/000-Overview_and_References/PAGE.md`. Prefer each section's `000-` heading; use folder `PAGE.md` only without a heading.
5. Run `node fusion-studio-server/scripts/wiki.js audit /path/to/disposable/Wiki` on a staged copy. Inspect and import only intended generated changes, stamp changed pages and preserve no-op pages. Do not import the audit's state files.
6. Validate links, frontmatter, sources and generated-block stability. Report actual changes and any unresolved factual gaps; do not declare the whole wiki verified.

Follow [Updating Wiki Content](../../000-Wiki_Guidance/003-Updating_Wikis/PAGE.md) and [Audit Workflow](../../000-Wiki_Guidance/004-Audit_Workflow/PAGE.md).

## Research assignments

- [What Is This?](001-What_Is_This/PAGE.md)
- [How It's Organized](002-How_Its_Organized/PAGE.md)
- [Domains](003-Domains/PAGE.md)
- [Wiki System](004-Wiki_System/PAGE.md)
- [Status](005-Status/PAGE.md)
