---
name: Connectors
description: System Manager guidance for local and external connectors that expose user-approved data or actions to assistant workflows.
metadata:
  incoming-edges:
    - System Manager
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Connectors expose local or external systems to Fusion Studio workflows.

Connector-backed actions should use the same System Manager pattern: user intent launches a prompt-backed workflow, the assistant explains and confirms, and deterministic connector tools perform the actual work under policy and audit.
