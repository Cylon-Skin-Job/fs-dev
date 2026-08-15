---
name: Stop And Interrupted Turns
description: Server-owned stop behavior and persistence rules for partial assistant replies.
metadata:
  incoming-edges:
    - Chat Rendering And Lifecycle
  outgoing-edges:
    - Turn Finalization
  source-files:
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - fusion-studio-client/src/state/slices/chatSlice.ts
  connected-skills: []
  related-trigger-files: []
---

Stop is server-owned.

When Stop is clicked, the server synthesizes an interrupted canonical
`turn_end`, persists the partial assistant exchange through the normal path, and
cools or stops the runtime.

## UI Rule

After Stop is clicked:

1. Streaming tokens stop or are being forced to stop.
2. The composer button area shows a spinning pinwheel/finalization visual.
3. The control is unclickable during normal finalization.
4. If finalization/save fails, the same visual becomes clickable again so the
   user can retry finalization.
5. Send returns only after `chat-turn:saved` confirms the exchange id.

Interrupted exchanges still need `exchangeId` before saved-turn chrome actions
can activate.
