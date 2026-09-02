---
name: Automation Run Provenance Schema
description: Schema guidance for TRIGGERS.md events, scheduler runs, script runs, sync/import jobs, ticket creation, and background agent runs.
metadata:
  incoming-edges:
    - Events Provenance Model
  outgoing-edges:
    - Resource Mutation Provenance Schema
    - Ledger Event Provenance Schema
    - File Version Provenance Schema
  source-files:
    - fusion-studio-server/lib/triggers/trigger-loader.js
    - fusion-studio-server/lib/triggers/cron-scheduler.js
    - fusion-studio-server/lib/triggers/script-runner.js
    - fusion-studio-server/lib/runner/index.js
  connected-skills: []
  related-trigger-files: []
---

> **Schema correction authority (2026-07-15):** Apply the [provenance cross-article findings](../../../../Captures/008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat. Automation subtype and captured-output choices remain open under `AUT-D03`, `AUT-D01`, and findings 1/3.

Use this page before changing trigger execution, scheduled runs, script runner output, background agents, or automation-created tickets.

Automation run provenance covers headless work that can create chat prompts, tickets, tool calls, resource mutations, ledger events, and file versions.

## Boundary

Automation runs need durable run IDs so later audits can distinguish triggered scripts from assistant tool calls, UI actions, external filesystem changes, and unknown background work.

TRIGGERS.md file-change execution is operational and fail-open with respect to provenance. Its one workspace-watcher matcher consumes established observations exactly once, and mutation handlers do not invoke a second matcher. It does not await canonical resource construction, redaction, validation, publication, or an accepted reference. Canonical automation facts observe the match only after the exact SPEC-40b2c branch is registered. Open owner decision `AUT-D02` blocks direct matched-resource IDs/edges until a private non-wait accepted-reference handoff and exactly-once semantics are approved; until then independently safe automation facts omit those relationships without delaying, suppressing, retrying, or duplicating the run.

Open owner decision `AUT-D03` blocks even the base canonical automation run/match registration, emission, accepted ref, and persistence until exact per-kind run-ID generation owner/timing/format/handoff, phase/lifecycle presence, subtype IDs, actor/provenance/context, sensitive-field redaction/failure behavior, bounds, ordering/dedupe/replay/restart/cancel semantics, and fail-open tests are approved. The settled requirement that canonical automation facts contain durable `automation.runId` and `automation.kind` is not reopened. Before D03 closes, only audit and inert ABI/fixture proposals may proceed; no production generator or new ID ABI may be added or exposed. AUT-D01 separately governs result branches.

## Domain Payload

The following shape is non-authoritative `AUT-D03` decision input, not an executable schema or registration contract, except for the settled requirement that every eventual canonical automation fact contains durable `automation.runId` and `automation.kind`. D03 may accept, replace, split, or remove the example's event types, phases, lifecycle branches, subtype/optional fields, and presence rules, but not those two common fields. Until D03 closes and is propagated/back-validated, no implementation may infer their generation ABI or a producer, registry entry, accepted ref, persistence branch, bound, redaction rule, or test expectation from this example. `AUT-D01` separately controls any result extension and `AUT-D02` any matched-resource accepted relationship.

```js
{
  schemaVersion,
  eventId,
  eventFamily: 'automation',
  eventType,
  eventPhase,
  occurredAt,
  lifecycle,
  ids,
  actor,
  provenance,
  context: {
    scope: 'headless'
  },
  automation: {
    runId,
    kind: 'trigger' | 'scheduler' | 'script' | 'sync' | 'import' | 'agent' | 'system',
    triggerRunId,
    schedulerRunId,
    scriptRunId,
    agentRunId,
    triggerName,
    triggerFile,
    schedule,
    matchedEventId,
    condition,
    scriptPath,
    // AUT-D01 + TOOL-D01 + finding 3 must approve the owner-selected unified
    // captured-output extension contract before any result metrics appear.
    ticketId,
    resourceEventIds: [],
    // fileVersionIds remains absent until its owning relationship registration.
  },
  resources: [],
  redaction
}
```

`automation.runId` and `automation.kind` are the settled common fields across trigger, scheduler, script, sync, import, agent, and system jobs. Subtype IDs remain D03 candidates until their exact ownership/equality/presence is approved. Sync, import, and system jobs still require the two common fields; any future subsystem-specific ID requires an approved schema change.
Domain `fileVersionIds` remains absent until the owning file-version relationship schema, accepted-reference binding, bounds, and registration are approved; an empty candidate array is not early authority.
After at least one canonical event establishing an automation run is accepted, a downstream event may store the accepted `automation.runId` only in a selector its D03/owning schema explicitly approves. The automation event itself may use upstream event causality only through a D03/AUT-D02-approved selector and registered accepted-reference binding and never self-references. While `AUT-D02` is open, operational file-trigger matches always omit upstream resource IDs/edges while preserving any independently safe D03-approved match/run fact. No subtype index role, optionality, equality, or selector exists until D03 approves it.

The runtime's raw run ID is operational state, not automatically a publishable cause. The automation publisher returns an accepted reference only after canonical acceptance. On validation/publication failure, execution continues and no D03-approved downstream ID selector/mirror/edge may use that rejected identity. `origin.id`, automation/subtype cause IDs, and `automationRef` are candidate field names only until D03 and the owning downstream schema approve them. A later accepted lifecycle event can establish the reference only for subsequent work.
Automation execution outcome uses the common envelope's `lifecycle.status`; do not add a second `automation.status` field.

## Connections

- Trigger runs can be caused by resource events, chat events, scheduler events, or other automation events.
- Scripts and agents can cause resource mutations and file versions.
- Chat prompts and downstream events link to `automation.runId` only through an accepted upstream automation reference.
- `context.scope = 'headless'` is a D03 candidate, not an approved context value or presence rule.
- Audits can trace trigger-to-script-to-file or scheduler-to-agent-to-ticket chains.

## Implementation Gaps

- Common-field product intent is resolved: eventual canonical trigger, scheduler, script, sync/import, agent, and system automation facts must contain durable `automation.runId` and `automation.kind`. Production generation/integration remains blocked until `AUT-D03` approves the exact per-kind ABI; this statement alone authorizes no generator change.
- Script captured-output fields remain unregistered. `AUT-D01`, `TOOL-D01`, and finding 3 must select the unified extension contract—including whether it is one shared block—before defining automation mapping, result domain, falsy/Promise handling, serialization/encoding, hashes, bytes, truncation, external storage, omission/redaction, per-branch presence, failure material, timeout behavior, or lifecycle mappings. The failure-isolation branch is decided: provenance/redaction failure never fails automation execution; unsafe result material and derived hashes/previews are omitted, while the non-sensitive run/event core and a diagnostic remain when possible.
- Agent run events need ledger records.
- Automation-created tickets/actions need causal links to matched events and run IDs.
