---
name: Reply Action Chrome
description: Standing pattern for per-assistant-reply action chrome, icon order, stubs, disabled states, and fallbacks.
metadata:
  incoming-edges:
    - Chat UI
    - Chat Message List
  outgoing-edges:
    - Chat User Metadata
    - Chat Reply Payloads
  source-files:
    - fusion-studio-client/src/components/MessageList.tsx
    - fusion-studio-client/src/clipboard/clipboard-api.ts
  connected-skills: []
  related-trigger-files: []
---

Reply action chrome is a compact action row under a completed assistant reply.

## Standard Visible Row

```text
content_copy   text_to_speech   bookmark   link_2   compress
```

There is no assistant reply overflow menu.

## Removed Reply Actions

```text
more_horiz      Overflow menu
add_notes       Add Note
sticky_note_2   View Note
local_activity  Create Ticket
fork_right      Fork
```

Notes remain supported through the bookmark modal's note field. The separate
Add/View Note action is redundant and should not render.

Fork is not a per-reply chrome action. OpenCode current-head fork is a
composer-level thread action placed immediately left of the microphone button.

## Active And Stub Policy

Active in the reply chrome build:

- Copy reply
- Bookmark modal
- Chat ID copy

Visible inert stubs:

- Text to speech
- Compress

Stubs are unusable: no click handler, no backend message, and no toast. Active
actions that unexpectedly lack required data use the shared fallback toast:

```text
Error: Data Unavailable
```

## Activation

Chrome may render as a disabled shell during finalization. Actions activate
only after `chat-turn:saved` attaches `exchangeId`.
