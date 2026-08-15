# Runtime-3R: Live Overlay Tail Repair

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Why This Repair Exists

Runtime-3 added server-owned live snapshots and client overlay from `liveTurn`.
The broad shape is correct, but review found two repair items before we should
trust manual smoke results.

1. `assistant-parts.ts` converts snapshot text/think parts to segments with
   `complete: true` unconditionally. For an in-flight live snapshot, the last
   text/think segment is still the live tail and can keep growing after the user
   returns to the thread.

   `LiveSegmentRenderer` passes `segment.complete` into `completeRef`.
   `animateText()` uses `completeRef.current` when parsing; `animateTool()`
   waits on it. Marking an in-flight tail complete can make appended chunks
   behave incorrectly.

2. View-scope overlay uses `store.panels[store.currentPanel]`. Existing view chat
   state is panel-keyed, not thread-keyed, so a late `thread:opened` response for
   view thread A can overlay A into the currently selected panel/thread after the
   user has already browsed to B.

Project-scope chats are safer because they are keyed by `projectChats[threadId]`.
This repair should make the live overlay target discipline explicit.

## Objective

Make live snapshot overlays safe for an in-flight live tail and guarded against
late stale browse responses.

## Scope

Do:

- Mark snapshot-derived text/think/tool segments complete only when appropriate
  for the live turn status and part position.
- Keep the live tail incomplete while `liveTurn.status === "in_flight"`.
- Guard `thread:opened` live overlay so a stale response cannot overlay the wrong
  currently visible thread.
- Add focused tests if there is a suitable test seam.

Do not:

- Implement stop/interrupt.
- Persist stream chunks to SQLite.
- Add timers/TTL cleanup.
- Redesign view chat storage.
- Split `LiveSegmentRenderer.tsx`.

## Current Code Seams

Inspect:

- `fusion-studio-client/src/lib/ws/assistant-parts.ts`
  - `convertPartToSegment()` currently marks text/think complete.
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
  - `overlayLiveTurn()`
  - `thread:opened` handling
  - `isLiveTurnDurable()`
- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`
  - read only; do not edit unless unavoidable.
- `fusion-studio-client/src/lib/text/text-animate.ts`
  - read only; `completeRef.current` controls parsing behavior.
- `fusion-studio-client/src/lib/tool-animate.ts`
  - read only; `completeRef.current` controls wait/reveal behavior.

## Required Behavior

### Segment Completeness

For `liveTurn.status === "in_flight"`:

- If the last part is `text` or `think`, the converted last segment must have
  `complete: false` or omit `complete`.
- Earlier text/think segments may be complete because a later part has arrived.
- Tool parts should be complete only when they have a result/status/display/error
  that indicates the tool finished.
- An incomplete tool call should remain incomplete.

For `liveTurn.status === "complete"`:

- All converted parts may be complete.
- `pendingTurnEnd` should be true so existing reveal/finalize flow can finish.

### Stale Thread Open Guard

When a `thread:opened` response arrives:

- It may set the current thread and hydrate that thread if it is still the
  intended selected thread.
- It must not apply a live overlay to the wrong visible view thread if the user
  clicked away again before the response arrived.

Acceptable fixes:

- Add a request/selection guard for view-scope thread opens.
- Or make `overlayLiveTurn()` no-op for view scope unless
  `store.currentThreadIds.view === threadId` at application time.
- Or move view chat state toward thread-keyed storage if this is already partly
  supported, but do not do a broad redesign.

Project scope must continue to overlay by `projectChats[threadId]`.

## Suggested Implementation

Change the converter to accept context:

```ts
convertPartToSegment(part, {
  isTerminal: liveTurn.status === "complete",
  isLastPart: index === liveTurn.parts.length - 1,
})
```

Then:

```ts
const complete =
  isTerminal ||
  !isLastPart ||
  toolResultIsComplete(part);
```

For text/think, use the contextual complete value instead of always `true`.

For tool calls, keep existing result-based completion but also allow terminal
turns to force complete.

## Required Tests / Checks

Add focused frontend tests if a local test pattern exists for pure helpers:

1. In-flight `text` snapshot last part converts to incomplete segment.
2. Complete `text` snapshot last part converts to complete segment.
3. In-flight tool call without result remains incomplete.
4. Complete tool call with result converts complete.

At minimum, `assistant-parts.ts` is pure and should be easy to test if the
frontend test setup supports TypeScript modules.

For stale open guard, add a focused test if there is a handler test seam.
Otherwise document manual verification.

## Acceptance Searches

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
rg -n "convertPartToSegment\\(|complete: true|liveTurn.status|isLastPart|currentThreadIds\\.view" fusion-studio-client/src/lib/ws
```

Expected:

- no unconditional `complete: true` for snapshot text/think conversion
- live turn status/part position controls completion
- view-scope overlay has an explicit guard

## Validation

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/ws/thread-handlers.ts src/lib/ws/assistant-parts.ts src/types/index.ts
```

Run any added focused frontend tests.

Repo:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check -- fusion-studio-client/src/lib/ws/thread-handlers.ts fusion-studio-client/src/lib/ws/assistant-parts.ts fusion-studio-client/src/types/index.ts
```

Restart:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Manual smoke:

1. Send in project thread A.
2. Browse to B while A streams.
3. Return to A before completion.
4. Verify A fast-forwards and continues appending new chunks naturally.
5. Return after completion and verify no duplicate user/assistant messages.
6. Repeat with quick A -> B -> A/B clicks if practical to catch stale
   `thread:opened` responses.

## Worker Report Requirements

Report:

- Files changed.
- How segment completion is derived.
- What stale-open guard was implemented.
- Tests added and results, or why no frontend test seam was used.
- Build/lint results.
- Touched-file `git diff --check` result.
- Restart smoke URL.
- Manual smoke observations if performed.
