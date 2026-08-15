---
name: Workspaces And Views
description: Navigation map for product workspace architecture and user-facing view surfaces.
metadata:
  incoming-edges:
    - Wiki Guide
  outgoing-edges:
    - Workspace Paradigm
    - View Architecture
    - Adding Workspaces
    - Wiki View
    - Browser
    - Custom Iframe
    - System Manager
    - Viewer Search
    - View Activity And Collections
    - Office Viewer
    - Fusion Home
    - File View
    - Agent View
    - Issues View
    - Voice Input
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Use this section for product/workspace/view architecture and user-facing surfaces.

## Scope: Defaults vs. Templated Workspaces

A fresh Fusion Studio workspace ships with a small set of **default** surfaces:
**Capture, File Explorer, Wiki, Issues, and Agents**. Those defaults — plus the
cross-cutting architecture (Workspace Paradigm, View Architecture, search,
activity) — are what this section documents. A user who is coding, building a
knowledge base, or running web-scrapers/Marker generally needs only these.

The richer "office-app" views (Office Viewer, Calendar Viewer, Sheets, Pdf→Html,
Email, ToDo, Utilities) are **not** defaults. They live in the
[Fusion Home](../../009-Fusion_Home/000-Fusion_Home/PAGE.md) templated workspace
that ships with the app. The [System Manager](../011-System_Manager/PAGE.md)
templated workspace is documented separately as well. Both are peers to this
section, not children of it.

> Note: a fuller reorganization of this heading (narrowing it to exactly the
> defaults) is planned for a dedicated build pass. The existing child articles
> are left intact in the meantime.

## Children

- [Workspace Paradigm](../001-Workspace_Paradigm/PAGE.md) - conceptual rulebook for workspace identity, ownership, activation, and boundaries.
- [View Architecture](../002-View_Architecture/PAGE.md) - how views are discovered, mounted, served, and related to workspace content roots.
- [Adding Workspaces](../003-Adding_Workspaces/PAGE.md) - Add Project, Create New, ribbon membership, registry persistence, and lifecycle code paths.
- [Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md) - top-level chat system domain.
- [Wiki View](../004-Wiki_View/000-Wiki_View/PAGE.md) - folder-first wiki architecture, interface, frontmatter, and terminal access.
- [Browser](../005-Browser/PAGE.md) - general internet-capable browser surface for web navigation, testing, and automation.
- [Custom Iframe](../006-Custom_Iframe/PAGE.md) - local-server iframe display for user-created custom views; not for internet browsing.
- [System Manager](../011-System_Manager/PAGE.md) - protected system-level view/workspace surface for prompts, triggers, skills, tools, and delegated changes.
- [Viewer Search](../012-Viewer_Search/PAGE.md) - local search behavior for folder-backed React views such as Capture and Office.
- [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md) - shared per-view recents, navigation, tabs, starred files, and pinned folders.
- [Office Viewer](../../009-Fusion_Home/001-Office_Viewer/PAGE.md) - Office filesystem browser, document editor, thumbnails, paper brightness, table geometry, and per-view state behavior. *(Now in the [Fusion Home](../../009-Fusion_Home/000-Fusion_Home/PAGE.md) templated workspace; cross-linked here for discoverability.)*
- `007-File_View/` - file browsing and file-viewer behavior.
- `008-Agent_View/` - planned/underdeveloped agent surface.
- `009-Issues_View/` - planned/partial ticketing surface.
- [Voice Input](../010-Voice_Input/000-Voice_Input/PAGE.md) - mic input, Whisper transcription, deterministic cleanup rules, and voice-to-chat behavior.

## Migration Sources

- [Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md)
- [Wiki View](../004-Wiki_View/000-Wiki_View/PAGE.md)
- Legacy Browser Views content was split into [Browser](../005-Browser/PAGE.md) and [Custom Iframe](../006-Custom_Iframe/PAGE.md).

This page is intentionally a short navigation map. Durable architecture content should live in child pages as the migration proceeds.
