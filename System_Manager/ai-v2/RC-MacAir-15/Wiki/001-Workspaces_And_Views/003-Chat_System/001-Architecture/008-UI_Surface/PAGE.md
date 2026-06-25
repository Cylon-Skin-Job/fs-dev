---
name: Chat System UI Surface
description: Visible chat controls, layout, and interaction states. Use this page when changing New Thread, sidebar/header behavior, input warm intent, stop feedback, or tool UI.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
    - Chat System Rendering Model
  outgoing-edges:
    - Chat System Runtime Model
    - Chat System Decisions
  source-files:
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - fusion-studio-client/src/components/chat/ChatAreaHeader.tsx
    - fusion-studio-client/src/components/chat/SendButtonGroup.tsx
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-client/src/components/Sidebar.tsx
    - fusion-studio-client/src/components/ToolCallBlock.tsx
  connected-skills: []
  related-trigger-files: []
---

Layout, controls, and visible states for chat.

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
