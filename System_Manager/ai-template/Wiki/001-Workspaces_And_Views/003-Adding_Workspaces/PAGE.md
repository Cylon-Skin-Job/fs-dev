---
name: Adding Workspaces
description: Explains the Add Project, Create New, ribbon membership, registry, and server code paths for Fusion Studio workspaces.
metadata:
  incoming-edges:
    - Workspaces And Views
    - Workspace Paradigm
    - Server And Runtime
  outgoing-edges:
    - View Architecture
    - Themes And State
    - Server And Runtime
  source-files:
    - fusion-studio-client/src/components/WorkspaceRibbon.tsx
    - fusion-studio-client/src/components/WorkspaceAddModal.tsx
    - fusion-studio-client/src/components/WorkspaceCreateModal.tsx
    - fusion-studio-client/src/state/workspaceStore.ts
    - fusion-studio-client/src/lib/ws/workspace-handlers.ts
    - fusion-studio-server/lib/ws/workspace-request-handlers.js
    - fusion-studio-server/lib/ws/workspace-broadcaster.js
    - fusion-studio-server/lib/ws/connection-init.js
    - fusion-studio-server/lib/workspace/workspace-controller.js
    - fusion-studio-server/lib/workspace/workspace-ribbon.js
    - fusion-studio-server/lib/workspace/registry-service.js
    - fusion-studio-server/lib/workspace/bootstrap-service.js
    - fusion-studio-server/lib/workspace/create-service.js
    - System_Manager/ai-template/templates/workspace-templates/new/profile.json
    - System_Manager/ai-template/templates/view-templates
  connected-skills: []
  related-trigger-files: []
---

Use this page when a workspace does not appear in the ribbon, when Add Project or Create New behaves unexpectedly, or when changing the workspace template/copy path.

## Three User Flows

The ribbon's Add menu exposes three different operations:

| Flow | User action | Server effect |
|------|-------------|---------------|
| Add to ribbon | Pick a hidden registered workspace from "Add to ribbon" | Sets `ribbon_visible=1` and a new `ribbon_sort_order`. No filesystem changes. |
| Add Project | Choose an existing project folder | Requires an existing `/ai` folder, bootstraps minimum V2 folders, inserts a `workspaces` registry row, and leaves the current workspace active. |
| Create New | Enter an absolute new project path | Scaffolds `ai/<machine>/...` from templates, inserts a registry row, then switches to the new workspace. |

Do not treat these as synonyms. Hidden workspaces are already registered. Add Project registers an existing project. Create New writes a new project skeleton first, then registers it.

## Client Path

`WorkspaceRibbon.tsx` owns the menu, visible workspace ordering, drag reorder, and hide-from-ribbon button. It reads registered workspaces from `workspaceStore`.

`WorkspaceAddModal.tsx` handles Add Project. It first warns that the selected folder must already contain `/ai`, then opens `FolderPicker` at the `homePath` sent by `workspace:init`. Choosing a folder sends:

```json
{ "type": "workspace:add_requested", "repoPath": "/absolute/project" }
```

`WorkspaceCreateModal.tsx` handles Create New. It asks the server for the create manifest, displays the default included views, validates that the path is absolute, then sends:

```json
{ "type": "workspace:create_requested", "projectPath": "/absolute/project", "label": "Display Name" }
```

`workspaceStore.ts` is intentionally thin: it holds modal/ribbon state and sends WebSocket messages. The server owns validation, registry writes, template copying, active workspace selection, and broadcast results.

## Server Request Path

`client-message-router.js` delegates workspace messages to `workspace-request-handlers.js`. That factory validates basic message shape, then emits event-bus requests such as `workspace:add_requested`, `workspace:create_requested`, `workspace:switch_requested`, and ribbon mutations.

`workspace-controller.js` subscribes to those events at server startup. It is the lifecycle owner for:

- launch availability audit;
- restoring `system_config.last_active_workspace_id`;
- Add Project validation and registry insertion;
- Create New scaffold/register/switch;
- switch/remove requests;
- active workspace row used by sync callers.

`workspace-broadcaster.js` translates lifecycle events back to WebSocket messages. Registry changes are broadcast to every client. Rejections are targeted back to the triggering `connectionId`.

## Add Project

Add Project uses `workspace-controller.handleAddRequested()`:

1. Reject empty, invalid, or missing paths.
2. Canonicalize with `path-service`.
3. Reject duplicate `repo_path` with `workspace:add_rejected_duplicate`.
4. Require an existing `repoPath/ai` directory; otherwise emit `workspace:add_rejected_missing_ai`.
5. Run `bootstrap-service.bootstrap(repoPath)`.
6. Generate a unique workspace id from the folder basename, suffixing `-2`, `-3`, and so on if needed.
7. Insert the row through `registry-service.add()`.
8. Emit `workspace:added` and `workspace:registry_changed`.

Bootstrap is intentionally minimal. It creates missing folders under the existing `ai` tree:

- `ai/<machine>/System/Views`
- `ai/<machine>/System/config`
- `ai/<machine>/System/state`
- `ai/<machine>/System/styles`
- `ai/<machine>/Data`

It does not copy the full template, does not create the core five views, and does not repair stale CSS/theme files. If a registered project needs the current V2 view folders or chrome/theme files, migrate or sync those workspace files explicitly.

## Create New

Create New uses `workspace-controller.handleCreateRequested()`:

1. Require an absolute `projectPath`.
2. Require the parent directory to exist.
3. Allow a missing target folder or an existing empty target folder only.
4. Reject duplicate `repo_path`.
5. Call `create-service.scaffoldProject()`.
6. Insert the registry row with the first selected view's icon.
7. Set the new workspace active, persist `last_active_workspace_id`, and emit `workspace:created`, `workspace:added`, `workspace:registry_changed`, and `workspace:switched`.

`create-service.js` reads `System_Manager/ai-template`. The default `new` workspace template currently selects:

- `doc-viewer`
- `file-viewer`
- `wiki-viewer`
- `issues-viewer`
- `agents-viewer`

Scaffolding always copies the template `System` root. It also copies data roots only when selected views need them: `Captures`, `Wiki`, `Issues`, `Agents`, and `Office`. Selected view templates are copied from `System_Manager/ai-template/templates/view-templates` into `ai/<machine>/System/Views/NNN-view-id/`, numbered by selected order. It also creates `ai/<machine>/Data/Workspace-db/workspace.db` with mirror/audit tables.

The template catalog folder numbers define catalog ordering. Created workspace view folders are numbered from the selected view order for that workspace.

## Registry And Ribbon State

Registered workspaces live in the server SQLite `workspaces` table, not in workspace-local files. `registry-service.js` maps rows into client objects with:

- `id`
- `label`
- `icon`
- `repoPath`
- `sortOrder`
- `type`
- `ribbonVisible`
- `ribbonSortOrder`

The ribbon displays only rows where `ribbonVisible !== false`, sorted by `ribbonSortOrder ?? sortOrder`.

Removing from the ribbon is not deletion. It sets `ribbon_visible=0`, keeps the row registered, invalidates that workspace's runtime cache, and if it was active switches to the nearest remaining visible ribbon workspace. Full workspace removal uses `workspace:remove_requested` and deletes the row plus workspace-owned DB rows such as screenshots/themes.

At launch, `auditRegistryAvailability()` checks registered paths and structure but does not delete rows. Missing or structurally stale workspaces remain registered so the UI can still surface or repair them.

## Switch And Init Behavior

On WebSocket connect, `connection-init.js` sends `workspace:init` with:

- all registered workspaces;
- the active workspace id and repo path;
- home path for folder picking;
- CLI config;
- active workspace themes;
- pre-read shared CSS layers;
- cached view state per workspace.

On `workspace:switched`, the broadcaster sends the new repo path, workspace type, themes, active theme id, and shared CSS. The client then:

1. updates the active workspace id;
2. syncs Electron's workspace root;
3. activates per-workspace panel/file/wiki stores;
4. clears global file-data cache;
5. injects workspace CSS synchronously;
6. hydrates themes;
7. rediscover panels on first visit or sends `set_panel` for cached visits.

If you add a new shared CSS layer, update both style preload lists in `connection-init.js` and `workspace-broadcaster.js`; otherwise the first paint after init/switch may miss that layer until a later fetch.

## Related Pages

- [Workspace Paradigm](../001-Workspace_Paradigm/PAGE.md) - conceptual ownership and activation rules.
- [View Architecture](../002-View_Architecture/PAGE.md) - V2 view capsules, numbering, icons, state, and content roots.
- [Themes And State](../../005-Enforcement/002-Themes_And_State/PAGE.md) - workspace CSS and per-view state boundaries.
- [Server And Runtime](../../002-Server_And_Runtime/PAGE.md) - backend runtime ownership map.
