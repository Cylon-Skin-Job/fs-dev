# OpenCode Slice 1: JSON Run Translator Preflight

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Objective

Build the smallest useful OpenCode harness foundation by translating
`opencode run --format json` newline-delimited JSON events into Fusion's
canonical harness events.

This slice is a translator/preflight slice. It should not make OpenCode the
default harness yet.

## Probe Results To Use

The coordinator ran these probes on June 5, 2026.

Installed version:

```text
opencode --version
1.15.13
```

Installed path:

```text
/opt/homebrew/bin/opencode
```

Models available included:

```text
opencode/mimo-v2.5-free
openai/gpt-5.5-fast
openai/gpt-5.5
google/gemini-2.5-flash
kimi-for-coding/k2p6
```

Default one-shot behavior:

```bash
opencode run "Reply with exactly: OPEN_CODE_PROBE_OK"
```

Initial stdout:

```text
> build · gpt-5.5-fast
```

In the sandbox this hung/crashed inside Bun. With network permission and an
explicit model, it completed:

```bash
opencode -m opencode/mimo-v2.5-free --pure run "Reply with exactly: OPEN_CODE_PROBE_OK"
```

Output:

```text
> build · mimo-v2.5-free
OPEN_CODE_PROBE_OK
```

JSON mode:

```bash
opencode -m opencode/mimo-v2.5-free --pure run --format json \
  "Reply with exactly: OPEN_CODE_JSON_PROBE_OK"
```

Output shape:

```json
{"type":"step_start","timestamp":1780703411458,"sessionID":"ses_165ce4bc0ffeALDHMaV6OvFl9p","part":{"id":"prt_e9a31bd00001WT5CvVileapD2n","messageID":"msg_e9a31b49e001gbn38ihqWIjlgS","sessionID":"ses_165ce4bc0ffeALDHMaV6OvFl9p","snapshot":"4ebf7c3c8e3d159aab952b07cabda684796ac3c2","type":"step-start"}}
{"type":"text","timestamp":1780703411893,"sessionID":"ses_165ce4bc0ffeALDHMaV6OvFl9p","part":{"id":"prt_e9a31be840016MeGNtdVPKW9q5","messageID":"msg_e9a31b49e001gbn38ihqWIjlgS","sessionID":"ses_165ce4bc0ffeALDHMaV6OvFl9p","type":"text","text":"OPEN_CODE_JSON_PROBE_OK","time":{"start":1780703411844,"end":1780703411892}}}
{"type":"step_finish","timestamp":1780703411932,"sessionID":"ses_165ce4bc0ffeALDHMaV6OvFl9p","part":{"id":"prt_e9a31bed9001RErKSXt0joLkhZ","reason":"stop","snapshot":"4ebf7c3c8e3d159aab952b07cabda684796ac3c2","messageID":"msg_e9a31b49e001gbn38ihqWIjlgS","sessionID":"ses_165ce4bc0ffeALDHMaV6OvFl9p","type":"step-finish","tokens":{"total":23695,"input":38,"output":9,"reasoning":32,"cache":{"write":0,"read":23616}},"cost":0}}
```

Tool-use JSON mode:

```bash
opencode -m opencode/mimo-v2.5-free --pure run --format json \
  --dangerously-skip-permissions --dir /private/tmp/opencode-probe \
  "Use the bash tool to run exactly: printf OPENCODE_TOOL_PROBE_OK. Then reply exactly: TOOL_DONE"
```

Relevant output shape:

```json
{"type":"tool_use","timestamp":1780703445385,"sessionID":"ses_165cdc835ffe3Arp4cPnzDfYZS","part":{"type":"tool","tool":"bash","callID":"call_b50fbfe191e94243a66a4733","state":{"status":"completed","input":{"command":"printf OPENCODE_TOOL_PROBE_OK","description":"Run printf probe command"},"output":"OPENCODE_TOOL_PROBE_OK","metadata":{"output":"OPENCODE_TOOL_PROBE_OK","exit":0,"description":"Run printf probe command","truncated":false},"title":"Run printf probe command","time":{"start":1780703445379,"end":1780703445384}},"id":"prt_e9a32409c001UG0Vf1i7ENQajx","sessionID":"ses_165cdc835ffe3Arp4cPnzDfYZS","messageID":"msg_e9a323827001HZdY6XtvgSFyvB"}}
{"type":"step_finish","timestamp":1780703445403,"sessionID":"ses_165cdc835ffe3Arp4cPnzDfYZS","part":{"id":"prt_e9a32418e001FkEPCo29EmR2Fh","reason":"tool-calls","messageID":"msg_e9a323827001HZdY6XtvgSFyvB","sessionID":"ses_165cdc835ffe3Arp4cPnzDfYZS","type":"step-finish","tokens":{"total":17315,"input":16233,"output":41,"reasoning":17,"cache":{"write":0,"read":1024}},"cost":0}}
{"type":"text","timestamp":1780703447462,"sessionID":"ses_165cdc835ffe3Arp4cPnzDfYZS","part":{"id":"prt_e9a32498f001WUTk7BPWf65N3h","messageID":"msg_e9a32419e001jo7nA2MJTMmP13","sessionID":"ses_165cdc835ffe3Arp4cPnzDfYZS","type":"text","text":"TOOL_DONE","time":{"start":1780703447439,"end":1780703447461}}}
```

Debug run notes:

- `opencode run --format json` is newline-delimited JSON.
- `--print-logs --log-level DEBUG` prints huge request payloads to stderr; do
  not use it in automated tests except when debugging.
- Without network permission, OpenCode failed with socket errors against
  `https://opencode.ai/zen/v1/chat/completions`.
- A debug run reported an FSEvents watcher error on `.git` but continued.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-04-thread-runtime-runtime-5-automation-hooks.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-04-thread-runtime-runtime-6-warm-intent-triggers.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

## Current Harness Seams

Inspect:

```text
fusion-studio-server/lib/harness/types.js
fusion-studio-server/lib/harness/registry.js
fusion-studio-server/lib/harness/compat.js
fusion-studio-server/lib/harness/kimi/index.js
fusion-studio-server/lib/harness/kimi/event-translator.js
fusion-studio-server/lib/harness/clis/*/index.js
fusion-studio-server/lib/harness/clis/*/*translator*.js
fusion-studio-server/test/harness/*
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
```

Canonical events expected by Fusion:

```text
turn_begin
content
thinking
tool_call
tool_call_args
tool_result
subagent_event
status_update
turn_end
```

## Scope

Do:

- Add an OpenCode JSON event translator module, preferably under:

```text
fusion-studio-server/lib/harness/opencode/
```

- Translate captured `opencode run --format json` events into canonical events.
- Add focused unit tests from captured fixture events.
- Add a narrow OpenCode harness skeleton only if useful for exercising the
  translator with an async iterable of JSON lines.
- Keep OpenCode registration/default switching out unless the skeleton requires
  a test-only local import.

Do not:

- Make OpenCode the default harness.
- Remove Kimi.
- Implement ACP/server mode.
- Implement `opencode serve`.
- Implement cooperative stop/interrupt.
- Add client UI.
- Touch Electron packaging files.
- Run destructive or write-capable OpenCode commands in the repo.
- Use `--dangerously-skip-permissions` outside isolated temp probes.

## Suggested Translator Mapping

### Turn Begin

The `opencode run --format json` stream does not emit an explicit user prompt
event. The harness `sendMessage(...)` should emit `turn_begin` before draining
OpenCode output:

```js
{
  type: 'turn_begin',
  timestamp: Date.now(),
  userInput: message
}
```

Do not make the translator infer user input from OpenCode export data.

### Text

OpenCode:

```json
{"type":"text","part":{"type":"text","text":"..."}}
```

Canonical:

```js
{ type: 'content', timestamp, text }
```

### Reasoning / Thinking

Exported sessions include `part.type === "reasoning"`, but the live JSON probe
did not show reasoning events in stdout. If live JSON includes reasoning, map:

```js
{ type: 'thinking', timestamp, text: part.text || '' }
```

If no live reasoning appears, document that as a probe result.

### Tool Use

OpenCode:

```json
{
  "type": "tool_use",
  "part": {
    "type": "tool",
    "tool": "bash",
    "callID": "call_...",
    "state": {
      "status": "completed",
      "input": { "command": "...", "description": "..." },
      "output": "...",
      "metadata": { "exit": 0, "truncated": false }
    }
  }
}
```

Canonical should preserve current frontend canonical tool names:

```text
bash       -> shell
read       -> read
write      -> write
edit       -> edit
grep       -> grep
glob       -> glob
webfetch   -> fetch
websearch  -> search
todowrite  -> todo
task       -> subagent or agent
```

Suggested emitted sequence for a completed tool event:

```js
{
  type: 'tool_call',
  timestamp,
  toolCallId: part.callID,
  toolName: mappedName
}
{
  type: 'tool_call_args',
  timestamp,
  toolCallId: part.callID,
  argsChunk: JSON.stringify(part.state.input || {})
}
{
  type: 'tool_result',
  timestamp,
  toolCallId: part.callID,
  toolName: mappedName,
  output: part.state.output || '',
  statusMessage: part.state.title || part.state.metadata?.description || part.state.status,
  display: [],
  returnedDiff: false,
  isError: Boolean(part.state.metadata?.exit && part.state.metadata.exit !== 0),
  files: []
}
```

If OpenCode can emit tool states before completion, support `status !==
"completed"` conservatively:

- emit `tool_call` and args when input is present
- defer `tool_result` until completed/error
- add tests if fixtures are available

### Step Finish

OpenCode:

```json
{"type":"step_finish","part":{"reason":"stop","tokens":{...},"cost":0}}
```

Canonical:

```js
{
  type: 'status_update',
  timestamp,
  tokenUsage: {
    input_other,
    input_cache_read,
    output,
    ...
  },
  messageId: part.messageID
}
{
  type: 'turn_end',
  timestamp,
  reason: part.reason || 'complete'
}
```

Token mapping can be approximate for this slice:

```js
input_other = tokens.input
input_cache_read = tokens.cache?.read
input_cache_creation = tokens.cache?.write
output = tokens.output
```

If there are multiple `step_finish` events in one prompt because tools trigger
multiple assistant messages, do not emit terminal `turn_end` on a
`reason: "tool-calls"` finish until the final `reason: "stop"` or equivalent.
The tool-use probe emitted:

```text
step_finish reason=tool-calls
step_start
text
```

So `tool-calls` is a continuation marker, not the final turn end.

## Suggested Files

Likely new files:

```text
fusion-studio-server/lib/harness/opencode/json-event-translator.js
fusion-studio-server/lib/harness/opencode/__tests__/json-event-translator.test.js
```

Optional skeleton:

```text
fusion-studio-server/lib/harness/opencode/index.js
fusion-studio-server/lib/harness/opencode/json-line-parser.js
fusion-studio-server/lib/harness/opencode/__tests__/harness-json-run.test.js
```

Keep every new file to one job:

- translator maps event objects to canonical events
- parser turns stdout lines into event objects
- harness spawns and drains OpenCode

## Tests

Required tests:

1. Text event maps to canonical `content`.
2. Tool-use event maps to `tool_call`, `tool_call_args`, and `tool_result`.
3. Tool exit `0` maps `isError: false`.
4. Tool nonzero exit maps `isError: true`.
5. `step_finish` with `reason: "tool-calls"` does not emit `turn_end`.
6. Final `step_finish` with `reason: "stop"` emits `status_update` and
   `turn_end`.
7. Token usage maps from OpenCode token fields into Fusion token fields.
8. Unknown event types are ignored, not fatal.

Optional tests:

- Reasoning maps to `thinking` if live JSON can emit it.
- Parser ignores blank lines and handles invalid JSON as a recoverable parser
  error.

Do not require a live OpenCode network call for unit tests.

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/harness/opencode
npm test -- --runInBand
```

If the test path differs, report the exact command used.

Run acceptance searches from repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
grep -R "opencode" -n fusion-studio-server/lib/harness fusion-studio-server/test/harness
grep -R "OPEN_CODE_PROBE\\|OPENCODE_TOOL_PROBE" -n fusion-studio-server/lib fusion-studio-server/test
git diff --check -- fusion-studio-server/lib/harness fusion-studio-server/test/harness
```

Expected:

- probe literal strings appear only in tests/fixtures or this handoff
- translator tests pass without network
- no Electron packaging files touched
- no default harness switch

## Manual Probe Guidance

Live probes are optional in this slice because the coordinator already captured
basic text/tool events.

If you run a live probe, use `/private/tmp/opencode-probe` and explicit model:

```bash
mkdir -p /private/tmp/opencode-probe
cd /private/tmp/opencode-probe
opencode -m opencode/mimo-v2.5-free --pure run --format json \
  "Reply with exactly: OPEN_CODE_JSON_PROBE_OK"
```

Do not run write/edit probes in the repo.

## Result Report Requirements

Return:

- files changed
- exact translator API
- event mappings implemented
- fixtures/tests added
- tests run and results
- whether a harness skeleton was added or deferred
- whether ACP/server mode was deferred
- confirmation that OpenCode was not made default
- confirmation that no Electron packaging files were touched
