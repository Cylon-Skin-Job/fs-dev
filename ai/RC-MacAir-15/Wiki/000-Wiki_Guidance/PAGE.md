---
name: Wiki Guidance
description: How the Fusion Studio wiki works — style guide, creating and updating wiki content, and the audit workflow. Start here before writing wiki pages.
metadata:
  source-files: []
  last-modified: "2026-09-28T04:56:08Z"
---

## What Is This?

Fusion Studio is an Electron + React + Node.js desktop workspace app for managing project folders, file/wiki/document views, and AI-assisted chat threads. It owns the workspace shell, persistence, routing, and rendering; AI inference is delegated to configured harnesses like OpenCode.

This wiki is the living documentation for that app — its architecture, rules, subsystems, and operations. It is dual-use: written for human readers and read raw by AI agents.

## How It's Organized

Sections are numbered folders (`NNN-Name`). A section's `000-` child is its front page: hand-written guidance on top, a script-maintained contents block below. Main articles are real articles whose folder `PAGE.md` carries the content and links its sub-articles. The full rules live in [Style Guide](001-Style_Guide/PAGE.md).

## How to use this wiki

Start with the relevant section front page, then follow the topic links and source files named by an article. Read the depth needed for the current question. Reusable agent skills may hold repeatable capabilities; this wiki records Fusion Studio’s durable architecture, decisions, open choices and context. Keep each explanation in its owning article and link to it elsewhere. Use code and tests to establish observed behavior; local code comments can still clarify implementation. A task’s current instructions take precedence over general guidance.

## Status

**Source-inspected current contracts:** Chat System, Workspaces And Views, Events And Ledger, Platform And Plugins and the subject pages linked below distinguish current behavior from approved direction. Some specialized articles still need separate recertification.

**Active subject guidance:** Server And Runtime, Automation And Agents, Integrations And Tools and Operations now contain verified subject pages. A domain’s documentation coverage does not prove every proposed feature has shipped.

**Consolidated navigation:** Former Project, System Tools and duplicate System Manager subjects now live with their domain owners. Retired text and existing history are preserved outside live navigation in `.versions/`. Write new content in the current domains.

## Wiki System

For wiki viewer architecture, frontmatter schema, or backend wiki code, see [Wiki View](../001-Workspaces_And_Views/004-Wiki_View/000-Wiki_View/PAGE.md).

<!-- section-toc:start -->
## Guidance and Preferences

- [Style Guide](001-Style_Guide/PAGE.md) - Structure, naming, frontmatter, and content rules for writing Fusion Studio wiki pages.
- [Creating Wikis](002-Creating_Wikis/PAGE.md) - Steps for adding new sections, heading articles, main articles, and sub-articles.
- [Updating Wikis](003-Updating_Wikis/PAGE.md) - Rules for editing wiki pages while preserving generated blocks, source accountability, timestamps, and version history.
- [Audit Workflow](004-Audit_Workflow/PAGE.md) - Recurring checks that keep the wiki accurate, linked, and free of ephemera.
- [User Profile Preferences and Design Philosophy](005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md) - Working guidance for communicating with the owner, shaping software, coordinating automation, and keeping human decisions at the right points.

## Wiki Sections

- [Workspaces And Views](../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md) - Start here to distinguish a project folder, workspace, view plugin, installed view, content root, and tab; routes to current behavior and intended changes.
- [Server And Runtime](../002-Server_And_Runtime/PAGE.md) - Navigation map for backend ownership, runtime state, persistence, WebSockets, path resolution, and process behavior.
- [Automation And Agents](../003-Automation_And_Agents/PAGE.md) - Navigation map for background agents, ticket routing, orchestration, run auditing, and automation loops.
- [Integrations And Tools](../004-Integrations_And_Tools/PAGE.md) - Navigation map for external systems, local tools, setup-adjacent integrations, hooks, screenshots, secrets, and theme tooling.
- [Enforcement](../005-Enforcement/000-Enforcement/PAGE.md) - Navigation map for standards and rules that constrain implementation and state.
- [Operations](../006-Operations/PAGE.md) - Navigation map for setup, maintenance, startup, packaging, smoke tests, and troubleshooting.
- [Chat System](../007-Chat_System/000-Overview_and_References/PAGE.md) - How the chat system works. Links to more technically detailed articles as well as user decisions and preferences. Consult this section before modifying the Chat System.
- [Workflows](../008-Workflows/PAGE.md) - Reusable documentation workflows with bounded research and coordinator-owned changes.
- [Fusion Home](../009-Fusion_Home/000-Fusion_Home/PAGE.md) - Fusion Home Office and editor-surface guidance, with current profile selection and planned neighboring apps distinguished.
- [Events And Ledger](../010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md) - Read the System boundary, inspected provenance behavior, approved direction, and open choices before designing event or storage changes.
- [Platform And Plugins](../011-Platform_And_Plugins/000-Platform_And_Plugins/PAGE.md) - Start here for the approved roles of the shell, services, components, plugins, view instances and custom regions, with current foundations and open choices separated.
<!-- section-toc:end -->
