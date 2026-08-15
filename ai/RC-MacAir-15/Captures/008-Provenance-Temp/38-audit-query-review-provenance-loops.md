# SPEC-38 - Audit Query and Review Provenance Loops

Status: DISCUSSION DRAFT

## Mission

Build assistant-facing and user-facing audit query records that can traverse the Universal Ledger, preserve evidence sets, and produce review findings or recommendations without losing provenance.

The goal is to let the system answer questions like:

- What changed this file?
- Was the change caused by UI, assistant tool use, automation, or something external?
- Which chat turn, tool call, harness run, trigger run, script, or UI action was involved?
- What nearby mutation may have broken this state?

## Wiki Sources

- [Audit Query And Review Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/008-Audit_Query_And_Review_Provenance_Schema/PAGE.md)
- [Assistant Query And Review Loops](../../Wiki/010-Events_And_Ledger/009-Assistant_Query_And_Review_Loops/PAGE.md)
- [Events Provenance Model](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md)
- [Events Ledger Schema](../../Wiki/010-Events_And_Ledger/004-Ledger_Schema/PAGE.md)
- [File Versioning](../../Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md)

## Related Specs

- [SPEC-32 - Resource Event Sync Controller](32-resource-event-sync-controller.md)
- [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md)
- [SPEC-34 - UI Action Provenance Module](34-ui-action-provenance-module.md)
- [SPEC-35 - Universal Ledger Storage, Edges, and Indexes](35-universal-ledger-storage-edges-indexes.md)
- [SPEC-36 - Harness, Tool, and Native Reference Provenance](36-harness-tool-native-ref-provenance.md)
- [SPEC-37 - Automation, Trigger, Scheduler, Script, and Agent Provenance](37-automation-trigger-scheduler-provenance.md)
- [SPEC-39 - Change Storm Control and Compaction](39-change-storm-control-compaction.md)
- [SPEC-40 - Provenance Schema Registry and Event Validation](40-provenance-schema-registry-validation.md)

## Scope

This spec covers saved audit query events, review evidence references, recommendation events, and query helper behavior.

It does not implement a full assistant reasoning system, UI for browsing every graph edge, or automatic code fixes. It creates the durable records and query APIs needed for those workflows.

## Open Owner Decision

| ID | Decision | Status / Required contract |
|---|---|---|
| AUD-D01 | What are the exact canonical audit/query/review/recommendation/ticket schemas and bounded result semantics? | OPEN - OWNER APPROVAL REQUIRED before SPEC-40b2f audit registration or Slices 38b-38f implementation. Define: exact eventType/eventPhase/lifecycle branch matrix; `queryType` enum and versioning; exhaustive typed/redacted filter union per query type; result/evidence array presence and accepted-proof rules; `reviewConfidence` enum/meaning; completed/failed/incomplete/unavailable/cancelled semantics; exact recommendation/ticket payloads, ownership, and whether ticket creation is a canonical audit fact or an integration with a separate registered ticket domain; redaction policy ID/version, sensitive filter/result detection, and failure-safe behavior; deterministic hard limits and overflow/truncation diagnostics for filters, evidence IDs, result IDs by domain, compact evidence summaries, recommendation text/IDs, ticket IDs, traversal depth/edges, and serialized response/event bytes; follow-up pagination/cursor semantics; and tests proving audit/query/recommendation failure never changes historical source operations or admits raw/unresolved evidence IDs. Slice 38a may inventory current capabilities and collect decision evidence only. |

Audit/query/review is downstream and observational. Query failure, incomplete evidence, missing edges, ledger unavailability, or recommendation persistence failure must not alter or fail the historical source operations being inspected. Results report incomplete or unavailable evidence explicitly rather than manufacturing certainty or requiring upstream interaction paths to wait for audit infrastructure.

Recommendations, tickets, and follow-up canonical events use an audit/review ID as cause or edge endpoint only through a registered `prepareCanonicalCandidate` binding that consumes the accepted upstream audit/review ref. A failed query record may still return an operational error/incomplete result to its caller, but its rejected/unpublished ID never becomes downstream provenance.

Evidence/result arrays and edges also obey accepted-only input. Live IDs require SPEC-40 accepted delivery refs; historical IDs require opaque `AcceptedLedgerRowRef` capabilities returned by `loadAcceptedLedgerRowRef` after full stored-payload/column/policy revalidation. A row object, `canonical_admission_status`, or `validation_status` alone never proves admission. Rejected-candidate diagnostics, raw runtime/provider IDs, unresolved user-supplied filter IDs, and missing/tampered ledger targets never enter `evidenceEventIds`, result-ID arrays, mirrors, or graph edges. Missing targets are reported as unresolved/incomplete evidence outside those accepted arrays.

## Proposed Audit Event Shape

The following is illustrative decision input, not a registrable schema. `AUD-D01` must replace every placeholder and define exact branches before persistence:

```js
{
  schemaVersion,
  eventId,
  eventFamily: 'audit',
  eventType,
  eventPhase,
  occurredAt,
  lifecycle,
  ids,
  actor,
  provenance,
  context,
  audit: {
    auditQueryId,
    queryType,
    filters,
    evidenceEventIds: [],
    resultEventIds: [],
    resultFileVersionIds: [],
    resultThreadIds: [],
    resultTurnIds: [],
    resultToolCallIds: [],
    resultHarnessIds: [],
    resultHarnessRunIds: [],
    resultHarnessEventIds: [],
    resultAutomationRunIds: [],
    resultUiActionIds: [],
    reviewConfidence,
    generatedRecommendationIds: [],
    generatedTicketIds: []
  },
  resources: [],
  redaction
}
```

`audit.reviewConfidence` describes confidence in the review result. It is separate from `provenance.confidence`, which describes confidence in the audit event's attribution.

`resultAutomationRunIds`, `resultUiActionIds`, `resultTurnIds`, and harness result arrays are audit-schema projections mirrored in the wiki audit schema. They must be registered in SPEC-40 before implementation; if registry support is deferred, expose those references only through ledger edges and domain refs until registration lands.

## Event Types

Illustrative `AUD-D01` decision input only:

```text
audit.query.started
audit.query.completed
audit.query.failed
audit.review.started
audit.review.completed
audit.recommendation.created
audit.ticket.created
```

This list is not canonical, registration-ready, or implementation authority. `AUD-D01` must approve, replace, split, or remove every candidate and settle the exhaustive event-type/phase/lifecycle and ticket-domain ownership matrix before SPEC-40b2f registration or Slices 38b-38f. No producer, registry, test, persistence branch, or downstream slice may infer an event type from this example while D01 remains open.

## Candidate Query Paths

These paths are illustrative discovery goals for `AUD-D01`, not implementation requirements. D01 may accept, replace, split, defer, or remove them and must define the typed query/filter/result contract and required dependency availability before Slices 38b-38f implement any path:

```text
file path
  -> resource mutation
  -> file version
  -> cause event/domain ID
  -> UI action, tool call, automation run, or unknown external observation
  -> chat turn, harness run, trigger run, or script run where available
  -> nearby mutations by path, time range, correlation, or causation
  -> storm-batch/changeStorm records and representative versions when nearby mutations were compacted
  -> before/after file-version, diff, or snapshot refs where available
```

```text
chat turn
  -> tool calls
  -> declared resources
  -> resource mutations
  -> file versions
  -> nearby mutations
```

```text
automation run
  -> matched event
  -> script/tool result
  -> resource mutations
  -> file versions
  -> tickets or recommendations
```

## Candidate Evidence Rules

The shared accepted-proof prohibition is normative; the storage, summary, follow-up-read, filter, citation, capacity, and presence choices below remain `AUD-D01` decision input and cannot be inferred into implementation.

- Audit results store IDs and compact summaries, not full file snapshots or large tool output.
- Full payloads, snapshots, diffs, and tool outputs are fetched through explicit follow-up reads.
- Evidence references should point to ledger events, file versions, tool call IDs, automation run IDs, UI action IDs, and thread/turn IDs.
- Query filters are stored with redaction applied.
- Review recommendations must cite the evidence IDs used to produce them.

## Candidate Ledger Edges

Subject to `AUD-D01` plus the applicable SPEC-35 edge decision/acceptance, the following are illustrative edge candidates only:

- `queried` edges from audit query events to evidence events and domain records.
- `reviewed` edges from review events to evidence sets.
- `recommended` edges from review events to recommendations, tickets, rules, skills, triggers, UI affordances, or code-change tasks.

## Candidate Access Pattern

The following response shape is illustrative `AUD-D01` input, not an implementation requirement:

1. `auditQueryId`
2. Query metadata and filters.
3. Compact evidence list.
4. Traversal links by event/domain ID.
5. Optional recommendation summary.

The candidate avoids returning every payload or snapshot by default to keep assistant context manageable and allow targeted reads. D01 must approve or replace that behavior, exact bounds, incomplete branches, and pagination before implementation.

## Migration Slices

### Slice 38a - Query Helper Inventory

Inventory existing ledger recent-event listing, chat search, metadata lookup, file mutation collectors, filter shapes, result/error branches, evidence volumes, redaction paths, recommendation/ticket integrations, and practical response sizes. Record evidence for `AUD-D01`; do not choose its product/schema semantics in implementation.

### Slice 38b - Audit Event Persistence

Blocked until `AUD-D01` is owner-approved, propagated to the wiki/registry/master/map, and back-validated. Then persist the approved audit query/review branches through SPEC-35. Add accepted-evidence filtering and run `cd fusion-studio-server && npm test -- --runInBand test/provenance/audit-accepted-evidence.test.js`, proving rejected/raw/unresolved IDs cannot enter evidence/result arrays or edges and query failure remains isolated.

### Slice 38c - First Traversal API

Blocked until `AUD-D01`. Then implement its approved bounded/paginated file-path-to-cause and file-version-to-cause traversal, including nearby mutation IDs and before/after file-version, diff, or snapshot refs where available. Payloads are still fetched only through explicit follow-up reads.

### Slice 38d - Chat and Tool Traversal

Blocked until `AUD-D01`. Add the approved bounded/paginated chat-turn-to-tool-to-resource traversal.

### Slice 38e - Automation Traversal

Blocked until `AUD-D01`. Add the approved bounded/paginated automation-run-to-resource traversal after SPEC-37 creates durable run IDs.

### Slice 38f - Recommendation Records

Blocked until `AUD-D01`. Persist only the approved recommendation/ticket event branches with bounded evidence links and the approved domain ownership.

## Completion Criteria

- Audit queries are durable ledger events.
- Review outputs cite evidence by stable IDs.
- Assistant workflows can retrieve compact graph paths without loading all payloads.
- UI, tool, harness, automation, file version, and external/unknown changes can be distinguished.
- Recommendations are traceable back to the evidence used.
- Evidence/result arrays, mirrors, recommendations, and edges are inserted only through builder bindings backed by live accepted refs or revalidated `AcceptedLedgerRowRef` capabilities; failure-injection tests prove raw rows/status strings and raw/rejected/unresolved/tampered IDs omit the affected relationship/result group with fixed `accepted_relationship_unbound` while any independently valid audit/review fact and historical source operations remain unaffected.
