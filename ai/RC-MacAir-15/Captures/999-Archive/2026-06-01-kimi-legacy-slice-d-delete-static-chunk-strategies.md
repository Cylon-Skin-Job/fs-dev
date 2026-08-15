# Handoff: Kimi Legacy Removal Slice D - Delete Static Chunk Strategies

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Slices A, B, and C are complete. The active tool animation catalog now uses only `chunk-strategies/active/*`.

Do not touch backend session architecture, warm-session expiration queue work, frontend typing cursor cleanup, frontend pressure cleanup, the tool animation catalog renderer cleanup from Slice C, visual polish, Write File filename display, hourglass behavior, vendor-name aliases, persisted history hydration, or reveal timing simplification in this slice.

This slice is only about deleting the old static chunk strategy layer.

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
71627aa refactor: remove inactive segment renderers
```

If the tree is dirty, inspect before editing. Do not overwrite unrelated user/session work. Runtime files such as `fusion-studio-server/data/workspace-cache.json` may be dirty after app smoke/restart; leave unrelated runtime state alone.

## Current Issue

The useful strategy layer is:

```text
fusion-studio-client/src/lib/chunk-strategies/active/*
```

The old static strategy files still exist:

```text
fusion-studio-client/src/lib/chunk-strategies/line.ts
fusion-studio-client/src/lib/chunk-strategies/read.ts
fusion-studio-client/src/lib/chunk-strategies/shell.ts
fusion-studio-client/src/lib/chunk-strategies/think.ts
fusion-studio-client/src/lib/chunk-strategies/write.ts
fusion-studio-client/src/lib/chunk-strategies/types.ts
fusion-studio-client/src/lib/chunk-strategies/text.ts
```

Current direct dependency:

```text
fusion-studio-client/src/lib/text/text-animate.ts
```

It imports `textStrategy` only to read:

```ts
textStrategy.codeFenceAsLookahead ?? true
```

That should be replaced with a local constant/config near `text-animate.ts`.

## Files In Scope

- `fusion-studio-client/src/lib/text/text-animate.ts`
- `fusion-studio-client/src/lib/text/chunk-buffer.ts`
- `fusion-studio-client/src/lib/text/speed-attenuator.ts`
- `fusion-studio-client/src/lib/chunk-strategies/line.ts`
- `fusion-studio-client/src/lib/chunk-strategies/read.ts`
- `fusion-studio-client/src/lib/chunk-strategies/shell.ts`
- `fusion-studio-client/src/lib/chunk-strategies/think.ts`
- `fusion-studio-client/src/lib/chunk-strategies/write.ts`
- `fusion-studio-client/src/lib/chunk-strategies/types.ts`
- `fusion-studio-client/src/lib/chunk-strategies/text.ts`

Only touch another file if TypeScript proves it is directly required by deleting these files.

## Task

Delete the inactive static chunk strategy layer.

Expected edits:

1. Remove this import from `text-animate.ts`:

   ```ts
   import { textStrategy } from '../chunk-strategies/text';
   ```

2. Replace `textStrategy.codeFenceAsLookahead ?? true` with a local constant near the top of `text-animate.ts`, for example:

   ```ts
   const CODE_FENCE_AS_LOOKAHEAD = true;
   ```

   Keep behavior unchanged.

3. Delete the old static strategy files:

   ```text
   fusion-studio-client/src/lib/chunk-strategies/line.ts
   fusion-studio-client/src/lib/chunk-strategies/read.ts
   fusion-studio-client/src/lib/chunk-strategies/shell.ts
   fusion-studio-client/src/lib/chunk-strategies/think.ts
   fusion-studio-client/src/lib/chunk-strategies/write.ts
   fusion-studio-client/src/lib/chunk-strategies/types.ts
   fusion-studio-client/src/lib/chunk-strategies/text.ts
   ```

4. Keep `fusion-studio-client/src/lib/chunk-strategies/active/*`.
5. Update comments in `chunk-buffer.ts` and `speed-attenuator.ts` only where they still imply old static strategy ownership. Comments should describe the current queue/lookahead model.

Do not change speed constants, inter-chunk timing, line-end hold behavior, reveal controller behavior, tool result holding, or catalog entries in this slice.

## Preserve These Behaviors

- Text reveal remains semantic markdown/text chunk reveal.
- Thinking reveal remains line-by-line.
- Code fences keep the existing lookahead behavior.
- Newline rhythm and line-end hold remain unchanged.
- Tool chunk strategies under `active/*` remain unchanged.
- Tool completion remains tied to `tool_result`, not `turn_end`.
- No visible typing cursor appears.
- Do not split `LiveSegmentRenderer.tsx`.
- Do not touch backend wire/session code.

## Acceptance Checks

Run from repo root:

```bash
rg -n "from ['\"]\\.\\.?/chunk-strategies/(line|read|shell|think|write|types|text)['\"]|from ['\"]\\.\\.?/\\.\\./chunk-strategies/(line|read|shell|think|write|types|text)['\"]|textStrategy|lineStrategy|readStrategy|shellStrategy|thinkStrategy|writeStrategy|ChunkStrategy" fusion-studio-client/src
```

Expected result: no hits.

Confirm deleted files are gone:

```bash
test ! -e fusion-studio-client/src/lib/chunk-strategies/line.ts
test ! -e fusion-studio-client/src/lib/chunk-strategies/read.ts
test ! -e fusion-studio-client/src/lib/chunk-strategies/shell.ts
test ! -e fusion-studio-client/src/lib/chunk-strategies/think.ts
test ! -e fusion-studio-client/src/lib/chunk-strategies/write.ts
test ! -e fusion-studio-client/src/lib/chunk-strategies/types.ts
test ! -e fusion-studio-client/src/lib/chunk-strategies/text.ts
```

Confirm active strategies remain:

```bash
rg --files fusion-studio-client/src/lib/chunk-strategies/active
```

Also re-run prior slice guards:

```bash
rg -n "segment-renderers|SegmentContentRenderer|lineStreamRenderer|codeRenderer|diffRenderer|groupedSummaryRenderer" fusion-studio-client/src
rg -n "CURSOR_HTML|injectCursor|rv-typing-cursor|showCursor" fusion-studio-client/src
rg -n "pressure|snapToFrontier|snapKeepLive|instantReveal|computeTimingProfile|PressureTier|getPressureTier" fusion-studio-client/src
```

Expected result for all three: no hits.

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/text/text-animate.ts src/lib/text/chunk-buffer.ts src/lib/text/speed-attenuator.ts
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
3. Response containing a fenced code block.
4. Shell command with short output.
5. Shell command with multi-line output.

Expected: text/thinking/tool reveal behavior is unchanged from before this slice.

## Commit Guidance

If validation passes, make one commit for this slice only.

Suggested commit message:

```text
refactor: delete static chunk strategies
```

Do not include backend stabilization changes, roadmap edits, `.gitignore` changes, user/runtime state files, visual polish, Write File filename display, hourglass work, or Phase 4 timing simplification.

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
