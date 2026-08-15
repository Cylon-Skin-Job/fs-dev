---
title: AI Query Interface
description: How AI agents discover, query, and command connectors programmatically.
icon: smart_toy
---

# AI Query Interface

The interface between AI agents and connectors. This is the contract an AI uses to ask for data, create items, and respond to connector state changes.

---

## Discovery

Before querying, the AI discovers what connectors are available.

### Request

```json
{
  "action": "connector.discover"
}
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "mail",
      "title": "Apple Mail",
      "category": "MacOS Connectors",
      "capabilities": ["read", "write"],
      "status": "active",
      "enabled": true,
      "lastSync": 1716472800000,
      "permissions": [
        { "name": "FULL_DISK_ACCESS", "granted": true }
      ]
    },
    {
      "id": "gmail",
      "title": "Gmail",
      "category": "Google OAuth",
      "capabilities": ["read", "write"],
      "status": "not_implemented",
      "enabled": false,
      "lastSync": null,
      "permissions": [
        { "name": "GOOGLE_OAUTH", "granted": false }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Machine identifier |
| `title` | `string` | Human-readable name |
| `category` | `string` | Sidebar group name |
| `capabilities` | `string[]` | `"read"`, `"write"`, `"sync"`, `"notify"` |
| `status` | `string` | `disabled`, `probing`, `permission_needed`, `enabled`, `syncing`, `active`, `error`, `not_implemented` |
| `enabled` | `boolean` | User toggle state |
| `lastSync` | `number \| null` | Unix ms |
| `permissions` | `array` | List of required permissions and their grant state |

---

## Querying Data

### Standard Query Shape

All data queries follow this pattern:

```json
{
  "action": "{connectorId}.{entity}.query",
  "parameters": {
    "filter": { /* entity-specific */ },
    "pagination": {
      "limit": 50,
      "offset": 0
    },
    "sort": {
      "field": "date",
      "order": "desc"
    }
  }
}
```

### Query Response Shape

```json
{
  "success": true,
  "meta": {
    "total": 128,
    "returned": 50,
    "limit": 50,
    "offset": 0,
    "cached": false,
    "staleAfter": 1716473100000
  },
  "data": [ /* entity objects */ ]
}
```

| Meta Field | Type | Description |
|------------|------|-------------|
| `total` | `number` | Total matching items (not just this page) |
| `returned` | `number` | Items in this response |
| `cached` | `boolean` | Was this served from cache? |
| `staleAfter` | `number \| null` | Unix ms. Data is fresh until this time. Null = always fresh. |

---

## Example Queries by Connector

### Apple Mail

**Get unread messages from today:**

```json
{
  "action": "mail.message.query",
  "parameters": {
    "filter": {
      "read": false,
      "since": 1716386400000,
      "mailbox": "INBOX"
    },
    "sort": { "field": "date", "order": "desc" },
    "pagination": { "limit": 20 }
  }
}
```

**Create a draft:**

```json
{
  "action": "mail.draft.create",
  "parameters": {
    "to": ["recipient@example.com"],
    "cc": [],
    "bcc": [],
    "subject": "Meeting follow-up",
    "body": "Hi, thanks for the meeting...",
    "bodyType": "plain"
  }
}
```

### Apple Calendar

**Get events for a date range:**

```json
{
  "action": "calendar.event.query",
  "parameters": {
    "filter": {
      "startDate": 1716472800000,
      "endDate": 1719072000000,
      "calendars": ["Work"]
    },
    "sort": { "field": "startDate", "order": "asc" }
  }
}
```

**Create an event:**

```json
{
  "action": "calendar.event.create",
  "parameters": {
    "title": "Doctor Appointment",
    "startDate": 1716559200000,
    "endDate": 1716562800000,
    "timezone": "America/Los_Angeles",
    "allDay": false,
    "calendar": "Personal",
    "description": "Annual checkup",
    "location": "123 Main St"
  }
}
```

### Apple Reminders

**Get incomplete reminders:**

```json
{
  "action": "reminders.task.query",
  "parameters": {
    "filter": {
      "completed": false,
      "dueBefore": 1719072000000
    },
    "sort": { "field": "dueDate", "order": "asc" }
  }
}
```

**Create a reminder:**

```json
{
  "action": "reminders.task.create",
  "parameters": {
    "title": "Buy groceries",
    "notes": "Milk, eggs, bread",
    "dueDate": 1716562800000,
    "list": "Personal",
    "priority": 0
  }
}
```

### Apple Notes

**Get recent notes:**

```json
{
  "action": "notes.note.query",
  "parameters": {
    "filter": {
      "since": 1715791200000,
      "folder": "Notes"
    },
    "sort": { "field": "modified", "order": "desc" },
    "pagination": { "limit": 10 }
  }
}
```

**Create a note:**

```json
{
  "action": "notes.note.create",
  "parameters": {
    "title": "Meeting Notes",
    "body": "Discussed Q3 roadmap...",
    "folder": "Notes"
  }
}
```

---

## Command Interface

The AI can also send commands to connectors.

### Force Sync

```json
{
  "action": "connector.command",
  "target": "calendar",
  "command": "sync",
  "parameters": {
    "source": "apple",
    "blocking": false
  }
}
```

### Toggle Connector

```json
{
  "action": "connector.command",
  "target": "mail",
  "command": "toggle",
  "parameters": {
    "enabled": true
  }
}
```

### Check Permission

```json
{
  "action": "connector.command",
  "target": "mail",
  "command": "probe_permission",
  "parameters": {
    "permission": "FULL_DISK_ACCESS"
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "granted": false,
    "canPrompt": false,
    "systemPath": "System Settings → Privacy & Security → Full Disk Access"
  }
}
```

---

## Cross-Connector Operations

Some operations span multiple connectors.

### Create Reminder from Email

```json
{
  "action": "cross.create_reminder_from_message",
  "parameters": {
    "messageUuid": "apple:MSG-123",
    "reminderTitle": "Follow up on proposal",
    "dueDate": 1716562800000,
    "linkBack": true
  }
}
```

This creates a reminder with a reference to the original email. If `linkBack: true`, the reminder note contains a deep link to the message.

### Create Event from Reminder

```json
{
  "action": "cross.create_event_from_task",
  "parameters": {
    "taskUuid": "apple:TSK-456",
    "eventTitle": "Work on: Draft proposal",
    "startDate": 1716559200000,
    "endDate": 1716562800000
  }
}
```

---

## Natural Language to Query Mapping

The AI translates user requests into the query interface. Common patterns:

| User Says | AI Action | Parameters |
|-----------|-----------|------------|
| "Do I have mail?" | `mail.message.query` | `filter: { read: false, limit: 5 }` |
| "What's on my calendar today?" | `calendar.event.query` | `filter: { startDate: todayStart, endDate: todayEnd }` |
| "Remind me to call Mom" | `reminders.task.create` | `title: "Call Mom"` |
| "Create a note about the meeting" | `notes.note.create` | `title: "Meeting Notes"` |
| "Any unread emails from Bob?" | `mail.message.query` | `filter: { read: false, from: "Bob" }` |

---

## Current Limitations

> **Only `calendar` has a working backend.** The query interface above describes the **intended** contract. For connectors without implementation, the AI receives:
>
> ```json
> {
>   "success": false,
>   "error": {
>     "code": "GEN_NOT_IMPLEMENTED",
>     "message": "Connector 'mail' has no backend implementation",
>     "retryable": false,
>     "actionRequired": null
>   }
> }
> ```
