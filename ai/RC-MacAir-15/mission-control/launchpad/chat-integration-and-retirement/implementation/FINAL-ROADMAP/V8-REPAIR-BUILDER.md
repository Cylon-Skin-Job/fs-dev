# V8 OpenCode child environment inventory repair

Recorded: 2026-09-29T17:53:25Z  
Checkout: `/Users/rccurtrightjr./projects/fs-dev` at `88637d11c65be53d4f2ad0f049f64a07fa3db1de` (dirty shared worktree)

## Cause and repair

The full server suite's inventory check rejected the OpenCode run launch because `spawn` received `env: childEnvironment`, a prebuilt variable. The central environment builder was called correctly immediately beforehand, but the AST inventory deliberately requires a direct central-builder call in each production launch's inline `env` property so that aliases, reassignment, or shadowing cannot bypass the boundary. The two OpenCode version probes already comply.

Changed only `fusion-studio-server/lib/harness/opencode/index.js` (run launch, lines 201–214): the `spawn` options now call `buildHarnessChildEnvironment('opencode', { overrides: { TERM: 'xterm-256color' } })` directly. The earlier diagnostic snapshot still uses the same pure central builder and same override. It establishes `environmentReady` before the launch, preserving the diagnostic stage for a spawn throw. The builder remains the environment owner for the run and both version probes; `child-environment.js` and the inventory test were not weakened or edited.

Central builder behavior checked: it copies only common and adapter-specific allowlisted string values, forces `OPENCODE_DISABLE_CLAUDE_CODE=1` for OpenCode after overrides, and freezes the result. All three OpenCode `spawn` calls use the central builder directly after this repair.

## Focused verification

- `npx jest --runInBand --silent test/harness/child-environment-inventory.test.js test/harness/child-environment.test.js test/harness/opencode/harness-send-message.test.js test/harness/opencode/turn-outcome.test.js test/harness/opencode/harness-diagnostic-redactor.test.js`: 5 suites, 204 tests passed.
- `npx jest --runInBand --silent test/logging.test.js test/harness/opencode/resource-extractor.test.js test/harness/opencode/json-event-translator.test.js test/thread/harness-diagnostic-service.test.js`: 4 suites, 118 tests passed.
- `git diff --check -- fusion-studio-server/lib/harness/opencode/index.js`: passed.

Current source SHA-256: `5dbe53e8f262661164dca0a87ab3f217ead35150629fd43ca42020685f9973e0`. Full V8 and independent review belong to the supervisor gate.
