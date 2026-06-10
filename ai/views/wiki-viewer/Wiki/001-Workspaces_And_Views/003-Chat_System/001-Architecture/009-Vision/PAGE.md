---
name: Chat System Vision
description: Product and developer goals for the chat system. Use this page to preserve the desired user experience while changing runtime, rendering, or harness behavior.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
  outgoing-edges:
    - Chat System Decisions
    - Chat System Runtime Model
    - Chat System UI Surface
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

## Developer-Level Principles

- Thread id is the stream routing key.
- Server owns prompt acceptance and stop/interruption.
- SQLite exchanges are the durable source for completed turns.
- In-memory live snapshots bridge the gap between durable history and active
  turns.
- `cli.json` is the single harness policy surface.
