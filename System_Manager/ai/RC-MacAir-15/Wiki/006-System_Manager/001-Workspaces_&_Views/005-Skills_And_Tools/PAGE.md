---
name: Skills and Tools
description: System Manager guidance for skill matching, prompt injection, governed tools, and delegation from normal workspace agents.
metadata:
  incoming-edges:
    - Workspace and View Panel Structure
    - Agent Prompts
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Skills and tools are the operational layer beneath System Manager workflows.

Skills describe when a workflow should be considered, what wiki context is useful, and how the assistant should reason about the task. Tools perform deterministic server-side actions under policy, grants, confirmation, and audit.

Normal workspace agents can explain workspace and view structure, but protected system changes should defer to System Manager.

## Matching Direction

Skill and prompt metadata can include keyword matches, phrase matches, slash commands, wiki links, and tool expectations. These fields help retrieval inject the right context when the user asks naturally for a workspace or view change.
