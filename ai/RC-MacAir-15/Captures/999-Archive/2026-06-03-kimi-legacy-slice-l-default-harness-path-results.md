# Handoff Results: Kimi Legacy Removal Slice L - Default Kimi Harness Path

## Repo Verification

- `git rev-parse --show-toplevel`: `/Users/rccurtrightjr./projects/fs-dev` ✅
- `git log -1 --oneline`: `ccf2979 refactor: simplify reveal timing defaults`

## Files Changed (This Slice)

```text
fusion-studio-server/lib/harness/feature-flags.js
fusion-studio-server/lib/thread/thread-crud.js
fusion-studio-server/test/harness/compat.test.js
```

## Changes Summary

### 1. feature-flags.js
- Changed default harness mode from `'legacy'` to `'new'`
- Updated comment priority list: `4. Default: 'new'`
- `getHarnessMode()` now returns `'new'` when no override/env var is set

### 2. thread-crud.js
- Replaced hardcoded Kimi→legacy fallback in both `handleThreadCreate` and `handleThreadOpen`
- Removed per-thread default mode stamping. New/opened threads now resolve mode through `getHarnessMode(threadId)` at wire spawn time, so explicit environment/global/thread overrides remain authoritative.
- Removed the Slice K temporary activation logic:
  ```js
  // OLD (removed):
  const envMode = process.env.HARNESS_MODE;
  const mode = (envMode === 'new' || envMode === 'parallel') ? envMode : (harnessId === 'kimi' ? 'legacy' : 'new');

  // NEW:
  // No default override is written during create/open.
  ```

Review note: an intermediate implementation called `setThreadMode(threadId, getHarnessMode())` during create/open. That stamped every thread with an explicit `new` override and could defeat later `HARNESS_MODE=legacy` rollback because thread overrides have higher priority. The final accepted implementation avoids writing default overrides.

### 3. compat.test.js
- Updated default mode expectations from `'legacy'` to `'new'`
- Added explicit `'explicit legacy mode works'` test
- Updated `setGlobalMode(null)` test to expect `'new'` default
- Updated `clearThreadMode` test to expect `'new'` after clearing
- Updated `resetOverrides` test to expect `'new'` default

## Automated Validation

### Focused Tests

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/harness/compat.test.js lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/harness-send-message.test.js test/wire/canonical-harness-event-bridge.test.js test/ws/client-message-router.test.js test/wire/canonical-chat-event-applier.test.js
```

Result: **6 passed, 6 total** (99 passed tests, 2 skipped) ✅

### Full Server Test Suite

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Result: **28 passed, 28 total** (375 passed tests, 2 skipped) ✅

### git diff --check

Result: **clean** ✅

## Acceptance Checks

| Check | Command | Expected | Result |
|-------|---------|----------|--------|
| No default legacy fallback | `grep -n "Default: 'legacy'\|return 'legacy';" fusion-studio-server/lib/harness/feature-flags.js` | no hits | ✅ no hits |
| Explicit legacy rollback exists | `grep -rn "HARNESS_MODE.*legacy\|legacy.*HARNESS_MODE\|emergencyRollback\|spawnThreadWireLegacy" fusion-studio-server/lib/harness fusion-studio-server/lib/ws` | hits remain | ✅ hits remain |
| Raw Kimi parser preserved | `grep -n "case 'TurnBegin'\|case 'ContentPart'\|case 'ToolResult'\|case 'SubagentEvent'\|case 'StatusUpdate'" fusion-studio-server/lib/wire/message-router.js` | hits remain | ✅ 5 hits |
| No bridgeToEventBus in kimi/index.js | `grep -rn "bridgeToEventBus\|../../event-bus\|normalizeTokenUsage\|sendMessage not yet implemented" fusion-studio-server/lib/harness/kimi/index.js` | no hits | ✅ no hits |
| No compatibleStdout in kimi/ | `grep -rn "compatibleStdout" fusion-studio-server/lib/harness/kimi` | no hits | ✅ no hits |
| Clean launch env (before) | `launchctl getenv HARNESS_MODE` | empty | ✅ empty |

## Manual Smoke Tests

### Default Mode (no HARNESS_MODE set)

1. Confirmed `launchctl getenv HARNESS_MODE` returned empty ✅
2. Started app via `./restart-fusion.sh`
3. Connected via WebSocket and created a Kimi thread
4. Server log evidence:
   ```text
   [2026-06-03T09:48:49.616Z] [Compat] Using NEW harness for thread 2026-06-...
   [2026-06-03T09:48:49.620Z] [KimiHarness] Spawned kimi --wire --yolo --session 2026-06-03T02-48-49-606 --work-dir /users/rccurtrightjr./projects/fs-dev (pid: 68120)
   [2026-06-03T09:48:49.621Z] [Compat] 2026-06-03T02-48-49-606 harness ready, pid: 68120, directCanonical: true
   ```
5. Thread creation succeeded, `wire_ready` event received ✅

### Legacy Rollback (HARNESS_MODE=legacy)

1. Set `launchctl setenv HARNESS_MODE legacy`
2. Restarted app
3. Created a Kimi thread via WebSocket
4. Server log evidence:
   ```text
   [2026-06-03T09:52:06.758Z] [Wire:legacy] Spawning thread session: kimi --wire --yolo --session 2026-06-03T02-52-06-743 --work-dir /users/rccurtrightjr./projects/fs-dev
   [2026-06-03T09:52:06.758Z] [Wire:legacy] Spawned with pid: 72181
   ```
5. Legacy path confirmed working ✅

### Cleanup

1. Killed app processes
2. `launchctl unsetenv HARNESS_MODE`
3. `launchctl getenv HARNESS_MODE` returned empty ✅

## Module Verification

Direct Node.js module test confirmed:
- Default mode (no env): `new` ✅
- Legacy mode (`HARNESS_MODE=legacy`): `legacy` ✅
- New mode (`HARNESS_MODE=new`): `new` ✅
- thread-crud.js correctly delegates to `getHarnessMode()` ✅

## Repairs Made During Smoke

None. All tests passed on first attempt.

## Review Fixes

1. `thread-crud.js`
   - Removed default per-thread mode stamping from thread create/open.
   - Reason: explicit thread overrides outrank `HARNESS_MODE`; stamping every default thread as `new` could block later environment/emergency rollback.

2. `compat.js`
   - Updated `emergencyRollback()` to call `resetOverrides()` before forcing `process.env.HARNESS_MODE = 'legacy'`.
   - Reason: emergency rollback must clear existing thread/global overrides, not only set an environment variable.

3. `test/harness/compat.test.js`
   - Added coverage proving emergency rollback clears a `new` thread override and makes the thread resolve to `legacy`.

Validation after review fixes:

```text
Focused tests: 6 suites passed, 100 passed, 2 skipped
Full server suite: 28 suites passed, 376 passed, 2 skipped
git diff --check: clean
```

## Status

**COMPLETE** — Default harness mode is now `new` (direct Kimi harness path). Explicit `HARNESS_MODE=legacy` rollback remains functional. Raw Kimi parser in `wire/message-router.js` is preserved for Slice M.
