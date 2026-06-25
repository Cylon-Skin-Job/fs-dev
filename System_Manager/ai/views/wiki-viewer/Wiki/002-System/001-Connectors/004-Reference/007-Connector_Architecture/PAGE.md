---
title: Connector Architecture
description: Backend architecture and permission probing for MacOS connectors.
icon: architecture
---

# Connector Architecture

## Architecture Overview

Each connector uses a different Apple API depending on read vs. write requirements:

### Apple Mail
- **Read:** Direct SQLite on `~/Library/Mail/V10/MailData/Envelope Index`
- **Write:** AppleScript (drafts only — no other safe write path)
- **Permission:** Full Disk Access (FDA)
- **Probe:** `fs.accessSync` on Envelope Index. EPERM = no FDA.

### Apple Calendar
- **Read/Write:** EventKit API
- **Permission:** Calendar TCC
- **Probe:** `EKEventStore.requestAccessToEntityType(.event)`

### Apple Notes
- **Read/Write:** AppleScript (NoteStore.sqlite body is proprietary gzip blob)
- **Permission:** Automation TCC (AppleEvents)
- **Probe:** Attempt AppleScript `tell application "Notes"`. User dialog on first use.

### Apple Reminders
- **Read/Write:** EventKit API
- **Permission:** Reminders TCC
- **Probe:** `EKEventStore.requestAccessToEntityType(.reminder)`

## Event Bus Integration

Connectors should emit:
- `connector:enabled` — when toggled on
- `connector:disabled` — when toggled off
- `connector:sync_complete` — after successful sync
- `connector:error` — on failure (include error code)

See [Event Payload Schema](../005-Event_Payload_Schema/PAGE.md) for payload definitions.

## Persistence

Toggle state is currently in-memory only. Planned: SQLite table `connector_states` with columns:
- `connector_id` (primary key)
- `enabled` (boolean)
- `last_synced_at` (timestamp)
- `error_count` (integer)
- `last_error` (text)

See [State Machine](../003-State_Machine/PAGE.md) for the full lifecycle.
