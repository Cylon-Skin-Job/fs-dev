# Handoff Results: Kimi Legacy Removal Slice O - Strict Live Stream Routing

## Repo Root Confirmation

```text
/Users/rccurtrightjr./projects/fs-dev
```

Latest commit before edits:

```text
ccf2979 refactor: simplify reveal timing defaults
```

## Git Status Before Edits

```text
 M "System Source Files/ai/system/state/state.json"
 M ai/system/state/state.json
 M ai/views/wiki-viewer/settings/state.json
 M fusion-studio-client/src/lib/instructions.ts
 M fusion-studio-client/src/lib/ws/stream-handlers.ts
 M fusion-studio-client/src/mic/useAudioCapture.ts
 M fusion-studio-server/data/workspace-cache.json
 M fusion-studio-server/lib/harness/compat.js
 M fusion-studio-server/lib/harness/feature-flags.js
 M fusion-studio-server/lib/harness/index.js
 M fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js
 M fusion-studio-server/lib/harness/kimi/event-translator.js
 M fusion-studio-server/lib/harness/kimi/index.js
 M fusion-studio-server/lib/harness/types.js
 M fusion-studio-server/lib/thread/thread-crud.js
 M fusion-studio-server/lib/transcription/index.js
 M fusion-studio-server/lib/wire/message-router.js
 M fusion-studio-server/lib/ws/client-message-router.js
 M fusion-studio-server/lib/ws/harness-ws-handlers.js
 M fusion-studio-server/server.js
 M fusion-studio-server/test/harness/compat.test.js
?? docs/handoffs/2026-06-01-kimi-legacy-slice-f-canonical-harness-contract-results.md
?? docs/handoffs/2026-06-01-kimi-legacy-slice-f-canonical-harness-contract.md
?? docs/handoffs/2026-06-01-kimi-legacy-slice-g-extract-canonical-chat-event-applier.md
?? docs/handoffs/2026-06-02-kimi-legacy-slice-h-direct-canonical-harness-bridge.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-i-kimi-harness-direct-send.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-j-subagent-event-translator.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-k-direct-mode-smoke-results.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-k-direct-mode-smoke.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-l-default-harness-path-results.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-l-default-harness-path.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-m-retire-legacy-wire-runtime-results.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-m-retire-legacy-wire-runtime.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-n-frontend-canonical-tool-names-results.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-n-frontend-canonical-tool-names.md
?? docs/handoffs/2026-06-03-kimi-legacy-slice-o-strict-live-stream-routing.md
?? fusion-studio-server/lib/harness/kimi/__tests__/harness-send-message.test.js
?? fusion-studio-server/lib/wire/canonical-chat-event-applier.js
?? fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
?? fusion-studio-server/scripts/transcribe-file.js
?? fusion-studio-server/test/wire/
?? fusion-studio-server/test/ws/client-message-router.test.js
```

## Files Changed

1. `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`
   - Added `getScope()` using `session.currentScope || 'view'`.
   - Added `scope: getScope()` to emitted `chat:*` payloads.

2. `fusion-studio-server/lib/wire/wire-broadcaster.js`
   - Added `scope: event.scope` to outbound live stream websocket messages.
   - Updated the routing comment to say outbound live stream messages carry both `scope` and `threadId`.

3. `fusion-studio-server/lib/ws/client-message-router.js`
   - Added `scope` to prompt-branch direct error payloads for missing `_sendMessage` and missing direct canonical delivery.
   - Added `scope` and `threadId` to auth-style `_sendMessage` failures.

4. `fusion-studio-server/lib/wire/message-router.js`
   - Review repair: added `scope` and `threadId` to the remaining auth-style JSON-RPC error payload.
   - This keeps `auth_error` compatible with strict client-side stream routing if that non-chat error path is reached.

5. `fusion-studio-server/test/wire/canonical-chat-event-applier.test.js`
   - Added assertions that emitted chat bus payloads include `scope: 'view'`.

6. `fusion-studio-server/test/ws/client-message-router.test.js`
   - Added route metadata assertions for prompt direct errors and auth-style failures.

7. `fusion-studio-client/src/lib/ws/stream-handlers.ts`
   - Removed `resolveScope()` and the selected-UI fallback path.
   - Added `ROUTED_STREAM_TYPES` and `getStreamRoute()`.
   - Routed live chat mutations only with explicit `{ scope, threadId }`.
   - Changed routed live helper signatures so live mutations no longer pass nullable `threadId` from this file.
   - Added a warning/drop diagnostic for routed stream messages missing route metadata.

8. `docs/handoffs/2026-06-03-kimi-legacy-slice-o-strict-live-stream-routing-results.md`
   - This report.

## Validation Commands and Results

### Frontend Build

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Result: PASS. `tsc -b` and `vite build` completed. Existing Vite warnings remained: `gray-matter` eval warning and large chunk warning.

### Frontend ESLint

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npx eslint src/lib/ws/stream-handlers.ts src/types/index.ts
```

Result: PASS. No output.

### Server Focused Tests

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/wire/canonical-chat-event-applier.test.js test/ws/client-message-router.test.js test/wire/canonical-harness-event-bridge.test.js lib/harness/kimi/__tests__/harness-send-message.test.js
```

Result: PASS.

```text
Test Suites: 4 passed, 4 total
Tests:       52 passed, 52 total
Snapshots:   0 total
```

### Server Full Tests

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Result: PASS.

```text
Test Suites: 28 passed, 28 total
Tests:       1 skipped, 383 passed, 384 total
Snapshots:   0 total
```

Known/non-blocking output: Node warned that `--localstorage-file` was provided without a valid path. Full suite also emitted Node `DEP0190` warning about passing args with `shell: true`.

### Orchestrator Review Validation

After the review repair in `message-router.js`, validation was rerun:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/ws/stream-handlers.ts src/types/index.ts
```

Result: PASS. Existing Vite warnings remained.

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/wire/canonical-chat-event-applier.test.js test/ws/client-message-router.test.js test/wire/canonical-harness-event-bridge.test.js lib/harness/kimi/__tests__/harness-send-message.test.js
npm test -- --runInBand
```

Result: PASS.

```text
Focused: 52 passed
Full:    383 passed, 1 skipped
```

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Result: PASS.

### Whitespace Check

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Result: PASS. No output.

## Acceptance Check Results

The handoff requested `rg`, but `command -v rg` returned no path in this shell and every direct `rg` command failed with `zsh:1: command not found: rg`. Equivalent checks were run with the built-in Grep tool.

### Stream Handler Fallback Removal

Equivalent of:

```bash
rg -n "resolveScope\(|currentScope|currentThreadIds\.project|Final fallback|fall back to store\.currentScope|fallback to store\.currentScope|threadId \?\? null" fusion-studio-client/src/lib/ws/stream-handlers.ts
```

Result: PASS. No hits.

### Websocket Scope Forwarding

Equivalent of:

```bash
rg -n "scope: event\.scope" fusion-studio-server/lib/wire/wire-broadcaster.js
```

Result: PASS. 9 hits, covering outbound live chat websocket payloads:

```text
turn_begin, content, thinking, tool_call, tool_call_args, tool_result, subagent_event, turn_end, status_update
```

### Canonical Chat Event Scope Emission

Equivalent of:

```bash
rg -n "scope: getScope\(\)" fusion-studio-server/lib/wire/canonical-chat-event-applier.js
```

Result: PASS. 10 hits, covering all emitted `chat:*` payloads including the bounced `chat:tool_result` path.

### Prompt Error Route Metadata

Equivalent of:

```bash
rg -n "type: 'auth_error'|Wire does not support ACP sendMessage|Wire does not support direct canonical event delivery" fusion-studio-server/lib/ws/client-message-router.js
```

Result: PASS. Hits present. The related payloads now include route metadata. The direct auth error includes both `scope` and `threadId`; review also added route metadata to the remaining `message-router.js` auth-error payload.

### Slice N Legacy Tool Name Guard

Equivalent of:

```bash
rg -n "ReadFile|WriteFile|EditFile|StrReplaceFile|SearchWeb|FetchURL|SetTodoList|TodoWrite|PascalCase|adaptToolNameForWebsocket" fusion-studio-client/src/lib/instructions.ts fusion-studio-server/lib/wire fusion-studio-server/test/wire
```

Result: PASS. No hits from the built-in Grep checks.

## Manual Smoke Result

Restart command:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Result: PASS. Fusion rebuilt and restarted successfully.

```text
Electron PID: 13301
Server URL:   http://localhost:60407
```

After the orchestrator review repair, Fusion was restarted again:

```text
Electron PID: 21080
Server URL:   http://localhost:60528
```

Interactive browser smoke was not performed from this headless session. Skipped items:

1. Plain prompt streams and completes.
2. Shell/tool prompt streams and completes.
3. Read or write prompt.
4. Switching between two project threads during a stream.
5. View-scoped chat rendering.

## Dropped-Message Diagnostic Behavior

`stream-handlers.ts` now treats missing route metadata on live stream messages as a contract violation:

```typescript
console.warn('[WS] Dropping stream message without explicit route metadata', {
  type: msg.type,
  scope: msg.scope,
  threadId: msg.threadId,
});
```

The message returns `true` from `handleStreamMessage()` so it is considered handled and intentionally dropped, not passed to another handler.

## Risks and Follow-Up

1. Interactive browser smoke still needs a human check for live streaming, tool calls, project-thread switching, and view-scoped chat.
2. `thread-handlers.ts` still owns the next compatibility cleanup: strict thread route metadata and rich `exchanges` hydration without legacy `history` fallback.
3. Generic `error` messages still only log and do not require route metadata, per the handoff non-goal. If a future generic error mutates chat state, it should become routed or be split into a routed error type.

## Final Git Status

The working tree remains dirty with accepted prior slice files, runtime/user state, and this Slice O report. No commits were made.
