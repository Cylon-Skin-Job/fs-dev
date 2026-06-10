# OpenCode Slice 5: Per-Thread Session Continuity

## Objective

Fix the blocker found in the default-readiness review: OpenCode prompts must preserve conversation context across follow-up prompts in the same Fusion thread.

Do not make OpenCode default in this slice.

## Review Finding Being Addressed

High severity:

```text
fusion-studio-server/lib/harness/opencode/index.js
OpenCode prompts are not bound to thread history or an OpenCode session.
sendMessage(message, options = {}) ignores options.history, and buildRunArgs()
only passes the current prompt. The spawned command does not use OpenCode's
--session or --continue flags.
```

Default switch remains blocked until this is fixed and tested.

## Required Reading

- `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-05-opencode-slice-4-default-readiness-review.md`
- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/lib/harness/opencode/json-event-translator.js`
- `fusion-studio-server/lib/harness/opencode/json-line-parser.js`
- `fusion-studio-server/test/harness/opencode/harness-send-message.test.js`

## Current OpenCode CLI Facts

Local `opencode run --help` confirms:

```text
opencode run [message..]
--session    session id to continue
--continue   continue the last session
--fork       fork the session before continuing (requires --continue or --session)
--format     default or json
--dir        directory to run in
--model      model to use
--pure       run without external plugins
```

Do not use `--continue` for Fusion threads. It is global/last-session oriented and can cross-contaminate threads.

Prefer `--session <id>` if it works.

## Preflight Probe

Before patching, determine whether OpenCode accepts a caller-provided session id.

Use a temporary directory:

```bash
mkdir -p /private/tmp/opencode-session-probe
```

Probe A: explicit caller session id, first turn:

```bash
opencode -m opencode/mimo-v2.5-free --pure run --format json --dir /private/tmp/opencode-session-probe --session fusion-opencode-session-probe "Remember the codeword FUSION_SESSION_ALPHA. Reply exactly: REMEMBERED"
```

Probe B: same explicit session id, follow-up:

```bash
opencode -m opencode/mimo-v2.5-free --pure run --format json --dir /private/tmp/opencode-session-probe --session fusion-opencode-session-probe "What codeword did I tell you? Reply exactly with the codeword."
```

Expected:

- If Probe B returns `FUSION_SESSION_ALPHA`, Fusion can use a deterministic OpenCode session id derived from `threadId`.
- If Probe A fails or OpenCode rewrites the session id, capture OpenCode's emitted `sessionID` from JSON output and use that for later prompts.

Do not use `--dangerously-skip-permissions` for this probe.

## Implementation Direction

Add explicit OpenCode session continuity to `OpenCodeHarness`.

### Preferred Path

If OpenCode accepts caller-provided session ids:

- Add `session.openCodeSessionId`.
- Initialize it deterministically from the Fusion `threadId`.
- Pass `--session <session.openCodeSessionId>` on every `opencode run`.
- Keep the session id stable for the lifetime of the Fusion harness session.

Consider prefixing to avoid collisions with OpenCode-generated ids:

```js
const openCodeSessionId = `fusion-${threadId}`;
```

Only sanitize if OpenCode rejects characters from Fusion thread ids. Timestamp thread ids contain digits, hyphens, and `T`; those are likely safe, but verify with the preflight probe.

### Fallback Path

If OpenCode requires its own generated session id:

- Capture the first `event.sessionID` seen from JSON output.
- Store it on the Fusion harness session as `session.openCodeSessionId`.
- On subsequent sends, pass `--session <capturedSessionId>`.
- If a prompt completes without any OpenCode `sessionID`, throw or surface a clear harness error before claiming default readiness.

### Avoid

- Do not use `--continue`.
- Do not inject full thread history into the user prompt unless `--session` is proven unusable.
- Do not persist OpenCode session ids to SQLite in this slice unless absolutely necessary. Fusion runtime currently keeps harness sessions warm; durable cross-process continuity can be a later slice if needed.

## Suggested Code Changes

Likely files:

- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/test/harness/opencode/harness-send-message.test.js`

Potential helper extraction is acceptable only if it keeps one job per file. Do not create abstractions for one-off logic.

Add or update tests for:

1. First prompt includes `--session <stable id>`.
2. Follow-up prompt in the same Fusion session uses the same `--session`.
3. Two Fusion thread sessions use different OpenCode session ids.
4. `--continue` is never used.
5. Captured JSON `sessionID` is stored if using fallback path.
6. If using fallback path, second prompt uses captured `sessionID`.
7. Existing `config.model`, `config.pure`, `config.cliPath`, and `--dir` behavior remains intact.
8. Stop/exit behavior remains intact.

## Live Runtime Smoke

After tests pass, rerun a narrow live smoke through Fusion using an opt-in OpenCode thread.

Prompt 1:

```text
Remember the codeword FUSION_THREAD_MEMORY_OK. Reply exactly: MEMORY_STORED
```

Prompt 2 in the same Fusion thread:

```text
What codeword did I tell you? Reply exactly with the codeword.
```

Acceptance:

- Prompt 1 returns `MEMORY_STORED`.
- Prompt 2 returns `FUSION_THREAD_MEMORY_OK`.
- Both prompts persist in the same Fusion thread.
- Reopening the thread hydrates both exchanges.

If live smoke cannot run because Fusion/Electron/server startup is blocked, report that separately and do not patch unrelated startup/packaging files.

## Validation

From repo root:

```bash
cd fusion-studio-server
npm test -- --runInBand lib/harness/opencode test/harness/opencode
npm test -- --runInBand
```

Whitespace:

```bash
git diff --check -- fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode
```

Search checks:

```bash
grep -R -- "--continue" -n fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode
grep -R -- "--session" -n fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode
grep -R "dangerously-skip-permissions" -n fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode
```

Expected:

- Production code should use `--session`.
- Production code should not use `--continue`.
- Production code should not use `--dangerously-skip-permissions`.

## Acceptance Criteria

- OpenCode follow-up prompts in the same Fusion harness session preserve conversation context.
- Session continuity is explicit through `--session`, not implicit through global last-session state.
- OpenCode remains opt-in.
- Kimi/default behavior remains unchanged.
- No client UI changes.
- No Electron packaging changes.
- No ACP/server mode implementation.
- Focused and full server tests pass, or unrelated failures are documented with evidence.
- Live memory smoke passes, or an environment blocker is clearly documented.

## Result Report Format

Return:

- files changed
- preflight probe result
- selected strategy: deterministic session id or captured OpenCode session id
- command shape after patch
- focused test result
- full server test result
- `git diff --check` result
- live memory smoke result
- whether default harness behavior changed
- blockers/risks/follow-up
