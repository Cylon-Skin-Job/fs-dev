---
name: Events Ledger Schema
description: SQLite event table concerns for payload storage, indexes, retention, correlation IDs, and graph-style relationships between events.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Events Provenance Model
    - Events File Versioning
  source-files:
    - fusion-studio-server/lib/ledger/event-ledger-subscriber.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before changing durable event storage.

The ledger is the durable record of system facts. It should store event identity, event type, timestamps, workspace/resource identity, provenance, causal links, payload metadata, and enough indexed fields for later query workflows.

## Schema Concerns

- Event ID, root event ID, parent event ID, correlation ID, and causation ID.
- Workspace, view, resource/path, thread, turn, tool call, UI action, harness ID, harness run, harness event, automation run, trigger run, script run, scheduler run, agent run, and audit query identifiers.
- JSON payload storage for the complete validated safe canonical event when registered sensitivity/redaction policy permits it; never an unconditional raw producer copy.
- Indexes for common forensic questions: file path, resource ID, actor, event family/type, thread, turn, tool call, UI action, harness ID/run/event, automation run, trigger run, script run, scheduler run, agent run, audit query, correlation ID, causation ID, root/parent event ID, edge endpoints, timestamp range, `changeStorm.reason` when present, and provider-keyed `nativeRefs` or provider-specific payloads when a harness adapter needs replay or dedupe queries.
- Validation status and warnings for accepted canonical events, plus structured non-canonical diagnostics for rejected candidates. Exact stored canonical or registered failure-safe-core payloads use `valid | valid_with_warnings`; a restricted ledger-only diagnostic body uses `defensive_fallback`, which can never provide historical relationship proof. Ledger or diagnostic persistence failure never changes the source operation's result.
- `canonical_admission_status = 'accepted'` on every `ledger_events` row, set only when the ledger listener receives UEB's privately branded accepted-reference delivery context. Validation status is separate and never proves admission; missing/forged delivery context creates no canonical ledger row.
- First-class edge and resource projection tables so audits can traverse UI actions, chat turns, tool calls, automation runs, resource mutations, file versions, storm batches, and audit/review records without parsing every payload.
- Retention and compaction policy for high-volume events.

File versioning can add its own tables, but it should link back to canonical event IDs.

Ledger storage has three exact material branches. Ordinary registered `not_required|applied` safe payloads are stored unchanged with a required matching non-null payload hash and are the only branch eligible for historical proof. An already-admitted registry-valid failure-safe-core payload (first package: exact UI safe core only) is stored unchanged with null hash and is categorically ineligible for `AcceptedLedgerRowRef`. Those two branches use `validation_status = valid | valid_with_warnings`. Missing/failed/thrown redaction that is not such a registered branch uses `validation_status = defensive_fallback` and a ledger-only body with exact `diagnostic: { code: 'ledger_defensive_fallback' }`, `payloadOmissions.redaction = 'failed'`, null hash, no unsafe material, and no historical-proof capability. Schema/policy/column consistency cannot substitute for integrity evidence; `loadAcceptedLedgerRowRef` returns no capability for every null-hash row. None affects the source operation.

`LED-D01` remains OWNER APPROVAL REQUIRED before SPEC-35b/SPEC-40c implements that non-null hash or `AcceptedLedgerRowRef`: select deterministic JSON canonicalization/serialization, byte encoding, hash algorithm, digest representation, stored policy/version, and migration/reverification rules. This ledger-integrity decision is separate from ULV-D10 content hashing and does not block the first Wiki/File resource/render package.

`LED-D04` is OWNER APPROVAL REQUIRED before production Slices 35b-35d: define exact natural/idempotency keys and unique constraints for every ledger table; event/child transaction boundaries; duplicate/conflict behavior; any detached retry/defer capacities, attempts, backoff, cancellation, shutdown/restart/replay, and missing-target behavior; database nonsettlement; terminal fixed diagnostics; and crash/concurrency/source-isolation tests. No inline retry or unbounded deferred work is allowed. Slice 35a inventory may proceed.
