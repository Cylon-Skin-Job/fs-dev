---
name: Chat System Overview and References
description: How the chat system works. Links to more technically detailed articles as well as user decisions and preferences. Consult this section before modifying the Chat System.
metadata:
  last-modified: "2026-09-19T10:34:31Z"
  incoming-edges: []
  outgoing-edges: []
  source-files:
    - fusion-studio-server/lib/thread-groups/service.js
    - fusion-studio-server/lib/thread-groups/repository.js
    - fusion-studio-server/lib/thread-groups/move-service.js
    - fusion-studio-server/lib/view-state/thread-worksurface.js
    - fusion-studio-client/src/components/chat/chatSurfaceContract.ts
    - fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx
    - fusion-studio-client/src/lib/ws/threadGroupRows.ts
    - fusion-studio-server/lib/thread/thread-crud.js
    - fusion-studio-server/lib/ws/thread-ws-handlers.js
    - fusion-studio-client/src/components/ChatArea.tsx
    - fusion-studio-client/src/components/chat/ViewWorksurfaceDock.tsx
  connected-skills: []
  related-trigger-files: []
---

Start here before changing Fusion Studio chat.

Documentation baseline: source-inspected on 2026-09-19 in the development checkout at `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, with local wiki corrections and unrelated Office/runtime changes present. The checked themes are identity, ordering, links, target/open/create behavior, UI placement, source ownership, and current versus future classification. This is not a runtime test, an installed Alpha certification, or an exhaustive recertification of the rendering, security, harness, and persistence internals described elsewhere in this section.

Chat is a core system, not just a view. It crosses SQLite persistence, thread identity, harness adapters, the universal event bus, WebSocket application messages, renderer state, message rendering, chat UI, clipboard behavior, metadata, search/recall, and smoke testing.

A visible Thread is a durable body of work containing peer chat sessions. Its Main Chat is the current primary session; Side Chats present other members in content tabs. Internally, `threadGroupId` identifies that visible Thread and owns its title, membership, primary selection, visible ordering, and immutable workspace/view binding. A chat session keeps its own `threadId` for its transcript, runtime, draft, model selection, prompt/Stop targeting, turns, and provenance. Main and Side are presentation roles, not different kinds of conversation identity.

Fusion Studio chat is server-owned. Live stream routing still uses the session `threadId`, and completed history hydrates from SQLite `exchanges`. Harness output is translated into canonical chat events before it reaches application state. The renderer presents state and sends user intents; it does not own persistence.

Rename and Delete address the visible Thread/group; Send and Stop address one session. View content continuity is stored under `viewStates[viewId].threadWorksurfaces[threadGroupId]` in the owning view capsule. `viewId: null` denotes the explicit workspace Legacy population, never the active view, and has no view worksurface. A mounted `surfaceId` is transient UI identity; a `sideChatPlacementId` is durable tab placement identity. Closing a Side Chat tab closes that placement without deleting its session or group membership. Move preserves the existing session and creates a new empty Main peer without copying conversation context. See [Thread Identity](../001-Identity_And_Persistence/001-Thread_Identity/PAGE.md) for identity and action ownership.

Current production placement is transitional: the normal workspace chat column remains the null-view Legacy host, while five built-in views expose separate, initially collapsed View Threads docks. See the [current host and Move map](../004-Chat_UI/PAGE.md#current-production-hosts-and-move-eligibility). The [September 19 owner direction](002-Decisions/PAGE.md#2026-09-19--side-chat-tabs-and-non-chat-windows) keeps each Side Chat as one chat in a content tab, removes its left-hand Show threads control and sliding thread-panel behavior, retains the right-hand list button with its future shared behavior still undefined, and requests a separate non-chat window container. Current code still wires the left-hand outer-dock toggle; this is remaining product work. Whether view-bound chat replaces Legacy as the default remains unresolved.

The Electron renderer shell loads only at `fusion-shell://app`. Electron gives that exact current main frame a public runtime descriptor for one server launch generation. The renderer's runtime transport validates that descriptor and is the sole owner of WebSocket, HTTP API, and server-resource endpoints. A missing or malformed descriptor leaves the shell visibly disconnected; it never falls back to the page URL, `localhost`, or a fixed development port. This public descriptor is endpoint information only. Each Electron server launch also owns an in-memory master delivered once over inherited pipe fd 3. Every renderer socket must complete the bounded `shell-auth:*` challenge/HMAC exchange before any per-connection product/router factory runs, initialization is released, or the socket enters any product recipient map. The server first completes its startup audit, installs shutdown supervision, publishes application handler owners, and opens a runtime-activation barrier. It publishes the authenticated acknowledgement only after product session activation succeeds beyond that barrier. A separate transport-only registry owns every upgraded socket for expiry, abnormal close, restart, and shutdown without making pending sockets product recipients. Graceful shutdown awaits every owned close event before process exit, so activated product cleanup completes. Only the server records the resulting `trusted-shell` connection role; authentication never enters app stores, SQLite, Provenance, or the UEB. The thread WebSocket domain consumes only that private live role before New Chat, assistant activation/resume, Rename, Delete, Warm, or prompt-triggered runtime activation can reach their manager, provider, persistence, mirror, or fan-out owners. Passive `thread:open` only hydrates and does not write resume/MRU state. Legacy `thread:fork` is unconditionally unavailable to every role, including through stored provider configuration. Every production harness/CLI launch receives a closed, family-specific allowlisted environment from the server-owned child-environment builder; unknown host variables and shell-authority material never transit by default.

Passive row browsing uses `thread:open` with `threadGroupId` to hydrate the server-resolved Main Chat. Lists are scoped to the connection's workspace and one nullable view: null/omission means Legacy, not every view. Session-addressed compatibility open still selects the group's primary, so it is not an exact Side Chat hydration route. Trusted `thread:open-assistant` handles activation and currently eager New Chat, committing a session and one-member group before provider startup; Pending New Chat/provider-signal-gated commit remains future work. Unknown explicit group, foreign session, unknown session-only ID, and omitted IDs have different outcomes; see [Runtime Model](../006-Runtime_Model/PAGE.md#new-thread-and-activation) before changing create/resume behavior.

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
