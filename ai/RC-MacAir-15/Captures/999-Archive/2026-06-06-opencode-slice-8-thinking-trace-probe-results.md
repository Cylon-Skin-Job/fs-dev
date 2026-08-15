# OpenCode Slice 8 - Thinking Trace Probe Results

## Summary

OpenCode JSON run mode can expose a real reasoning text event, but only when `--thinking` is used. Plain JSON mode did not expose visible reasoning text in the tested runs; it only exposed `tokens.reasoning` on `step_finish` for the default configured model.

The existing Fusion translator already maps the observed reasoning shape to canonical `thinking` via `part.type === "reasoning"` and `part.text`. No fabricated thinking was added from token counts.

## Version

```text
opencode --version
1.15.13
```

`opencode run --help` includes:

```text
--thinking  show thinking blocks
```

## Commands Tested

Default configured model, plain JSON:

```bash
opencode run --format json --dir /private/tmp/opencode-thinking-probe \
  "Solve this small puzzle and reply with only the final answer: If Alice has 3 apples, buys 4, and gives away 2, how many apples remain?"
```

Explicit Mimo model, plain JSON:

```bash
opencode -m opencode/mimo-v2.5-free --pure run --format json \
  --dir /private/tmp/opencode-thinking-probe \
  "Solve this small puzzle and reply with only the final answer: If Alice has 3 apples, buys 4, and gives away 2, how many apples remain?"
```

Explicit Mimo model with visible thinking enabled:

```bash
opencode -m opencode/mimo-v2.5-free --pure run --format json --thinking \
  --dir /private/tmp/opencode-thinking-probe \
  "Solve this small puzzle and reply with only the final answer: If Alice has 3 apples, buys 4, and gives away 2, how many apples remain?"
```

Default configured model with visible thinking enabled:

```bash
opencode run --format json --thinking --dir /private/tmp/opencode-thinking-probe \
  "Solve this small puzzle and reply with only the final answer: If Alice has 3 apples, buys 4, and gives away 2, how many apples remain?"
```

## Event Shapes Observed

Default configured model, plain JSON:

```text
step_start -> text -> step_finish
```

The `step_finish` event included `tokens.reasoning`, but there was no text-bearing reasoning event.

Explicit Mimo model, plain JSON:

```text
step_start -> text
```

No reasoning event and no `tokens.reasoning` event were observed in this run.

Explicit Mimo model with `--thinking`:

```text
step_start -> reasoning -> text
```

The `reasoning` event included real visible text in `part.text`, for example:

```json
{"type":"reasoning","part":{"type":"reasoning","text":"The user wants me to solve a simple math puzzle..."}}
```

A repeated explicit Mimo `--thinking` probe again emitted `reasoning -> text`, but did not emit `step_finish`.

Default configured model with `--thinking`:

```text
step_start -> reasoning -> text -> step_finish
```

The reasoning event existed, but `part.text` was empty. `step_finish.tokens.reasoning` was present.

## Decision

Fusion should not render a fabricated thought trace from `tokens.reasoning`.

The translator already supports the observed real reasoning text shape:

```js
if (part.type === 'reasoning') {
  return this.translateReasoning(part, timestamp);
}
```

The harness now supports an explicit `thinking: true` config option that adds `--thinking` to OpenCode JSON runs. It is not enabled by default because the tested model paths were inconsistent:

- default model with `--thinking` emitted an empty reasoning event
- explicit Mimo with `--thinking` emitted non-empty reasoning text but did not emit `step_finish`

## Recommendation

Treat current default OpenCode JSON mode as "no visible thought trace available" unless the selected OpenCode configuration explicitly enables `--thinking` and is validated to still emit terminal `step_finish` events.

Do not synthesize thinking blocks from reasoning token counts.
