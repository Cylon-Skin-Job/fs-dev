---
name: Chat UI
description: Composer, thread header, message list, reply chrome, menus, modals, and chat styling rules.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Composer
    - Chat Thread Header
    - Chat Message List
    - Reply Action Chrome
    - Chat Menus And Modals
  source-files:
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - fusion-studio-client/src/components/chat/ChatAreaHeader.tsx
    - fusion-studio-client/src/components/MessageList.tsx
    - fusion-studio-client/src/styles/dropdown.css
    - ai/<machine>/System/styles/views.css
  connected-skills: []
  related-trigger-files: []
---

Use this section before changing visible chat controls, chat menus, message
chrome, composer behavior, or chat-specific styling.

## Standing UI Rules

- Preserve the current chat/composer visual language.
- New class names are allowed for customization, but they must use the same
  workspace/system CSS variables as the existing chat footer and thread menus.
- Visible stubs in dev builds are inert: no click handler, no backend message,
  and no toast unless they are using a shared active-action fallback.
- Presentational components receive state and callbacks. Side effects belong in
  hooks/controllers or small action/API modules.
- Icon buttons and menu items need `aria-label` and `title`.

## New Thread

In the current OpenCode-only config, New Thread is direct. It does not open a
harness selector.

The harness picker is conditional:

- one enabled harness in `cli.json`: hide picker, create directly
- two or more enabled harnesses in `cli.json`: show picker

## Sidebar And Header

The sidebar owns thread list actions. The chat header owns compact/collapsed
actions. Both should respect the same harness policy and not invent separate
selection behavior.

Thread row clicks are passive browse actions. They should hydrate the selected
thread without warming or spawning a harness.

## Input And Warm Intent

Cold threads warm on intent to send:

- input focus
- paste
- helper/composer insertion
- send fallback

The send button should freeze while acceptance is pending. The warm/connecting
indicator should be visually distinct from the in-flight turn orb.

## Composer Context Row

The composer has a compact row above the textarea:

- left: context usage block fixed at `120px`
- right: attachment strip, right-justified and allowed to use remaining width

Attachment pills come from `Send to chat` actions. They use:

- `link_2` icon
- compact labels such as `file:server.js` or `wiki:chat:architecture`
- clipped single-line text with a right-side fade
- hover-only circular `X` removal control

Attachment pills are not inserted into textarea text. Removing a pill before
send removes its metadata.

## Filename Autocomplete

Filename autocomplete is narrow and plain text only.

- Candidate sources are RAM-only open file tabs and metadata-hydrated files.
- Candidates must have an extension and must not end in `.md`.
- Ghost text can complete the current filename token.
- `Tab` or non-shift `Enter` accepts the active suggestion and inserts a trailing
  space.
- `Space` never accepts ghost text. It should let the user reject the suggestion
  and continue typing a new word.
- The ghost overlay must mirror textarea typography, wrapping, and prefix text so
  the suggestion appears at the same visual cursor location as the typed text.

Do not add inline `@` behavior, picker modals, wiki/doc/ticket suggestions, or
structured metadata from typed autocomplete.

## Orb And Turn State

The orb represents an in-flight assistant turn for the currently rendered
thread. It should not light up for another thread while the user is browsing
elsewhere.

If a background turn completes while the user is away, returning to that thread
should show the completed turn or the latest live snapshot, not restart a
delayed render from the last visible token.

## Stop

Stop should feel like CLI Escape:

- interrupt quickly
- settle currently available content
- persist the partial assistant turn
- allow follow-up prompt

The client should not discard the partial exchange or leave two user bubbles
without assistant content.

## Small UI Details

- Minor layout and spacing decisions belong here, not in runtime docs.
- Do not use in-app explanatory text to describe implementation details.
- Keep New Thread copy generic while OpenCode is the only normal-user harness.
- If multiple harnesses are enabled, picker labels come from resolved `cli.json`
  display metadata.

<!-- children:start -->
## Children

- [Chat Composer](001-Composer/PAGE.md) - Composer behavior, send/stop/finalization button states, and attachment/input rules.
- [Chat Thread Header](002-Thread_Header/PAGE.md) - Thread header menu behavior, thread-id copy paradigm, and menu styling references.
- [Chat Message List](003-Message_List/PAGE.md) - Message orchestration, where completed reply chrome mounts, and how live/history renderers are composed.
- [Reply Action Chrome](004-Reply_Action_Chrome/PAGE.md) - Standing pattern for per-assistant-reply action chrome, icon order, stubs, disabled states, and fallbacks.
- [Chat Menus And Modals](005-Menus_And_Modals/PAGE.md) - Dropdown, pop-up, modal, component boundary, accessibility, and styling rules for chat UI.
- [Tool Call Rendering](006-Tool_Call_Rendering/PAGE.md) - How tool calls render inside chat messages, and the standing rule for failed tool calls.
<!-- children:end -->
