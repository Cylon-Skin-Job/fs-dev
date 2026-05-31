# Backend Interpreter

The backend interpreter is the translation layer between vendor CLI protocols and Fusion Studio's canonical event stream.

Each external CLI speaks its own native protocol. Fusion Studio does not expose that protocol directly to the rest of the app. Instead, a harness connector reads the vendor stream, normalizes it, and emits canonical events that every other module can consume.

## Canonical Event Vocabulary

The backend bus accepts a shared event vocabulary. The exact wire envelope can differ by CLI, but the normalized event types stay the same:

- `turn_begin`
- `turn_end`
- `thinking`
- `content`
- `tool_call`
- `tool_call_args`
- `tool_result`
- `status_update`

The rest of the app only needs to understand that canonical stream.

## Canonical Tool And Arg Mapping

The interpreter also normalizes tool names and argument keys so the downstream renderers never see vendor-specific names.

| Canonical Tool | Canonical Arg | Example Vendor Mapping |
|---|---|---|
| `read` | `file_path` | `path` |
| `write` | `file_path` | `path` |
| `edit` | `file_path`, `old_string`, `new_string` | `path`, `old_string`, `new_string` |
| `shell` | `command` | `command` |
| `glob` | `pattern` | `pattern` |
| `grep` | `pattern` | `pattern` |
| `web_search` | `query` | `query` |
| `fetch` | `url` | `url` |
| `edit` | `old_string` / `new_string` | `old_string` / `new_string` |

Downstream code should never need to know whether the vendor used `path`, `file_path`, or some other naming scheme.

For `edit`, the file path and the replacement strings are all part of the same canonical translation step.

## What The Interpreter Does

The interpreter sits between external CLIs and the rest of Fusion Studio. It is responsible for:

1. Parsing the vendor protocol, including JSON-RPC framing or chat-style JSONL.
2. Accumulating streamed tool arguments until a complete object is available.
3. Mapping vendor tool names to canonical tool names.
4. Mapping vendor argument names to canonical argument names.
5. Correlating `tool_call` and `tool_result` by `toolCallId`.
6. Emitting canonical events onto the shared bus.
7. Handling malformed wire data and incomplete payloads gracefully.

## Current State

Kimi is the active harness today. Its interpreter is still inline in `server.js` inside the WebSocket message handler. It currently handles:

- `TurnBegin` / `TurnEnd` as lifecycle events
- `ContentPart` as content or thinking tokens
- `ToolCall` as tool invocation metadata
- `ToolCallPart` as streamed argument accumulation
- `ToolResult` as the completed result payload
- `StatusUpdate` as context usage metrics

Known issues:

- Argument mapping is still fragile in places, especially where `path` should become `file_path`.
- The interpreter is not yet a separate module.

## Why This Matters

This keeps the frontend and persistence layers stable. Kimi is the active harness today, but the backend already has the shape needed for other harnesses as long as they can be mapped into the shared vocabulary.

The next step is to extract the interpreter into a dedicated module per harness, then keep the rest of the stack unaware of which CLI produced the events.
