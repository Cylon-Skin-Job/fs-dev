---
name: Chat Vision
description: Product and developer goals for the chat system. Use this page to preserve the desired user experience while changing runtime, rendering, harness, or UI behavior.
metadata:
  last-modified: "2026-09-19T10:34:31Z"
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Decisions
    - Chat Rendering And Lifecycle
    - Chat UI
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

The chat experience should feel like a durable control room for agent work, not
like a transient web chat window.

## Product Goals

- A user can leave a thread, inspect other work, and return to the correct live
  or completed state.
- Background work can continue while the user browses other threads or
  workspaces.
- New Chat is simple by default. In the current config, there is no harness
  selector because OpenCode is the only enabled harness.
- Advanced users can edit `cli.json` to enable additional harnesses. The hooks
  remain, but the normal surface is OpenCode-first.
- Stop behaves like CLI Escape: settle what exists, persist it, and allow a
  follow-up prompt.
- The UI should never leave users staring at an orb after the backend has
  already produced useful output or ended cleanly.

## User-Level Principles

- Browsing is not intent to send. Opening a thread should hydrate it, not warm or
  spawn a harness.
- Focusing or typing in the input is intent to send and may warm a cold runtime.
- Send is a fallback warm path and should give clear connecting feedback.
- Completed turns should be instantly inspectable after navigation.
- Visible thinking is a capability, not a guarantee. Do not fake a thought trace
  from reasoning token counts.

## Chat Placement Direction

Owner direction is chat in content tabs: each Side Chat is one session without a nested or left-column thread list. Remove the Side Chat tab's left-hand Show threads button and sliding thread-panel behavior; retain its right-hand list button, whose future shared action is still undecided. The current left-hand outer-dock toggle is a product gap, not a permanent requirement. The normal workspace host remains Legacy today; whether view-bound chat becomes the default has not been decided. See [Chat UI](../../004-Chat_UI/PAGE.md#main-chat-side-chat-and-move) for source-inspected placement and [September 19 Decisions](../002-Decisions/PAGE.md#2026-09-19--side-chat-tabs-and-non-chat-windows) for the latest intent.

The retired floating/minimized Secondary Chat must not return as a chat mode. Recover a separate windowed container for non-chat content, including minimizing to a small button and reopening. A generic container is not currently available; content types, persistence, placement ownership, native OS window use, sticky-right behavior, and animation remain unresolved.

## Developer-Level Principles

- The visible Thread is a body of work with peer chat sessions; Main and Side describe presentation roles. Renaming or deleting the visible Thread is group-scoped, while a prompt or Stop targets one session.
- Session `threadId` is the stream routing key. `threadGroupId` identifies the visible Thread and its view continuity; tab placement and transient mounted UI identity stay separate.
- Server owns prompt acceptance and stop/interruption.
- SQLite exchanges are the durable source for completed turns.
- In-memory live snapshots bridge the gap between durable history and active
  turns.
- `cli.json` is the single harness policy surface.
