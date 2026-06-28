---
name: Wiki Guide
description: Root navigation map for the Fusion Studio wiki and its durable system domains.
metadata:
  incoming-edges: []
  outgoing-edges:
    - Workspaces And Views
    - Chat System
    - Server And Runtime
    - Automation And Agents
    - Integrations And Tools
    - Enforcement
    - Operations
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Use this page when you only need to find your way around the wiki.

The wiki is being reorganized from the older `Project`, `System Tools`, and `Enforcement` buckets into durable system domains. During migration, some content still lives under the old folders until it is moved or condensed.

## Top-Level Domains

- [Workspaces And Views](001-Workspaces_And_Views/PAGE.md) - product workspace model, view architecture, wiki, browser, file, agent, and issues surfaces.
- [Chat System](007-Chat_System/PAGE.md) - thread identity, persistence, harness/event flow, rendering lifecycle, chat UI, user metadata, text payloads, and test operations.
- [Server And Runtime](002-Server_And_Runtime/PAGE.md) - backend ownership, runtime state, persistence, WebSockets, filesystem resolution, and service behavior.
- [Automation And Agents](003-Automation_And_Agents/PAGE.md) - background agents, ticket routing, orchestration, run auditing, and automation loops.
- [Integrations And Tools](004-Integrations_And_Tools/PAGE.md) - external systems, local tools, setup-adjacent integrations, hooks, screenshots, secrets, and theme tooling.
- [Enforcement](005-Enforcement/PAGE.md) - standards and rules that constrain implementation and state.
- [Operations](006-Operations/PAGE.md) - setup, maintenance, startup, packaging, smoke tests, and troubleshooting.

## Transitional Folders

These folders remain while their durable content is moved into the new domains:

- [Project](001-Project/PAGE.md)
- [System Tools](002-System_Tools/PAGE.md)

## How To Navigate

- Use the left sidebar as the main table of contents.
- Select a top-level domain to open its overview page.
- When a selected article has child pages, the right sidebar shows those child pages.
- Click right-sidebar items to read related subpages without losing the current article context.
- Select a different item on the left to change the right-sidebar context.

## When You Need To Edit The Wiki

For adding pages, changing structure, updating frontmatter, touching backend wiki code, or building search/query tooling, start with [Workspaces And Views > Wiki View](001-Workspaces_And_Views/004-Wiki_View/PAGE.md).
