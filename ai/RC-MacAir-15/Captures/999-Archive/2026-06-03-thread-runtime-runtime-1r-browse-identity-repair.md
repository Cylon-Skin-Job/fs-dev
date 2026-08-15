# Runtime-1R: Repair Browse Identity Separation

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Why This Repair Exists

Runtime-1 correctly introduced browse-only `thread:open` and stopped passive browsing from spawning or killing a wire. However, the implementation still shares mutable per-WebSocket selection state with assistant persistence.

The dangerous path:

1. Thread A is in flight.
2. User passively browses to thread B with `thread:open`.
3. `handleThreadOpen()` updates `state.threadIds[scope] = B`.
4. Thread A reaches `turn_end`.
5. `canonical-chat-event-applier` calls `persistAssistantMessage(..., scope)`.
6. `thread-messages.addAssistantMessage()` resolves the target from `state.threadIds[scope]`, which is now B.

That can persist an assistant response from A into B. It also leaves us with the wrong abstraction boundary for Runtime-2 and Runtime-3.

## Objective

Make passive browse selection incapable of changing the execution/persistence identity of an in-flight turn.

This is a repair slice, not the warm/send runtime slice.

## Scope

Do:

- Ensure assistant persistence uses the explicit runtime/thread identity that produced the turn, not the currently selected/browsed thread.
- Preserve Runtime-1 passive `thread:open` behavior: hydrate history, do not spawn, do not kill, do not warm.
- Add tests for the browse-while-in-flight persistence case.
- Keep the runtime manager skeletal.

Do not:

- Implement warm-on-focus.
- Implement cold-send UI.
- Implement live snapshot replay.
- Implement stop/interrupt behavior.
- Add OpenCode support.
- Redesign the whole session model yet.

## Current Code Seams

Inspect these first:

- `fusion-studio-server/lib/thread/thread-crud.js`
  - `handleThreadOpen()` currently updates `state.threadIds[scope]`.
- `fusion-studio-server/lib/thread/thread-messages.js`
  - `addAssistantMessage()` currently resolves the target via `state.threadIds[scope]`.
- `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`
  - `handleTurnEnd()` already has access to `session.currentThreadId` through `getThreadId()`.
- `fusion-studio-server/lib/wire/message-router.js`
  - `persistAssistantMessage()` delegates to `threadWebSocketHandler.addAssistantMessage(...)`.
- `fusion-studio-server/lib/ws/thread-ws-handlers.js`
  - `spawnAndSetupWire()` sets `session.currentThreadId` and `session.currentScope`.

## Suggested Minimal Fix

Prefer an explicit identity parameter over reading mutable selection state:

- Change `thread-messages.addAssistantMessage()` to accept an optional explicit `threadId`.
- Change `message-router.persistAssistantMessage()` to accept and forward that `threadId`.
- Change `canonical-chat-event-applier.handleTurnEnd()` to capture `const threadId = getThreadId()` before persistence/emission and pass it to persistence.
- Keep the emitted `chat:turn_end.threadId` using the same captured value.

The important rule: both assistant persistence and `chat:turn_end` must use the same captured thread identity.

If you find a cleaner local pattern, use it, but do not let assistant persistence read `state.threadIds[scope]` for in-flight turn ownership.

## Required Tests

Add or update focused server tests proving:

1. If `session.currentThreadId` is `A` but the WebSocket selected thread state for the same scope is `B`, `turn_end` persists assistant output to `A`.
2. The emitted `chat:turn_end` also carries `threadId: A`.
3. Existing normal persistence behavior still works when no browse happened.
4. Passive `thread:open` still does not call `closeThread`, spawn a wire, or mark runtime ready.

Use the existing test style in:

- `fusion-studio-server/test/wire/canonical-chat-event-applier.test.js`
- `fusion-studio-server/test/ws/client-message-router.test.js`
- Existing thread handler tests if available.

## Acceptance Checks

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Search checks:

```bash
rg "addAssistantMessage\\(" fusion-studio-server/lib fusion-studio-server/test
rg "persistAssistantMessage\\(" fusion-studio-server/lib fusion-studio-server/test
```

Manual reasoning check:

- Browsing B while A streams must not change A's persistence target.
- Browsing B while A streams may still reload/hydrate the visible UI from SQLite. That visual live replay problem is Runtime-3, not this repair.

## Expected Result Report

Report back:

- Files changed.
- Exact identity/persistence fix chosen.
- Focused tests added.
- Full server test result.
- `git diff --check` result.
- Any remaining known limitation, especially live snapshot/replay, without trying to solve it in this slice.
