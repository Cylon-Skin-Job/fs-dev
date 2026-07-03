---
name: System Manager
description: Explains the System Manager layer: assistant-readable wiki guidance, prompt-backed workflows, skills, and governed tools for Fusion Studio system features.
metadata:
  incoming-edges:
    - Wiki Guide
  outgoing-edges:
    - Workspace and View Panel Structure
    - Templates and Files
    - Connectors
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

System Manager is the system-facing assistant layer for Fusion Studio. It groups prompts, skills, wiki references, and governed tools around features that change how the application, workspaces, views, and connectors behave.

System Manager workflows are launched by user intent, such as a button click or a natural-language request. The workflow loads prompt content from `System_Manager/Prompts/`, explains the process, asks any required questions, and uses governed tools only after the user is comfortable with the action.

## Sections

- [Workspaces & Views](../001-Workspaces_&_Views/000-Workspaces_&_Views/PAGE.md) - workspace structure, view panels, configuration, prompts, skills, and tools.
- [Templates and Files](../002-Templates_And_Files/PAGE.md) - reusable workspace files, templates, and scaffold sources.
- [Connectors](../003-Connectors/PAGE.md) - system-managed local and external connectors.

## Prompt Sources

Workspace Manager prompts live under:

```text
System_Manager/Prompts/Workspace Manager/
```

Wiki pages explain the concepts. Prompt files own the injectable assistant workflow content.
