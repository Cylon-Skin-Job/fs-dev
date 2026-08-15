# Handoff: Kimi Legacy Removal Slice E - Simplify Reveal Timing Constants

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Slices A, B, C, and D are complete. The visible typing cursor, frontend pressure gauge, inactive segment renderer layer, and old static chunk strategy layer have been removed.

Do not touch backend session architecture, warm-session expiration queue work, visual polish, Write File filename display, hourglass behavior, vendor-name aliases, persisted history hydration, or backend harness routing in this slice.

This slice is only about making reveal timing constants and comments match the current queue-based animation model.

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
2e9b468 refactor: delete static chunk strategies
```

If the tree is dirty, inspect before editing. Do not overwrite unrelated user/session work. Runtime files such as `fusion-studio-server/data/workspace-cache.json` may be dirty after app smoke/restart; leave unrelated runtime state alone.

## Current Issue

The code now uses a stable queue-based reveal model, but timing constants are split between:

- `fusion-studio-client/src/lib/timing.ts`
- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`
- `fusion-studio-client/src/lib/reveal/orchestrator.ts`
- `fusion-studio-client/src/components/ToolCallBlock.tsx`
- `fusion-studio-client/src/components/ToolsPanel.css`
- `fusion-studio-client/src/lib/tool-animate.ts`

Current examples:

- `LiveSegmentRenderer.tsx` owns `STABLE_TIMING_PROFILE`.
- `timing.ts` exports standalone fallback constants `INTER_CHUNK_PAUSE` and `COLLAPSE_DURATION`.
- `orchestrator.ts` imports `INTER_CHUNK_PAUSE` only as a fallback.
- `ToolCallBlock.tsx` imports `COLLAPSE_DURATION` only as a fallback.
- `ToolsPanel.css` has a `250ms` fallback for `--tool-collapse-ms`, while the JS collapse duration is currently `300ms`.
- `LiveSegmentRenderer.tsx` still has a few stale comments from earlier slices, such as catalog `renderer` / `renderMode` language.

## Files In Scope

- `fusion-studio-client/src/lib/timing.ts`
- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`
- `fusion-studio-client/src/components/ToolCallBlock.tsx`
- `fusion-studio-client/src/components/ToolsPanel.css`
- `fusion-studio-client/src/lib/reveal/orchestrator.ts`
- `fusion-studio-client/src/lib/reveal/types.ts`
- `fusion-studio-client/src/lib/tool-animate.ts`

Only touch another file if TypeScript proves it is directly required by this timing cleanup.

## Task

Simplify timing ownership without changing behavior.

Expected edits:

1. Move the stable timing profile out of `LiveSegmentRenderer.tsx` and into `timing.ts` as a named export, for example:

   ```ts
   export const DEFAULT_TIMING_PROFILE: TimingProfile = {
     shimmerTotal: 400,
     interChunkPause: 80,
     speedFast: 1,
     speedSlow: 6,
     batchSizeFast: 5,
     postTypingPause: 500,
     collapseDuration: 300,
     interSegmentPause: 100,
   };
   ```

   Keep these exact values unless a build or test proves the values already changed elsewhere.

2. Update `LiveSegmentRenderer.tsx` to import and return that default profile instead of defining `STABLE_TIMING_PROFILE` locally.
3. Remove standalone `INTER_CHUNK_PAUSE` and `COLLAPSE_DURATION` exports from `timing.ts` if no longer needed.
4. In `reveal/orchestrator.ts`, replace the `INTER_CHUNK_PAUSE` import with a local default or with `DEFAULT_TIMING_PROFILE.interChunkPause`. Prefer the smaller option that keeps dependency direction clear.
5. In `ToolCallBlock.tsx`, replace `COLLAPSE_DURATION` with `DEFAULT_TIMING_PROFILE.collapseDuration` or a local fallback that is explicitly synchronized with the default profile.
6. Update `ToolsPanel.css` fallback values for `--tool-collapse-ms` so they match the JS default collapse duration (`300ms`), not `250ms`.
7. Update stale comments so they describe:
   - queue lookahead, not pressure/backlog
   - catalog strategy/transform/reveal/speed/result-holding, not deleted segment renderers
   - parser/queue flushing in the orchestrator, not old fallback behavior
8. Keep `RESULT_TIMEOUT`, `POLL_INTERVAL`, `FLUSH_TIMEOUT`, and `LINE_END_HOLD` close to the modules that use them unless there is already a real second consumer.

Do not change animation behavior, reveal pacing, result holding, collapse sequencing, or CSS class names in this slice.

## Preserve These Values

- `shimmerTotal`: `400`
- `interChunkPause`: `80`
- `speedFast`: `1`
- `speedSlow`: `6`
- `batchSizeFast`: `5`
- `postTypingPause`: `500`
- `collapseDuration`: `300`
- `interSegmentPause`: `100`
- reveal orchestrator poll interval: `30`
- reveal orchestrator flush timeout: `150`
- line-end hold: `15`
- tool result timeout: `10_000`

## Preserve These Behaviors

- Text reveal remains semantic markdown/text chunk reveal.
- Thinking reveal remains line-by-line.
- Tool reveal speed still uses chunk queue lookahead.
- Await-result tools still wait for result content before revealing.
- Collapse duration remains synchronized between JS sleep and CSS transition.
- Tool completion remains tied to `tool_result`, not `turn_end`.
- No visible typing cursor appears.
- Do not split `LiveSegmentRenderer.tsx`.
- Do not touch backend wire/session code.

## Acceptance Checks

Run from repo root:

```bash
rg -n "INTER_CHUNK_PAUSE|COLLAPSE_DURATION|STABLE_TIMING_PROFILE" fusion-studio-client/src
```

Expected result: no hits.

Run:

```bash
rg -n "pressure|segment backlog|snapToFrontier|snapKeepLive|instantReveal|computeTimingProfile|PressureTier|getPressureTier" fusion-studio-client/src
```

Expected result: no hits.

Run:

```bash
rg -n "segment-renderers|SegmentContentRenderer|lineStreamRenderer|codeRenderer|diffRenderer|groupedSummaryRenderer|renderMode from the catalog|strategy, transform, renderer" fusion-studio-client/src
```

Expected result: no hits, except legitimate `getToolRenderer` / `tool-renderers` identifiers.

Run:

```bash
rg -n "--tool-collapse-ms, 250ms|collapseDuration: 300|collapseMsRef = useRef\\(300\\)" fusion-studio-client/src
```

Expected result: no hits. The default collapse value should come from the named timing profile, and CSS fallback should be `300ms`.

Also re-run prior slice guards:

```bash
rg -n "CURSOR_HTML|injectCursor|rv-typing-cursor|showCursor" fusion-studio-client/src
rg -n "from ['\"][^'\"]*chunk-strategies/(line|read|shell|think|write|types|text)['\"]|textStrategy|lineStrategy|readStrategy|shellStrategy|thinkStrategy|writeStrategy" fusion-studio-client/src
```

Expected result for both: no hits.

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/timing.ts src/components/LiveSegmentRenderer.tsx src/components/ToolCallBlock.tsx src/lib/reveal/orchestrator.ts src/lib/reveal/types.ts src/lib/tool-animate.ts
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

1. Plain text response with multiple paragraphs.
2. Thinking-heavy response.
3. Shell command with short output.
4. Shell command with multi-line output.
5. A write or edit tool if easy to trigger.
6. Confirm collapse timing still feels unchanged.

Expected: reveal pacing and collapse behavior are unchanged from before this slice.

## Commit Guidance

If validation passes, make one commit for this slice only.

Suggested commit message:

```text
refactor: simplify reveal timing defaults
```

Do not include backend stabilization changes, roadmap edits, `.gitignore` changes, user/runtime state files, visual polish, Write File filename display, hourglass work, or Phase 5 backend harness route decisions.

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
