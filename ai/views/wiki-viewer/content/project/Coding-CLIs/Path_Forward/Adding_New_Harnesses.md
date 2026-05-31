# Adding New Harnesses

The path forward is harness-neutral.

To add a new coding CLI, the backend needs a connector that can translate that CLI into the canonical Fusion Studio event vocabulary.

## Required Pieces

1. Start or attach to the CLI process.
2. Parse the vendor protocol, whether it is JSON-RPC, JSONL, or another stream shape.
3. Map native events into canonical events.
4. Map native tool names to the shared tool vocabulary.
5. Map vendor argument names to canonical argument names.
6. Preserve `toolCallId` for correlation.
7. Publish the result to the universal event bus.
8. Let the existing frontend stream/render pipeline consume it unchanged.

## Rule Of Thumb

If a new harness can speak the canonical language, the rest of Fusion Studio should not need to know where it came from.

The harness should stop at translation. Rendering, chunking, grouping, and segment presentation all stay in the shared stack.
