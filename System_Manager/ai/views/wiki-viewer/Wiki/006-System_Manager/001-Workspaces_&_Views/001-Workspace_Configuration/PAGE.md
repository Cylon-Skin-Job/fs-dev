---
name: Workspace Configuration
description: System Manager guidance for creating, registering, renaming, hiding, delisting, or otherwise configuring Fusion Studio workspaces.
metadata:
  incoming-edges:
    - Workspace and View Panel Structure
  outgoing-edges:
    - State and Theme
    - View Customization
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Workspace configuration covers the lifecycle and registry behavior of a Fusion Studio workspace.

Common actions include creating a new workspace, registering an existing folder, changing a workspace label, hiding a workspace from the ribbon, or delisting a workspace from the application.

System Manager should guide these actions through prompt-backed workflows rather than direct UI mutation.

## Prompt Sources

```text
System_Manager/Prompts/Workspace Manager/Workspace Creation/PROMPT.md
System_Manager/Prompts/Workspace Manager/Workspace Rename-Delist/PROMPT.md
```
