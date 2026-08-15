# Handoff: Kimi Legacy Removal Slice F - Canonical Harness Event Contract

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Slices A through E are complete. The visible typing cursor, frontend pressure gauge, inactive segment renderer layer, old static chunk strategy layer, and stale reveal timing constants have been removed.

This slice begins Phase 5. It is intentionally a contract and evidence slice. Do not extract `message-router.js`, do not remove `compat.js`, do not switch the app to the new harness path, and do not change frontend render behavior.

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

Expected starting point should be at or after:

```text
ccf2979 refactor: simplify reveal timing defaults
```

If the tree is dirty, inspect before editing. Do not overwrite unrelated user/session work. Runtime files such as `fusion-studio-server/data/workspace-cache.json` may be dirty after app smoke/restart; leave unrelated runtime state alone.

## Current Architectural Problem

Fusion's north star is:

```text
Vendor CLI protocol
  -> harness-specific parser/interpreter
  -> canonical chat/tool events
  -> universal event bus
  -> websocket broadcaster
  -> frontend stream handler
  -> canonical StreamSegment store
  -> shared live/history renderers
```

The current runtime still treats Kimi wire format as a generic backend contract in several places:

- `fusion-studio-server/lib/wire/message-router.js`
  - imports `../harness/kimi/display-normalizer`
  - switches on raw Kimi event names: `TurnBegin`, `ContentPart`, `ToolCall`, `ToolCallPart`, `ToolResult`, `SubagentEvent`, `TurnEnd`, `StatusUpdate`
- `fusion-studio-server/lib/harness/compat.js`
  - returns process-like proxies and uses `session.compatibleStdout`
- ACP harnesses under `fusion-studio-server/lib/harness/clis/*`
  - serialize canonical events back to Kimi wire via `serializeToKimiWire()`
- `fusion-studio-server/lib/harness/types.js`
  - describes only part of the event surface and currently omits live event types already used by the event bus/websocket path, such as `status_update` and `subagent_event`

Before any deletion or router extraction, we need the canonical event contract written down and verified against the existing Kimi translator.

## Files In Scope

Primary scope:

- `fusion-studio-server/lib/harness/types.js`
- `fusion-studio-server/lib/harness/kimi/event-translator.js`
- `fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js`
- `fusion-studio-server/lib/harness/kimi/tool-mapper.js`
- `fusion-studio-server/lib/harness/kimi/display-normalizer.js`

Documentation/report scope:

- Add one short contract document if useful, preferably:
  - `docs/handoffs/2026-06-01-kimi-legacy-slice-f-canonical-harness-contract-results.md`

Read-only inspection scope:

- `fusion-studio-server/lib/wire/message-router.js`
- `fusion-studio-server/lib/wire/wire-broadcaster.js`
- `fusion-studio-server/lib/audit/audit-subscriber.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/thread-ws-handlers.js`
- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/harness/clis/base-cli-harness.js`
- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
- `fusion-studio-client/src/lib/instructions.ts`
- `fusion-studio-client/src/lib/catalog.ts`
- `fusion-studio-client/src/lib/subagent-output.ts`

Only edit another file if a test or type contract proves it is directly required. Do not touch frontend files in this slice.

## Task

Create a precise canonical harness event contract and test the Kimi translator against it.

Expected work:

1. Update `fusion-studio-server/lib/harness/types.js` so the JSDoc event typedefs match the event surface actually required by the shared bus and websocket broadcaster.

   Include, at minimum:

   - `turn_begin`
   - `content`
   - `thinking`
   - `tool_call`
   - `tool_call_args`
   - `tool_result`
   - `subagent_event`
   - `status_update`
   - `turn_end`

2. Make `ToolResultEvent` describe the normalized/canonical result shape clearly.

   It should distinguish canonical fields from Kimi raw fields. The contract should not require consumers to know about Kimi's `return_value`.

   Current code has both naming patterns in different layers:

   - translator events use `output`, `statusMessage`, `display`, `returnedDiff`, `isError`, `files`
   - bus/websocket events use `toolOutput`, `toolStatus`, `toolDisplay`, `returnedDiff`, `isError`

   Do not force a runtime rename in this slice unless tests prove an existing path is already broken. Instead, document the current mismatch as a finding and recommend the exact normalization target for the next slice.

3. Add or strengthen tests in `fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js` proving Kimi native names become canonical names.

   Cover at least these native names:

   - `Bash` -> `shell`
   - `ReadFile` -> `read`
   - `WriteFile` -> `write`
   - `EditFile` or `StrReplaceFile` -> `edit`
   - `SearchWeb` or `WebSearch` -> `web_search`
   - `FetchURL` or `WebFetch` -> `fetch`
   - `Agent` or `Task` -> `subagent`
   - `SetTodoList` or `TodoWrite` -> `todo`

   If some of those aliases are not currently mapped in the Kimi mapper, report that as a finding. Do not silently add broad aliases unless the Kimi wire protocol is known to emit them.

4. Add or strengthen tests proving Kimi `ToolResult.return_value` display data is normalized before it leaves the Kimi translator.

   Include at least:

   - output text
   - `display`
   - `returnedDiff`
   - `isError`
   - `files`

5. Add a test or explicit finding for `StatusUpdate`.

   Current behavior in `event-translator.js` updates translator state and emits metadata on `turn_end`, but it does not emit a live canonical `status_update` event. That may be acceptable temporarily, but the contract needs to say whether the future harness path must emit live `status_update`.

6. Add a test or explicit finding for `SubagentEvent`.

   Current `message-router.js` handles raw Kimi `SubagentEvent`, but `event-translator.js` does not. The contract needs to say whether the future Kimi harness path must translate this into canonical `subagent_event`.

7. Create a short results report if the final answer would otherwise be too dense.

   The report should list:

   - canonical event names and required fields
   - Kimi-specific code that is correctly isolated inside `harness/kimi/*`
   - Kimi-specific leaks that remain outside `harness/kimi/*`
   - mismatches between `types.js`, translator events, bus events, and frontend websocket messages
   - recommended next implementation slice

## Do Not Do

- Do not edit frontend render files.
- Do not remove frontend Kimi aliases in this slice.
- Do not remove `compat.js`.
- Do not remove `serializeToKimiWire()`.
- Do not route ACP harnesses directly to the bus yet.
- Do not extract or delete `message-router.js`.
- Do not change `HARNESS_MODE` defaults.
- Do not change prompt send/recovery behavior.
- Do not modify app runtime files, user state files, or workspace cache files.
- Do not include Write File filename display, hourglass behavior, warm-session expiration queue work, or visual polish.

## Acceptance Checks

Run from repo root:

```bash
rg -n "typedef \\{'turn_begin' \\| 'content' \\| 'thinking' \\| 'tool_call' \\| 'tool_call_args' \\| 'tool_result' \\| 'turn_end'\\}" fusion-studio-server/lib/harness/types.js
```

Expected result: no hits for the old incomplete union. The canonical type union should include `status_update` and `subagent_event`.

Run:

```bash
rg -n "subagent_event|status_update|StatusUpdate|SubagentEvent" fusion-studio-server/lib/harness/types.js fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js
```

Expected result: hits proving the contract and tests/findings cover both event types.

Run:

```bash
rg -n "ReadFile|WriteFile|StrReplaceFile|SearchWeb|FetchURL|SetTodoList|TodoWrite|WebSearch|WebFetch|Task" fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js fusion-studio-server/lib/harness/kimi/tool-mapper.js
```

Expected result: Kimi native names are covered by tests and/or mapper entries. If some names are intentionally unsupported, document why in the results report.

Run:

```bash
rg -n "normalizeKimiToolResult|TurnBegin|ContentPart|ToolCallPart|ToolResult|SubagentEvent|StatusUpdate|serializeToKimiWire|compatibleStdout" fusion-studio-server/lib fusion-studio-client/src/lib
```

Expected result: this will still have hits. Include a short categorized list in the report:

- acceptable Kimi adapter hits
- legacy/generic leak hits to address later
- frontend temporary compatibility hits

This command is evidence collection, not a zero-hit gate for this slice.

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/display-normalizer.test.js
```

If those pass, run the focused server test group that was used in earlier stabilization work:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/display-normalizer.test.js lib/harness/kimi/__tests__/session-state.test.js lib/harness/kimi/__tests__/wire-parser.test.js
```

Then:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Frontend build is not required unless you touch frontend files. You should not touch frontend files.

## Manual Smoke

No app restart is required for this slice if only tests/docs/JSDoc are changed.

If you make any runtime behavior change despite the scope warning, stop and explain why before continuing. Runtime behavior changes belong in the next slice.

## Final Report Requirements

Include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Commit SHA if you commit.
- Files changed.
- Test results.
- `git diff --check` result.
- Any code standards exception, with reason.
- Contract findings, especially around:
  - `status_update`
  - `subagent_event`
  - `ToolResultEvent` field names
  - `message-router.js` Kimi-specific switch
  - `compatibleStdout` / `serializeToKimiWire`

## Recommended Next Slice To Propose

If this slice passes, recommend preparing:

```text
Slice G - Extract Canonical Chat Event Applier
```

That later slice should move the generic session mutation, assistant parts construction, settings tool policy, bus emission, and persistence handoff out of raw Kimi `message-router.js` cases and into a canonical event applier. Kimi wire parsing should then become an adapter feeding that applier.
