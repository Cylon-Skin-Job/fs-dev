---
name: Wiki Guidance
description: How the Fusion Studio wiki works — style guide, creating and updating wiki content, and the audit workflow. Start here before writing wiki pages.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

## What Is This?

Fusion Studio is an Electron + React + Node.js desktop workspace app for managing project folders, file/wiki/document views, and AI-assisted chat threads. It owns the workspace shell, persistence, routing, and rendering; AI inference is delegated to configured harnesses like OpenCode.

This wiki is the living documentation for that app — its architecture, rules, subsystems, and operations. It is dual-use: written for human readers and read raw by AI agents.

## How It's Organized

Sections are numbered folders (`NNN-Name`). A section's `000-` child is its front page: hand-written guidance on top, a script-maintained contents block below. Main articles are real articles whose folder `PAGE.md` carries the content and links its sub-articles. The full rules live in [Style Guide](001-Style_Guide/PAGE.md).

## Status

**Fully built out:** Chat System, Workspaces And Views, Enforcement.

**Stubs (planned, not yet populated):** Server And Runtime, Automation And Agents, Integrations And Tools, Operations.

**Legacy (content being migrated into the durable domains):** Project is the original catch-all; System Tools is the original tools bucket, moving to Integrations. Write new content into the durable domains. Leave legacy buckets as read-only sources.

## Wiki System

For wiki viewer architecture, frontmatter schema, or backend wiki code, see [Wiki View](../001-Workspaces_And_Views/004-Wiki_View/PAGE.md).

<!-- section-toc:start -->
## Guidance and Preferences

- [Style Guide](001-Style_Guide/PAGE.md) - Structure, naming, frontmatter, and content rules for writing Fusion Studio wiki pages.
- [Creating Wikis](002-Creating_Wikis/PAGE.md) - Steps for adding new sections, heading articles, main articles, and sub-articles.
- [Updating Wikis](003-Updating_Wikis/PAGE.md) - Rules for editing existing wiki pages without breaking generated blocks, links, or edges.
- [Audit Workflow](004-Audit_Workflow/PAGE.md) - Recurring checks that keep the wiki accurate, linked, and free of ephemera.

## Wiki Sections

- [Project](../001-Project/000-Project/PAGE.md) - Internal project architecture, development workflow, and feature documentation.
- [Workspaces And Views](../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md) - Navigation map for product workspace architecture and user-facing view surfaces.
- [Server And Runtime](../002-Server_And_Runtime/PAGE.md) - Navigation map for backend ownership, runtime state, persistence, WebSockets, path resolution, and process behavior.
- [System Tools](../002-System_Tools/000-System_Tools/PAGE.md) - Internal tools and operational references for maintaining Fusion Studio.
- [Automation And Agents](../003-Automation_And_Agents/PAGE.md) - Navigation map for background agents, ticket routing, orchestration, run auditing, and automation loops.
- [Integrations And Tools](../004-Integrations_And_Tools/PAGE.md) - Navigation map for external systems, local tools, setup-adjacent integrations, hooks, screenshots, secrets, and theme tooling.
- [Enforcement](../005-Enforcement/000-Enforcement/PAGE.md) - Navigation map for standards and rules that constrain implementation and state.
- [Operations](../006-Operations/PAGE.md) - Navigation map for setup, maintenance, startup, packaging, smoke tests, and troubleshooting.
- [System Manager](../006-System_Manager/PAGE.md)
- [Chat System](../007-Chat_System/000-Overview_and_References/PAGE.md) - How the chat system works. Links to more technically detailed articles as well as user decisions and preferences. Consult this section before modifying the Chat System.
- [Workflows](../008-Workflows/PAGE.md) - Reusable AI-driven workflows — prompts and sub-agent orchestrations stored as wiki articles.
- [Fusion Home](../009-Fusion_Home/000-Fusion_Home/PAGE.md) - Fusion Home is the templated workspace that ships with Fusion Studio. It hosts four views (Office, Calendar, ToDo, Email) plus the editor surfaces built within the Office view (Documents, Sheets, Pdfs, Artifacts). Use this section for those bundled apps.
- [Events And Ledger](../010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md) - Durable map for Fusion Studio events, Universal Event Bus, ledger provenance, resource mutations, file versioning, and future system-improvement loops.
<!-- section-toc:end -->
