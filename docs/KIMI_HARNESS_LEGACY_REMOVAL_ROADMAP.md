# Kimi Harness Legacy Removal Roadmap

Baseline commit: `f0bc4cd chore: checkpoint tested workspace baseline`

Status at authoring: working tree was clean immediately after the baseline commit. This document is meant to survive context compaction and give a new session enough context to continue the cleanup without rediscovering the whole architecture.

## Purpose

Fusion Studio started as an app built only around Kimi Code. The codebase then pivoted toward a harness-neutral architecture where every coding CLI has its own interpreter, emits canonical events, and flows through the same event bus, persistence, websocket, store, and frontend renderer.

The current code still contains both worlds:

- Kimi-specific legacy wire routes.
- Newer harness/interpreter modules.
- Newer frontend chunk/reveal modules.
- Older render-pressure and content-renderer scaffolding that is now partly bypassed.

The goal is to remove the old Kimi-only paths and old render-control code, not to keep wrapping new behavior around them.

## Architectural North Star

Vendor CLI protocol should stop at the harness interpreter boundary.

The desired path is:

```text
Vendor CLI protocol
  -> harness-specific parser/interpreter
  -> canonical chat/tool events
  -> universal event bus
  -> websocket broadcaster
  -> frontend stream handler
  -> canonical StreamSegment store
  -> shared live/history renderers
```

The frontend should not know Kimi wire event names. It should render canonical segment types:

```text
text
think
shell
read
write
edit
glob
grep
web_search
fetch
subagent
todo
```

Kimi-specific names such as `ReadFile`, `WriteFile`, `EditFile`, `SearchWeb`, `FetchURL`, `SetTodoList`, or raw Kimi `ToolResult.return_value` shapes should be normalized before they reach the frontend render layer.

## Current Live Paths To Understand

### Backend, Legacy Kimi Wire Path

The currently active legacy-style path is centered on:

- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/wire/process-manager.js`
- `fusion-studio-server/lib/wire/message-router.js`
- `fusion-studio-server/lib/wire/wire-broadcaster.js`

Important detail: `fusion-studio-server/lib/harness/feature-flags.js` defaults `HARNESS_MODE` to `legacy`. That means the direct Kimi wire path is probably still the default runtime unless the environment overrides it.

Legacy route shape:

```text
spawnThreadWireLegacy()
  -> raw kimi --wire process stdout
  -> process-manager attaches stdout listeners
  -> message-router parses Kimi JSON-RPC event names directly
  -> message-router emits chat:* events
  -> wire-broadcaster sends websocket messages
```

This path still parses Kimi-specific event names in `message-router.js`, including:

- `TurnBegin`
- `ContentPart`
- `ToolCall`
- `ToolCallPart`
- `ToolResult`
- `SubagentEvent`
- `TurnEnd`
- `StatusUpdate`

It also normalizes Kimi display output with:

- `fusion-studio-server/lib/harness/kimi/display-normalizer.js`

### Backend, Newer Harness Path

The newer harness-style path is centered on:

- `fusion-studio-server/lib/harness/kimi/index.js`
- `fusion-studio-server/lib/harness/kimi/wire-parser.js`
- `fusion-studio-server/lib/harness/kimi/event-translator.js`
- `fusion-studio-server/lib/harness/kimi/session-state.js`
- `fusion-studio-server/lib/harness/kimi/tool-mapper.js`
- `fusion-studio-server/lib/harness/registry.js`
- `fusion-studio-server/lib/harness/types.js`

New route shape should become:

```text
KimiHarness
  -> WireParser
  -> EventTranslator
  -> canonical events
  -> shared event bus
  -> shared websocket broadcaster
```

This is the path that matches the harness-neutral goal. However, it currently exists alongside legacy compatibility code. Do not assume it is fully owning live runtime until tested.

### Frontend Stream Path

The client stream path is centered on:

- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
- `fusion-studio-client/src/state/slices/chatSlice.ts`
- `fusion-studio-client/src/components/MessageList.tsx`
- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`
- `fusion-studio-client/src/components/InstantSegmentRenderer.tsx`

Frontend render path:

```text
websocket message
  -> stream-handlers.ts
  -> chatSlice StreamSegment updates
  -> MessageList
  -> LiveSegmentRenderer for active turn
  -> InstantSegmentRenderer for persisted/history turns
```

Tool presentation is owned by:

- `fusion-studio-client/src/lib/tool-renderers/*`
- `fusion-studio-client/src/components/ToolCallBlock.tsx`
- `fusion-studio-client/src/lib/catalog-visual.ts`

Tool animation/chunking is currently owned by:

- `fusion-studio-client/src/lib/tool-animate.ts`
- `fusion-studio-client/src/lib/catalog.ts`
- `fusion-studio-client/src/lib/chunk-strategies/active/*`
- `fusion-studio-client/src/lib/reveal/orchestrator.ts`
- `fusion-studio-client/src/lib/reveal/line-stream.ts`
- `fusion-studio-client/src/lib/reveal/parsers/line-break.ts`

Text animation is currently separate:

- `fusion-studio-client/src/lib/text/text-animate.ts`
- `fusion-studio-client/src/lib/text/index.ts`
- `fusion-studio-client/src/lib/text/chunk-buffer.ts`
- `fusion-studio-client/src/lib/text/speed-attenuator.ts`

## Current Render Problem Context

The user observed cursor stalls where tokens were still streaming, then the rest of the response dumped very quickly. This matches old pressure/backlog behavior.

The legacy pressure system lives in:

- `fusion-studio-client/src/lib/pressure.ts`
- pressure-related types/options used by `LiveSegmentRenderer.tsx`
- `instantReveal` handling in `text-animate.ts`
- `instantReveal` handling in `reveal/orchestrator.ts`

`LiveSegmentRenderer.tsx` currently uses a stable timing profile rather than calling `computeTimingProfile`, but the old pressure type and escape hatches are still wired through the system. They should be removed, not merely neutralized.

## Do Not Regress These Behaviors

Keep these behaviors working through every cleanup phase:

- Thinking reveals line-by-line.
- Main text reveals by semantic markdown/text chunks.
- Speed is based on real chunk queue lookahead, not segment backlog.
- `turn_end` does not finalize until the live renderer finishes revealing.
- Tool completion remains tied to `tool_result`, not `turn_end`.
- Grouped reads/globs/greps stay compact.
- Read shows filename/compact path only, not full file contents.
- Grep title can remain compact; body should not become verbose unexpectedly.
- Shell shows command separately and caps output.
- Web search chunks one result at a time.
- Fetch chunks paragraph/text sections when possible.
- Write/edit show compact filename and diff counts when returned.
- Diff display respects `returnedDiff: true|false`.
- Todo inline tool row has no dropdown body and updates the drawer.
- Subagent line updates continue to append to the original subagent segment.
- Background subagent waiting hourglass does not reappear when re-rendering persisted history.

## Phase 0: Establish Baseline And Guardrails

Goal: make each later cleanup reversible and measurable.

Actions:

1. Start from the committed baseline `f0bc4cd`.
2. Confirm `git status --short` is clean before each phase.
3. Make one small commit per phase.
4. Do not mix backend harness removal with frontend render cleanup in the same commit.
5. Do not broaden frontend raw Kimi tool-name aliases as a workaround. That hides backend normalization gaps.

Validation commands:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/components/LiveSegmentRenderer.tsx src/lib/tool-animate.ts src/lib/reveal/orchestrator.ts src/lib/text/text-animate.ts
```

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Known validation note: server Jest may report an existing open-handle warning after tests complete. Treat test failures differently from the known warning.

## Phase 1: Remove Frontend Pressure Gauge

Goal: remove the old segment-backlog speed controller entirely.

Files likely in scope:

- `fusion-studio-client/src/lib/pressure.ts`
- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`
- `fusion-studio-client/src/lib/tool-animate.ts`
- `fusion-studio-client/src/lib/text/text-animate.ts`
- `fusion-studio-client/src/lib/reveal/orchestrator.ts`
- `fusion-studio-client/src/lib/reveal/types.ts`
- `fusion-studio-client/src/lib/timing.ts`
- `fusion-studio-client/src/components/ToolCallBlock.tsx`

Actions:

1. Create a small stable timing module if needed, for example:

   ```text
   fusion-studio-client/src/lib/render-timing.ts
   ```

2. Move only stable constants/types needed by the live renderer into that module.
3. Delete `computeTimingProfile`, pressure tiers, `snapToFrontier`, `snapKeepLive`, and pressure comments.
4. Remove `instantReveal` from `RevealOptions`.
5. Remove the instant reveal branch from `reveal/orchestrator.ts`.
6. Remove `instantBreak` handling from `text-animate.ts`.
7. Rename comments from pressure/backlog language to queue/chunk language.
8. Delete `pressure.ts` when imports are gone.

Acceptance criteria:

- No `rg -n "pressure|snapToFrontier|instantReveal|computeTimingProfile" fusion-studio-client/src` hits except changelog/docs.
- Cursor never intentionally jumps to full reveal because of segment backlog.
- Chunk queue still controls fast/slow speed.

## Phase 2: Consolidate Tool Animation Catalog

Goal: make `catalog.ts` describe only behavior that is actually used.

Current issue:

`catalog.ts` imports `SegmentContentRenderer` and `segment-renderers/*`, but `tool-animate.ts` currently renders chunks by returning `chunk.content`. Final presentation is handled later by `tool-renderers/*`.

Files likely in scope:

- `fusion-studio-client/src/lib/catalog.ts`
- `fusion-studio-client/src/lib/tool-animate.ts`
- `fusion-studio-client/src/lib/segment-renderers/*`

Actions:

1. Remove `renderer` from `CatalogEntry`.
2. Remove imports of:

   ```text
   segment-renderers/line-stream
   segment-renderers/code
   segment-renderers/diff
   segment-renderers/types
   ```

3. Delete `fusion-studio-client/src/lib/segment-renderers/*` after TypeScript confirms no imports.
4. Keep `tool-renderers/*`; this is the active presentation layer.
5. Update `catalog.ts` comments so it says it owns chunk strategy, transforms, reveal controller, and result-holding behavior, not presentation.

Acceptance criteria:

- No `rg -n "segment-renderers|SegmentContentRenderer|lineStreamRenderer|codeRenderer|diffRenderer" fusion-studio-client/src` hits.
- Tool UI looks unchanged.

## Phase 3: Delete Old Static Chunk Strategy Layer

Goal: keep only active chunk strategies.

Current useful strategy layer:

```text
fusion-studio-client/src/lib/chunk-strategies/active/*
```

Likely legacy files:

```text
fusion-studio-client/src/lib/chunk-strategies/line.ts
fusion-studio-client/src/lib/chunk-strategies/read.ts
fusion-studio-client/src/lib/chunk-strategies/shell.ts
fusion-studio-client/src/lib/chunk-strategies/think.ts
fusion-studio-client/src/lib/chunk-strategies/write.ts
fusion-studio-client/src/lib/chunk-strategies/types.ts
fusion-studio-client/src/lib/chunk-strategies/text.ts
```

Current caveat:

`text-animate.ts` imports `textStrategy` only to read `codeFenceAsLookahead`. Replace that with a direct constant or a new text-render config near `text-animate.ts`.

Actions:

1. Inline or relocate `codeFenceAsLookahead: true`.
2. Delete unused static strategy files.
3. Update comments in `chunk-buffer.ts` and `speed-attenuator.ts` to describe the current queue model.

Acceptance criteria:

- No imports from `src/lib/chunk-strategies/*.ts` except `active/*`.
- Text and thinking chunk behavior remains unchanged.

## Phase 4: Simplify Reveal Timing And Constants

Goal: remove old fallback timing concepts that only existed for pressure mode.

Files likely in scope:

- `fusion-studio-client/src/lib/timing.ts`
- `fusion-studio-client/src/components/ToolCallBlock.tsx`
- `fusion-studio-client/src/lib/reveal/orchestrator.ts`
- `fusion-studio-client/src/lib/tool-animate.ts`

Actions:

1. Decide which constants remain globally meaningful:

   - collapse duration
   - inter-chunk pause
   - line-end hold
   - poll interval
   - flush timeout

2. Keep constants close to the module that uses them unless they are genuinely shared.
3. Remove comments saying timing is controlled by pressure.
4. Keep the dropdown collapse duration synchronized between JS and CSS.

Acceptance criteria:

- No stale comments claiming pressure owns timing.
- Timing names match current queue/reveal behavior.

## Phase 5: Backend Harness Route Decision

Goal: choose the single backend path that owns CLI interpretation.

Decision to make:

The desired direction is to remove Kimi-only legacy parsing from `wire/message-router.js` and make each harness produce canonical events itself. That means `message-router.js` should eventually stop knowing raw Kimi event names.

Candidate target:

```text
KimiHarness / EventTranslator
  -> canonical events
  -> event bus
  -> wire-broadcaster
```

Risk:

The current compatibility stack still defaults to `legacy`, and some client prompt routing may still depend on legacy process-like behavior.

Files to inspect deeply before edits:

- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/harness/feature-flags.js`
- `fusion-studio-server/lib/harness/kimi/index.js`
- `fusion-studio-server/lib/harness/kimi/event-translator.js`
- `fusion-studio-server/lib/harness/kimi/session-state.js`
- `fusion-studio-server/lib/wire/process-manager.js`
- `fusion-studio-server/lib/wire/message-router.js`
- `fusion-studio-server/lib/wire/wire-broadcaster.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/thread-ws-handlers.js`
- `fusion-studio-server/server.js`
- `fusion-studio-server/lib/audit/audit-subscriber.js`

Phase 5 should not remove code yet. It should prove the new harness path can run an end-to-end Kimi chat turn.

Acceptance criteria before deletion:

- Kimi can start through `KimiHarness`.
- Prompt send works through the harness path.
- Thinking, text, tool calls, tool args, tool results, subagent events, status updates, and turn end all reach the frontend.
- SQLite persistence receives complete `parts`, including tool display/diff metadata.
- No frontend raw Kimi fallback is needed for normal operation.

## Phase 6: Move Direct Kimi Event Parsing Out Of `message-router.js`

Goal: make `message-router.js` harness-neutral or delete it if obsolete.

Current legacy issue:

`message-router.js` directly switches on Kimi event names:

```text
TurnBegin
ContentPart
ToolCall
ToolCallPart
ToolResult
SubagentEvent
TurnEnd
StatusUpdate
```

That violates the north star because the central route knows a vendor protocol.

Actions:

1. Route raw Kimi stdout only into `KimiHarness/WireParser/EventTranslator`.
2. Emit canonical bus events from the harness.
3. Keep `wire-broadcaster.js` as the websocket fan-out layer.
4. Move settings-folder write-lock enforcement to a canonical tool policy layer if it must remain. It should not live inside a Kimi event switch forever.
5. Delete or shrink `message-router.js` once no active path imports it.

Acceptance criteria:

- `rg -n "TurnBegin|ContentPart|ToolCallPart|ToolResult|SubagentEvent|StatusUpdate" fusion-studio-server/lib/wire fusion-studio-server/server.js` has no live Kimi parser hits.
- Kimi event names exist only inside `fusion-studio-server/lib/harness/kimi/*` and tests/docs.

## Phase 7: Remove Legacy Compat Modes

Goal: remove the compatibility shim once harness routing is stable.

Files likely in scope:

- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/harness/feature-flags.js`
- `fusion-studio-server/lib/ws/harness-ws-handlers.js`
- `fusion-studio-server/lib/harness/index.js`
- tests referencing legacy/parallel modes

Actions:

1. Delete `spawnThreadWireLegacy`.
2. Delete `spawnThreadWireParallel` unless a real comparison harness is still needed.
3. Delete `HARNESS_MODE=legacy|parallel` runtime branches.
4. Keep a rollback plan through git commits, not runtime duplicate stacks.
5. Update any UI/API that exposes legacy/parallel mode status.

Acceptance criteria:

- No runtime branch says `legacy`, `parallel`, or `new harness` for Kimi. There should be just the harness path.
- `rg -n "spawnThreadWireLegacy|spawnThreadWireParallel|HARNESS_MODE|legacy mode|parallel mode" fusion-studio-server/lib fusion-studio-server/server.js` has no runtime hits.

## Phase 8: Frontend Vendor Alias Cleanup

Goal: frontend should consume canonical names only.

Current issue:

`fusion-studio-client/src/lib/instructions.ts` has aliases for raw Kimi names. Some were necessary because the legacy message-router still emits raw tool names.

Actions after backend canonical path is proven:

1. Remove raw Kimi aliases from `toolNameToSegmentType`.
2. Keep canonical mappings only.
3. If a future harness leaks raw names to the frontend, fix that harness interpreter instead of adding frontend aliases.

Acceptance criteria:

- Frontend `instructions.ts` maps canonical event names only.
- Kimi tools still render correctly because backend emits canonical names.

## Phase 9: Documentation Update

Goal: make wiki/docs match the cleaned architecture.

Files likely in scope:

- `ai/views/wiki-viewer/content/project/Coding-CLIs/Coding_CLI_Harness.md`
- `ai/views/wiki-viewer/content/project/Coding-CLIs/Architecture/Backend_Interpreter.md`
- `ai/views/wiki-viewer/content/project/Coding-CLIs/Architecture/Frontend_Stream.md`
- `ai/views/wiki-viewer/content/project/Coding-CLIs/Path_Forward/Adding_New_Harnesses.md`
- `ai/views/wiki-viewer/content/project/Coding-CLIs/Path_Forward/Chunking_Guide.md`
- `docs/FUSION_STUDIO_ARCHITECTURE_OUTLINE.md`

Actions:

1. Remove statements saying Kimi interpreter is inline in server code once it is not.
2. Document the single harness path.
3. Document how a new harness maps native events to canonical events.
4. Document that frontend renderers operate on canonical `StreamSegment`s.

## Manual Smoke Test Matrix

Run these after each risky phase:

1. Plain text response with multiple paragraphs.
2. Thinking-heavy response.
3. Shell command with short output.
4. Shell command with long output, verifying cap/truncation.
5. Single read.
6. Consecutive reads.
7. Grep with matches.
8. Grep with no matches.
9. Glob with multiple paths.
10. Web search.
11. Fetch URL.
12. Write file with returned diff.
13. Edit file with returned diff.
14. Write/edit without returned diff, if Kimi supports that shape.
15. Todo update.
16. Blocking subagent with live updates.
17. Background subagent with waiting hourglass.
18. Switch away and back to a persisted thread; hourglass must not reappear incorrectly.
19. Reload Electron and rehydrate history from SQLite.

## Automated Validation Checklist

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/components/LiveSegmentRenderer.tsx src/components/InstantSegmentRenderer.tsx src/lib/tool-animate.ts src/lib/reveal/orchestrator.ts src/lib/text/text-animate.ts src/lib/ws/stream-handlers.ts
```

Server:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Focused server tests to keep green when touching Kimi:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand lib/harness/kimi/__tests__/display-normalizer.test.js lib/harness/kimi/__tests__/session-state.test.js lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/wire-parser.test.js
```

Restart app after meaningful frontend/backend changes:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Note: `Fusion-Home` is not currently a git repo, so restart-script edits are not captured by `fs-dev` commits.

## Session Startup Checklist For Future Agents

When a new session picks this up:

1. Read this roadmap first.
2. Check current commit:

   ```bash
   cd /Users/rccurtrightjr./projects/fs-dev
   git status --short
   git log -1 --oneline
   ```

3. If the tree is dirty, inspect before editing. Do not revert user/session work.
4. Choose exactly one phase.
5. Make the smallest coherent deletion/refactor.
6. Run the phase validation.
7. Commit the phase before moving to the next one.

## Key Principle

Do not preserve duplicate Kimi-only machinery just because it still works. If a path exists only to keep the original Kimi-only app shape alive, it should be removed once the harness-neutral path is proven.

Do not compensate for backend leaks by adding frontend Kimi aliases. The translator is responsible for vendor vocabulary. The frontend renderer is responsible for canonical segment behavior.
