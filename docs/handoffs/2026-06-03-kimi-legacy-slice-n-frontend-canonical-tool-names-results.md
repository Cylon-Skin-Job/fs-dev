# Handoff Results: Kimi Legacy Removal Slice N - Frontend Canonical Tool Names

## Repo Root Confirmation

```text
/Users/rccurtrightjr./projects/fs-dev
```

## Git Status Before Edits

```text
 M "System Source Files/ai/system/state/state.json"
 M ai/system/state/state.json
 M ai/views/wiki-viewer/settings/state.json
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
?? docs/handoffs/2026-06-03-kimi-legacy-slice-n-frontend-canonical-tool-names.md
?? fusion-studio-server/lib/harness/kimi/__tests__/harness-send-message.test.js
?? fusion-studio-server/lib/wire/canonical-chat-event-applier.js
?? fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
?? fusion-studio-server/scripts/transcribe-file.js
?? fusion-studio-server/test/wire/
?? fusion-studio-server/test/ws/client-message-router.test.js
```

Last commit: `ccf2979 refactor: simplify reveal timing defaults`

## Files Changed

### Primary Scope

1. `fusion-studio-client/src/lib/instructions.ts`
   - Replaced PascalCase/Kimi tool name map with `CANONICAL_TOOL_SEGMENTS` containing only canonical names
   - Updated `toolNameToSegmentType()` to use canonical names only
   - Added `console.warn` diagnostic for unknown tool names instead of silently falling back
   - Updated JSDoc comment from "wire tool name" to "canonical tool name"

2. `fusion-studio-server/lib/wire/message-router.js`
   - Removed `CANONICAL_TO_PASCAL_CASE` mapping object
   - Removed `adaptToolNameForWebsocket()` function
   - Removed `adaptToolNameForWebsocket` parameter from `createCanonicalHarnessEventBridge()` call
   - Removed comments about frontend expecting PascalCase

3. `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js`
   - Removed `adaptToolNameForWebsocket` from function parameter destructuring
   - Simplified `tool_call` case to pass `event.toolName` directly
   - Simplified `tool_result` case to pass `event.toolName` directly
   - Removed JSDoc mentioning optional tool name adapter

4. `fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js`
   - Updated `tool_call` test to use canonical `shell` instead of `Shell`
   - Updated `tool_result` test to use canonical `shell` instead of `Shell`
   - Replaced "tool name websocket compatibility adapter" test with "canonical tool name pass-through" tests
   - Added assertion that canonical names are passed unchanged
   - Added assertion that unknown tool names are not mutated

5. `fusion-studio-server/test/wire/canonical-chat-event-applier.test.js`
   - Updated `checkSettingsBounce` to use canonical `write` instead of `WriteFile`
   - Updated bounced tool_result test data to use canonical `write` instead of `WriteFile`

### Support Scope

6. `fusion-studio-client/src/lib/ws/stream-handlers.ts`
   - Updated comment referencing `kimi SetTodoList` to generic "some harnesses"

## Validation Commands and Results

### Frontend Build

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Result: **PASS** - `tsc -b` and `vite build` completed successfully, no TypeScript errors.

### Frontend ESLint

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npx eslint src/lib/instructions.ts src/lib/ws/stream-handlers.ts src/lib/ws/thread-handlers.ts
```

Result: **PASS** - No lint errors (empty output).

### Server Focused Tests

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/wire/canonical-harness-event-bridge.test.js test/wire/canonical-chat-event-applier.test.js test/ws/client-message-router.test.js lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/harness-send-message.test.js
```

Result: **PASS** - 82 tests passed across 5 test suites.

### Server Full Tests

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Result: **PASS** - 382 tests passed, 1 skipped, across 28 test suites.

### Whitespace Check

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Result: **PASS** - No whitespace issues.

## Acceptance Check Results

### Check 1: No Legacy References

```bash
grep -rn "ReadFile\|WriteFile\|EditFile\|StrReplaceFile\|SearchWeb\|FetchURL\|SetTodoList\|TodoWrite\|Agent\|Task\|PascalCase\|CANONICAL_TO_PASCAL_CASE\|adaptToolNameForWebsocket" fusion-studio-client/src/lib/instructions.ts fusion-studio-server/lib/wire fusion-studio-server/test/wire
```

Result: **PASS** - No hits.

### Check 2: No Stale Compatibility Comments

```bash
grep -rn "Map wire tool name\|frontend still expects PascalCase\|websocket compatibility adapter" fusion-studio-client/src/lib/instructions.ts fusion-studio-server/lib/wire fusion-studio-server/test/wire
```

Result: **PASS** - No hits.

### Check 3: No PascalCase Tool Names in Tests

```bash
grep -rn "toolName: 'Shell'\|toolName: 'ReadFile'\|toolName: 'WriteFile'\|toolName: 'EditFile'" fusion-studio-server/test/wire
```

Result: **PASS** - No hits.

### Check 4: Harness Mapping Still Exists

```bash
grep -rn "ReadFile\|WriteFile\|EditFile\|ToolResult\|StatusUpdate\|SubagentEvent" fusion-studio-server/lib/harness/kimi fusion-studio-server/lib/harness/kimi/__tests__
```

Result: **PASS** - Hits present in Kimi harness/parser/translator code and tests as expected.

## Manual Smoke Result

Initial worker smoke was skipped because the worker reported that `/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh` was unavailable on its system.

Orchestrator follow-up smoke:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Result: **PASS** - Fusion rebuilt and restarted successfully.

```text
Electron PID: 79136
Server URL:   http://localhost:59820
```

Interactive chat smoke was completed by the user after restart. Result: **PASS**.

Checks covered:

1. Plain prompt.
2. Shell/tool prompt.
3. Read or write prompt if practical.
4. Tool rows render with correct segment types and do not fall back to read.

## Unknown Tool Name Warning Behavior

Introduced a `console.warn` in `toolNameToSegmentType()` when an unknown canonical tool name is encountered:

```typescript
console.warn(`[toolNameToSegmentType] Unknown canonical tool name: "${toolName}"`);
```

This provides visible development diagnostics without introducing a large toast system. The frontend still falls back to `'read'` segment type to prevent UI crashes, but developers will see a warning in the browser console.

## Risks / Follow-up

1. **Non-Kimi harnesses**: The handoff explicitly states not to broaden frontend aliases for future harnesses. If a non-Kimi harness emits a non-canonical tool name, it should be fixed in the harness interpreter, not the frontend mapper.

2. **Manual smoke testing**: While automated tests pass, a real-world smoke test with actual tool calls (shell, read, write) would provide additional confidence that the end-to-end flow works correctly.

3. **No frontend unit tests added**: The handoff noted not to create a frontend unit-test setup just for this slice. If one becomes available, a focused test for `toolNameToSegmentType()` canonical mapping and unknown-name warning would be valuable.

4. **Server `Bash` tool name in applier tests**: The `canonical-chat-event-applier.test.js` uses `Bash` as a test tool name. This is not a Kimi/PascalCase name and is not caught by the acceptance checks. It is purely test fixture data and does not affect the canonicalization flow.

## Status

**COMPLETE** - All acceptance criteria met. No commits made per instructions.
