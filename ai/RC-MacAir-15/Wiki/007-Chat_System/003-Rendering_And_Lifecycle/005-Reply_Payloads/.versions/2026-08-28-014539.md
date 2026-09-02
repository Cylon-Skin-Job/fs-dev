---
name: Chat Reply Payloads
description: Reply text extraction, tool output exclusion, clipboard policy, and TTS-ready payloads derived from finalized message segments.
metadata:
  incoming-edges:
    - Chat Rendering And Lifecycle
    - Reply Action Chrome
  outgoing-edges:
    - Chat User Metadata
  source-files:
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
    - fusion-studio-client/src/state/slices/chatSlice.ts
    - fusion-studio-client/src/components/InstantSegmentRenderer.tsx
    - fusion-studio-client/src/lib/tool-grouper.ts
    - fusion-studio-client/src/clipboard/clipboard-api.ts
    - fusion-studio-server/lib/secrets/clipboard/handlers.js
  connected-skills: []
  related-trigger-files: []
---

Assistant reply payloads come from finalized `Message.segments`, not from DOM
scraping and not from SQLite reads for normal local actions.

One extracted payload should support multiple consumers. Copy and future TTS
must derive from the same text extraction primitive so they do not disagree
about which parts of a reply count as assistant text. Use this page before
adding copy, TTS, export, summarize, compress, or any other feature that
consumes assistant reply text.

## Extraction Primitive

```ts
const replyMarkdown = segments
  .filter(segment => segment.type === 'text')
  .map(segment => segment.content)
  .join('');
```

The extractor should return one reusable payload:

```ts
interface AssistantReplyTextPayload {
  markdown: string;
  plainText: string;
  hasText: boolean;
}
```

## Tool Output Exclusion

Assistant reply text payloads include only `StreamSegment.type === "text"`.

Exclude:

- tool calls
- tool results
- shell/read/write/edit/grep/glob/fetch/web_search/subagent/todo segments
- `think` segments

Thinking can be exposed only if a later feature explicitly asks for thinking.

Copy, TTS, summarize, compress, and similar user-facing actions should not mix
assistant prose with tool transcript noise.

## Clipboard

Any Fusion Studio action that writes to the system clipboard should also write
to clipboard history.

Use:

```ts
writeAndRecord(text, source)
```

Do not call `navigator.clipboard.writeText()` directly for app copy actions.

Chat source labels:

- Reply copy: `assistant-reply`
- Chat ID copy: `assistant-reply-chat-id`
- Note copy: `assistant-reply-note`

Active copy actions that unexpectedly lack required data should use the shared
fallback toast:

```text
Error: Data Unavailable
```

Disabled or inert stub actions should not fire this toast.

## Text To Speech

TTS should consume the same reply text extraction payload used by copy. Copy
and TTS output must agree about what text belongs to the assistant reply.

Use markdown as the canonical copy payload. Derive plain text for TTS from the
same extracted text after tool and thinking segments have been excluded.

Current reply chrome may show a `text_to_speech` icon as an inert stub until a
TTS engine is wired.
