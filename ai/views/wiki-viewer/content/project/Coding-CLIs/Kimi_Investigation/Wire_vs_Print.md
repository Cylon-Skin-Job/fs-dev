# Wire vs Print

The Kimi probes showed that `--print` and `--wire` do not share the same outer envelope, but they do share the same inner event model.

## Print

Print mode emits chat-style JSONL with:

- `role`
- `content`
- `tool_calls`

Tool results arrive as completed tool messages.

## Wire

Wire mode emits JSON-RPC `event` notifications with typed payloads. The useful content types are the same:

- `ContentPart`
- `ToolCall`
- `ToolCallPart`
- `ToolResult`

## Takeaway

The renderer should not care whether the data came from print or wire. Both should normalize into the same canonical event stream before they reach the frontend.

