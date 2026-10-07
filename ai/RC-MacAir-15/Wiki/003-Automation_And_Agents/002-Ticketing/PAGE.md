---
name: "Ticketing: Board Data and Authoring"
description: How visible Issues tickets are stored and written, and the current creation and dispatch gaps.
metadata:
  source-files:
    - fusion-studio-client/src/components/tickets/TicketBoard.tsx
    - fusion-studio-client/src/state/ticketStore.ts
    - fusion-studio-server/lib/startup.js
    - fusion-studio-server/lib/tickets/dispatch.js
    - fusion-studio-server/lib/tickets/loader.js
  last-modified: "2026-09-28T04:16:38Z"
---

## Board data and columns

The Issues board loads `ai/<machine>/Issues/content/tickets.json` and builds cards from its `tickets` object keyed by ticket ID. Core display fields are `title`, `assignee`, `created`, `author`, `state` and `body`; entries may have additional fields such as `priority`. The JSON `body` supplies the card preview and both built-in expanded detail views. The board does not scan Markdown files or render their bodies. A Markdown-only ticket will not appear.

The board places `state: closed` entries in Completed. For `state: open`, it places entries assigned to its fixed `kimi-wiki`, `kimi-code`, `kimi-review` or `kimi-bot` display names in Open and other assignees in Inbox. These names are a UI test, not worker registry lookup or dispatch. The Markdown folder does not choose the column, although file actions derive a path from the same state and assignee rules. [Issues View](../../001-Workspaces_And_Views/009-Issues_View/PAGE.md) owns the view surface.

## Create a visible ticket

For current manual authoring, check both JSON keys and Markdown filenames for an unused `RCC-NNNN` ID; this is a convention, not a concurrent allocator. Write `ai/<machine>/Issues/inbox/<id>.md` with identifying frontmatter and a substantive body for a normal new human-assigned open ticket. Add the matching ID to `ai/<machine>/Issues/content/tickets.json` with the core display fields and a useful `body`. Use an ISO 8601 creation timestamp and update `last_updated` for traceability. The JSON entry creates board visibility; Markdown is the durable companion and supports separate file-based readers and actions. Keep their title, state and assignee consistent.

## Write a useful ticket

Describe what happened; give the known cause or label a leading hypothesis; identify likely code owners or an architecture gap while marking uncertainty; explain user impact or risk; and state concrete acceptance criteria. Keep the registry `body` useful as the displayed summary, and put the fuller investigation and criteria in Markdown. The expanded built-in detail still reads the registry body.

## Update a ticket

Changing JSON `state` to `closed` moves the card to Completed. Update the matching Markdown frontmatter too so other readers see the same state. `last_updated` is maintenance bookkeeping; the board does not use it as a visibility gate.

## Creation and execution gaps

The server can load a `create-ticket` action for triggers and schedules. In this workspace, the selected legacy script reads `Issues/sync.json`, which is absent; the existing counter is `Issues/content/sync.json`. If that first read succeeded, the script would target root-level `KIMI-*` files and `Issues/index.json`, not this board's `content/tickets.json`. Do not rely on that route to produce a visible ticket until it is repaired. The standalone ticket dispatch watcher and GitLab issue sync modules exist, but normal server startup does not mount that watcher. A card or bot-looking assignee alone does not launch a worker. See [Background Agents](../005-Background_Agents/PAGE.md), [Run Auditing](../004-Run_Auditing/PAGE.md) and [GitLab](../../004-Integrations_And_Tools/001-GitLab/PAGE.md) for their separate boundaries.
