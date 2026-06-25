---
title: Event Payload Schema
description: Standardized event bus payload definitions for all connectors.
icon: broadcast_on_personal
---

# Event Payload Schema

Every event emitted by or about a connector must follow these payload shapes. This lets the AI listen to the event bus and understand what happened without parsing free-text messages.

---

## Base Payload

All connector events share these fields:

```json
{
  "event": "connector:sync_complete",
  "connectorId": "calendar",
  "timestamp": 1716472800000,
  "version": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `event` | `string` | Event name |
| `connectorId` | `string` | Which connector emitted this |
| `timestamp` | `number` | Unix timestamp (ms) |
| `version` | `number` | Payload schema version (starts at 1) |

---

## Lifecycle Events

### `connector:enabled`

Fired when a connector is toggled on.

```json
{
  "event": "connector:enabled",
  "connectorId": "mail",
  "timestamp": 1716472800000,
  "version": 1,
  "triggeredBy": "user",
  "previousState": "disabled"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `triggeredBy` | `"user" \| "system" \| "auto_restart"` | Who/what enabled it |
| `previousState` | `string` | State before this transition |

### `connector:disabled`

Fired when a connector is toggled off.

```json
{
  "event": "connector:disabled",
  "connectorId": "mail",
  "timestamp": 1716472800000,
  "version": 1,
  "triggeredBy": "user",
  "previousState": "active"
}
```

### `connector:permission_needed`

Fired when a probe detects missing permission.

```json
{
  "event": "connector:permission_needed",
  "connectorId": "mail",
  "timestamp": 1716472800000,
  "version": 1,
  "permission": "FULL_DISK_ACCESS",
  "systemPath": "System Settings → Privacy & Security → Full Disk Access",
  "blocking": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `permission` | `string` | Machine-readable permission name |
| `systemPath` | `string` | Human-readable navigation path |
| `blocking` | `boolean` | `true` if connector cannot proceed without this |

### `connector:permission_granted`

Fired when a previously needed permission is now satisfied.

```json
{
  "event": "connector:permission_granted",
  "connectorId": "mail",
  "timestamp": 1716472800000,
  "version": 1,
  "permission": "FULL_DISK_ACCESS"
}
```

---

## Sync Events

### `connector:sync_start`

Fired at the beginning of any sync operation.

```json
{
  "event": "connector:sync_start",
  "connectorId": "calendar",
  "timestamp": 1716472800000,
  "version": 1,
  "source": "apple",
  "reason": "periodic",
  "estimatedItems": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Which sub-connector (`apple`, `google`, `slack`) |
| `reason` | `string` | Why sync started: `periodic`, `forced`, `startup`, `watcher` |
| `estimatedItems` | `number \| null` | Hint at workload, if known |

### `connector:sync_complete`

Fired when a sync finishes successfully.

```json
{
  "event": "connector:sync_complete",
  "connectorId": "calendar",
  "timestamp": 1716472800000,
  "version": 1,
  "source": "apple",
  "reason": "periodic",
  "result": {
    "inserted": 3,
    "updated": 12,
    "deleted": 1,
    "unchanged": 45,
    "failed": 0
  },
  "durationMs": 340
}
```

| Field | Type | Description |
|-------|------|-------------|
| `result.inserted` | `number` | New items added to local store |
| `result.updated` | `number` | Existing items modified |
| `result.deleted` | `number` | Items removed |
| `result.unchanged` | `number` | Items checked but not modified |
| `result.failed` | `number` | Items that could not be processed |
| `durationMs` | `number` | How long the sync took |

### `connector:sync_progress`

Fired during long-running syncs (optional, for large datasets).

```json
{
  "event": "connector:sync_progress",
  "connectorId": "mail",
  "timestamp": 1716472800000,
  "version": 1,
  "source": "apple",
  "processed": 150,
  "total": 2000,
  "percent": 7.5
}
```

---

## Error Events

### `connector:error`

Fired on any failure. Uses the standard error taxonomy.

```json
{
  "event": "connector:error",
  "connectorId": "mail",
  "timestamp": 1716472800000,
  "version": 1,
  "errorCode": "DB_SQLITE_BUSY",
  "message": "Envelope Index locked by Mail.app",
  "retryable": true,
  "actionRequired": null,
  "context": {
    "operation": "read",
    "table": "messages",
    "attempt": 2
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `errorCode` | `string` | From [Connector Error Taxonomy](Connector_Error_Taxonomy.md) |
| `message` | `string` | Human-readable description |
| `retryable` | `boolean` | Can the AI retry? |
| `actionRequired` | `string \| null` | User action needed, if any |
| `context` | `object` | Optional. Operation-specific details. |

---

## Status Events

### `connector:status_changed`

Fired whenever the connector's `status` field changes (gray → yellow → green → red).

```json
{
  "event": "connector:status_changed",
  "connectorId": "calendar",
  "timestamp": 1716472800000,
  "version": 1,
  "previousStatus": "yellow",
  "currentStatus": "green",
  "reason": "sync_complete"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `previousStatus` | `string` | Old status color |
| `currentStatus` | `string` | New status color |
| `reason` | `string` | Why it changed: `sync_complete`, `error`, `toggle`, `permission_granted` |

---

## WebSocket Broadcast Format

Server-to-client WebSocket messages wrap the event:

```json
{
  "type": "connector:event",
  "payload": {
    "event": "connector:sync_complete",
    "connectorId": "calendar",
    "timestamp": 1716472800000,
    "version": 1,
    "source": "apple",
    "result": { "inserted": 3, "updated": 12, "deleted": 1, "unchanged": 45, "failed": 0 },
    "durationMs": 340
  }
}
```

The `type` field is always `"connector:event"` so the client can route all connector events through a single handler.
