# Automation Trigger Spec

This file defines the user-owned contract for GUI automation triggers. The GUI
always presents exactly four cards:

1. Name & Description
2. Trigger
3. Script
4. Permissions

AI may help write or revise scripts, but it must not write this trigger contract
file. The server owns writes to `TRIGGERS.md`, permission discovery, and
permission enablement.

## Folder Layout

Automation artifacts use this structure:

```text
Automations/
  Triggers/
    Automation_Name/
      TRIGGERS.md
  Scripts/
    Automation_Name/
      some-script.js
```

`TRIGGERS.md` is the locked GUI contract. Script files are the editable
implementation surface for AI and advanced users.

## Trigger File Shape

Each automation trigger file is front matter plus detailed prose.

```markdown
---
name: Parse Bank Transaction Emails
description: Monitors inbox for Wells Fargo transaction emails and routes parsed expenses.
metadata:
  type: trigger
  triggers:
    event: email.received
    folder_or_tag: inbox
  script:
    file: ../../Scripts/Parse_Bank_Transaction_Emails/parse-bank-transaction.js
  permissions:
    read_matching_email: false
    apply_or_remove_folders_tags: false
    create_tickets_or_records: false
    send_email: false
    delete_email: false
---

When a new inbox email arrives from Wells Fargo, run the transaction parser.
If the parser classifies the expense as personal, prepare a Spending tracker
transaction. If it classifies the expense as business, prepare a Solobooks
expense. Add the processed and money tags after a successful run.
```

## GUI Mapping

### Name & Description

Reads and edits:

- `name`
- `description`

### Trigger

Reads and edits:

- `metadata.triggers.event`
- `metadata.triggers.folder_or_tag`

The basic GUI should stay intentionally small. Advanced matching belongs in the
script.

Initial semantic events:

- New email
- Email sent
- Email read/opened

Folder/tag selection covers inbox, starred, snoozed, trash, custom labels, and
future mailbox states.

### Script

Reads and edits:

- `metadata.script.file`
- the semantic prose below the front matter

The third card shows the semantic prose. If a script is attached, the card also
shows the script filename. Clicking the card opens a JavaScript preview in the
side panel.

### Permissions

Reads:

- `metadata.permissions`

Permissions are server-controlled. AI cannot enable permissions by editing
scripts. Test runs ask the server to inspect the script, list requested
permissions, and initialize each newly requested permission to `false`.

Clicking the fourth card opens toggles in the side panel. Toggle state reflects
the locked trigger contract, not script comments.

Scripts may include comments explaining why a permission is requested. The GUI
may display those comments beneath the corresponding toggle as human-readable
justification.

Example:

```js
// @permission read_matching_email: required to parse sender, subject, and body.
// @permission apply_or_remove_folders_tags: required to archive processed mail.
```

## Write Boundaries

- AI must not write `TRIGGERS.md`.
- AI may write files under `Automations/Scripts/<Automation_Name>/`.
- The server may update `TRIGGERS.md` after explicit user action.
- Permission toggles are only changed by user action through the GUI.
- Test run may discover permissions, but discovered permissions default to
  `false`.

## Runtime Work Still Needed

- CRUD hooks for automation folders and trigger contracts.
- Script test-run endpoint.
- Permission discovery from script metadata/comments.
- Permission propagation into the fourth card.
- System event hooks for email events, folder/tag transitions, and scheduled
  maintenance.

## Ticket-Orchestrated Automation

Tickets are the handoff layer between sandboxed trigger scripts and background
agents.

An email trigger can:

1. Read a bounded email event.
2. Run sandboxed script logic.
3. Extract structured fields.
4. Create a ticket from a template.
5. Append the created ticket id to local automation state.

The background agent does not run directly from arbitrary email content. It runs
from a ticket assignment, with the ticket template controlling the fields,
instructions, and scope. The agent then operates under its own permission set,
separate from the email trigger.

### Trigger Chaining

Multiple triggers may form a sequence, but each trigger remains independently
bounded by its own contract and permissions.

Example flow:

```text
Email received
  -> Trigger A runs script
  -> Trigger A creates Ticket 1042 from a template
  -> Trigger A appends 1042 to its local state JSON
  -> Ticket system assigns/runs agent
  -> Agent completes Ticket 1042
  -> Ticket completed event fires
  -> Trigger B checks its local state JSON
  -> Trigger B matches Ticket 1042 and runs next branch
```

Trigger-local state lives inside the automation script folder:

```text
Automations/
  Scripts/
    Automation_Name/
      automation-state.json
      client-rules.json
      patterns.regex
      source-map.csv
      main.js
```

Scripts may read files in their own automation folder when granted the matching
read permission. This allows advanced automations to use regex files, JSON
lookup tables, CSV exports, spreadsheet references, or scraped app data without
expanding the GUI.

### Ticket Completion Triggers

A ticket-completion trigger can use local state to decide whether it should act.
For example, Trigger B may only run when the completed ticket id appears in
`automation-state.json`.

This keeps chained automation explicit:

- Trigger A owns intake and ticket creation.
- The ticket system owns assignment and agent wakeup.
- The agent owns the ticket work.
- Trigger B owns post-completion continuation.

Each hop is inspectable and permission-gated.

### Multiple Trigger Blocks

An automation may eventually support multiple trigger entries in the Trigger
card. The GUI should still show the same four cards. Multiple trigger entries
are advanced configuration inside the locked `TRIGGERS.md` contract, not a
reason to add more top-level cards.
