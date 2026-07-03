---
name: Chat Thread Header
description: Thread header menu behavior, thread-id copy paradigm, and menu styling references.
metadata:
  incoming-edges:
    - Chat UI
  outgoing-edges:
    - Chat Menus And Modals
  source-files:
    - fusion-studio-client/src/components/chat/ChatAreaHeader.tsx
    - fusion-studio-client/src/styles/dropdown.css
    - fusion-studio-client/src/clipboard/clipboard-api.ts
  connected-skills: []
  related-trigger-files: []
---

The thread header owns thread-level controls.

Existing thread-id copy behavior is the interaction paradigm for chat-id copy:
icon/menu action, managed clipboard write, and toast feedback.

## Rule

Thread ID and Chat ID are different.

- Thread header copy actions may copy `threadId`.
- Reply chrome Chat ID actions copy SQLite `exchanges.id`.

Do not reuse the thread id value for turn-level actions.
