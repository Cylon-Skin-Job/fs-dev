---
name: Templates and Files
description: System Manager guidance for reusable workspace templates, scaffold files, prompt files, and other system-managed source artifacts.
metadata:
  incoming-edges:
    - System Manager
    - View Customization
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Templates and files are reusable source artifacts System Manager can use when creating or modifying workspaces and views.

These resources should remain file-backed and inspectable. Assistant workflows should reference template paths and prompt IDs rather than embedding large prompt bodies or scaffold content in application code.
