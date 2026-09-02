---
name: Resource Mutation Provenance Schema
description: Schema guidance for file and folder mutation events from watchers, UI file APIs, file explorer operations, sync jobs, imports, and scripts.
metadata:
  incoming-edges:
    - Events Provenance Model
    - Tool Call Provenance Schema
  outgoing-edges:
    - Chat Metadata Provenance Schema
    - Tool Call Provenance Schema
    - Ledger Event Provenance Schema
    - File Version Provenance Schema
    - UI Action Provenance Module
  source-files:
    - fusion-studio-server/lib/watch/workspace-watcher.js
    - fusion-studio-server/lib/file-explorer.js
    - fusion-studio-server/lib/ws/workspace-request-handlers.js
    - fusion-studio-client/src/state/fileDataStore.ts
  connected-skills: []
  related-trigger-files: []
---

> **Schema correction authority (2026-07-15):** Apply the [provenance cross-article findings](../../../../Captures/008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat. This page supplies the mechanical `serverMutationId` branch assignment; decision-tagged cross-domain choices remain open.

Use this page before changing file-change events, watcher payloads, file API mutation messages, or resource cache invalidation metadata.

Resource mutation provenance covers file and folder changes observed or caused by watcher events, UI file APIs, file explorer saves, sync/import jobs, scripts, triggers, schedulers, and tool calls.

## Boundary

Resource mutation events are the bridge between filesystem facts and higher-level causes. They must preserve the distinction between "this changed" and "this actor caused it."

## Domain Payload

```js
{
  schemaVersion,
  eventId,
  eventFamily: 'resource',
  eventType,
  eventPhase,
  occurredAt,
  lifecycle,
  ids,
  actor,
  provenance,
  context,
  resourceMutation: {
    resourceEventId,
    resourceId,
    resourceType,
    path,
    oldPath,
    operation,
    observedAt,
    observerEventType,
    contentHashBefore,
    contentHashAfter,
    sizeBefore,
    sizeAfter,
    symlink
  },
  resources: [],
  redaction
}
```

View and panel fields belong under `context`, not inside `resourceMutation`.
Use `provenance.confidence` for attribution confidence. Do not add a second attribution enum inside `resourceMutation`.
`observerEventType` stores the watcher or legacy collector event kind, such as create, modify, delete, or rename. It is not an event ID and should not be confused with `provenance.observedBy`.

For the first package, successful resource redaction uses exact strings `resource-metadata-v1` / `'1'` and the branch matrix in SPEC-34. A present before/after side requires both its state-hash and matching mutation-hash omissions as `policy_unapproved` plus two redaction omission pointers. An absent side uses mutation hash omission `not_applicable`; an unavailable side uses `not_observed`; neither adds a hash redaction pointer. Every concrete hash field remains absent, and retaining one rejects the candidate. `resourceMutation.fileVersionIds` is not a first-package field and is absent until its later domain registration. Policy failure preserves the mutation or watcher fact and invokes recovery.

For `ids.serverMutationId`, the server-produced resource-mutation branch requires the command handler to generate or propagate it. Watcher-observed resource facts prohibit it. Resource validators, projections, and ledger correlation consume that branch identity; workspace/view lifecycle events do not.

## Attribution Rules

- Direct attribution requires a registered SPEC-40 `prepareCanonicalCandidate` binding that consumes the upstream domain event's `AcceptedCanonicalRef`. In 40b1a the UI root/parent/causation/origin/cause group is registered only for a resource candidate directly initiated by an accepted `ui.action`; first-package lifecycle registers no upstream group. SPEC-40b2 and later owning slices may add tool, harness, trigger, scheduler, script, automation, agent, audit, or lifecycle cause pointers only by extending both schema and pointer/domain registries. The builder inserts a complete proven group and records private proof; a copied inspection string or raw operational, runtime, candidate, user-supplied, rejected, or unpublished ID omits the group with fixed `accepted_relationship_unbound` while the independently safe resource fact remains eligible.
- Watcher-only attribution is observed or correlated, not direct.
- Unknown external changes should stay unknown when no causal ID is available.

## Connections

- Chat metadata may attach relevant mutations under `chatResources.mutations` only if finding 4/`CHAT-D01` approves and registers that sidecar's relationship to shared `resources[]`; this example is not current authority.
- After its later registration, a tool call links to a mutation through `provenance.cause.toolCallId` only when the builder consumes the accepted canonical tool ref; otherwise it uses later watcher correlation without inventing a direct cause.
- Ledger events store the canonical resource event and graph edges.
- File versioning subscribes to resource mutation events.
- UI context can explain which view/document was active when a user-initiated mutation happened.
- Audits can answer who or what changed a path and whether attribution was direct or inferred.

## Gaps To Close

- Watcher payloads currently lack stable event IDs and full provenance.
- Resource events need workspace identity before multi-workspace correlation is safe.
- Existing ledger behavior can infer watcher file changes as user actions, which violates observer-vs-cause.
- Direct WebSocket `file_changed` paths need to become derived output rather than source-of-truth events.
