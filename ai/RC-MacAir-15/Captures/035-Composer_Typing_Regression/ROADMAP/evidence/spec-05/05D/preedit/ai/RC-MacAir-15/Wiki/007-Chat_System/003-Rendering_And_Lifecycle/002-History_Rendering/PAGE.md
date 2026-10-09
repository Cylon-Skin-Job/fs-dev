---
name: History Rendering
description: Completed exchange hydration and instant rendering behavior for saved chat history.
metadata:
  incoming-edges:
    - Chat Rendering And Lifecycle
  outgoing-edges:
    - Chat Message List
  source-files:
    - fusion-studio-client/src/components/InstantSegmentRenderer.tsx
    - fusion-studio-client/src/components/MessageList.tsx
    - fusion-studio-client/src/lib/ws/assistant-parts.ts
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
    - fusion-studio-client/src/components/chat/ChatTurnError.tsx
    - fusion-studio-server/lib/thread/HistoryFile.js
  connected-skills: []
  related-trigger-files: []
---

History rendering is for completed exchanges hydrated from SQLite.

The server sends rich exchanges on `thread:opened`. The client converts
assistant parts into `StreamSegment[]`, then completed messages render through
`InstantSegmentRenderer`.

## Rule

Saved metadata such as `exchangeId`, `seq`, and `metadata` must be attached
during exchange-to-message conversion so message-level UI can hydrate correctly
after reloads and thread switches.

Do not recover this data from DOM or array position.

Persisted tool `result.statusMessage` hydrates into frontend `toolStatus`.
History rendering should display only canonical status text that survived the
harness adapter boundary; it should not reinterpret provider-native titles.

Working activity is never historical. Empty initial thinking/content is
suppressed before persistence, so history does not hide or reconstruct blank
parts.

An error exchange hydrates one validated `metadata.terminalError` on the
completed message. `MessageList` renders the normal instant assistant/tool
output, then one `ChatTurnError`, then reply chrome. A terminal live snapshot
may supply the same envelope before save acknowledgement; the later
`chat-turn:saved` merge attaches durable identity/metadata without duplicating
the message, content, or error.
