---
title: Connector State Machine
description: Formal lifecycle definition for all connectors.
icon: account_tree
---

# Connector State Machine

Every connector follows this lifecycle. The AI uses this to reason about what actions are valid at any moment.

---

## States

```
         ┌─────────────┐
         │  DISABLED   │◄─────────────────────────┐
         └──────┬──────┘                          │
                │ toggle on                       │ toggle off
                ▼                                 │
         ┌─────────────┐     probe fails         │
    ┌────│  PROBING    │────────────────►┌───────┴───────┐
    │    └──────┬──────┘                 │PERMISSION_NEEDED│
    │           │ probe succeeds          └───────┬───────┘
    │           ▼                                   │
    │    ┌─────────────┐     permission granted    │
    │    │   ENABLED   │◄──────────────────────────┘
    │    └──────┬──────┘
    │           │ sync starts
    │           ▼
    │    ┌─────────────┐
    └────│   SYNCING   │
         └──────┬──────┘
                │ sync succeeds
                ▼
         ┌─────────────┐
    ┌────│   ACTIVE    │
    │    └──────┬──────┘
    │           │ error
    │           ▼
    │    ┌─────────────┐     recoverable     ┌─────────┐
    └────│    ERROR    │────────────────────►│ SYNCING │
         └─────────────┘                     └─────────┘
```

---

## State Definitions

| State | `enabled` | `status` | Meaning |
|-------|-----------|----------|---------|
| **Disabled** | `false` | `gray` | Connector off. No resources allocated. |
| **Probing** | `true` | `yellow` | Checking permissions and connectivity. |
| **Permission Needed** | `true` | `yellow` | Missing TCC / FDA / OAuth. Awaiting user. |
| **Enabled** | `true` | `yellow` | Permission OK, waiting for first sync. |
| **Syncing** | `true` | `yellow` | Actively reading/writing data. |
| **Active** | `true` | `green` | Synced. Data available for queries. |
| **Error** | `true` | `red` | Failure. May be recoverable or fatal. |

---

## Valid Transitions

| From | To | Trigger | Event Emitted |
|------|-----|---------|---------------|
| Disabled | Probing | User toggles on | `connector:enabled` |
| Probing | Permission Needed | Permission check fails | `connector:permission_needed` |
| Probing | Enabled | Permission check passes | `connector:permission_granted` |
| Permission Needed | Enabled | User grants permission | `connector:permission_granted` |
| Enabled | Syncing | First sync triggered | `connector:sync_start` |
| Syncing | Active | Sync succeeds | `connector:sync_complete` |
| Syncing | Error | Sync fails | `connector:error` |
| Active | Syncing | Periodic re-sync or forced refresh | `connector:sync_start` |
| Active | Error | Runtime failure | `connector:error` |
| Error | Syncing | Retry succeeds or user retries | `connector:sync_start` |
| Error | Disabled | User toggles off or fatal error | `connector:disabled` |
| *Any* | Disabled | User toggles off | `connector:disabled` |

**Invalid transitions** (must be rejected):
- Disabled → Active
- Probing → Syncing
- Permission Needed → Syncing
- Active → Enabled

---

## Events

### `connector:enabled`
```json
{
  "connectorId": "mail",
  "timestamp": 1716472800000,
  "triggeredBy": "user"
}
```

### `connector:disabled`
```json
{
  "connectorId": "mail",
  "timestamp": 1716472800000,
  "triggeredBy": "user"
}
```

### `connector:permission_needed`
```json
{
  "connectorId": "mail",
  "permission": "FULL_DISK_ACCESS",
  "path": "System Settings → Privacy & Security → Full Disk Access",
  "timestamp": 1716472800000
}
```

### `connector:permission_granted`
```json
{
  "connectorId": "mail",
  "permission": "FULL_DISK_ACCESS",
  "timestamp": 1716472800000
}
```

### `connector:sync_start`
```json
{
  "connectorId": "calendar",
  "source": "apple",
  "timestamp": 1716472800000
}
```

### `connector:sync_complete`
```json
{
  "connectorId": "calendar",
  "source": "apple",
  "itemCount": 42,
  "durationMs": 340,
  "timestamp": 1716472800000
}
```

### `connector:error`
```json
{
  "connectorId": "mail",
  "errorCode": "CONNECTOR_PERMISSION_DENIED",
  "message": "...",
  "retryable": false,
  "actionRequired": "SYSTEM_SETTINGS",
  "timestamp": 1716472800000
}
```

---

## Persistence

The canonical state is stored server-side in SQLite:

```sql
CREATE TABLE connector_states (
  connector_id   TEXT PRIMARY KEY,
  enabled        BOOLEAN NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'gray',
  last_synced_at INTEGER,
  error_count    INTEGER DEFAULT 0,
  last_error     TEXT,
  updated_at     INTEGER
);
```

The client Zustand store mirrors this table. On startup, the client hydrates from the server. On toggle, the client optimistically updates and the server confirms.

> **Current status:** This table does not yet exist. Toggle state is in-memory only.
