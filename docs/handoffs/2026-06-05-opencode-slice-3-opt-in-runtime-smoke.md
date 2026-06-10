# OpenCode Slice 3: Opt-In Runtime Smoke

## Objective

Prove the concrete OpenCode harness from Slice 2 works through Fusion's real thread runtime when a thread is explicitly created with `harnessId: 'opencode'`.

This is a smoke-and-repair slice. Start with runtime smoke. Only patch narrow integration issues that are directly exposed by the smoke.

## Current State

Completed:

- Slice 1: OpenCode JSON event translator.
- Slice 2: concrete `OpenCodeHarness`, `JsonLineParser`, mocked harness tests, registry registration.

Known current runtime path:

```text
thread row harness_id
  -> lib/harness/compat.js getHarnessIdForThread()
  -> registry.get(harnessId)
  -> harness.startThread(threadId, projectRoot, scopeContext)
  -> session.sendMessage(prompt)
  -> canonical events
  -> canonical-harness-event-bridge
  -> canonical-chat-event-applier
  -> websocket + persistence
```

OpenCode must remain opt-in. Kimi/default behavior must not change in this slice.

## Required Reading

- `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-05-opencode-slice-1-json-run-translator-preflight.md`
- `docs/handoffs/2026-06-05-opencode-slice-2-json-run-harness-skeleton.md`
- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/lib/harness/opencode/json-line-parser.js`
- `fusion-studio-server/lib/harness/opencode/json-event-translator.js`
- `fusion-studio-server/lib/harness/registry.js`
- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/ws/thread-ws-handlers.js`
- `fusion-studio-server/lib/thread/thread-runtime-controller.js`
- `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js`

## Hard Boundaries

Do not make OpenCode the default.

Do not add client UI.

Do not implement OpenCode ACP/server mode.

Do not touch Electron packaging files:

- `fusion-studio-client/electron/main.cjs`
- `fusion-studio-client/electron/server-spawn.cjs`
- `fusion-studio-client/package.json`
- `fusion-studio-client/package-lock.json`
- `fusion-studio-server/package.json`
- `fusion-studio-server/package-lock.json`

Do not debug Electron launch/package failures in this slice. If the restart script fails at Electron `open`, report it as an environment/packaging blocker and use an already-running server if available.

Do not use `--dangerously-skip-permissions` in production code. It may only appear in an optional manual smoke command if you clearly label it as local operator-controlled testing.

## Preflight

From repo root:

```bash
git status --short
opencode --version
opencode run --help
```

Confirm:

- `opencode` is installed.
- `opencode run --help` includes `--format`, `--dir`, `--model`, and `--pure`.
- The worktree is dirty from unrelated orchestration work; do not revert unrelated files.

## Start Fusion

Preferred:

```bash
/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh
```

If this fails at Electron `open` with `kLSNoExecutableErr` or similar, do not repair packaging here. Look for an already-running Fusion server URL in the restart output or process logs. If no server is available, stop and report the environment blocker.

## Smoke Path A: Direct WebSocket OpenCode Thread

Use this path instead of relying on a visible harness selector.

Connect to the running Fusion WebSocket URL. For a server URL like:

```text
http://localhost:58199
```

the WebSocket URL is:

```text
ws://localhost:58199
```

Create a temporary Node script under `/private/tmp` or run an equivalent one-off script. Do not commit the script unless you need it as a reusable test utility.

State machine:

1. Connect to `ws://localhost:<port>`.
2. Wait for `connected` or first server message.
3. Send:

```json
{ "type": "set_panel", "panel": "file-viewer" }
```

4. Wait for `panel_changed`.
5. Send:

```json
{
  "type": "thread:open-assistant",
  "scope": "project",
  "name": "opencode-smoke-<timestamp>",
  "harnessId": "opencode"
}
```

6. Capture `thread:created` and `thread:opened`; record `threadId`.
7. Wait for `wire_ready`.
8. Send:

```json
{
  "type": "prompt",
  "scope": "project",
  "threadId": "<captured threadId>",
  "user_input": "Reply with exactly: FUSION_OPENCODE_RUNTIME_OK"
}
```

9. Expect:

- `message:sent`
- at least one assistant content event or streamed segment event, depending on current broadcaster naming
- `status_update`
- terminal turn event (`turn_end` / `chat:turn_end` / current websocket equivalent)

10. Reopen the same thread with passive browse:

```json
{ "type": "thread:open", "scope": "project", "threadId": "<captured threadId>" }
```

11. Confirm the hydrated exchange includes:

- user prompt
- assistant response containing `FUSION_OPENCODE_RUNTIME_OK`

If a different panel is required because `file-viewer` has no chat for the active workspace, use whatever panel is already known to have chat. Do not add panel config in this slice.

## Smoke Path B: Tool Event

After Path A passes, run a tool smoke on a second temporary OpenCode thread:

```json
{
  "type": "prompt",
  "scope": "project",
  "threadId": "<threadId>",
  "user_input": "Use the bash tool to run exactly: printf FUSION_OPENCODE_TOOL_OK. Then reply exactly: TOOL_DONE"
}
```

Acceptance:

- runtime does not crash
- tool call appears with canonical tool name `shell`
- tool result output includes `FUSION_OPENCODE_TOOL_OK`
- final assistant content includes `TOOL_DONE`
- reopening the thread hydrates the exchange without duplicate live overlay

If OpenCode blocks the tool for permissions, do not globally add `--dangerously-skip-permissions`. Document the permission behavior and stop. A local-only smoke rerun may use explicit operator-controlled `--dangerously-skip-permissions` outside production code, but do not bake it into the harness.

## Smoke Path C: Stop/Interrupt

Run only after Path A passes.

Create a new OpenCode thread and send a prompt likely to stream for long enough to stop:

```json
{
  "type": "prompt",
  "scope": "project",
  "threadId": "<threadId>",
  "user_input": "Write a slow, detailed 20 paragraph explanation of how websocket streams are persisted. Start immediately."
}
```

After the first assistant content event, send:

```json
{
  "type": "turn:stop",
  "scope": "project",
  "threadId": "<threadId>"
}
```

Acceptance:

- server emits/causes one terminal interrupted turn
- partial assistant content is persisted
- a later harness process exit does not create a second visible error
- thread runtime is usable for a follow-up prompt

## Allowed Repairs

Patch only direct integration issues in:

- `fusion-studio-server/lib/harness/opencode/*`
- `fusion-studio-server/lib/harness/registry.js`
- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js`
- `fusion-studio-server/lib/thread/thread-runtime-controller.js`
- focused tests for touched server modules

Examples of allowed repairs:

- OpenCode command argument order mismatch.
- OpenCode process lifecycle race.
- async generator hangs after final event.
- canonical bridge drops an OpenCode event field required for persistence.
- registry metadata typo.
- `isInstalled()` or `getVersion()` promise-settling cleanup if it affects tests.

Examples of out-of-scope repairs:

- default harness switch
- harness selector UI
- OpenCode ACP/server mode
- Electron packaging launch
- workspace ribbon/sidebar work
- broad server.js refactors

## Tests After Any Repair

At minimum:

```bash
cd fusion-studio-server
npm test -- --runInBand lib/harness/opencode test/harness/opencode
npm test -- --runInBand test/thread/thread-runtime-controller.test.js test/wire/canonical-harness-event-bridge.test.js
npm test -- --runInBand
```

If no code is changed, report the previous test status and the live smoke result.

Always run touched-path whitespace checks:

```bash
git diff --check -- fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode fusion-studio-server/lib/harness/registry.js fusion-studio-server/lib/harness/compat.js fusion-studio-server/lib/wire/canonical-harness-event-bridge.js fusion-studio-server/lib/thread/thread-runtime-controller.js
```

Use narrower paths if you touched fewer files.

## Acceptance Criteria

- An explicitly created `opencode` thread can warm and send through Fusion runtime.
- Plain-text OpenCode response streams and persists.
- Passive reopen hydrates durable history correctly.
- Tool smoke either passes or reports a clear OpenCode permission blocker without production flag changes.
- Stop smoke either passes or reports a clear OpenCode process behavior blocker.
- Kimi/default behavior remains unchanged.
- No client UI or Electron packaging files are changed.
- No production `--dangerously-skip-permissions` default is introduced.

## Result Report Format

Return:

- repo root
- files changed, if any
- Fusion server URL used
- OpenCode version
- Path A result
- Path B result
- Path C result
- any repairs made
- focused test result
- full server test result
- `git diff --check` result
- whether default harness behavior changed
- blockers/risks/follow-up
