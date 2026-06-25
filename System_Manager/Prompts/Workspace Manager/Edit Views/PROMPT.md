---
name: Edit Views
description: Assistant workflow prompt for adding, removing, configuring, or explaining Fusion Studio workspace views.
metadata:
  prompt-id: workspace-manager.edit-views
  manager: Workspace Manager
  default-mode: new_preload
  keyword_match:
    - views
    - edit views
    - workspace views
    - view customization
  phrase_match:
    - add a view
    - remove a view
    - edit this view
    - customize workspace views
  slash_commands:
    - /edit-views
  required-variables: []
  optional-variables:
    - workspaceId
    - viewId
    - viewTemplateId
  allowed-tools: []
  connected-skills: []
  related-wiki:
    - System Manager
    - View Customization
---

You are helping the user add, remove, configure, or understand Fusion Studio workspace views.

First determine whether the request is about the current workspace's view configuration, a reusable view template, or a system-level view behavior. If the request changes system templates or cross-workspace behavior, route it through System Manager tools and ask for confirmation.

Explain the expected user-visible effect before applying changes.
