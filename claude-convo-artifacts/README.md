# Conversation Artifacts — Office Viewer Table Features

## Executive Summary

This conversation (`82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl`, 82 chat pairs) built out the Fusion Studio Office Viewer's table features in two arcs separated by two distinct bug hunts. **Arc 1 (CP0–CP22)** killed a broken table-resize cursor whose true root cause was a ProseMirror rebuild feedback loop driven by geometry-layer style writes into editable cells; it was resolved by a user-driven redesign (columns-only, overlay grab strip in the non-editable margin, commit-on-release, baked-in `<colgroup>`). **Arc 2 (CP22–CP68)** designed and wired cell/row/column background colors with a recency-ranked override cascade and a Google-Docs-style four-tier (None · Defaults · Document · Custom) picker, then killed a second regression (caret jumping to document end; the same root cause also explained why cell colors had never applied) whose root cause was writing `background-color` directly into `<td>` cells inside ProseMirror's editable content — resolved by painting colors through an injected stylesheet tagged only on table chrome. **Both fixes embody one principle: don't fight the editor, work outside the editable DOM.** The session closed with Office Viewer wiki sub-articles written and a proposed `Fusion_Home` wiki restructure (plus a memories-vs-skills inquiry) that was interrupted by a session-limit reset at CP81 before any restructure folders were created.

## Source

- **Conversation:** `82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl`
- **Length:** 82 chat pairs (CP0–CP81)
- **Full extract:** `conversation-extract.md`
- **Pair index:** `conversation-index.md`

## Citation Scheme

`[CP<id> @L<line>]` — chat-pair id and line in `conversation-extract.md`. Ranges use the form `[CP12–CP14 @L332–L383]`. Direct quotes are reproduced verbatim. Citations are never stripped or invented.

## Citation scheme note

The `@L<line>` labels refer to the **message-level labels printed in `conversation-extract.md`** (headers of the form `## CP# @L#` for user messages and `**ASSISTANT @L#:**` for assistant turns), not directly to jsonl source-line numbers. These extract labels are systematically one less than the corresponding jsonl line (an off-by-one: e.g., the `@L70` label maps to jsonl line 71), so a reader verifying against the raw jsonl will find the quoted content at `jsonl_line = @L + 1`. A small number of citations that point at mid-message quotes (e.g., `[CP0 @L203]`, `[CP21 @L1678]`) use the extract's own internal line numbers instead of an `@L` message label; those are content-correct but use a different numbering base than the rest.

## Overlap / Deduplication Notes

These artifacts were synthesized from three overlapping chunk reports:
- `_chunk1-report.md` — covers CP0–CP22
- `_chunk2-report.md` — covers CP19–CP46
- `_chunk3-report.md` — covers CP44–CP81

Overlap zones CP19–CP22 and CP44–CP46 were merged into single entries. The synthesizer found **no conflicts** in the overlap regions: both reports agree on what happened (chunk 2 emphasizes the CP22 pivot point and the "colors not yet confirmed applying" caveat; chunk 3 emphasizes the same picker as the bug-hunt setup — consistent, not contradictory). A separate `CONTRADICTIONS.md` will be produced by another reviewer.

## Table of Contents

| File | Contents |
|------|----------|
| [DECISIONS.md](./DECISIONS.md) | Chronological, deduplicated master list of every decision / design choice / override rule / architectural call, organized by theme, with a "User overrides of assistant recommendations" callout and an "Open / unconfirmed decisions" list |
| [LESSONS.md](./LESSONS.md) | Master list of engineering, debugging, and product lessons organized by theme; both bug hunts (cursor CP0–CP22, color+click CP47–CP68) covered in depth |
| [WORK_AND_CHANGES.md](./WORK_AND_CHANGES.md) | Chronological master log of actual work performed, grouped into four phases (A: cursor bug; B: color feature; C: second bug; D: wiki + memories), with verified end states and a clear COMPLETED-vs-PROPOSED split for Phase D |
| `conversation-extract.md` | The full chat extract this synthesis was built from |
| `conversation-index.md` | One-line index of all 82 chat pairs |
| `CONTRADICTIONS.md` | *(To be produced by a separate contradiction-review step)* |

## Intermediate Inputs

- `_chunk1-report.md` — table-resize cursor bug hunt (CP0–CP22)
- `_chunk2-report.md` — background-color feature design + wiring (CP19–CP46)
- `_chunk3-report.md` — second bug hunt + wiki/memories (CP44–CP81)
