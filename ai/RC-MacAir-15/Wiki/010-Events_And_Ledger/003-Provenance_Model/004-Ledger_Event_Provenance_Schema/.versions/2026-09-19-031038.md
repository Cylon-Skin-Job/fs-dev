---
name: Ledger Event Provenance Schema
description: Schema guidance for durable event storage, graph edges, indexes, redaction, and retention in the Universal Ledger.
metadata:
  incoming-edges:
    - Events Provenance Model
    - Resource Mutation Provenance Schema
  outgoing-edges:
    - Chat Metadata Provenance Schema
    - Resource Mutation Provenance Schema
    - File Version Provenance Schema
    - Audit Query And Review Provenance Schema
  source-files:
    - fusion-studio-server/lib/ledger/event-ledger.js
    - fusion-studio-server/lib/ledger/event-ledger-subscriber.js
    - fusion-studio-server/lib/db/migrations/029_event_ledger.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before changing durable event storage, ledger indexes, event payload storage, or graph edges between events.

Ledger event provenance is the durable sink for system facts. It must preserve enough identity and relationship data for future queries without requiring every audit to parse raw payload JSON.

## Boundary

The ledger stores canonical events, payloads, and edges. It should connect chat turns, tool calls, resource events, file versions, automation runs, UI actions, and later audit/review results.

Ledger rows preserve the persisted canonical event's `eventFamily` and `eventType`. Accepted canonical chat, tool, resource, file-version, automation, UI, and audit events are stored unwrapped with their exact frozen safe domain payload. Persistence generates the private row projection `ledger_event_id`; no persistence row key may enter the accepted event, stored canonical JSON, canonical identity, or a future canonical ledger/update event. Canonical events use event/domain/content identities and graph edges; query/storage APIs use row keys privately. Use `eventFamily: 'ledger'` only for ledger-internal maintenance, repair, migration, or audit facts. File-change storm batches remain `file.version.change_batch` unless a later decision changes the family.

## Ledger-Internal Event Payload

Canonical events stored in the ledger use their original domain payload. The shape below is only for ledger-internal events.

It is a non-authoritative design candidate. Open owner decision `LED-D02` must first decide whether any canonical ledger-internal maintenance/repair/migration/audit events are needed and approve their exhaustive schemas, producers, identity/row-key boundary, redaction/failure behavior, bounds, ordering/dedupe/replay/migration, and tests. Until then, no `eventFamily: 'ledger'` registry entry, producer, accepted ref, or persistence branch exists merely because this example is present.

Open owner decision `LED-D03` separately blocks `caused_by` edge extraction until the exact accepted relationship pointer/domain/confidence matrix and non-direct evidence behavior are approved. Endpoint admission proof never supplies causal meaning by itself.

Open owner decision `LED-D04` blocks production ledger event/projection/resource/native-ref/edge writes until exact table idempotency/uniqueness keys, atomic boundaries, duplicate/conflict behavior, bounded detached retry/defer semantics, cancellation/shutdown/restart/replay, missing targets, database nonsettlement, terminal fixed diagnostics, and crash/concurrency tests are approved. No inline retry or unbounded queue may be inferred.

```js
{
  schemaVersion,
  eventId,
  eventFamily: 'ledger',
  eventType,
  eventPhase,
  occurredAt,
  lifecycle,
  ids,
  actor,
  provenance: {
    source: {
      type,
      module,
      path,
      handler
    },
    origin: {
      type,
      id
    },
    observedBy: {
      type,
      module,
      path,
      handler
    },
    confidence,
    cause
  },
  context,
  resources: [],
  redaction,
  ledgerEvent: {
    payloadJson,
    edges: [
      { type, fromEventId, toEventId, fromEntityType, fromEntityId, toEntityType, toEntityId }
    ],
    indexes: []
  }
}
```

`sourceModule` may remain as a database compatibility field, but the canonical schema should expose it as `provenance.source.module`.

Edge direction uses `from_*` as the relationship subject or current event and `to_*` as the target. `caused_by` is effect -> cause; `triggered` is triggering event -> triggered work; `versioned_as` is resource mutation -> file version; `compacts` is storm/summary -> compacted events; audit edges flow from audit/review event to target.

## Connections

- Private ledger query and join projections relate chat turns, exchanges, tools, and resources to ledger row IDs; canonical chat metadata never stores persistence row IDs.
- Tool calls and resource mutations become graph nodes rather than isolated payloads.
- File versions point back to resource event IDs and causal chain IDs.
- Automation runs and UI actions become first-class causes.
- Audit queries can traverse graph edges instead of relying on time-window guesses.

## Gaps To Close

- The current ledger records only a narrow set of event types.
- Graph edges are not first-class yet.
- Indexes are needed for workspace, resource/path, event family/type, thread, turn, tool call, UI action, harness ID/run/event, automation run, trigger run, script run, scheduler run, agent run, audit query, correlation ID, causation ID, root/parent event ID, timestamp range, edge endpoints, `changeStorm.reason` when present, and provider-keyed `nativeRefs` or provider-specific payloads when a harness adapter needs replay or dedupe queries.
- Domain sensitivity and redaction policy still need detailed detection/retention rules before broad content durability. Storage branches are settled: ordinary safe payloads stay exact with required matching hash and are the only historical-proof-eligible branch; an admitted registered UI failure-safe-core stays exact with null hash but cannot yield `AcceptedLedgerRowRef`; both use `validation_status = valid | valid_with_warnings`. All other missing/failed/thrown redaction uses `validation_status = defensive_fallback` and a ledger-only body with exact code-only `ledger_defensive_fallback`, null hash, no unsafe material, and no historical-proof capability. `loadAcceptedLedgerRowRef` returns no capability for every null-hash row. None affects the source operation.
