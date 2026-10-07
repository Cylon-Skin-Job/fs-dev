---
name: "Email"
description: "Fusion Home routing to current view status and future connected-app direction."
metadata:
  source-files: []
  last-modified: "2026-09-28T04:56:08Z"
---

Email has a mounted mailbox UI using mock messages and accounts, alongside document/file interactions. A connected send/receive provider is not established by that UI.

Read [Email current status](../../001-Workspaces_And_Views/017-Email_View/PAGE.md) before planning changes. The [Fusion Home profile](../000-Fusion_Home/PAGE.md) does not currently select this view. A future office-app composition is a design direction, not a shipped inventory.

Connected services remain authoritative for live application content. Existing Calendar writes into `fusion.db`, when enabled, are a documented implementation gap against that direction; they do not establish a shared System database for every app.

Account binding, editing, capabilities and complete integration behavior need their own implementation decisions.
