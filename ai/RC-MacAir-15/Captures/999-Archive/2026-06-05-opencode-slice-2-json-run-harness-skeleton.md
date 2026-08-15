# OpenCode Slice 2: JSON Run Harness Skeleton

## Objective

Implement an opt-in OpenCode harness session that runs `opencode run --format json`, parses newline-delimited JSON events, translates them through the Slice 1 OpenCode translator, and yields Fusion canonical harness events through the existing direct canonical runtime path.

This slice proves OpenCode can plug into the runtime as a harness module without becoming the default harness and without touching client UI.

## Current State

Slice 1 added:

- `fusion-studio-server/lib/harness/opencode/json-event-translator.js`
- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/test/harness/opencode/json-event-translator.test.js`

The translator API is:

```js
const {
  OpenCodeJsonEventTranslator,
  mapOpenCodeToolName,
  mapOpenCodeTokenUsage,
} = require('./json-event-translator');

translator.beginTurn(userInput, timestamp?)
translator.translate(openCodeJsonEvent)
```

Runtime prompt flow already expects direct canonical harness sessions:

```text
registry.get(harnessId)
  -> harness.startThread(threadId, projectRoot, scopeContext)
  -> session.sendMessage(userInput, options)
  -> canonical events
  -> canonical-harness-event-bridge
  -> canonical-chat-event-applier
```

The registry currently defaults to Kimi for ordinary threads. Do not change default selection in this slice.

## Required Reading

- `ai/<machine>/Wiki/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-05-opencode-slice-1-json-run-translator-preflight.md`
- `fusion-studio-server/lib/harness/types.js`
- `fusion-studio-server/lib/harness/registry.js`
- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/harness/kimi/index.js`
- `fusion-studio-server/lib/thread/thread-runtime-controller.js`
- `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js`

## Scope

Implement a minimal `OpenCodeHarness` under `fusion-studio-server/lib/harness/opencode/`.

Expected public shape:

```js
class OpenCodeHarness {
  id = 'opencode';
  name = 'OpenCode';
  provider = 'opencode';

  async initialize(config) {}
  async startThread(threadId, projectRoot, scopeContext = {}) {}
  getSession(threadId) {}
  async dispose() {}
  async isInstalled() {}
  async getVersion() {}
}
```

Expected session shape:

```js
{
  threadId,
  process,
  sendMessage(message, options),
  stop(),
}
```

`sendMessage()` must be an async generator yielding canonical events.

## Runtime Behavior

Use one `opencode run` process per prompt for this slice.

This is intentionally not the final long-lived ACP/OpenCode server integration. A per-prompt JSON-run process is enough to validate:

- process spawning
- NDJSON parsing
- canonical event yielding
- runtime bridge compatibility
- tool call event shape
- stop/error semantics at the harness boundary

### Command Shape

Base command:

```bash
opencode run --format json --dir <projectRoot> <prompt>
```

Add flags conservatively:

- Use `--model <model>` only if `config.model` exists.
- Use `--pure` only if explicitly configured via `config.pure === true` or an env/config name you document.
- Do not add `--dangerously-skip-permissions` by default.

Use `config.cliPath || process.env.OPENCODE_PATH || 'opencode'` for the executable.

Use `projectRoot` as the working directory when present. Do not hardcode `/private/tmp` except in optional manual smoke commands.

### Event Flow

`sendMessage(message, options)` should:

1. Create a fresh `OpenCodeJsonEventTranslator`.
2. Yield `translator.beginTurn(message)`.
3. Spawn `opencode run --format json ... message`.
4. Parse stdout as newline-delimited JSON.
5. For every parsed JSON object, call `translator.translate(event)`.
6. Yield every canonical event returned by the translator.
7. Treat final `turn_end` from translator as normal completion.
8. If the process exits before a final `turn_end`, yield an interrupted/error terminal event or throw a useful harness error. Pick the smallest behavior that matches existing runtime expectations and test it.

Stderr should be captured for error messages. Avoid noisy logging in tests.

### Stop Behavior

`session.stop()` should terminate the currently active OpenCode process if one exists.

For this slice:

- It is acceptable for the runtime controller's synthetic interrupted `turn_end` to be the user-visible stop result.
- After `stop()` is requested, process exit should not throw a later recoverable harness error.
- Unexpected process exit during an active prompt should still surface as a harness error.

Mirror the Kimi `stopRequested` pattern where practical.

## Registration

Register `opencode` in `fusion-studio-server/lib/harness/registry.js`, but do not make it default.

Metadata suggestion:

```js
this.register('opencode', new OpenCodeHarness(), {
  builtIn: false,
  description: 'OpenCode CLI',
  installCommand: 'npm install -g opencode-ai'
});
```

If the real install command differs locally, document it in the result report instead of guessing in code comments.

The existing runtime can select OpenCode only when a thread row has `harness_id = 'opencode'`.

## Suggested Files

Add or modify:

- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/lib/harness/opencode/json-line-parser.js` if you want a tiny parser helper
- `fusion-studio-server/lib/harness/opencode/__tests__/harness-send-message.test.js`
- `fusion-studio-server/lib/harness/registry.js`

Do not touch:

- client UI files
- Electron packaging files
- thread runtime controller
- canonical event bridge/applier, unless a real mismatch is found and covered by tests
- Kimi harness files

## Tests Required

Use mocked `child_process.spawn`; do not require live OpenCode for unit tests.

Cover:

1. `isInstalled()` returns true when `opencode --version` exits `0`.
2. `isInstalled()` returns false or rejects cleanly when spawn fails.
3. `getVersion()` captures version output.
4. `startThread()` returns a session with `sendMessage()` and `stop()`.
5. `sendMessage()` spawns `opencode run --format json --dir <projectRoot> <message>`.
6. `config.cliPath` overrides executable.
7. `config.model` adds `--model <model>`.
8. stdout text JSON yields `turn_begin` then `content`.
9. stdout tool JSON yields canonical tool events through the translator.
10. final `step_finish reason: stop` yields `turn_end`.
11. malformed stdout line does not crash the whole stream if surrounded by valid JSON, or else throws a clear parse error. Pick and document the behavior.
12. process exit after `stop()` does not throw.
13. unexpected process exit during active send throws a useful error.
14. `dispose()` stops active sessions and clears the session map.
15. registry contains `opencode` but Kimi/default selection is unchanged.

Use direct fixture-shaped JSON lines based on the Slice 1 probe:

```json
{"type":"text","timestamp":1780703411893,"sessionID":"ses_probe","part":{"type":"text","text":"OPEN_CODE_JSON_PROBE_OK"}}
{"type":"step_finish","timestamp":1780703411932,"sessionID":"ses_probe","part":{"type":"step-finish","reason":"stop","messageID":"msg_probe","tokens":{"total":10,"input":3,"output":1,"reasoning":0,"cache":{"write":0,"read":6}}}}
```

## Validation

From repo root:

```bash
cd fusion-studio-server
npm test -- --runInBand lib/harness/opencode test/harness/opencode
npm test -- --runInBand
```

Also run:

```bash
git diff --check -- fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode fusion-studio-server/lib/harness/registry.js
grep -R "dangerously-skip-permissions" -n fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode
grep -R "new OpenCodeHarness\\|opencode" -n fusion-studio-server/lib/harness/registry.js fusion-studio-server/lib/harness/opencode
```

The `dangerously-skip-permissions` grep should only hit tests if you explicitly test opt-in config. It must not be a production default.

If `rg` is available, prefer equivalent `rg` commands.

## Optional Manual Smoke

Only after unit tests pass, and only if OpenCode is installed/authenticated:

```bash
mkdir -p /private/tmp/opencode-probe
opencode -m opencode/mimo-v2.5-free --pure run --format json --dir /private/tmp/opencode-probe "Reply with exactly: OPEN_CODE_JSON_PROBE_OK"
```

Do not require this smoke for slice completion. If run, paste the first few event types and final status into the result report.

## Acceptance Criteria

- OpenCode has a concrete harness class with `startThread()` and async-generator `sendMessage()`.
- The harness uses the Slice 1 translator; it does not duplicate translator mapping logic.
- `opencode` is registered in the harness registry.
- Kimi remains the ordinary/default path for existing threads unless their database `harness_id` is explicitly `opencode`.
- No client UI changes.
- No Electron packaging changes.
- No OpenCode ACP/server implementation yet.
- No default harness switch yet.
- No production default use of `--dangerously-skip-permissions`.
- Focused and full server tests pass, or any unrelated failure is documented with evidence.

## Result Report Format

Return:

- files changed
- command shape implemented
- registration status
- whether default harness behavior changed
- focused test result
- full server test result
- `git diff --check` result
- any manual smoke result, if run
- risks/follow-up
