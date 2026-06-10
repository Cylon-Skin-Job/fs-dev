# Runtime-5: Automation Hooks Foundation

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Objective

Expose enough server-side runtime state and control for future ticket/orchestrator
automation to warm and send prompts to a thread without requiring the user to
have that workspace or thread focused.

This is the narrow foundation slice. It should prove that a background caller
can:

```text
target thread -> inspect runtime state -> warm if cold -> persist user prompt
  -> drain canonical harness events -> update live snapshot -> persist assistant
```

Automation must never interrupt a user or agent turn that is already in flight.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-2-prompt-acceptance-warm-send.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-3-live-snapshot-overlay.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-04-thread-runtime-runtime-4-server-owned-stop-interrupt.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-04-thread-runtime-runtime-4r-stop-interrupt-repair.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Critical Coordination Notes

The repo is dirty with accepted runtime slices plus unrelated packaging, ribbon,
Slack, and state changes. Inspect before editing. Do not revert unrelated files.

Do not touch Electron packaging files in this slice:

```text
fusion-studio-client/electron/main.cjs
fusion-studio-client/electron/server-spawn.cjs
fusion-studio-client/package.json
fusion-studio-client/package-lock.json
fusion-studio-server/package.json
fusion-studio-server/package-lock.json
```

Do not edit `fusion-studio-server/server.js` unless there is a proven narrow
injection point missing. The expected work is under `fusion-studio-server/lib/thread/`
and possibly small shared helpers under `fusion-studio-server/lib/wire/`.

Do not change client UI in this slice. Runtime-4/4R plus the coordinator repair
already handled Stop, interrupted terminal turns, and instant interrupted flush.

## Current State

Current user prompt acceptance is owned by:

```text
fusion-studio-server/lib/thread/thread-runtime-controller.js
```

It is still WebSocket-shaped:

- reads route state from `ThreadWebSocketHandler.getState(ws)`
- persists the user message through `ThreadWebSocketHandler.handleMessageSend(ws, ...)`
- sends acceptance/failure feedback through `ws.send(...)`
- warms through `spawnAndSetupWire(...)` from `lib/ws/thread-ws-handlers.js`

Current wire spawning is also WebSocket-shaped:

```text
fusion-studio-server/lib/ws/thread-ws-handlers.js
  spawnAndSetupWire({ ws, session, wireLifecycle, threadId, scope, projectRoot })
```

That helper sends `wire_ready`, registers the wire with a `ws`, and registers
the session with a `ThreadManager`.

The useful reusable pieces already exist:

```text
fusion-studio-server/lib/thread/thread-runtime-manager.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/lib/harness/compat.js
fusion-studio-server/lib/enforcement.js
fusion-studio-server/lib/chat-scope.js
```

The canonical applier can be reused for automation if the automation path
provides a headless session object, direct manager persistence, event-bus emit,
settings-bounce enforcement, and target identity.

## Scope

Do:

- Add an automation-facing runtime module, preferably:

```text
fusion-studio-server/lib/thread/thread-runtime-automation.js
```

- Export it from:

```text
fusion-studio-server/lib/thread/index.js
```

- Add a runtime status lookup for automation callers.
- Add a programmatic automation send path that does not require an active
  browser WebSocket or focused workspace.
- Reuse canonical event application for live snapshots, event-bus emission,
  tool enforcement, and assistant persistence.
- Persist the automation user prompt only after the runtime accepts the prompt.
- Return structured accepted/deferred/failed results to the caller.
- Defer, rather than interrupt, when a target runtime is `warming`,
  `in_flight`, or `stopping`.
- Keep existing WebSocket prompt behavior working.
- Add focused server tests.

Do not:

- Build the ticket/orchestrator system.
- Add status timers, AFK mode, FIFOs, warm pools, or idle-kill policy.
- Implement OpenCode.
- Add client UI.
- Add a WebSocket-only fake automation path.
- Write render queue chunks to SQLite.
- Split `LiveSegmentRenderer.tsx`.
- Bypass `canonical-chat-event-applier.js` with a parallel transcript writer.
- Touch Electron packaging files.

## Suggested Design

Keep this slice as a server module foundation, not a product feature.

### 1. Target Shape

Use an explicit target object:

```js
{
  workspaceId: 'workspace-id',
  projectRoot: '/abs/path/to/workspace',
  scope: 'project' | 'view',
  viewId: 'file-viewer', // required for scope === 'view'
  threadId: '2026-...'
}
```

Do not infer identity from the currently selected UI thread.

### 2. Runtime Status

Add a function with a shape like:

```js
getAutomationRuntimeStatus(target)
```

Return enough for future ticket code to decide whether to send or defer:

```js
{
  state: 'cold' | 'warming' | 'ready' | 'in_flight' | 'stopping',
  canSend: boolean,
  deferReason: null | 'warming' | 'in_flight' | 'stopping',
  hasLiveTurn: boolean,
  liveTurn: object | null
}
```

Use `threadRuntimeManager.getRuntimeState(...)` and
`threadRuntimeManager.getLiveTurn(...)`. Do not mutate runtime state from
status lookup.

### 3. Automation Send

Add a function with a shape like:

```js
async function sendAutomationPrompt(target, input, options = {}) { ... }
```

Expected result examples:

```js
{ accepted: true, deferred: false, threadId, scope }
{ accepted: false, deferred: true, reason: 'in_flight', threadId, scope }
{ accepted: false, deferred: false, error: 'Thread not found: ...', threadId, scope }
```

Behavior:

- `cold`: warm the runtime, then send.
- `ready`: send immediately.
- `warming`: return a deferred result; do not stack a prompt behind the warm.
- `in_flight`: return a deferred result; do not interrupt.
- `stopping`: return a deferred result; do not interrupt.

This slice should not implement a queue. The future ticket/orchestrator layer
can decide when to retry deferred sends.

### 4. Thread Manager Access

The automation path needs a `ThreadManager` without relying on `wsState`.

Acceptable options:

1. Extract the existing project/view manager registry from
   `ThreadWebSocketHandler.js` into a focused module such as:

```text
fusion-studio-server/lib/thread/thread-manager-registry.js
```

Then have both `ThreadWebSocketHandler.js` and `thread-runtime-automation.js`
use it.

2. Or export narrowly scoped manager accessors from `ThreadWebSocketHandler.js`
   if that is substantially smaller.

Prefer option 1 if the edit stays small and keeps "one job per file". The
registry's one job is: return stable `ThreadManager` instances for
`workspaceId/scope/viewId`.

### 5. Headless Runtime Session

Automation still needs the same session fields that
`canonical-chat-event-applier.js` expects:

```js
{
  currentWorkspaceId,
  currentThreadId,
  currentScope,
  currentViewId,
  pendingUserInput,
  currentTurn: null,
  assistantParts: [],
  hasToolCalls: false,
  activeToolId: null,
  toolArgs: {},
  contextUsage: null,
  tokenUsage: null,
  messageId: null,
  planMode: false
}
```

Do not use browser selection state for this. The headless session is scoped to
the automation send.

### 6. Wire Spawn

Automation can use `spawnThreadWire(threadId, projectRoot, scopeContext)` from
`fusion-studio-server/lib/harness/compat.js`, then:

- register the wire with `registerWire(threadId, wire, projectRoot, null, scopeContext)`
- await `wire._harnessPromise` if present
- require `_sendMessage` and `_usesDirectCanonicalEvents`
- do not send `wire_ready` because there may be no browser client

If a small shared helper is useful, add a focused module under `lib/thread/` or
`lib/wire/`. Do not keep automation dependent on `lib/ws/thread-ws-handlers.js`.

### 7. Persistence

Persist the user prompt directly through the resolved `ThreadManager`:

```js
await manager.addMessage(threadId, {
  role: 'user',
  content: input,
  hasToolCalls: false
});
await manager.index.touch(threadId);
```

Persist the assistant turn by injecting a `persistAssistantMessage` function
into `createCanonicalChatEventApplier(...)`:

```js
async function persistAssistantMessage(_ws, content, hasToolCalls, metadata, scope, explicitThreadId) {
  const message = { role: 'assistant', content, hasToolCalls };
  if (metadata && Object.keys(metadata).length > 0) {
    await manager.addMessageWithMetadata(explicitThreadId, message, metadata);
  } else {
    await manager.addMessage(explicitThreadId, message);
  }
}
```

Do not duplicate assistant persistence logic outside the applier. The
`chat:turn_end` event must still be emitted so audit subscribers and future
observers see the same canonical lifecycle as user prompts.

### 8. Event Delivery

For an unfocused automation runtime, it is okay if no WebSocket receives live
stream messages immediately. The important path is:

- canonical applier updates `threadRuntimeManager` live snapshot
- canonical applier emits `chat:*`
- audit/persistence subscribers see `chat:*`
- when the user later browses the thread, `thread:opened` includes the live or
  completed state from the existing Runtime-3 overlay path

Do not create a hidden browser/WebSocket dependency just to receive events.

## Required Tests

Add focused server tests, likely:

```text
fusion-studio-server/test/thread/thread-runtime-automation.test.js
```

Cover at least:

1. Status lookup returns `cold` and `canSend: true` for a known cold runtime.
2. Status lookup returns deferred reasons for `warming`, `in_flight`, and
   `stopping`.
3. Automation send to an `in_flight` runtime returns a deferred result and does
   not call `_sendMessage`.
4. Automation send to a cold runtime warms once, persists the user message,
   drains canonical events, and emits/applies `turn_end`.
5. Automation send does not require `ws.send` or `ThreadWebSocketHandler.getState`.
6. Automation send updates the live snapshot during streaming and leaves a
   terminal snapshot at completion.
7. Existing WebSocket prompt controller tests still pass.

Mock the harness/wire seam if needed. Do not require a live Kimi CLI for unit
tests.

## Acceptance Checks

Run from repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev

npm test -- --runInBand test/thread/thread-runtime-automation.test.js test/thread/thread-runtime-controller.test.js
npm test -- --runInBand

grep -R "thread-runtime-automation\\|sendAutomationPrompt\\|getAutomationRuntimeStatus" -n fusion-studio-server/lib fusion-studio-server/test
grep -R "ThreadWebSocketHandler.getState" -n fusion-studio-server/lib/thread/thread-runtime-automation.js fusion-studio-server/test/thread/thread-runtime-automation.test.js
grep -R "ws.send" -n fusion-studio-server/lib/thread/thread-runtime-automation.js
grep -R "FUSION_APP_USER_DATA" -n fusion-studio-client/electron/main.cjs fusion-studio-client/electron/server-spawn.cjs
git diff --check -- fusion-studio-server/lib/thread fusion-studio-server/lib/wire fusion-studio-server/test/thread
```

Expected:

- automation module exists and is exported
- automation module does not call `ThreadWebSocketHandler.getState`
- automation module does not call `ws.send`
- automation send returns deferred results for busy runtimes
- automation send uses canonical event application, not a parallel transcript
  writer
- packaging guard remains present and conditional
- touched-file whitespace check is clean

If `rg` is available, use `rg` instead of `grep`. If `rg` is unavailable, note
that in the report and use `grep`.

## Manual Smoke

No interactive browser smoke is required for this slice because it is a
server-side automation foundation.

Do run the restart script if server code changed:

```bash
/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh
```

Report the server URL if restart succeeds.

Optional manual/dev smoke if a small script is added temporarily during local
testing: call `sendAutomationPrompt(...)` against a known existing thread while
the UI is focused elsewhere, then browse back to that thread and verify the
turn is visible. Do not commit temporary smoke scripts.

## Result Report Requirements

Return:

- files changed
- whether a manager registry was extracted or accessors were exported
- exact automation API shape
- tests run and results
- whether full server tests passed
- restart URL if restart was run
- any deferred behavior decisions
- confirmation that no client UI or Electron packaging files were touched
