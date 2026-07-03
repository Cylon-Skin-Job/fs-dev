---
name: Chat Rendering And Lifecycle
description: Live rendering, history rendering, turn finalization, stop behavior, and interrupted-turn persistence rules.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Live Rendering
    - History Rendering
    - Turn Finalization
    - Stop And Interrupted Turns
  source-files:
    - fusion-studio-client/src/components/MessageList.tsx
    - fusion-studio-client/src/components/LiveSegmentRenderer.tsx
    - fusion-studio-client/src/components/InstantSegmentRenderer.tsx
    - fusion-studio-client/src/components/ToolCallBlock.tsx
    - fusion-studio-client/src/components/ToolsPanel.css
    - fusion-studio-client/src/lib/catalog-visual.ts
    - fusion-studio-client/src/lib/tool-renderers/index.ts
    - fusion-studio-client/src/lib/tool-renderers/shared/error-display.ts
    - fusion-studio-client/src/lib/tool-renderers/shell.ts
    - fusion-studio-client/src/lib/ws/tool-result-helpers.ts
    - fusion-studio-client/src/lib/ws/turn-lifecycle.ts
    - fusion-studio-client/src/state/slices/chatSlice.ts
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
  connected-skills: []
  related-trigger-files: []
---

Use this section when changing how chat appears, finalizes, stops, or resumes.

## Core Rule

The last token rendering is not the same thing as a fully completed chat turn.
A turn is viable for saved-exchange actions only after assistant output has
ended, SQLite persistence has succeeded, and the client knows the saved
`exchangeId`.

## Rendering Paths

- Live/current turn: `LiveSegmentRenderer`
- Completed history: `InstantSegmentRenderer`
- Message orchestration: `MessageList`
- Turn state/finalization: `chatSlice` and `turn-lifecycle`

Do not mount finished-turn controls inside segment renderers. Whole-reply UI
belongs around the message in `MessageList`.

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

A turn is not finalized just because the stream ended. The client waits for:

- `turn_end` says the stream is done producing content.
- live reveal has caught up to the current segments.
- SQLite has saved the exchange when saved-turn UI is needed.
- the client has received `exchangeId` when saved-turn actions are needed.

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

## Tool Error Display

Tool chrome stays visually normal even when `isError` is true. The error signal
belongs inside the dropdown body, not in the collapsed icon/label chrome.

`lib/tool-renderers/index.ts` wraps every tool renderer with the shared error
presentation layer in `lib/tool-renderers/shared/error-display.ts`. Individual
tool renderers own successful output formatting; the shared wrapper owns error
dropdown formatting.

The shared error formatter:

- renders a neutral tool title such as `Read` or `Shell` in collapsed chrome
- renders failure title, context, status, and output in the expanded body
- uses a centralized context catalog for command, path, pattern, query, URL, and
  agent labels
- suppresses generic or duplicate status text such as raw `error` or repeated
  command labels

Harness adapters own provider-specific status cleanup before the result reaches
the renderer.

## Thinking

Visible thinking is rendered only when the harness emits actual thinking text.
Do not synthesize a thought trace from `tokens.reasoning`.

For OpenCode:

- plain JSON can report `tokens.reasoning` without visible reasoning text
- `--thinking` can expose reasoning text for some model profiles
- visible thinking is model/profile-specific, not a safe global default.

## Children

- [Live Rendering](001-Live_Rendering/PAGE.md)
- [History Rendering](002-History_Rendering/PAGE.md)
- [Turn Finalization](003-Turn_Finalization/PAGE.md)
- [Stop And Interrupted Turns](004-Stop_And_Interrupted_Turns/PAGE.md)
- [Reply Payloads](005-Reply_Payloads/PAGE.md)
