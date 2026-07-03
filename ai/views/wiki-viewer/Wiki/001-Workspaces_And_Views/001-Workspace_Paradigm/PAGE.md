---
name: Workspace Paradigm
description: Conceptual rulebook for Fusion Studio workspaces, including ownership boundaries, activation, context loading, and cross-workspace coordination.
metadata:
  incoming-edges:
    - Workspaces And Views
  outgoing-edges:
    - View Architecture
    - Chat System Overview
    - Wiki View
    - Ticketing
    - Background Agents
  source-files:
    - fusion-studio-client/src/state/workspaceStore.ts
    - fusion-studio-client/src/state/viewSlice.ts
    - fusion-studio-server/lib/workspace/registry-service.js
    - fusion-studio-server/lib/workspace/workspace-controller.js
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

## What Not To Couple

- Do not make wiki rendering depend on ticketing internals.
- Do not make issues routing depend on background agent implementation details.
- Do not make view mounting depend on a single React-only or iframe-only assumption without checking the current loader.
- Do not duplicate chat runtime ownership rules outside the Chat System and Server And Runtime sections.

## Related Pages

- [View Architecture](../002-View_Architecture/PAGE.md) - view folders, content roots, and loading behavior.
- [Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md) - current thread-centered chat model.
- [Wiki View](../004-Wiki_View/000-Wiki_View/PAGE.md) - folder-first wiki model.
