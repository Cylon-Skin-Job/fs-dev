# OpenCode Slice 9 - Thinking / Variant Compatibility Matrix Results

## Summary

OpenCode visible thinking is model/config specific. In this run, only `openai/gpt-5.5` with `--thinking` emitted non-empty reasoning text, normal assistant text, terminal `step_finish`, `tokens.reasoning`, and a clean exit.

Several configurations emitted the correct final text but no terminal `step_finish`. Those are not safe for Fusion's current OpenCode harness because it currently treats clean process exit before translated `turn_end` as an error.

## OpenCode Version

```text
opencode --version
1.15.13
```

## Probe Setup

Prompt:

```text
Solve this arithmetic puzzle. Reply with only the final answer: A box has 17 red marbles and 8 blue marbles. Sam removes 6 red marbles and adds 9 blue marbles. How many marbles are in the box now?
```

Expected answer: `28`.

Commands were run in an isolated directory:

```text
/private/tmp/opencode-thinking-matrix
```

Raw evidence was captured under:

```text
/private/tmp/opencode-thinking-matrix/runs/*.stdout.ndjson
/private/tmp/opencode-thinking-matrix/runs/*.stderr.txt
/private/tmp/opencode-thinking-matrix/summary.json
```

Timeout: 90 seconds per matrix cell.

## Models Tested

All requested models were present in `opencode models` and were tested:

```text
opencode/mimo-v2.5-free
kimi-for-coding/kimi-k2-thinking
google/gemini-2.5-flash
google/gemini-2.5-pro
openai/gpt-5.5-fast
openai/gpt-5.5
```

## Full Matrix

| Model | Flags | Exit | Classification | Reasoning Text | Text | Step Finish | tokens.reasoning | Final Text |
|---|---|---:|---|---|---|---|---|---|
| `opencode/mimo-v2.5-free` | plain | 0 | `BAD_MISSING_TERMINAL` | no | yes | no | no | `28` |
| `opencode/mimo-v2.5-free` | `--thinking` | 0 | `BAD_MISSING_TERMINAL` | yes | yes | no | no | `28` |
| `opencode/mimo-v2.5-free` | `--variant high` | 0 | `BAD_MISSING_TERMINAL` | no | yes | no | no | `28` |
| `opencode/mimo-v2.5-free` | `--thinking --variant high` | 0 | `BAD_MISSING_TERMINAL` | yes | yes | no | no | `28` |
| `kimi-for-coding/kimi-k2-thinking` | plain | 0 | `NO_VISIBLE_THINKING` | no | yes | yes | yes | `28` |
| `kimi-for-coding/kimi-k2-thinking` | `--thinking` | 0 | `NO_VISIBLE_THINKING` | no | yes | yes | yes | `28` |
| `kimi-for-coding/kimi-k2-thinking` | `--variant high` | 0 | `NO_VISIBLE_THINKING` | no | yes | yes | yes | `28` |
| `kimi-for-coding/kimi-k2-thinking` | `--thinking --variant high` | 0 | `BAD_PROVIDER_ERROR` | no | no | no | no | empty |
| `google/gemini-2.5-flash` | plain | 0 | `BAD_MISSING_TERMINAL` | no | yes | no | no | `28` |
| `google/gemini-2.5-flash` | `--thinking` | 0 | `BAD_MISSING_TERMINAL` | yes | yes | no | no | `28` |
| `google/gemini-2.5-flash` | `--variant high` | 0 | `BAD_MISSING_TERMINAL` | no | yes | no | no | `28` |
| `google/gemini-2.5-flash` | `--thinking --variant high` | 0 | `BAD_MISSING_TERMINAL` | yes | yes | no | no | `28` |
| `google/gemini-2.5-pro` | plain | timeout | `BAD_HANG` | no | no | no | no | empty |
| `google/gemini-2.5-pro` | `--thinking` | timeout | `BAD_HANG` | no | no | no | no | empty |
| `google/gemini-2.5-pro` | `--variant high` | timeout | `BAD_HANG` | no | no | no | no | empty |
| `google/gemini-2.5-pro` | `--thinking --variant high` | timeout | `BAD_HANG` | no | no | no | no | empty |
| `openai/gpt-5.5-fast` | plain | 0 | `NO_VISIBLE_THINKING` | no | yes | yes | yes | `28` |
| `openai/gpt-5.5-fast` | `--thinking` | 0 | `BAD_EMPTY_THINKING` | no | yes | yes | yes | `28` |
| `openai/gpt-5.5-fast` | `--variant high` | 0 | `NO_VISIBLE_THINKING` | no | yes | yes | yes | `28` |
| `openai/gpt-5.5-fast` | `--thinking --variant high` | 0 | `BAD_EMPTY_THINKING` | no | yes | yes | yes | `28` |
| `openai/gpt-5.5` | plain | 0 | `NO_VISIBLE_THINKING` | no | yes | yes | yes | `28` |
| `openai/gpt-5.5` | `--thinking` | 0 | `GOOD_VISIBLE_THINKING` | yes | yes | yes | yes | `28` |
| `openai/gpt-5.5` | `--variant high` | 0 | `NO_VISIBLE_THINKING` | no | yes | yes | yes | `28` |
| `openai/gpt-5.5` | `--thinking --variant high` | 0 | `GOOD_VISIBLE_THINKING` | yes | yes | yes | yes | `28` |

## Raw Event Sequences

| Model | Flags | Sequence |
|---|---|---|
| `opencode/mimo-v2.5-free` | plain | `step_start -> text` |
| `opencode/mimo-v2.5-free` | `--thinking` | `step_start -> reasoning -> text` |
| `opencode/mimo-v2.5-free` | `--variant high` | `step_start -> text` |
| `opencode/mimo-v2.5-free` | `--thinking --variant high` | `step_start -> reasoning -> text` |
| `kimi-for-coding/kimi-k2-thinking` | plain | `step_start -> text -> step_finish` |
| `kimi-for-coding/kimi-k2-thinking` | `--thinking` | `step_start -> text -> step_finish` |
| `kimi-for-coding/kimi-k2-thinking` | `--variant high` | `step_start -> text -> step_finish` |
| `kimi-for-coding/kimi-k2-thinking` | `--thinking --variant high` | `step_start` |
| `google/gemini-2.5-flash` | plain | `step_start -> text` |
| `google/gemini-2.5-flash` | `--thinking` | `step_start -> reasoning -> text` |
| `google/gemini-2.5-flash` | `--variant high` | `step_start -> text` |
| `google/gemini-2.5-flash` | `--thinking --variant high` | `step_start -> reasoning -> text` |
| `google/gemini-2.5-pro` | plain | none before timeout |
| `google/gemini-2.5-pro` | `--thinking` | none before timeout |
| `google/gemini-2.5-pro` | `--variant high` | none before timeout |
| `google/gemini-2.5-pro` | `--thinking --variant high` | none before timeout |
| `openai/gpt-5.5-fast` | plain | `step_start -> text -> step_finish` |
| `openai/gpt-5.5-fast` | `--thinking` | `step_start -> reasoning -> text -> step_finish` |
| `openai/gpt-5.5-fast` | `--variant high` | `step_start -> text -> step_finish` |
| `openai/gpt-5.5-fast` | `--thinking --variant high` | `step_start -> reasoning -> text -> step_finish` |
| `openai/gpt-5.5` | plain | `step_start -> text -> step_finish` |
| `openai/gpt-5.5` | `--thinking` | `step_start -> reasoning -> text -> step_finish` |
| `openai/gpt-5.5` | `--variant high` | `step_start -> text -> step_finish` |
| `openai/gpt-5.5` | `--thinking --variant high` | `step_start -> reasoning -> text -> step_finish` |

## Notable Raw Shapes

`openai/gpt-5.5 --thinking` emitted real visible reasoning text:

```json
{"type":"reasoning","part":{"type":"reasoning","text":"**Calculating total**\n\nI need to compute the final total by starting with 25, then removing 6, and adding 9..."}}
```

`openai/gpt-5.5-fast --thinking` emitted a reasoning event with empty text while still reporting reasoning tokens:

```json
{"type":"reasoning","part":{"type":"reasoning","text":"","metadata":{"openai":{"reasoningEncryptedContent":"..."}}}}
```

`opencode/mimo-v2.5-free --thinking` and `google/gemini-2.5-flash --thinking` emitted non-empty reasoning text and final text, but did not emit `step_finish`.

## Safe Candidates

Safe for Fusion visible thinking in this run:

| Model | Flags | Reason |
|---|---|---|
| `openai/gpt-5.5` | `--thinking` | Non-empty reasoning, final text, terminal `step_finish`, clean exit |
| `openai/gpt-5.5` | `--thinking --variant high` | Non-empty reasoning, final text, terminal `step_finish`, clean exit |

Safe for default no-thinking mode in this run:

| Model | Flags | Reason |
|---|---|---|
| `kimi-for-coding/kimi-k2-thinking` | plain | Final text, terminal `step_finish`, clean exit, no visible reasoning |
| `kimi-for-coding/kimi-k2-thinking` | `--thinking` | Final text, terminal `step_finish`, clean exit, no visible reasoning |
| `kimi-for-coding/kimi-k2-thinking` | `--variant high` | Final text, terminal `step_finish`, clean exit, no visible reasoning |
| `openai/gpt-5.5-fast` | plain | Final text, terminal `step_finish`, clean exit, no visible reasoning |
| `openai/gpt-5.5-fast` | `--variant high` | Final text, terminal `step_finish`, clean exit, no visible reasoning |
| `openai/gpt-5.5` | plain | Final text, terminal `step_finish`, clean exit, no visible reasoning |
| `openai/gpt-5.5` | `--variant high` | Final text, terminal `step_finish`, clean exit, no visible reasoning |

Known-bad or unsafe in this run:

| Configuration Family | Reason |
|---|---|
| `opencode/mimo-v2.5-free` all tested flags | Useful text but no terminal `step_finish` |
| `google/gemini-2.5-flash` all tested flags | Useful text but no terminal `step_finish` |
| `google/gemini-2.5-pro` all tested flags | Timed out after 90 seconds with no useful stdout events |
| `openai/gpt-5.5-fast --thinking*` | Reasoning event text was empty despite `tokens.reasoning` |
| `kimi-for-coding/kimi-k2-thinking --thinking --variant high` | Clean exit after only `step_start`, no text, no terminal event |

## Fusion Harness Impact

Current `fusion-studio-server/lib/harness/opencode/index.js` only marks an OpenCode turn complete after the translator emits canonical `turn_end`, which currently requires an OpenCode `step_finish` event.

These cells would currently surface useful assistant text and then throw `OpenCode process exited before turn_end` because they exit cleanly without `step_finish`:

```text
opencode/mimo-v2.5-free plain
opencode/mimo-v2.5-free --thinking
opencode/mimo-v2.5-free --variant high
opencode/mimo-v2.5-free --thinking --variant high
google/gemini-2.5-flash plain
google/gemini-2.5-flash --thinking
google/gemini-2.5-flash --variant high
google/gemini-2.5-flash --thinking --variant high
```

Those configurations are likely to cause the stale-orb/harness-error UX until a terminal-repair slice synthesizes turn completion on clean process exit after useful content.

## Recommendations

1. Do not enable `--thinking` by default.
2. Do not fabricate visible thinking from `tokens.reasoning`.
3. Treat visible thinking as an allowlisted capability, not a generic OpenCode flag.
4. Add `variant` support only as a separate explicit config option; `--variant high` did not make non-thinking cells visibly reason by itself.
5. Prioritize a terminal-repair slice for clean exits after useful content without `step_finish` before considering Mimo or Gemini Flash as usable OpenCode profiles.
6. If adding visible-thinking profiles now, only allow `openai/gpt-5.5` with `thinking: true` based on this matrix.

## Suggested Next Slice

Implement a small OpenCode terminal-repair slice:

```text
If OpenCode exits code 0, no stop was requested, no translated turn_end was seen, and at least one useful content/thinking/tool event was translated, emit a synthetic terminal turn_end/status marker instead of throwing.
```

That should be tested against the existing `BAD_MISSING_TERMINAL` shapes before any default behavior changes.
