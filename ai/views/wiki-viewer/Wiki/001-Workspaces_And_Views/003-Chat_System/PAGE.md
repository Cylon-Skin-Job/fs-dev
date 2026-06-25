---
name: Chat System Overview
description: Overview of Fusion Studio's thread-centered chat system, including runtime ownership, persistence, streaming, rendering, harness policy, and stop behavior.
metadata:
  incoming-edges:
    - Home
    - Workspaces
    - Workspace Agent Model
    - Workspace Index
    - Progressive Disclosure
    - Wiki Guide
    - Workspaces And Views
  outgoing-edges:
    - Chat System Architecture
    - Chat System Runtime Model
    - Chat System Rendering Model
    - Chat System Protocol
    - Chat System UI Surface
    - Chat System Structure
    - Chat System Decisions
    - Chat System Lessons
    - Chat System Changelog
  source-files:
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/thread/thread-runtime-manager.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-client/src/lib/ws/stream-handlers.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
  connected-skills: []
  related-trigger-files: []
---

Start here when working on Fusion Studio chat.

Chat is now a thread-centered system. The persistent identity is the thread, not
the workspace tab or current view. Project chat follows the workspace across
views, hydrates from SQLite exchanges, streams through canonical harness events,
and renders live turns through a separate live overlay path.

## Current Model

- `cli.json` is the harness policy. In the current default config, OpenCode is
  the only listed/enabled harness, so New Thread creates an OpenCode thread
  directly and no harness picker is shown.
- Passive browsing uses `thread:open`. It hydrates history and live snapshot
  state without warming or spawning a harness process.
- Assistant activation and new thread creation use `thread:open-assistant`.
- Prompt acceptance is server-owned. The user bubble is committed on
  `message:sent`, not on optimistic client send.
- Live streams route by `threadId`. Workspace and view context describe where
  the thread belongs, but thread id is the routing key.
- Active in-memory turns can be overlaid on top of SQLite history when a thread
  is revisited.
- Stop is server-owned. Interrupted turns persist as partial assistant
  exchanges instead of disappearing.
- `Send to chat` creates metadata-backed link attachment pills above the
  composer instead of inserting raw file paths into the textarea.
- Filename autocomplete is plain text only. It uses a narrow RAM candidate set
  from open non-`.md` file tabs and exchange metadata; it does not create
  structured attachments.

## Architecture Map

- [Architecture](001-Architecture/PAGE.md) - current system overview.
- [Vision](001-Architecture/009-Vision/PAGE.md) - desired product experience.
- [Runtime Model](001-Architecture/006-Runtime_Model/PAGE.md) - threads, harnesses,
  warm/cold state, prompt acceptance, stop, persistence.
- [Rendering Model](001-Architecture/005-Rendering_Model/PAGE.md) - live vs instant
  rendering, reveal, finalization.
- [Protocol](001-Architecture/004-Protocol/PAGE.md) - WebSocket and canonical event
  contracts.
- [UI Surface](001-Architecture/008-UI_Surface/PAGE.md) - layout, controls, visible
  states, small styling rules.
- [Structure](001-Architecture/007-Structure/PAGE.md) - file/module map.
- [Decisions](001-Architecture/002-Decisions/PAGE.md) - durable choices.
- [Lessons](001-Architecture/003-Lessons/PAGE.md) - bugs and traps not to relearn.
- [Changelog](001-Architecture/001-Changelog/PAGE.md) - dated evolution.

## Maintenance Reference

Keep chat architecture, lifecycle, decisions, lessons, and changelog material in this tree so Workspaces And Views has one top-level Chat System article.
Do not maintain separate chat architecture or lifecycle pages elsewhere in the wiki.
