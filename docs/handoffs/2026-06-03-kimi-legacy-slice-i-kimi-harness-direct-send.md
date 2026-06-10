# Handoff: Kimi Legacy Removal Slice I - Kimi Harness Direct Send

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-02-kimi-legacy-slice-h-direct-canonical-harness-bridge.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A through H are complete or accepted. Slice H added a direct canonical harness bridge:

```text
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js
fusion-studio-server/test/ws/client-message-router.test.js
```

The bridge is available when a process-like wire has:

```js
wire._usesDirectCanonicalEvents === true
```

`compat.js` sets that flag for harness sessions that do not expose `compatibleStdout`.

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

Confirm:

```bash
git rev-parse --show-toplevel
git status --short
git log -1 --oneline
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The tree may contain accepted but uncommitted Slice F/G/H files plus runtime/user state files. Inspect before editing and do not overwrite unrelated user work.

Known runtime/user state files that may be dirty and must be left alone:

```text
System Source Files/ai/system/state/state.json
ai/system/state/state.json
ai/views/wiki-viewer/settings/state.json
fusion-studio-server/data/workspace-cache.json
```

Known unrelated user work may include:

```text
fusion-studio-client/src/mic/useAudioCapture.ts
fusion-studio-server/lib/transcription/index.js
```

## Current Problem

`fusion-studio-server/lib/harness/kimi/index.js` still has:

```js
async *sendMessage(message, options) {
  throw new Error('sendMessage not yet implemented - use legacy flow');
}
```

That means `HARNESS_MODE=new` cannot prove an end-to-end Kimi turn through the direct canonical bridge.

There is also a duplication risk: `KimiHarness` currently calls `bridgeToEventBus()` from inside its parser handler. Once `sendMessage()` yields canonical events and `client-message-router.js` applies them through `canonical-chat-event-applier.js`, that old `bridgeToEventBus()` path would emit duplicate `chat:turn_end` / audit events.

## Goal

Make KimiHarness usable through the direct canonical event path, behind non-default harness mode only.

Target runtime shape for this slice:

```text
HARNESS_MODE=new
  -> compat.js starts KimiHarness
  -> no compatibleStdout
  -> _usesDirectCanonicalEvents = true
  -> client-message-router drains KimiHarness.sendMessage()
  -> canonical-harness-event-bridge
  -> canonical-chat-event-applier
  -> chat:* event bus
  -> wire-broadcaster
  -> frontend
```

Default runtime must remain:

```text
HARNESS_MODE unset or legacy
  -> spawnThreadWireLegacy()
  -> raw Kimi wire stdout
  -> message-router.js raw Kimi adapter
  -> canonical-chat-event-applier
```

## Critical Constraints

Do not flip the default mode.

Do not remove:

```text
HARNESS_MODE
spawnThreadWireLegacy()
compatibleStdout for other harnesses
serializeToKimiWire()
wire/message-router.js raw Kimi event handling
```

Do not touch frontend files.

Do not add frontend aliases to compensate for backend tool names. Slice H already added a temporary server-side websocket tool-name adapter for direct canonical events.

Do not emit `chat:*` directly from `KimiHarness` after this slice. Direct event-bus emission belongs to the shared applier path now.

## Files In Scope

Primary scope:

```text
fusion-studio-server/lib/harness/kimi/index.js
```

Preferred tests:

```text
fusion-studio-server/lib/harness/kimi/__tests__/harness-send-message.test.js
```

Support scope if needed:

```text
fusion-studio-server/lib/harness/kimi/event-translator.js
fusion-studio-server/lib/harness/kimi/session-state.js
fusion-studio-server/lib/harness/types.js
```

Read-only/reference scope:

```text
fusion-studio-server/lib/harness/compat.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/message-router.js
fusion-studio-server/lib/wire/process-manager.js
```

## Task

Implement `KimiHarness` direct prompt sending and event yielding.

Expected implementation:

1. Implement `session.sendMessage(message, options = {})` in `fusion-studio-server/lib/harness/kimi/index.js`.

   It should:

   - register listeners before writing the prompt
   - send a Kimi wire `initialize` request once per session if not already initialized
   - send a Kimi wire `prompt` request with `{ user_input: message }`
   - include `options.system` in the prompt params if provided
   - yield canonical events emitted by the Kimi parser/translator for the same `threadId`
   - stop yielding after the matching `turn_end`
   - remove listeners in `finally`
   - throw a structured error if Kimi returns a JSON-RPC error for initialize or prompt

2. Add lightweight request/error tracking inside KimiHarness.

   The current parser handler ignores non-event JSON-RPC messages. For direct send, Kimi response errors must reach `sendMessage()` so `client-message-router.js` can surface `auth_error`.

   Acceptable shape:

   ```js
   parser.on('message', (msg) => {
     if (msg.method === 'event') {
       // existing translation path
       return;
     }
     if (msg.id !== undefined && msg.error) {
       this.emit('response_error', { threadId, id: msg.id, error: msg.error });
       return;
     }
     if (msg.id !== undefined && msg.result !== undefined) {
       this.emit('response_result', { threadId, id: msg.id, result: msg.result });
     }
   });
   ```

   If `error.code === -32004` or the message contains `Authentication failed`, preserve that code/message on the thrown error.

3. Remove KimiHarness direct event-bus bridging.

   Delete or stop using:

   ```text
   bridgeToEventBus()
   require('../../event-bus')
   normalizeTokenUsage import used only for bridgeToEventBus()
   ```

   Reason: the direct canonical bridge plus canonical applier now owns `chat:*` emission. Keeping `bridgeToEventBus()` would duplicate `chat:turn_end` and persistence/audit side effects in `HARNESS_MODE=new`.

4. Preserve canonical translator behavior.

   Kimi tool names should still be canonical inside harness events:

   ```text
   Bash -> shell
   ReadFile -> read
   WriteFile -> write
   EditFile -> edit
   Glob -> glob
   Grep -> grep
   TodoWrite -> todo
   ```

   Do not map them back to PascalCase inside KimiHarness. Slice H's websocket adapter handles the temporary frontend compatibility boundary.

5. Keep `compatibleStdout` absent for KimiHarness.

   Do not add fake Kimi-compatible stdout to KimiHarness in this slice. That would preserve the old route instead of proving the direct route.

## Suggested Send Loop

A simple implementation is acceptable. Keep it easy to reason about.

Suggested behavior:

```js
async *sendMessage(message, options = {}) {
  const events = [];
  let done = false;
  let failure = null;

  const onEvent = ({ threadId: tid, event }) => {
    if (tid !== threadId) return;
    events.push(event);
    if (event.type === 'turn_end') done = true;
  };

  const onError = ({ threadId: tid, id, error }) => {
    if (tid !== threadId) return;
    failure = makeWireError(error);
    done = true;
  };

  this.on('event', onEvent);
  this.on('response_error', onError);

  try {
    sendInitializeIfNeeded();
    sendPrompt(message, options);

    while (!done || events.length > 0) {
      while (events.length > 0) yield events.shift();
      if (failure) throw failure;
      if (!done) await delay(25);
    }
  } finally {
    this.off('event', onEvent);
    this.off('response_error', onError);
  }
}
```

This can be refined, but do not add a broad orchestration framework for one harness.

## Required Tests

Add focused KimiHarness tests with mocked `child_process.spawn`.

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand lib/harness/kimi/__tests__/harness-send-message.test.js lib/harness/kimi/__tests__/event-translator.test.js test/wire/canonical-harness-event-bridge.test.js test/ws/client-message-router.test.js
```

Minimum coverage:

- `sendMessage()` writes an `initialize` JSON-RPC request once.
- `sendMessage()` writes a `prompt` JSON-RPC request with `params.user_input`.
- `sendMessage()` includes `params.system` when provided.
- feeding Kimi wire `TurnBegin`, `ContentPart`, and `TurnEnd` stdout lines causes yielded canonical `turn_begin`, `content`, and `turn_end` events in order.
- feeding a Kimi wire prompt error causes `sendMessage()` to throw an error preserving `code` and `message`.
- auth error `-32004` or `Authentication failed` remains detectable by `client-message-router.js`.
- `KimiHarness` no longer emits `chat:turn_end` directly through `event-bus`.
- listeners are removed after success and after error.

Then run the full server suite because this changes harness runtime:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Also run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

## Acceptance Checks

Run from repo root:

```bash
rg -n "sendMessage not yet implemented|bridgeToEventBus|normalizeTokenUsage|../../event-bus" fusion-studio-server/lib/harness/kimi/index.js
```

Expected: no hits.

```bash
rg -n "compatibleStdout" fusion-studio-server/lib/harness/kimi
```

Expected: no hits.

```bash
rg -n "_usesDirectCanonicalEvents|handleCanonicalHarnessEvent|canonical-harness-event-bridge" fusion-studio-server/lib fusion-studio-server/test
```

Expected: Slice H direct bridge path still present.

```bash
rg -n "spawnThreadWireLegacy|HARNESS_MODE|serializeToKimiWire|compatibleStdout" fusion-studio-server/lib/harness fusion-studio-server/lib/wire fusion-studio-server/lib/ws
```

Expected: still present outside KimiHarness. This slice must not delete the fallback stack.

```bash
git diff --check
```

Expected: clean.

## Manual Smoke

Manual smoke should be non-default.

1. Restart normal/default mode and confirm legacy Kimi still works:

   ```bash
   cd /Users/rccurtrightjr./projects/fs-dev
   ./restart-fusion.sh
   ```

2. If local environment allows, run a non-default new-harness smoke with Kimi:

   - Start Fusion with `HARNESS_MODE=new`.
   - Open or create one chat thread.
   - Send a plain text prompt.
   - Confirm one assistant turn appears.
   - Confirm no duplicate `turn_end`, duplicate persisted assistant message, duplicate tool block, or stuck pending user request.
   - Try a small tool prompt if Kimi auth is valid.

If `kimi` is not logged in, report the auth failure and confirm it appears as `auth_error` rather than a stuck pending request.

Do not leave the app running in `HARNESS_MODE=new` unless explicitly asked.

## Out Of Scope

- Do not switch default runtime to `new`.
- Do not remove legacy Kimi process spawning.
- Do not delete `message-router.js`.
- Do not remove `compatibleStdout` from other harnesses.
- Do not remove frontend Kimi aliases.
- Do not touch tool visual polish, write-file filename enrichment, hourglass behavior, or warm-session expiration queue work.

## Final Report Requirements

Include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- Commit SHA if committed.
- Focused test results.
- Full server test result.
- `git diff --check` result.
- Manual smoke result for default legacy mode.
- Manual smoke result for `HARNESS_MODE=new`, or the exact blocker.
- Any code standards exception, with the reason.
- Whether KimiHarness direct mode emitted through the applier only, with no direct `chat:*` event-bus bridge left.
