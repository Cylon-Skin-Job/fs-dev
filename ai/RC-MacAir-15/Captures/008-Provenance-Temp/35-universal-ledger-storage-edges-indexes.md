# SPEC-35 - Universal Ledger Storage, Edges, and Indexes

Status: DISCUSSION DRAFT

Schema correction authority: [2026-07-15 provenance cross-article findings](provenance-schema-findings.md) plus owner direction in chat on 2026-07-15. Decision-tagged projections remain conditional and unregistered until approved.

## Mission

Build the durable SQLite ledger layer that can persist accepted canonical Universal Event Bus events, preserve complete validated safe provenance payloads only when registered sensitivity/redaction policy permits, and support graph-style forensic traversal across UI actions, chat turns, tool calls, harness events, automation runs, resource mutations, file versions, storm batches, and audit queries.

This spec is the storage and traversal foundation underneath:

- [SPEC-32 - Resource Event Sync Controller](32-resource-event-sync-controller.md)
- [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md)
- [SPEC-34 - UI Action Provenance Module](34-ui-action-provenance-module.md)
- [SPEC-36 - Harness, Tool, and Native Reference Provenance](36-harness-tool-native-ref-provenance.md)
- [SPEC-37 - Automation, Trigger, Scheduler, Script, and Agent Provenance](37-automation-trigger-scheduler-provenance.md)
- [SPEC-38 - Audit Query and Review Provenance Loops](38-audit-query-review-provenance-loops.md)
- [SPEC-39 - Change Storm Control and Compaction](39-change-storm-control-compaction.md)
- [SPEC-40 - Provenance Schema Registry and Event Validation](40-provenance-schema-registry-validation.md)

## Wiki Sources

- [Events And Ledger Decisions](../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md)
- [Events Provenance Model](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md)
- [Events Ledger Schema](../../Wiki/010-Events_And_Ledger/004-Ledger_Schema/PAGE.md)
- [Ledger Event Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/004-Ledger_Event_Provenance_Schema/PAGE.md)
- [Correlation And Causality](../../Wiki/010-Events_And_Ledger/007-Correlation_And_Causality/PAGE.md)
- [Assistant Query And Review Loops](../../Wiki/010-Events_And_Ledger/009-Assistant_Query_And_Review_Loops/PAGE.md)

## Scope

This spec covers ledger persistence, event identity, common indexed columns, graph edges, JSON payload storage, query helpers, and retention hooks.

It does not implement file snapshot/diff storage, UI action capture, resource invalidation, harness event translation, automation execution, or assistant review behavior. Those domains feed this ledger through canonical events and edges.

## Non-Negotiable Rules

- The ledger stores canonical events with their original `eventFamily` and `eventType`.
- `eventFamily: 'ledger'` is only for ledger-internal maintenance, repair, migration, and audit events.
- File-change storm batches remain `eventFamily: 'file.version'` with `eventType: 'file.version.change_batch'` unless a later wiki decision changes that.
- `eventId` is the canonical graph node ID for the persisted event.
- `ledger_events.ledger_event_id` is a persistence/query projection, not a canonical event-envelope field, and must not replace `eventId` or be inserted into frozen `payload_json`.
- Domain IDs stay in domain payloads, `ids`, `provenance.cause`, or `resources[]`; they are not aliases for `eventId`.
- Provider-native IDs, including OpenCode IDs, stay under provider-keyed `nativeRefs` or provider-specific payloads.
- Unknown attribution stays unknown. Storage must not infer causality just because two events are near each other.

## Data Model

### Open Owner Decision

| ID | Decision | Status |
|---|---|---|
| LED-D01 | Which deterministic ledger payload canonicalization/serialization, byte encoding, hash algorithm, digest representation, stored policy/version, and migration/reverification rules govern `payload_hash`? | OWNER APPROVAL REQUIRED before Slice 35b or SPEC-40c payload hashing/`AcceptedLedgerRowRef`. This is separate from ULV-D10 content/snapshot/diff/tool-output hash policy and does not block SPEC-40a/40b1a or first Wiki/File resource sync. |
| LED-D02 | What exact canonical ledger-internal maintenance/repair/migration/audit events, if any, are needed? | OWNER APPROVAL REQUIRED before SPEC-40b2e registers or any producer emits/persists `eventFamily: 'ledger'`. Define exact event types/phases/lifecycle presence, owning producer/domain IDs, actor/source/origin/observer, payload versus private row-key boundaries, accepted-only relationships, sensitivity/redaction policy and safe-core/no-event behavior, deterministic bounds/overflow, ordering/dedupe/replay/migration behavior, and failure-isolation tests. Ordinary SPEC-35 storage of accepted events in their original families does not require or imply a ledger-internal canonical event. |
| LED-D03 | Which accepted relationship pointers and `provenance.confidence` values may produce a durable `caused_by` edge? | OWNER APPROVAL REQUIRED before Slice 35d writes any `caused_by` edge. Accepted refs/capabilities prove endpoint identity but not the causal assertion. Define whether only `direct` qualifies or any non-direct value can qualify; the exact event-type/pointer/domain matrix for `ids.causationId` and each `provenance.cause.*`; required confidence/pointer consistency validation; handling of correlated/inferred/unknown links through non-causal correlation evidence; duplicate/conflicting causes; and deterministic rejection/diagnostic tests. Until closure, 35d may implement indexes and approved non-causal edges but writes zero `caused_by` rows. |
| LED-D04 | What exact idempotency, transaction, retry/defer, capacity, shutdown, and restart contract governs ledger event rows, projections, resources, native refs, and edges? | OWNER APPROVAL REQUIRED before Slices 35b-35d write production data. Approve exact natural/idempotency keys and unique constraints for every table; atomic event/child boundaries; duplicate/conflict behavior; whether any detached retry exists; queue/item/byte capacities; attempt count and backoff values; cancellation/shutdown/restart/replay semantics; permanently missing target handling; terminal fixed diagnostics; and database nonsettlement behavior. No inline/source-path retry or unbounded deferred work is permitted. Slice 35a inventory may proceed. |

### `ledger_events`

Core columns plus explicitly marked conditional projections:

```text
ledger_event_id
event_id
schema_version
event_family
event_type
event_phase
occurred_at
received_at
workspace_id
machine_id
thread_id
turn_id
exchange_id
message_id
root_event_id
parent_event_id
correlation_id
causation_id
server_mutation_id
tool_call_id
ui_action_id
harness_id
harness_run_id
harness_event_id
automation_run_id
trigger_run_id        -- conditional: only if AUT-D03 approves the field/selector
scheduler_run_id      -- conditional: only if AUT-D03 approves the field/selector
script_run_id         -- conditional: only if AUT-D03 approves the field/selector
agent_run_id          -- conditional: only if AUT-D03 approves the field/selector
audit_query_id
actor_type
actor_id
context_scope
view_id
panel_id
route
origin_type
origin_id
source_type
source_module
observed_by_type
observed_by_module
confidence
payload_json
payload_hash
redaction_policy
canonical_admission_status
validation_status
validation_warnings_json
created_at
```

The compact columns exist for search and joins. `canonical_admission_status` is `TEXT NOT NULL CHECK (canonical_admission_status = 'accepted')`; a row receives it only when the ledger listener is invoked with UEB's privately branded `AcceptedCanonicalRef` delivery context for that event. Validation alone cannot set or imply this marker. `validation_status` is separately `TEXT NOT NULL CHECK (validation_status IN ('valid', 'valid_with_warnings', 'defensive_fallback'))` and describes the stored material, not UEB admission. `valid` and `valid_with_warnings` mean the exact stored payload validates as a registered safe canonical or failure-safe-core branch. `defensive_fallback` means ledger replaced an inconsistent accepted delivery with the restricted ledger-only diagnostic body below; it never proves domain-payload validity or historical relationships. `payload_json` stores the validated safe canonical body for the first two statuses, not an unconditional copy of producer input. For potentially sensitive domains, a complete ordinary payload requires `redaction.status = 'not_required' | 'applied'` plus registered policy ID/version. The one first-package exception is the exact already-admitted registered `ui.action` failed-redaction safe core; ledger stores that frozen safe payload unchanged, not a second fallback shape.

If missing/failed/thrown redaction reaches ledger but the exact accepted payload does not validate as a registry-defined canonical failure-safe-core branch, ingestion uses a ledger-only defensive fallback: persist only `schemaVersion`, `eventId`, family/type/phase, timestamps/lifecycle status, exact `diagnostic: { code: 'ledger_defensive_fallback' }`, and `payloadOmissions.redaction = 'failed'`; set `validation_status = 'defensive_fallback'` and `payload_hash` null; and omit actor IDs, context, paths/resources, native refs, domain payload/output/content, previews, and derived hashes. The diagnostic has exactly one key and no input-derived values. This fallback does not validate as the original domain event, cannot mint `AcceptedLedgerRowRef`, and does not make an invalid candidate canonical. The source operation and independently accepted UEB event remain unaffected.

### `ledger_event_edges`

Required columns:

```text
edge_id
from_event_id
to_event_id
from_entity_type
from_entity_id
to_entity_type
to_entity_id
edge_type
workspace_id
resource_path
resource_id
confidence
metadata_json
created_at
```

`from_event_id` and `to_event_id` reference canonical `eventId` values when both sides are events. `from_entity_type` / `from_entity_id` and `to_entity_type` / `to_entity_id` allow edges to point at durable domain records such as a file version, UI action, tool call, automation run, or audit query before every domain object has its own canonical event row. `to_event_id` is nullable when the target is only a domain entity.

Direction convention: `from_*` is the relationship subject or current event and `to_*` is the target. `caused_by` is effect -> cause; `triggered` is triggering event -> triggered work; `versioned_as` is resource mutation -> file version; `compacts` is storm/summary -> compacted events; `queried`, `reviewed`, and `recommended` flow from audit/review event to target.

### `ledger_event_resources`

Core columns plus explicitly marked conditional projections:

```text
ledger_event_id
event_id
workspace_id
role
resource_id
resource_type
path
old_path
related_event_id
resource_event_id
file_version_id       -- conditional: only after owning file-version relationship registration
metadata_json
```

This table projects `resources[]` for path/resource queries without requiring every query to parse JSON.

### `ledger_event_native_refs`

Required columns:

```text
ledger_event_id
event_id
provider
ref_key
ref_value
metadata_json
```

Use this table only for replay, dedupe, and provider debugging. It must not become the canonical identity model.

## Edge Vocabulary

The ledger must support the shared wiki edge vocabulary:

- `caused_by`
- `observed_by`
- `triggered`
- `mutated`
- `read`
- `wrote`
- `versioned_as`
- `restored_from`
- `compacts`
- `represents`
- `queried`
- `reviewed`
- `recommended`

Domain specs may add narrow metadata to edges, but new edge names require an update to the provenance wiki before implementation.

## Indexes

First slice indexes:

```text
event_id unique
ledger_event_id unique
event_family, event_type, occurred_at
occurred_at
workspace_id, occurred_at
workspace_id, resource path via ledger_event_resources
thread_id, turn_id, occurred_at
context_scope, view_id, panel_id
actor_type, actor_id, occurred_at
tool_call_id projection when present
ui_action_id projection when present
harness_id, harness_run_id, harness_event_id
automation_run_id
trigger_run_id        -- conditional: only if AUT-D03 approves the field/selector
scheduler_run_id      -- conditional: only if AUT-D03 approves the field/selector
script_run_id         -- conditional: only if AUT-D03 approves the field/selector
agent_run_id          -- conditional: only if AUT-D03 approves the field/selector
audit_query_id
correlation_id
causation_id
root_event_id
parent_event_id
changeStorm.reason projection when present
provider, ref_key, ref_value via ledger_event_native_refs
ledger_event_edges(from_event_id, edge_type, created_at)
ledger_event_edges(to_event_id, edge_type, created_at)
ledger_event_edges(from_entity_type, from_entity_id, edge_type)
ledger_event_edges(to_entity_type, to_entity_id, edge_type)
```

If SQLite JSON indexes are used, they are implementation details. The conceptual contract is that common forensic questions do not require full-table JSON scans.

## Event Ingestion

The ledger subscriber consumes canonical UEB deliveries as `(frozenEvent, { acceptedRef })` after domain producers have set the common envelope. It must call `assertAcceptedDelivery(frozenEvent, acceptedRef)` before ingestion; the private registry's exact frozen-event/ref binding is the admission proof. The ledger never reconstructs acceptance from `eventId`, validation output, a copied event, or a raw runtime ID.

Ledger ingestion is never in the source operation's success path. Validation, projection, edge extraction, database availability, or write failure follows the owner-approved LED-D04 terminal/retry contract for the ledger's own work and must not reject, delay, or roll back the prompt, mutation, tool call, automation, or observation that produced the event. Before D04 closes there is no production write, retry, or deferred queue. Missing optional projections create null/omitted columns or warnings rather than invalidating the preserved canonical payload.

Ingestion steps:

1. Require the privately branded `acceptedRef` supplied by UEB for this delivery. A missing/forged context writes no `ledger_events` row and produces a non-canonical diagnostic.
2. Validate the common envelope and registered storage branch. Set `validation_status` to `valid` or `valid_with_warnings` only when the exact stored payload validates as an ordinary safe canonical or registered failure-safe-core branch; otherwise store only the restricted ledger diagnostic body with `validation_status = 'defensive_fallback'`.
3. Generate the database row's `ledger_event_id` projection and set `canonical_admission_status = 'accepted'` from the verified delivery context. Never add `ledger`, `ledgerEventId`, `ledger_event_id`, or any persistence row key to `frozenEvent`, stored canonical `payload_json`, a canonical identity, or a future canonical ledger/update event. Canonical events refer to event/domain/content identities and graph edges; query/storage APIs use row keys privately.
4. Classify the registered domain's sensitivity. Persist an ordinary validated safe payload unchanged; persist an already-admitted exact registered failure-safe-core payload (first package: UI only) unchanged; otherwise use the ledger-only defensive fallback above. Never blindly preserve producer input.
5. Project compact columns only from the stored safe form. Ordinary validated safe payloads require a non-null `payload_hash` computed over exact `payload_json`. An exact registered UI failed-redaction safe core is stored unchanged with `payload_hash = null`. The ledger-only defensive fallback also has null hash and must not leak omitted material through columns/children. Both null-hash branches are categorically ineligible for historical relationship proof.
6. Create no `caused_by` edge until owner-approved `LED-D03` supplies the exact accepted pointer/confidence matrix. Endpoint proof alone is insufficient. After closure, extract only matrix-approved relationships already present in the frozen builder-verified event; non-qualifying confidence uses correlation evidence or omission, never an implementation-chosen causal edge.
7. Keep `ids.rootEventId` and `ids.parentEventId` as indexed relationship fields unless the wiki later defines non-causal edge types for them.
8. Create non-causal edges from explicit domain links and `resources[]` using the shared edge vocabulary.
9. Record validation warnings without mutating the source event into a false causal shape.

Edge extraction accepts only cause/domain links already present in the exact frozen accepted safe event after `assertAcceptedDelivery`. Admission proves that its accepted-only relationship pointers were inserted and verified by `prepareCanonicalCandidate`; `inspectAcceptedRef` strings are inspection-only and can never create or alter an edge. A separately accepted upstream ref proves only its own event, not a relationship from the current event. If the target event is absent from ledger storage, do not invent or silently drop an edge. Apply only LED-D04's approved atomic/idempotent defer-or-terminal branch; before D04 closes no production edge writer or deferred queue exists. This storage gap never affects either source operation.

Historical consumers never treat a row object or status string as relationship proof. SPEC-40c adds `loadAcceptedLedgerRowRef(ledgerEventId)`: the trusted repository requires accepted admission plus `validation_status IN ('valid', 'valid_with_warnings')`, parses and revalidates the exact stored payload at its registered schema/policy version, verifies compact identity columns, and requires a present matching `payload_hash`. Every null-hash row is categorically ineligible, including the exact registered UI failed-redaction safe-core and every ledger-only defensive fallback; schema/policy/column agreement without integrity evidence cannot prove the originally accepted identity. Missing/tampered/mismatched/unregistered/null-hash rows return null plus incomplete-evidence diagnostics. Canonical audit/storm/follow-up candidates pass only a qualifying capability to `prepareCanonicalCandidate`; they never copy row IDs directly.

## Query Helpers

Provide server-side helpers for these graph questions:

- Given a file path, list recent resource mutations and file versions.
- Given a file version, walk to resource event, cause, tool/UI/automation, chat turn, and nearby mutations.
- Given a tool call, list read/write/mutation/version edges.
- Given a UI action, list downstream resource mutations and chat/tool events.
- Given an automation run, list matched event, script/tool output, resource mutations, and versions.
- Given a harness run/event, list normalized tool/chat/resource events and native refs.
- Given an audit query, list searched evidence, recommendations, and generated tickets.

Helpers return stable IDs and compact summaries first. Large payloads, blobs, diffs, or tool outputs are fetched by explicit follow-up calls.

## Migration Slices

### Slice 35a - Current Ledger Audit

Inventory existing ledger tables, subscribers, payload shapes, and indexes. Identify any stored file-change or chat metadata that must be replaced rather than migrated, because the app is not in production.

### Slice 35b - Canonical Event Table

Blocked on owner-approved `LED-D01` and `LED-D04`. After both close, implement `ledger_events` storage with accepted-delivery verification, envelope validation, registered sensitivity, safe-payload construction, versioned deterministic payload hashing, compact projections, and D04's exact idempotency/transaction/retry contract. Tests must include canonicalization equivalence, byte/digest vectors, policy/version persistence, legacy-version migration/reverification, hash presence/value mismatch, branch-specific null handling, duplicate/concurrent delivery, conflict, database nonsettlement, crash/restart at every transaction boundary, terminal behavior, and source isolation. This slice owns storage and integrity evidence only; it does not construct or expose `AcceptedLedgerRowRef`.

### Slice 35c - Resource and Native Ref Projections

Blocked on owner-approved `LED-D04` and accepted 35b. Implement `ledger_event_resources` and `ledger_event_native_refs` with only D04's approved natural keys, uniqueness, atomic child boundary, duplicate/conflict, retry/terminal, restart, and capacity contract.

### Slice 35d - Edge Writer

Blocked on owner-approved `LED-D04` and accepted 35b/35c. Implement deterministic approved non-causal edge extraction from common envelope fields and domain payload references using only D04's approved edge key, uniqueness, atomicity, missing-target, retry/terminal, capacity, restart, and conflict contract. `caused_by` extraction is additionally blocked on owner-approved/back-validated `LED-D03`; after closure implement only its exact event-type/pointer/domain/confidence matrix and rejection diagnostics.

### Slice 35e - Query Helpers

Add traversal helpers used by SPEC-33 file versioning and SPEC-38 audit/review loops.

### Slice 35f - Retention Hooks

Add interfaces that SPEC-39 storm control can use to compact, summarize, or mark records without changing producer behavior.

## Completion Criteria

- Ordinary canonical events persist exact validated safe JSON with matching hash and are the only branch eligible for historical proof. The exact registered UI failure-safe-core persists unchanged with null hash but is categorically capability-ineligible. Only non-registered/inconsistent missing/failed redaction uses `validation_status = 'defensive_fallback'` and the ledger-only defensive body, which is also ineligible.
- Common forensic queries are index-backed.
- Ledger edges can traverse UI, chat, tool, harness, automation, resource, file version, and audit domains.
- Provider-native IDs are queryable but not canonical.
- Unknown attribution remains explicit.
- Existing direct event storage paths are either removed or routed through the canonical ledger subscriber.
- Every `ledger_events` row has admission proof from its branded UEB delivery context; validation-only or diagnostic records cannot acquire `canonical_admission_status = 'accepted'`.
- Historical relationship proof comes only from `loadAcceptedLedgerRowRef` after complete row/payload/policy/identity verification; raw accepted-status rows never feed canonical builders.
- Ledger never persists unsafe original payload material or hashes/previews derived from material whose redaction failed, and ledger failure never affects the source operation.
