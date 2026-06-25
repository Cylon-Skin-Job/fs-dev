---
title: Data Schema Template
description: Reusable template for documenting connector data schemas.
icon: dataset
---

# Data Schema Template

Use this template when documenting any connector's data shapes. Copy this file, replace placeholders, and store it in the connector's article folder or `resources/`.

---

## Entity: `{EntityName}`

A `{EntityName}` represents a single [description].

### Storage Schema (SQLite)

```sql
CREATE TABLE {table_name} (
  uuid          TEXT PRIMARY KEY,
  connector_id  TEXT NOT NULL,
  title         TEXT,
  created_at    INTEGER,
  updated_at    INTEGER
);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `uuid` | `TEXT` | ❌ | Unique identifier, prefixed with source (`apple:`, `google:`) |
| `connector_id` | `TEXT` | ❌ | Which connector owns this row |
| `title` | `TEXT` | ✅ | Display name |
| `created_at` | `INTEGER` | ✅ | Unix timestamp (ms) |
| `updated_at` | `INTEGER` | ✅ | Unix timestamp (ms), used for upsert conflict resolution |

### Internal Schema (Reader Output)

What the connector's reader/parser returns after raw-data conversion:

```ts
interface {EntityName} {
  uuid: string;           // "apple:ABC-123" or "google:DEF-456"
  source: "apple" | "google";
  title: string;
  createdAt: number;      // Unix timestamp (ms)
  updatedAt: number;      // Unix timestamp (ms)
}
```

### Query Request Schema

What the AI sends when querying for `{EntityName}`s:

```json
{
  "action": "{connectorId}.{entityName}.query",
  "parameters": {
    "limit": 50,              // number, 1–500, default 50
    "offset": 0,              // number, default 0
    "since": 1716472800000,   // number | null, Unix ms inclusive
    "until": 1719072000000,   // number | null, Unix ms inclusive
    "source": "apple"         // "apple" | "google" | null (all)
  }
}
```

| Parameter | Type | Default | Constraints |
|-----------|------|---------|-------------|
| `limit` | `number` | `50` | 1–500 |
| `offset` | `number` | `0` | ≥ 0 |
| `since` | `number \| null` | `null` | Unix ms |
| `until` | `number \| null` | `null` | Unix ms |
| `source` | `string \| null` | `null` | `"apple"`, `"google"`, or all |

### Query Response Schema

```json
{
  "success": true,
  "meta": {
    "total": 128,
    "returned": 50,
    "limit": 50,
    "offset": 0
  },
  "data": [
    {
      "uuid": "apple:ABC-123",
      "source": "apple",
      "title": "...",
      "createdAt": 1716472800000,
      "updatedAt": 1716472800000
    }
  ]
}
```

### Create Request Schema

What the AI sends when creating a new `{EntityName}`:

```json
{
  "action": "{connectorId}.{entityName}.create",
  "parameters": {
    "title": "Required title",
    // additional fields
  }
}
```

### Create Response Schema

```json
{
  "success": true,
  "data": {
    "uuid": "apple:NEW-UUID",
    "title": "Required title",
    "createdAt": 1716472800000,
    "updatedAt": 1716472800000
  }
}
```

---

## Error Response Schema

All failed queries return this shape:

```json
{
  "success": false,
  "error": {
    "code": "CONNECTOR_PERMISSION_DENIED",
    "message": "...",
    "connectorId": "{connectorId}",
    "retryable": false,
    "actionRequired": "SYSTEM_SETTINGS"
  }
}
```

See [Connector Error Taxonomy](../002-Error_Taxonomy/PAGE.md) for valid `code` values.

---

## Example: Completed Template (Calendar Event)

### Entity: Calendar Event

### Storage Schema (SQLite)

```sql
CREATE TABLE calendar_events (
  uuid          TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  title         TEXT,
  startDate     INTEGER,
  endDate       INTEGER,
  timezone      TEXT,
  allDay        BOOLEAN DEFAULT 0,
  description   TEXT,
  conferenceUrl TEXT,
  calendarUuid  TEXT,
  calendarTitle TEXT,
  calendarColor TEXT,
  updated_at    INTEGER
);
```

### Query Request

```json
{
  "action": "calendar.event.query",
  "parameters": {
    "startDate": 1716472800000,
    "endDate": 1719072000000,
    "calendars": ["Work", "Personal"],
    "includeAllDay": true
  }
}
```

### Query Response

```json
{
  "success": true,
  "meta": { "total": 12, "returned": 12, "limit": 50, "offset": 0 },
  "data": [
    {
      "uuid": "apple:ABC-123",
      "source": "apple",
      "title": "Team Standup",
      "startDate": 1716472800000,
      "endDate": 1716474600000,
      "timezone": "America/Los_Angeles",
      "allDay": false,
      "description": "Weekly sync",
      "conferenceUrl": null,
      "calendarTitle": "Work",
      "calendarColor": "#FF0000"
    }
  ]
}
```
