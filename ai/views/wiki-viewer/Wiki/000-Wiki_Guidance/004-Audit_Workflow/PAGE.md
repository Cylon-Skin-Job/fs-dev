---
name: Wiki Audit Workflow
description: Recurring checks that keep the wiki accurate, linked, and free of ephemera.
metadata:
  incoming-edges:
    - Wiki Guidance
    - Updating Wiki Content
  outgoing-edges: []
  source-files:
    - fusion-studio-server/scripts/sync-wiki-tocs.js
    - fusion-studio-server/scripts/query-wiki.js
  connected-skills: []
  related-trigger-files: []
---

## Checks

1. **Marker sweep** — run the sync script; every `skipped (no-markers)` line is a section still on the old paradigm.
2. **Link integrity** — hand-written links must resolve to existing `PAGE.md` files; generated links fix themselves on the next run.
3. **Ephemera scan** — `grep -rn "_SPEC.md\|_PLAN.md" Wiki/` must return nothing.
4. **Source files** — spot-check `source-files` entries against the repo; remove entries for deleted or moved code.
5. **Status accuracy** — the Status list on the wiki front page must reflect which domains are built out versus stubs.

## Root Regeneration

The [Sync Wiki Context workflow](../../008-Workflows/001-Sync_Wiki_Context/PAGE.md) rebuilds the hand-written zone of the wiki front page with parallel sub-agents. Run it when wiki structure has changed significantly. The contents block between the markers stays script-owned either way.
