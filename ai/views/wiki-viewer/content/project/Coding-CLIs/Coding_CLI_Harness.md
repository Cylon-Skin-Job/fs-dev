---
title: Coding CLI Harness
description: How Fusion Studio unifies coding CLIs behind a shared backend protocol.
icon: terminal
---

# Coding CLI Harness

Fusion Studio is designed to treat coding CLIs as interchangeable harnesses behind a shared internal protocol. The backend owns a centralized stream interpreter that receives normalized events, routes them through the universal event bus, and keeps the frontend insulated from each vendor-specific CLI protocol.

## Backend Architecture

The backend harness layer lives around `fusion-studio-server/lib/harness/`. Its job is to connect to external coding agents, translate their native stream formats, and emit one canonical event vocabulary for the rest of the app.

At a high level:

1. A harness implementation starts or connects to a CLI process.
2. The harness reads that CLI's native stream or wire protocol.
3. A translator maps native events into Fusion Studio canonical events.
4. The centralized interpreter/event bus receives those canonical events.
5. Downstream modules consume one universal stream shape instead of vendor-specific formats.

The canonical language includes events such as:

- `turn_begin`
- `thinking`
- `content`
- `tool_call`
- `tool_call_args`
- `tool_result`
- `turn_end`
- `status_update`

This means frontend and persistence code do not need to know whether an event came from Kimi, Codex, Gemini, Qwen, Claude Code, or another future harness. Each connector is responsible for translating its native vocabulary into the shared Fusion Studio vocabulary.

## Harness Connectors

The harness registry provides the infrastructure for multiple CLI integrations. Currently, the active work is focused on Kimi, but the surrounding architecture is intentionally broader.

Kimi has a native harness path that reads Kimi Wire events and translates them into canonical events. Other CLIs can plug in through their own mapper/translator modules, as long as they produce the same canonical output. This gives Fusion Studio one internal contract even when external CLIs use different tool names, event shapes, argument formats, or result payloads.

The important design boundary is:

```text
Vendor CLI protocol -> harness translator -> Fusion Studio canonical events
```

Everything past that boundary should speak the same internal language.

## Streaming To The Frontend

After canonical events enter the backend event bus, the websocket streaming layer fans them out to the active client/thread. The frontend receives this normalized stream and maps it into ordered chat segments.

The frontend streaming pipeline is responsible for:

- routing events to the correct thread/scope
- grouping related tool calls where appropriate
- preserving tool-call IDs for result correlation
- feeding text, thinking, and tool output into live render segments
- letting the render orchestrator reveal chunks progressively

This creates a second clean boundary:

```text
Canonical event bus -> websocket stream -> frontend segment store -> live renderer
```

The frontend should not need vendor-specific logic for each CLI. It should only need tool/render behavior for the canonical segment types.

## Current Focus

Current implementation work is centered on Kimi:

- validating Kimi Wire and print-mode output shapes
- mapping Kimi tool names to canonical segment types
- adapting tool-result rendering to the shared chunk queue
- improving live reveal behavior for tools such as web search, fetch, shell, and read

The broader goal remains harness-neutral: once a CLI can be translated into the canonical event vocabulary, it can flow through the same backend interpreter, event bus, websocket stream, frontend store, and render orchestration path.

---

## Further Reading

- [Backend Interpreter](Architecture/Backend_Interpreter.md)
- [Frontend Stream](Architecture/Frontend_Stream.md)
- [Wire vs Print](Kimi_Investigation/Wire_vs_Print.md)
- [Tool Output Shapes](Kimi_Investigation/Tool_Output_Shapes.md)
- [Adding New Harnesses](Path_Forward/Adding_New_Harnesses.md)
- [Chunking Guide](Path_Forward/Chunking_Guide.md)
