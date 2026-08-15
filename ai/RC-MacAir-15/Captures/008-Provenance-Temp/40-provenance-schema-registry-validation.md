# SPEC-40 - Provenance Schema Registry and Event Validation

Status: DISCUSSION DRAFT

Schema correction authority: [2026-07-15 provenance cross-article findings](provenance-schema-findings.md) plus owner direction in chat on 2026-07-15. Registry work must converge domains on reusable shared blocks and registered extensions while leaving decision-tagged branches unregistered.

## Mission

Create a central schema registry and validation layer for canonical provenance events so producers, subscribers, ledger storage, render sync, and future audit tools share one event language.

This spec prevents each subsystem from inventing slightly different field names, event types, identity rules, or provenance meanings.

## Wiki Sources

- [Events Provenance Model](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md)
- [Events Taxonomy](../../Wiki/010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md)
- [Events And Ledger Decisions](../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md)
- [Universal Event Bus](../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md)
- [Events And Ledger Structure](../../Wiki/010-Events_And_Ledger/010-Structure/PAGE.md)

## Related Specs

- [SPEC-32 - Resource Event Sync Controller](32-resource-event-sync-controller.md)
- [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md)
- [SPEC-34 - UI Action Provenance Module](34-ui-action-provenance-module.md)
- [SPEC-35 - Universal Ledger Storage, Edges, and Indexes](35-universal-ledger-storage-edges-indexes.md)
- [SPEC-36 - Harness, Tool, and Native Reference Provenance](36-harness-tool-native-ref-provenance.md)
- [SPEC-37 - Automation, Trigger, Scheduler, Script, and Agent Provenance](37-automation-trigger-scheduler-provenance.md)
- [SPEC-38 - Audit Query and Review Provenance Loops](38-audit-query-review-provenance-loops.md)
- [SPEC-39 - Change Storm Control and Compaction](39-change-storm-control-compaction.md)

## Scope

This spec covers schema definitions, validation severity, canonical event type registration, enum registration, projection helpers, compatibility adapters, and developer diagnostics.

It does not define each domain payload in full. Domain payloads are defined by their own specs and wiki pages, then registered here.

## Open Owner Decision

| ID | Decision | Status |
|---|---|---|
| UEB-D01 | What exact capacity, concurrency, fairness, overflow, cancellation, retained-memory, leak cleanup, byte accounting, and shutdown contract governs the provenance admission executor, post-admission listener executor, command ref owner cells/slots/leases/task links, and accepted delivery retention? | OWNER APPROVAL REQUIRED before Slice 40a or 40b1a implements/activates these executors or ref-slot delivery. Approve exact executor queue item/byte caps, concurrency and per-producer/subscriber fairness, enqueue admission/eviction/drop rules, cancellation finalizers, per-task event/context/ref retained-byte and lifetime caps, and never-settling task isolation. Define the exact measured representation and encoding, included object/container/accounting overhead, shared frozen-event/context/ref apportionment across listener tasks, queued-versus-active-versus-cancelling ownership, charge/release transition points, cap precedence, and a bounded measurement algorithm that never serializes or traverses beyond cap-plus-one. Separately approve global owner-cell/live-slot count/byte caps, bounded owner-cell initialization failure, atomic `open_empty|open_slot -> closed` install-versus-completion/cancel/throw behavior, nullable slot allocation, per-slot and per-producer lease caps, repeated-acquisition behavior, slot/ref/lease lifetime, and the private nonserializable `AcceptedRefSlotTaskLink` representation/item/byte charge, atomic link-creation/admission-or-finalization transition, single-settlement behavior, partial-state release, leaked-cell/link/lease expiry/forced-cleanup semantics, and slot-registry shutdown disposition. Also approve listener delivery eligibility under saturation, shutdown deadline/disposition, restart behavior, and fixed value-free overload/leak diagnostics. Owner-cell initialization or slot exhaustion disables only provenance/returns an absent slot; install after owner close terminalizes/releases the new slot without offer; lease exhaustion/repeated acquisition returns null. Each branch releases/finalizes only bounded provenance state and never changes the source operation. Link creation/measurement/setup failure, rejection, or overflow must invoke only the internal fixed task-link finalizer, settle the installed slot once, terminate/drop only provenance work, independently skip affected subscribers, and never backpressure or retry a source operation. No queued owner cell/slot handle, caller callback/runnable/finalizer, command-context handle, capacity, accounting, or default may be inferred. |

## Registry Responsibilities

The registry owns:

- Common envelope schema.
- Allowed `eventFamily` values.
- Canonical `eventType` values.
- Known `eventPhase` values by family/type.
- Shared enum values for actor, origin, confidence, and context scope.
- Shared redaction status plus registered domain sensitivity and policy ID/version requirements.
- Edge vocabulary.
- Domain payload validators.
- Registered extension/sidecar ownership and derivation rules, including whether each is authoritative or derived from shared envelope fields such as `resources[]`.
- Projection helpers for ledger columns and resource sync messages.
- Exact projection-alias mappings; compact names such as `causeIds` must declare their source pointers, presence/redaction rules, and cannot create a second identity vocabulary.
- Validation warning/error shape.

## Validation Severity

```text
error    Event cannot be trusted or persisted as canonical.
warn     Event can be persisted but should be flagged for cleanup.
info     Event is valid but uses optional or future-facing fields.
```

These severities apply to the provenance candidate, not to the source operation. Schema validation is not command authorization. An `error` prevents the candidate from being represented as an accepted canonical event; it does not reject, roll back, or suppress an otherwise valid prompt, file operation, tool call, automation run, or external observation.

Validation separates:

- **Operational fact core:** values already established by safely accepting or observing the operation, such as the resolved mutation workspace/path/operation. A producer cannot publish a canonical domain fact without its domain core, but failure to build that record is handled as a diagnostic after the source operation rather than retroactively failing the operation.
- **Server-owned envelope:** `eventId`, `schemaVersion`, family/type, `occurredAt`, and server-known domain IDs are generated or assigned by the accepting producer and must not depend on renderer metadata.
- **Attribution and enrichment:** actor detail, UI context, cause IDs, native refs, before/after enrichment, counts, hashes, previews, and optional projections degrade to `unknown`, explicit omission/unavailable forms, `warn`, or `info` whenever the domain schema permits. Their absence does not block the source operation.

Examples:

- Missing `eventId`: error.
- Missing `ids.workspaceId` on a canonical resource-mutation candidate: error because the domain fact cannot be keyed safely. A structured diagnostic records the reason without treating the candidate as canonical; the source mutation is not retroactively failed.
- Provider-native `openCodeEventId` as a top-level canonical field: warning or error depending on migration phase.
- Unknown external causation: valid, not a warning.
- Missing optional domain projection: info.

## Common Envelope Checks

Validation should verify:

- `eventId`, `schemaVersion`, `eventFamily`, `eventType`, and `occurredAt`; every 40b1a UI/resource/workspace/view/theme validator accepts only integer `schemaVersion === 1`, while later schema versions require a separately registered validator.
- Dotted canonical `eventType` names, not colon bus topics.
- `source`, `origin`, `observedBy`, `actor`, and `confidence` meanings are not mixed.
- Cause IDs reference upstream initiators, not the current event's own domain ID.
- Harness fields use `harnessId`, `harnessRunId`, and `harnessEventId`.
- Provider-specific IDs live under `nativeRefs` or provider-specific payloads.
- `context` holds UI/client/view details rather than resource identity.
- `resources[]` uses workspace-relative paths unless a field is explicitly named `absolutePath`.
- `ids.serverMutationId` is required only for the SPEC-32 server-produced resource-mutation branch and prohibited for watcher resource facts; it is not a generic lifecycle ID.
- Automation subtype causes remain unregistered while `AUT-D03` and provenance finding 1 are open.
- Tool/automation captured-output fields remain unregistered until `TOOL-D01`, `AUT-D01`, and finding 3 approve the owner-selected unified extension contract, including whether it is one shared block; independently registered parallel names are rejected.
- Chat/tool resource sidecars remain unregistered until provenance finding 4 defines their relationship to normalized `resources[]` roles.
- Domain `fileVersionIds` projections remain unregistered until their owning relationship schemas, accepted-reference bindings, and bounds are approved.

## Registered Families

Initial families:

```text
chat
chat.tool
resource
workspace
view
theme
ledger
file.version
automation
ui
audit
```

## Producer Integration

Every canonical producer goes through the validated-or-diagnosed publisher before UEB admission; validation must occur before subscribers treat a record as canonical, not only at ledger ingestion. An initiating fact such as `ui.action` may be offered only after operational validation accepts the command and starts or commits control to its operational path. An outcome/result fact may be offered only after the owning operation reaches the terminal or intermediate success, failure, rejection, cancellation, timeout, or partial outcome that the fact truthfully reports. A mutation fact may be offered only after its owning mutation succeeds or commits. Provenance observes that already-reached outcome and cannot alter it. No branch calls or awaits the publisher in the operation's execution/response chain. Validation output must be visible in development diagnostics. Validation and subscriber failures never fail or delay the already-accepted source operation.

After operational validation accepts a command, the handler starts the operational command path and returns control to it before scheduling initiating provenance such as `ui.action`. It never awaits construction, redaction, schema validation, canonical admission, or a reference promise in the command execution/response chain. For UI input after that start, it may run only SPEC-34's exact fixed-schema nonrecursive extraction/target copy plus exact 24-step synchronous `bindUiProvenanceContextForQueue`; it never invokes a general/async binder, clones/freezes/stringifies the untrusted input, or retains the original seed/complete attachment list. The extractor returns a transient token plus an already-frozen token-free `UiActionQueuedEnvelope`; the binder consumes the token, and successful binder/target preflight discards the extraction wrapper/token without a second copy before any slot/link allocation. Extraction, missing envelope, target-copy, or bounded binding failure omits UI provenance. Only after the three bounded data values are complete does the handler discard the opaque command ref/token and operational vector/object locals. It then follows the nullable allocation and atomic owner-cell installation contract below: null installs/offers nothing, `owner_closed` terminalizes/releases without offer, and only a successful install immediately invokes the fixed offer. D01's UI-task data plane may receive and charge/release only the token-free `UiActionQueuedEnvelope`, at most 32 exact five-field `UiProvenanceOperationalTarget` plain-data copies, and exact three-field `BoundUiProvenanceContext`. Its sole queued control-plane value is one private D01-created `AcceptedRefSlotTaskLink` defined below; no workspace token, extraction wrapper, owner cell/slot handle, command ref/token, caller callback/finalizer, attachment/vector entry, registry entry, connection/session, operation object, transition capability, or graph reference is queueable. A downstream fact checks a command-scoped accepted-reference slot synchronously; if the ref is already present it may bind the relationship, otherwise it omits the ID-bearing relationship and records the gap without waiting. A mutation fact such as `resource.*` does not exist until the owning mutation succeeds; after success its producer/recovery work is likewise scheduled outside the mutation result/response chain. No resource event or invalidation is computed or dispatched before mutation success. Missing metadata takes the bounded omission/diagnostic branch rather than lookup or retry.

After owner-approved `UEB-D01`, the provenance admission executor is distinct from the post-admission listener executor and never runs a submitted task inline. Its queue, retained memory, concurrency, overflow, cancellation, and shutdown behavior are exactly D01's approved contract. Before D01 closes, no production executor/ref-slot activation exists. Ref-slot ownership is exact:

```ts
type RefSlotTerminalReason =
  | 'candidate_construction_failed'
  | 'candidate_validation_failed'
  | 'canonical_publish_failed'
  | 'canonical_publish_suppressed'
  | 'admission_cancelled';

declare const acceptedRefSlotBrand: unique symbol;
declare const acceptedRefLeaseBrand: unique symbol;
declare const acceptedRefSlotTaskLinkBrand: unique symbol;
declare const acceptedRefSlotOwnerCellBrand: unique symbol;
type AcceptedRefSlot = Readonly<{ [acceptedRefSlotBrand]: true }>;
type AcceptedRefLease = Readonly<{ [acceptedRefLeaseBrand]: true }>;
type AcceptedRefSlotTaskLink = Readonly<{ [acceptedRefSlotTaskLinkBrand]: true }>;
type AcceptedRefSlotOwnerCell = Readonly<{ [acceptedRefSlotOwnerCellBrand]: true }>;

type UiProvenanceAdmissionData = Readonly<{
  queuedEnvelope: UiActionQueuedEnvelope;
  targets: readonly UiProvenanceOperationalTarget[];
  boundContext: BoundUiProvenanceContext;
}>;

createAcceptedRefSlotOwnerCell(): AcceptedRefSlotOwnerCell | null;
createAcceptedRefSlot(): AcceptedRefSlot | null;
tryInstallAcceptedRefSlot(
  ownerCell: AcceptedRefSlotOwnerCell,
  slot: AcceptedRefSlot,
): 'installed' | 'owner_closed';
acquireAcceptedRefLease(slot: AcceptedRefSlot, producer: RegisteredDownstreamProducer): AcceptedRefLease | null;
peekAccepted(lease: AcceptedRefLease): AcceptedCanonicalRef | null;
releaseAcceptedRefLease(lease: AcceptedRefLease): void;
closeAcceptedRefSlotOwnerCell(
  ownerCell: AcceptedRefSlotOwnerCell,
  outcome: 'completed' | 'cancelled' | 'threw',
): void;
offerUiActionProvenanceForSlot(
  slot: AcceptedRefSlot,
  data: UiProvenanceAdmissionData,
): 'admitted' | 'rejected';
```

At command acceptance, the existing server-owned execution context calls `createAcceptedRefSlotOwnerCell()` and stores its nullable result privately; a non-null D01-accounted cell starts `open_empty` and exposes no renderer/client key. Exact null means bounded initialization/capacity failure: provenance for that command is disabled with D01's fixed diagnostic, no later preflight/slot/offer work runs, every partial cell charge is released, and the operational path proceeds unchanged. Command completion, cancellation, or throw calls `closeAcceptedRefSlotOwnerCell` exactly once in its already-required `finally` only when the cell is non-null, atomically changing `open_empty|open_slot` to `closed`; an installed slot is closed, while an empty cell needs no slot cleanup. After the operational path has started and all three UI admission data values have completed successfully, a handler with a non-null open cell calls `createAcceptedRefSlot()`. Exact null means allocation/capacity failure: it releases every partial slot charge, emits only D01's fixed diagnostic, skips installation and offer, and leaves the operation unchanged. For a non-null slot, `tryInstallAcceptedRefSlot` atomically changes `open_empty` to `open_slot(slot)`. If command finalization already changed the cell to `closed`, installation returns `owner_closed`, internally terminalizes the new slot once as `admission_cancelled`, releases it, and the caller does not offer. If installation succeeds, the handler immediately calls module-private `offerUiActionProvenanceForSlot(slot, data)` in the same callback-free, non-yielding synchronous turn; therefore completion cannot interleave between successful installation and offer on the owning event loop. No slot or link is allocated on seed extraction, target-copy, or binder failure; there is no pending state on those branches. D01 bounds owner cells, live slots, and retained bytes. Once installed, every link-creation, measurement, offer-setup, rejection, or overflow failure is owned by the offer's internal finalizer and terminalizes the slot exactly once before return. `RegisteredDownstreamProducer` is the closed token union/table generated only from active `leaseRole = 'command_downstream'` entries in SPEC-32a's versioned `fusion-studio-server/lib/provenance/registries/first-package-producers.v1.json`, not a caller string or separately maintained list. Planned entries grant no runtime lease/publication authority. Acquisition verifies the token is active and registered for the current command type and applies D01's per-slot/per-producer lease and repeated-acquisition rules; capacity/repetition failure returns null with only the fixed diagnostic. Unsupported artifact versions fail provenance initialization/diagnostics without failing operations. The admission task alone may transition an admitted link's `pending` slot once to `accepted(ref)` or `terminal_without_ref(RefSlotTerminalReason)`; the fixed internal offer finalizer owns pre-admission terminalization. `canonical_publish_suppressed` retains its exact max-depth/same-event reason in diagnostics, not in the slot discriminant. There is no public settlement API.

`AcceptedRefSlotTaskLink` is an opaque, nonserializable, module-private executor control link with no readable ID or fields. `offerUiActionProvenanceForSlot` accepts the already-installed branded slot only as a synchronous nonqueued control input and the exact three-field data aggregate above; it is not exported and accepts no caller-created lookalike. The fixed-kind offer creates exactly one link from that slot and atomically either transfers the link and data to one admitted task or invokes D01's internal fixed rejection finalizer. Only the link, never the slot handle, enters queued/active/cancelling task ownership. An admitted task alone settles its linked slot once to `accepted(ref)` or the applicable terminal reason and releases the link; cancellation, expiry, forced cleanup, or shutdown invokes the internal finalizer and settles `admission_cancelled` once. Link creation/measurement/setup failure, rejection, or overflow never exposes or queues a task: the offer invokes the same internal finalizer synchronously after the operational path has started, settles the installed slot once to `admission_cancelled`, releases all partial link/data charges, and returns `rejected` without retry. Besides its branded slot and exact data aggregate, the offer accepts no caller callback, runnable, finalizer, task-kind selector, command ref/token, connection/session, operation object, registry key, or transition capability. D01 owns the fixed handler dispatch and must define the link's representation, item/byte charge, creation/admission state transition, lifetime, release point, double-settlement behavior, cap precedence, and shutdown cleanup. A link is charged against both its task and live-slot budgets and cannot outlive D01's approved slot lifetime. It conveys settlement reachability only and grants no access to the command context, connection/session, operation graph, registries, renderer data, or the slot's readable state.

A registered downstream producer acquires a lease synchronously when its work is created. Acquisition after `closeAcceptedRefSlotOwnerCell`, after D01 expiry/forced cleanup, above a D01 lease cap, or contrary to D01's repeated-acquisition rule returns null with only its fixed diagnostic; the producer continues without an ID-bearing relationship. A lease exposes only non-blocking `peekAccepted()` and idempotent `releaseAcceptedRefLease()`; no promise, wait, retry, callback, or subscription API exists. Pending, terminal, expired, or forcibly cleaned peek returns null. Command completion, cancellation, or throw must call `closeAcceptedRefSlotOwnerCell` in `finally`; this closes an installed slot or atomically prevents later installation, closes new acquisition, and does not cancel an already-admitted UI task. Repeated close is harmless and diagnosed. The D01-bounded executor guarantees every admitted task either runs once or invokes its cancellation finalizer, which sets `admission_cancelled`; overflow that does not admit a task invokes the same finalizer after the source continuation has started and never retries. Normal registry deletion occurs when the owner cell is closed, its installed-or-rejected slot is closed and admission-terminal, and the lease count is zero; an empty closed cell deletes immediately. Leaked ownership follows D01's exact lifetime/forced-cleanup and shutdown disposition so external failure cannot retain cell/slot/ref state without bound. Double release/close is harmless and diagnosed; a lease is invalid after release, expiry, forced cleanup, or shutdown. Thus late installation/admission cannot reopen a completed command and early consumers deterministically omit rather than wait. Listener delivery context/ref retention is limited by D01's exact per-task/subscriber lifetime and retained-byte rules; no subscriber owns an unbounded exception.

Tests pause/saturate the D01-approved admission executor before command acceptance and require the operation/acceptance response to settle, proving there is no hidden dependency. They compile/runtime-assert that `createAcceptedRefSlot()` null releases partial charges, installs/offers nothing, and leaves the operation unchanged. They prove invalid/absent seed, target-copy failure, and binding failure allocate zero slots/links; link creation, measurement, offer setup, rejection, and overflow each terminalize the installed slot exactly once, release every partial charge, and permit normal deletion without expiry. Install-versus-completion/cancellation/throw races cover finalization before allocation, at null allocation, before atomic install, at install, and after install before the immediate offer boundary; `owner_closed` always terminalizes/releases the new slot once and offers nothing, while a winning install offers in the same non-yielding turn. They also cover owner-cell initialization failure, empty-cell close/deletion, accepted/each terminal reason, pending peek, acquire-versus-close races, late acquisition, release-before/after settlement, double release/close/settlement, invalid post-release/expiry/forced-cleanup peek, atomic offer admission versus rejection, task-link charge/release/reachability, and normal deletion with zero leases. They run minus/exact/plus global owner-cell/slot count/byte caps, task-link item/byte caps, per-slot/per-producer lease caps, repeated acquisition, leaked-cell/link/lease lifetime/cleanup, and slot-registry shutdown, proving exhaustion returns absent/null and all registry/ref ownership stays within D01. ABI tests prove the module-private offer receives the branded slot synchronously but only its D01-created link enters the task; they reject every caller lookalike/callback/runnable/finalizer and every queued slot handle, command ref/token, or operation-graph value. Listener tests exercise D01's exact retained-byte/lifetime boundary and prove expiry/release removes external reachability without affecting other subscribers.

After admission, UEB offers every eligible listener callback as a separate task to the D01-bounded supervised side-effect executor; it never calls a listener directly in the admission or source-operation stack and never awaits a listener-returned promise. It attempts listeners in deterministic D01 order before workers run. Saturation applies D01's independent per-listener skip/finalizer and fixed diagnostic, not backpressure or retry, so one listener cannot prevent another eligible listener from being offered. The executor re-enters captured `AsyncLocalStorage` chain context for admitted tasks and supports deterministic test draining. Subscriber code must use async I/O and offload unbounded CPU work; synchronous filesystem/database/provider I/O is forbidden. Already-available enrichment may be copied into the candidate before admission; enrichment computation, lookup, I/O, or awaiting never precedes canonical admission or renderer invalidation. Ledger, versioning, audit, compaction, and other subscribers cannot hold the operation response open. Watcher-only observations use the same contract.

The integration suite rejects Promise-returning validators/redactors/admission hooks/projections, injects synchronous throws and admission suppression, and proves the operation starts and its response settles without releasing the paused provenance admission executor. It then releases that executor and verifies the defined diagnostic or recovery. It proves downstream facts never await a lease: they bind an already-present ref or omit the relationship, release in `finally`, and cannot keep closed slot/ref state alive. It asserts every eligible listener is offered in deterministic D01 order before listener-executor release; admitted tasks remain queued while independently saturated deliveries take D01's exact skip/finalizer branch. Captured async chain context survives the queue, and a never-resolving listener cannot prevent later listeners from being offered or admitted under D01's fairness and concurrency rules. Subscriber tests fail on synchronous filesystem/database/provider I/O. Test latches and leases are released during teardown. This is a sequencing guarantee, not a wall-clock SLA.

After D01 closes, its acceptance suite runs minus/exact/plus executor item/byte capacities and global owner-cell/slot count/byte plus lease capacities, every install-versus-completion/cancel/throw boundary, every producer/subscriber fairness boundary, concurrent saturation, repeated acquisition, leaked cells/leases, never-settling admitted tasks, overflow eviction/drop/finalizer branches, retained event/context/ref byte and lifetime expiry, forced cleanup, shutdown at deadline-minus/exact/plus, restart, and diagnostic saturation. Byte tests cover every approved representation/encoding/overhead class, shared-ref apportionment, queued-to-active-to-cancelling transitions, exact release points, competing-cap precedence, and cap-plus-one early stop without an over-cap traversal/serialization operand. The suite proves owner-cell/slot/lease exhaustion returns absent/null, install after owner close offers nothing and releases once, admission overload closes each affected slot exactly once, listener overload skips only its own delivery, no queue/cell/slot/lease/ref/diagnostic memory exceeds an approved bound, and source responses/operations never await, retry, or receive backpressure.

UI admission fixtures separately prove extraction returns a transient token sibling plus an already-frozen recursively readonly token-free envelope; binder/target preflight passes that exact envelope object without a second copy, then drops the wrapper/token before slot allocation. Preflight failure owns zero slots/links, nullable slot allocation skips installation/offer, owner-cell close wins safely against late installation, the fixed offer sees its branded slot only synchronously, D01's task data plane owns only the token-free `UiActionQueuedEnvelope`, target array, and `BoundUiProvenanceContext`, and its queued control plane owns exactly one D01-created/accounted `AcceptedRefSlotTaskLink`. They prove all data, owner-cell, slot, link, and partial charges are released on owner-cell/slot/link creation failure, install-after-close, measurement/setup failure, success, construction/validation failure, rejection/overflow, cancellation, expiry, forced cleanup, and shutdown, with exactly one terminal slot settlement whenever a slot was installed or rejected after allocation and normal deletion without forced expiry. Type/ABI and WeakRef/reachability sentinels prove the extraction wrapper, workspace token, owner cell/slot handle, command-context ref, connection/session, transition capability, attachment vector/entries, registries, caller callbacks, and operation graph are absent and unreachable from queued/active/cancelling task data.

Initial integration points:

- Resource event producer/enricher from SPEC-32.
- UI action module from SPEC-34.
- Harness/tool adapter from SPEC-36.
- Automation event producer from SPEC-37.
- File versioning subscriber from SPEC-33.
- Audit query producer from SPEC-38.
- Ledger subscriber from SPEC-35.

## Compatibility Adapters

During migration, compatibility adapters may translate legacy WebSocket or bus messages into canonical events or derived projections. They must be temporary and named clearly.

Rules:

- Adapters can map legacy messages to canonical events.
- Adapters can map canonical events to derived render/cache messages.
- Adapters must not introduce a second event language.
- Temporary adapters should have removal criteria in the owning implementation spec.

## Accepted Reference Discipline

Operational IDs and candidate domain IDs are not automatically valid downstream causes. Redaction first produces a JSON-safe base with every proof-required identity absent. `prepareCanonicalCandidate` clones that base, inserts privately proven identities, and returns an opaque wrapper. The validated publisher accepts only that wrapper, validates the final safe event, creates a private branded `PendingCanonicalRef`, and calls canonical UEB admission. After suppression checks, UEB canonical-clones and recursively freezes the final event, extracts its registered identity, privately binds the exact frozen event/identity to a promoted `AcceptedCanonicalRef`, and freezes one `CanonicalDeliveryContext = Object.freeze({ acceptedRef })`. Every listener task uses exact ABI `listener(frozenEvent, deliveryContext)` with the same event, context object, and ref. The mutable producer input is never delivered. UEB returns `{ published: true, acceptedRef }` before listener code. On a false result, no event/ref/context/task is exposed and no event is canonical.

```ts
type AcceptedCanonicalIdentity = Readonly<{
  eventId: string;
  eventFamily: string;
  eventType: string;
  workspaceId: string | null;
  correlationId?: string;
  domainIds: Readonly<Partial<Record<RegisteredDomainIdKey, string>>>;
}>;

type CanonicalDeliveryContext = Readonly<{ acceptedRef: AcceptedCanonicalRef }>;

declare const freshCanonicalCorrelationBrand: unique symbol;
type FreshCanonicalCorrelation = Readonly<{ [freshCanonicalCorrelationBrand]: true }>;
createFreshCanonicalCorrelation(): FreshCanonicalCorrelation | null;

declare const acceptedLedgerRowRefBrand: unique symbol;
type AcceptedLedgerRowRef = Readonly<{ [acceptedLedgerRowRefBrand]: true }>;
loadAcceptedLedgerRowRef(ledgerEventId: string): Promise<AcceptedLedgerRowRef | null>;

declare const crossWorkspaceRelationshipAuthorizationBrand: unique symbol;
type CrossWorkspaceRelationshipAuthorizationRef = Readonly<{
  [crossWorkspaceRelationshipAuthorizationBrand]: true;
}>;

type CanonicalIdentityBinding =
  | Readonly<{
      pointer: RegisteredCanonicalIdentityPointer;
      upstreamRef: AcceptedCanonicalRef;
      select:
        | Readonly<{ kind: 'eventId' }>
        | Readonly<{ kind: 'upstreamRootOrSelf' }>
        | Readonly<{ kind: 'correlationId' }>
        | Readonly<{ kind: 'domainId'; key: RegisteredDomainIdKey }>
        | Readonly<{ kind: 'acceptedPayloadPointer'; pointer: RegisteredAcceptedPayloadProjectionPointer }>;
      crossWorkspaceAuthorization?: CrossWorkspaceRelationshipAuthorizationRef;
    }>
  | Readonly<{
      pointer: RegisteredCanonicalIdentityPointer;
      freshCorrelation: FreshCanonicalCorrelation;
    }>
  | Readonly<{
      pointer: RegisteredCanonicalIdentityPointer;
      historicalRef: AcceptedLedgerRowRef;
      select:
        | Readonly<{ kind: 'eventId' }>
        | Readonly<{ kind: 'upstreamRootOrSelf' }>
        | Readonly<{ kind: 'correlationId' }>
        | Readonly<{ kind: 'domainId'; key: RegisteredDomainIdKey }>
        | Readonly<{ kind: 'acceptedPayloadPointer'; pointer: RegisteredAcceptedPayloadProjectionPointer }>;
      crossWorkspaceAuthorization?: CrossWorkspaceRelationshipAuthorizationRef;
    }>;

declare const preparedCanonicalCandidateBrand: unique symbol;
type PreparedCanonicalCandidate = Readonly<{ [preparedCanonicalCandidateBrand]: true }>;

prepareCanonicalCandidate(
  safeCandidateWithoutProofRequiredIdentities: Readonly<CanonicalEventCandidate>,
  bindings: readonly CanonicalIdentityBinding[]
): PreparedCanonicalCandidate;

type CanonicalPublishResult =
  | Readonly<{ published: true; acceptedRef: AcceptedCanonicalRef }>
  | Readonly<{ published: false; reason: 'max_chain_depth' | 'same_event_loop' }>;

inspectAcceptedRef(ref: AcceptedCanonicalRef): AcceptedCanonicalIdentity;
assertAcceptedDelivery(event: Readonly<CanonicalEvent>, ref: AcceptedCanonicalRef): void;
```

`publishCanonical` returns exactly `CanonicalPublishResult`: runtime `Object.keys` are exactly `['published','acceptedRef']` on true and `['published','reason']` on false. False never carries event/ref/context. A thrown publication failure returns no result and is diagnosed as `canonical_publish_failed`; a false result maps to `canonical_publish_suppressed` with its exact reason.

`AcceptedCanonicalRef` has no public constructor and no readable raw-ID fields. Listener code reads only `deliveryContext.acceptedRef`; passing the bare ref as argument two is an ABI error. `inspectAcceptedRef` exposes frozen identity for inspection and non-candidate projections, but its ordinary strings are not relationship proof and cannot by themselves satisfy canonical admission. `RegisteredDomainIdKey` and `RegisteredCanonicalIdentityPointer` are schema-registry allowlists, not arbitrary strings. Slice 40b1a registers exactly `uiActionId` and `resourceEventId`; later domain slices add their named keys before use. `assertAcceptedDelivery` succeeds only for the exact bound frozen event/ref. A separately retained raw ID, copied event, mismatched/forged ref, or unregistered domain ID never supplies a relationship: the affected registered relationship group is omitted and the otherwise safe fact remains eligible for admission.

`prepareCanonicalCandidate` is the sole canonical accepted-identity constructor. It runs after redaction on a relationship-free safe candidate. Before resolving bindings it strips any caller-populated accepted-only/proof-required pointer and records the fixed diagnostic below; caller metadata can never make the independently valid base fact ineligible. An upstream binding verifies the private ref, pointer/selector, exact candidate/source event-type pair, and registered relationship group before inserting the selected event ID, propagated chain root, correlation ID, or domain ID. Every event schema declares atomic relationship groups. All pointers in a group are inserted only when every binding for that group succeeds; otherwise the whole group remains absent, preventing partial root/parent/cause/origin mirrors. Independent groups, such as fresh correlation, resolve separately.

Every registered event schema classifies `/ids/workspaceId` as `workspace_required`, `workspace_nullable_transition`, or `workspace_neutral`; accepted identity extraction stores the validated string or null and never trusts a caller argument. By default a workspace-scoped candidate and upstream must have exactly equal non-null workspace IDs. A nullable transition may relate only to an equal non-null upstream workspace on the exact registered transition selector; a null target does not make arbitrary null/null relationships valid. Workspace-neutral events cannot supply or consume a workspace relationship. Any absent, malformed, stale, forged, wrong-event, wrong-selector, wrong-workspace, unauthorized, duplicate, or otherwise unavailable proof leaves its atomic relationship group absent and reports only fixed `accepted_relationship_unbound`; it never rejects the relationship-free safe base.

Cross-workspace binding is closed by default and has no first-package registration. A future schema may enable one only by registering the exact candidate event type, target pointer, selector, source event type, source/target workspace roles, and authorization policy ID. The caller must also supply an opaque `CrossWorkspaceRelationshipAuthorizationRef` minted by that policy after its ordinary operation authorization; a boolean, workspace string, inspected identity, session value, or accepted ref alone never qualifies. The builder privately verifies that the authorization binds the exact candidate/source workspaces and operation, then records it with the proof. Authorization absence/failure omits the relationship and cannot affect the source operation.

A fresh-correlation binding consumes an opaque value created by synchronous exception-swallowing `createFreshCanonicalCorrelation`. It makes exactly one call to the approved server correlation-ID generator, validates that result against the registered ID schema, performs at most one opaque allocation/private `WeakMap` registration, and never retries or loops. On success it returns the opaque value and never exposes a caller-supplied ID. Generator absence, null/invalid output, or throw, allocation failure, or private-registration failure releases partial state, reports only exact frozen `{ code: 'fresh_correlation_unavailable' }`, and returns null. The producer then supplies no fresh-correlation binding; `/ids/correlationId` remains absent while the independently safe relationship-free fact stays eligible. It never copies `clientCommandId`, a renderer/caller correlation, session/operation state, an inspected accepted ref string, or another raw ID as fallback. The builder inserts a qualifying non-null value into a fresh canonical clone and records pointer/source/workspace proof in a second module-private `WeakMap` keyed by the opaque prepared candidate. Duplicate pointers, absent/unregistered selected IDs, pre-populated proof-required pointers, wrong event type/workspace, or incomplete proof omit the affected group and emit the fixed diagnostic. Bindings and proofs are never serialized or delivered. Whole-candidate rejection is reserved for a missing/invalid required operational fact core or a relationship-free base that cannot be made schema-safe by the registered redaction policy; even then only the canonical fact is omitted and the source operation continues.

Historical relationships use `AcceptedLedgerRowRef`, never a row object, status string, raw ID, or caller-supplied workspace. SPEC-40c's trusted repository looks up by `ledgerEventId`, reads accepted SPEC-35b storage, requires accepted admission plus valid/warning validation, parses/revalidates exact stored `payload_json`, verifies compact identity columns including workspace identity, and requires a present matching payload hash. Every null-hash row fails capability construction, including the registered UI failed-redaction safe-core and ledger defensive fallback; self-consistent mutable columns/payload without integrity evidence do not prove the originally accepted identity. Only a passing hashed row yields an opaque capability privately bound to the extracted workspace-bearing `AcceptedCanonicalIdentity` and frozen safe payload; all missing, malformed, unregistered-version, column, workspace, branch, hash-presence, or hash-value mismatches return no capability plus exact fixed `accepted_relationship_unbound`. The capability is process-local, nonserializable, has no readable ID fields, and uses the same event-type/pointer/selector/workspace registry as a live ref. `prepareCanonicalCandidate` re-verifies its private binding and workspace rule immediately before publication; failure strips the atomic group from a fresh clone and continues final validation of the relationship-free fact.

Later aggregate/projection schemas that genuinely need an ID already embedded in an accepted safe source payload must register an exact target/source pair using `acceptedPayloadPointer`; neither a generic JSON pointer nor whole-object copy is allowed. For a live ref the builder reads the exact frozen bound event after `assertAcceptedDelivery`; for a historical capability it reads the exact privately retained revalidated payload. It requires the source scalar and target meaning/type to match the registered pair. Array indices are concrete. This proves transitive projection from an accepted payload without claiming the source event's own identity proves every embedded ID. No 40b1a target/source pair is registered; SPEC-39 may later register only its explicit storm member/cause/actor summary projections. File-version events deliberately traverse through the resource parent instead of registering transitive attribution copies.

Relationship selectors have distinct meanings. `eventId` returns only the accepted source event's own ID. `upstreamRootOrSelf` returns the exact accepted source payload's registered `/ids/rootEventId` when present, otherwise that source's own `eventId`; for a historical capability it reads only the hash-verified revalidated payload. `/ids/parentEventId` is the immediate producing canonical predecessor for the registered candidate/source pair. `/ids/causationId` is the direct initiating canonical cause registered for that event type and is never inferred from parent, root, correlation, or ledger edges. When root and parent are populated for one step, both consume the same immediate-parent capability, with root using `upstreamRootOrSelf` and parent using `eventId`; an arbitrary retained ancestor cannot substitute. Later durable `caused_by` edge semantics remain gated by `LED-D03`.

The 40b1a pointer registry is exact:

- A first-package `ui.action` has no canonical predecessor: `/ids/rootEventId`, `/ids/parentEventId`, and `/ids/causationId` are absent. It attempts a fresh server correlation only through nullable `createFreshCanonicalCorrelation`; null/throw omits only `/ids/correlationId` with `fresh_correlation_unavailable`, never suppresses the safe UI fact or affects the command, and never falls back to caller/session/operation correlation. Carrying an existing correlation requires an exact later registered source pair.
- A resource candidate whose direct accepted initiator is `ui.action` uses that same accepted UI ref for `/ids/rootEventId <- upstreamRootOrSelf`, `/ids/parentEventId <- eventId`, and `/ids/causationId <- eventId`; its UI-domain origin/cause fields below consume the same ref. Watcher/server/external resource candidates have no accepted canonical predecessor in 40b1a and omit all three fields. No resource-to-resource pair is registered here.
- First-package lifecycle candidates have no accepted canonical predecessor and omit root, parent, and causation. A later owning slice must register an exact lifecycle candidate/source pair before adding one. Resource and lifecycle `/ids/correlationId` may select an upstream correlation only for an exact registered source pair or consume a `FreshCanonicalCorrelation`; absence otherwise means omission.
- For resource candidates, `/provenance/origin/id` is registered only when `origin.type = 'ui'` and selects `domainIds.uiActionId`; `/provenance/cause/uiActionId` selects the same registered domain key from the same accepted UI ref used for root/parent/causation. First-package lifecycle registers neither pointer. The `ui.action` event's own equal origin/action ID is its schema-approved current-record identity and is not a binding.
- For resource candidates, each `/resources/{index}/relatedEventId` selects an upstream `eventId`, and `/resources/{index}/resourceEventId` selects `domainIds.resourceEventId`. Numeric indices are resolved from the final array; wildcard strings are not runtime pointers.
- No other first-package pointer accepts an upstream identity. Harness/tool/automation/audit cause keys, harness IDs, file-version IDs, chat UI links, and `automationRef` remain unregistered until 40b2 or their owning later slice extends both schema and pointer registries.

The validated publisher accepts only `PreparedCanonicalCandidate`, unwraps its private clone/proof, and re-verifies every populated proof-required group against its still-valid private source immediately before final validation and UEB admission. A failed re-verification produces a fresh clone with that group absent plus fixed `accepted_relationship_unbound`; it does not discard the base fact. Event schemas distinguish upstream relationships/proof-required correlation from current-record identity/self mirrors and ordinary operational/session IDs. For example, a `ui.action` event may establish its own `uiActionId` and equal self-origin under its exact schema; a downstream resource `provenance.cause.uiActionId` is accepted-only and must be inserted by the builder. Copying the same string returned by `inspectAcceptedRef`, retaining a correlation string, or accepting a caller-generated correlation ID yields omission because no private binding exists.

The accepted-ref binding registry is a module-private `WeakMap<AcceptedCanonicalRef, { event: Readonly<CanonicalEvent>; identity: AcceptedCanonicalIdentity }>` keyed by the frozen ref object. Fresh correlation objects map privately to their generated strings, accepted-ledger-row capabilities map privately to both revalidated workspace-bearing identity and frozen safe payload, and cross-workspace authorization capabilities map privately to their exact policy/workspace/operation binding. The prepared-candidate proof registry is a separate module-private `WeakMap<PreparedCanonicalCandidate, { event: Readonly<CanonicalEvent>; bindings: readonly CanonicalIdentityBinding[] }>` containing the builder's cloned event and proof. Neither refs, candidates, bindings, capabilities, fresh-correlation objects, nor registry entries are serialized as provenance. The inspectors, builder, and publisher close over these maps; unknown keys fail. Weak ownership permits garbage collection when publisher/tasks release the objects.

Slice 40a adds the ref registry, prepared-candidate builder/publisher, and admission API while preserving legacy `emit()` only for non-migrated topics. Existing listeners may ignore argument two, but every D01-admitted delivery uses the same two-argument ABI; migrated subscribers destructure `{ acceptedRef }`, use `inspectAcceptedRef(acceptedRef)` for inspection, and identity-sensitive subscribers also call `assertAcceptedDelivery(frozenEvent, acceptedRef)`. Canonical loop identity uses the frozen identity's `eventId`; admitted tasks use async-scoped context and isolate concurrent roots. Subscriber failure or a D01 saturation skip does not revoke admission.

Downstream producers pass upstream refs to `prepareCanonicalCandidate`; they never write accepted-only `ids.rootEventId`/`parentEventId`/`causationId`, ID-bearing upstream `provenance.origin`, `provenance.cause`, result/resource mirrors, or ledger-edge targets themselves. If a ref/binding is unavailable or invalid, its group remains absent while the independently valid fact proceeds; known origin type and confidence may still be recorded without inventing an ID. Only invalid required fact core, unsafe unsanitizable base, final schema failure unrelated to an omitted relationship, or UEB failure can suppress the canonical fact, and none affects the source operation. This applies uniformly to UI actions, chat turns, tool/harness events, automation runs, audit queries/reviews, resource events, file versions, and future domains.

UEB subscriber failure does not revoke an already accepted reference or fail the source operation. If ledger persistence misses an accepted upstream event, edge handling follows the owner-approved `LED-D04` storage policy rather than inventing a target or affecting either source operation. Tests must cover accepted propagation, relationship-proof omission with base-fact admission, unpublished source non-propagation, and ledger target-unavailable behavior.

## Failure-Isolation Matrix

| Failure | Required behavior |
|---|---|
| Renderer attribution/context field is missing or malformed | Continue an operationally valid command; use server-known facts plus null/unknown/omission state or a diagnostic. |
| Renderer omits a canonical/domain ID | Server generates IDs it owns. Never require a renderer-generated `eventId`, `uiActionId`, ledger ID, or automation/harness normalization ID as interaction authorization. |
| UI-action construction, validation, or publication fails | Continue the accepted command; emit a structured diagnostic; do not attach a dangling `provenance.cause.uiActionId` downstream. |
| Optional resource before/after enrichment or counts are unavailable | Build the candidate with the registered unavailable/omission forms and admit it when the operational workspace/path/operation core and safe redaction form remain valid. Optional detail never suppresses the fact. |
| Resource candidate or safe-core validation fails | Publish no canonical event and expose no accepted reference. After an already-valid mutation or safely established watcher observation, record a diagnostic and invoke conservative renderer recovery. Never describe the rejected candidate as a canonical fact. |
| Resource UEB publication is suppressed or throws before admission | Preserve the mutation/observation, expose no accepted ref or canonical delivery, diagnose, and invoke renderer recovery. |
| Post-admission view projection fails | Preserve the already-valid accepted ref and frozen canonical delivery for all other subscribers; diagnose only the failed projection and invoke renderer recovery. Never revoke admission or pretend the canonical event was rejected. |
| Optional cause/native reference is absent | Preserve the event with honest `unknown`, `external`, unlinked, or lower-confidence attribution. |
| Accepted relationship proof is absent, stale, forged, mismatched, or unavailable | Omit its entire registered relationship group, emit only fixed `accepted_relationship_unbound`, and admit the otherwise valid safe fact. Never invoke renderer freshness recovery merely because optional relationship proof failed. |
| Ledger or file-version subscriber is unavailable | Source operation and canonical UEB delivery continue. Retry/defer is permitted only under the applicable owner-approved hard-bounded idempotency contract (`LED-D04`, `ULV-D12`, or later exact decision); before closure no production retry/deferred queue exists and the subscriber uses only its approved terminal/no-write branch. |
| Redaction of potentially sensitive material fails | Admit a failed-redaction safe core only when that domain's registry entry defines its exact shape. In the first package only `ui.action` has such a branch. Resource and lifecycle redaction failure publishes no canonical event/reference and invokes its non-canonical freshness recovery. Never expose unsafe material/derived preview/hash or fail the source operation. Ledger's defensive safe-payload boundary does not make an unadmitted event canonical. |
| Automation provenance emission fails | Automation execution follows its own operational result; record a provenance diagnostic without cancelling the run. |
| Storm compaction fails | Do not affect producers; preserve safe metadata or record bounded drop counts/diagnostics according to capacity policy. |
| Audit query infrastructure fails | The audit request may report its own failure/incomplete evidence, but historical source operations are unaffected. |

Tests for each integrating producer/subscriber must inject its applicable failure and prove both sides: the user or source operation retains its correct operational result, and the provenance system does not publish a falsely complete or falsely direct record.

## Diagnostics

General local development validation diagnostics may show only already-safe canonical material:

- Event ID.
- Family/type/phase.
- Validation severity.
- Invalid or deprecated fields.
- Missing required fields.
- Suggested canonical replacement.
- Producer module path and handler where available.

They are process-local development output, are never copied into canonical/ledger payloads, and must not contain raw candidate values, unsafe fields, tokens, capabilities, exception material, provider payloads, or unredacted paths. Accepted-proof failure is stricter: every live/historical/builder/final-reverification failure submits exactly `ACCEPTED_RELATIONSHIP_UNBOUND_DIAGNOSTIC = Object.freeze({ code: 'accepted_relationship_unbound' })` to `reportAcceptedRelationshipDiagnostic`. Runtime keys are exactly `['code']`. The sink accepts only that literal, increments one process-local saturating counter up to `Number.MAX_SAFE_INTEGER`, may log only the fixed code, immediately discards the object, serializes/persists nothing, and resets on restart. It forbids event/domain/workspace/connection IDs, pointer/field/selector/source names, paths, rows/payload fragments, capability/failure distinctions, reason/subcode, message/stack, and exception-derived values. Sink failure is swallowed. Exact equality, saturation/reset, no-retention, and cross-log/fallback/persistence sentinels are required tests.

Ledger defensive fallback uses its own exact frozen one-key `{ code: 'ledger_defensive_fallback' }`; no general validation diagnostic object is persisted. Local operational diagnostics explicitly approved by another domain, such as a path-bearing file watcher message, remain outside canonical/accepted-proof/ledger payloads and do not broaden either fixed sink.

## Migration Slices

### Slice 40a - Registry Skeleton

Blocked on owner-approved/back-validated `UEB-D01`. After closure, create common envelope validators and enum registration; D01's exact bounded non-inline admission/listener executors and non-blocking ref slot; the private accepted-ref/fresh-correlation/prepared-candidate registries and builder; the acknowledged UEB publish-result contract; and the canonical `eventId` loop key. Generate `RegisteredDownstreamProducer` only from the 32a artifact. Implement the registry update gate: `planned -> active` promotion atomically regenerates active-only token/authorization tables without changing `freezeVersion` only when intended semantic fields are identical; evidence-only updates change neither permission nor version; intended semantic changes atomically increment version and update all consumers/tests.

### Slice 40b1a - Early Registry And Admission Foundation

Requires accepted 40a under owner-approved `UEB-D01`. Register the domain validators required by the future first orchestrator package: resource mutation, workspace lifecycle, view registry, theme, UI action, and the renderer-to-server command envelope used by the Wiki Viewer and File Viewer `chat.send_with_resource` adapters. Slice 32a's discovery-only output includes the reviewed, frozen `first-package-producers.v1.json` artifact and bidirectional evidence report covering resource/lifecycle/UI-action producers. Slice 40b1a imports exact event/source/observer definitions for validation, rejects unsupported `schemaVersion`/`freezeVersion`, and rejects any pair absent from the artifact; it never transcribes or invents a second list. Runtime publication additionally requires the exact entry to be active. Slice 40a uses the same artifact for active-only closed lease tokens. This discovery prerequisite enables no publisher or runtime migration by itself. Canonical chat is not registered in 40b1a: existing `chat:*` events remain an explicitly named compatibility path, receive no `uiActionId`, and cannot satisfy canonical cause/result-link acceptance.

For `workspace.switched`, validation also requires the publishing producer token and `workspace.reason` pair to be present in that artifact entry. The first active matrix authorizes only the exact connection-originated `user_switch` branches in SPEC-32; schema-reserved `startup|reload|system` literals have no publishing permission until a later registry update gate adds an exact producer/reason pair.

Register `ui-resource-metadata-v1`, `resource-metadata-v1`, and `lifecycle-metadata-v1`, all at string version `'1'`, using SPEC-34's exhaustive policies. Lifecycle validators cover the exact workspace/view/theme variants, omit compatibility absolute roots, require workspace-relative affected paths, and send the exact non-canonical `lifecycle:refresh_required` branch on policy failure. Resource hashes remain `policy_unapproved`. Policy failure never changes the source operation/observation/lifecycle result.

This slice also creates the single validated-or-diagnosed publisher boundary. A candidate with an `error` result cannot reach UEB as an accepted canonical event or reach subscribers that require canonical input; it produces a structured non-canonical diagnostic while the source operation continues. Accepted candidates retain any `warn` or `info` diagnostics for later ledger integration. The boundary must be reusable by later domain registrations; do not create a first-pair-only publisher.

Required verification:

- Focused registry tests cover every exact UI/resource/lifecycle policy pointer, known omission, presence, scalar, branch, and hash rule; prove lifecycle `failed` status is rejected with no safe-core admission; validate exact workspace/view/theme variants and pre-admission recovery-message construction for each applicable scope including null workspace; and prove `origin.id === uiActionId === extracted domainIds.uiActionId` plus every mismatch permutation. These are validator/publisher unit tests with test candidates and injected recovery sinks; they do not require SPEC-32 mappers, route sidecars, broadcasters, clients, or live producer integration.
- UEB tests prove exact call ABI/context identity, producer/nested mutation isolation, frozen-event equality, prepared-candidate-only publication, every 40b1a pointer/selector/group, fresh/propagated correlation success, ledger assertion, post-`await` causes, suppression, concurrent roots, and listener isolation. Inject fresh-correlation generator absence, synchronous throw, allocation failure, and private-registration failure; each returns null, releases partial state, emits exactly one-key `fresh_correlation_unavailable`, admits the otherwise safe UI fact without `/ids/correlationId`, leaves the command unchanged, and makes zero fallback reads/copies from `clientCommandId`, caller/session/operation state, raw IDs, or accepted-ref inspection. For missing/duplicate/wrong-pointer bindings, copied inspection strings/raw IDs, caller-supplied/retained correlation IDs, mismatch, forgery, unregistered ID, and final re-verification failure, assert atomic group omission, exact frozen one-key `accepted_relationship_unbound`, no value/sentinel retention, and successful admission of the unchanged relationship-free safe fact. Add live-ref workspace tests for equal workspace success plus A-to-B, non-null-to-null, null-to-null, neutral-to-scoped, stale, and forged capability omission; absence of any first-package cross-workspace registration; and a synthetic future registration that still omits on absent/wrong-operation authorization. Build A -> B -> C synthetic registered chains and prove C root=A, parent=B, direct cause follows only its registered source, root and parent consume the same immediate-parent capability, and an arbitrary retained A ref causes the whole group to be omitted while C's base fact remains admissible. Run the same multi-hop selector matrix with hash-revalidated historical payloads in the 40c extension. Separately prove only invalid required fact core, unsanitizable relationship-free base, unrelated final schema error, or UEB failure prevents canonical admission. Pause the admission executor and prove the operational response settles and downstream producers omit rather than await the ref; then release it and verify eventual admission. Cover the complete slot lease/close/cancellation/cleanup matrix above. Spy on 40b1a legacy `chat:*` to prove zero canonical publisher calls, accepted deliveries/admission markers, or canonical-only ledger/subscriber ingress.
- Run `cd fusion-studio-server && npm test -- --runInBand test/provenance/schema-registry.test.js`.
- Run `cd fusion-studio-server && npm test -- --runInBand test/event-bus-publish-result.test.js` for acknowledged publication and suppression branches.
- Run `cd fusion-studio-server && npm test -- --runInBand test/provenance/failure-isolation-latency.test.js`; it rejects async core hooks, proves synchronous throw/suppression cannot gate execution, and proves an unresolved subscriber cannot block later listeners or the operation response.
- Report the exact test result, changed files, validation diagnostics observed, and any temporary compatibility behavior.

Slice 40b1a acceptance enables the registered boundary but claims no SPEC-32 producer/projector/client integration. Those cross-module claims belong only to Slice 40b1b after its prerequisites exist.

### Slice 40b1b - First-Package Integration Acceptance

Prerequisites: accepted 32b0 coordinator/root/token transport precedes and is consumed by accepted 34d1 UI ingestion; Slices 32b and 32c are also accepted. This slice adds no new product schema. It integrates and accepts the already-registered 40b1a contracts against the implemented producers, sidecars, projection/recovery paths, and clients.

Required verification:

- Lifecycle projection tests require exact accepted-event `eventId`/`ids` equality, required-nullable previous/current workspace equality for workspace switches, no duplicate top-level workspace ID, rejection of every missing/wrong previous/current value and discriminant/ID cross-pair, and the complete opaque route/epoch-sidecar install/routing/failure/cleanup matrix from SPEC-32, including two null-workspace connections with initiator-only delivery, rapid `A -> null -> B` and `A -> B -> C`, same-workspace user-switch no-event behavior, unauthorized reason rejection, and initiator-absent/headless rejection. Pause admission across rapid transitions and prove every completed lifecycle fact is accepted for ledger/non-render subscribers while only stale renderer work is skipped.
- Resource mapper tests prove ref-keyed snapshot generation A survives live reload to B, zero live registry/root lookups, missing-sidecar recovery, and accepted-ref preservation.
- Run `resource-fallback.test.js`. Resource and lifecycle pre-admission candidate rejection/UEB false/publisher throw expose no ref/delivery and invoke the matching recovery union variant. Post-admission projection failure preserves the accepted ref and delivery to other canonical subscribers while invoking recovery only for renderer freshness. Recovery tests protect dirty/optimistic/undo/navigation state and cover workspace non-null/null, view-registry, theme, reconnect, failed-rewarm, and the 32b0 dual-topic fence.
- Run the bounded 40b1b smoke matrix only: 32b0 dual-topic/session/broadcaster/legacy-ledger isolation; 32b pure resource/lifecycle producer plus policy/route sidecar tests; 32c accepted projection and pre/post-admission recovery; client clean versus dirty/optimistic/undo/navigation preservation; null-workspace initiator routing; rapid-transition currency; and 34d1 UI-ingestion isolation. It explicitly excludes 32d production conversion/legacy resource-path removal, 32e watcher repointing, trigger migration, full SPEC-32 completion smoke, and 34d2 UI-to-resource cause binding. Those claims remain with their owning later slices.
- In the included 32b producer/enricher tests, require zero-call throwing spies for every optional file/stat/directory/sibling/count/tokenizer/deferred-enrichment hook. Pause those hooks and prove the operational response plus minimal watcher canonical scheduling/render recovery proceed independently; no 40b1b acceptance may rely only on checking the resulting omission value.
- Run the registry update gate across every first-package artifact entry and prove all are `active` with current handler/evidence, supported freeze version, and no drift between the artifact, generated lease tokens, and validator producer/reason/source/observer allowlists.
- Report exact results, changed files, validation/recovery diagnostics, registry freeze version, and remaining named compatibility behavior.

### Slices 40b2a-40b2f - Later Domain Registration Family

These are independent, branch-specific registration slices, not one generic implementation unit. Each registration precedes its owning producer or side-effect subscriber and may run only after its named contract decision closes.

#### Slice 40b2a - Canonical Chat Registration

Blocked on owner-approved `CHAT-D01`. Register only its exact approved chat event types, phase/lifecycle presence matrix, payload and accepted-reference bindings, redaction policy/version and failure branch, deterministic capacities, ordering/dedupe behavior, and migration compatibility. `chatResources` remains unregistered until finding 4 settles its authority/derivation relationship to normalized `resources[]`; `chat.hasToolCalls` remains unregistered until finding 8 settles pure derivation versus intentional redaction-surviving summary behavior. Then integrate the Wiki/File prompt path and remove only the compatibility gaps explicitly covered by the approved migration. Chat producers never await the UI ref slot: they bind it only when already available and otherwise publish the independently safe chat fact without that relationship. Acceptance tests cover every approved phase/status/presence branch, optional UI cause/result accepted/pending/rejected/late behavior, sensitive-field redaction and redaction failure, every bound and overflow form, ordering/dedupe/replay, legacy coexistence/removal, and operation non-delay.

This slice owns the canonical chat producer's registry extension. Atomically add the exact 40b2a owner literal and a distinct planned chat producer entry with its handler/event/source/observer, `leaseRole: 'command_downstream'`, and only the exact approved chat command types; increment `freezeVersion` and regenerate the schema, 40a token/command table, and validator/publication allowlists. Implement, verify, and promote that unchanged entry to active before it can publish or acquire the UI slot lease. Tests reject absent/planned/old-version/wrong-command/resource-token/synthetic tokens, prove activation is atomic, and prove chat publication without an already-available UI ref remains non-blocking and omits the relationship.

#### Slice 40b2b - Harness And Tool Registration

Register a harness identity or `chat.tool.started` branch only after owner-approved/back-validated `TOOL-D02`; register `chat.tool.args|result` and their outcome/lifecycle/persistence branches only after `TOOL-D01` also closes. Tool captured output must use the owner-selected unified extension contract jointly approved with `AUT-D01` and finding 3; exact shared-block choice/name/shape remains open. Tool resource sidecars also remain blocked on finding 4, and `fileVersionIds` remains absent until its later relationship registration. Preparatory identity/native-ref code is never publication authority. Acceptance covers exact phases, redaction/failure branches, bounds, ordering/dedupe, provider normalization, accepted-only relationships, and source-operation isolation.

#### Slice 40b2c - Automation Registration

Register no base automation run/match branch until owner-approved/back-validated `AUT-D03`. Automation result branches additionally remain blocked on `AUT-D01` and the owner-selected unified captured-output settlement with `TOOL-D01`/finding 3; subtype cause fields remain unregistered under finding 1, and `fileVersionIds` remains absent until its later relationship registration. File-trigger-to-resource accepted relationships remain blocked on `AUT-D02`. While D02 is open, an approved independently safe automation match/run schema must prohibit `automation.matchedEventId`, upstream resource root/parent/causation IDs, and the corresponding `triggered` edge. Acceptance covers every approved lifecycle/result branch, ordering/dedupe, serialization/redaction/capacity behavior, accepted-only links, and run isolation.

#### Slices 40b2d1-40b2d3 - Branchwise File-Version Registration

These are ordered incremental registry activations, not one all-or-nothing file-version slice. Each packet changes the registry only for its named branch, increments `freezeVersion`, regenerates consumers, and becomes active before the matching subscriber may emit. All require accepted SPEC-35b canonical storage. Approved `versioned_as`, `compacts`, `represents`, or other edge emission additionally waits for accepted SPEC-35d; any compact/drop behavior additionally waits for accepted SPEC-35f. A later branch cannot broaden an earlier registration implicitly.

- **40b2d1 - live metadata/hash-only versions:** requires owner-approved/back-validated ULV-D03, ULV-D05, ULV-D10, and ULV-D12 plus accepted SPEC-35b. Register only D12's exact event/phase/lifecycle/envelope/identity/order/idempotency/failure/transaction matrix and the approved metadata/hash eligibility, omission, retention, and safe failure forms. For every D12-approved non-batch event type, register `/fileVersion/createdFromResourceEventId <- upstream eventId`, `/ids/parentEventId <- upstream eventId`, and optional `/ids/correlationId <- upstream correlationId`; absent upstream correlation requires omission, never generation or copying. Also register optional `/fileVersion/createdFromResourceMutationId <- acceptedPayloadPointer('/resourceMutation/resourceEventId')`, requiring equality with extracted `domainIds.resourceEventId`; no alias or alternative pointer is permitted. Acceptance uses live accepted-delivery refs only and covers both event-ID targets agreeing with the same exact source, absent correlation omission, copied/raw/prepopulated/mismatched bindings, pointer/domain mismatch and omission, accepted resource-event traversal, every eligible/ineligible class, idempotent live retry/conflict/transaction branches, hash/redaction failure, and source-operation isolation. Before 40b2d1h, restart/replay cannot reconstruct a missing relationship from raw stored IDs: it follows D12's approved omit/diagnose/defer behavior and performs no historical backfill. Activate 40b2d1 before the live metadata subscriber emits; add `versioned_as` only after 35d is accepted.
- **40b2d1h - historical version replay/backfill:** requires accepted SPEC-40c, active 40b2d1, and a ULV-D12-approved historical replay/backfill/idempotency/conflict/transaction branch. Extend only the already registered 40b2d1 selectors to `AcceptedLedgerRowRef`; do not add raw row/ID inputs. Acceptance covers revalidated historical success, every null-hash/tampered/stale/wrong-version/selector failure, restart/replay ordering, duplicate live-versus-historical delivery, idempotent backfill, and omission/diagnostics without false relationships. No historical branch or test is part of 40b2d1 acceptance.
- **40b2d2 - snapshot/diff/blob artifacts:** additionally requires owner-approved/back-validated ULV-D02, with ULV-D03, ULV-D05, ULV-D10, ULV-D12, accepted SPEC-35b, and active 40b2d1 still required. Register only the approved artifact/content forms, bounds, reconstruction semantics, redaction/omission branches, and retention fields within the D12 base lifecycle/transaction contract. Activate 40b2d2 before any artifact is persisted; artifact edges additionally wait for accepted 35d.
- **40b2d3 - storm batches:** requires owner-approved/back-validated ULV-D03, ULV-D04, ULV-D05, and ULV-D10 plus accepted SPEC-35b; storm snapshot/diff references additionally require ULV-D02 and active 40b2d2. Register `file.version.change_batch`/`changeStorm`, exact bounded summary/overflow/follow-up forms, and retention fields. Activate 40b2d3 before a storm batch emits. `compacts`/`represents` edges wait for accepted 35d, and no compaction or artifact drop occurs before accepted 35f.

#### Slice 40b2e - Ledger-Internal Event Registration

Blocked on owner-approved/back-validated `LED-D02`. Register only the exact approved ledger-internal maintenance/repair/migration/audit event schemas, producers, redaction policies, bounds, and safe-payload/no-event branches. If D02 approves no canonical ledger-internal events, this slice records that closed result and creates no registry entry. It does not implement ordinary ledger storage integrity or historical relationship capability; those belong to SPEC-35b and SPEC-40c respectively.

#### Slice 40b2f - Audit And Review Registration

Register audit/query/review/recommendation/ticket branches only after `AUD-D01` closes. Acceptance covers every approved query and lifecycle branch, typed/redacted filters, accepted evidence/results, capacities, overflow/pagination, incomplete/failure behavior, and source-operation isolation.

### Slice 40c - Ledger Validation

Prerequisites: owner-approved `LED-D01` and accepted SPEC-35b storage/integrity implementation. Integrate validation into ledger ingestion, store warnings, and own the trusted repository plus `loadAcceptedLedgerRowRef` capability boundary using the approved versioned canonicalization/encoding/hash/digest/migration contract. Register its exact historical pointer/selector bindings here. Tests cover official byte/digest vectors, canonicalization equivalence, version migration/reverification, successful ordinary hashed safe-payload capabilities with workspace identity extracted only from the verified row/payload, categorical no-capability results for UI failure-safe-core/defensive-fallback/any other null-hash row, raw row/status/caller-workspace, every branch/hash/workspace mismatch, stale/forged input, nonserialization, equal- and cross-workspace builder rules, multi-hop historical root-or-self/parent/direct-cause semantics, arbitrary-ancestor omission, fixed one-key diagnostics, base-fact admission without the group, and final builder re-verification.

### Slice 40d - Producer Validation

Add validation to SPEC-32, SPEC-33, SPEC-34, SPEC-36, SPEC-37, SPEC-38, and SPEC-39 event-producing producers/subscribers.

SPEC-32 integrates through Slice 40b1b after the Slice 40b1a registration foundation. SPEC-34 UI ingestion integrates through 34d1/40b1b; later UI-to-resource producer binding is Slice 34d2 after an applicable 32d producer exists. Remaining producers integrate only after their corresponding Slice 40b2a-40b2f registration exists.

### Slice 40e - Compatibility Warnings

Flag legacy field names, colon-topic identity, top-level provider-native IDs, and missing workspace/resource identity.

## Completion Criteria

- Canonical event contracts are centrally registered.
- New producers cannot silently invent conflicting provenance shapes.
- Ledger ingestion records validation status.
- Unknown external changes remain valid.
- Derived render/cache messages are clearly separated from canonical event identity.
- UEB returns exact acknowledged true/false results, preserves async chain context, keys canonical loop suppression by `eventId`, and isolates concurrent roots/listener failures.
- Accepted references are exposed only after UEB admission and are delivered to sync/async listeners plus the publisher; rejected, thrown, or suppressed candidates cannot leak IDs into downstream origins, causes, mirrors, native projections, or edges.
- Candidate/metadata/redaction/subscriber failures preserve valid source-operation results, omit unsafe material, and produce explicit diagnostics/degradation.
- Resource candidate rejection, publisher throw, UEB suppression, and projection failure invoke the tested non-canonical freshness recovery contract.
