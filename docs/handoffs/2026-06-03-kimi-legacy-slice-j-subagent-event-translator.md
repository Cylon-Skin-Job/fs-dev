# Handoff: Kimi Legacy Removal Slice J - Subagent Event Translator

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-i-kimi-harness-direct-send.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A through I are complete or accepted. Slice I made `KimiHarness.sendMessage()` usable through the direct canonical bridge in non-default `HARNESS_MODE=new`.

After Slice I, one known direct-mode translator gap remains:

```text
Kimi raw SubagentEvent -> canonical subagent_event
```

The legacy raw Kimi parser in `fusion-studio-server/lib/wire/message-router.js` still handles `SubagentEvent`, but the newer Kimi harness translator does not. That means `HARNESS_MODE=new` can lose subagent visibility even though the legacy path still works.

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

The tree may contain accepted but uncommitted Slice F/G/H/I files plus runtime/user state files. Inspect before editing and do not overwrite unrelated user work.

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

## Goal

Translate Kimi raw `SubagentEvent` messages into the canonical outer event shape consumed by the direct harness bridge:

```text
raw Kimi SubagentEvent
  -> EventTranslator subagent_event
  -> canonical-harness-event-bridge
  -> canonical-chat-event-applier
  -> chat:subagent_event
  -> wire-broadcaster
  -> frontend subagent_event
```

This is a prerequisite before deleting raw Kimi event parsing from `wire/message-router.js`.

## Critical Constraints

Do not touch frontend files.

Do not remove:

```text
wire/message-router.js raw Kimi SubagentEvent handling
HARNESS_MODE
spawnThreadWireLegacy()
compatibleStdout for other harnesses
serializeToKimiWire()
```

Do not change the websocket message shape.

Important: only the outer event becomes canonical:

```text
SubagentEvent -> subagent_event
```

The nested subagent event type must stay as Kimi emits it. For example, preserve:

```text
TurnBegin
ContentPart
ToolCall
ToolCallPart
ToolResult
TurnEnd
StatusUpdate
```

The frontend subagent stream handler currently expects these nested event names in `fusion-studio-client/src/lib/ws/stream-handlers.ts`. Do not lowercase or canonicalize `payload.event.type` in this slice.

## Files In Scope

Primary scope:

```text
fusion-studio-server/lib/harness/kimi/event-translator.js
fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js
fusion-studio-server/lib/harness/kimi/__tests__/harness-send-message.test.js
```

Support scope if needed:

```text
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/test/wire/canonical-chat-event-applier.test.js
fusion-studio-server/lib/harness/types.js
```

Read-only/reference scope:

```text
fusion-studio-server/lib/wire/message-router.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/lib/wire/wire-broadcaster.js
fusion-studio-client/src/lib/ws/stream-handlers.ts
```

## Task

1. Add `SubagentEvent` handling to `EventTranslator.translate()`.

   Expected mapping:

   ```js
   {
     method: 'event',
     params: {
       type: 'SubagentEvent',
       payload: {
         parent_tool_call_id: 'tc-1',
         agent_id: 'agent-1',
         subagent_type: 'task',
         event: {
           type: 'ToolCall',
           payload: { ... }
         }
       }
     }
   }
   ```

   should produce:

   ```js
   {
     type: 'subagent_event',
     timestamp,
     parentToolCallId: 'tc-1',
     agentId: 'agent-1',
     subagentType: 'task',
     subagentEventType: 'ToolCall',
     subagentPayload: { ... }
   }
   ```

2. Preserve nested subagent payloads without mutation.

   If `payload.event.payload` is an object, pass it through. If it is absent, use `{}`.

3. Preserve inner event names exactly.

   Do not map `ToolCall` to `tool_call`, `TurnBegin` to `turn_begin`, etc. The nested stream contract is intentionally still the subagent's raw event vocabulary.

4. Consider session liveness for subagent updates.

   `canonical-chat-event-applier.js` currently emits `chat:subagent_event`. If it does not call `touchThreadSession()` for subagent events, add that and update its test. Subagent events are wire activity and should keep an in-flight turn from being treated as idle.

5. Do not alter tool-name mapping for top-level tools.

   This slice is not about frontend canonical names or tool renderer cleanup.

## Required Tests

Run focused tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/harness-send-message.test.js test/wire/canonical-harness-event-bridge.test.js test/wire/canonical-chat-event-applier.test.js
```

Minimum coverage:

- `EventTranslator` maps `SubagentEvent` to canonical outer `subagent_event`.
- `parent_tool_call_id`, `agent_id`, and `subagent_type` map to camelCase fields.
- nested `event.type` is preserved exactly, for example `ToolCall`, not `tool_call`.
- nested `event.payload` is passed through as `subagentPayload`.
- missing nested payload becomes `{}`.
- `KimiHarness.sendMessage()` yields a `subagent_event` when a raw Kimi `SubagentEvent` line is fed through stdout.
- if `canonical-chat-event-applier.js` is updated for liveness, its subagent test proves `touchThreadSession()` is called.

Then run the full server suite:

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
rg -n "SubagentEvent returns null|not yet translated|new harness path would lose subagent" fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js
```

Expected: no hits.

```bash
rg -n "case 'SubagentEvent'|handleSubagentEvent|subagent_event" fusion-studio-server/lib/harness/kimi/event-translator.js fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js
```

Expected: hits proving the translator now handles the raw event and emits canonical `subagent_event`.

```bash
rg -n "bridgeToEventBus|../../event-bus|normalizeTokenUsage|sendMessage not yet implemented" fusion-studio-server/lib/harness/kimi/index.js
```

Expected: no hits. Slice I's direct applier path must remain intact.

```bash
rg -n "compatibleStdout" fusion-studio-server/lib/harness/kimi
```

Expected: no hits. KimiHarness should remain direct canonical, not compatible-stdout.

```bash
git diff --check
```

Expected: clean.

## Manual Smoke

Default legacy smoke:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Confirm the app starts and default Kimi legacy mode is not broken.

If local auth/setup allows, also run a non-default `HARNESS_MODE=new` Kimi smoke:

- Send a plain text prompt.
- Send or simulate a prompt that starts a subagent.
- Confirm subagent updates render once, not duplicated.
- Confirm no pending user request remains stuck.

If auth blocks the live smoke, report the exact auth failure and confirm it surfaces as `auth_error`.

## Out Of Scope

- Do not delete `wire/message-router.js`.
- Do not remove raw Kimi parser cases yet.
- Do not remove frontend subagent handling.
- Do not remove frontend Kimi aliases.
- Do not change tool visuals, write-file filename enrichment, hourglass behavior, or warm-session expiration queue work.

## Final Report Requirements

Include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- Commit SHA if committed.
- Focused test results.
- Full server test result.
- `git diff --check` result.
- Manual default legacy smoke result.
- `HARNESS_MODE=new` subagent smoke result, or exact blocker.
- Any code standards exception, with the reason.
