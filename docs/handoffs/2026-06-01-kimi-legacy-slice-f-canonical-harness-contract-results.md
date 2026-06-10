# Slice F Results: Canonical Harness Event Contract

## Repo Verification

- **Repo root:** `/Users/rccurtrightjr./projects/fs-dev` (confirmed via `git rev-parse --show-toplevel`)
- **Starting commit:** `ccf2979 refactor: simplify reveal timing defaults`
- **git diff --check:** Clean (no whitespace errors)
- **Files changed:**
  - `fusion-studio-server/lib/harness/types.js`
  - `fusion-studio-server/lib/harness/kimi/__tests__/event-translator.test.js`
- **Unrelated dirty files left untouched:**
  - `ai/system/state/state.json` (runtime state)
  - `fusion-studio-server/data/workspace-cache.json` (runtime state)

## Test Results

```
Test Suites: 4 passed, 4 total
Tests:       50 passed, 50 total
```

Ran:
- `lib/harness/kimi/__tests__/event-translator.test.js`
- `lib/harness/kimi/__tests__/display-normalizer.test.js`
- `lib/harness/kimi/__tests__/session-state.test.js`
- `lib/harness/kimi/__tests__/wire-parser.test.js`

## Canonical Event Contract

### Event Types (Complete Union)

| Canonical Name | Emitted By Translator | Source Wire Name |
|----------------|----------------------|------------------|
| `turn_begin` | Yes | `TurnBegin` |
| `content` | Yes | `ContentPart` (text) |
| `thinking` | Yes | `ContentPart` (think) |
| `tool_call` | Yes | `ToolCall` |
| `tool_call_args` | Yes | `ToolCallPart` |
| `tool_result` | Yes | `ToolResult` |
| `subagent_event` | **No** (finding) | `SubagentEvent` |
| `status_update` | **No** (finding) | `StatusUpdate` |
| `turn_end` | Yes | `TurnEnd` |

### ToolResultEvent Field Names

**Current state:** Two naming patterns coexist.

- **Translator events** (`event-translator.js`) use:
  - `output`, `statusMessage`, `display`, `returnedDiff`, `isError`, `files`

- **Bus/websocket events** (`message-router.js` -> `wire-broadcaster.js`) use:
  - `toolOutput`, `toolStatus`, `toolDisplay`, `returnedDiff`, `isError`

**Finding:** The current legacy bus/websocket route uses `tool*` prefixed fields while the translator emits canonical result fields. This is a contract mismatch between the translator layer and the current broadcast/client layer.

**Recommendation (Slice G):** Keep the internal canonical event applier on canonical field names (`output`, `statusMessage`, `display`, `returnedDiff`, `isError`, `files`). Adapt explicitly at the websocket boundary if the current client message contract still needs `toolOutput`, `toolStatus`, and `toolDisplay`.

### Tool Name Mappings (Verified)

| Kimi Wire Name | Canonical Name | Mapped? |
|----------------|---------------|---------|
| `Bash` | `shell` | Yes |
| `ReadFile` | `read` | Yes |
| `WriteFile` | `write` | Yes |
| `EditFile` | `edit` | Yes |
| `StrReplaceFile` | `edit` | **No** (not known to be emitted by Kimi wire) |
| `WebSearch` | `web_search` | Yes |
| `SearchWeb` | `web_search` | **No** (not known to be emitted by Kimi wire) |
| `WebFetch` | `fetch` | Yes |
| `FetchURL` | `fetch` | **No** (not known to be emitted by Kimi wire) |
| `Agent` | `subagent` | Yes |
| `Task` | `subagent` | **No** (not known to be emitted by Kimi wire) |
| `TodoWrite` | `todo` | Yes |
| `SetTodoList` | `todo` | **No** (not known to be emitted by Kimi wire) |

**Unmapped aliases:** If future wire analysis shows `StrReplaceFile`, `SearchWeb`, `FetchURL`, `Task`, or `SetTodoList` in actual Kimi output, they should be added to `tool-mapper.js`.

## Kimi-Specific Code Isolation

### Correctly Isolated (inside `harness/kimi/*`)

- `event-translator.js` — translates all Kimi wire events to canonical events
- `tool-mapper.js` — maps Kimi PascalCase tool names to canonical lowercase
- `display-normalizer.js` — normalizes Kimi `return_value` into universal shape
- `wire-parser.js` — parses Kimi NDJSON wire protocol
- `session-state.js` — per-turn state tracking for Kimi wire

### Kimi-Specific Leaks Outside `harness/kimi/*`

1. **`fusion-studio-server/lib/wire/message-router.js`**
   - Imports `normalizeKimiToolResult` from `../harness/kimi/display-normalizer`
   - Switches on raw Kimi event names: `TurnBegin`, `ContentPart`, `ToolCall`, `ToolCallPart`, `ToolResult`, `SubagentEvent`, `TurnEnd`, `StatusUpdate`
   - Uses `toolOutput`, `toolStatus`, `toolDisplay` in bus events while translator events use canonical result fields

2. **`fusion-studio-server/lib/harness/compat.js`**
   - Uses `session.compatibleStdout` for Kimi Wire compatibility
   - Returns process-like proxies for ACP harness sessions

3. **`fusion-studio-server/lib/harness/clis/*/index.js`** (Claude, Gemini, Codex, Qwen)
   - Call `serializeToKimiWire()` to emit Kimi-compatible JSON on `compatibleStdout`
   - This is the ACP harness -> Kimi wire bridge

4. **`fusion-studio-server/lib/harness/clis/base-cli-harness.js`**
   - Contains `serializeToKimiWire()` method
   - Converts canonical events back to Kimi wire format

## Key Findings

### StatusUpdate

- **Current behavior:** `event-translator.js` `handleStatusUpdate()` updates translator state (`contextUsage`, `tokenUsage`, `messageId`, `planMode`) but returns `null` — it does **not** emit a live canonical `status_update` event.
- **Legacy path:** `message-router.js` **does** emit `chat:status_update` on the event bus, which `wire-broadcaster.js` forwards as `status_update` to the frontend.
- **Contract:** Future harness paths **SHOULD** emit live `status_update` events so the frontend can show token/context usage in real time without waiting for `turn_end`.

### SubagentEvent

- **Current behavior:** `event-translator.js` does **not** handle `SubagentEvent`. It falls through to the default case and returns `null`.
- **Legacy path:** `message-router.js` **does** handle raw Kimi `SubagentEvent` and emits `chat:subagent_event` on the event bus.
- **Contract:** Future Kimi harness paths **MUST** translate `SubagentEvent` into canonical `subagent_event` events. The current translator gap means the new harness path would lose subagent visibility until fixed.

### compatibleStdout / serializeToKimiWire

- These are the ACP harness compatibility bridge. ACP harnesses (Claude, Gemini, Codex, Qwen) produce canonical events, then serialize them back to Kimi wire format so the existing `message-router.js` can consume them.
- **These should be removed** once `message-router.js` is replaced by a canonical event applier that consumes canonical events directly from any harness.

## Recommended Next Slice

**Slice G — Extract Canonical Chat Event Applier**

Move the generic session mutation, assistant parts construction, settings tool policy (`checkSettingsBounce`), bus emission, and persistence handoff out of raw Kimi `message-router.js` cases and into a **canonical event applier** that operates on canonical events only.

Kimi wire parsing should then become a thin adapter feeding that applier. ACP harnesses can feed the same applier directly without round-tripping through `serializeToKimiWire()`.
