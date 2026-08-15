# OpenCode Slice 8 — Thinking Trace Probe

## Context

OpenCode is now selectable from the New Chat picker and basic text/tool streaming works. The remaining visible difference from Kimi is that OpenCode turns are not showing a thought trace in Fusion.

Fusion already has a canonical `thinking` event path:

```text
harness event -> canonical thinking -> canonical-harness-event-bridge -> canonical-chat-event-applier -> chat:thinking -> websocket -> frontend render
```

The current OpenCode translator maps `part.type === "reasoning"` to canonical `thinking`, but prior live probes did not show reasoning events in `opencode run --format json` stdout. Those probes did show `step_finish.tokens.reasoning`, which means OpenCode/model may report hidden reasoning token usage without exposing reasoning text.

This slice is a probe/repair slice. Do not fake a thought trace from token counts.

## Required Reading

Read these before editing:

- `/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md`
- `fusion-studio-server/lib/harness/opencode/json-event-translator.js`
- `fusion-studio-server/test/harness/opencode/json-event-translator.test.js`
- `fusion-studio-server/lib/harness/opencode/index.js`
- `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js`
- `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`
- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
- `docs/handoffs/2026-06-05-opencode-slice-1-json-run-translator-preflight.md`

## Objective

Determine whether OpenCode's JSON run mode exposes any reasoning/thinking text event that Fusion should translate into canonical `thinking`.

If yes, update the OpenCode translator and tests.

If no, document that OpenCode currently exposes reasoning token counts only, not a visible thought trace, for the tested mode/model.

## Current Evidence

Current translator behavior:

```js
if (part.type === 'reasoning') {
  return this.translateReasoning(part, timestamp);
}
```

Prior live `opencode run --format json` output showed:

```json
{"type":"step_finish","part":{"type":"step-finish","tokens":{"reasoning":32}}}
```

but did not show a separate `reasoning`/`thinking` text event.

## Scope

Do:

1. Run focused local OpenCode JSON probes and capture raw NDJSON.
2. Inspect every event shape in the captured NDJSON.
3. Search for fields/types that could carry reasoning text:
   - `type: "reasoning"`
   - `part.type: "reasoning"`
   - `type: "thinking"`
   - `part.type: "thinking"`
   - `summary`
   - `thought`
   - `reasoningText`
   - any non-empty text-bearing field outside normal assistant `text`
4. If a real reasoning text event exists, add translator support and tests.
5. If no reasoning text event exists, write a results report explaining that OpenCode did not expose a thought trace in the tested path.

Do not:

- Do not fabricate `thinking` from `tokens.reasoning`.
- Do not ask the model to print hidden chain-of-thought as normal assistant content.
- Do not make OpenCode the default.
- Do not change picker catalogs.
- Do not change Kimi behavior.
- Do not touch Electron packaging files.
- Do not add provider/model selector UI.
- Do not use `--dangerously-skip-permissions` for this slice.

## Probe Commands

Use an isolated temp directory:

```bash
mkdir -p /private/tmp/opencode-thinking-probe
```

Check version/help:

```bash
opencode --version
opencode run --help
```

Run at least two JSON probes. Use the default configured model first:

```bash
opencode run --format json --dir /private/tmp/opencode-thinking-probe \
  "Solve this small puzzle and reply with only the final answer: If Alice has 3 apples, buys 4, and gives away 2, how many apples remain?"
```

If the default model/path fails or does not produce enough evidence, run the known explicit probe shape from prior slices:

```bash
opencode -m opencode/mimo-v2.5-free --pure run --format json \
  --dir /private/tmp/opencode-thinking-probe \
  "Solve this small puzzle and reply with only the final answer: If Alice has 3 apples, buys 4, and gives away 2, how many apples remain?"
```

Capture stdout to an NDJSON file for each run. It is acceptable to use `tee` or redirect in this worker session.

Then inspect event shapes. Example approaches:

```bash
grep -niE 'reason|think|thought|summary' /private/tmp/opencode-thinking-probe/*.ndjson
```

Use Node or `jq` if convenient to print each event's top-level `type`, `part.type`, and text-bearing keys.

## Decision Tree

### Case A: Reasoning Text Exists

If raw OpenCode JSON includes an event with actual reasoning/thinking text:

1. Update `fusion-studio-server/lib/harness/opencode/json-event-translator.js`.
2. Add focused fixture tests in `fusion-studio-server/test/harness/opencode/json-event-translator.test.js`.
3. Preserve existing `part.type === 'reasoning'` support.
4. Add only the smallest mapping needed for the captured shape.

Possible examples:

```js
if (event.type === 'reasoning' || part.type === 'reasoning') {
  return this.translateReasoning(part, timestamp);
}
```

or, if OpenCode uses a different field:

```js
if (event.type === 'thinking' || part.type === 'thinking') {
  return [{ type: 'thinking', timestamp, text: String(part.text || event.text || '') }];
}
```

Only implement shapes observed in raw OpenCode output.

### Case B: Only Reasoning Token Counts Exist

If raw OpenCode JSON only includes `tokens.reasoning` and no text-bearing reasoning event:

1. Do not change production translator behavior.
2. Write a results report under `docs/handoffs/` with:
   - OpenCode version
   - command shapes tested
   - raw event types observed
   - confirmation that `tokens.reasoning` exists
   - confirmation that no reasoning/thinking text event exists
   - recommendation for UI/product behavior

Recommended product note:

```text
OpenCode JSON run currently appears to expose reasoning token counts but not visible reasoning text for this model/path. Fusion should treat this as "no thought trace available" rather than rendering an empty or fabricated thinking block.
```

## Validation

If production code changes:

```bash
cd fusion-studio-server
npm test -- --runInBand test/harness/opencode/json-event-translator.test.js test/harness/opencode/harness-send-message.test.js
npm test -- --runInBand test/wire/canonical-harness-event-bridge.test.js test/wire/canonical-chat-event-applier.test.js
```

If no production code changes:

```bash
cd fusion-studio-server
npm test -- --runInBand test/harness/opencode/json-event-translator.test.js
```

Always run:

```bash
git diff --check -- fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode docs/handoffs
```

If `rg` is available:

```bash
rg -n "part.type === 'reasoning'|type: 'thinking'|tokens.reasoning|reasoningText|thought|summary" fusion-studio-server/lib/harness/opencode fusion-studio-server/test/harness/opencode docs/handoffs
```

If `rg` is not available, use `grep -R`.

## Optional Fusion Smoke

If a translator patch is made and Fusion is already running:

1. Create/select an explicit OpenCode thread.
2. Send a prompt likely to trigger reasoning without asking it to reveal hidden chain-of-thought:

   ```text
   Solve this arithmetic puzzle and reply with only the final answer: 19 + 23 - 7.
   ```

3. Confirm whether a thinking segment appears before text.
4. Confirm normal final text still renders and the turn ends cleanly.

Skip this if OpenCode raw JSON does not expose reasoning text; there is nothing for Fusion to render.

## Report Back

Include:

- Files changed.
- OpenCode version and command shapes tested.
- Raw event types observed.
- Whether reasoning text was exposed.
- Whether `tokens.reasoning` was present.
- Whether translator code changed.
- Test results.
- Recommendation: patch accepted, or no thought trace available for current OpenCode JSON mode.
