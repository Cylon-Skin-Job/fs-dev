---
name: Ticketing System
description: How the issues board works today and exactly how to create a ticket that displays. The board renders from content/tickets.json; the .md file is detail only. No dispatch, agents, or sync are active.
metadata:
  incoming-edges:
    - Home
    - Background Agents
  outgoing-edges:
    - Run Auditing
  source-files:
    - fusion-studio-client/src/components/tickets/TicketBoard.tsx
    - ai/<machine>/Issues/content/tickets.json
    - ai/<machine>/Issues/scripts/create-ticket.js
  connected-skills: []
  related-trigger-files: []
---

The issues board is a static three-column display today. It reads a single JSON
file and renders cards. There is no dispatch loop, no agents picking up tickets,
no cron factories, and no GitLab sync. Those were earlier designs and are not
wired up. This page documents what actually happens and how to add a ticket that
shows up.

## The One File That Renders The Board

The board (`TicketBoard.tsx`) loads **`ai/<machine>/Issues/content/tickets.json`**
and renders from it. Nothing else drives the display.

```json
{
  "version": "2.0",
  "last_updated": "2026-06-09T00:00:00.000Z",
  "tickets": {
    "RCC-0086": {
      "title": "Chunk E — Theme token bridge",
      "assignee": "rccurtrightjr",
      "created": "2026-05-22T11:50:00.000Z",
      "author": "rccurtrightjr",
      "state": "closed",
      "body": "Short summary shown on the card."
    }
  }
}
```

`tickets` is an object keyed by ticket id. Each entry has exactly six fields:
`title`, `assignee`, `created`, `author`, `state`, `body`. The `body` here is a
short summary for the card — the full write-up lives in the `.md` file.

> If a ticket is not in this file, it does not appear on the board — even if its
> `.md` file exists on disk. This is the most common reason a ticket is
> "missing."

## The Ticket .md File

Each ticket also has a markdown file holding the full detail. It is the human-
readable source, but it is **not** what renders the board.

```markdown
---
id: RCC-0095
title: 'AI Workspace Template V2 — canonical ai-template migration'
assignee: rccurtrightjr
created: 2026-06-09T00:00:00.000Z
author: rccurtrightjr
state: open
priority: high
---

Full ticket body in markdown — context, steps, files, smoke tests.
```

The `.md` files live in folders under `ai/<machine>/Issues/`:
`inbox/`, `open/`, `closed/`. **The folder does not determine the column.** The
board ignores folder location entirely and decides placement from the fields in
`tickets.json` (see below). The folders are just on-disk organization.

The `.md` frontmatter may carry extra fields (such as `priority`); the board does
not read them. Only the six fields copied into `tickets.json` affect display.

## How Columns Are Decided

Placement is computed from `state` and `assignee` in the `tickets.json` entry:

| Column | Rule |
|---|---|
| **Inbox** | `state: open` and assignee is a person |
| **Open** | `state: open` and assignee is a recognized background worker |
| **Completed** | `state: closed` |

Today no background workers are configured, so the **Open column stays empty** and
every open ticket lands in **Inbox**. Closed tickets go to **Completed**. That is
the whole behavior.

## How To Create A Ticket That Displays

Follow these steps. The step that actually makes the ticket visible is step 3.

1. **Pick the next id.** Ids are `RCC-NNNN`, zero-padded to four digits. Use the
   highest existing id plus one. (Do not trust `content/sync.json`'s `next_id` —
   it is stale.)

2. **Write the `.md` file** at `ai/<machine>/Issues/inbox/RCC-NNNN.md` with
   frontmatter (`id`, `title`, `assignee`, `created`, `author`, `state`, and
   optional `priority`) followed by the full markdown body. Use an ISO 8601
   `created` timestamp. For a normal user ticket set `assignee` to the user and
   `state: open`.

3. **Add the entry to `ai/<machine>/Issues/content/tickets.json`** under
   `tickets["RCC-NNNN"]` with the six render fields. Keep `body` to a one- or
   two-sentence summary (the card preview), not the full markdown:

   ```json
   "RCC-0098": {
     "title": "Same title as the .md frontmatter",
     "assignee": "rccurtrightjr",
     "created": "2026-06-12T00:00:00.000Z",
     "author": "rccurtrightjr",
     "state": "open",
     "body": "One- or two-sentence summary for the card."
   }
   ```

4. **Bump `last_updated`** in `tickets.json` to the current timestamp.

That is everything required for the ticket to appear (in Inbox, since it is open
and assigned to a person). To close a ticket later, set `state: closed` in both
the `.md` frontmatter and the `tickets.json` entry; it moves to Completed.

## Known Limitations (As-Is)

These are current realities, not the intended end state:

- **`scripts/create-ticket.js` is broken.** It writes new tickets into the view's
  `index.json` (the view manifest), not into `content/tickets.json`, so tickets it
  creates never display. Do not rely on it; write `tickets.json` directly per the
  steps above. (This is captured in ticket RCC-0097.)
- **`content/sync.json`'s `next_id` is stale** and does not track the real highest
  id. Compute the next id from existing tickets instead.
- **Disk and index can drift.** Because nothing reconciles the `.md` folders with
  `tickets.json`, a `.md` file can exist with no matching entry (invisible) or an
  entry can outlive its file. Keep the two in sync by hand until the writer is
  fixed.

## Related

- [Background Agents](../013-Background_Agents/PAGE.md) — the trigger-driven worker model (the future ticket producer/consumer)
- [Run Auditing](../019-Run_Auditing/PAGE.md) — inspecting recorded runs
