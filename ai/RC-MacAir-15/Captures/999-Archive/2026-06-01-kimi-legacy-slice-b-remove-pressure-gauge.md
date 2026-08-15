# Handoff: Kimi Legacy Removal Slice B - Remove Frontend Pressure Gauge

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
```

Assume Slice A has already removed the visible typing cursor. Do not reintroduce cursor rendering.

This slice removes the old frontend segment-backlog pressure gauge and its instant-reveal/snap escape hatches. Keep the current queue/chunk reveal behavior: text and tool reveal speed should remain based on real chunk lookahead and the current stable timing profile, not on segment backlog.

Do not touch backend harness routing, frontend vendor-name aliases, websocket routing contracts, persisted thread hydration, catalog renderer cleanup, or static chunk-strategy deletion in this slice.

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

Confirm:

```bash
git rev-parse --show-toplevel
git status --short
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

## Files Likely In Scope

- `fusion-studio-client/src/lib/pressure.ts`
- `fusion-studio-client/src/lib/timing.ts`
- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`
- `fusion-studio-client/src/lib/tool-animate.ts`
- `fusion-studio-client/src/lib/text/text-animate.ts`
- `fusion-studio-client/src/lib/reveal/types.ts`
- `fusion-studio-client/src/lib/reveal/orchestrator.ts`
- `fusion-studio-client/src/components/ToolCallBlock.tsx`

Optional, only if it keeps the stable timing contract clearer:

- `fusion-studio-client/src/lib/render-timing.ts`

## Task

Remove the old pressure gauge and any behavior that can skip, snap, or instantly reveal content because of segment backlog.

Expected edits:

1. Move the small stable timing contract out of `pressure.ts`.
   - Either put `TimingProfile` and the stable defaults in `timing.ts`, or create `render-timing.ts`.
   - The stable profile should include only fields that are still used: shimmer duration, inter-chunk pause, fast/slow typing speeds, fast batch size, post-typing pause, collapse duration, and inter-segment pause.
2. Remove all imports from `./pressure` / `../lib/pressure`.
3. Delete `fusion-studio-client/src/lib/pressure.ts` once imports are gone.
4. Remove `instantReveal` from `RevealOptions`.
5. Remove the instant-reveal branch from `reveal/orchestrator.ts`.
6. Remove `instantBreak` and pressure checks from `text-animate.ts`.
7. Keep text reveal finalization intact: when complete, it should still render the full final HTML.
8. Update comments from pressure/backlog language to queue/chunk language.
9. Remove references to `snapToFrontier`, `snapKeepLive`, `computeTimingProfile`, pressure tiers, and pressure-adjusted timing.
10. Do not split `LiveSegmentRenderer.tsx`; the code standards page explicitly says not to split it.

## Preserve These Behaviors

- Thinking reveals line-by-line.
- Main text reveals by semantic markdown/text chunks.
- Newline rhythm / line-end hold remains.
- Tool reveal speed still uses chunk queue lookahead.
- `turn_end` does not finalize until live reveal finishes.
- Tool completion remains tied to `tool_result`, not `turn_end`.
- No visible typing cursor appears.
- Subagent live updates still append and do not block later assistant text.

## Acceptance Checks

Run from repo root:

```bash
rg -n "pressure|snapToFrontier|snapKeepLive|instantReveal|computeTimingProfile|PressureTier|getPressureTier" fusion-studio-client/src
```

Expected result: no hits.

Also run:

```bash
rg -n "CURSOR_HTML|injectCursor|rv-typing-cursor|showCursor" fusion-studio-client/src
```

Expected result: no hits.

Confirm `pressure.ts` is deleted:

```bash
test ! -e fusion-studio-client/src/lib/pressure.ts
```

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/components/LiveSegmentRenderer.tsx src/components/ToolCallBlock.tsx src/lib/tool-animate.ts src/lib/reveal/orchestrator.ts src/lib/reveal/types.ts src/lib/text/text-animate.ts src/lib/timing.ts
```

If you create `src/lib/render-timing.ts`, include it in eslint:

```bash
npx eslint src/lib/render-timing.ts
```

Then run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Optional server sanity, only if you touch shared types or anything outside client:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

## Manual Smoke

If validation passes, restart the app:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Focus smoke on:

1. Plain assistant text with multiple paragraphs.
2. Thinking-heavy response.
3. Shell command with short output.
4. Shell command with long enough output to verify it continues chunking rather than dumping.
5. A tool result that waits for completion before rendering, such as read/grep/write if easy to trigger.
6. Confirm no visible typing cursor appears.
7. Confirm the assistant turn finalizes only after the live reveal finishes.

## Commit Guidance

If validation passes, make one commit for this slice only.

Suggested commit message:

```text
refactor: remove frontend pressure gauge
```

Do not include unrelated Slice A corrections, backend edits, visual polish, catalog renderer cleanup, or chunk-strategy deletion.

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
