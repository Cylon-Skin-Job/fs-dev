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

### Frontend Event-Bus Vestiges To Remove

The frontend does not contain a full second render system from before the event bus, but it does still contain compatibility behavior from the older single-Kimi/single-current-thread era. These are important because they can hide backend contract violations and route inbound stream content by current UI state instead of by explicit event identity.

Highest-risk vestiges:

- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
  - Inbound stream messages can still resolve missing `scope` from `currentScope`, then default to `project`.
  - Some inbound stream updates can still tolerate missing `threadId` through store helpers that fall back to the current project thread.
  - This is the most dangerous frontend fallback because server-originated events should already know their `scope` and `threadId`. If those fields are absent, the correct behavior is to surface a contract problem, not guess from the selected UI state.
  - This file is also over the code-standards size threshold and now owns too many jobs: stream lifecycle, tool grouping, tool-result normalization, todo drawer updates, shell compaction, and subagent ledger updates. Split only after the routing/fallback contract is clear, because this path is fragile.
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
  - `thread:*` messages still coerce missing `scope` to `project`.
  - `thread:opened` can hydrate from modern `exchanges`, but still falls back to older `history` format.
  - `convertPartToSegment()` still maps persisted tool part names through frontend tool-name aliases.
  - Past chat/session replay should not assume SQLite save or server serialization may silently fail and then produce a partial legacy render. If a saved exchange cannot hydrate through the canonical format, surface a clear error and diagnose the persistence/replay contract.
- `fusion-studio-client/src/lib/instructions.ts`
  - `toolNameToSegmentType()` still recognizes raw Kimi-style names such as `ReadFile`, `WriteFile`, `EditFile`, `StrReplaceFile`, `SearchWeb`, `FetchURL`, `Agent`, `Task`, `SetTodoList`, and `TodoWrite`.
  - These mappings are acceptable only as a temporary bridge while legacy backend routes can still leak vendor names. They should not become the permanent multi-harness contract.
- `fusion-studio-client/src/lib/catalog.ts`
  - Some lookup language and structures still refer to wire tags / tag lookup rather than purely canonical tool segment types.
  - Keep active chunk strategy behavior, but remove Kimi/wire-tag compatibility once backend canonicalization is proven.
- `StreamSegment.icon` and `SEGMENT_ICONS`
  - Some history conversion still attaches icon metadata to segments even though current tool visuals are owned by `catalog-visual.ts` and `ToolCallBlock`.
  - This may be older render metadata that can be removed after confirming no active renderer consumes it.

Lower-risk cleanup targets:

- `fusion-studio-client/src/lib/ws-client.ts`
  - This is still the browser-side websocket dispatcher. That is not legacy by itself; the client still needs a message router after the server event bus broadcasts over websocket.
  - It does still contain a broad switch over many message domains. Splitting that further can improve maintainability, but it should not be treated as a prerequisite for Kimi legacy removal.
- `fusion-studio-client/src/config/harness.ts`
  - Kimi appearing as the current/default provider is product configuration, not a frontend render fallback. Remove Kimi-specific behavior here only when additional harnesses are actually activated.

Allowed fallback boundary:

- Unknown tool renderer fallback may keep the UI from crashing, but it must log and toast. It should not silently render as a generic tool.
- Parser/display defaults are acceptable for optional display text, for example `(no matches)` or paragraph text fallback.
- Routing, vendor-name normalization, and persisted exchange hydration should not have silent fallbacks. These are system contracts; a violation should be visible.

## Current Render Problem Context

The user observed cursor stalls where tokens were still streaming, then the rest of the response dumped very quickly. This matches old pressure/backlog behavior.

The legacy pressure system lives in:

- `fusion-studio-client/src/lib/pressure.ts`
- pressure-related types/options used by `LiveSegmentRenderer.tsx`
- `instantReveal` handling in `text-animate.ts`
- `instantReveal` handling in `reveal/orchestrator.ts`

`LiveSegmentRenderer.tsx` currently uses a stable timing profile rather than calling `computeTimingProfile`, but the old pressure type and escape hatches are still wired through the system. They should be removed, not merely neutralized.

The visible typing cursor should also be removed from the live render path. The user likes the line-by-line reveal, chunk pacing, and slight pause at newlines, but not the visual cursor block. The cursor is currently unreliable enough that it can appear lost or stuck, and it adds noise without improving the reveal. Remove the rendered cursor effect while preserving the queue/chunk timing and line rhythm.

Known cursor-related paths to inspect:

- `fusion-studio-client/src/lib/animate-utils.ts`
  - `CURSOR_HTML`
  - `injectCursor()`
- `fusion-studio-client/src/lib/text/text-animate.ts`
  - appends `CURSOR_HTML` during text reveal
- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`
  - imports `injectCursor()`
  - injects cursor for tool renderers with `showCursor`
- `fusion-studio-client/src/lib/tool-renderers/types.ts`
  - `showCursor`
- `fusion-studio-client/src/lib/tool-renderers/*`
  - individual `showCursor` flags
- `fusion-studio-client/src/styles/animations.css`
  - `.rv-typing-cursor`

## Do Not Regress These Behaviors

Keep these behaviors working through every cleanup phase:

- Thinking reveals line-by-line.
- Line-by-line reveal still has a slight pause/rhythm at newline boundaries.
- Main text reveals by semantic markdown/text chunks.
- Speed is based on real chunk queue lookahead, not segment backlog.
- No visible typing cursor is rendered in text, thinking, shell, subagent, or any tool output.
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
8. Remove the visible typing cursor effect:
   - Stop appending `CURSOR_HTML` in `text-animate.ts`.
   - Stop calling `injectCursor()` in `LiveSegmentRenderer.tsx`.
   - Remove `showCursor` from the tool renderer contract if it has no remaining purpose.
   - Delete `CURSOR_HTML`, `injectCursor()`, and `.rv-typing-cursor` when imports are gone.
9. Delete `pressure.ts` when imports are gone.

Acceptance criteria:

- No `rg -n "pressure|snapToFrontier|instantReveal|computeTimingProfile" fusion-studio-client/src` hits except changelog/docs.
- No `rg -n "CURSOR_HTML|injectCursor|rv-typing-cursor|showCursor" fusion-studio-client/src` hits unless the word "cursor" refers to parser position rather than the visible typing cursor.
- Chunk queue still controls fast/slow speed.
- Thinking and subagent output still reveal line-by-line.
- Newline rhythm/line-end hold remains intact.

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

This phase should also remove frontend routing fallbacks that belong to the pre-event-bus/single-current-thread era.

Actions after backend canonical path is proven:

1. Remove raw Kimi aliases from `toolNameToSegmentType`.
2. Keep canonical mappings only.
3. If a future harness leaks raw names to the frontend, fix that harness interpreter instead of adding frontend aliases.
4. In `stream-handlers.ts`, stop resolving inbound server stream events from `currentScope` or the current project thread.
5. Require explicit `scope` and `threadId` for server-originated stream events. Missing routing metadata should warn/drop or fail loudly in development, not silently route to the active UI state.
6. In `thread-handlers.ts`, stop defaulting missing `scope` to `project` once the server contract guarantees scoped thread messages.
7. Remove the legacy `history` hydration fallback after confirming persisted/replayed chats always arrive as rich `exchanges`. If a thread cannot hydrate, emit a clear frontend error/toast and fix the SQLite/server replay path rather than half-rendering old history.
8. Remove stale segment icon metadata if all live/history renderers get visuals from `catalog-visual.ts` and `ToolCallBlock`.
9. Clean `catalog.ts` of wire-tag/vendor-tag lookup once canonical tool names are the only frontend-facing tool identity.
10. Split `stream-handlers.ts` into focused modules after strict routing is enforced. Suggested seams: routing guards, tool args/result normalization, grouped tool handling, subagent event handling, and turn lifecycle.

Acceptance criteria:

- Frontend `instructions.ts` maps canonical event names only.
- Kimi tools still render correctly because backend emits canonical names.
- Inbound stream events without explicit `scope` and `threadId` cannot be silently attached to the currently selected thread.
- Thread hydration uses one rich exchange format; the old `history` route is gone or isolated behind a documented migration boundary.
- Saved-chat replay failures produce a clear diagnostic path instead of a partial legacy render.
- Tool visual identity comes from the visual catalog, not duplicated `StreamSegment.icon` metadata.
- `stream-handlers.ts` no longer violates the one-job-per-file standard.

## Phase 9: Documentation Update

Goal: make wiki/docs match the cleaned architecture.

Files likely in scope:

- `ai/<machine>/Wiki/project/Coding-CLIs/Coding_CLI_Harness.md`
- `ai/<machine>/Wiki/project/Coding-CLIs/Architecture/Backend_Interpreter.md`
- `ai/<machine>/Wiki/project/Coding-CLIs/Architecture/Frontend_Stream.md`
- `ai/<machine>/Wiki/project/Coding-CLIs/Path_Forward/Adding_New_Harnesses.md`
- `ai/<machine>/Wiki/project/Coding-CLIs/Path_Forward/Chunking_Guide.md`
- `docs/FUSION_STUDIO_ARCHITECTURE_OUTLINE.md`

Actions:

1. Remove statements saying Kimi interpreter is inline in server code once it is not.
2. Document the single harness path.
3. Document how a new harness maps native events to canonical events.
4. Document that frontend renderers operate on canonical `StreamSegment`s.

## Phase 10: Chat Render Visual Polish

Goal: after the system-breaking architecture issues are fixed, run a small design/visioning pass on chat render behavior and make the tool blocks feel more consistent and polished.

Do this after the harness path, frontend fallbacks, pressure removal, cursor removal, and persistence hydration issues are resolved. This phase should not carry architecture fixes; it is for visual quality and interaction polish.

Known visual issues to include:

- Some shell command/output text renders as plain white before later shell content uses the proper system theme.
- Write/edit dropdown bodies need better boundaries.
- Write file tool presentation should clearly show the filename or compact path being written.
- Diff/code blocks inside write/edit dropdowns need reliable horizontal scroll.
- All tool dropdowns should autosize to about 5 lines, then scroll internally.
- Dropdown content should auto-scroll bottom-up before the next new line is rendered, so the newest revealed line stays visible without jumping the whole chat.
- Tool dropdown content should have consistent spacing, borders, font treatment, and overflow behavior across shell, write, edit, fetch, search, read, grep, glob, todo, and subagent.
- Improve vertical spacing between a user chat bubble and the assistant reply that follows it.
- Add chrome beneath the user bubble:
  - copy
  - ellipsis menu
  - chat ID link
  - view markdown
  - summarize and send
- Render time/day separators between chat pairs.
- Add turn-complete bottom chrome that fills in only after the assistant chat completes:
  - flag/bookmark controls
  - copy
  - audio playback using Kokoro via Transformers.js
  - ellipsis menu
  - chat ID link
  - view markdown
  - summarize and send
  - metadata
- Flesh out subagent presentation for blocking vs background behavior:
  - Finish the hourglass behavior.
  - Consider an hourglass at the end of a chat exchange when the system is waiting on a subagent.
  - Decide whether an hourglass belongs inline with the subagent row, at the bottom of the assistant turn, or in a separate waiting/status area.
  - For blocking subagents, consider a 60-second status interval that sends `Status` on behalf of the user.
  - Define how the frontend determines that a subagent block has not completed.
  - Define how chat should continue rendering while a background agent keeps running.
  - Treat this as design plus orchestration work, not pure visual polish, because it affects turn lifecycle and possibly backend/user-message simulation.
- Run a brief design/visioning session before edits so the final behavior is intentional rather than a collection of one-off tweaks.

Acceptance criteria:

- Shell content consistently uses the active theme tokens from first render through completion.
- Write file tool rows expose the filename or compact path without making the body verbose.
- Write/edit diff blocks have visible boundaries and horizontal scroll without layout shift.
- Tool dropdowns cap to about 5 visible lines and scroll internally while keeping the newest revealed line in view.
- Tool blocks remain compact in narrow chat windows.
- User-bubble chrome and assistant turn-complete chrome appear only at the right lifecycle points.
- Time/day separators appear between chat pairs without adding clutter.
- Subagent waiting/status behavior is specified before implementation, including blocking vs background semantics.
- Hourglass placement is intentionally designed and does not reappear incorrectly in persisted history.
- Visual tweaks do not change event routing, chunking, persistence, or tool semantics.

## Phase 11: Warm Session Expiration Queue

Goal: replace the current per-session idle kill timer with an explicit warm-session eviction policy.

Current problem:

- `SessionManager` treats the idle timer as a direct kill timer that starts when a wire opens.
- That can kill a session in the middle of a turn if the timer expires while a tool call or streaming response is active.
- The intended behavior is different: a session should stay warm after a completed chat exchange, and recent completed exchanges should protect the session from eviction.

Desired model:

- Maintain a per-workspace warm-session queue with a maximum of 10 warm sessions.
- Queue ordering should be based on last completed chat exchange, not initial thread open.
- A thread with an active turn is never eligible for eviction.
- A completed turn starts or refreshes a 9-minute protection window.
- The 9-minute window blocks eviction; it is not itself the direct kill mechanism.
- When opening or warming a new chat would exceed the workspace warm-session limit, evict the oldest eligible session.
- If the oldest session is still protected or active, skip it and evict the next eligible session.
- When switching workspaces, close sessions from the previous workspace except active turns and sessions still inside their 9-minute protection window.

Open design question:

- Decide what user action warms a thread:
  - Opening/clicking a thread may be too aggressive if the user is just browsing.
  - Focusing the chat input may be a better signal.
  - Programmatic insertion from send-to-chat buttons or paste into the input should probably warm the thread.
  - Sending a message definitely warms the thread and refreshes protection after completion.

Implementation notes:

- Model session states explicitly: inactive, warming, warm, active-turn, protected, eviction-eligible.
- Keep turn activity separate from warm-session eviction metadata.
- Keep the queue per workspace so workspace switches can evict the correct sessions without crossing scopes.
- Avoid duplicate spawn/resume paths; wire creation should still flow through the existing thread-open/resume machinery.
- Add enough instrumentation to answer: why was this session kept, skipped, or evicted?

Acceptance criteria:

- A long-running tool call or streaming response is never killed by warm-session eviction.
- A session whose last completed exchange was less than 9 minutes ago is skipped during FIFO eviction.
- After the protection window expires, the oldest completed exchange is eligible before newer completed exchanges.
- Opening many threads without sending messages does not displace protected active/recent chat sessions unless the chosen warm signal intentionally says it should.
- Workspace switches evict only eligible sessions from the workspace being left.
- The UI can recover from a missing/dead wire by resuming or showing a visible failure, never by leaving a pending user request stuck.
- Focus/paste/send-to-chat warm behavior is documented before implementation.

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
20. Confirm no visible typing cursor appears during text, thinking, shell, or subagent reveal.
21. Visual polish pass: verify shell, write, and edit dropdowns use themed text, clear boundaries, and horizontal scroll where needed.
22. Visual polish pass: verify dropdowns cap at 5 lines, auto-scroll newest content, and preserve compact chat layout.
23. Visual polish pass: verify user bubble chrome, assistant completion chrome, time/day separators, and subagent waiting/status states.

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

## Next Roadmap

After this roadmap is complete, hand off to:

- [Code Standards Cleanup Roadmap](./CODE_STANDARDS_CLEANUP_ROADMAP.md)
