---
name: File Version Provenance Schema
description: Schema guidance for before and after snapshots, diffs, restore records, and file version IDs tied to resource events.
metadata:
  incoming-edges:
    - Events Provenance Model
    - Resource Mutation Provenance Schema
  outgoing-edges:
    - Resource Mutation Provenance Schema
    - Ledger Event Provenance Schema
    - Events File Versioning
  source-files:
    - fusion-studio-server/lib/versioning.js
    - fusion-studio-server/lib/file-explorer.js
    - fusion-studio-server/lib/db/migrations/029_event_ledger.js
  connected-skills: []
  related-trigger-files: []
---

> **Schema correction authority (2026-07-15):** Apply the [provenance cross-article findings](../../../../Captures/008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat. File-version hash behavior remains an owner decision under finding 5 and ULV-D10.

Use this page before designing universal SQLite file versioning, restore behavior, snapshot storage, or diff storage.

File version provenance ties content history to canonical resource mutation events. It should not become a second watcher or Git-based source of truth.

## Boundary

File version records are created only from admitted canonical resource mutation deliveries. After owner decision `ULV-D12` closes the exact non-batch event/lifecycle/envelope/identity/order/idempotency/failure/transaction contract, the 40b2d1 builder consumes that resource ref to insert both `fileVersion.createdFromResourceEventId` and `ids.parentEventId` from the same upstream `eventId`, and optionally inserts `ids.correlationId` only from that upstream event's present validated correlation; absence means omission. Copied, raw, prepopulated, or mismatched bindings fail. Accepted SPEC-35d separately proves `versioned_as`. The version event uses the versioning subscriber as source/observer and may project safe non-ID context/type/confidence, but it does not transitively copy root/causation, actor/origin IDs, or cause IDs embedded in the resource event because the resource ref cannot prove those earlier refs. Audits traverse through the accepted resource event; an earlier identity appears directly only when the producer separately binds its original live ref or revalidated historical capability.

Exception: `file.version.change_batch` storm records carry `changeStorm` instead of `fileVersion`; SPEC-39 owns that payload.

## Domain Payload

`fileVersion.createdFromResourceEventId` is builder-inserted from the accepted resource event's top-level `eventId`. Optional `fileVersion.createdFromResourceMutationId` is not distinct identity: it must equal that same source's registered `/resourceMutation/resourceEventId` and `domainIds.resourceEventId`, inserted through the exact SPEC-40b2d1 target/source selector. Missing source domain identity omits it; raw/copied/mismatched IDs are invalid. Branchwise registry order is live-only 40b2d1 metadata/hash-only candidate (whose concrete hashes remain prohibited until finding 5 and `ULV-D10` approve their policy), post-40c 40b2d1h historical replay/backfill, 40b2d2 content artifacts, then 40b2d3 storm batches; each activates before matching behavior and uses the SPEC-35b/35d/35f/40c gates defined by the File Versioning page.

```js
{
  schemaVersion,
  eventId,
  eventFamily: 'file.version',
  eventType,
  eventPhase,
  occurredAt,
  lifecycle,
  ids,
  actor,
  provenance,
  context,
  fileVersion: {
    fileVersionId,
    createdFromResourceEventId,
    createdFromResourceMutationId,
    resourceId,
    resourceType,
    path,
    oldPath,
    operation,
    snapshotBeforeId,
    snapshotAfterId,
    diffId,
    contentHashBefore,
    contentHashAfter,
    sizeBefore,
    sizeAfter,
    restoreOfVersionId,
    retentionClass,
    eligibility
  },
  resources: [],
  redaction
}
```

Directories, deletes, renames, binaries, generated files, large files, and restore events need explicit eligibility and retention behavior.

The hash fields above are candidates, not an approval to copy resource-event hashes. First-package resource events omit every concrete content hash under `resource-metadata-v1`. A file-version record may carry hashes only if the owner selects the separate-policy branch in finding 5 and ULV-D10 registers that exact file-version hash/redaction policy; otherwise those fields remain absent.

## Connections

- Resource mutation events trigger version creation.
- Ledger edges connect versions to chat turns, tool calls, UI actions, triggers, schedulers, and scripts.
- Chat metadata can reference version IDs for mutations that occurred during a turn.
- Audits can compare before/after content and walk from a broken file to the likely cause.

## Gaps To Close

- Existing Git-based versioning is separate and reason-based.
- There is no universal version table linked to resource events.
- Storm compaction and retention policy must be defined before high-frequency snapshots are enabled.
- Binary files, large files, generated files, and secrets need eligibility and redaction rules.
