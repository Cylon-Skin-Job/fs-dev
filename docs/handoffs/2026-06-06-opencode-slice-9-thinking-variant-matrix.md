# OpenCode Slice 9 — Thinking / Variant Compatibility Matrix

## Context

OpenCode Slice 8 proved that visible thinking is not a single reliable switch:

- Plain JSON mode may include `tokens.reasoning` but no visible reasoning text.
- `--thinking` can expose `part.type === "reasoning"` with `part.text`.
- Some `--thinking` runs emitted reasoning/text but no terminal `step_finish`.
- Some `--thinking` runs emitted `step_finish` but empty reasoning text.

OpenCode also exposes:

```text
--variant  model variant (provider-specific reasoning effort, e.g., high, max, minimal)
--thinking show thinking blocks
```

Before changing default behavior, run a compatibility matrix across representative models and flag combinations. This is a test/probe slice. Do not implement a product decision yet.

## Required Reading

Read these before running probes:

- `/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-06-opencode-slice-8-thinking-trace-probe-results.md`
- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/lib/harness/opencode/json-event-translator.js`
- `fusion-studio-server/test/harness/opencode/harness-send-message.test.js`
- `fusion-studio-server/test/harness/opencode/json-event-translator.test.js`

## Objective

Build a raw-evidence matrix showing which OpenCode model/flag combinations:

- emit visible reasoning text
- emit normal assistant text
- emit terminal `step_finish`
- include `tokens.reasoning`
- exit cleanly
- are safe candidates for Fusion visible thinking

This should answer whether the bad UX is a model/provider endpoint quirk, an OpenCode `--thinking`/`--variant` behavior, or a Fusion harness terminal-event gap.

## Scope

Do:

1. Run raw `opencode run --format json` probes in an isolated temp directory.
2. Capture stdout NDJSON and stderr for each matrix cell.
3. Classify event sequences and terminal behavior.
4. Write a results report under `docs/handoffs/`.
5. Recommend safe defaults and known-bad/known-good configurations.

Do not:

- Do not make OpenCode the default.
- Do not change production harness behavior unless a tiny, clearly necessary test harness helper is needed.
- Do not enable `--thinking` by default.
- Do not fabricate thought traces.
- Do not use `--dangerously-skip-permissions`.
- Do not touch Electron packaging files.
- Do not touch Kimi behavior.
- Do not run write-capable prompts against the repo.

## Models To Test

Use these from the current local `opencode models` output:

```text
opencode/mimo-v2.5-free
kimi-for-coding/kimi-k2-thinking
google/gemini-2.5-flash
google/gemini-2.5-pro
openai/gpt-5.5-fast
openai/gpt-5.5
```

If one of these fails because of provider auth/model availability, record the failure and continue.

If runtime cost is a concern, test this reduced set first:

```text
opencode/mimo-v2.5-free
kimi-for-coding/kimi-k2-thinking
google/gemini-2.5-flash
openai/gpt-5.5-fast
```

## Flag Matrix

For each model, test these command variants:

1. plain JSON
2. `--thinking`
3. `--variant high`
4. `--thinking --variant high`

If a provider rejects `high`, retry with one of:

```text
max
medium
minimal
```

Record the rejection and the retry.

## Probe Prompt

Use a prompt that encourages internal reasoning without asking for hidden chain-of-thought:

```text
Solve this arithmetic puzzle. Reply with only the final answer: A box has 17 red marbles and 8 blue marbles. Sam removes 6 red marbles and adds 9 blue marbles. How many marbles are in the box now?
```

Expected final answer is `28`.

Do not ask the model to reveal chain-of-thought. We only care whether OpenCode emits explicit reasoning events when it is configured to show them.

## Suggested Probe Script

You may write a temporary script under `/private/tmp/opencode-thinking-matrix/` to avoid manual command repetition. Do not commit it.

The script should:

- create one NDJSON stdout file per matrix cell
- create one stderr file per matrix cell
- print a concise summary row for each cell
- parse stdout lines as JSON
- count:
  - top-level event types
  - `part.type` values
  - non-empty reasoning text events
  - normal text events
  - `step_finish` events
  - `tokens.reasoning`
  - process exit code

Example output table:

```text
model                         flags                   exit  events                         reasoningText  text  stepFinish  tokensReasoning
opencode/mimo-v2.5-free       plain                   0     step_start,text                no             yes   no          no
opencode/mimo-v2.5-free       --thinking              0     step_start,reasoning,text      yes            yes   no          no
google/gemini-2.5-flash       --thinking --variant high 0   step_start,reasoning,text,step_finish yes yes yes  yes
```

## Classification Rules

Mark each cell as one of:

- `GOOD_VISIBLE_THINKING`: non-empty reasoning text, final text, terminal `step_finish`, clean exit.
- `NO_VISIBLE_THINKING`: final text, terminal `step_finish`, clean exit, but no non-empty reasoning text.
- `BAD_MISSING_TERMINAL`: final text or reasoning text appears, process exits cleanly, but no `step_finish`.
- `BAD_EMPTY_THINKING`: a reasoning event appears but text is empty.
- `BAD_PROVIDER_ERROR`: provider/model/config fails before useful output.
- `BAD_HANG`: process does not exit within a reasonable timeout.

Use a timeout, for example 90 seconds per cell. If you use a different timeout, document it.

## Optional Harness Gap Check

If any cell has:

- clean process exit
- useful assistant text
- no `step_finish`

then document whether Fusion's current OpenCode harness would throw:

```text
OpenCode process exited before turn_end
```

Do not patch this in this slice unless explicitly asked. The likely next slice is a terminal-repair slice that synthesizes `turn_end` on clean exit after useful events.

## Validation

Run:

```bash
cd fusion-studio-server
npm test -- --runInBand test/harness/opencode/json-event-translator.test.js test/harness/opencode/harness-send-message.test.js
```

If you change production code, also run:

```bash
cd fusion-studio-server
npm test -- --runInBand test/wire/canonical-harness-event-bridge.test.js test/wire/canonical-chat-event-applier.test.js
```

Always run:

```bash
git diff --check -- fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode docs/handoffs
```

If `rg` is available, use it for searches. If unavailable, use `grep -R` and document that.

## Results Report

Create:

```text
docs/handoffs/2026-06-06-opencode-slice-9-thinking-variant-matrix-results.md
```

Include:

- OpenCode version.
- Model list tested.
- Full matrix table.
- Raw event-type sequences per cell.
- Whether non-empty reasoning text appears.
- Whether terminal `step_finish` appears.
- Whether `tokens.reasoning` appears.
- Which combos are safe for visible thinking.
- Which combos are safe for default no-thinking.
- Which combos would currently cause Fusion to show a stale orb or harness error.
- Recommendation for next implementation slice.

## Expected Next Decisions

This slice should provide evidence for one or more follow-up decisions:

1. Add `variant` support to `OpenCodeHarness.buildRunArgs()`.
2. Store per-thread or per-turn OpenCode model/variant/thinking config.
3. Add a process-exit terminal repair when OpenCode emits useful text but no `step_finish`.
4. Mark some OpenCode model profiles as `visibleThinking: false`.
5. Only enable visible thinking for known-good model/variant combinations.
