# Handoff: Thread Runtime Runtime-3 - Live Snapshot Overlay

## Status

READY FOR EXECUTION

## Objective

Make an in-flight thread continue to be observable after the user browses away
and returns. The server runtime must maintain a live in-memory snapshot, and
`thread:open` must include that snapshot so the client can hydrate SQLite
history plus the current live turn.

This slice addresses the known failure:

> Send in thread A, browse to B while A streams, return to A, and the UI appears
> stalled or reloads only SQLite history.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-1-browse-only-open.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-1r-browse-identity-repair.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-2-prompt-acceptance-warm-send.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-2r-acceptance-ui-repair.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-2s-target-aware-sending-state.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/doc-viewer/content/specs/VIEW-CHAT.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Startup Checks

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
```

Expected root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The worktree is expected to be dirty with accepted but uncommitted runtime and
harness slices. Do not revert unrelated changes. A known unrelated whitespace
issue may exist in:

```text
fusion-studio-server/lib/transcription/index.js
```

Do not fix unrelated transcription code in this slice.

## Scope

### Server

Add live snapshot ownership to the thread runtime.

Snapshot shape:

```ts
type LiveTurnSnapshot = {
  workspaceId: string;
  scope: "project" | "view";
  viewId?: string | null;
  threadId: string;
  turnId: string;
  userInput: string;
  status: "in_flight" | "complete" | "interrupted" | "error";
  fullText: string;
  parts: AssistantPart[];
  streamSeq: number;
  updatedAt: number;
};
```

Required behavior:

1. Create/update the live snapshot from canonical chat events:
   - `turn_begin`: initialize snapshot with `userInput`, empty `fullText`,
     empty `parts`, `status: "in_flight"`, incremented `streamSeq`.
   - `content`: append text to `fullText` and coalesce text parts the same way
     persistence does.
   - `thinking`: append/coalesce think parts.
   - `tool_call`: append a tool part.
   - `tool_call_args`: accumulate arguments for matching tool part where
     possible.
   - `tool_result`: update matching tool part with parsed args/result.
   - `status_update`: update `updatedAt` / optional metadata only if useful.
   - `turn_end`: mark snapshot `complete`, increment `streamSeq`, keep it
     briefly available for browse return until durable history catches up.

2. Include `liveTurn` on browse-only `thread:opened` when a live snapshot exists
   for the requested thread.

3. Do not write stream chunks to SQLite. SQLite remains completed/interrupted
   exchanges only.

4. Do not move stop/interrupt behavior into this slice.

5. Do not add crash recovery for midstream turns.

### Server Structure

Keep file responsibilities clean:

- `thread-runtime-manager.js`: runtime state and live snapshot storage helpers.
- `canonical-chat-event-applier.js`: may call injected snapshot updater or emit
  enough canonical events for a snapshot helper.
- Prefer a focused helper if snapshot mutation is more than a few methods, for
  example:

```text
fusion-studio-server/lib/thread/live-turn-snapshot.js
```

One job per file. Do not turn `thread-runtime-manager.js` or
`canonical-chat-event-applier.js` into a large mixed-responsibility file.

### Client

Overlay `liveTurn` after durable history hydration.

Required behavior:

1. `thread:opened` still clears and hydrates durable SQLite history.
2. If `msg.liveTurn` exists:
   - ensure the live user bubble exists for `liveTurn.userInput`
   - set `currentTurn` from `liveTurn.turnId`
   - rebuild `segments` from `liveTurn.parts`
   - set `pendingTurnEnd` when `liveTurn.status === "complete"`
3. The UI should fast-render missed content rather than replaying every chunk in
   real time.
4. After catch-up, newly arriving stream messages continue through the existing
   `stream-handlers.ts` path.
5. Deduplicate against existing durable history:
   - If the completed exchange is already present in SQLite history, do not add
     a duplicate live user/assistant pair.
   - If `liveTurn.status === "complete"` and durable history does not yet
     include it, overlay it and let existing finalize/reveal behavior settle.

Important: do not modify `LiveSegmentRenderer.tsx` unless there is no other
reasonable option. Prefer reconstructing the same store state that
`stream-handlers.ts` would have produced.

## Current Code Seams

Server:

- `fusion-studio-server/lib/thread/thread-runtime-manager.js`
- `fusion-studio-server/lib/thread/thread-runtime-controller.js`
- `fusion-studio-server/lib/thread/thread-crud.js`
  - `handleThreadOpen()` sends `thread:opened`
- `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`
  - canonical events already update `session.currentTurn` and
    `session.assistantParts`
- `fusion-studio-server/lib/wire/wire-broadcaster.js`
  - sends live stream events to the client

Client:

- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
  - handles `thread:opened`
  - converts durable rich history to messages
- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
  - converts live routed events to current turn + segments
- `fusion-studio-client/src/state/slices/chatSlice.ts`
  - owns `setCurrentTurn`, `resetSegments`, `pushSegment`, etc.
- `fusion-studio-client/src/types/index.ts`
  - add `LiveTurnSnapshot` / websocket typing if needed

## Suggested Client Reconstruction

The snapshot `parts` should be canonical persisted assistant parts. Build live
segments similarly to existing `convertPartToSegment()` in `thread-handlers.ts`,
but be careful:

- `text` part -> text segment
- `think` part -> think segment
- `tool_call` part -> tool segment with `complete` based on result presence

If needed, extract a small shared conversion helper from `thread-handlers.ts`
only if there is now a second consumer. Keep it focused.

When applying `liveTurn`:

```text
clear/hydrate durable history
if liveTurn exists and is not already durable:
  add/ensure user message
  set currentTurn
  reset segments
  push reconstructed segments
  set pendingTurnEnd if complete
```

Do not emit fake WebSocket chunks one by one just to rebuild state.

## Non-Goals

- Do not implement stop/interrupt.
- Do not persist partial/in-flight chunks to SQLite.
- Do not implement OpenCode.
- Do not add automation/ticket hooks.
- Do not add warm-on-focus.
- Do not queue concurrent prompts.
- Do not split `LiveSegmentRenderer.tsx`.

## Required Tests

Server tests:

1. Snapshot initializes on `turn_begin`.
2. Snapshot updates/coalesces on `content` and `thinking`.
3. Snapshot records tool call and tool result parts.
4. Snapshot marks `complete` on `turn_end`.
5. `thread:opened` includes `liveTurn` for an in-flight runtime.
6. `thread:opened` omits `liveTurn` for cold/no-live threads.

Client tests if a suitable test pattern exists:

1. `thread:opened` with `liveTurn` overlays user bubble/current turn/segments.
2. Returning to a complete-but-not-yet-durable live turn does not duplicate if
   history already includes the exchange.

If no frontend unit harness exists, document that and run the manual smoke.

## Acceptance Checks

Search:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
rg -n "liveTurn|LiveTurnSnapshot|streamSeq|snapshot" fusion-studio-server/lib fusion-studio-server/test fusion-studio-client/src
```

Expected:

- snapshot storage/mutation is in thread runtime or a focused helper
- `thread:opened` includes `liveTurn`
- client handles `msg.liveTurn`

Search:

```bash
rg -n "LiveSegmentRenderer|setTimeout\\(|setInterval\\(|SQLite|addExchange" fusion-studio-client/src/lib/ws/thread-handlers.ts fusion-studio-client/src/lib/ws/stream-handlers.ts fusion-studio-server/lib/thread fusion-studio-server/lib/wire
```

Expected:

- no LiveSegmentRenderer changes unless explicitly justified
- no stream chunk persistence to SQLite
- no timer-based fake replay

## Validation

Server:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/ws/thread-handlers.ts src/lib/ws/stream-handlers.ts src/state/slices/chatSlice.ts src/types/index.ts
```

Adjust the eslint list to exactly match touched frontend files.

Repo:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check -- <touched files>
```

If repo-wide `git diff --check` fails only because of unrelated pre-existing
transcription whitespace, report it clearly and include the touched-file check.

Restart:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Manual smoke:

1. Send a prompt in thread A.
2. Wait for streaming to begin.
3. Browse to thread B.
4. Wait 10-20 seconds.
5. Browse back to A before completion.
6. Verify A fast-forwards to the latest live content instead of resuming from
   the old visual position.
7. Repeat and browse back after completion.
8. Verify A shows the completed assistant turn immediately without duplicate
   user/assistant messages.
9. Confirm passive browsing still does not warm cold threads.

## Worker Report Requirements

Report:

- Files changed.
- Snapshot storage/mutation structure chosen.
- How `liveTurn.parts` are converted on the client.
- Tests added and results.
- Build/lint results.
- `git diff --check` result, distinguishing touched-file vs unrelated failures.
- Restart smoke URL.
- Manual smoke observations for return-before-completion and
  return-after-completion.
