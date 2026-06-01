# Handoff: Kimi Legacy Removal Slice C - Consolidate Tool Animation Catalog

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A and B are complete. The stabilization checkpoint for dead-wire prompt recovery is also complete at commit `3d306c0`.

Do not touch backend session architecture, warm-session expiration queue work, frontend typing cursor cleanup, frontend pressure cleanup, visual polish, Write File filename display, hourglass behavior, vendor-name aliases, persisted history hydration, or static chunk strategy deletion in this slice.

This slice is only about removing the inactive `segment-renderers` presentation layer from the tool animation catalog.

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

Confirm:

```bash
git rev-parse --show-toplevel
git status --short
git log -1 --oneline
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

Expected starting point should be at or after:

```text
3d306c0 fix: recover prompts for suspended kimi threads
```

If the tree is dirty, inspect the changes before editing. Do not overwrite unrelated user/session work.

## Current Issue

`fusion-studio-client/src/lib/catalog.ts` still imports `SegmentContentRenderer` and `segment-renderers/*`.

Current hits before this slice:

```text
fusion-studio-client/src/lib/catalog.ts
fusion-studio-client/src/lib/segment-renderers/code.ts
fusion-studio-client/src/lib/segment-renderers/diff.ts
fusion-studio-client/src/lib/segment-renderers/grouped-summary.ts
fusion-studio-client/src/lib/segment-renderers/line-stream.ts
fusion-studio-client/src/lib/segment-renderers/types.ts
```

But `fusion-studio-client/src/lib/tool-animate.ts` does not use those renderers. It ultimately renders chunks with:

```ts
return chunk.content;
```

Final tool presentation is handled by the active `fusion-studio-client/src/lib/tool-renderers/*` layer. Keep that layer.

## Files In Scope

- `fusion-studio-client/src/lib/catalog.ts`
- `fusion-studio-client/src/lib/tool-animate.ts`
- `fusion-studio-client/src/lib/segment-renderers/*`

Only touch another file if TypeScript proves it is directly required by removing `segment-renderers`.

## Task

Remove the inactive segment renderer layer.

Expected edits:

1. Remove `SegmentContentRenderer` from `CatalogEntry`.
2. Remove the `renderer` property from every catalog entry.
3. Remove imports of:

   ```text
   ./segment-renderers/types
   ./segment-renderers/line-stream
   ./segment-renderers/code
   ./segment-renderers/diff
   ```

4. Delete the full directory:

   ```text
   fusion-studio-client/src/lib/segment-renderers/
   ```

5. Update `catalog.ts` comments so it says the catalog owns:
   - chunk strategy
   - optional transforms
   - reveal controller
   - speed override
   - result-holding behavior

   It should not claim to own presentation/content rendering.

6. Update `tool-animate.ts` comments from `transform + render` language to `transform + reveal text` or equivalent.
7. Keep `renderChunkToText()` only if it still clarifies the adapter. If it remains, its comment must not imply the deleted renderer layer still exists.

## Preserve These Behaviors

- Tool UI should look unchanged.
- Shell, read, grep, glob, fetch, search, write, edit, todo, thinking, and subagent reveal behavior should remain unchanged.
- Tool completion remains tied to `tool_result`, not `turn_end`.
- Await-result tools still wait for result content before revealing.
- Chunk queue lookahead still controls fast/slow reveal pacing.
- No visible typing cursor appears.
- Do not split `LiveSegmentRenderer.tsx`.
- Do not touch backend wire/session code.

## Acceptance Checks

Run from repo root:

```bash
rg -n "segment-renderers|SegmentContentRenderer|lineStreamRenderer|codeRenderer|diffRenderer|groupedSummaryRenderer" fusion-studio-client/src
```

Expected result: no hits.

Confirm the directory is gone:

```bash
test ! -e fusion-studio-client/src/lib/segment-renderers
```

Also re-run prior slice guards:

```bash
rg -n "CURSOR_HTML|injectCursor|rv-typing-cursor|showCursor" fusion-studio-client/src
rg -n "pressure|snapToFrontier|snapKeepLive|instantReveal|computeTimingProfile|PressureTier|getPressureTier" fusion-studio-client/src
```

Expected result for both: no hits.

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/catalog.ts src/lib/tool-animate.ts
```

Then:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Server tests are not required for this slice unless you touch server code. You should not touch server code.

## Manual Smoke

If validation passes, restart the app:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Smoke these in a chat thread:

1. Shell command with short output.
2. Shell command with multi-line output.
3. Read file.
4. Grep with matches.
5. Glob with multiple paths.
6. Write or edit tool if easy to trigger.
7. Todo update if easy to trigger.

Expected: visual presentation is unchanged from before this slice.

## Commit Guidance

If validation passes, make one commit for this slice only.

Suggested commit message:

```text
refactor: remove inactive segment renderers
```

Do not include backend stabilization changes, roadmap edits, `.gitignore` changes, user state files, visual polish, Write File filename display, hourglass work, or Phase 3 static chunk-strategy deletion.

## Final Response Required

Report:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Commit SHA if committed.
- Files changed.
- Acceptance `rg` results.
- Build/lint results.
- `git diff --check` result.
- Manual smoke coverage completed or skipped.
- Any code standards exception, risk, follow-up work, or blocker.
