# Handoff: Kimi Legacy Removal Slice L - Default Kimi Harness Path

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-k-direct-mode-smoke.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-k-direct-mode-smoke-results.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Slices A through K are complete or accepted. Slice K manually proved the direct Kimi harness path in the real Electron app under `HARNESS_MODE=new`:

```text
KimiHarness
  -> canonical events
  -> canonical-harness-event-bridge
  -> canonical-chat-event-applier
  -> chat:* event bus
  -> frontend
```

Slice K passed plain text and tool smoke, and fixed two activation issues:

- thread creation/opening had been forcing Kimi to legacy even when `HARNESS_MODE=new`
- the async harness proxy could exit before the real Kimi process was ready

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

The tree may contain accepted but uncommitted Slice F/G/H/I/J/K files plus runtime/user state files. Inspect before editing and do not overwrite unrelated user work.

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

Make the Kimi harness path the default Kimi runtime path.

After this slice, with no `HARNESS_MODE` launch environment set, creating/opening a Kimi thread should use:

```text
KimiHarness direct canonical path
```

Explicit rollback should still work:

```bash
HARNESS_MODE=legacy
```

or per-thread mode override to `legacy`.

This is the last proof step before removing raw Kimi event parsing from `wire/message-router.js`.

## Critical Constraints

Do not delete the legacy raw parser yet.

Do not remove:

```text
spawnThreadWireLegacy()
wire/message-router.js raw Kimi event cases
HARNESS_MODE=legacy rollback
compatibleStdout for other harnesses
serializeToKimiWire()
```

Do not touch frontend files.

Do not leave macOS launch environment set to `HARNESS_MODE=new` or `HARNESS_MODE=legacy`.

Do not preserve a confusing permanent `new` mode label in comments/docs if you touch nearby text. The product direction is not "direct Kimi mode"; it is "Kimi as a normal harness." Runtime fallback can remain named `legacy` until the next removal slice.

## Files In Scope

Primary scope:

```text
fusion-studio-server/lib/harness/feature-flags.js
fusion-studio-server/lib/thread/thread-crud.js
fusion-studio-server/lib/harness/compat.js
fusion-studio-server/test/harness/compat.test.js
```

Support scope if needed:

```text
fusion-studio-server/lib/ws/harness-ws-handlers.js
fusion-studio-server/lib/harness/index.js
```

Read-only/reference scope:

```text
fusion-studio-server/lib/harness/kimi/index.js
fusion-studio-server/lib/harness/kimi/event-translator.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/wire/message-router.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
```

## Task

1. Change the default effective harness mode from `legacy` to the direct harness path.

   Current `feature-flags.js` says:

   ```text
   Default: 'legacy'
   ```

   and `getHarnessMode()` returns `legacy` when there is no override/env var.

   Update this so the default effective mode is `new`.

   Keep `legacy` as a valid explicit mode.

2. Clean up the Slice K temporary activation logic in `thread-crud.js`.

   Current Slice K logic uses `process.env.HARNESS_MODE` to override Kimi's hardcoded legacy default:

   ```js
   const envMode = process.env.HARNESS_MODE;
   const mode = (envMode === 'new' || envMode === 'parallel') ? envMode : (harnessId === 'kimi' ? 'legacy' : 'new');
   ```

   After default mode flips, that shape is too confusing. Prefer a helper or clear local expression:

   - If `HARNESS_MODE=legacy`, set legacy.
   - If `HARNESS_MODE=parallel`, set parallel only if existing behavior supports it.
   - Otherwise, set new for Kimi and other harnesses.

   The important behavior:

   ```text
   no env var + Kimi thread -> new
   HARNESS_MODE=legacy + Kimi thread -> legacy
   HARNESS_MODE=new + Kimi thread -> new
   non-Kimi thread -> new
   ```

3. Preserve rollback through admin handlers.

   Existing `harness:set_mode` and `emergencyRollback()` should still be able to force `legacy`.

4. Update tests.

   `test/harness/compat.test.js` likely expects default `legacy`. Update it to assert default `new`, and add or preserve explicit legacy tests.

   Add coverage for `thread-crud.js` mode selection if a suitable test already exists. If there is no clean local test harness, document why and rely on focused feature-flag tests plus manual smoke.

5. Do not remove raw Kimi parsing.

   `wire/message-router.js` should still contain raw Kimi event cases after this slice. That is intentional rollback safety until Slice M.

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

Run from repo root:

```bash
rg -n "Default: 'legacy'|return 'legacy';" fusion-studio-server/lib/harness/feature-flags.js
```

Expected: no hits for default fallback language/code.

```bash
rg -n "HARNESS_MODE.*legacy|legacy.*HARNESS_MODE|emergencyRollback|spawnThreadWireLegacy" fusion-studio-server/lib/harness fusion-studio-server/lib/ws
```

Expected: hits remain. Explicit legacy rollback must still exist.

```bash
rg -n "case 'TurnBegin'|case 'ContentPart'|case 'ToolResult'|case 'SubagentEvent'|case 'StatusUpdate'" fusion-studio-server/lib/wire/message-router.js
```

Expected: hits remain. Do not delete raw Kimi parser in this slice.

```bash
rg -n "bridgeToEventBus|../../event-bus|normalizeTokenUsage|sendMessage not yet implemented" fusion-studio-server/lib/harness/kimi/index.js
```

Expected: no hits.

```bash
rg -n "compatibleStdout" fusion-studio-server/lib/harness/kimi
```

Expected: no hits.

```bash
launchctl getenv HARNESS_MODE
```

Expected before and after smoke: empty output.

```bash
git diff --check
```

Expected: clean.

## Manual Smoke

This slice must smoke default mode without setting `HARNESS_MODE`.

1. Confirm macOS launch env is clean:

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

4. Confirm logs show the direct harness path by default:

   ```text
   [Compat] Using NEW harness
   [KimiHarness] Spawned ...
   directCanonical: true
   [WS] Sending via harness ACP sendMessage
   ```

5. Confirm no duplicate assistant messages, no stuck pending state, and tool block type is correct.

6. Rollback smoke:

   Temporarily set explicit legacy:

   ```bash
   launchctl setenv HARNESS_MODE legacy
   cd /Users/rccurtrightjr./projects/Fusion-Home
   ./restart-fusion.sh
   ```

   Create/open one Kimi thread and confirm logs show:

   ```text
   [Wire:legacy] Spawning thread session
   ```

   Then clean up:

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
docs/handoffs/2026-06-03-kimi-legacy-slice-l-default-harness-path-results.md
```

The report should include:

- exact files changed
- default-mode log evidence for direct harness path
- plain prompt result
- tool prompt result
- explicit legacy rollback smoke result
- focused test results
- full server suite result
- `git diff --check` result
- confirmation `launchctl getenv HARNESS_MODE` is empty after cleanup
- any repair made during smoke

## Out Of Scope

- Do not delete `wire/message-router.js`.
- Do not remove raw Kimi parser cases.
- Do not remove `HARNESS_MODE=legacy` rollback.
- Do not remove frontend aliases.
- Do not change tool visual polish, write-file filename enrichment, hourglass behavior, or warm-session expiration queue work.

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
- Explicit legacy rollback smoke result.
- Path to the results report.
- Any code standards exception, with the reason.
