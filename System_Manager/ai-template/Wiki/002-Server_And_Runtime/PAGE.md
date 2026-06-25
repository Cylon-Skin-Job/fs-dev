---
name: Server And Runtime
description: Navigation map for backend ownership, runtime state, persistence, WebSockets, path resolution, and process behavior.
metadata:
  incoming-edges:
    - Wiki Guide
  outgoing-edges:
    - Runtime Overview
    - Thread Runtime
    - WebSocket Protocol
    - SQLite Persistence
    - Harness Runtime
    - Background Services
    - Path Resolution
  source-files:
    - fusion-studio-server/server.js
    - fusion-studio-server/lib/thread/ThreadRuntimeManager.js
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/wiki/wiki-tree.js
  connected-skills: []
  related-trigger-files: []
---

Use this section for backend ownership, runtime state, persistence, WebSockets, filesystem resolution, and service behavior.

## Planned Children

- `001-Runtime_Overview/` - high-level server/runtime ownership map.
- `002-Thread_Runtime/` - thread identity, active turn state, history hydration, and stop/interrupt behavior.
- `003-WebSocket_Protocol/` - client/server message protocol and live stream routing.
- `004-SQLite_Persistence/` - database ownership, migrations, and persisted runtime records.
- `005-Harness_Runtime/` - harness process ownership, adapters, and routing boundaries.
- `006-Background_Services/` - background process/service behavior and durable service lessons.
- `007-Path_Resolution/` - resource, workspace, and wiki path resolution.

## Migration Sources

- [Chat System > Runtime Model](../001-Workspaces_And_Views/003-Chat_System/001-Architecture/006-Runtime_Model/PAGE.md)
- [Chat System > Protocol](../001-Workspaces_And_Views/003-Chat_System/001-Architecture/004-Protocol/PAGE.md)
- [Project > Path Resolution](../001-Project/004-Path_Resolution/PAGE.md)
- [Project > Background Services Audit](../001-Project/014-Background_Services_Audit/PAGE.md)
- [Project > Hooks](../001-Project/018-Hooks/PAGE.md)
- [Project > Warmth Settings](../001-Project/023-Warmth_Settings/PAGE.md)

Avoid duplicating protocol/runtime docs. If a topic stays under Chat System, link to it from here instead of rewriting it differently.
