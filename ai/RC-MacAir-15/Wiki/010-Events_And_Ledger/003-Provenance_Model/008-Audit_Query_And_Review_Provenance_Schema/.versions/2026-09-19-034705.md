---
name: Audit Query And Review Provenance Schema
description: Schema guidance for assistant and user forensic queries, saved audit results, review loops, and recommendation events.
metadata:
  incoming-edges:
    - Events Provenance Model
  outgoing-edges:
    - Ledger Event Provenance Schema
    - Chat Metadata Provenance Schema
    - File Version Provenance Schema
    - Events Assistant Query And Review Loops
  source-files:
    - fusion-studio-server/lib/ledger/event-ledger.js
    - fusion-studio-server/lib/thread/chat-search.js
    - fusion-studio-server/lib/audit/audit-subscriber.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before designing assistant-facing ledger queries, saved audit runs, automated review loops, or generated recommendations.

Audit query provenance records who asked a forensic question, what scope was searched, what evidence was returned, and what confidence or recommendation came out of the review.

## Boundary

Audit queries consume chat metadata, tool call records, resource events, ledger events, file versions, automation runs, and UI context. Review loops can emit their own ledger events and recommendations.

Downstream recommendations, tickets, or follow-up events reference `auditQueryId` only through an accepted canonical audit/review reference. Query failure can return an incomplete/error result to the caller, but a rejected or unpublished audit ID never becomes an ID-bearing origin, cause, mirror, or ledger edge.

Evidence/result arrays and edges receive live IDs only through accepted delivery refs. Historical IDs require opaque `AcceptedLedgerRowRef` capabilities returned after trusted revalidation of accepted/validation status, exact stored safe payload, schema/policy version, identity columns, and payload hash. Row/status values alone never prove admission. Rejected-candidate diagnostics, raw runtime/provider IDs, unresolved filter inputs, and missing/tampered ledger targets remain explicit incomplete-evidence diagnostics outside canonical result arrays and edges.

## Proposed Domain Payload

This shape is decision input, not registration-ready. `AUD-D01` must settle the exact schema and branches described below before audit persistence:

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

Use structured `actor` and `context` from the common envelope instead of a standalone `requestedBy` field.

`audit.reviewConfidence` describes confidence in the audit result or recommendation. It is separate from `provenance.confidence`, which describes attribution confidence for the event itself.

`resultAutomationRunIds`, `resultUiActionIds`, `resultTurnIds`, and harness result arrays must be registered in the schema registry before implementation. If registry support is deferred, expose those references only through ledger edges and domain refs until registration lands.

## Connections

- Audit queries traverse ledger edges and chat metadata.
- File versions supply before/after evidence.
- Tool calls, harness runs, automation runs, and UI actions explain likely causes.
- UI context helps separate user actions from assistant or headless automation.
- Review recommendations can become future tickets, rules, skills, triggers, UI affordances, or code changes.

## Gaps To Close

- Current ledger querying is closer to recent-event listing than graph traversal.
- Saved audit-query records do not exist yet.
- Query outputs need confidence, redaction, and evidence references.
- Audit pending state should use turn identity where chat turns are involved.
- `AUD-D01` requires owner approval before SPEC-40b2f audit registration or SPEC-38b-38f: exact event/phase/lifecycle branches; versioned query types and typed/redacted filters; result/evidence presence and accepted-proof rules; review confidence; failure/incomplete/unavailable/cancel semantics; recommendation/ticket payload and domain ownership; redaction policy/failure-safe branch; deterministic hard limits, overflow diagnostics, and pagination for filters/evidence/results/summaries/recommendations/tickets/traversal/serialized bytes; and fail-open tests. SPEC-38a may gather evidence only. This does not block the first Wiki/File packet.
