---
name: Files View
description: The built-in explorer for a workspace project folder and its files.
metadata:
  source-files:
    - fusion-studio-client/src/components/ContentArea.tsx
    - fusion-studio-client/src/components/file-explorer/FileExplorer.tsx
    - fusion-studio-server/lib/file-explorer.js
  last-modified: "2026-09-23T13:50:37Z"
---

**Files** presents the workspace's project files, with a tree drawer and a viewer for a selected file. The bundled `file-viewer` template declares `project-root` as its data source, and the current New Workspace profile selects it. `FileExplorer` requests the tree through the workspace file service and uses the file viewer for opened content.

## Current status and limits

This is a mounted React view in the fixed `ContentArea` component map. File access is governed by the server's registered panel and path resolution; a template declaration does not grant arbitrary paths. The current view also has activity/tab state, but that is separate from the project's file content and from chat thread identity. See [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md) for state ownership and [View Architecture](../002-View_Architecture/PAGE.md) for instance versus content root.

The approved future plugin supplies the Files behavior while its editable instance selects content and agent configuration within declared capabilities. The Files view is distinct from the reusable canonical file surface: a collection may open that surface in its current tab with a return route or another tab, retaining collection state while canonical file editing and platform save/history keep their owners. [Tabs, Drawers And Files](../../011-Platform_And_Plugins/004-Tabs_Drawers_And_Files/PAGE.md) explains this target without adding another editor or save implementation.
