# Runtime-4: Server-Owned Stop / Interrupt

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Objective

Make Stop behave like CLI Escape as closely as the current harness allows:

```text
stop click
  -> server freezes the current live turn
  -> runtime enters stopping
  -> server interrupts/stops the harness session
  -> one terminal interrupted turn is emitted
  -> partial assistant output is persisted
  -> client clears active state from the terminal event
  -> next prompt can be sent without losing transcript coherence
```

This slice fixes the current jank where Stop is client-local and a refresh can
show user bubbles with no persisted partial assistant reply.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-3-live-snapshot-overlay.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-3r-live-overlay-tail-repair.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Critical Coordination Notes

The repo is dirty with accepted runtime slices and unrelated packaging work.
Inspect before editing. Do not revert unrelated files.

Do not touch these packaging files in this slice:

```text
fusion-studio-client/electron/main.cjs
fusion-studio-client/electron/server-spawn.cjs
fusion-studio-client/package.json
fusion-studio-server/package.json
fusion-studio-server/package-lock.json
```

Preserve the dev database behavior repaired by the coordinator session:

- normal dev Electron must not pass `FUSION_APP_USER_DATA` to the server
- packaged/smoke launches may pass an explicit user-data path

Do not edit `fusion-studio-server/server.js` unless a narrow router injection is
unavoidably missing. The expected work is in runtime/controller/router modules.

## Current Behavior

Current Stop is local UI cleanup:

```text
fusion-studio-client/src/components/chat/useChatArea.ts
  handleStop()
    -> finalizeTurn(scope, tid)
    -> clears sendingTarget
```

That does not tell the server to interrupt the harness and does not guarantee
the partial assistant response is persisted.

The current runtime pieces already exist:

```text
fusion-studio-server/lib/thread/thread-runtime-manager.js
fusion-studio-server/lib/thread/thread-runtime-controller.js
fusion-studio-server/lib/thread/live-turn-snapshot.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/process-manager.js
fusion-studio-client/src/components/chat/useChatArea.ts
fusion-studio-client/src/lib/ws/stream-handlers.ts
```

Kimi currently exposes `session.stop()` by killing the process. That is an
acceptable fallback for this slice, but persistence must happen before/alongside
the kill so Fusion's canonical transcript remains coherent.

## Scope

Do:

- Add a server message route for user stop, preferably `turn:stop`.
- Route stop through `thread-runtime-controller`, not directly from the UI into
  local `finalizeTurn()`.
- Add runtime manager support for `stopping` and interrupted terminal state.
- Freeze/use the current live/session state to emit one interrupted terminal
  `chat:turn_end`.
- Include terminal metadata on `chat:turn_end`:

```js
{
  reason: 'interrupted',
  partial: true
}
```

- Persist the partial assistant message through the same assistant persistence
  path used for normal turn end.
- Ensure the audit subscriber receives the interrupted `chat:turn_end` with
  `userInput` and `parts`.
- Stop/kill the active harness after the terminal state is captured.
- Return runtime state to `ready` if the harness session is still usable, or
  `cold` if the process was killed.
- Update the client Stop button to send the server stop request and wait for the
  terminal stream event instead of finalizing locally.

Do not:

- Implement OpenCode.
- Implement automation hooks.
- Implement warm-on-focus.
- Implement warm pool/FIFO/timers.
- Write render queue chunks to SQLite.
- Split `LiveSegmentRenderer.tsx`.
- Redesign the live snapshot overlay.
- Do broad frontend state refactors.

## Suggested Server Design

Add a controller method such as:

```js
async function stopRuntimeTurn({ ws, session, clientMsg }) { ... }
```

Target identity should come from `clientMsg.scope` and `clientMsg.threadId`.
Do not infer from whichever thread is currently visible if explicit fields are
present.

For the first implementation, use existing runtime/session state:

- `threadRuntimeManager.getRuntimeState(runtimeKey)`
- `threadRuntimeManager.getLiveTurn(runtimeKey)`
- `getWireForThread(threadId)`
- `wire.stop?.()` or `wire.kill?.('SIGTERM')`

If there is no `in_flight` runtime or no live turn, respond with a recoverable
no-op/error and do not persist an empty assistant message.

Important: create one terminal event. Avoid producing both a synthetic
interrupted `turn_end` and a later normal `turn_end` for the same turn.

Reasonable implementation options:

1. Extract a shared terminal-turn helper from
   `canonical-chat-event-applier.js` so normal and interrupted endings use the
   same persistence/emission/reset path.
2. Or add a narrow exported helper that can apply a synthetic canonical
   `turn_end` with `{ reason: 'interrupted', partial: true }` using the existing
   session state.

Keep the module responsibilities clean:

- runtime controller orchestrates stop
- runtime manager stores runtime/live state
- live-turn-snapshot mutates snapshot shape only
- canonical applier owns chat event/session mutation semantics
- process manager owns wire lookup/registry

## Client Design

In `useChatArea.ts`, `handleStop()` should send a websocket message like:

```ts
{
  type: 'turn:stop',
  scope,
  threadId: currentThreadId
}
```

Then:

- do not call `finalizeTurn()` directly from `handleStop`
- do not immediately erase the active assistant turn locally
- keep the stop/turn-active visual state until the terminal event arrives
- clear the matching `sendingTarget` when the terminal event for that same
  `{scope, threadId}` arrives

The existing `turn_end` stream handler may remain responsible for setting
`pendingTurnEnd`; it needs to understand `reason: 'interrupted'` / `partial:
true` if the UI needs to fast-render the partial turn.

Prefer minimal state additions. Do not create a second client-side stop state
machine unless the existing state cannot represent `stopping`.

## Required Behavior

### Stop Mid-Stream

1. User sends a prompt.
2. Assistant starts streaming.
3. User clicks Stop.
4. Server emits one terminal interrupted turn.
5. Partial assistant response is durable.
6. UI finalizes the partial assistant turn.
7. Next prompt can be sent.

### Refresh After Stop

After stopping and refreshing:

- the stopped user prompt exists
- the interrupted partial assistant response exists
- a later user prompt appears after that exchange
- there are no adjacent orphan user bubbles caused by missing assistant
  persistence

### Navigation

If the user stops the currently visible thread while another thread is in
flight, stop only the requested thread. Do not stop by global session/wire.

If the user browsed away from thread A and A is still in flight, this slice may
leave remote/background stop controls out of scope. Do not break background
streaming.

## Tests To Add / Update

Server focused tests are required.

Add tests around the smallest available seam, likely:

```text
fusion-studio-server/test/thread/thread-runtime-controller.test.js
fusion-studio-server/test/wire/canonical-chat-event-applier.test.js
```

Cover:

1. Stop on an `in_flight` runtime emits `chat:turn_end` with
   `reason: "interrupted"` and `partial: true`.
2. Interrupted terminal event includes `threadId`, `scope`, `userInput`,
   `fullText`, and `parts`.
3. Partial assistant persistence receives the explicit target `threadId`.
4. Runtime becomes `cold` if the harness process is killed.
5. Stop is a no-op/recoverable error when runtime is not `in_flight`.
6. Duplicate stop does not emit duplicate terminal events.

Frontend tests are optional only if there is no existing test seam. If no test
is added, explain why in the result report and include manual smoke steps.

## Acceptance Searches

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
rg -n "type: ['\\\"]stop['\\\"]|finalizeTurn\\(scope, tid\\)|turn:stop|reason: ['\\\"]interrupted['\\\"]|partial" fusion-studio-client/src fusion-studio-server/lib fusion-studio-server/test
```

Expected:

- no local Stop path that finalizes the active turn without a server request
- `turn:stop` route exists
- interrupted terminal metadata exists in server code/tests
- `partial: true` exists in server code/tests

Also run:

```bash
rg -n "FUSION_APP_USER_DATA" fusion-studio-client/electron/main.cjs fusion-studio-client/electron/server-spawn.cjs
```

Expected:

- dev user-data gating remains intact
- no unconditional server `FUSION_APP_USER_DATA` env assignment

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
npx eslint src/components/chat/useChatArea.ts src/lib/ws/stream-handlers.ts
```

Repo whitespace:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check -- \
  fusion-studio-server/lib/thread/thread-runtime-manager.js \
  fusion-studio-server/lib/thread/thread-runtime-controller.js \
  fusion-studio-server/lib/thread/live-turn-snapshot.js \
  fusion-studio-server/lib/wire/canonical-chat-event-applier.js \
  fusion-studio-server/lib/ws/client-message-router.js \
  fusion-studio-client/src/components/chat/useChatArea.ts \
  fusion-studio-client/src/lib/ws/stream-handlers.ts
```

Restart:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Manual smoke:

1. Open a project thread.
2. Send a prompt that streams long enough to stop.
3. Click Stop mid-stream.
4. Verify a partial assistant response remains visible.
5. Refresh Fusion.
6. Verify the stopped exchange still has the partial assistant response.
7. Send another prompt in the same thread.
8. Verify the next response starts normally.
9. Switch threads while a response streams and confirm Stop only affects the
   selected thread when clicked.

## Report Requirements

Report:

- Files changed.
- Exact stop message name used.
- How duplicate terminal events are prevented.
- How interrupted persistence reuses or mirrors normal `turn_end`.
- Whether the harness was cooperatively interrupted or killed.
- Runtime state after stop (`ready` or `cold`) and why.
- Tests added and results.
- Build/lint results.
- Restart URL.
- Manual smoke observations.
