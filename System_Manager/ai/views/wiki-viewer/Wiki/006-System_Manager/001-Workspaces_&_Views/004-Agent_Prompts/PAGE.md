---
name: Agent Prompts
description: System Manager guidance for prompt-backed assistant workflows, prompt metadata, and workspace-agent delegation rules.
metadata:
  incoming-edges:
    - Workspace and View Panel Structure
  outgoing-edges:
    - Skills and Tools
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Agent prompts are markdown files that tell an assistant how to run a workflow, what questions to ask, which context matters, and which tools or skills may be relevant.

Prompt content lives outside application code. Buttons and natural-language requests should reference prompt IDs or prompt files, then the system loads the prompt body and metadata into the assistant workflow.

## Prompt Folder

```text
System_Manager/Prompts/Workspace Manager/
```

Prompt files own operational guidance. Wiki pages describe concepts and link to prompt sources.
