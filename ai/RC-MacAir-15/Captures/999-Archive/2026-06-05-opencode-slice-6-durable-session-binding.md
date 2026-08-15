# OpenCode Slice 6: Durable Session Binding

## Objective

Persist the OpenCode `sessionID` captured in Slice 5 so follow-up prompts keep conversation context after a Fusion runtime goes cold, a wire is recreated, or the server restarts.

Do not make OpenCode default in this slice.

## Current State

Slice 5 implemented in-memory continuity:

- First prompt starts `opencode run --format json ... <prompt>`.
- The harness captures OpenCode's generated `sessionID`.
- Follow-up prompts in the same warm Fusion harness session pass:

```text
--session <capturedSessionId>
```

Live smoke passed while the harness session stayed warm.

Remaining blocker:

```text
Continuity is in-memory only. If the server restarts, thread goes cold, or the
harness session is recreated, Fusion loses the captured OpenCode sessionID.
```

## Required Reading

- `ai/<machine>/Wiki/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-05-opencode-slice-5-session-continuity.md`
- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/test/harness/opencode/harness-send-message.test.js`
- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/thread/ThreadIndex.js`
- `fusion-studio-server/lib/thread/ThreadManager.js`
- `fusion-studio-server/lib/thread/thread-runtime-manager.js`

## Persistence Surface

Use the existing `threads.harness_config` column.

`ThreadIndex.create()` already stores `options.harnessConfig` as JSON, and `_toEntry()` already parses it into `entry.harnessConfig`.

Do not add a new migration for this slice unless there is no practical alternative.

Recommended config shape:

```json
{
  "opencodeSessionId": "ses_..."
}
```

Keep provider-specific state under a provider-specific key if you prefer:

```json
{
  "opencode": {
    "sessionId": "ses_..."
  }
}
```

Pick one shape and use it consistently. Prefer the smaller shape unless existing local conventions suggest otherwise.

## Implementation Direction

### 1. Add a small thread metadata update API

Likely in `fusion-studio-server/lib/thread/ThreadIndex.js`:

- Add support for `updates.harnessConfig` in `update(threadId, updates)`, serialized to `harness_config`.

Example behavior:

```js
if (updates.harnessConfig !== undefined) {
  dbUpdates.harness_config = updates.harnessConfig
    ? JSON.stringify(updates.harnessConfig)
    : null;
}
```

Likely in `fusion-studio-server/lib/thread/ThreadManager.js`:

- Add a narrow method such as:

```js
async updateHarnessConfig(threadId, patch) {}
```

It should:

1. Load the existing thread entry.
2. Merge existing `entry.harnessConfig || {}` with the patch.
3. Persist via `this.index.update(threadId, { harnessConfig: merged })`.

Do not create a broad generic metadata system.

### 2. Pass thread-specific harness config into the harness session

`fusion-studio-server/lib/harness/compat.js` currently fetches only `harness_id`:

```js
const row = await db('threads').where('thread_id', threadId).select('harness_id').first();
```

Change this to fetch both `harness_id` and `harness_config`.

Use the parsed config when starting the harness session. Options:

- Pass a fourth argument to `harness.startThread(threadId, projectRoot, scopeContext, threadConfig)`.
- Or include it in `scopeContext.harnessConfig`.

Prefer the explicit fourth argument if it keeps the call clear. Update only OpenCode/Kimi-compatible signatures as needed; JavaScript ignores extra args for harnesses that do not use it.

Do not call `harness.initialize(threadConfig)` for per-thread state. `initialize()` is global harness config; OpenCode session ids are per thread.

### 3. Let OpenCodeHarness receive and persist session ids

In `fusion-studio-server/lib/harness/opencode/index.js`:

- Initialize `session.openCodeSessionId` from thread config if present.
- Use `--session <session.openCodeSessionId>` on the first prompt after cold start if it exists.
- When a JSON event includes `sessionID` and no stored id exists, capture it.
- Persist the captured id through a callback or helper supplied by compat/startThread.

Avoid direct DB access inside the OpenCode harness if a clean callback is easy. A good shape:

```js
await harness.startThread(threadId, projectRoot, scopeContext, {
  harnessConfig,
  updateHarnessConfig: async (patch) => { ... }
});
```

Then OpenCode can call:

```js
await updateHarnessConfig({ opencodeSessionId: capturedId });
```

Only persist once per session id. Do not write to SQLite on every event.

### 4. Keep in-memory behavior

The warm-session behavior from Slice 5 should still work. Durable storage adds cold-start continuity; it should not make every prompt read from SQLite.

## Tests Required

Add/update focused tests for:

1. `ThreadIndex.update()` can persist `harnessConfig`.
2. `ThreadManager.updateHarnessConfig()` merges existing config instead of replacing unrelated keys.
3. `compat.spawnThreadWire()` passes parsed `harness_config` to the harness session.
4. OpenCode session initializes from stored `opencodeSessionId` and includes `--session` on first send after start.
5. OpenCode captures first emitted `sessionID` and calls the persistence callback once.
6. OpenCode does not repeatedly persist the same session id on later events.
7. OpenCode follow-up still uses the captured/stored `--session`.
8. Kimi/default behavior remains unchanged.

Use mocked DB/spawn where existing tests do. Keep tests focused; do not require live OpenCode for unit tests.

## Live Smoke

After tests pass, run a cold-continuity smoke with an opt-in OpenCode thread.

Prompt 1:

```text
Remember the codeword FUSION_DURABLE_SESSION_OK. Reply exactly: DURABLE_MEMORY_STORED
```

Then force the OpenCode/Fusion harness session to be recreated. Acceptable options:

- Restart Fusion server, if restart is working.
- Or explicitly stop/cool the runtime/wire for that thread using existing runtime/session APIs.
- Or close the active wire and ensure a fresh `spawnThreadWire()` occurs.

Prompt 2 in the same Fusion thread after recreation:

```text
What codeword did I tell you? Reply exactly with the codeword.
```

Acceptance:

- Prompt 1 returns `DURABLE_MEMORY_STORED`.
- Prompt 2 returns `FUSION_DURABLE_SESSION_OK`.
- Logs or inspection show the second prompt used `--session <stored OpenCode sessionID>`.
- Reopening the thread hydrates both exchanges.

If a restart is blocked by Electron packaging, do not repair packaging. Use a direct server restart or documented runtime cool/recreate path.

## Validation

From repo root:

```bash
cd fusion-studio-server
npm test -- --runInBand lib/harness/opencode test/harness/opencode test/thread
npm test -- --runInBand
```

Use narrower test paths if `test/thread` is too broad, but include the new ThreadIndex/ThreadManager/compat tests.

Whitespace:

```bash
git diff --check -- fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode fusion-studio-server/lib/harness/compat.js fusion-studio-server/lib/thread fusion-studio-server/test/thread
```

Search checks:

```bash
grep -R "opencodeSessionId\\|--session" -n fusion-studio-server/lib/harness/opencode fusion-studio-server/lib/harness/compat.js fusion-studio-server/lib/thread fusion-studio-server/test
grep -R -- "--continue" -n fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode
grep -R "dangerously-skip-permissions" -n fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode
```

Expected:

- `--session` is used by OpenCode.
- `--continue` is not used in production code.
- `dangerously-skip-permissions` is not introduced in production code.

## Hard Boundaries

Do not make OpenCode default.

Do not implement OpenCode ACP/server mode.

Do not add client UI.

Do not touch Electron packaging files.

Do not restore Slack runtime.

Do not add a new migration unless you can prove `harness_config` cannot safely store this value.

## Acceptance Criteria

- OpenCode session id is persisted to `threads.harness_config`.
- A recreated OpenCode harness session loads the stored session id.
- Follow-up prompts after recreation use `--session <stored id>` and retain memory.
- Warm in-memory continuity still works.
- Kimi/default behavior is unchanged.
- No production `--continue`.
- No production `--dangerously-skip-permissions`.
- Focused tests and full server tests pass, or unrelated failures are documented with evidence.
- Live cold-continuity smoke passes, or an environment blocker is clearly documented.

## Result Report Format

Return:

- files changed
- persistence shape chosen
- command shape after patch
- tests added/updated
- focused test result
- full server test result
- `git diff --check` result
- live cold-continuity smoke result
- whether default harness behavior changed
- risks/follow-up
