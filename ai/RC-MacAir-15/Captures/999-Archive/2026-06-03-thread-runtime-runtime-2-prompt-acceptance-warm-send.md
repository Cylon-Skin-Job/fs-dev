# Handoff: Thread Runtime Runtime-2 - Prompt Acceptance and Warm Send

## Status

READY FOR EXECUTION

## Objective

Route prompt delivery through the server-owned thread runtime boundary and make
the client wait for server acceptance before committing the user bubble.

This slice must fix the post-Runtime-1 temporary bad state where passive browse
can select a cold thread, but sending from that visible thread still relies on
old WebSocket-owned wire/session behavior.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-1-browse-only-open.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-1r-browse-identity-repair.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Captures/002-SPECs/VIEW-CHAT.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
```

## Startup Checks

Run from the repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
```

Expected root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The working tree is expected to be dirty with accepted but uncommitted prior
harness/runtime slices and user/runtime state. Do not revert unrelated changes.

## Current State

Runtime-1 added:

- `fusion-studio-server/lib/thread/thread-runtime-manager.js`
- browse-only `thread:open`
- passive client navigation via `thread:open`

Runtime-1R repaired:

- assistant persistence uses the explicit in-flight thread identity at
  `turn_end`

Current remaining problem:

- Client still optimistically clears input and adds the user bubble before the
  server accepts the prompt.
- `prompt` still uses direct WebSocket/session lookup and dead-wire recovery.
- A visible browsed thread can be cold, and send must now warm/resume it before
  committing the user message.

## Scope

### Server

Add runtime-owned prompt acceptance.

Required behavior:

1. `prompt` must resolve the target runtime by explicit `{ workspaceId, scope,
   viewId?, threadId }`.
2. If the runtime is `cold`, warm/resume it before sending the prompt.
3. If the runtime is `warming`, wait for the same warm-up rather than spawning
   twice.
4. If the runtime is `ready`, send immediately.
5. If the runtime is `in_flight` or `stopping`, reject/defer visibly. Do not
   interrupt or queue a second prompt in this slice.
6. Pin route identity at acceptance:
   - `session.currentThreadId`
   - `session.currentScope`
   - `session.currentViewId`
   must be set for the accepted prompt before canonical events begin.
7. Persist the user message only after runtime accepts the prompt.
8. Emit an explicit acceptance message to the client after persistence:

```ts
{
  type: "message:sent",
  scope: "project" | "view",
  threadId: string,
  content: string
}
```

Keep the existing `message:sent` name unless there is a concrete blocker; the
client already has a handler seam for it. Do not add both `message:sent` and
`prompt:accepted` unless you have a strong reason.

State transitions:

```text
cold -> warming -> ready -> in_flight -> ready
ready -> in_flight -> ready
warming -> ready -> in_flight -> ready
```

On warm failure:

```text
warming -> cold
```

and send a visible error with `threadId`, `scope`, and `recoverable: true`.

### Server Structure

Preserve code standards:

- Keep `thread-runtime-manager.js` focused on runtime state bookkeeping.
- Do not turn it into a WebSocket router, harness adapter, and persistence
  service.
- If orchestration is more than a few small helpers, add a focused controller
  file such as:

```text
fusion-studio-server/lib/thread/thread-runtime-controller.js
```

One acceptable split:

- `thread-runtime-manager.js`: runtime map, states, warm promise slot,
  state transition helpers.
- `thread-runtime-controller.js`: resolve manager/key, warm via
  `spawnAndSetupWire()`, accept prompt, call `handleMessageSend()`, invoke
  `wire._sendMessage()`.

Do not add warm pools, FIFO, automation, stop, or live snapshots in this slice.

### Client

Change send UX from optimistic to acceptance-based.

Required behavior:

1. Clicking send while a thread is cold/warming shows a small clockwise
   spoke/wheel loader over or inside the send button.
2. The loader must be visually distinct from the existing active-turn stop
   indicator/spinning partial circle.
3. The send button and dropdown must be frozen/disabled while warm/send
   acceptance is pending. Double-click must not send duplicates.
4. Do not commit the user bubble until the server sends `message:sent`.
5. Do not clear the input until the server accepts the prompt.
6. If warm/acceptance fails, keep or restore the composed text and clear the
   warming visual state.
7. Orb/turn-active state starts after acceptance, not before.

Implementation seams:

- `fusion-studio-client/src/components/chat/useChatArea.ts`
  - currently adds the user message optimistically.
- `fusion-studio-client/src/state/slices/chatSlice.ts`
  - currently sends `prompt` and returns immediately.
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
  - currently logs `message:sent`; this is the natural place to add the user
    bubble on acceptance.
- `fusion-studio-client/src/components/chat/ChatAreaFooter.tsx`
  - pass send-warming state down.
- `fusion-studio-client/src/components/chat/SendButtonGroup.tsx`
  - render disabled/warming visual state.
- `fusion-studio-client/src/components/ChatArea.css`
  - add small scoped styles using CSS variables with fallbacks.

The user asked for a little clockwise spoke/wheel style indicator. Prefer a
small CSS or Material Symbols based indicator over adding a remote GIF. Do not
fetch external assets. If you use a CSS indicator, make it clearly spoke-like
and distinct from `.rv-stop-btn`.

### Warm Triggers

Implement send fallback as mandatory.

If low-risk, also add explicit warm intent for:

- chat input focus
- helper insertion/paste into the input

Use a message like:

```ts
{ type: "thread:warm", scope, threadId }
```

If warm-on-focus/insertion would broaden the slice too much, defer it and
document that Runtime-2 only guarantees send fallback.

Passive `thread:open` must not warm.

## Non-Goals

- Do not implement live snapshot overlay.
- Do not implement server-owned stop/interrupt.
- Do not implement OpenCode.
- Do not add automation/ticket hooks.
- Do not queue multiple prompts to the same runtime.
- Do not write stream chunks to SQLite.
- Do not split `LiveSegmentRenderer.tsx`.
- Do not redesign all chat state.

## Required Tests

Add focused server tests proving:

1. Prompt to a cold browsed thread warms/spawns/resumes the runtime and then
   accepts the prompt.
2. Prompt acceptance persists the user message before `_sendMessage()` events
   are drained.
3. While runtime is `warming`, a second prompt does not spawn a second wire.
4. While runtime is `in_flight`, another prompt is rejected/deferred and does
   not call `_sendMessage()`.
5. Warm failure returns runtime to `cold` and sends a recoverable error.
6. Passive `thread:open` still does not warm.

Add focused client tests if the project already has a usable test pattern for
the touched components/store handlers. If not, keep frontend changes small and
validate by build/lint plus manual smoke.

## Acceptance Checks

Search checks:

```bash
rg -n "addMessage\\(scope, tid|setIsSending\\(true\\).*sendMessage|chatInputRef\\.current\\?\\.clearText\\(\\)" fusion-studio-client/src/components/chat fusion-studio-client/src/state/slices/chatSlice.ts
```

Expected:

- no optimistic user-bubble commit in `handleSend`
- no input clear before server acceptance
- any send-pending state is clearly tied to acceptance/warm-up

```bash
rg -n "thread:open'|thread:open\"|thread:warm|prompt" fusion-studio-server/lib/ws fusion-studio-server/lib/thread fusion-studio-client/src
```

Expected:

- `thread:open` remains browse-only
- prompt path goes through runtime acceptance
- warm path, if implemented, does not run from passive browse

```bash
rg -n "IN_FLIGHT|WARMING|markState|markReady|coolIfIdle|warm" fusion-studio-server/lib/thread
```

Expected:

- runtime state transitions are centralized and testable
- no ad hoc duplicated state strings outside a narrow boundary

## Validation

Baseline:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Server:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/components/chat/useChatArea.ts src/components/chat/ChatAreaFooter.tsx src/components/chat/SendButtonGroup.tsx src/components/ChatInput.tsx src/lib/ws/thread-handlers.ts src/state/slices/chatSlice.ts
```

Adjust the eslint file list to exactly match touched frontend files.

Restart smoke:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Manual smoke:

1. Open a previously browsed/cold thread.
2. Send a short prompt.
3. Verify the send button shows the small spoke/wheel warming indicator.
4. Verify double-clicking send does not create duplicate user messages or
   duplicate prompts.
5. Verify the user bubble appears only after server acceptance.
6. Verify the orb starts after acceptance.
7. Verify a normal assistant reply streams.
8. Force/observe a warm failure if practical; verify no phantom user bubble and
   the input text is not lost.
9. Confirm passive thread clicks still do not warm/spawn/kill.

## Worker Report Requirements

Report back:

- Files changed.
- Runtime orchestration structure chosen.
- Whether warm-on-focus/insertion was implemented or deferred.
- Tests added and results.
- Frontend build/lint results.
- `git diff --check` result.
- Restart smoke result and server URL if available.
- Manual smoke observations, especially duplicate-send and phantom-user-bubble
  behavior.
