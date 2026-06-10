# Handoff: Kimi Legacy Removal Slice H - Direct Canonical Harness Bridge

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-01-kimi-legacy-slice-f-canonical-harness-contract-results.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-01-kimi-legacy-slice-g-extract-canonical-chat-event-applier.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A through G are complete or accepted. Slice G extracted:

```text
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
```

The current runtime still routes new harness sessions through Kimi-compatible stdout when available:

```text
HarnessSession.sendMessage()
  -> yields canonical events
  -> compatibleStdout also writes Kimi-shaped JSON
  -> process-manager setupWireHandlers()
  -> message-router.js raw Kimi switch
  -> canonical-chat-event-applier.js
```

That means canonical events exist, but the live WebSocket path still depends on the compatibility stream and raw Kimi-style event parsing.

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

The tree may contain accepted but uncommitted Slice F/G files plus runtime/user state files. Inspect before editing and do not overwrite unrelated user work.

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

`client-message-router.js` drains `wire._sendMessage()` and intentionally ignores yielded events:

```js
for await (const _ of wire._sendMessage(clientMsg.user_input, {})) {
  // Events flow via compatibleStdout -> setupWireHandlers; just drain the iterator
}
```

This preserves behavior, but it keeps new harnesses dependent on `compatibleStdout` and the Kimi-shaped parser in `wire/message-router.js`.

The next step is to add a direct bridge for canonical harness events so a harness session can feed `canonical-chat-event-applier.js` without first serializing events back into fake Kimi wire messages.

## Critical Constraints

Do not flip the default runtime path in this slice.

Do not remove:

```text
compatibleStdout
serializeToKimiWire()
wire/message-router.js raw Kimi event handling
HARNESS_MODE
spawnThreadWireLegacy()
```

Do not change the frontend websocket contract in this slice.

Important: the current frontend still maps tool names in:

```text
fusion-studio-client/src/lib/instructions.ts
```

It does not safely consume canonical lowercase tool names such as `shell`, `read`, `write`, `edit`, `web_search`, or `todo`. Unknown names currently fall back to `read`, which would silently corrupt tool rendering.

Therefore:

- The direct bridge may consume canonical harness events.
- If the bridge is exercised at runtime, it must preserve the current websocket-facing `toolName` behavior through an explicit server-side adapter or stay disabled for tool events until the frontend canonical-name slice.
- Do not add frontend aliases to hide this. If a temporary server adapter is needed, name it as a websocket compatibility adapter and test it.

Also avoid duplicate event delivery. A harness with `compatibleStdout` can already feed the old path. If the direct bridge is enabled for that same session without disabling compatible stdout consumption, turns will duplicate.

## Files In Scope

Primary scope:

```text
fusion-studio-server/lib/wire/message-router.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/wire/process-manager.js
fusion-studio-server/lib/harness/compat.js
```

Preferred new file:

```text
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
```

Preferred tests:

```text
fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js
```

Support scope if needed:

```text
fusion-studio-server/server.js
fusion-studio-server/lib/harness/types.js
```

Read-only/reference scope:

```text
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/wire-broadcaster.js
fusion-studio-server/lib/harness/clis/codex/index.js
fusion-studio-server/lib/harness/clis/qwen/index.js
fusion-studio-server/lib/harness/clis/claude-code/index.js
fusion-studio-server/lib/harness/clis/gemini/index.js
fusion-studio-server/lib/harness/kimi/index.js
fusion-studio-client/src/lib/instructions.ts
```

Do not touch frontend files in this slice unless you find a server-side contract cannot be expressed without a surgical client adapter. If that happens, stop and report the finding instead of widening the slice.

## Task

Add a direct canonical harness event bridge under test, without deleting the existing compatibility path.

Expected implementation shape:

1. Add a canonical-harness event bridge module.

   Suggested API:

   ```js
   function createCanonicalHarnessEventBridge({
     applyChatEvent,
     onNonChatEvent,
     adaptToolNameForWebsocket,
   }) {
     return { applyHarnessEvent, drainHarnessEvents };
   }
   ```

   Reasonable variations are acceptable if the boundaries stay clean.

2. The bridge should convert flat `CanonicalEvent` objects from `harness/types.js` into the `{ type, payload }` shape consumed by `canonical-chat-event-applier.js`.

   Example mappings:

   ```js
   { type: 'turn_begin', userInput }
     -> { type: 'turn_begin', payload: { userInput } }

   { type: 'content', text }
     -> { type: 'content', payload: { text } }

   { type: 'thinking', text }
     -> { type: 'thinking', payload: { text } }

   { type: 'tool_call', toolCallId, toolName }
     -> { type: 'tool_call', payload: { toolCallId, toolName } }

   { type: 'tool_call_args', toolCallId, argsChunk }
     -> { type: 'tool_call_args', payload: { toolCallId, argsChunk } }

   { type: 'tool_result', toolCallId, toolName, output, statusMessage, display, returnedDiff, isError, files }
     -> { type: 'tool_result', payload: { toolCallId, toolName, result: { output, statusMessage, display, returnedDiff, isError, files } } }

   { type: 'subagent_event', parentToolCallId, agentId, subagentType, subagentEventType, subagentPayload }
     -> { type: 'subagent_event', payload: { parentToolCallId, agentId, subagentType, subagentEventType, subagentPayload } }

   { type: 'status_update', contextUsage, tokenUsage, messageId, planMode }
     -> { type: 'status_update', payload: { contextUsage, tokenUsage, messageId, planMode } }

   { type: 'turn_end' }
     -> { type: 'turn_end', payload: {} }
   ```

3. Expose the applier from the per-connection router without duplicating applier creation.

   `server.js` currently creates:

   ```js
   const { handleMessage } = createWireMessageRouter(...)
   ```

   Prefer extending this to also expose something like:

   ```js
   const { handleMessage, handleCanonicalHarnessEvent } = createWireMessageRouter(...)
   ```

   Then pass that handler into `createClientMessageRouter(...)`.

4. Update `client-message-router.js` so it can optionally apply canonical events yielded by `wire._sendMessage()`.

   The existing behavior should remain the default for compatibility sessions:

   - If the wire is still using `compatibleStdout`, drain the iterator and do not also apply the yielded events.
   - If the wire is explicitly marked for direct canonical event delivery, apply yielded events through the new bridge.

   A clear flag on the process-like object is acceptable, for example:

   ```js
   wire._usesDirectCanonicalEvents === true
   ```

5. Update `compat.js` cautiously.

   Current behavior:

   ```js
   const stdout = session.compatibleStdout || realProc.stdout;
   dummyProc.stdout = stdout;
   dummyProc._sendMessage = (message, options) => session.sendMessage(message, options);
   ```

   Do not make `realProc.stdout` get parsed as Kimi wire JSON for harnesses that do not expose `compatibleStdout`.

   Preferred behavior:

   - If `session.compatibleStdout` exists, keep using it and leave direct canonical delivery disabled.
   - If `session.compatibleStdout` does not exist but `session.sendMessage` yields canonical events, set a direct-delivery marker and give `setupWireHandlers()` an inert stdout stream rather than raw vendor stdout.

   This slice should not force KimiHarness new mode to work if its `sendMessage()` is still unimplemented. It should make the bridge available and safe for harness sessions that already yield canonical events.

6. Handle harness send errors visibly.

   If direct draining throws, preserve or improve the existing error behavior. The UI must not stay stuck on a pending user request. If an auth-style error is surfaced, preserve the `auth_error` path added after Slice G.

## Acceptance Checks

Run from repo root unless noted:

```bash
rg -n "Events flow via compatibleStdout" fusion-studio-server/lib/ws/client-message-router.js
```

Expected: no hit, or replaced with a comment that accurately describes the direct-vs-compatible split.

```bash
rg -n "TurnBegin|ContentPart|ToolCallPart|ToolResult|SubagentEvent|StatusUpdate" fusion-studio-server/lib/wire/canonical-harness-event-bridge.js fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js
```

Expected: no hits. The bridge consumes canonical event names, not raw Kimi wire names.

```bash
rg -n "compatibleStdout|serializeToKimiWire" fusion-studio-server/lib/harness
```

Expected: still present. This slice must not delete the compatibility path.

```bash
rg -n "_usesDirectCanonicalEvents|handleCanonicalHarnessEvent|canonical-harness-event-bridge" fusion-studio-server/lib fusion-studio-server/test
```

Expected: hits in the bridge path and tests.

```bash
git diff --check
```

Expected: clean.

## Required Tests

Add focused tests for the new bridge:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/wire/canonical-harness-event-bridge.test.js
```

Minimum test coverage:

- maps `turn_begin`, `content`, `thinking`, `tool_call`, `tool_call_args`, `tool_result`, `status_update`, `subagent_event`, and `turn_end`
- does not switch on raw Kimi event names
- direct bridge applies yielded events in order
- compatible-stdout sessions do not double-apply yielded events
- direct send error produces a visible websocket error or auth error and clears/avoids stuck pending state where possible

Also run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/wire/canonical-chat-event-applier.test.js lib/harness/kimi/__tests__/event-translator.test.js
```

If the changes touch `server.js`, `process-manager.js`, `client-message-router.js`, or `compat.js`, run the full server suite:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

## Manual Smoke

After tests pass, restart Fusion:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
./restart-fusion.sh
```

Smoke the default Kimi legacy path:

1. Send a plain text prompt.
2. Send a prompt that triggers a read or shell tool.
3. Confirm no duplicate assistant turn, duplicate tool block, or stuck pending user request.
4. Confirm auth failures still show the auth error and clear an empty pending turn.

If you can safely run a non-default new-harness path with a harness that yields canonical events and does not use `compatibleStdout`, smoke one prompt there too. Do not treat that as required if the local harness login/setup is unavailable.

## Out Of Scope

- Do not delete `wire/message-router.js`.
- Do not remove Kimi raw event parsing yet.
- Do not remove `compatibleStdout` or `serializeToKimiWire()`.
- Do not switch the app default away from legacy Kimi.
- Do not remove frontend Kimi aliases.
- Do not add frontend canonical-name aliases.
- Do not implement visual tool polish, write-file filename enrichment, hourglass behavior, or warm-session expiration queue work.

## Final Report Requirements

Include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- Commit SHA if committed.
- Focused test results.
- Full server test result if run, or why it was not needed.
- `git diff --check` result.
- Manual smoke result.
- Any code standards exception, with the reason.
- Whether the default Kimi path still uses compatibility routing and whether any direct canonical path was enabled.
