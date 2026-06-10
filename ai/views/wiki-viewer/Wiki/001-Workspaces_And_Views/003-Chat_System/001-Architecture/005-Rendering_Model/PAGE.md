---
name: Chat System Rendering Model
description: How chat stream data becomes visible UI. Use this page when changing live reveal, instant history rendering, tool blocks, thinking display, or finalization.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
    - Chat System Protocol
  outgoing-edges:
    - Chat System Runtime Model
    - Chat System UI Surface
    - Chat System Lessons
  source-files:
    - fusion-studio-client/src/components/LiveSegmentRenderer.tsx
    - fusion-studio-client/src/components/InstantSegmentRenderer.tsx
    - fusion-studio-client/src/components/ToolCallBlock.tsx
    - fusion-studio-client/src/lib/reveal/orchestrator.ts
    - fusion-studio-client/src/lib/ws/assistant-parts.ts
  connected-skills: []
  related-trigger-files: []
---

How stream data becomes visible chat UI.

## Two Renderers

Every assistant message is represented as ordered assistant parts/segments.
Those parts render through two paths:

| Renderer | Used for | Behavior |
|---|---|---|
| Instant renderer | completed history | no live animation, history-safe reconstruction |
| Live renderer | current streaming turn | sequential reveal, orb, live tool states |

Completed turns hydrate from SQLite exchanges and render instantly. Active turns
use live stream state and may be overlaid onto durable history.

## Live Reveal

Live rendering is sequential. Segments reveal one at a time:

```text
segment 0 -> segment 1 -> segment 2 -> ...
```

Text and tools should not race in parallel. The reveal pipeline controls how
content appears; tool renderers control what each tool block looks like.

The visible typing cursor and cursor injection layer were removed. Do not
reintroduce `CURSOR_HTML`, `injectCursor`, `.rv-typing-cursor`, or `showCursor`.

## Turn Finalization

A turn is not finalized just because the stream ended. The client waits for two
conditions:

- `turn_end` says the stream is done producing content.
- live reveal has caught up to the current segments.

Completion detection belongs in an effect that sees current state, not a stale
callback from an individual segment.

## History Hydration

`thread:opened` hydrates completed exchanges from SQLite. If the thread also has
an active live turn, the client overlays `liveTurn` after durable history.

Completed durable exchanges should not duplicate the live overlay when the turn
has already persisted.

## Tool Rendering

Tool presentation lives in `lib/tool-renderers/`. Presentation components should
not contain harness-specific tool rendering logic.

Canonical tool names are current frontend names:

```text
shell, read, write, edit, glob, grep, web_search, fetch, subagent, todo
```

OpenCode maps provider names into these canonical names, for example:

```text
bash -> shell
webfetch -> fetch
websearch -> search
todowrite -> todo
task -> subagent
```

The old inactive `lib/segment-renderers/` layer was deleted.

## Thinking

Visible thinking is rendered only when the harness emits actual thinking text.
Do not synthesize a thought trace from `tokens.reasoning`.

For OpenCode:

- plain JSON can report `tokens.reasoning` without visible reasoning text
- `--thinking` can expose reasoning text for some model profiles
- visible thinking is model/profile-specific, not a safe global default
