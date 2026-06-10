# Runtime-4R: Stop / Interrupt Repair

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Why This Repair Exists

Runtime-4 implemented the right top-level stop shape, but review found two
issues that should be fixed before manual smoke or moving to Runtime-5.

1. Kimi `sendMessage()` can hang after Stop.

   Current Kimi `sendMessage()` exits only when it receives a canonical
   `turn_end` event or a JSON-RPC `response_error`. Runtime-4 stops Kimi by
   killing the process through `session.stop()`. A killed process may emit
   neither `turn_end` nor `response_error`, so the async prompt-drain loop can
   stay alive forever after the runtime has already been marked cold.

2. Interrupted live snapshots are treated as streaming on overlay.

   `thread-handlers.ts` currently treats only `liveTurn.status === "complete"`
   as terminal for `currentTurn.status` and `pendingTurnEnd`. A stopped turn has
   `status: "interrupted"` and should also be terminal. Otherwise reopening
   during the async persistence window can overlay an interrupted turn as
   streaming and leave it visually active.

There is also a naming cleanup:

- `stream-handlers.ts` dispatches `fusion:prompt-acceptance-failed` from every
  `turn_end` to clear `sendingTarget`. That works as a private signal, but it
  makes normal completion look like prompt acceptance failure to future
  listeners. Replace it with a terminal-turn event.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-04-thread-runtime-runtime-4-server-owned-stop-interrupt.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Scope

Do:

- Make Kimi `sendMessage()` terminate when the underlying process exits during
  an active send.
- Keep Stop from producing a user-visible harness failure after the synthetic
  interrupted `turn_end`.
- Treat `interrupted` and `error` live turns as terminal in client live overlay.
- Replace the normal `turn_end` dispatch of `fusion:prompt-acceptance-failed`
  with a dedicated terminal-turn event such as `fusion:turn-ended`.
- Keep actual auth/error failures using `fusion:prompt-acceptance-failed`.
- Add focused tests for the repaired seams.

Do not:

- Redesign Runtime-4.
- Change the `turn:stop` message name.
- Rework prompt acceptance.
- Touch Electron packaging files.
- Touch `fusion-studio-server/server.js` unless there is a proven narrow need.
- Implement OpenCode, automation hooks, warm-on-focus, timers, or FIFO.

## Current Code Seams

Inspect:

```text
fusion-studio-server/lib/harness/kimi/index.js
fusion-studio-server/lib/thread/thread-runtime-controller.js
fusion-studio-client/src/lib/ws/thread-handlers.ts
fusion-studio-client/src/lib/ws/stream-handlers.ts
fusion-studio-client/src/components/chat/useChatArea.ts
fusion-studio-server/test/thread/thread-runtime-controller.test.js
fusion-studio-server/lib/harness/kimi/__tests__/harness-send-message.test.js
```

## Required Behavior

### Kimi Send Loop Termination

When a Kimi process exits while `sendMessage()` is active:

- the async generator must stop promptly
- listeners must be removed
- Runtime-4's already-emitted interrupted terminal event must remain the only
  terminal chat event
- the prompt-drain task must not send a spurious recoverable error to the client
  after a user-requested stop

Acceptable implementation options:

- Add an `onExit` listener inside `sendMessage()` that marks `done = true` and,
  for an expected stop, exits without throwing.
- Track an explicit `stopped` / `stopRequested` flag in the Kimi session and use
  it in the generator.
- Or have `session.stop()` emit an internal response error/cancellation signal
  that the generator treats as expected cancellation.

Do not rely on process kill alone to break the loop.

### Interrupted Overlay Is Terminal

For `liveTurn.status`:

```text
in_flight    -> streaming, pendingTurnEnd false
complete     -> complete, pendingTurnEnd true
interrupted  -> complete/terminal, pendingTurnEnd true
error        -> complete/terminal, pendingTurnEnd true
```

`convertPartToSegment()` already receives `isTerminal`. Ensure
`thread-handlers.ts` passes terminal true for every non-`in_flight` status and
sets `pendingTurnEnd` the same way.

### Terminal Event Naming

In `stream-handlers.ts`, normal `turn_end` should dispatch a terminal event,
not a prompt acceptance failure event.

Suggested:

```ts
window.dispatchEvent(new CustomEvent('fusion:turn-ended', {
  detail: { scope, threadId, reason: msg.reason, partial: msg.partial },
}));
```

Then `useChatArea.ts` should listen to that event to clear the matching
`sendingTarget`.

Keep `fusion:prompt-acceptance-failed` for:

- auth errors
- prompt/warm/send failures
- other true prompt acceptance or delivery failures

## Tests

Add focused tests.

Server:

1. Kimi `sendMessage()` generator exits when the process exits after
   `session.stop()`.
2. Stop does not leave the prompt-drain promise stuck.
3. User-requested stop does not send a later recoverable harness-send error
   after the interrupted terminal event.

If testing the real Kimi harness is awkward, use the smallest seam available in
`harness-send-message.test.js` with a fake process/parser event emitter. Do not
skip this entirely: this is the bug that can make the server leak work.

Frontend:

If there is no frontend test harness, document that. At minimum, add/adjust pure
helper tests if one exists. Otherwise rely on build/lint plus manual smoke.

## Acceptance Searches

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
rg -n "fusion:prompt-acceptance-failed|fusion:turn-ended|liveTurn.status === 'complete'|liveTurn.status !== 'in_flight'|proc.on\\('exit'|stopRequested|cancel" \
  fusion-studio-client/src fusion-studio-server/lib fusion-studio-server/test
```

Expected:

- `fusion:prompt-acceptance-failed` is not dispatched from normal `turn_end`
- a terminal-turn event exists and is listened to by `useChatArea.ts`
- interrupted/error live turns are handled as terminal
- Kimi send/stop path has an explicit cancellation or process-exit break

Also verify the packaging guard remains intact:

```bash
rg -n "FUSION_APP_USER_DATA" fusion-studio-client/electron/main.cjs fusion-studio-client/electron/server-spawn.cjs
```

Expected:

- no unconditional server `FUSION_APP_USER_DATA` env assignment in dev

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
npx eslint src/components/chat/useChatArea.ts src/lib/ws/stream-handlers.ts src/lib/ws/thread-handlers.ts
```

Touched-file whitespace:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check -- \
  fusion-studio-server/lib/harness/kimi/index.js \
  fusion-studio-server/lib/thread/thread-runtime-controller.js \
  fusion-studio-client/src/lib/ws/thread-handlers.ts \
  fusion-studio-client/src/lib/ws/stream-handlers.ts \
  fusion-studio-client/src/components/chat/useChatArea.ts
```

Restart:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Manual smoke after automated validation:

1. Send a streaming prompt.
2. Stop mid-stream.
3. Watch server logs for no later `Harness sendMessage failed` caused by the
   user stop.
4. Verify partial response remains visible.
5. Refresh and verify the partial response persists.
6. Send again in the same thread.

## Report Requirements

Report:

- Files changed.
- How Kimi `sendMessage()` exits on stop/process exit.
- Whether stop can still emit a later harness-send error and why.
- How interrupted/error live snapshots are marked terminal.
- Terminal event name used on the client.
- Tests added and results.
- Build/lint results.
- Restart URL.
- Manual smoke observations.
