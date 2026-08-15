# Provenance Implementation Master Plan

Status: DISCUSSION DRAFT

Schema correction authority: [2026-07-15 provenance cross-article findings](provenance-schema-findings.md) plus owner direction in chat on 2026-07-15. Apply mechanical corrections, optimize for one composable schema of reusable shared blocks and registered extensions, and retain every unresolved product choice in that issue log rather than inferring it.

## Handoff Note

Current state:

- Earlier revisions passed local and independent alignment review. The current fail-open metadata decision batch requires a new clean back-validation before release.
- The recommended first implementation target remains SPEC-40 minimal validation/diagnostics plus SPEC-32 canonical resource sync for Wiki and File Viewer.

Owner decisions and grounded contracts now closed for the first implementation target:

- The first UI action adapter pair is Wiki and File Viewer. Capture, Office, Email, and remaining adapters stay deferred until the first pair is proven.
- `RSC-D12a` is closed for Wiki and File Viewer by the exact mapping tables in SPEC-34 and the two UI-context wiki child pages.
- Connection/client/receiver identifiers remain server-owned transport/routing state. They are not first-slice canonical or ledger fields, authorization, stable identity, or causality. Future multi-client work may approve server-stamped metadata without making interaction depend on it.
- Wiki and File Viewer currently expose no direct durable file-edit commands. Their first migrated durable UI-origin path is `chat.send_with_resource` when either is the active panel and the prompt sender consumes at least one valid pending resource attachment from any panel. Active context is captured at actual send time; each attachment remains a subject resource and its staging origin does not choose the adapter.
- Provenance validates separately from the operation. Missing attribution or enrichment degrades to unknown/omitted/diagnostic state. On the renderer, optional synchronous context capture may occur only inside SPEC-34's catch-all degradation boundary after the operational prompt/attachment baseline is fixed and is limited to 32 subjects, 512 charged pure steps, 16,384 output bytes, dual 4,096-code-unit/UTF-8-byte caps for every path/root/intermediate, dual 256 outer computational caps for IDs, dual 512 caps for names/extensions, and cap-plus-one scans before any path/string work. `clientCommandId` has a narrower exact semantic maximum of 128; wrong-format or 129-256 optional correlation is omitted, while above-256 exhausts capture. Renderer capture performs no I/O, await/thenable, entropy, dynamic import, provider/filesystem access, user/plugin callback, or unbounded traversal. Any other capture, diagnostic, bound, or enriched-serialization failure sends the byte-equivalent baseline exactly once. The untrusted server seed is separately extracted only after the operational path starts by the fixed-schema nonrecursive SPEC-34 extractor: depth 4, 207 charged own-data property reads including message/array length/index descriptors, 170 scalars, 32 subjects, exactly enumerated 1,034 steps, and 16,384 output bytes. Each private subject carries its strictly increasing original operational attachment index, which is stripped before canonical construction. Operational target evidence is direct-read only at those positions from the already-required validated attachment vector and becomes at most 32 closed five-field plain-data copies under separate 129-property/160-scalar/exact 901-step/16,384-byte caps. No map/key scheme, scan, attachment/vector entry, caller callback, command capability, or operation graph is retained. Failure omits UI provenance without changing the prompt. This no-delay contract forbids waiting/external/unbounded work; it does not prohibit the explicitly capped pure instructions required to attach/copy already-memory-resident metadata. Workspace token entropy is detached and notifications never wait for it. On the server, the operational command path starts before initiating provenance is submitted to the supervised executor. After that start, only the exact bounded seed/target copies and 24-step synchronous workspace binder may run; no general or async binding, construction, redaction, validation, admission, or accepted-ref promise is invoked or awaited. A bounded private owner cell is closed from command `finally`, atomically preventing installation after fast completion/cancel/throw; initialization failure disables only provenance. All three data values complete before slot/link allocation; preflight failure owns no slot/link. The opaque command ref/token are then discarded. Nullable slot allocation failure installs/offers nothing; a non-null slot installs only if the owner cell remains open, otherwise it terminalizes/releases immediately. A successful install calls the module-private fixed offer in the same non-yielding turn. D01's task data plane receives only the three bounded plain-data inputs; its sole queued control-plane value is one private, nonserializable, D01-accounted `AcceptedRefSlotTaskLink` that can settle only that task's slot. Only the link enters task ownership. D01 charges/releases all cell/data/link/partial state, terminalizes an installed slot once on setup/rejection/cancellation, and accepts no caller runnable, callback, or finalizer. Downstream proof failure atomically omits its relationship group while the safe base fact proceeds. Optional enrichment is used only when already available; ledger, versioning, compaction, audit, and other subscribers never hold operations open. Only operational authorization, target resolution, path safety, provider protocol, command validity, baseline serialization, and transport delivery may fail the source command; provenance cannot.
- In that summary, server "seed" work is preflight only. The extractor's frozen result separates the transient workspace token from a recursively readonly token-free `UiActionQueuedEnvelope`. Binding/target preflight consumes and drops the extraction wrapper/token before slot allocation and passes the same already-created envelope object without another copy. The exact three queued UI data values are that token-free envelope, target copies, and bound context; type/ABI and reachability tests forbid the token or extraction wrapper in queued, active, or cancelling task state.

Remaining pre-orchestrator work for the first package includes two open product decisions, `UEB-D01` and `RSC-D17`, plus document/execution packaging. After both are owner-approved and propagated, stage the exact order 32a -> 40a -> 40b1a -> 34a/34b/34c -> 32b0 -> 34d1 -> 32b/32c -> 40b1b, add per-slice worker validation/smoke packets, back-validate that scoped package, freeze its release candidate, and obtain owner approval for that candidate ID. No packet assembly or slice handoff may infer either decision's defaults. This does not make 34d2 or later SPEC-33/37d/39 slices orchestrator-ready.

`UEB-D01` is an owner-decision blocker before 40a/40b1a: approve exact admission/listener executor item/byte capacities, concurrency/fairness, enqueue/eviction/drop behavior, cancellation finalizers, per-task event/context/ref retained-byte and lifetime caps, never-settling isolation, and listener saturation. Byte accounting must define measured representation/encoding, object overhead, shared-ref apportionment, queued/active/cancelling ownership, charge/release points, cap precedence, and bounded cap-plus-one measurement. Approve bounded owner-cell initialization, global owner-cell/live-slot count/byte caps, atomic install-versus-completion/cancel/throw, nullable slot allocation, per-slot/per-producer lease caps, repeated acquisition, slot/ref/lease lifetime, and the private `AcceptedRefSlotTaskLink` representation/item/byte charge, atomic link-creation/admission-or-finalization transition, single-settlement rule, partial-state release, leaked-cell/link/lease expiry/forced cleanup, slot-registry shutdown, restart, and fixed overload/leak diagnostics. UI preflight owns no slot/link until all bounded data is ready; nullable slot failure installs/offers nothing, install after close terminalizes/releases without offer, and only a successful install reaches the fixed offer synchronously while its D01-created link alone enters task ownership. Setup failure/rejection/overflow internally finalizes an installed slot exactly once, terminates only provenance work, independently skips saturated listeners, and never backpressures/retries a source operation. No capacity/accounting/default may be inferred.

Keep `AUT-D01` open until SPEC-37 Slice 37d planning: define script result-domain and branch semantics, field presence, failure material, async/timeout behavior, and `lifecycle.status` mappings before implementation. Jointly settle the owner-selected unified extension contract with `TOOL-D01` and provenance finding 3—including whether it is one shared block and its serialization, hashing, byte measurement, truncation, and redaction semantics—rather than independently registering automation-only field names.

Keep `AUT-D02` open before any file-trigger automation fact claims a direct matched-resource ID or edge. It must define a private accepted-resource handoff from the independently admitted watcher observation, non-wait task ordering, lifetime, pointer/selector, multi-match and rename behavior, dedupe, late/missing/rejected/cancel/restart branches, and exactly-once execution tests. The operational trigger always proceeds; after AUT-D03 separately approves a base canonical automation run, that fact may proceed while still omitting D02-blocked resource relationships.

Keep `AUT-D03` open before SPEC-40b2c registers or SPEC-37c emits a base automation run/match fact, and before any new production run-ID generator/ABI is added. The settled requirement is that eventual canonical automation facts contain durable `automation.runId` and `automation.kind`; D03 must approve their per-kind generation owner/timing/format/handoff plus exact event/phase/lifecycle presence, subtype identity ownership/equality/presence, actor/provenance/context, sensitivity/redaction and failure branch, deterministic bounds/overflow, ordering/dedupe/replay/restart/cancel behavior, and fail-open tests. Slices 37a-37b may only inventory existing operational IDs and prepare inert decision tables/ABI fixtures/tests; they cannot add/replace a generator, expose a new ID ABI, publish canonical automation, or expose accepted refs.

Keep `RSC-D16` open before SPEC-32e watcher lifecycle implementation. The owner must approve exact positive millisecond watchdogs for old-watcher close diagnostics, current-generation readiness, and reconciliation; monotonic timer/config/test ownership; boundary/cancellation/shutdown semantics; and diagnostic/recovery dedupe. No timeout may gate the workspace FIFO or provenance. Ready/reconciliation expiry enters `degraded_recovery_pending` and issues exactly one current-generation freshness recovery; close expiry is cleanup diagnostic only. This blocker must close before the first Wiki migration packet can include 32e/32f.

Keep `RSC-D17` open before SPEC-32b0 token allocation/transport activation and first-package assembly. Approve exact global/per-connection token-executor queue item/byte caps, concurrency/fairness, enqueue/eviction/drop behavior, cancellation/finalizer deadlines including abort-ignoring providers, per-job retained context/provider byte and lifetime caps, live-token binding count/byte caps and cleanup, shutdown/restart, and fixed value-free saturation diagnostics. Byte accounting must define measured job/binding representation/encoding, object/provider-wrapper overhead, shared-ref apportionment, queued/active/cancelling/live ownership, charge/release points, cap precedence, and bounded cap-plus-one measurement. Capacity failure only omits token metadata and releases bounded state; it never retries or affects init, transitions, panels, prompts, connection lifecycle, or source operations. No capacity/accounting/default may be inferred.

Do not block the first resource/render sync work on later versioning decisions. Defer `ULV-D02`, `ULV-D03`, `ULV-D04`, `ULV-D05`, `ULV-D09`, `ULV-D10`, and `ULV-D12` until SPEC-33/SPEC-39 implementation planning begins. The following D04 summary is non-exhaustive: detection windows; global workspace/window/key/member/timer/diagnostic/reconciliation/in-memory capacities; persisted summary/edge/row/diagnostic/serialized-byte capacities; deterministic admission/coalescing/eviction/expiry/cleanup/selection/deduplication/truncation/first-last/overflow/follow-up/restart semantics; byte measurement and cap precedence; and proof that pressure cannot suppress source facts, prematurely drop artifacts, or create false attribution. The normative complete checklist is [SPEC-39 Detection Windows](39-change-storm-control-compaction.md#detection-windows). `ULV-D12` must settle the exact non-batch file-version event/envelope/lifecycle/identity/order/idempotency/failure/transaction contract before 40b2d1.

`LED-D01` remains an owner-decision blocker for SPEC-35b/SPEC-40c historical ledger capability work: approve deterministic payload canonicalization/serialization, byte encoding, hash algorithm, digest representation, hash policy/version storage, and migration/reverification rules. It does not block SPEC-40a/40b1a or the first Wiki/File resource/render package.

`LED-D02` separately blocks SPEC-40b2e and every canonical `eventFamily: 'ledger'` producer: approve whether ledger-internal events are needed and their exact types/phases/lifecycle, producer/identity ownership, row-key boundary, relationships, redaction/failure branch, bounds, ordering/dedupe/replay/migration, and fail-open tests. Ordinary SPEC-35 storage of other accepted event families does not depend on D02.

`LED-D03` blocks every durable `caused_by` edge until the owner approves the exact event-type/pointer/domain and confidence matrix, consistency validation, non-direct correlation handling, duplicates/conflicts, and tests. Accepted endpoint proof is required but does not itself prove causality. SPEC-35 indexes and approved non-causal edges may proceed without D03.

`LED-D04` blocks production Slices 35b-35d until the owner approves exact per-table natural/idempotency keys and unique constraints; event/child transaction boundaries; duplicate/conflict behavior; detached retry/defer existence, capacities, attempts, backoff, cancellation, shutdown/restart/replay, and permanently missing targets; database nonsettlement; terminal fixed diagnostics; and failure-isolation tests. No inline retry or unbounded deferred work is allowed. Slice 35a inventory may proceed.

`CHAT-D01` remains an owner-decision blocker for SPEC-40b2a canonical chat registration and migration: approve exact event types and phase/lifecycle presence matrix; IDs, payloads, mirrors, current-record identities, and accepted-only relationships; optional UI cause/result bindings; redaction policy/version and sensitive prompt/content/attachment/native-ref handling; failure-safe-core versus no-event behavior; deterministic field/array/serialized-byte bounds and overflow forms; ordering/dedupe/replay/idempotence; and legacy coexistence/removal/backfill. It must also settle finding 4's `chatResources` relationship to normalized `resources[]` and finding 8's derivation-versus-redaction-survival rule for `chat.hasToolCalls`. Existing `chat:*` facts remain noncanonical and unmodified until it closes. It does not block the first Wiki/File resource/render package.

`TOOL-D01` remains an owner-decision blocker for SPEC-40b2b `chat.tool.args|result` registration and corresponding SPEC-36 persistence: with AUT-D01 and finding 3, approve the owner-selected unified captured-output extension contract and the exact tool args/result/outcome mapping; approve domain normalization/encoding, redaction/failure-safe behavior, hash/byte/truncation semantics, exit/signal/provider-error normalization, full phase/outcome presence, external-storage meaning, bounds, and unavailable/partial/failure behavior. Finding 4 separately blocks `toolResources` registration until its relationship to normalized `resources[]` is settled. It does not block SPEC-36a audit, preparatory harness identity/native-ref work, or the first Wiki/File package.

`TOOL-D02` separately blocks canonical harness identity and `chat.tool.started` registration/activation: approve exact event/phase/lifecycle presence, ID ownership, actor/provenance, native-ref redaction policy/failure branch, bounds/overflow, ordering/dedupe/replay/reconnect/cancel behavior, accepted-only relationships, and fail-open tests. Slices 36a-36c remain inert evidence/helpers until it closes. It does not block the first Wiki/File package.

`AUD-D01` remains an owner-decision blocker for SPEC-40b2f audit registration and SPEC-38b-38f: approve exact query/review/recommendation/ticket schemas and domain ownership, branch/presence matrices, typed/redacted filters, confidence and incomplete/failure semantics, accepted evidence rules, hard result/summary/traversal/byte bounds with overflow/pagination, and redaction/failure-safe behavior. It does not block SPEC-38a evidence gathering or the first Wiki/File package.

## Mandatory Decision And Slice Protocol

This protocol applies to every owner decision added to a SPEC and every implementation slice handed to another session. It has two distinct stages: the planning session removes ambiguity and obtains required owner approvals before handoff; after that gate is clean, implementation sessions execute the approved intent without reopening it. A slice is not ready merely because its prose exists, and a slice is not complete merely because its first implementation passes one test run.

### Decision Settlement Loop

When an owner decision is made:

1. Update the affected SPEC decision row, contract text, examples, slice prerequisites, tests, and this master plan where sequencing or scope changes.
2. Give an independent review sub-agent every changed document, the affected SPECs, the relevant wiki pages, and the active code paths. This includes this master plan whenever sequencing or scope changes. For automation decisions, the required wiki authority includes [Automation Run Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md).
3. Require the reviewer to report contradictions, unclear language, undefined terms or values, uncovered branches, untestable requirements, cross-SPEC drift, wiki drift, and implementation assumptions presented as settled design.
4. Require every finding to identify its authority: owner decision, SPEC contract, wiki contract, active code constraint, or an explicitly labeled proposal. A schema or behavior already defined intentionally and consistently by the SPEC, wiki, and code is grounded design, not an unresolved assumption. Existing code alone does not override an owner or wiki contract; a deviation must be called out and remedied in the SPEC, wiki, or implementation plan.
5. Resolve the findings in the documents, then rerun independent review. Continue until the review report has no unresolved in-scope findings.
6. The primary planning session must inspect the documents and evidence itself, identify every issue that needs explicit owner approval, and obtain that approval before marking the decision settled. It is the final pre-handoff filter. A sub-agent's clean report is evidence, not a substitute for primary review or owner approval.

Before the clean pre-handoff gate, if intent cannot be established from an owner decision, the SPEC set, or the wiki, leave the item open and ask the owner. A claimed higher-level system necessity is grounded only when the reviewer cites the concrete SPEC, wiki, and active-code invariants from which it follows and shows that no alternative design branch remains; otherwise it is a proposal requiring owner approval. Do not silently choose a branch and describe it as decided.

Once the primary planning session has back-validated the affected documents, reported them clean, and the owner passes the SPEC for implementation, the approved SPEC and its relevant wiki pages are the authoritative expression of intent. Implementation agents must not second-guess, reinterpret, or reopen that intent because the current code differs or another design seems preferable. They may stop and report a blocker only when the approved authorities contradict each other, a required value or branch is still genuinely undefined, or the contract cannot be implemented in the active architecture. Such a blocker returns to the decision settlement loop; it is not permission to invent a new contract.

### Slice Handoff Contract

Whenever the owner asks to "pass a slice," provide a self-contained implementation prompt, not only a pointer to a SPEC section. Every slice prompt must include the slice scope, authoritative files, prerequisites and closed decisions, non-goals, required behavior, acceptance criteria, exact automated verification commands where applicable, exact runtime/manual evidence where applicable, expected report contents, and the following execution loop. Either verification category may be marked `N/A` only with a concrete justification in the prompt and final report.

1. The orchestrator reads the slice, linked SPEC/wiki authorities, repository guidance, and affected active code before delegating implementation. Approved intent is not reopened.
2. The orchestrator delegates one bounded slice to one implementation worker. The worker must not spawn sub-agents, start external reviewer processes, or invoke `$clean-room-loop`.
3. The worker implements the slice, self-reviews its files/diff/integration points against every acceptance criterion, runs the exact validation, smoke, runtime, and manual checks from the packet, repairs its own findings, and repeats affected checks until ready.
4. The worker returns `READY_FOR_ORCHESTRATOR_REVIEW` with changed files, behavior summary, acceptance mapping, self-review findings/repairs/final assessment, exact commands/results, runtime evidence, temporary adapters, skipped checks, residual risks, and justified `N/A` entries. A blocked worker returns the same complete report with exact blocker evidence.
5. The orchestrator independently inspects and retests the result. It fixes bounded issues itself or returns significant rebuilds to the worker for a new self-review/validation/smoke report.
6. When the orchestrator believes the slice is an acceptance candidate, it invokes `$clean-room-loop` on its own evaluation and the current work product. It advances only when its own first-principles check, the newest fresh reviewer, and all required checks are clean on the exact final revision.

### Clean Report Gate

"Clean" means all of the following:

- No unresolved in-scope correctness, contradiction, ambiguity, undefined-value, uncovered-branch, regression, security, data-integrity, or test findings remain.
- Required automated tests pass, and required runtime/manual event-flow checks have recorded pass/fail evidence. A category with no applicable check is explicitly recorded as `N/A` with justification.
- The implementation matches the slice's approved SPEC and wiki contracts. A proposed deviation returns to the decision settlement loop for explicit owner approval and corresponding document updates before implementation proceeds.
- Temporary adapters, compatibility paths, skipped checks, and follow-up work are named with ownership and removal criteria; none is hidden behind a clean result.
- Reports identify the files reviewed, commands/checks run, results, and residual risks. "No findings" without review and test evidence is not a clean report.

A blocked dependency, unresolved owner choice, unavailable required environment, or failing required test prevents the affected slice and its dependent slices from progressing. Record it as a blocker rather than weakening the gate. Unrelated work may continue only when it is explicitly allowed by this plan's safe parallel-work rules.

## Purpose

This document turns the provenance SPEC set into an implementation sequence. It is the execution map for wiring resource/render sync, UI action provenance, ledger storage, harness/tool attribution, automation attribution, file versioning, storm control, and audit/query workflows without creating parallel event paths.

Use this plan before starting implementation slices from:

- [SPEC-32 - Resource Event Sync Controller](32-resource-event-sync-controller.md)
- [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md)
- [SPEC-34 - UI Action Provenance Module](34-ui-action-provenance-module.md)
- [SPEC-35 - Universal Ledger Storage, Edges, and Indexes](35-universal-ledger-storage-edges-indexes.md)
- [SPEC-36 - Harness, Tool, and Native Reference Provenance](36-harness-tool-native-ref-provenance.md)
- [SPEC-37 - Automation, Trigger, Scheduler, Script, and Agent Provenance](37-automation-trigger-scheduler-provenance.md)
- [SPEC-38 - Audit Query and Review Provenance Loops](38-audit-query-review-provenance-loops.md)
- [SPEC-39 - Change Storm Control and Compaction](39-change-storm-control-compaction.md)
- [SPEC-40 - Provenance Schema Registry and Event Validation](40-provenance-schema-registry-validation.md)

## Implementation Rule

Every slice must do exactly one of these jobs:

- Produce canonical events.
- Validate canonical candidates and diagnose rejected records without gating source operations.
- Subscribe to canonical events and project/persist/compact them.
- Migrate an old path into the canonical model.

No slice should create a second long-lived event language, watcher path, cache invalidation path, ledger writer, or versioning pipeline.

## Capability Groups

The numbered sections below are thematic capability/dependency groupings, not a sequential implementation order. They may describe later capabilities before an earlier-numbered group is executed. The sole slice execution order is the exact sequence in [SPEC Set Map - Implementation Order](00-provenance-spec-set-map.md#implementation-order), repeated for the first target below. Packet builders and orchestrators must not derive order from capability-group numbers.

## Capability Group 0 - Preflight Audit

Related slices: Slice 32a, Slice 35a, Slice 36a, Slice 37a, Slice 38a.

Goals:

- Inventory current event producers, WebSocket messages, watcher paths, trigger paths, ledger writes, harness/tool event records, automation paths, and query helpers.
- Confirm whether `file_changed` / `file:changed` exist only as runtime compatibility messages or also in durable storage.
- Capture baseline behavior for Wiki and File Viewer refresh, including app refresh, workspace switch, active page changes, external file edits, UI saves, and watcher-observed mutations.
- Record current tests and manual event-flow evidence.

Exit criteria:

- Known producers and subscribers are listed.
- Legacy paths have removal or migration targets.
- Runtime proof artifacts exist for the current behavior.
- A static document check rejects the regex `\bPhase [0-9]+\b` in this master plan so capability-group terminology cannot recreate a competing execution order.

Do not:

- Change runtime event behavior.
- Add ledger schema.
- Add version tables.

## Capability Group 1 - Validation Foundation

Related spec: SPEC-40.

Goals:

- Implement the schema registry skeleton.
- Register common envelope fields, event families, event types, shared enums, and edge vocabulary.
- Add validation severity: `error`, `warn`, `info`.
- Add a validated-or-diagnosed publisher path that never becomes command authorization.
- Add `prepareCanonicalCandidate` as the sole ref-consuming accepted-relationship builder with private pointer/ref proof. Canonical UEB publication accepts only that opaque candidate, clones/deep-freezes the safe event, binds its identity to an opaque ref, freezes one `{ acceptedRef }` context, and, after `UEB-D01` closes, offers exact `listener(frozenEvent, deliveryContext)` tasks to the D01-bounded executor; every admitted delivery uses that ABI and a saturated delivery takes only D01's independent skip/finalizer branch. Bare-ref argument two is invalid. `inspectAcceptedRef` strings are inspection only and cannot prove a candidate relationship; identity-sensitive consumers use `assertAcceptedDelivery`. Missing/duplicate/wrong-pointer, raw-copy, mismatch, forgery, stale, unregistered, or wrong-workspace proof atomically omits its registered relationship group with fixed code-only diagnostics while the relationship-free safe fact remains admissible. Test exact ABI/context identity, every omission branch, unrelated whole-candidate failure, suppression, saturation isolation, async context, and concurrent roots.
- Ensure side-effect subscribers consume only accepted canonical events.

Minimum registrations for early slices:

- Resource mutation events.
- Workspace/view/theme lifecycle events touched by resource sync.
- UI action events and command-envelope validation touched by the Wiki/File Viewer adapter pair.
- Ledger-internal registrations only when SPEC-35 begins; they are not part of the first resource/render target.

Exit criteria:

- Invalid candidates are withheld from canonical-only subscribers and diagnosed without failing the source operation; missing optional attribution/enrichment degrades explicitly.
- Diagnostics show event ID, family/type, producer, severity, and replacement guidance for legacy field names.

Do not:

- Treat validation as ledger-ingestion-only.
- Let resource sync subscribe directly to unvalidated canonical candidates.

## Capability Group 2 - Canonical Resource And Render Sync

Related slices: Slice 32b through Slice 32c.

Goals:

- Implement canonical resource and minimal lifecycle event contracts.
- Implement resource event enrichment with before/after-capable state and explicit unavailable/omission reasons.
- Implement central resource policy for the first views: `file-viewer` and `wiki-viewer`.
- Implement `viewRefs` as a projection, not canonical event identity.
- Implement `resource:invalidate` renderer messages.
- Implement non-canonical `resource:refresh_required` recovery after either a valid mutation or safely established watcher observation when candidate rejection, publisher throw, acknowledged UEB suppression, or projection failure occurs, plus reconnect rewarm.
- Implement non-canonical `lifecycle:refresh_required` recovery for workspace (including null), view-registry, and theme failures, with dirty-buffer detachment/rewarm protections.
- Implement or wrap a central `resourceStore` facade over existing resource/file state.

Exit criteria:

- Wiki and File Viewer can receive targeted invalidation through the central resource path.
- Renderer cache invalidation uses transport type `resource:invalidate`, never a canonical topic/event type as the transport message. The server-to-renderer derived projection may carry canonical `eventId`, selected `ids`, cause/origin, and context for dedupe, traceability, and cache correlation; those fields are output-only metadata, not renderer authority, and the renderer never echoes them into a command or canonical candidate.
- Resource mutations are never workspace-null.
- Legacy `file_changed` client invalidation remains only behind a named temporary adapter with removal criteria.
- Inject publisher and mapper failures and prove the mutation/lifecycle operation remains successful. Clean warm/visible entries refetch through the matching `FreshnessRecoveryMessage`; dirty/optimistic entries preserve local content, flags, pending operations, undo, and scroll, store remote data only in `recoveryRemote`, and remain `conflict_pending`. Null-workspace recovery detaches dirty buffers. Assert the forbidden workspace-root resolver is never called.

Do not:

- Implement file version storage.
- Persist snapshots/diffs.
- Build audit traversal.
- Add private per-view watcher listeners.

## Capability Group 3 - Normalize Server, Watcher, And Trigger Producers

Related slices: Slice 32d through Slice 32e.

Goals:

- Convert server file/resource mutation producers to canonical resource events.
- Convert watcher-observed filesystem facts into canonical resource events with honest attribution.
- Preserve the one fail-open workspace-watcher TRIGGERS.md file-change matcher; mutation handlers do not add a second matcher, and canonical resource/automation publication observes or correlates it independently without authorizing execution.
- Remove or contain direct `file_changed` / `file:changed` usage.
- Preserve parent, sibling, path, token, before/after, and resource metadata needed by subscribers.

Exit criteria:

- Resource/render sync, metadata collectors, and future ledger/versioning consume accepted canonical events. Operational file-change triggers consume the established watcher observation before provenance projection, with optional accepted refs used only when already available.
- Watcher-origin events do not claim UI, assistant, trigger, scheduler, script, or harness causality without evidence.
- Temporary adapters have documented removal dates or slice gates.

Do not:

- Infer causality from path/time alone.
- Add a second trigger execution path or make trigger execution await/depend on provenance admission.

## Capability Group 4 - UI Action Provenance

Related spec: SPEC-34, plus SPEC-32 `RSC-D12a`.

Goals:

- Audit UI mutation entry points.
- Build the central UI action module.
- Generate durable `uiActionId` on the accepting server and preserve optional renderer `clientCommandId` for correlation.
- Capture best-effort renderer view/panel/route/tab/document/resource context without accepting event/domain relationship IDs; canonical workspace/thread/cause/resource IDs come from server state and accepted references.
- Keep transient connection/client/receiver identifiers out of first-slice renderer envelopes, canonical events, and ledger provenance.
- Add per-view adapter mappings before converting a view's UI-origin mutations.
- Server creates a `ui.action` candidate, routes it through validation/diagnostics, and emits accepted events on UEB without making the source command depend on provenance success.
- Downstream events carry `provenance.cause.uiActionId` only after the upstream UI action was accepted; failure paths omit all references to the rejected/unpublished ID.

Recommended order:

1. Wiki adapter.
2. File Viewer adapter.
3. Capture adapter.
4. Office adapter.
5. Email adapter.
6. Remaining view adapters.

Known adapter blockers:

- Office must classify `office:thumbnail_save` as UI-derived autosave or system preview generation before wiring provenance.
- Send-to-chat must account for the `dispatchChatAction` bridge and the server `prompt` path into `acceptPromptThroughRuntime`.
- A view adapter must name its authoritative or nullable selectors, but missing optional context must degrade rather than block interaction.

Exit criteria:

- Every migrated UI-origin command path has documented selectors/stores.
- UI action events do not self-reference `uiActionId` in `provenance.cause`.
- Workspace identity/root comes from the coordinator-captured command context or an explicit authorized workspace argument; other server-owned operational facts use their named owner. Session workspace/root and renderer stores are caches/evidence only, and absent metadata remains unavailable rather than being guessed.

Do not:

- Treat React keys, tab IDs, view IDs, or numeric `clientMutationId` values as provenance IDs.
- Claim UI-origin for watcher events without a known `uiActionId`.

## Capability Group 5 - View Migration And Render Freshness

Related slices: Slice 32f through Slice 32g, Slice 34e.

Goals:

- Migrate Wiki to central resource cache and incremental invalidation.
- Preserve active page, selected tab, navigation history, and scroll state unless the active resource disappears.
- Apply Wiki `PAGE.md` body/frontmatter classification rules.
- Migrate remaining views to central resource requests and invalidation.

Exit criteria:

- Wiki no longer reloads the whole view for ordinary content changes.
- File Viewer invalidates nearest affected parent folder, not blindly the repo root for nested changes.
- Capture, Office, Email, Agents, Tickets, and System views have either migrated handling or explicit remaining gaps.

Do not:

- Patch DOM manually for freshness.
- Let each view keep a private file-change routing model.

## Capability Group 6 - Ledger Storage Foundation

Related spec: SPEC-35.

Prerequisite: close `LED-D01` and `LED-D04` before Slice 35b; close LED-D01 before SPEC-40c implements payload hashing or `AcceptedLedgerRowRef`. LED-D04 also gates production 35c/35d projection/edge writes. Slice 35a inventory may proceed without either.

Goals:

- Add canonical event storage.
- Preserve original `eventFamily` and `eventType`.
- Store validation status and warnings.
- Persist one of three exact branches: ordinary validated safe payload unchanged with the LED-D01-approved non-null hash and possible historical proof; exact admitted registered UI failure-safe-core unchanged with null hash and no historical-proof capability; or ledger-only defensive fallback with null hash, no unsafe material, and no historical-proof capability. Never call the fallback a canonical safe core. `loadAcceptedLedgerRowRef` rejects every null-hash row.
- Add resource projections, native ref projections, and graph edge storage.
- Add indexes for workspace, resource/path, event family/type, thread, turn, tool call, UI action, harness ID/run/event, automation run, audit query, correlation ID, causation ID, root/parent event ID, edge endpoints, timestamp range, and `changeStorm.reason` when present. Trigger/script/scheduler/agent subtype indexes exist only if `AUT-D03` approves those fields and selectors.

Exit criteria:

- Canonical events can be persisted without wrapping them as ledger events.
- `eventFamily: 'ledger'` is used only for ledger-internal maintenance, repair, migration, or audit events.
- Edge direction follows the shared convention.
- Ledger redaction failure and storage unavailability are failure-injected and proven isolated from source operations.

Do not:

- Turn provider-native IDs into first-class canonical ledger columns.
- Store file snapshots or diffs in this phase.

## Capability Group 7 - Harness, Tool, And Automation Attribution

Related specs: SPEC-36 and SPEC-37.

Goals:

- Normalize `harnessId`, `harnessRunId`, and `harnessEventId`.
- Preserve provider-native OpenCode IDs under provider-keyed `nativeRefs` or provider-specific payloads.
- After owner-approved/back-validated `AUT-D03`, implement its exact ABI for the settled canonical `automation.runId` and `automation.kind` requirements.
- Add trigger, scheduler, script, sync/import, agent, and system automation event shapes.
- Propagate downstream cause IDs only through SPEC-40 accepted references.
- Create ledger edges for accepted tool, harness, automation, and resource relationships; defer/diagnose unavailable ledger targets.

Exit criteria:

- Assistant/tool-caused mutations can be distinguished from harness/system/agent/external mutations.
- Automation/tool/harness-caused mutations use ID-bearing origin/cause/subtype fields only from accepted upstream references.
- Inject upstream normalization/validation/publication failure and prove execution continues while rejected/unpublished IDs remain absent from downstream origin, causes, mirrors, native projections, and edges.
- Tool output persistence remains subject to redaction/hash policy before broad durable content capture.
- `chat.tool.args|result` schemas are not registration-ready until `TOOL-D01` closes; Capability Group 7 may complete only the selected preparatory/audit/identity/native-ref scope while that blocker remains.

Do not:

- Add `openCodeRunId`, `openCodeEventId`, or `openCodeSessionId` as canonical ledger columns.
- Add `actor.type = 'harness'`.
- Add `provenance.origin.type = 'openCode'`.

## Capability Group 8 - File Versioning

Related spec: SPEC-33.

Prerequisites:

- SPEC-32 canonical resource events are stable.
- Accepted SPEC-35b canonical storage exists; accepted SPEC-35d additionally precedes `versioned_as` or other version edges.
- SPEC-40 validation/diagnostics exists for resource events without entering the mutation success path.
- ULV-D12 and all persistence-level-specific ULV blockers are owner-approved/back-validated.
- The matching branchwise registry packet is active before subscriber emission: live-ref-only 40b2d1 for metadata/hash-only rows, then 40b2d2 for snapshots/diffs/blobs. Historical replay/backfill is excluded until accepted SPEC-40c and 40b2d1h.

Goals:

- Add file-version records as a subscriber over canonical resource events.
- Link versions to source resource mutation events.
- Use versioning subscriber as `provenance.source` and `provenance.observedBy`.
- Bind the source resource event's own domain ID, parent event ID, and correlation. Preserve only safe non-ID context/type/confidence directly; traverse through the resource event for embedded upstream attribution unless each original ref/capability is separately held and bound.
- Add `versioned_as` edges only after SPEC-35d is accepted.

First safe slice:

- Live metadata/hash-only version records for eligible files only after ULV-D03, ULV-D05, ULV-D10, and ULV-D12 close, SPEC-35b is accepted, and 40b2d1 is active. Historical replay/backfill additionally requires accepted SPEC-40c, a D12-approved historical branch, and active 40b2d1h.

Blocked until decisions:

- Snapshot/diff/blob persistence: ULV-D02, ULV-D03, ULV-D05, ULV-D10, ULV-D12, accepted SPEC-35b, and active 40b2d2; related edges also require accepted SPEC-35d.
- Restore behavior: ULV-D09.
- Storm persistence: ULV-D03, ULV-D04, ULV-D05, ULV-D10, accepted SPEC-35b, and active 40b2d3; storm snapshot/diff references additionally require ULV-D02 and active 40b2d2. Storm edges additionally require accepted SPEC-35d, and compaction/drop additionally requires accepted SPEC-35f.

Do not:

- Create a second watcher.
- Use Git as the versioning source of truth.
- Wholesale-copy source event provenance.

## Capability Group 9 - Storm Control

Related spec: SPEC-39.

Prerequisites:

- SPEC-33 versioning subscriber exists.
- ULV-D03, ULV-D04, ULV-D05, and ULV-D10 are owner-approved/back-validated; storm snapshot/diff references additionally require ULV-D02.
- SPEC-35b storage and 40b2d3 storm registration are accepted before storm emission; SPEC-35d and SPEC-40c are accepted before 39d storm edge/query support; SPEC-35f is accepted before compaction or artifact drop.
- `LED-D03` is owner-approved/back-validated before this phase writes any `caused_by` edge; otherwise that edge branch remains absent while approved non-causal storm edges proceed.

Goals:

- Add storm windowing to ledger/versioning subscribers.
- Persist `eventFamily: 'file.version'`, `eventType: 'file.version.change_batch'` records with `changeStorm`.
- Preserve `causeSummary` for mixed confidence, mixed cause, and mixed actor storms.
- Add `compacts` and `represents` edges. Add `caused_by` only through the exact approved `LED-D03` matrix; accepted/correlated endpoints alone never qualify.
- Enforce retention and compaction rules.

Exit criteria:

- Runaway scripts, triggers, formatters, watcher loops, or generated builds cannot flood durable history.
- Storm batches remain queryable without pretending mixed causes have one direct cause.

Do not:

- Persist storm batches before thresholds and retention are explicit.
- Compact/drop version artifacts before policy blockers are closed.

## Capability Group 10 - Audit Query And Review Loops

Related spec: SPEC-38.

Prerequisites:

- SPEC-35 ledger graph exists.
- SPEC-36 and SPEC-37 attribution records exist for tool/harness/automation traversal.
- SPEC-33 file version records exist for before/after workflows.
- SPEC-39 storm records exist before storm traversal is advertised.
- Audit projections are registered in SPEC-40 before implementation.
- `AUD-D01` is owner-approved, propagated, and back-validated before any Capability Group 10 implementation beyond inventory.

Goals:

- Persist audit query and review events.
- Implement file-path-to-cause and file-version-to-cause traversal.
- Add chat-turn-to-tool-to-resource traversal.
- Add automation-run-to-resource traversal.
- Persist recommendation and ticket events with evidence links.

Exit criteria:

- Assistant workflows can retrieve compact graph paths without loading all payloads.
- Review outputs cite evidence IDs.
- UI, tool, harness, automation, file version, and external/unknown changes can be distinguished.

Do not:

- Return full snapshots, diffs, or tool outputs by default.
- Build automatic code fixes as part of the audit persistence slice.

## Parallel Work Rules

Safe parallel work:

- SPEC-32 audits, SPEC-35 audits, SPEC-36 audits, SPEC-37 audits, and SPEC-38 query-helper inventory.
- SPEC-34 UI entry-point audit while SPEC-32 resource policy work begins.
- SPEC-36 and SPEC-37 normalization after SPEC-40 skeleton and before full SPEC-35 query helpers, as long as persistence waits for ledger schema.

Unsafe parallel work:

- Versioning before canonical resource events and ledger foundations exist.
- Storm compaction before versioning policy blockers close.
- Audit traversal before ledger edges and source attribution exist.
- UI-origin mutation conversion before per-view selector mapping is closed.

## First Practical Build Target

The first implementation target should be:

1. SPEC-32 Slice 32a event audit and runtime probes.
2. SPEC-40a registry skeleton, then 40b1a early resource/workspace/view/theme/UI validation and publisher unit acceptance.
3. SPEC-34a-34c builds/tests the renderer-only local central UI-action envelope and Wiki/File adapters; it puts no provenance seed on the wire and creates no server identity or token authority. SPEC-34d1 first installs the complete server prompt-log fence, then atomically enables wire attachment.
4. SPEC-32 Slice 32b0 routes every active switch/create/remove/ribbon ingress through the transactional FIFO coordinator, installs coordinator root/command-context authority and per-recipient token transport plus the isolated provenance E2E launcher, then fences the operational workspace topic and proves ordering/recovery/isolation.
5. SPEC-34d1, with accepted 32b0 as a hard prerequisite, adds server-owned action identity and the UI-only `chat.send_with_resource` server handoff.
6. SPEC-32b establishes the central resource-store facade, Wiki/File resource policy, canonical resource/lifecycle producers, and immutable policy/route sidecars.
7. SPEC-32c adds `resource:invalidate`, recovery, and client handling.
8. SPEC-40b1b integration acceptance over producers, route/policy sidecars, broadcaster/recovery, and clients.
9. Execute bounded SPEC-32d producer conversions one producer group at a time under the registry/update gates. Execute the matching SPEC-34d2 UI-to-resource binding only after each applicable producer conversion; 34d2 is not an implicit part of 34d1.
10. SPEC-32e establishes generation-bound watcher/filter lifecycle and passes its atomic replacement and stale-workspace acceptance suite.
11. SPEC-32f migrates Wiki rendering to the central resource cache with its exact automated and runtime evidence contract.
12. SPEC-32g migrates one explicitly named remaining view group at a time; no slice may claim all remaining views without separately bounded inventories and evidence.

This target fixes the current render freshness problem while preserving the event identity, provenance, and validation hooks needed for ledger storage and file versioning.

## Completion Definition

This provenance build is complete when:

- Every resource mutation and watcher-observation path calls the canonical producer; accepted facts flow through UEB, while exceptional post-fact failures are diagnosed and use only non-canonical renderer freshness recovery.
- Side-effect subscribers only consume accepted canonical events.
- Accepted UI-action records carry durable best-available context; degraded provenance paths remain explicit without blocking UI-origin operations.
- Server, watcher, trigger, harness, tool, automation, and external changes have honest attribution.
- Views refresh from central resource state without private file-watch paths.
- The ledger persists canonical events, projections, native refs, validation status, and edges.
- File versions are linked to resource events and cause chains.
- Storms are compacted without false attribution.
- Audit queries can traverse from file state to likely cause with compact evidence.
- Every domain's failure-injection packet proves source-operation isolation, accepted-reference-only propagation, safe redaction/material handling, and explicit diagnostics for missing evidence.
- Async-core-hook rejection, synchronous failure injection, and unresolved-subscriber tests prove metadata cannot gate execution or hold responses; omission of unavailable enrichment keeps canonical admission and renderer invalidation independent of optional work.
