# Frontend Stream

Once the backend emits canonical events, the websocket layer fans them out to the active client thread. The frontend then turns that stream into chat segments and revealable chunks.

## Frontend Flow

```text
vendor wire/print event -> backend interpreter -> canonical event bus -> websocket message -> stream handler -> panel store -> segment renderer
```

Print mode and wire mode do not share the same outer envelope, but they should converge on the same canonical stream before the frontend sees them.

## Frontend Responsibilities

- keep event handling thread-scoped
- preserve `toolCallId` so results can match calls
- group related tool calls when the UI needs one block
- reveal content progressively through the chunk queue
- keep transport details out of the render logic

The frontend should not need vendor-specific logic. It only needs to know how to render the canonical segment types and the tool output shapes that the backend has already normalized.
