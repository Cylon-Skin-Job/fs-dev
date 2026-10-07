---
name: Workspaces & Views
description: System Manager routing page for workspace/view architecture and workspace lifecycle documentation.
metadata:
  incoming-edges:
    - System Manager
  outgoing-edges:
    - Workspaces And Views
    - Workspace Paradigm
    - Adding Workspaces
    - View Architecture
    - Viewer Search
  source-files:
    - fusion-studio-server/lib/workspace/workspace-controller.js
    - fusion-studio-server/lib/workspace/create-service.js
    - fusion-studio-server/lib/views/index.js
  connected-skills: []
  related-trigger-files: []
---

Use the main Workspaces And Views section for durable documentation. This System Manager page is a routing note so system-level work does not fork a second workspace architecture story.

## Current Docs

- [Workspaces And Views](../../001-Workspaces_And_Views/PAGE.md) - navigation for workspace and view architecture.
- [Workspace Paradigm](../../001-Workspaces_And_Views/001-Workspace_Paradigm/PAGE.md) - conceptual ownership, activation, and boundaries.
- [Adding Workspaces](../../001-Workspaces_And_Views/003-Adding_Workspaces/PAGE.md) - Add Project, Create New, ribbon membership, registry persistence, and server code path.
- [View Architecture](../../001-Workspaces_And_Views/002-View_Architecture/PAGE.md) - V2 view capsules, content roots, numbering, icons, and state.
- [Viewer Search](../../001-Workspaces_And_Views/012-Viewer_Search/PAGE.md) - local search behavior for folder-backed React views.

## System Manager Rule

When changing templates, registry behavior, V2 view discovery, or shared viewer behavior such as search, update the main Workspaces And Views pages first. Keep this page as a pointer instead of duplicating architecture details here.
