# OpenCode Slice 10 — Clean-Exit Terminal Repair

## Context

Slice 9 proved that several OpenCode model/flag combinations emit useful output
and then exit successfully without emitting `step_finish`. Fusion currently
requires OpenCode `step_finish` to translate a canonical `turn_end`, so those
runs can end as:

```text
OpenCode process exited before turn_end
```

That is wrong when the process exits code `0` after useful assistant output.
Exit code `0` is not a reasoning signal and not a timeout signal. It only means
the child process completed successfully.

This slice repairs terminal behavior only. Do not change visible thinking
defaults, picker defaults, or model/profile selection.

## Required Reading

Read these before editing:

- `/Users/rccurtrightjr./projects/fs-dev/docs/LESSONS.md`
- `/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-06-opencode-slice-9-thinking-variant-matrix-results.md`
- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/lib/harness/opencode/json-event-translator.js`
- `fusion-studio-server/test/harness/opencode/harness-send-message.test.js`
- `fusion-studio-server/test/harness/opencode/json-event-translator.test.js`

## Objective

If OpenCode exits cleanly after emitting useful translated assistant events but
never emits canonical `turn_end`, synthesize a canonical terminal `turn_end`
instead of throwing.

Keep strict errors for nonzero exits, process errors, and clean exits with no
useful assistant output.

## Current Fault

Current harness close behavior in `fusion-studio-server/lib/harness/opencode/index.js`:

```js
proc.on('close', (code, signal) => {
  parser.flush();
  if (!session.stopRequested && !sawTurnEnd) {
    failure = makeExitError(code, signal, stderr.trim());
  }
  done = true;
});
```

This treats clean exit code `0` the same as a real failure when `step_finish` is
missing.

## Required Behavior

### Synthesize on clean exit after useful output

When all of these are true:

- `session.stopRequested` is false
- process close code is `0`
- no translated canonical `turn_end` was seen
- at least one useful assistant event was translated

then append a synthetic canonical `turn_end` to the event queue.

Useful assistant events are:

- `content`
- `thinking` with non-empty text
- `tool_call`
- `tool_call_args`
- `tool_result`

Do not count `turn_begin` alone as useful output.

### Synthetic metadata

Synthetic `turn_end` should be visibly/auditably marked. Suggested shape:

```js
{
  type: 'turn_end',
  timestamp: Date.now(),
  reason: 'complete',
  fullText,
  hasToolCalls,
  _meta: {
    harnessId: 'opencode',
    provider: 'opencode',
    terminalSource: 'process_exit_missing_step_finish',
  },
}
```

Prefer deriving `fullText` and `hasToolCalls` from the translator if possible.
If the current translator does not expose that state, add a narrow method such
as `getTerminalState()` to `OpenCodeJsonEventTranslator`.

Do not reset or duplicate translator state outside the existing translator
responsibility.

### Preserve strict failures

Still throw for:

- process close code not equal to `0`
- process `error`
- clean exit with no useful assistant output
- clean exit after only `step_start`

Stop behavior remains unchanged: requested stop should end the generator without
throwing a later OpenCode missing-terminal error.

## Implementation Notes

Likely minimal changes:

1. Track whether translated output was useful while draining OpenCode events.
2. Track whether translated `turn_end` was seen.
3. On process close:
   - if stop requested: no-op
   - if code is nonzero: failure
   - if no `turn_end` and useful output exists: push synthetic `turn_end`
   - if no `turn_end` and no useful output exists: failure
4. Add translator terminal-state helper only if needed for `fullText` and
   `hasToolCalls`.

Be careful with event order. The synthetic `turn_end` should be yielded after
all useful translated events already queued from parser flush.

## Tests Required

Add focused tests in:

```text
fusion-studio-server/test/harness/opencode/harness-send-message.test.js
```

Required cases:

1. Clean exit with text and no `step_finish` yields:

   ```text
   turn_begin -> content -> turn_end
   ```

   and synthetic `turn_end._meta.terminalSource` is
   `process_exit_missing_step_finish`.

2. Clean exit with reasoning + text and no `step_finish` yields:

   ```text
   turn_begin -> thinking -> content -> turn_end
   ```

3. Clean exit with completed tool event and no `step_finish` yields tool events
   followed by synthetic `turn_end`.

4. Clean exit after only `step_start` still throws.

5. Nonzero exit after useful output still throws.

6. Existing normal `step_finish` path remains unchanged and does not produce a
   duplicate synthetic `turn_end`.

7. Stop-requested path remains unchanged.

Update the existing test named like:

```text
unexpected process exit during active send throws a useful error
```

if needed so it specifically covers nonzero exit or no-useful-output exit.

## Acceptance Checks

Run:

```bash
cd fusion-studio-server
npm test -- --runInBand test/harness/opencode/harness-send-message.test.js test/harness/opencode/json-event-translator.test.js
```

Then run bridge/applier tests to ensure synthetic `turn_end` shape stays
canonical:

```bash
cd fusion-studio-server
npm test -- --runInBand test/wire/canonical-harness-event-bridge.test.js test/wire/canonical-chat-event-applier.test.js
```

If the focused tests pass quickly, run the full server suite:

```bash
cd fusion-studio-server
npm test -- --runInBand
```

Always run:

```bash
git diff --check -- fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode docs/handoffs docs/LESSONS.md
```

If `rg` is available:

```bash
rg -n "process_exit_missing_step_finish|OpenCode process exited before turn_end|sawTurnEnd|turn_end" fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode docs/handoffs docs/LESSONS.md
```

If `rg` is unavailable, use `grep -R` and document that.

## Optional Live Smoke

If Fusion is already running and OpenCode is authenticated, run one explicit
OpenCode thread against a known missing-terminal profile, for example:

```text
opencode/mimo-v2.5-free plain
```

Send:

```text
Reply exactly: FUSION_OPENCODE_SYNTHETIC_TURN_END_OK
```

Expected:

- text appears
- turn completes
- no stale orb
- no visible harness error
- persisted assistant exchange exists

Skip this if it would require unrelated runtime or provider setup.

## Out Of Scope

Do not:

- Add `variant` support.
- Enable `thinking` by default.
- Add model profile UI.
- Change OpenCode default model.
- Make OpenCode the default harness.
- Touch Kimi.
- Touch Electron packaging.
- Add a timeout watchdog.

Timeout/hang handling is a later slice. This slice only handles clean process
exit after useful output.

## Report Back

Include:

- Files changed.
- Synthetic terminal rule implemented.
- How useful output is detected.
- Metadata shape on synthetic `turn_end`.
- Test results.
- Whether full server suite was run.
- Whether live smoke was run or skipped.
- Any known risks/follow-up.
