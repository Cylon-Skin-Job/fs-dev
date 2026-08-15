# Provenance Spec Set Map

Status: DISCUSSION DRAFT

## Purpose

This file describes how the provenance specs in this folder fit together. It is not a replacement for the individual specs; it is the cross-spec map used to avoid drift between resource sync, UI actions, ledger storage, harness/tool events, automation, file versioning, storm control, audit queries, and schema validation.

## Authority Manifest

While this set remains `DISCUSSION DRAFT`, the files in `008-Provenance-Temp`, this map, the master plan, and their referenced durable wiki pages are the sole current provenance planning authority. Same-name SPEC-32/33/34 files under `Captures/003-TODO/specs` are superseded snapshots and are not implementation inputs; the TODO index points here.

The [2026-07-15 provenance cross-article findings](provenance-schema-findings.md) are the active schema-correction and unresolved-issue log. Owner direction in chat on 2026-07-15 requires these corrections, requires new or unresolved choices to stay in that log rather than be assumed, and establishes a unified, composable schema with reusable shared blocks and registered extensions as the design goal. Decision-tagged findings are not implementation authority until explicitly settled and propagated.

Planning authority is not implementation approval. An orchestrator receives only a self-contained, frozen, owner-approved slice packet naming its exact SPEC sections, wiki authorities, prerequisites, commands, runtime evidence, clean-room instructions, and report contract. When a release candidate is promoted, update the TODO index and replace/archive superseded copies atomically so no two live authorities remain.

Packet assembly uses an explicit allowlist of the selected provenance SPEC/map/master sections, named durable wiki authorities, and any deliberately added packet manifest. It records a path-scoped diff/hash inventory and rejects unrelated application/view `state.json`, other capture trees, scratch files, and unlisted untracked paths even when the shared worktree is dirty. Those paths are neither reviewed provenance input nor release-candidate output and must not be modified merely to clean the packet.

## Spec Set

- [Provenance Implementation Master Plan](01-provenance-implementation-master-plan.md)
- [SPEC-32 - Resource Event Sync Controller](32-resource-event-sync-controller.md)
- [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md)
- [SPEC-34 - UI Action Provenance Module](34-ui-action-provenance-module.md)
- [SPEC-35 - Universal Ledger Storage, Edges, and Indexes](35-universal-ledger-storage-edges-indexes.md)
- [SPEC-36 - Harness, Tool, and Native Reference Provenance](36-harness-tool-native-ref-provenance.md)
- [SPEC-37 - Automation, Trigger, Scheduler, Script, and Agent Provenance](37-automation-trigger-scheduler-provenance.md)
- [SPEC-38 - Audit Query and Review Provenance Loops](38-audit-query-review-provenance-loops.md)
- [SPEC-39 - Change Storm Control and Compaction](39-change-storm-control-compaction.md)
- [SPEC-40 - Provenance Schema Registry and Event Validation](40-provenance-schema-registry-validation.md)

## Implementation Order

1. Run SPEC-32 Slice 32a as discovery-only prework to freeze the exact first-package producer registry; it enables no publisher or runtime migration.
2. After owner-approved `UEB-D01`, run SPEC-40 Slice 40a, then 40b1a. These independently establish the common envelope, D01-bounded publisher/ref machinery, and early resource/workspace/view/theme/UI validators with unit acceptance; they claim no SPEC-32 projector/client integration. Before D01 closes, neither slice may implement or activate the provenance executors or ref-slot delivery.
3. Run SPEC-34 Slices 34a-34c for renderer-only local Wiki/File prompt-envelope preparation. They preserve the operational attachment list, put no `uiActionSeed` or provenance field on the wire, and create no server ID/admission/token authority. Slice 34d1 later installs the full server prompt-log fence before atomically enabling wire attachment.
4. After owner-approved `RSC-D17`, run SPEC-32 Slice 32b0 to install the coordinator/root authority, D17-bounded per-recipient workspace command-context token transport, isolated provenance E2E launcher, and active legacy workspace topic fence. Before D17 closes, token allocation/transport cannot be implemented or activated and 32b0 cannot be accepted.
5. Run SPEC-34 Slice 34d1, now with accepted 32b0 as a hard prerequisite, for the independent UI-only server handoff. It claims no downstream resource producer binding.
6. Run SPEC-32 Slices 32b and 32c to establish canonical resource/lifecycle events and renderer recovery.
7. Run SPEC-40 Slice 40b1b to accept post-32 producer/sidecar/projector/client integration against the already-registered contract.
8. Run SPEC-32d producer conversions one named producer or explicitly bounded producer group at a time. Each unit owns its atomic registry addition, versioned consumer regeneration, conversion, verification, and activation with `leaseRole: 'none'`. A later SPEC-34d2 may atomically promote that same entry to `command_downstream` for exact commands and bind UI cause; it is not part of the first Wiki/File prompt handoff. This explicit order replaces all informal partial-slice dependencies.
9. Run SPEC-32e to install the operational workspace watch controller, side-effect-free mixed trigger classification, closed file-trigger validation, and atomic base-plus-workspace-filter replacement. Accept workspace/null/reload failures and cron/bus nonduplication before declaring watcher lifecycle migrated.
10. Run SPEC-32f for the Wiki migration, then 32g as one explicitly bounded remaining-view group at a time. Each view must pass its state-preservation and incremental invalidation checks; no view migration is implied by 40b1b alone.
11. After `LED-D04` closes storage idempotency/transaction/retry semantics, SPEC-35 persists canonical events, projections, validation status, native refs, resources, and approved graph edges. Payload hashing/capability and causal-edge branches also obey `LED-D01`/`LED-D03`; ledger-internal events obey `LED-D02`.
12. SPEC-36 and SPEC-37 normalize harness/tool and automation events after their registration/decision gates.
13. SPEC-33 adds SQLite file versioning after accepted applicable SPEC-32 view/watcher work, SPEC-35, SPEC-40, and ULV decisions.
14. SPEC-39 adds storm windowing/compaction after its blockers; SPEC-38 adds audit/review implementation after `AUD-D01` and sufficient source data.

The orchestrator implements and accepts one slice at a time. Independent preparation or advisory review may run concurrently only when it cannot mutate the active slice or bypass this ownership order.

## Ownership Boundaries

- Producers emit facts; subscribers filter, project, persist, or compact.
- Chokidar observes filesystem facts; it does not prove causation.
- SPEC-32 owns resource-sync projection and renderer invalidation, not durable history.
- SPEC-34 owns renderer-supplied UI action context, not file versioning or ledger storage.
- SPEC-35 owns ledger persistence, edge extraction, indexes, and validation storage.
- SPEC-36 owns provider-neutral harness/tool normalization and provider-keyed `nativeRefs`.
- SPEC-37 owns durable automation run identity and downstream automation cause propagation.
- SPEC-33 owns file version rows, snapshots/diffs, and file-version links.
- SPEC-39 owns high-frequency compaction policy for ledger/versioning subscribers.
- SPEC-38 owns saved audit queries, evidence sets, review records, and recommendations.
- SPEC-40 owns canonical schemas, validators, event family/type registration, and compatibility diagnostics.

## Cross-Spec Invariants

- `eventId` is unique canonical event/graph identity. `eventFamily` plus dotted `eventType` is canonical classification; colon strings are bus topics or transport messages.
- `eventId` is the graph node identity. Domain IDs are not aliases for `eventId`.
- `ids.rootEventId` and `ids.parentEventId` are indexed relationship fields unless a spec defines a non-causal edge for them.
- `caused_by` edges require causality evidence and remain entirely blocked until `LED-D03` approves the exact pointer/domain/confidence matrix. Time/path proximity and accepted endpoint identity alone are not direct causation.
- A UI action may use its own `uiActionId` only in its registered current-record domain field and schema-approved equal self-origin. It must not place that ID in its own `provenance.cause`, upstream relationship, or result-link fields. Downstream events use it only through accepted proof.
- An automation event keeps its own `automation.runId` in its current-record domain payload but must not put it in its own `provenance.cause` or upstream relationship fields. Downstream events use it only through accepted proof.
- Harness IDs are provider-neutral: `harnessId`, `harnessRunId`, and `harnessEventId`.
- Tool/harness IDs become downstream causes, ID-bearing origins, mirrors, or edges only through an accepted canonical tool/harness reference.
- Provider-native IDs, including OpenCode IDs, stay under provider-keyed `nativeRefs` or provider-specific payloads.
- Resource mutation paths are workspace-relative unless a field is explicitly named `absolutePath`.
- Resource mutation events require non-null `ids.workspaceId`.
- `viewRefs` and `resource:invalidate` are render-sync projections, not canonical event payloads.
- `file.version.change_batch` with `changeStorm` is the first storm-batch event shape unless a later owner decision promotes storm control to its own family.
- `ids.serverMutationId` is the server-mutation command identity for canonical resource events: SPEC-32's server branch generates/propagates it, the watcher branch prohibits it, and SPEC-34/40 validate that matrix. It is not a generic workspace/view lifecycle ID.
- Automation subtype IDs remain `AUT-D03` candidates, including in any example cause block. No common-envelope, downstream-cause, mirror, or edge registration may treat them as settled while [finding 1](provenance-schema-findings.md#1-decision-subtype-automation-cause-ids--settled-vs-candidate-contradiction) is open.
- Tool and automation captured-output metadata must not proceed as two uncoordinated vocabularies. The owner-selected unified extension contract—including whether it is one shared block and its exact name, fields, locations, presence, serialization, hashing, byte measurement, truncation, and redaction—remains jointly blocked by `TOOL-D01`, `AUT-D01`, and [finding 3](provenance-schema-findings.md#3-decision-two-vocabularies-for-captured-execution-output); neither domain may register its current parallel candidate vocabulary first.
- The relationship between normalized `resources[]` roles and domain resource buckets remains blocked by [finding 4](provenance-schema-findings.md#4-decision-three-resource-bucketing-conventions). No chat/tool sidecar bucket is canonical merely because it appears in an example.
- First-package resource events omit content hashes under `resource-metadata-v1`. File-version hashes, if approved, belong to a separately registered ULV-D10 policy; no resource hash may be copied through to bypass that boundary. Finding 5 remains open until the owner confirms the separate-policy branch or selects another branch.
- Domain `fileVersionIds` arrays are future projections only. They remain absent until the owning file-version event/relationship schema, accepted-reference binding, bounds, and registration are approved; example empty arrays do not authorize early fields.
- Compact projection aliases such as `causeIds` are never a second identity vocabulary. SPEC-40 must register their exact source-to-target mapping, presence, and redaction behavior before use.

## Current Clean Review State

Earlier per-spec reviews applied to earlier revisions. The current clean-room scope is the provenance decision batch that will later be assembled into the first orchestrator package: 32a -> 40a -> 40b1a -> 34a/34b/34c -> 32b0 -> 34d1 -> 32b/32c -> 40b1b. A clean result validates these decisions; it does not assemble, approve, or freeze a slice packet or the wider roadmap.

`AUT-D01` remains an explicit owner-decision blocker for SPEC-37 Slice 37d and later automation-result persistence. `AUT-D02` separately blocks direct file-trigger-to-resource IDs/edges until a private non-wait accepted-reference handoff and exactly-once semantics are approved. `AUT-D03` blocks any base canonical automation run/match registration, accepted ref, or emission; 37a-37b remain audit/operational-ID preparation. None blocks operational trigger execution. `ULV-D02`, `ULV-D03`, `ULV-D04`, `ULV-D05`, `ULV-D09`, `ULV-D10`, and `ULV-D12` remain explicit owner-decision blockers for their SPEC-33/SPEC-39 event-contract, metadata, snapshot, diff, restore, retention, hash, and storm-persistence slices. ULV-D12 closes the exact non-batch file-version event/envelope/lifecycle/identity/order/idempotency/failure/transaction contract. Live metadata/hash-only version rows require ULV-D03/D05/D10/D12, accepted SPEC-35b, and active 40b2d1; historical replay/backfill additionally requires accepted SPEC-40c and active 40b2d1h. Snapshots/diffs/blobs additionally require ULV-D02 and active 40b2d2; storm batches require ULV-D03/D04/D05/D10, accepted SPEC-35b, and active 40b2d3, with storm snapshot/diff references additionally requiring ULV-D02/40b2d2. Related edges require accepted SPEC-35d; historical storm edge/query support also requires accepted SPEC-40c; compaction/drop requires accepted SPEC-35f. The following D04 summary is non-exhaustive: window thresholds; global workspace/window/key/member/timer/diagnostic/reconciliation/state-byte caps; persisted array/summary/edge/row/diagnostic/byte caps; deterministic admission/coalescing/eviction/expiry/cleanup/selection/deduplication/truncation/first-last/overflow/follow-up/restart; byte measurement/cap precedence; and no source suppression, premature drop, or false attribution. The normative checklist is [SPEC-39 Detection Windows](39-change-storm-control-compaction.md#detection-windows). Those deferred slices are excluded from the future first orchestrator package and cannot be handed off until their decisions are closed; they do not block later assembly of the first Wiki/File packet. No document may describe a clean decision-batch review as orchestrator readiness.

For that automation preparation, the settled product requirement is that eventual canonical automation facts contain durable `automation.runId` and `automation.kind`; `AUT-D03` owns their exact per-kind generation ABI and subtype semantics. Slices 37a-37b are inert inventory/decision-table/fixture work only and may not add or replace a production generator, expose a new ID ABI, register/publish canonical identity, or create an accepted automation ref before D03 closes.

`RSC-D16` is an explicit owner blocker before SPEC-32e and therefore before a first Wiki packet proceeds to 32e/32f. It must approve exact watcher close-diagnostic/readiness/reconciliation watchdog milliseconds, monotonic timer/config/test ownership, boundary and generation/shutdown cancellation, and diagnostic/recovery dedupe. No implementation default is allowed. It does not block the current 32a-through-40b1b decision-batch validation, but it must close before later packet assembly/freeze can include watcher/Wiki migration.

`UEB-D01` is an explicit owner blocker before SPEC-40a/40b1a and therefore before the first Wiki/File packet can be assembled, frozen, approved, or handed to an orchestrator. It must approve exact admission/listener executor item and byte capacities, concurrency/fairness, enqueue/eviction/drop behavior, cancellation finalizers, per-task event/context/ref retained-byte and lifetime caps, never-settling isolation, and listener saturation. Byte accounting defines measured representation/encoding, object overhead, shared-ref apportionment, queued/active/cancelling ownership, charge/release points, cap precedence, and bounded cap-plus-one measurement. D01 approves bounded owner-cell initialization, global owner-cell/live-slot count/byte caps, atomic install-versus-completion/cancel/throw, nullable slot allocation, per-slot/per-producer lease caps, repeated acquisition, slot/ref/lease lifetime, and the private `AcceptedRefSlotTaskLink` representation/item/byte charge, atomic link-creation/admission-or-finalization transition, single settlement, partial-state release, leaked-cell/link/lease expiry/forced cleanup, slot-registry shutdown, restart, and fixed value-free overload/leak diagnostics. UI preflight owns no slot/link until all bounded data is ready; nullable slot failure installs/offers nothing, install after close terminalizes/releases without offer, and only a successful install reaches the fixed offer synchronously while its D01-created link alone enters task ownership. Link creation/measurement/setup failure, rejection, or overflow invokes only the internal fixed link finalizer, settles an installed slot once, terminates only provenance work, independently skips affected listener deliveries, and never backpressures or retries a source operation. No capacity/accounting/default is allowed.

`RSC-D17` is an explicit owner blocker before SPEC-32b0 token allocation/transport activation and first-package assembly. It must approve exact global/per-connection token-executor queue item/byte caps, concurrency/fairness, enqueue/eviction/drop behavior, cancellation/finalizer deadlines including abort-ignoring providers, per-job retained context/provider byte and lifetime caps, live-token binding count/byte caps and cleanup, shutdown/restart, and fixed value-free saturation diagnostics. Byte accounting defines measured job/binding representation/encoding, object/provider-wrapper overhead, shared-ref apportionment, queued/active/cancelling/live ownership, charge/release points, cap precedence, and bounded cap-plus-one measurement. Capacity failure only omits token metadata and releases bounded state; it never retries or affects init, transitions, panels, prompts, connection lifecycle, or source operations. No capacity/accounting/default is allowed.

`LED-D01` is separately quarantined for SPEC-35b/SPEC-40c payload hashing and historical ledger capabilities. It requires owner approval of deterministic serialization/canonicalization, encoding, algorithm/digest, version storage, and migration rules. It does not block the first Wiki/File packet.

`LED-D02` is quarantined for SPEC-40b2e and any canonical ledger-internal maintenance/repair/migration/audit event. It requires an exact schema/producer/redaction/bounds/ordering/failure contract or an explicit decision that no such canonical event is needed. Ordinary storage of accepted events in their original families is independent and it does not block the first Wiki/File packet.

`LED-D03` is quarantined for durable `caused_by` extraction. It must approve the exact accepted pointer/domain/confidence matrix and non-direct correlation behavior; accepted endpoint identity alone is insufficient. Indexes and approved non-causal edges remain independent, and it does not block the first Wiki/File packet.

`LED-D04` is quarantined before production Slices 35b-35d. It must approve exact table idempotency/uniqueness keys, transaction boundaries, duplicate/conflict behavior, any detached retry/defer queue with hard capacities/attempts/backoff, cancellation/shutdown/restart/replay, permanently missing targets, database nonsettlement, terminal fixed diagnostics, and tests. No inline retry or unbounded deferred work may be inferred. It does not block the first Wiki/File packet or Slice 35a inventory.

`CHAT-D01` is quarantined for SPEC-40b2a canonical chat registration and migration. It requires owner approval of exact event/phase/lifecycle schemas, identities and accepted-only relationships, optional UI cause/result bindings, redaction and failure behavior, deterministic bounds/overflow, ordering/dedupe/replay, and legacy coexistence/removal/backfill. Existing `chat:*` facts remain noncanonical and unmodified. The blocker does not affect the first Wiki/File resource/render packet.

`TOOL-D01` is quarantined for SPEC-40b2b `chat.tool.args|result` registration and corresponding SPEC-36 emission/persistence. It requires owner approval of exact args/result/outcome field names and locations, domains/normalization/encoding, redaction policy and failure-safe behavior, byte/truncation semantics, exit/signal/provider-error normalization, complete phase/outcome presence, external-artifact meaning, bounds, and failure behavior. SPEC-36a evidence gathering and preparatory harness identity/native-ref work may proceed; the blocker does not affect the first Wiki/File packet.

`TOOL-D02` is quarantined for canonical harness identity and `chat.tool.started` registration/activation. It requires owner approval of exact phases/lifecycle, ID ownership, actor/provenance, native-ref redaction/failure behavior, bounds, ordering/dedupe/replay/reconnect/cancel, relationships, and fail-open tests. SPEC-36a-36c remain inert; the blocker does not affect the first Wiki/File packet.

`AUD-D01` is quarantined for SPEC-40b2f audit-domain registration and SPEC-38 Slices 38b-38f. It requires owner approval of exact query/review/recommendation/ticket schemas and ownership, event/phase/outcome branches, typed/redacted filters, confidence, failure/incomplete semantics, accepted evidence, deterministic capacity/overflow/pagination policy, and redaction/failure-safe behavior. SPEC-38a evidence gathering may proceed; the blocker does not affect the first Wiki/File packet.

After this decision batch is clean, `UEB-D01` and `RSC-D17` still require owner approval and propagation before the future first-package packet may be assembled. The packet then requires packet-scoped back-validation, freeze, and owner approval before any orchestrator handoff.
