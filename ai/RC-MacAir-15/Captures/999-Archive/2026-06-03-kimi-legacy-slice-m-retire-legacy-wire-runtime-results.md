# Slice M Results: Retire Legacy Wire Runtime

## Repo Verification

- `git rev-parse --show-toplevel`: `/Users/rccurtrightjr./projects/fs-dev`
- `git log -1 --oneline`: `ccf2979 refactor: simplify reveal timing defaults`
- `git status --short` before edits: contained accepted but uncommitted Slice F-L files plus runtime/user state.
- `git diff --check`: clean (no whitespace errors)

## Files Changed (Slice M)

### Primary scope
- `fusion-studio-server/lib/harness/feature-flags.js`
- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/wire/message-router.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/harness-ws-handlers.js`
- `fusion-studio-server/test/harness/compat.test.js`
- `fusion-studio-server/test/ws/client-message-router.test.js`

### Support scope
- `fusion-studio-server/lib/harness/index.js`

## What Happened to HARNESS_MODE=legacy

`HARNESS_MODE=legacy` and `HARNESS_MODE=parallel` are no longer valid runtime modes.

- `feature-flags.js` `VALID_MODES` is now `['new']`.
- `getHarnessMode()` treats `legacy`, `parallel`, and any invalid env value as `'new'`.
- `setThreadMode()` and `setGlobalMode()` throw on `legacy` or `parallel`.
- `shouldUseNewHarness()` always returns `true`.
- `isParallelMode()` always returns `false`.

## Default Direct-Path Smoke Result

App restarted successfully with `HARNESS_MODE` unset.
Server logs show `[Compat] Using NEW harness` for thread spawns.
No `[Wire:legacy]` or `[Wire:parallel]` messages observed after the restart.
Manual GUI smoke (plain prompt + tool prompt) was not performed in this headless session; automated test coverage confirms the direct canonical event path is exercised.

## Old-Env-Var Smoke Result

With `HARNESS_MODE=legacy` set via `launchctl`, app restarted successfully.
`getHarnessMode()` resolved to `'new'` internally; no raw legacy wire spawning occurred.
The app did not silently fall back to the removed raw legacy path.

## Plain Prompt Result

Automated tests confirm:
- Wires with `_sendMessage` and `_usesDirectCanonicalEvents=true` yield canonical events through `handleCanonicalHarnessEvent`.
- Wires with `_sendMessage` but without direct canonical delivery now fail visibly instead of draining yielded events and dropping them.
- Wires without `_sendMessage` fail visibly because the legacy prompt path has been retired.

## Tool Prompt Result

Same direct canonical event path applies for all prompts.
No separate tool-prompt test was added; existing harness-send-message tests cover tool call/result canonical translation.

## Focused Test Results

```
Test Suites: 6 passed, 6 total
Tests:       1 skipped, 105 passed, 106 total
Snapshots:   0 total
Time:        0.564 s
```

Tested files:
- `test/harness/compat.test.js`
- `lib/harness/kimi/__tests__/event-translator.test.js`
- `lib/harness/kimi/__tests__/harness-send-message.test.js`
- `test/wire/canonical-harness-event-bridge.test.js`
- `test/ws/client-message-router.test.js`
- `test/wire/canonical-chat-event-applier.test.js`

## Full Server Suite Result

```
Test Suites: 28 passed, 28 total
Tests:       1 skipped, 381 passed, 382 total
Snapshots:   0 total
Time:        3.129 s
```

## Acceptance Checks

1. **No raw Kimi parser in shared wire modules**: Only hit is a comment in `server.js` (`StatusUpdate` reference in a messageId comment). No live code in `lib/wire`. Pass.
2. **Raw Kimi names remain in harness boundary**: Hits in `lib/harness/kimi/**`. Pass.
3. **Legacy runtime spawning removed**: No hits for `spawnThreadWireLegacy`, `spawnThreadWireParallel`, `Wire:legacy`, `Wire:parallel`, `parallelResults`, `getParallelResults`, `clearParallelResults`. Pass.
4. **Runtime legacy mode removed**: Only hits are in `test/harness/compat.test.js` proving legacy/parallel are rejected. Pass.
5. **Direct canonical path remains**: Hits in `lib/wire/canonical-harness-event-bridge.js`, `lib/harness/compat.js`, `lib/ws/client-message-router.js`, and tests. Pass.
6. **KimiHarness remains direct and canonical**: Only hits are test assertions that `bridgeToEventBus` and `normalizeTokenUsage` do NOT exist. Pass.
7. **`git diff --check`**: Clean. Pass.

## Review Repair

After the initial Slice M implementation, `client-message-router.js` still had a stale compatible-stdout prompt branch for `_sendMessage` wires where `_usesDirectCanonicalEvents=false`. With the raw Kimi parser removed, that branch could silently consume yielded canonical events without applying them.

Review patch:
- `fusion-studio-server/lib/ws/client-message-router.js`: requires direct canonical delivery for prompt sends; non-direct `_sendMessage` wires now send a non-recoverable visible error.
- `fusion-studio-server/test/ws/client-message-router.test.js`: replaces the stdout-drain assertion with a visible-error assertion and verifies the iterator is not consumed.

Post-repair validation:
- Focused server tests: 6 suites passed, 105 passed, 1 skipped.
- Full server suite: 28 suites passed, 381 passed, 1 skipped.
- `git diff --check`: clean.

## Environment Cleanup

```bash
launchctl unsetenv HARNESS_MODE
launchctl getenv HARNESS_MODE
# Output: (empty)
```

## Code Standards Exception

None. All changes follow existing patterns.

## Commit

Not committed per instruction — only to be committed when explicitly requested.

## Summary

Slice M successfully retires the live raw Kimi wire runtime:
- Legacy and parallel harness modes are no longer valid.
- `spawnThreadWire()` always uses the direct harness registry path.
- Direct canonical events (`session.sendMessage`) win over `compatibleStdout`.
- `message-router.js` no longer parses raw Kimi event names.
- `client-message-router.js` errors visibly if a wire lacks `_sendMessage` or direct canonical event delivery.
- `harness:rollback` reports that legacy mode has been retired.
- All 381 server tests pass.
