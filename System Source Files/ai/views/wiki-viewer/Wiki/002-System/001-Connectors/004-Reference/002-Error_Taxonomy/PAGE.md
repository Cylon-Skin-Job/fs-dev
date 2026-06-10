---
title: Connector Error Taxonomy
description: Standardized error codes and handling strategies for all connectors.
icon: error
---

# Connector Error Taxonomy

Every connector error must use a code from this taxonomy. This lets the AI decide whether to retry, escalate, or fail silently.

---

## Error Structure

All connector errors emit this shape on the event bus:

```json
{
  "connectorId": "mail",
  "errorCode": "CONNECTOR_PERMISSION_DENIED",
  "message": "Full Disk Access not granted for Mail Envelope Index",
  "retryable": false,
  "actionRequired": "SYSTEM_SETTINGS",
  "timestamp": 1716472800000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `connectorId` | `string` | Which connector failed |
| `errorCode` | `string` | Machine-readable code from this taxonomy |
| `message` | `string` | Human-readable description |
| `retryable` | `boolean` | Can the AI retry automatically? |
| `actionRequired` | `string \| null` | What the user must do, if anything |
| `timestamp` | `number` | Unix timestamp (ms) |

---

## Error Codes

### Permission Errors (`PERM_*`)

| Code | retryable | actionRequired | Meaning |
|------|-----------|----------------|---------|
| `CONNECTOR_PERMISSION_DENIED` | ❌ | `SYSTEM_SETTINGS` | TCC or FDA permission missing |
| `CONNECTOR_PERMISSION_REVOKED` | ❌ | `SYSTEM_SETTINGS` | Was granted, now revoked |
| `CONNECTOR_PERMISSION_PROMPT_DISMISSED` | ❌ | `SYSTEM_SETTINGS` | User clicked "Don't Allow" |
| `CONNECTOR_PERMISSION_PENDING` | ✅ | `null` | Dialog shown, awaiting user response |

### Database Errors (`DB_*`)

| Code | retryable | actionRequired | Meaning |
|------|-----------|----------------|---------|
| `DB_SQLITE_BUSY` | ✅ | `null` | Database locked by another process |
| `DB_SQLITE_CORRUPT` | ❌ | `RESTART_CONNECTOR` | Database unreadable |
| `DB_NOT_FOUND` | ❌ | `null` | Expected database file missing |
| `DB_SCHEMA_MISMATCH` | ❌ | `UPDATE_APP` | Table/column mismatch with expected schema |

### Network Errors (`NET_*`)

| Code | retryable | actionRequired | Meaning |
|------|-----------|----------------|---------|
| `NET_TIMEOUT` | ✅ | `null` | Request exceeded timeout |
| `NET_UNREACHABLE` | ✅ | `null` | No network connectivity |
| `NET_RATE_LIMITED` | ✅ | `null` | 429 / quota exceeded. Retry with backoff. |
| `NET_UNAUTHORIZED` | ❌ | `REAUTHENTICATE` | OAuth token expired or invalid |
| `NET_SERVER_ERROR` | ✅ | `null` | 5xx from remote. Retry with backoff. |

### AppleScript Errors (`AS_*`)

| Code | retryable | actionRequired | Meaning |
|------|-----------|----------------|---------|
| `AS_TIMEOUT` | ✅ | `null` | Target app did not respond |
| `AS_APP_NOT_RUNNING` | ✅ | `null` | Target app is closed. Will auto-launch. |
| `AS_PERMISSION_DENIED` | ❌ | `SYSTEM_SETTINGS` | Automation TCC denied |
| `AS_SYNTAX_ERROR` | ❌ | `null` | Script bug — not a runtime failure |

### Sync Errors (`SYNC_*`)

| Code | retryable | actionRequired | Meaning |
|------|-----------|----------------|---------|
| `SYNC_CONFLICT` | ❌ | `USER_REVIEW` | Local and remote changes collide |
| `SYNC_PARTIAL` | ✅ | `null` | Some items failed, others succeeded |
| `SYNC_STALE_DATA` | ✅ | `null` | Data older than expected. Force refresh. |

### Generic Errors (`GEN_*`)

| Code | retryable | actionRequired | Meaning |
|------|-----------|----------------|---------|
| `GEN_UNKNOWN` | ✅ | `null` | Unclassified — log and retry once |
| `GEN_NOT_IMPLEMENTED` | ❌ | `null` | Connector stub — no backend code |
| `GEN_CONFIG_MISSING` | ❌ | `OPEN_SETTINGS` | Required config value not set |

---

## Retry Strategy

When `retryable: true`, the AI must follow this backoff:

| Attempt | Delay | Max Total |
|---------|-------|-----------|
| 1st retry | 2s | 2s |
| 2nd retry | 5s | 7s |
| 3rd retry | 10s | 17s |
| 4th+ | 30s | — |

After 3 retries, escalate to `connector:error` with `retryable: false`.

---

## ActionRequired Mapping

| Value | AI Behavior |
|-------|-------------|
| `null` | Handle silently or log only |
| `SYSTEM_SETTINGS` | Surface a message with the exact Settings path |
| `REAUTHENTICATE` | Trigger OAuth re-flow or open credentials panel |
| `RESTART_CONNECTOR` | Toggle off, wait 1s, toggle on |
| `UPDATE_APP` | Warn user that app update is required |
| `USER_REVIEW` | Present conflict UI or ask user to resolve |
| `OPEN_SETTINGS` | Open Fusion Studio settings panel |
