---
name: Workspace and View Panel Structure
description: Explains how Fusion Studio workspaces contain view panels, configuration, state, prompts, skills, and tools managed through System Manager workflows.
metadata:
  incoming-edges:
    - System Manager
  outgoing-edges:
    - Workspace Configuration
    - State and Theme
    - View Customization
    - Agent Prompts
    - Skills and Tools
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Workspaces are the primary organizing unit in Fusion Studio. A workspace owns its local files, its `ai/` structure, and the view panels that make those resources usable.

Views are a subset of workspace behavior. They are not separate projects. A view is a panel or surface that reads from, renders, or configures part of the workspace.

System Manager workflows help users create, configure, rename, delist, and customize workspaces and views without requiring the UI button itself to mutate system state.

## Children

- [Workspace Configuration](../001-Workspace_Configuration/PAGE.md) - create, register, rename, delist, and manage workspaces.
- [State and Theme](../002-State_And_Theme/PAGE.md) - state files, theme choices, and visual configuration.
- [View Customization](../003-View_Customization/PAGE.md) - adding, removing, and editing view panels.
- [Agent Prompts](../004-Agent_Prompts/PAGE.md) - prompts that guide workspace and system agents.
- [Skills and Tools](../005-Skills_And_Tools/PAGE.md) - skill matching, tool access, and System Manager delegation.

## Related Prompt Folders

```text
System_Manager/Prompts/Workspace Manager/Workspace Creation/PROMPT.md
System_Manager/Prompts/Workspace Manager/Workspace Rename-Delist/PROMPT.md
System_Manager/Prompts/Workspace Manager/Edit Views/PROMPT.md
System_Manager/Prompts/Workspace Manager/Customize CSS/PROMPT.md
```
