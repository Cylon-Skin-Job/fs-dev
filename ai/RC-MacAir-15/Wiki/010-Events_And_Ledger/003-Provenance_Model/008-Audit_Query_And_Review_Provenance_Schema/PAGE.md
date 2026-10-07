---
name: Audit Query And Review Provenance Schema
description: Current bounded query transports and future saved audit, review, and recommendation contracts.
metadata:
  source-files:
    - fusion-studio-server/lib/ws/resource-provenance-route.js
    - fusion-studio-server/lib/ws/agent-activity-route.js
    - fusion-studio-server/lib/ledger/resource-provenance-repository.js
    - fusion-studio-server/lib/agent-provenance/query-repository.js
    - fusion-studio-server/lib/event-registry/seed-catalog.js
    - fusion-studio-client/src/lib/ws/resource-provenance-protocol.ts
    - fusion-studio-client/src/lib/ws-client.ts
  last-modified: "2026-09-19T11:52:20Z"
---

Status: source inspected on 2026-09-19 in the development checkout. Bounded save-provenance and agent-activity query transports exist. Saved audit/query/review facts, recommendation schemas and a mounted provenance audit UI are not implemented in the inspected paths. No product tests or runtime were run.

## Current query boundary

`resource:provenance:query` passes through the existing WebSocket router to `resource-provenance-route.js`: it validates the active server workspace/epoch and registered schema, normalizes the requested panel/path, and asks `resource-provenance-repository.js` for mutation summaries. Results include operation/resource/version identity, snapshot metadata and optional reported UI context, without snapshot bytes. Default limit is 50, capped at 200.

`agent:activity:query` uses its own registered route and `query-repository.js` for bounded activity/observation summaries, exact selectors and cursor pagination. Its default is 50, capped at 100. It does not return raw tool arguments/results or checkpoint bytes. An available detail reference points to existing Chat exchange storage; it is not a new captured-output artifact. Both routes report invalid, stale, unavailable or failed requests rather than changing historical operations. Current schemas do not create an audit run merely because a query was issued.

The client has `queryResourceProvenance`, strict result/error validation, pending-request handling and workspace retirement. The source search finds no production invocation of that helper and no agent-activity client consumer. Existing File Viewer resource invalidation is a rendering path, not audit/history presentation. See [Assistant Query And Review Loops](../../009-Assistant_Query_And_Review_Loops/PAGE.md) for the complete query and consumer limitations.

## Product direction

A useful audit should explain what changed, where the evidence came from, what is missing and which conclusions are uncertain. A future review may combine saved actions, tool observations, history and snapshots, then retain an understandable evidence set and recommendation. Temporal association is not causation; first observations are not preimages. Review confidence describes the conclusion, distinct from confidence in an event's attribution.

Audits are downstream observations. Missing evidence, query failure or recommendation persistence failure must not change the source operation being reviewed. Recommendations do not grant permission to execute changes, create arbitrary System app tables or give an assistant/plugin raw database or bus access. Durable audit history belongs to [System](../../../002-Server_And_Runtime/PAGE.md#system-database-boundary); live application content remains at its authoritative source.

## Open before a saved-audit or review-loop feature

The owner must settle the query types and typed/redacted filters; exact event/lifecycle and incomplete/unavailable/cancel states; evidence/result identities and relationship validation; confidence meaning; recommendation and ticket ownership; disclosure/redaction; deterministic filter/result/text/graph/byte bounds and overflow; pagination and follow-up discoverability. A broader graph query also needs a separately approved causal/edge contract. Old accepted-reference APIs and candidate result arrays are proposals, not prerequisites retroactively imposed on today's bounded queries.

A query UI must specify its real callers, response consumers and presentation of missing evidence. An autonomous review loop must additionally specify its trigger, allowed actions and approval boundary. Retention, deletion, restore and export require their own user-controlled lifecycle decisions; preserve history by default meanwhile. [File Version Provenance](../005-File_Version_Provenance_Schema/PAGE.md), [Chat Metadata](../001-Chat_Metadata_Provenance_Schema/PAGE.md) and [Ledger Event Provenance](../004-Ledger_Event_Provenance_Schema/PAGE.md) describe available evidence without implying those future schemas exist.
