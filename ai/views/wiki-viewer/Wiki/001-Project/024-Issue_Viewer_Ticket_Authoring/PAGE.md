---
name: Issue Viewer Ticket Authoring
description: How to create issue viewer tickets during planning and architecture correction work.
metadata:
  incoming-edges:
    - Project
  outgoing-edges: []
  source-files:
    - ai/views/issues-viewer/content/tickets.json
    - ai/views/issues-viewer/inbox
  connected-skills: []
  related-trigger-files: []
---

Use this page when a session needs to create a ticket that the current Issues
Viewer can display.

## Current Shape

Create both:

- markdown ticket file under `ai/views/issues-viewer/inbox/`
- JSON ticket entry in `ai/views/issues-viewer/content/tickets.json`

The JSON entry is currently required for visibility in the viewer.

## Ticket Content

A useful ticket should explain:

- what confusion or bug occurred
- why it occurred
- likely culprit files or architecture gaps
- user impact or risk
- concrete acceptance criteria

Do not rely on the current viewer render logic to infer missing JSON from the
markdown file.
