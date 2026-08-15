---
name: Workspace Paradigm
description: Conceptual rulebook for Fusion Studio workspaces, including ownership boundaries, activation, context loading, and cross-workspace coordination.
metadata:
  incoming-edges:
    - Workspaces And Views
  outgoing-edges:
    - View Architecture
    - Adding Workspaces
    - Chat System Overview
    - Wiki View
    - Ticketing
    - Background Agents
  source-files:
    - fusion-studio-client/src/state/workspaceStore.ts
    - fusion-studio-client/src/state/viewSlice.ts
    - fusion-studio-server/lib/workspace/registry-service.js
    - fusion-studio-server/lib/workspace/workspace-controller.js
    - fusion-studio-server/lib/workspace/bootstrap-service.js
    - fusion-studio-server/lib/workspace/create-service.js
    - fusion-studio-server/lib/office/palette-service.js
    - fusion-studio-server/lib/office/palette-paths.js
    - fusion-studio-server/lib/ws/office-palette-handlers.js
  connected-skills: []
  related-trigger-files: []
---

Use this page for the durable workspace model: what a workspace owns, how views relate to a workspace, and how agents should load context without coupling every domain together.

## Core Rule

A workspace is a bounded domain folder plus the runtime state needed to present and operate on that domain. It owns its content, view configuration, and local conventions. It should not reach into another workspace's internal logic.

## Workspace Boundaries

- Reader workspaces present information and may create work for another system to execute.
- Executor workspaces run work and produce auditable output.
- Board or routing workspaces coordinate work state, but should not know executor internals.
- A user-facing view should not become an agent runner just because it can display agent-related data.
- Shared app state may identify the active workspace and view, but domain behavior should stay inside the owning workspace or server service.

## Reader, Router, Executor

The older workspace docs described a useful separation that remains valid:

| Role | Responsibility | Examples |
|------|----------------|----------|
| Reader + ticket creator | Browse, explain, and request changes | code, wiki, review, skills |
| Router or board owner | Track and dispatch work | issues |
| Executor | Run tasks and record results | background agents |
| Automated pipeline | Execute predefined build/test steps | launch |

Some examples are planned rather than fully implemented. Treat this table as the target ownership model, not a claim that every surface is complete.

## Browsing Versus Activation

Opening or browsing a workspace/view should be cheap. It may hydrate visible state, read files, or load history, but it should not automatically start agent work.

Activation is explicit. For chat, that distinction is visible in the thread runtime: passive browsing opens a thread without warming a harness, while assistant activation or a new thread can start the assistant path.

## Adding, Creating, And Registration

Workspace registration is server-owned. The client may request Add Project, Create New, switch, hide-from-ribbon, add-to-ribbon, or reorder-ribbon operations, but `workspace-controller.js` validates paths, writes registry rows, persists the active workspace, and emits the resulting lifecycle events.

Add Project and Create New are different operations. Add Project requires an existing `/ai` folder and only bootstraps minimum V2 folders under that existing tree. Create New scaffolds a project from `System_Manager/ai-template`, registers it, and switches to it. Ribbon hide/show changes `ribbon_visible`; it does not delete the workspace registration.

For the step-by-step flow and exact code owners, see [Adding Workspaces](../003-Adding_Workspaces/PAGE.md).

## Context Loading

Fusion Studio uses progressive disclosure instead of preloading every document into every agent or view.

- Permanent orientation belongs in project or workspace-level instructions.
- Stable behavioral guardrails belong in skills or rules.
- Living architecture and procedures belong in wiki `PAGE.md` files.
- External truth stays in upstream documentation and is fetched only when needed.

The important constraint is that lower layers are loaded on demand. A view or agent follows pointers to the next layer when it needs deeper context.

## Configuration Discovery

Current runtime configuration is discovered through the active app and workspace code, not through the older five-file agent model as a universal rule.

Do not document `api.json` hot-swapping as current workspace behavior unless current code proves it for the specific path being described. The current default chat harness policy is owned by `cli.json` and server harness configuration.

### Workspace Color Configuration

A registered workspace owns a machine-local palette selector at
`ai/<machine>/System/config/colors.json`. The server resolves that location from
the trusted workspace registry and local machine identity; clients provide a
workspace ID, never a filesystem path. The selector contains its complete local
ordered color array and `sync_enabled`.

When `sync_enabled` is `false`, the workspace's local file is the selected
palette. When it is `true`, the selected palette is the single machine-global
`System_Manager/global-configs/office-custom-color-pallete/colors.json` file.
Add and Remove mutate only that selected file. A Sync toggle changes only the
local selector flag and preserves the local and global arrays. Moving a
workspace to another machine therefore selects that machine's global file when
enabled and its transported machine-local file when disabled.

Missing selected files are represented logically as empty palettes and are
created only by an accepted mutation. Valid files retain their complete ordered
list while the picker projects only the first 20 entries; Add is available only
below 20 stored colors. Files larger than 16,384 bytes or with invalid schema
remain untouched, and selected-source read or write errors never overwrite
either file.

Open, workspace switch, reconnect, and refresh each read the local selector and
selected palette once. External file changes do not push live updates. There is
no palette watcher, union, fanout, merge, retry schedule, removal journal,
timestamp arbitration, or restart-recovery protocol. Rapid A/B/C switching
remains correlated by workspace ID so palette state never projects onto a stale
active workspace, and Office document bytes remain outside palette storage.

## What Not To Couple

- Do not make wiki rendering depend on ticketing internals.
- Do not make issues routing depend on background agent implementation details.
- Do not revive the old built-in iframe assumption. Built-ins should stay React unless product direction changes; browser and custom user views may use iframes.
- Do not duplicate chat runtime ownership rules outside the Chat System and Server And Runtime sections.

## Related Pages

- [View Architecture](../002-View_Architecture/PAGE.md) - view folders, content roots, and loading behavior.
- [Adding Workspaces](../003-Adding_Workspaces/PAGE.md) - registry, ribbon, Add Project, and Create New behavior.
- [Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md) - current thread-centered chat model.
- [Wiki View](../004-Wiki_View/000-Wiki_View/PAGE.md) - folder-first wiki model.
