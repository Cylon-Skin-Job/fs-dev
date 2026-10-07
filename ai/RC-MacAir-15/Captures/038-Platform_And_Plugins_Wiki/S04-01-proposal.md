---
name: Workspaces And Views
description: Start here to distinguish a project folder, workspace, view plugin, installed view, content root, and tab; routes to current behavior and intended changes.
metadata:
  source-files:
    - fusion-studio-server/lib/workspace/create-service.js
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-client/src/components/ContentArea.tsx
  last-modified: "2026-09-21T13:37:22Z"
---

This section separates **what Fusion Studio does now**, **the approved direction**, and **choices still open**. It covers the workspace shell and view surfaces. The [Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md) owns chat group, session, and placement identity; [Events And Ledger](../../010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md) owns event and provenance contracts. A link into either section does not transfer its authority here.

## The terms

A **project folder** is a folder on disk; it need not be a Git repository. A **workspace** is Fusion Studio's registration and binding to a project folder, together with the configuration and presentation used to work in it. A **view plugin** is the intended installable definition of a view's display, content behavior, tabs, templates, and allowed capabilities. An **installed view instance** is the workspace's own configuration and agent resources that refer to that definition. A **content root** tells a view where its material lives; it is separate from the view instance's configuration folder. A **tab** is a presentation of content within a view, not another view instance or another workspace. Plugin is broader than view plugin: a workspace plugin can declare a composition of view plugins.

Keep identity, label, and order separate. Renaming a view or moving it in the sidebar should not silently redefine which instance it is. The current server discovers view IDs from `manifest.md` metadata and orders numbered folders; the [View Architecture](../002-View_Architecture/PAGE.md) article traces that code and the intended plugin identity model.

## Current implementation and approved direction

Today, workspace creation copies selected **bundled** view templates into `ai/<machine>/System/Views/`; the renderer dispatches built-in view IDs to React components. These are source-inspected development-checkout facts, not a runtime certification or proof of plugin-based provisioning. The approved direction moves editable view instances outside System, keeps capability-bearing plugins protected, and has the server provision views from installed plugins. The exact destination, schema, update lifecycle, and dependency policy remain open. Read [Vision](001-Vision/PAGE.md) for the intended experience and [Decisions](002-Decisions/PAGE.md) for settled boundaries and open choices.

## Reading routes

[Platform And Plugins](../../011-Platform_And_Plugins/000-Platform_And_Plugins/PAGE.md) explains the approved shell, component and plugin boundaries, copied editable instances, and canonical file surfaces. This section retains workspace binding, local agent context and the WV gap register.

For workspace identity and registration, read [Workspace Paradigm](../001-Workspace_Paradigm/PAGE.md), [Adding Workspaces](../003-Adding_Workspaces/PAGE.md), and [Workspace Compositions](../021-Workspace_Compositions/PAGE.md). For view definitions, local resources, and state boundaries, read [View Architecture](../002-View_Architecture/PAGE.md), [View Configuration And Agents](../022-View_Configuration_And_Agents/PAGE.md), and [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md). The [View Catalog](../023-View_Catalog/PAGE.md) leads to short introductions for each bundled template and the System surface; [Unfinished Work](003-Unfinished_Work/PAGE.md) collects bounded gaps, and [Developer Map](../024-Developer_Map/PAGE.md) points to code owners.

The older [Wiki architecture](../004-Wiki_View/001-Architecture/000-Architecture/PAGE.md) and [Voice Input](../010-Voice_Input/000-Voice_Input/PAGE.md) trees remain specialist references. This reconstruction keeps them available but does not recertify every claim in them. Voice input and document, sheet, or PDF editors are capabilities or surfaces; their presence does not by itself establish new view plugin types.

<!-- section-toc:start -->
## Guidance and Preferences

- [Vision](001-Vision/PAGE.md) - The intended plugin-based workspace and view experience, with current implementation and unresolved mechanics kept distinct.
- [Decisions](002-Decisions/PAGE.md) - Approved plugin and instance boundaries, precise supersessions, and product choices that remain open.
- [Unfinished Work](003-Unfinished_Work/PAGE.md) - Bounded register of workspace and view capabilities still needed for the approved plugin-based model.

## Technical Articles in this Wiki Section

- [Workspace Paradigm](../001-Workspace_Paradigm/PAGE.md) - Distinguishes a project folder from its Fusion Studio registration, machine-scoped content, and view presentation.
- [View Architecture](../002-View_Architecture/PAGE.md) - Separates view definition, installed instance, identity, content root, and renderer behavior in current code and the approved plugin model.
- [Adding Workspaces](../003-Adding_Workspaces/PAGE.md) - Follows current Add Project, Create New, registry, ribbon, and readiness flows and distinguishes them from planned plugin provisioning.
- [Wiki View](../004-Wiki_View/000-Wiki_View/PAGE.md) - A folder-first workspace reference view and route to specialist Wiki documentation.
- [Browser](../005-Browser/PAGE.md) - A general embedded web browsing view with a source-inspected iframe implementation.
- [Custom Iframe](../006-Custom_Iframe/PAGE.md) - A local embedded app surface, distinct from general Browser and future plugin provisioning.
- [File View](../007-File_View/PAGE.md) - The built-in explorer for a workspace project folder and its files.
- [Agent View](../008-Agent_View/PAGE.md) - The workspace agent index and detail surface, distinct from view-local personas.
- [Issues View](../009-Issues_View/PAGE.md) - A workspace issue board for indexed tickets, with current dispatch limits.
- [Voice Input](../010-Voice_Input/000-Voice_Input/PAGE.md) - Overview of Fusion Studio voice input, Whisper transcription, deterministic STT cleanup, editable rules, and voice-to-chat behavior.
- [System Manager](../011-System_Manager/PAGE.md) - Explains the current System surface and the intended protected-plugin boundary without treating ordinary view edits as privileged.
- [Viewer Search](../012-Viewer_Search/PAGE.md) - Describes source-inspected local search in Capture and Office without assuming universal plugin search.
- [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md) - Explains current per-view activity, collections and group-bound worksurface state with their owning services.
- [Office Viewer](../014-Office_Viewer/PAGE.md) - The built-in Office document surface, with a route to retained specialist detail.
- [Capture View](../015-Capture_View/PAGE.md) - A workspace capture and document surface selected by the current default profile.
- [Calendar View](../016-Calendar_View/PAGE.md) - A mounted calendar demo surface with an existing but incomplete sync and storage path.
- [Email View](../017-Email_View/PAGE.md) - A mounted mail and document UI whose mailbox content is currently mock data.
- [Contacts View](../018-Contacts_View/PAGE.md) - An experimental bundled Contacts template without a mapped built-in surface.
- [Library View](../019-Library_View/PAGE.md) - A bundled Library template whose current built-in renderer is absent.
- [Media View](../020-Media_View/PAGE.md) - A bundled Media template whose current built-in renderer is absent.
- [Workspace Compositions](../021-Workspace_Compositions/PAGE.md) - Explains editable workspace-plugin compositions and server provisioning as approved direction, alongside current bundled-template creation.
- [View Configuration And Agents](../022-View_Configuration_And_Agents/PAGE.md) - Separates editable view-instance resources from protected plugin behavior and current harness context loading.
- [View Catalog](../023-View_Catalog/PAGE.md) - Introductions and current availability for 13 bundled view templates plus the System surface.
- [Developer Map](../024-Developer_Map/PAGE.md) - Current code entry points and documentation routes for workspace registration, view discovery, rendering, state, and bundled templates.
<!-- section-toc:end -->
