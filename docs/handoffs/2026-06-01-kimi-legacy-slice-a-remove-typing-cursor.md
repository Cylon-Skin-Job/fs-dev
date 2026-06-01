# Handoff: Kimi Legacy Removal Slice A - Remove Visible Typing Cursor

## Context

Read `docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md` first.
Also read `docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md` before editing.

This is the first narrow vertical slice from the Kimi harness legacy removal roadmap. Keep this work focused on removing the rendered typing cursor effect from the frontend live render path. Do not change backend harness routing, persistence, thread hydration, websocket contracts, or tool-name normalization in this slice.

The user likes the line-by-line reveal, chunk pacing, and slight pause at newline boundaries. Preserve those behaviors. The only intended visible behavior change is that no cursor block appears during live text, thinking, shell, subagent, or tool output reveal.

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

## Ground Rules

- Confirm `git rev-parse --show-toplevel` returns `/Users/rccurtrightjr./projects/fs-dev`.
- Inspect `git status --short` before editing.
- Do not revert unrelated changes.
- Keep changes limited to the cursor/render contract files listed below unless TypeScript exposes a directly related import/type cleanup.
- Do not broaden frontend raw Kimi tool-name aliases.
- Do not mix in pressure-gauge removal. Leave `pressure.ts`, `instantReveal`, `snapToFrontier`, and timing-profile cleanup for a later slice unless a cursor-only import forces a tiny local type cleanup.
- Commit only if validation passes. If validation cannot pass, leave the work uncommitted and report the blocker clearly.

## Files Likely In Scope

- `fusion-studio-client/src/lib/animate-utils.ts`
- `fusion-studio-client/src/lib/text/text-animate.ts`
- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`
- `fusion-studio-client/src/lib/tool-renderers/types.ts`
- `fusion-studio-client/src/lib/tool-renderers/index.ts`
- `fusion-studio-client/src/lib/tool-renderers/*.ts`
- `fusion-studio-client/src/styles/animations.css`

## Task

Remove the visible typing cursor effect from the live render path.

Expected edits:

1. Stop appending `CURSOR_HTML` in `text-animate.ts`.
2. Stop importing or calling `injectCursor()` in `LiveSegmentRenderer.tsx`.
3. Remove `showCursor` from the tool-renderer contract if it no longer serves any purpose.
4. Remove individual `showCursor` flags from tool renderers.
5. Delete `CURSOR_HTML` and `injectCursor()` from `animate-utils.ts` when imports are gone.
6. Delete `.rv-typing-cursor` CSS from `animations.css` when no longer referenced.
7. Preserve text, thinking, shell, subagent, and tool reveal pacing.

## Acceptance Checks

Run this from repo root:

```bash
rg -n "CURSOR_HTML|injectCursor|rv-typing-cursor|showCursor" fusion-studio-client/src
```

Expected result: no hits, unless a remaining use of the word `cursor` clearly refers to parser position rather than the visible typing cursor.

Also verify:

- Plain assistant text still reveals by chunks.
- Thinking output still reveals line-by-line.
- Shell output still reveals without a cursor.
- Subagent output still reveals without a cursor.
- `turn_end` behavior is not changed by this slice.

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/components/LiveSegmentRenderer.tsx src/lib/text/text-animate.ts src/lib/tool-renderers src/styles/animations.css
```

Then run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

If frontend validation passes, restart the app for manual smoke:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Manual smoke should focus on:

1. Plain text response with multiple paragraphs.
2. Thinking-heavy response.
3. Shell command with short output.
4. Subagent or tool output if easy to trigger.
5. Confirm no visible typing cursor appears in text, thinking, shell, subagent, or tool output.

## Final Response Required

Report:

- Commit SHA if committed.
- Files changed.
- Validation command results.
- `git diff --check` result.
- Manual smoke coverage completed or skipped.
- Any risks, follow-up work, or blockers.
