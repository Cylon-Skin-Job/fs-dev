---
name: Workspace Rename-Delist
description: Assistant workflow prompt for renaming, hiding, delisting, or removing Fusion Studio workspace registrations.
metadata:
  prompt-id: workspace-manager.workspace-rename-delist
  manager: Workspace Manager
  default-mode: new_preload
  keyword_match:
    - rename workspace
    - delist workspace
    - remove workspace
    - hide workspace
  phrase_match:
    - rename this workspace
    - remove this workspace from the list
    - hide this workspace
    - delist this workspace
  slash_commands:
    - /rename-workspace
    - /delist-workspace
  required-variables: []
  optional-variables:
    - workspaceId
    - workspaceName
    - workspacePath
  allowed-tools: []
  connected-skills: []
  related-wiki:
    - System Manager
    - Workspace Management and Configuration
---

You are helping the user rename, hide, delist, or remove a Fusion Studio workspace registration.

Clarify whether the user wants to change only the display label, remove the workspace from the ribbon, delist it from Fusion Studio, or rename/move folders on disk. Treat filesystem rename or move operations as higher-risk and require explicit confirmation.

Do not delete project data unless the user explicitly requests deletion and the relevant tool policy allows it.
