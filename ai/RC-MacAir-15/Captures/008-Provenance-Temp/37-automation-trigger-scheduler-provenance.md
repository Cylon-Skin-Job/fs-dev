# SPEC-37 - Automation, Trigger, Scheduler, Script, and Agent Provenance

Status: DISCUSSION DRAFT

Schema correction authority: [2026-07-15 provenance cross-article findings](provenance-schema-findings.md) plus owner direction in chat on 2026-07-15. The end state favors reusable shared blocks and registered extensions; decision-tagged details remain open.

## Mission

Give every headless automation path a durable run identity so the Universal Ledger can distinguish trigger execution, scheduled jobs, scripts, sync/import work, background agents, and known system work from human UI actions, assistant tool calls, and unknown external filesystem changes.

## Wiki Sources

- [Automation Run Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md)
- [Events Provenance Model](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md)
- [Events And Ledger Decisions](../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md)
- [Events Taxonomy](../../Wiki/010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md)
- [Resource Mutation Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md)

## Related Specs

- [SPEC-32 - Resource Event Sync Controller](32-resource-event-sync-controller.md)
- [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md)
- [SPEC-35 - Universal Ledger Storage, Edges, and Indexes](35-universal-ledger-storage-edges-indexes.md)
- [SPEC-36 - Harness, Tool, and Native Reference Provenance](36-harness-tool-native-ref-provenance.md)
- [SPEC-40 - Provenance Schema Registry and Event Validation](40-provenance-schema-registry-validation.md)

## Scope

This spec covers automation run events and causality across TRIGGERS.md, schedulers, script runners, sync/import jobs, background agents, and known system jobs.

It does not define trigger matching syntax, cron syntax, script sandboxing, agent behavior, or ticket UX. It records and links those executions once they happen.

## Owner Decision Queue

| ID | Decision needed | Status | Required resolution |
|---|---|---|---|
| AUT-D01 | What exactly do script captured output and lifecycle status describe? | OPEN - OWNER APPROVAL REQUIRED before Slice 37d; failure isolation is decided. | Define: (1) the captured result domain (raw function return, runner-normalized return, stdout/stderr, or a combination); (2) whether valid falsy returns (`false`, `0`, `''`, `NaN`, and `undefined`) remain distinct or normalize to `null`; (3) whether Promise/thenable results are prohibited, awaited, or unsupported; (4) automation-specific mapping into the owner-selected unified captured-output extension contract required by TOOL-D01/provenance finding 3, whose exact shared-block choice/name/shape remains open; (5) deterministic serialization/encoding, hash, byte-count, truncation, external-storage, omission, and redaction primitives without independently registered automation-only `resultHash`/`resultBytes`/`resultTruncated` names; (6) whether truncation changes downstream runtime `vars.result`; (7) the event-type/branch presence matrix, including omitted versus `null`/`0`/`false`; (8) whether error/failure/rejection/timeout/cancellation material is captured or omitted; (9) the applicable secret/redaction policy and policy ID/version. The owner rule is settled: provenance/redaction failure never fails automation execution; unsafe material and derived hashes/previews are omitted while the non-sensitive run/event core and a diagnostic remain when possible; (10) timeout support/enforcement; and (11) lifecycle mappings for load, export-resolution, missing-export, success, failure, rejection, cancellation, and null-result branches. The current runner behavior remains evidence only and cannot settle these branches. |
| AUT-D02 | How can an operational file-trigger match later claim direct causality from the independently admitted canonical resource observation? | OPEN - OWNER APPROVAL REQUIRED before `automation.matchedEventId`, upstream resource root/parent/causation IDs, or a `triggered` edge links that match to the resource event. | Define the private observation/run handoff, task ordering without waiting, capability lifetime, exact pointer/selector, multiple-match fanout, rename-pair behavior, dedupe, late/missing/rejected admission, cancellation/restart, and tests proving trigger execution remains exactly once. Until closure, file-trigger automation facts omit those resource IDs/edges. This does not block the operational trigger or an independently safe canonical automation run fact. |
| AUT-D03 | What is the exact base canonical automation run/match contract independent of result payloads and matched-resource linkage? | OPEN - OWNER APPROVAL REQUIRED before 40b2c registers any automation run/match branch, 37c emits it, or an accepted automation ref exists. The settled product requirement is that every eventual canonical automation fact carries durable `automation.runId` and `automation.kind`; D03 cannot remove those fields. | Define exact per-kind run-ID generation owner/timing/format and operational handoff; event types/phases/lifecycle status and presence; subtype ID ownership/equality/presence; actor/source/origin/observer/context; sensitivity/redaction policy for trigger name/file, schedule, condition, script path, ticket/resource summaries, and failure-safe/no-event behavior; deterministic field/array/serialized-byte bounds and overflow; ordering, sequence, dedupe, replay/restart/cancel behavior; and fail-open tests. AUT-D01 separately governs result branches; AUT-D02 separately governs matched-resource accepted relationships. Slices 37a-37b remain audit and inert ABI/fixture proposal only: they may inventory existing operational IDs but may not add/replace a production generator, expose a new ID ABI, register/publish canonical identity, or create accepted refs until D03 closes and is back-validated. |

## Run Identity Requirement And Candidate Details

The wiki-settled requirement is that every eventual canonical automation fact contains durable `automation.runId` plus `automation.kind`. `AUT-D03` cannot remove those common fields, but must approve their per-kind generation owner, timing, format, and operational handoff before implementation. The subtype fields in this broader shape are decision candidates whose ownership/equality/presence D03 may accept, replace, or remove:

```js
{
  automation: {
    runId,
    kind: 'trigger' | 'scheduler' | 'script' | 'sync' | 'import' | 'agent' | 'system',
    triggerRunId,
    schedulerRunId,
    scriptRunId,
    agentRunId
  }
}
```

Execution outcome belongs in the common envelope's `lifecycle.status`; do not add a second `automation.status` field. The exact result-capture and status mapping semantics remain blocked by `AUT-D01`.

Settled constraints and D03-owned details:

- `automation.runId` is the canonical cross-subsystem automation run identity and `automation.kind` classifies the run; D03 must define their exact ABI and production timing.
- Subtype IDs could be secondary indexes and subsystem-local references; D03 must decide their exact ownership/equality/presence.
- If D03 approves `provenance.cause.automationRunId`, a downstream event may store it only from an accepted upstream automation ref.
- If D03 approves that cause field, the current automation fact cannot self-reference through it.
- D03 must define which distinct upstream automation, trigger, scheduler, script, or agent relationships and selectors exist; accepted identity proof alone cannot invent their causal meaning.
- `AUT-D02` must approve the applicable accepted-reference handoff and exact selector/field matrix before an operational file-trigger match uses `automation.matchedEventId`, `ids.parentEventId`, `ids.causationId`, or an edge.
- Automation execution events could use `context.scope = 'headless'`; D03 must approve the context shape and how UI initiation is represented.
- D03 must decide exact run/event ID generation ownership and timing. Regardless of that choice, provenance emission, enrichment, redaction, ledger, or downstream versioning failure never prevents the automation from starting or completing according to its own execution semantics. Missing upstream cause metadata degrades to unknown or unlinked attribution; it does not cancel the run.
- The automation publisher returns an accepted automation reference only after an event establishing the required `automation.runId` is accepted on UEB. Downstream producers receive and propagate only that accepted reference, never the raw operational run ID. If publication fails, known execution kind may remain as an origin type, but omit `origin.id`, all automation/subtype cause IDs, `automationRef`, result/resource mirrors, and ledger edges until a canonical run event is accepted. A later accepted lifecycle event may establish the reference for subsequent work; it does not retroactively create causes for earlier events.

## Automation Event Shape

The following broad shape is design input only. `AUT-D03` must approve exhaustive registered base-run/match branches that preserve required `automation.runId` and `automation.kind`; AUT-D01 and AUT-D02 govern their separate result and matched-resource extensions. No implementation may infer optionality, subtype fields, bounds, redaction, or lifecycle presence from this example.

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
    kind,
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
    // AUT-D01 + TOOL-D01 must approve the owner-selected unified captured-output
    // extension contract (including whether it is one shared block) before
    // any result hash, byte, truncation, redaction, or storage field appears.
    ticketId,
    resourceEventIds: [],
    // Future projection only; absent until file-version relationship registration.
    fileVersionIds: []
  },
  resources: [],
  redaction
}
```

The example's subtype IDs remain `AUT-D03` candidates and do not make those fields common-envelope or downstream-cause authority. `fileVersionIds` is absent from canonical automation records until the owning relationship, accepted-reference binding, bounds, and schema registration are approved; an empty candidate array is not early authorization.

## Event Types

Illustrative `AUT-D03` decision candidates only:

```text
automation.run.started
automation.run.matched
automation.run.script_started
automation.run.script_result
automation.run.completed
automation.run.failed
automation.run.cancelled
automation.ticket.created
```

This list is not canonical, registration-ready, or implementation authority. `AUT-D03` may accept, replace, split, or remove every candidate and must approve the exhaustive kind/phase/lifecycle matrix before SPEC-40b2c registration, Slice 37c emission, accepted refs, or persistence. No producer, registry, test, or downstream slice may infer an event type from this list while D03 remains open. After approval, additional narrow event types require the same registry/version process; do not overload one event type with multiple meanings.

## Trigger Firehose Relationship

TRIGGERS.md keeps its single workspace-watcher filtering/execution path for file changes; mutation handlers do not invoke a second matcher. Canonical resource admission is an independent provenance projection of the established watcher observation, not trigger authorization. File-change matching never awaits admission and still executes exactly once when candidate construction, redaction, validation, publication, or accepted-ref creation fails. Other trigger kinds retain their current operational ingress until an owning migration defines the same fail-open guarantee.

When a trigger matches an event:

1. The operational file-change matcher receives the established watcher observation through its single workspace-scoped path and starts the applicable automation without waiting for provenance.
2. It may record the D03-approved registered match/run fact after 40b2c registration; this document does not select its event type. While `AUT-D02` is open, `automation.matchedEventId` and upstream resource IDs/edges are always omitted. After closure, only its approved private non-wait handoff may provide a resource accepted ref to the registered builder; missing/late/rejected branches still omit without affecting execution.
3. After the matched/run event is accepted, subsequent script/tool/resource work may reference its accepted automation run identity.
4. Ledger edges connect only accepted canonical events/entities; failed/unpublished run IDs never become edge endpoints.

The matcher uses its existing operational execution identity/state to prevent duplicate starts; it does not key execution on a canonical `eventId` or invoke a second fallback matcher. Tests run healthy, paused, rejected, thrown, and suppressed provenance branches and require one execution for each applicable operational fact, zero for nonmatches, and no accepted-only relationship when no accepted ref exists.

## Resource Mutation Attribution

After a canonical automation event establishes an accepted run reference, the following downstream attribution shape is non-authoritative D03 decision input only. D03 and the owning resource-event schema must approve or replace every origin type, cause selector, subtype field, confidence branch, and `automationRef` mirror before implementation; accepted proof alone does not create those fields:

```js
{
  provenance: {
    origin: { type: automationKind, id: automationRunId },
    cause: {
      automationRunId,
      triggerRunId,
      schedulerRunId,
      scriptRunId,
      agentRunId
    },
    confidence: 'direct'
  },
  automationRef: { automationRunId, automationKind }
}
```

When only chokidar observes the result and direct run context was not propagated, keep the event external or unknown if no automation execution can be correlated. Any path/time/operation correlation branch, automation origin type, confidence value, run/subtype selector, `automationRef`, mirror, or edge requires the exact D03/owning-schema approval first. If approved, ID-bearing fields still require an accepted canonical automation reference; raw operational run IDs remain diagnostic correlation evidence and never become canonical causes.

## Ledger Edges

The ledger creates only approved edges from accepted canonical references; endpoint acceptance is necessary but not causal proof:

- `triggered` from matched event to automation run only after `AUT-D02` closes for operational file-trigger matches and the exact accepted binding exists.
- `caused_by` from script/tool/resource events to an automation run only after `LED-D03` approves that exact pointer/domain/confidence branch.
- `mutated`, `read`, `wrote`, and `versioned_as` edges for resource effects.
- `triggered` edges for approved ticket/follow-up branches; any `caused_by` branch additionally requires `LED-D03`. Reserve `recommended` for audit/review recommendation events.

## Migration Slices

### Slice 37a - Automation Path Audit

Inventory trigger loader, cron scheduler, script runner, runner, sync/import, and background agent paths.

### Slice 37b - Run ID ABI Evidence

Inventory existing operational ID generators, ownership, timing, formats, collision behavior, and consumers; propose the D03 decision table, ABI, migration fixtures, and fail-open tests. This slice is inert preparation only. It does not add or replace a production generator, expose a new operational/canonical ID ABI, assign subtype semantics, register/publish canonical identity, or create an accepted automation ref before owner-approved/back-validated `AUT-D03`.

### Slice 37c - Trigger Match Events

Prerequisites: owner-approved/back-validated `AUT-D03`, accepted operational matcher audit/ID preparation from 37a-37b, and exact automation match/run schemas registered in SPEC-40b2c. Observe operational trigger matches and emit independently safe registered canonical automation facts without controlling, delaying, retrying, or duplicating execution. While `AUT-D02` is open, omit every matched-resource ID/edge. A later branch may add only the owner-approved non-wait accepted-ref handoff. Acceptance injects every resource provenance failure branch and proves trigger execution remains exactly once while canonical automation output is accepted when independently buildable or explicitly diagnosed/omitted when it is not.

### Slice 37d - Script Result Metadata

Blocked until `AUT-D01`, `TOOL-D01`, and provenance finding 3 jointly settle the owner-selected unified captured-output extension contract and SPEC-40b2c registers the exact automation result branch. Capture script path, `lifecycle.status`, and only the registered automation mapping into that approved extension; do not infer legacy result-hash, byte-count, truncation, redaction, omission, or storage names/semantics.

### Slice 37e - Downstream Cause Propagation

Prerequisites: owner-approved/back-validated `AUT-D03`, accepted Slice 37c, and the exact applicable 40b2c registrations; result-bearing propagation additionally requires the joint `AUT-D01`/`TOOL-D01`/finding-3 settlement and accepted 37d. Pass an accepted automation reference, not the raw operational run ID, into resource mutation producers and tool/chat paths. Inject run-event validation/publication failure and prove the execution continues while downstream ID-bearing origin, causes, mirrors, and ledger edges remain absent.

Required check: `cd fusion-studio-server && npm test -- --runInBand test/provenance/automation-cause-propagation.test.js`.

### Slice 37f - Ledger Edges and Queries

Prerequisites: accepted branch-specific 40b2c automation registration, accepted producing 37c/37d/37e slices as applicable, and accepted SPEC-35b event ingestion plus applicable SPEC-35d edge support. Persist only accepted automation events and approved builder-proven edges. `triggered` file-match edges additionally require `AUT-D02`; every `caused_by` edge additionally requires owner-approved/back-validated `LED-D03`, otherwise that branch is absent. This slice does not backfill rejected/raw run or matched-event IDs.

## Completion Criteria

- Every known automation path has a durable run ID.
- Trigger, scheduler, script, sync/import, agent, and system jobs are distinguishable.
- Automation-caused resource mutations can be traced without guessing.
- Unknown external changes are not mislabeled as automation.
- Trigger filtering/execution remains one fail-open operational behavior; canonical UEB publication observes it and never authorizes or duplicates it.
- Sync and post-`await` automation follow-ups receive accepted references through canonical delivery context; rejected/suppressed run events expose none.
- Failure-injection tests prove automation execution continues while rejected/unpublished run/subtype IDs remain absent from downstream origins, causes, mirrors, and edges.
- Result redaction failure omits unsafe material and derived hashes/previews without changing automation execution semantics.
