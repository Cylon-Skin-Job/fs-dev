# Handoff: Kimi Legacy Removal Slice G - Extract Canonical Chat Event Applier

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-01-kimi-legacy-slice-f-canonical-harness-contract-results.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A through F are complete or accepted. Slice F documented the canonical harness event contract and proved the current Kimi translator gaps around `status_update`, `subagent_event`, and tool-result field names.

This slice is the first runtime refactor in Phase 5/6. Keep it behavior-preserving.

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

Expected starting point should include the accepted Slice F files, committed or uncommitted:

```text
fusion-studio-server/lib/harness/types.js
fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js
docs/handoffs/2026-06-01-kimi-legacy-slice-f-canonical-harness-contract-results.md
```

If the tree is dirty, inspect before editing. Do not overwrite unrelated user/session work. Runtime/user state files such as these may be dirty and must be left alone:

```text
ai/system/state/state.json
fusion-studio-server/data/workspace-cache.json
```

## Current Problem

`fusion-studio-server/lib/wire/message-router.js` currently owns too many jobs:

- raw Kimi wire event parsing
- session turn state mutation
- assistant parts construction for persistence
- tool argument accumulation/parsing
- settings-folder write-lock bounce
- `chat:*` event-bus emission
- assistant message persistence handoff
- non-chat transport forwarding

That makes the central router vendor-aware and hard to replace with real harness modules.

The next shape should be:

```text
raw Kimi wire adapter
  -> canonical-shaped chat event
  -> canonical chat event applier
  -> existing chat:* bus events
  -> existing websocket broadcaster
```

This slice should extract the reusable applier while keeping the current raw Kimi wire path active.

## Critical Constraint

Do not migrate the frontend websocket contract in this slice.

The current frontend `tool_call` handling still expects existing tool-name values such as `Bash`, `ReadFile`, `WriteFile`, etc. It does not yet safely consume lowercase canonical tool names like `shell`, `read`, and `write`.

Therefore, for this behavior-preserving extraction:

- The new applier should consume canonical event type names such as `turn_begin`, `content`, `tool_result`, etc.
- The Kimi adapter in `message-router.js` may continue passing the existing frontend-facing `toolName` value.
- The applier may use canonical result fields internally (`output`, `statusMessage`, `display`, `returnedDiff`, `isError`, `files`) but must emit the current bus/websocket-compatible fields for `chat:tool_result`: `toolOutput`, `toolStatus`, `toolDisplay`, `returnedDiff`, `isError`.
- Do not remove frontend vendor aliases yet. That is a later slice after the backend can guarantee canonical frontend-facing names.

## Files In Scope

Primary scope:

- `fusion-studio-server/lib/wire/message-router.js`
- New file, preferred:
  - `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`
- New tests, preferred:
  - `fusion-studio-server/test/wire/canonical-chat-event-applier.test.js`

Direct support scope if needed:

- `fusion-studio-server/lib/harness/types.js`

Read-only/reference scope:

- `fusion-studio-server/lib/wire/wire-broadcaster.js`
- `fusion-studio-server/lib/audit/audit-subscriber.js`
- `fusion-studio-server/lib/harness/kimi/display-normalizer.js`
- `fusion-studio-server/lib/harness/kimi/event-translator.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/thread-ws-handlers.js`

Do not touch frontend files in this slice unless a server test proves the existing websocket payload cannot be preserved without a surgical client adapter. That should not be necessary.

## Task

Extract a canonical chat event applier from `message-router.js`.

Expected implementation:

1. Add `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`.

   Suggested API:

   ```js
   function createCanonicalChatEventApplier({
     session,
     emit,
     resolveWorkspace,
     touchThreadSession,
     persistAssistantMessage,
     checkSettingsBounce,
     generateTurnId,
   }) {
     return { applyChatEvent };
   }
   ```

   Reasonable variations are acceptable, but keep the dependency direction clean:

   - The applier should not parse raw Kimi JSON-RPC messages.
   - The applier should not import `normalizeKimiToolResult`.
   - The applier should not switch on `TurnBegin`, `ContentPart`, `ToolCallPart`, `ToolResult`, `SubagentEvent`, or `StatusUpdate`.
   - The applier should own generic turn/session mutation and `chat:*` emission.

2. Move these generic behaviors from `message-router.js` into the applier:

   - touch session on chat activity
   - spurious empty `turn_begin` guard using `session.pendingUserInput`
   - create/reset `session.currentTurn`
   - reset `session.hasToolCalls`
   - reset and build `session.assistantParts`
   - append/merge text parts
   - append/merge thinking parts
   - track active tool id
   - accumulate `tool_call_args`
   - parse accumulated tool args on `tool_result`
   - apply settings-folder write-lock bounce through `checkSettingsBounce`
   - update corresponding persisted `tool_call` assistant part
   - emit existing `chat:*` events
   - store live status metadata from `status_update`
   - persist assistant message on `turn_end`
   - reset turn metadata on `turn_end`

3. Keep `message-router.js` responsible for raw transport and raw Kimi adaptation only:

   - WebSocket closed guard
   - raw `msg.method === 'event'` dispatch
   - convert raw Kimi event names to applier event names
   - call `normalizeKimiToolResult()` for raw Kimi `ToolResult` before invoking the applier
   - direct non-chat forwarding for `StepBegin`, request, response, error, unknown

   This means `message-router.js` may still contain Kimi wire event names after this slice. That is acceptable. The goal is to move generic behavior out first.

4. Preserve current bus and websocket payloads.

   In particular, emitted `chat:tool_result` must still include:

   ```js
   {
     toolCallId,
     toolName,
     toolArgs,
     toolOutput,
     toolStatus,
     toolDisplay,
     returnedDiff,
     isError
   }
   ```

   Do not change `wire-broadcaster.js` payload names in this slice.

5. Preserve persisted assistant part shape.

   Existing `assistantParts` entries are used by SQLite/history persistence through `audit-subscriber.js`. Preserve these shapes:

   Text:

   ```js
   { type: 'text', content }
   ```

   Thinking:

   ```js
   { type: 'think', content }
   ```

   Tool call:

   ```js
   {
     type: 'tool_call',
     toolCallId,
     name,
     arguments,
     result: {
       output,
       statusMessage,
       display,
       returnedDiff,
       isError,
       error,
       files
     }
   }
   ```

6. Keep settings-folder bounce behavior identical.

   The bounce path must still emit:

   - `system:tool_bounced`
   - `chat:tool_result` with `isError: true`

7. Add focused unit tests for the new applier.

   Cover at minimum:

   - `turn_begin` uses pending user input fallback and emits `chat:turn_begin`
   - empty `turn_begin` without pending input is ignored
   - consecutive `content` events merge in `assistantParts`
   - `thinking` events stay separate from text
   - `tool_call` creates a persisted tool part and emits `chat:tool_call`
   - `tool_call_args` accumulates and emits `chat:tool_call_args`
   - `tool_result` parses args, updates persisted part, and emits current bus payload fields
   - bounced `tool_result` emits `system:tool_bounced` and error `chat:tool_result`
   - `subagent_event` emits `chat:subagent_event`
   - `status_update` stores metadata and emits `chat:status_update`
   - `turn_end` calls assistant-message persistence, emits `chat:turn_end` with `parts`, then resets turn state

8. Add a smaller router test only if practical.

   If test setup is too expensive, do not build a brittle WebSocket/process harness. The applier tests are the required proof for this slice.

## Do Not Do

- Do not change frontend files.
- Do not change `wire-broadcaster.js` message names.
- Do not convert frontend-facing `toolName` values to lowercase canonical names yet.
- Do not remove `compat.js`.
- Do not remove `compatibleStdout`.
- Do not remove `serializeToKimiWire()`.
- Do not switch `HARNESS_MODE`.
- Do not move raw Kimi parsing into `harness/kimi/*` yet.
- Do not implement Kimi `sendMessage()`.
- Do not change prompt recovery/session warmup behavior.
- Do not include Write File filename display, hourglass behavior, warm-session expiration queue work, or visual polish.
- Do not modify `ai/system/state/state.json` or runtime cache files.

## Acceptance Checks

Run from repo root:

```bash
rg -n "normalizeKimiToolResult|TurnBegin|ContentPart|ToolCallPart|ToolResult|SubagentEvent|StatusUpdate" fusion-studio-server/lib/wire/canonical-chat-event-applier.js
```

Expected result: no hits.

Run:

```bash
rg -n "assistantParts\\.push|assistantParts\\[|currentTurn\\s*=|hasToolCalls\\s*=|contextUsage\\s*=|tokenUsage\\s*=|messageId\\s*=|planMode\\s*=" fusion-studio-server/lib/wire/message-router.js
```

Expected result: no hits, or only clearly non-mutating comments. The applier should own these mutations.

Run:

```bash
rg -n "toolOutput|toolStatus|toolDisplay" fusion-studio-server/lib/wire/canonical-chat-event-applier.js fusion-studio-server/lib/wire/wire-broadcaster.js
```

Expected result: hits are acceptable and expected. This slice preserves the existing bus/websocket payload names.

Run:

```bash
rg -n "serializeToKimiWire|compatibleStdout" fusion-studio-server/lib/harness fusion-studio-server/lib/wire
```

Expected result: still has hits. Do not remove those in this slice.

Run prior Slice F focused checks:

```bash
rg -n "subagent_event|status_update|StatusUpdate|SubagentEvent" fusion-studio-server/lib/harness/types.js fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js
```

Expected result: hits.

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- test/wire/canonical-chat-event-applier.test.js
```

Then run the focused harness tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/display-normalizer.test.js lib/harness/kimi/__tests__/session-state.test.js lib/harness/kimi/__tests__/wire-parser.test.js
```

If both pass, run the full server test suite:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test
```

Then:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Frontend build is not required unless you touch frontend files. You should not touch frontend files.

## Manual Smoke

If tests pass, restart the app:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Smoke these in a chat thread:

1. Plain text response.
2. Thinking response.
3. Shell command with output.
4. A read/glob/grep style tool if easy to trigger.
5. A write/edit tool if easy to trigger.
6. Confirm `turn_end` still finalizes only after reveal completion.
7. Confirm saved history still reopens with text and tool parts.

## Final Report Requirements

Include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Commit SHA if you commit.
- Files changed.
- Test results, including full server suite if run.
- `git diff --check` result.
- Manual smoke result or reason skipped.
- Any code standards exception, with reason.
- Whether `message-router.js` still contains raw Kimi event names.
- Whether the new applier is free of Kimi wire event names and `normalizeKimiToolResult`.
- Whether current websocket payload names were preserved.

## Recommended Next Slice To Propose

If Slice G passes, recommend preparing:

```text
Slice H - Feed Canonical Events From Harness Sessions
```

That later slice should route new harness sessions directly into the canonical applier instead of round-tripping through `compatibleStdout` and `serializeToKimiWire()`.
