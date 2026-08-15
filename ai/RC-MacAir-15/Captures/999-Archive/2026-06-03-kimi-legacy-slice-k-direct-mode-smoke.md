# Handoff: Kimi Legacy Removal Slice K - Direct Kimi Harness Smoke

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-i-kimi-harness-direct-send.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-j-subagent-event-translator.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Slices A through J are complete or accepted. The direct Kimi harness path is now implemented and unit-tested:

```text
KimiHarness.sendMessage()
  -> EventTranslator canonical events
  -> canonical-harness-event-bridge
  -> canonical-chat-event-applier
  -> chat:* event bus
  -> wire-broadcaster
  -> frontend
```

But it has not yet been manually smoked in the real Electron app under `HARNESS_MODE=new`.

Do this before deleting the raw Kimi parser from `wire/message-router.js`.

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

The tree may contain accepted but uncommitted Slice F/G/H/I/J files plus runtime/user state files. Inspect before editing and do not overwrite unrelated user work.

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

Prove the real app can run Kimi through the direct harness path in non-default mode.

This slice is allowed to make small, targeted fixes if the smoke exposes direct-mode breakage. It is not allowed to start broad cleanup.

## Critical Constraints

Do not switch the permanent/default mode.

Do not delete:

```text
wire/message-router.js raw Kimi event cases
HARNESS_MODE
spawnThreadWireLegacy()
compatibleStdout for other harnesses
serializeToKimiWire()
```

Do not touch frontend files unless the direct-mode smoke proves a server-side contract is impossible to satisfy without a surgical client fix. If that happens, stop and report before widening scope.

Do not leave macOS launch environment set to `HARNESS_MODE=new`.

## Activation Options

The app restart script launches Electron through macOS LaunchServices:

```text
/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh
```

The server is spawned by Electron and inherits Electron's environment:

```text
fusion-studio-client/electron/server-spawn.cjs
```

For a full-app non-default smoke, prefer this sequence:

```bash
launchctl setenv HARNESS_MODE new
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

After the smoke, always clean up:

```bash
launchctl unsetenv HARNESS_MODE
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

If you cannot use `launchctl`, use the app's per-thread WebSocket mode override:

```text
harness:set_mode { threadId, mode: "new" }
```

Only use that if you can clearly identify the thread and confirm the server logs show the new path.

## How To Confirm The Path

Look for logs showing the direct path, not the legacy parser path.

Expected new-path signals:

```text
[Compat] Using NEW harness
[KimiHarness] Spawned ...
directCanonical: true
[WS] Sending via harness ACP sendMessage
```

Expected legacy-path signals when default mode is restored:

```text
[Wire:legacy] Spawning thread session
```

Useful files:

```text
/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/fusion-electron.log
/tmp/fusion-electron.log
~/Library/Application Support/Electron/server.port
```

The exact temp path may vary; use the path printed by `restart-fusion.sh`.

## Required Smoke Matrix

Run in `HARNESS_MODE=new`:

1. Plain text prompt.
2. Thinking-heavy prompt, if Kimi emits thought trace locally.
3. Small read or shell tool prompt.
4. Subagent prompt if you know a reliable prompt that triggers one.

For each prompt, verify:

- A single assistant turn appears.
- Text/thinking reveal continues through completion.
- Tool calls render with the expected tool block type, not fallback read blocks.
- Tool result completes the tool block.
- `turn_end` clears pending state.
- No duplicate assistant message appears in the UI.
- No duplicate persisted assistant exchange appears after thread reload.
- No stuck pending user request remains.
- Auth failure, if encountered, surfaces as `auth_error` and clears an empty pending turn.

If Kimi auth blocks the smoke, do not treat that as a slice failure by itself. Report the exact auth message and verify the UI/server does not get stuck.

## Targeted Repairs Allowed

If direct mode fails, fix only direct-mode contract issues, such as:

- missing or malformed canonical event field
- direct bridge field mismatch
- auth error not reaching `auth_error`
- pending turn not clearing on direct-mode error
- duplicate event emission in direct mode
- direct-mode tool name adapter miss causing fallback read rendering
- session liveness not touched for direct-mode activity

Do not use frontend aliases to hide backend leaks.

Do not remove legacy fallback code in this slice.

## Required Automated Validation

Before smoke or after any repair, run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/harness-send-message.test.js test/wire/canonical-harness-event-bridge.test.js test/ws/client-message-router.test.js test/wire/canonical-chat-event-applier.test.js
```

If you edit server runtime code, also run:

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

Run from repo root:

```bash
rg -n "bridgeToEventBus|../../event-bus|normalizeTokenUsage|sendMessage not yet implemented" fusion-studio-server/lib/harness/kimi/index.js
```

Expected: no hits.

```bash
rg -n "compatibleStdout" fusion-studio-server/lib/harness/kimi
```

Expected: no hits.

```bash
rg -n "case 'SubagentEvent'|handleSubagentEvent|status_update" fusion-studio-server/lib/harness/kimi/event-translator.js
```

Expected: hits proving Slice I/J direct translator coverage remains present.

```bash
rg -n "spawnThreadWireLegacy|HARNESS_MODE|serializeToKimiWire|compatibleStdout" fusion-studio-server/lib/harness fusion-studio-server/lib/wire fusion-studio-server/lib/ws
```

Expected: still present outside KimiHarness. This slice must not remove the fallback stack.

Check the macOS launch environment after smoke:

```bash
launchctl getenv HARNESS_MODE
```

Expected after cleanup: empty output.

```bash
git diff --check
```

Expected: clean.

## Deliverable

Create a results report:

```text
docs/handoffs/2026-06-03-kimi-legacy-slice-k-direct-mode-smoke-results.md
```

The report should include:

- exact activation method used (`launchctl` or per-thread override)
- server URL and relevant log file path
- log evidence that new mode used `directCanonical: true`
- plain prompt result
- tool prompt result
- subagent prompt result or why skipped
- auth failure details if blocked
- any repair made, with file list
- focused test results
- full server suite result if run
- `git diff --check` result
- confirmation `launchctl getenv HARNESS_MODE` is empty after cleanup
- final default legacy restart result

## Out Of Scope

- Do not delete `wire/message-router.js`.
- Do not remove raw Kimi parser cases.
- Do not remove runtime `HARNESS_MODE` branches.
- Do not remove frontend aliases.
- Do not change tool visual polish, write-file filename enrichment, hourglass behavior, or warm-session expiration queue work.

## Final Report Requirements

Include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- Commit SHA if committed.
- Focused test results.
- Full server test result if code changed.
- `git diff --check` result.
- Direct-mode smoke result.
- Default legacy restart result after cleanup.
- Path to the results report.
- Any code standards exception, with the reason.
