---
name: Chat System Overview and References
description: How the chat system works. Links to more technically detailed articles as well as user decisions and preferences. Consult this section before modifying the Chat System.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Start here before changing Fusion Studio chat.

Chat is a core system, not just a view. It crosses SQLite persistence, thread identity, harness adapters, the universal event bus, WebSocket application messages, renderer state, message rendering, chat UI, clipboard behavior, metadata, search/recall, and smoke testing.

Fusion Studio chat is thread-centered and server-owned. The thread is the durable conversational identity; live stream routing uses `threadId`. Completed history hydrates from SQLite `exchanges`. Harness output is translated into canonical chat events before it reaches application state. The renderer presents state and sends user intents; it does not own persistence.

The Electron renderer shell loads only at `fusion-shell://app`. Electron gives
that exact current main frame a public runtime descriptor for one server launch
generation. The renderer's runtime transport validates that descriptor and is
the sole owner of WebSocket, HTTP API, and server-resource endpoints. A missing
or malformed descriptor leaves the shell visibly disconnected; it never falls
back to the page URL, `localhost`, or a fixed development port. This public
descriptor is endpoint information only. Each Electron server launch also owns
an in-memory master delivered once over inherited pipe fd 3. Every renderer
socket must complete the bounded `shell-auth:*` challenge/HMAC exchange before
any per-connection product/router factory runs, initialization is released, or
the socket enters any product recipient map.
The server first completes its startup audit, installs shutdown supervision,
publishes application handler owners, and opens a runtime-activation barrier.
It publishes the authenticated acknowledgement only after product session
activation succeeds beyond that barrier. A separate transport-only registry
owns every upgraded socket for expiry, abnormal close, restart, and shutdown without
making pending sockets product recipients. Graceful shutdown awaits every
owned close event before process exit, so activated product cleanup completes.
Only the server records the resulting
`trusted-shell` connection role; authentication never enters app stores,
SQLite, Provenance, or the UEB. The thread WebSocket domain consumes only that
private live role before New Chat, assistant activation/resume, Rename, Delete,
Touch, Warm, or prompt-triggered runtime activation can reach their manager,
provider, persistence, mirror, or fan-out owners. Passive `thread:open` only
hydrates and does not write resume/MRU state. Legacy `thread:fork` is
unconditionally unavailable to every role, including through stored provider
configuration.
Every production harness/CLI launch receives a closed, family-specific
allowlisted environment from the server-owned child-environment builder;
unknown host variables and shell-authority material never transit by default.

The live-turn contract is also turn- and sequence-bound. Each accepted prompt owns one immutable canonical route context and unique drain, every accepted in-flight publication carries the bound `threadId`, `turnId`, and authoritative `streamSeq`, and the client rejects or buffers frames before mutation according to that frontier. Provider-neutral `step_begin` drives a transient Working row; readable thinking remains actual model output. Failed accepted turns finalize through one safe catalog error, while detailed redacted diagnostics are retrieved only after an explicit user action.

Orient with [Runtime Model](../006-Runtime_Model/PAGE.md) and [Structure](../007-Structure/PAGE.md) before diving into the subsystem articles.

<!-- section-toc:start -->
## Guidance and Preferences

- [Vision](001-Vision/PAGE.md) - Product and developer goals for the chat system. Use this page to preserve the desired user experience while changing runtime, rendering, harness, or UI behavior.
- [Decisions](002-Decisions/PAGE.md) - Durable decisions for Fusion Studio chat. Use this page before changing harness policy, runtime ownership, prompt acceptance, stop behavior, metadata, or thinking display.
- [Lessons](003-Lessons/PAGE.md) - Recurring traps and learned constraints for chat system work. Use this page to avoid reintroducing stale Kimi-era, cursor, pressure, broad mention, or fake-thinking behavior.
- [Changelog](004-Changelog/PAGE.md) - Dated record of chat system architecture changes. Use this page to understand when runtime, harness, rendering, and UI behavior changed.

## Technical Articles in this Wiki Section

- [Identity And Persistence](../001-Identity_And_Persistence/PAGE.md) - Rules for thread identity, turn identity, exchange storage, and exchange metadata in Fusion Studio chat.
- [Harness And Event Flow](../002-Harness_And_Event_Flow/PAGE.md) - Boundary between provider harness output, canonical chat events, the universal event bus, and WebSocket application messages.
- [Rendering And Lifecycle](../003-Rendering_And_Lifecycle/PAGE.md) - Live rendering, history rendering, turn finalization, stop behavior, and interrupted-turn persistence rules.
- [Chat UI](../004-Chat_UI/PAGE.md) - Composer, thread header, message list, reply chrome, menus, modals, and chat styling rules.
- [Testing And Operations](../005-Testing_And_Operations/PAGE.md) - Vertical smoke tests, browser Playwright, Electron Playwright, and Fusion restart guidance for chat work.
- [Runtime Model](../006-Runtime_Model/PAGE.md) - Explains how chat threads are opened, warmed, streamed, stopped, persisted, and resumed. Use this page when changing runtime state or thread lifecycle behavior.
- [Structure](../007-Structure/PAGE.md) - File and module map for chat system work. Use this page to find the server, client, harness, WebSocket, renderer, and state modules involved in chat.
<!-- section-toc:end -->
