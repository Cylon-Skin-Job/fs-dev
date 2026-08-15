---
name: Tool Call Rendering
description: How tool calls render inside chat messages, and the standing rule for failed tool calls.
metadata:
  incoming-edges:
    - Chat UI
    - Chat Message List
  outgoing-edges: []
  source-files:
    - fusion-studio-client/src/components/ToolCallBlock.tsx
    - fusion-studio-client/src/components/LiveSegmentRenderer.tsx
    - fusion-studio-client/src/components/InstantSegmentRenderer.tsx
    - fusion-studio-client/src/lib/tool-renderers/index.ts
    - fusion-studio-client/src/lib/tool-output.ts
    - fusion-studio-client/src/lib/ws/tool-result-helpers.ts
  connected-skills: []
  related-trigger-files: []
---

Tool calls render as collapsible dropdown chrome inside a message segment. Live
tool calls render through `LiveSegmentRenderer` (its `LiveToolSegment` phase
controller and `ToolCallBlock`); finalized tool calls render through
`InstantSegmentRenderer`. The active renderer is selected per segment type by
`getToolRenderer`.

## Failed Tool Calls Keep Normal Chrome

A failed tool call renders with the same tool chrome as a successful one.

The dropdown stays normal. The failure indication belongs in the dropdown's
output/status text, not in a provider-specific UI override.

This applies in particular to shell tool failures:

- The tool call renders as a normal tool dropdown.
- The reliable failure signal is the canonical exit/status, surfaced in the
  dropdown's status/output text.
- Do not swap in a custom error surface, a provider-native status string, or a
  special-cased layout for failed shell tools.

The canonical status and error fields that this chrome consumes are produced by
the harness boundary. See
[Harness Boundary](../../002-Harness_And_Event_Flow/001-Harness_Boundary/PAGE.md)
for how provider-native shell results are translated into canonical
`statusMessage` / `isError` / `output` before they reach the interpreter.
