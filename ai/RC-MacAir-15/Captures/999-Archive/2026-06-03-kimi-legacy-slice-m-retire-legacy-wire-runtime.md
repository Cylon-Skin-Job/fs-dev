# Handoff: Kimi Legacy Removal Slice M - Retire Legacy Wire Runtime

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-k-direct-mode-smoke-results.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-l-default-harness-path-results.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Slices A through L are complete or accepted.

Important current state:

- Kimi defaults to the direct harness path.
- Direct Kimi path has been manually smoked in Electron.
- `HARNESS_MODE=legacy` was kept only as a temporary rollback after Slice L.
- The raw Kimi event parser still lives in `fusion-studio-server/lib/wire/message-router.js`.
- Other experimental CLI harnesses still expose `compatibleStdout`, which currently routes fake Kimi-shaped messages through the same raw parser.

This slice retires that legacy runtime path.

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

The tree may contain accepted but uncommitted Slice F through L files plus runtime/user state files. Inspect before editing and do not overwrite unrelated user work.

Known runtime/user state files that may be dirty and must be left alone:

```text
System Source Files/ai/<machine>/System/state/state.json
ai/<machine>/System/state/state.json
ai/<machine>/Views/<wiki-view-folder>/styles/state.json
fusion-studio-server/data/workspace-cache.json
```

Known unrelated user work may include:

```text
fusion-studio-client/src/mic/useAudioCapture.ts
fusion-studio-server/lib/transcription/index.js
```

## Goal

Remove the live raw Kimi wire runtime.

After this slice:

```text
Vendor CLI protocol
  -> harness parser / translator
  -> canonical events
  -> canonical-harness-event-bridge
  -> canonical-chat-event-applier
  -> event bus
  -> websocket broadcaster
```

No shared `fusion-studio-server/lib/wire/*` module should parse raw Kimi event names like:

```text
TurnBegin
ContentPart
ToolCall
ToolCallPart
ToolResult
SubagentEvent
StatusUpdate
```

Runtime rollback should no longer be `HARNESS_MODE=legacy`. At this point rollback is through git/checkpoint, not a duplicate live stack.

## Critical Constraints

Do not touch frontend files.

Do not remove or rewrite KimiHarness parser/translator code. Raw Kimi event names are allowed inside:

```text
fusion-studio-server/lib/harness/kimi/*
fusion-studio-server/lib/harness/kimi/__tests__/*
```

Do not remove canonical bridge/applier code.

Do not remove `compatibleStdout` implementations from other harness modules in this slice unless it is required to make tests pass. The required runtime change is that `compat.js` must stop choosing `compatibleStdout` over direct canonical `sendMessage()` events.

Do not leave UI/admin endpoints claiming a working emergency legacy rollback if legacy mode is removed.

## Files In Scope

Primary scope:

```text
fusion-studio-server/lib/harness/feature-flags.js
fusion-studio-server/lib/harness/compat.js
fusion-studio-server/lib/wire/message-router.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/ws/harness-ws-handlers.js
fusion-studio-server/test/harness/compat.test.js
fusion-studio-server/test/ws/client-message-router.test.js
```

Support scope if needed:

```text
fusion-studio-server/lib/harness/index.js
fusion-studio-server/lib/wire/process-manager.js
fusion-studio-server/server.js
```

Read-only/reference scope:

```text
fusion-studio-server/lib/harness/kimi/index.js
fusion-studio-server/lib/harness/kimi/event-translator.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/wire-broadcaster.js
```

## Task

1. Retire `legacy` and `parallel` as runtime harness modes.

   Update `feature-flags.js` so valid runtime mode is the direct harness path.

   Acceptable implementation options:

   - remove public mode switching entirely, or
   - keep only `new` as accepted mode and treat invalid/legacy/parallel env values as `new`.

   Do not leave `legacy` or `parallel` as valid modes if they do not work.

2. Remove legacy runtime spawning from `compat.js`.

   Delete or stop exporting:

   ```text
   spawnThreadWireLegacy
   spawnThreadWireParallel
   getParallelResults
   clearParallelResults
   emergencyRollback
   shouldUseNewHarness / isParallelMode usage if now obsolete
   ```

   `spawnThreadWire()` should start the configured harness through `registry`, set up direct canonical event delivery, and return the process-like proxy.

   Important: prefer direct canonical events whenever `session.sendMessage` exists, even if a harness still exposes `compatibleStdout`.

   Current unsafe pattern to remove:

   ```js
   if (session.compatibleStdout) {
     dummyProc.stdout = session.compatibleStdout;
   } else if (session.sendMessage) {
     dummyProc._usesDirectCanonicalEvents = true;
   }
   ```

   The direct path should win:

   ```js
   if (session.sendMessage) {
     dummyProc._usesDirectCanonicalEvents = true;
     dummyProc.stdout = inertStdout;
   } else if (session.compatibleStdout) {
     // only if a non-sendMessage harness genuinely needs a temporary bridge
   }
   ```

3. Remove raw Kimi event parsing from `message-router.js`.

   Remove the switch over:

   ```text
   TurnBegin
   ContentPart
   ToolCall
   ToolCallPart
   ToolResult
   SubagentEvent
   TurnEnd
   StatusUpdate
   ```

   Remove the `normalizeKimiToolResult` import from `message-router.js`.

   Keep `handleCanonicalHarnessEvent` exposed for direct canonical events.

   If `handleMessage()` remains, it should only handle truly generic non-chat transport messages or visible errors. It must not translate Kimi chat events.

4. Remove prompt fallback to legacy wire format from `client-message-router.js`.

   The prompt path should send through `wire._sendMessage`.

   If a wire lacks `_sendMessage`, return a visible non-recoverable error instead of writing a Kimi `prompt` JSON-RPC message.

   Remove stale comments like:

   ```text
   legacy uses Kimi-wire format
   compatibleStdout -> setupWireHandlers
   ```

   Do not break client `response` handling unless you have proven it is obsolete. If still needed for agent requests, leave it generic and document it.

5. Update harness admin handlers.

   `harness:rollback` should not claim to restore legacy mode if legacy mode is gone.

   Acceptable options:

   - remove the handler and return `harness:mode_error`, or
   - change it to reset overrides / report that runtime legacy rollback has been retired.

   Do not leave UI-visible text saying "All threads now use legacy mode."

6. Update tests.

   `test/harness/compat.test.js` should no longer test valid `legacy` or `parallel` runtime modes.

   Add/keep tests proving:

   - default mode resolves to direct harness path
   - invalid `HARNESS_MODE` values do not switch away from direct harness path
   - `HARNESS_MODE=legacy` no longer activates raw legacy mode
   - `spawnThreadWire()` uses direct canonical delivery when `session.sendMessage` exists
   - compatible stdout does not win over direct canonical delivery
   - prompt router errors visibly if a non-direct wire has no `_sendMessage`

## Required Automated Validation

Run focused server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/harness/compat.test.js lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/harness-send-message.test.js test/wire/canonical-harness-event-bridge.test.js test/ws/client-message-router.test.js test/wire/canonical-chat-event-applier.test.js
```

Then run full server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Always run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

## Acceptance Checks

Run from repo root.

No raw Kimi chat parser in shared wire modules:

```bash
rg -n "TurnBegin|ContentPart|ToolCallPart|ToolResult|SubagentEvent|StatusUpdate|normalizeKimiToolResult" fusion-studio-server/lib/wire fusion-studio-server/server.js
```

Expected: no hits, except docs/comments only if clearly not live code. Prefer no hits.

Raw Kimi event names remain in the harness boundary:

```bash
rg -n "TurnBegin|ContentPart|ToolCallPart|ToolResult|SubagentEvent|StatusUpdate" fusion-studio-server/lib/harness/kimi
```

Expected: hits.

Legacy runtime spawning removed:

```bash
rg -n "spawnThreadWireLegacy|spawnThreadWireParallel|Wire:legacy|Wire:parallel|parallelResults|getParallelResults|clearParallelResults" fusion-studio-server/lib fusion-studio-server/test
```

Expected: no runtime/test hits. If docs mention previous slices, leave docs alone.

Runtime legacy mode removed or neutralized:

```bash
rg -n "'legacy'|'parallel'|HARNESS_MODE=legacy|emergencyRollback|rollback.*legacy|All threads now use legacy" fusion-studio-server/lib/harness fusion-studio-server/lib/ws fusion-studio-server/test/harness
```

Expected: no live runtime claims that legacy/parallel are valid working modes. If `HARNESS_MODE` remains as a no-op compatibility env var, tests must prove it resolves to direct harness path.

Direct canonical path remains:

```bash
rg -n "_usesDirectCanonicalEvents|handleCanonicalHarnessEvent|canonical-harness-event-bridge" fusion-studio-server/lib fusion-studio-server/test
```

Expected: hits.

KimiHarness remains direct and canonical:

```bash
rg -n "bridgeToEventBus|../../event-bus|normalizeTokenUsage|sendMessage not yet implemented|compatibleStdout" fusion-studio-server/lib/harness/kimi
```

Expected: no hits.

```bash
git diff --check
```

Expected: clean.

## Manual Smoke

Manual smoke is required because this removes the runtime rollback stack.

1. Confirm launch environment is clean:

   ```bash
   launchctl unsetenv HARNESS_MODE
   launchctl getenv HARNESS_MODE
   ```

   Expected: empty output.

2. Restart app:

   ```bash
   cd /Users/rccurtrightjr./projects/Fusion-Home
   ./restart-fusion.sh
   ```

3. Create/open a Kimi thread and send:

   - plain text prompt
   - small read or shell tool prompt

4. Confirm logs show:

   ```text
   [Compat] Using NEW harness
   [KimiHarness] Spawned ...
   directCanonical: true
   [WS] Sending via harness ACP sendMessage
   ```

5. Confirm logs do not show:

   ```text
   [Wire:legacy]
   [Wire:parallel]
   ```

6. Confirm:

   - no duplicate assistant message
   - no stuck pending state
   - tool block type is correct
   - auth failure, if any, surfaces as `auth_error`

7. Try setting the old env var:

   ```bash
   launchctl setenv HARNESS_MODE legacy
   cd /Users/rccurtrightjr./projects/Fusion-Home
   ./restart-fusion.sh
   ```

   Confirm the app still uses direct harness path or emits an explicit "legacy mode retired" error. It must not silently try the removed raw legacy path.

8. Clean up:

   ```bash
   launchctl unsetenv HARNESS_MODE
   cd /Users/rccurtrightjr./projects/Fusion-Home
   ./restart-fusion.sh
   launchctl getenv HARNESS_MODE
   ```

   Expected final env output: empty.

## Deliverable

Create a results report:

```text
docs/handoffs/2026-06-03-kimi-legacy-slice-m-retire-legacy-wire-runtime-results.md
```

The report should include:

- exact files changed
- what happened to `HARNESS_MODE=legacy`
- default direct-path smoke result
- old-env-var smoke result
- plain prompt result
- tool prompt result
- focused test results
- full server suite result
- `git diff --check` result
- confirmation `launchctl getenv HARNESS_MODE` is empty after cleanup
- any code standards exception

## Out Of Scope

- Do not remove frontend raw Kimi aliases yet.
- Do not remove stale `compatibleStdout` implementations from other harness source files unless required for runtime correctness.
- Do not change tool visuals, write-file filename enrichment, hourglass behavior, or warm-session expiration queue work.
- Do not split frontend stream handlers.

## Final Report Requirements

Include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- Commit SHA if committed.
- Focused test results.
- Full server test result.
- `git diff --check` result.
- Default direct-path smoke result.
- Old `HARNESS_MODE=legacy` behavior result.
- Path to the results report.
- Any code standards exception, with the reason.
