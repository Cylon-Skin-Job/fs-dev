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

## Collapsed Thread Rail

When the persistent thread rail is hidden, the upper-left of the chat header
shows a `dock_to_right` control. Hovering the control reveals the existing
thread rail from the left as a full-height overlay; it does not resize the chat
column. Moving into the overlay keeps it open so its normal thread-row actions
remain usable.

The hover preview keeps the thread-view dropdown available but hides the close
control. It also shows `dock_to_right` in the same upper-left position as the
chat header control. Clicking either dock control expands and pins the normal
thread rail, at which point the close control appears.

Preview and pinned states share a fixed-height management-header slot, New chat
row, divider, and thread-list structure. Filling the management slot must not
shift New chat or any thread row. The hover preview reuses passive thread-open
behavior and must not warm, spawn, stop, or replace a thread runtime.
