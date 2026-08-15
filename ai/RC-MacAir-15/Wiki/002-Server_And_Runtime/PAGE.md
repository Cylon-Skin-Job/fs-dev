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
    - Viewer Search
  source-files:
    - fusion-studio-server/server.js
    - fusion-studio-server/lib/thread/ThreadRuntimeManager.js
    - fusion-studio-server/lib/workspace/workspace-controller.js
    - fusion-studio-server/lib/workspace/registry-service.js
    - fusion-studio-server/lib/workspace/bootstrap-service.js
    - fusion-studio-server/lib/workspace/create-service.js
    - fusion-studio-server/lib/ws/workspace-request-handlers.js
    - fusion-studio-server/lib/ws/workspace-broadcaster.js
    - fusion-studio-server/lib/ws/connection-init.js
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/views/panel-paths.js
    - fusion-studio-server/lib/view-state/defaults.js
    - fusion-studio-server/lib/view-state/resolver.js
    - fusion-studio-server/lib/view-state/writer.js
    - fusion-studio-server/lib/file-explorer.js
    - fusion-studio-server/lib/http/panel-file-route.js
    - fusion-studio-server/lib/wiki/wiki-tree.js
    - fusion-studio-client/src/hooks/useViewerSearchIndex.ts
  connected-skills: []
  related-trigger-files: []
---

Use this section for backend ownership, runtime state, persistence, WebSockets, filesystem resolution, and service behavior.

## Current Workspace Lifecycle Runtime

- The workspace registry lives in the server SQLite database. `registry-service.js` is pure data access; `workspace-controller.js` owns lifecycle decisions and emits events.
- `workspace-request-handlers.js` receives WebSocket requests and emits event-bus requests. `workspace-broadcaster.js` turns controller events back into WebSocket messages.
- Add Project requires an existing `/ai` folder and calls `bootstrap-service.js` to create only the minimum machine-scoped V2 folders.
- Create New calls `create-service.js`, which copies from `System_Manager/ai-template`, creates selected numbered view capsules, creates the workspace mirror database, registers the workspace, and switches to it.
- Launch availability checks warn and emit status for missing or invalid registered workspaces, but do not delete registry rows.

For the full user and code path, see [Workspaces And Views > Adding Workspaces](../001-Workspaces_And_Views/003-Adding_Workspaces/PAGE.md).

## Current View Path Runtime

- `fusion-studio-server/lib/views/index.js` is the V2 view resolver. It discovers `ai/<machine>/Views/NNN-view-id/` capsules, loads `manifest.md`, `content.json`, `styles/icon.md`, and `styles/layout.json`, and resolves declared content roots.
- `fusion-studio-server/lib/views/panel-paths.js` maps panels to the resolved content root. V2 paths win; if a registered workspace has no V2 `ai/<machine>/Views/` root, it can still read legacy `ai/views/<id>/`, `ai/system/workspace`, and `ai/system/styles` so older registered workspaces remain switchable.
- `fusion-studio-server/lib/file-explorer.js` serves WebSocket tree/content requests and virtual V2 metadata aliases such as `__workspace__/views.json` and `__panels__/<view-id>/...`.
- `fusion-studio-server/lib/http/panel-file-route.js` serves files from the same resolved panel path as the WebSocket file explorer.
- `doc-viewer` resolves to `ai/${machine}/Captures`; normal root listings hide `999-Archive`, while Archive mode lists that folder directly.
- `office-viewer` resolves to `ai/${machine}/Office`; normal root listings hide `999-Archive`, while Archive mode lists that folder directly.
- `wiki-viewer` resolves through `content.json`, defaulting to `ai/${machine}/Wiki`.

Viewer search is client-side over these resolved panel paths. The server supplies `file_tree_request` and `file_content_request`; view adapters decide search scope and exclusions. See [Viewer Search](../001-Workspaces_And_Views/012-Viewer_Search/PAGE.md).

## Current View State Runtime

View-local state is resolved by `fusion-studio-server/lib/view-state/resolver.js` and written by `writer.js`. The client sends `state:get` and `state:set` messages. The server deep-merges workspace defaults with the per-view state file under the numbered view capsule.

The following view-local branches are intentionally persisted in `state/state.json`:

- Capture mode, selected path, grid scroll, and document scroll.
- Office document Recent drawer state.
- Shared `activity` for recents, wiki navigation, and File Explorer tabs.
- Shared `collections` for starred files and Office pinned folders.

The server does not own viewer recents through the old Recent Docs SQLite path. Recents are view-local state now. File rename/archive/restore/delete flows call shared path-reference cleanup so activity and collections stay aligned with filesystem changes.

## Planned Children

- `001-Runtime_Overview/` - high-level server/runtime ownership map.
- `002-Thread_Runtime/` - thread identity, active turn state, history hydration, and stop/interrupt behavior.
- `003-WebSocket_Protocol/` - client/server message protocol and live stream routing.
- `004-SQLite_Persistence/` - database ownership, migrations, and persisted runtime records.
- `005-Harness_Runtime/` - harness process ownership, adapters, and routing boundaries.
- `006-Background_Services/` - background process/service behavior and durable service lessons.
- `007-Path_Resolution/` - resource, workspace, and wiki path resolution.

## Migration Sources

- [Chat System > Runtime Model](../007-Chat_System/006-Runtime_Model/PAGE.md)
- [Chat System > Protocol](../007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md)
- [Project > Path Resolution](../001-Project/004-Path_Resolution/PAGE.md)
- [Project > Background Services Audit](../001-Project/014-Background_Services_Audit/PAGE.md)
- [Project > Hooks](../001-Project/018-Hooks/PAGE.md)
- [Project > Warmth Settings](../001-Project/023-Warmth_Settings/PAGE.md)

Avoid duplicating protocol/runtime docs. If a topic stays under Chat System, link to it from here instead of rewriting it differently.
