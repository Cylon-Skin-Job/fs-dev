---
name: Wiki Audit Workflow
description: Recurring checks that keep the wiki accurate, linked, and free of ephemera.
metadata:
  source-files:
    - fusion-studio-server/scripts/wiki.js
    - fusion-studio-server/lib/wiki/audit/run.js
    - fusion-studio-server/lib/workspace/ai-paths.js
  last-modified: "2026-09-28T04:56:08Z"
---

## Checks

1. **Marker sweep** — run the sync script in a disposable wiki copy when navigation changes; `skipped (no-markers)` means the page did not opt into generated navigation, which is normal for ordinary articles. Review headings that should have a generated contents block.
2. **Link integrity** — hand-written links must resolve to existing `PAGE.md` files; generated links fix themselves on the next run.
3. **Ephemera scan** — search wiki article bodies for references to temporary implementation specs or plan documents. Exclude this checklist’s own example wording and review each match; a filename token alone is not proof that a live article depends on ephemera.
4. **Source files** — validate `metadata.source-files` against real code ownership and existing repository-relative files; repair moved/deleted references. Knowledge pages without sources need review; guidance may use `[]`. Do not maintain edge lists.
5. **Status accuracy** — distinguish documentation coverage, source verification, approved intent and implemented behavior. Child folders alone prove none of the latter three.
6. **Machine namespace portability** — product-shipped scripts must not hardcode a machine folder name such as `RC-MacAir-15`. Resolve the machine name of record from `system_config.local_machine_name` or the server path helper, assign it to a variable, and build paths such as `ai/<machine>/Wiki` from that variable so scripts remain interchangeable between machines.

## Root Navigation

The current command is `node fusion-studio-server/scripts/wiki.js audit /path/to/workspace`. For structural changes, run it on a disposable wiki copy, inspect changed blocks, and import only intended stable generated navigation. The marker block is script-owned. Review the hand-written Guide status and links separately; [Sync Wiki Context](../../008-Workflows/001-Sync_Wiki_Context/PAGE.md) describes the separate read-only research and coordinator-owned Guide update.

## Metadata And Timestamp Check

The [Wiki Style Guide](../001-Style_Guide/PAGE.md#frontmatter-contract) defines source-only accountability metadata plus a quoted UTC `last-modified` string. Check new/edited pages against that schema. Missing timestamps on older untouched pages mean unknown; they must not be filled with an invented date. Metadata migration records its own edit time and does not verify the page's facts.

The current command is `node fusion-studio-server/scripts/wiki.js audit /path/to/workspace`. It does not implement automatic `last-modified` stamping or establish source freshness from that field. After actual generated changes, stamp the affected pages' frontmatter; preserve no-op pages. Review source changes against page claims separately, and do not treat a recent typo or navigation edit as a factual audit. Legacy generated TOC metadata may require normalization after creation; this is not authorization to rewrite untouched pages.
