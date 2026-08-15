# Runtime-6: Warm Intent Triggers

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Objective

Warm cold chat runtimes from explicit send intent signals before the user clicks
Send, while keeping passive thread browsing browse-only.

Expected behavior:

```text
thread click/open       -> hydrate history only, do not warm
chat input focus        -> warm selected runtime if cold
composer insert/paste   -> warm selected runtime if cold
send click              -> fallback warm if still cold, then accept prompt
in_flight/stopping      -> never interrupt, never cool, never double-spawn
```

No user bubble or orb should appear from warming alone. Those still begin only
after prompt acceptance.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-2-prompt-acceptance-warm-send.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-2r-acceptance-ui-repair.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-runtime-2s-target-aware-sending-state.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-04-thread-runtime-runtime-5-automation-hooks.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

## Critical Coordination Notes

The repo is dirty with accepted runtime slices plus unrelated packaging, ribbon,
Slack, state, and release work. Inspect before editing. Do not revert unrelated
files.

Do not touch Electron packaging files in this slice:

```text
fusion-studio-client/electron/main.cjs
fusion-studio-client/electron/server-spawn.cjs
fusion-studio-client/package.json
fusion-studio-client/package-lock.json
fusion-studio-server/package.json
fusion-studio-server/package-lock.json
```

Recent restart note: the coordinator saw
`kLSNoExecutableErr: The executable is missing` after the restart script built
the client. That appears tied to separate packaging/release changes, not thread
runtime code. Do not repair packaging here.

## Current State

Relevant server seams:

```text
fusion-studio-server/lib/thread/thread-runtime-controller.js
fusion-studio-server/lib/thread/thread-runtime-manager.js
fusion-studio-server/lib/thread/thread-runtime-automation.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/ws/thread-ws-handlers.js
```

`acceptPromptThroughRuntime(...)` already warms cold runtimes as a send fallback
through `ensureReadyRuntime(...)`.

There is no dedicated `thread:warm` route yet.

Relevant client seams:

```text
fusion-studio-client/src/components/chat/useChatArea.ts
fusion-studio-client/src/components/ChatInput.tsx
fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
fusion-studio-client/src/state/slices/chatSlice.ts
fusion-studio-client/src/lib/ws/thread-handlers.ts
```

`sendMessage(...)` sends:

```ts
{ type: 'prompt', scope, threadId, user_input: text }
```

Prompt acceptance currently drives the user bubble and connecting wheel through
`message:sent` / `fusion:prompt-accepted`. Preserve that behavior.

Composer helper insertion currently flows through:

```text
useChatArea.handleInsertText(...)
  -> chatInputRef.current?.insertText(text)
```

The helper sources include clipboard, screenshots, recent files, emojis, and
mic transcription.

## Scope

Do:

- Add a server-side warm route, preferably `thread:warm`.
- Route warm through `thread-runtime-controller`, reusing the same warm logic
  as prompt fallback.
- Add client warm-intent calls for:
  - chat input focus
  - paste into the chat input
  - composer/helper insertion through `handleInsertText`
  - send fallback remains unchanged
- Ensure duplicate focus/paste/insert events share the existing warm promise
  and do not spawn multiple wires.
- Ensure warm does not commit a user bubble, start an orb, or clear composer
  text.
- Ensure warm does not interrupt `in_flight` or `stopping` runtimes.
- Add focused server tests and at least build/lint client validation.

Do not:

- Warm on passive `thread:open`.
- Add warm pool/FIFO/timers.
- Add visible warm-retention countdowns.
- Implement OpenCode.
- Build ticket/orchestrator behavior.
- Change stop/interrupt behavior.
- Change live snapshot overlay behavior.
- Add a new frontend state machine if a narrow event helper is enough.
- Touch Electron packaging files.

## Suggested Server Design

Add a controller function such as:

```js
async function warmRuntimeForIntent({
  ws,
  session,
  clientMsg,
  wireLifecycle,
  projectRoot,
  spawnAndSetupWire,
}) { ... }
```

Target identity should come from explicit message fields:

```js
{
  type: 'thread:warm',
  scope: 'project' | 'view',
  threadId: string
}
```

Use `ThreadWebSocketHandler.getState(ws)` only to resolve the scope manager for
the current connection, matching `acceptPromptThroughRuntime(...)`.

Required behavior:

- Missing thread/manager: send a recoverable or non-recoverable error matching
  existing runtime conventions.
- Thread not found: visible non-recoverable error.
- `cold`: call the existing `ensureReadyRuntime(...)` path.
- `ready` with registered wire: no-op success.
- `ready` without wire: mark cold and warm.
- `warming`: await/share the existing warm promise.
- `in_flight` or `stopping`: no-op/defer; do not send an error that would scare
  the user during normal focus or paste.

The warm route may optionally send:

```js
{ type: 'thread:warmed', scope, threadId }
```

or rely on existing `wire_ready`. Prefer not to introduce client state unless it
is needed for validation/debugging.

Important: `spawnAndSetupWire(...)` currently sends `wire_ready`. That is fine,
but the client must not treat `wire_ready` as prompt acceptance or show a user
bubble/orb.

## Suggested Client Design

Add a small helper near `sendMessage(...)` or in `useChatArea.ts`:

```ts
warmThread(scope, threadId)
```

It should send:

```ts
{ type: 'thread:warm', scope, threadId }
```

only when:

- there is a current thread
- socket is open
- chat is active for that scope
- there is no pending prompt acceptance for the same component

Use this helper from:

1. `ChatInput` focus.
2. `ChatInput` paste.
3. `useChatArea.handleInsertText(...)` before/while inserting text.
4. Optionally immediately before `sendMessage(...)` only if that keeps the
   call path simple. The existing prompt path must remain the real fallback.

Avoid repeated spam:

- A simple per `{scope, threadId}` in-memory last-warm target ref is enough.
- Do not add timers or a global warm cache in this slice.
- Repeated focus on the same ready/warming thread should be harmless server-side
  because the runtime manager owns state.

Do not disable the input during warm intent. The user should be able to type
while warming. The send button only uses the existing connecting wheel when a
prompt is actually pending acceptance.

## Tests To Add / Update

Server tests required, likely in:

```text
fusion-studio-server/test/thread/thread-runtime-controller.test.js
fusion-studio-server/test/ws/client-message-router.test.js
```

Cover:

1. `thread:warm` on a cold runtime spawns once and marks runtime ready.
2. `thread:warm` while warming shares/awaits the warm promise and does not spawn
   twice.
3. `thread:warm` while ready with a registered wire does not spawn.
4. `thread:warm` while `in_flight` or `stopping` does not stop, send, or spawn.
5. `thread:warm` does not call `ThreadWebSocketHandler.handleMessageSend`.
6. Router dispatches `thread:warm` to the runtime controller.
7. Existing prompt acceptance tests still pass.

Client tests are optional if there is no existing frontend test harness. At
minimum, run build and scoped ESLint. If adding tests is natural, test that
focus/paste/helper insertion sends `thread:warm` and does not call prompt.

## Acceptance Checks

Run from repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev

grep -R "thread:warm\\|warmRuntimeForIntent\\|warmThread" -n \
  fusion-studio-server/lib fusion-studio-server/test \
  fusion-studio-client/src/components fusion-studio-client/src/state fusion-studio-client/src/lib

grep -R "thread:open.*warm\\|open.*thread:warm" -n \
  fusion-studio-client/src/lib/ws fusion-studio-client/src/components fusion-studio-server/lib

git diff --check -- \
  fusion-studio-server/lib/thread \
  fusion-studio-server/lib/ws \
  fusion-studio-server/test/thread \
  fusion-studio-server/test/ws \
  fusion-studio-client/src/components \
  fusion-studio-client/src/state \
  fusion-studio-client/src/lib
```

Expected:

- `thread:warm` exists.
- Passive `thread:open` handlers do not send or call warm.
- Warm route does not persist user messages.
- Warm route does not drain `_sendMessage(...)`.
- Send fallback still routes through `prompt`.
- Packaging files are untouched.

Then run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/thread/thread-runtime-controller.test.js test/ws/client-message-router.test.js
npm test -- --runInBand

cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint \
  src/components/chat/useChatArea.ts \
  src/components/ChatInput.tsx \
  src/components/chat/ChatAreaFooter.tsx \
  src/state/slices/chatSlice.ts \
  src/lib/ws/thread-handlers.ts
```

If `rg` is available, use it instead of `grep`. If it is unavailable, note that
and use `grep`.

## Manual Smoke

Use a running Fusion instance if available.

Smoke:

1. Click between threads without focusing input. Confirm no runtime warm/spawn
   logs for passive browsing.
2. Focus the input on a cold thread. Confirm a warm/spawn happens.
3. Type while warming. Confirm no user bubble and no orb appear.
4. Send after focus warm completes. Confirm prompt acceptance feels immediate.
5. Paste or use a composer helper on a cold thread. Confirm warm happens before
   send, without creating a message.
6. Start a long turn, then focus/paste on that same thread. Confirm no
   interruption and no second prompt.
7. Switch away from an in-flight thread and focus another cold thread. Confirm
   the first thread keeps streaming and the second can warm independently if the
   runtime model supports it.

Run restart if server/client code changed:

```bash
/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh
```

If restart fails with the known Electron executable packaging error, report it
separately and do not fix packaging in this slice.

## Result Report Requirements

Return:

- files changed
- exact warm message name and payload
- whether warm success emits a new event or reuses `wire_ready`
- server tests run and results
- client build/lint results
- restart result and URL if available
- whether manual smoke was run
- confirmation that passive thread open remains browse-only
- confirmation that no client UI, Electron packaging, FIFO/timer, OpenCode, or
  ticket/orchestrator work was included
