# RCC-0108 Implementation Roadmap

**Roadmap status:** READY FOR IMPLEMENTATION

**Packaging review completed:** 2026-07-22

**Product contract:** [RCC-0108 — Canonical Step Activity and Transient Chat “Working…” State](RCC-0108-chat-working-step-activity.md)

**Decision record:** [RCC-0108 — Implementation Readiness Review Queue](RCC-0108-implementation-readiness-issues.md)

**Execution model:** Sequential SPEC implementation with a mandatory acceptance gate after each SPEC

## 1. Outcome

Deliver the complete RCC-0108 product outcome without one cross-layer patch:

- immutable prompt-bound drain ownership;
- provider-neutral step activity;
- an authoritative sequenced live-turn frontier;
- suppression of blank initial thinking/content;
- safe durable terminal errors and on-demand redacted diagnostics;
- thread/turn-isolated client routing and reconnect restoration;
- truthful accessible Working presentation and durable error presentation.

The product contract remains authoritative for observable behavior and approved invariants. This roadmap owns packaging, dependency order, file ownership, and gate timing.

## 2. Authority Order

When sources differ, use this order:

1. Current explicit owner decisions recorded in the closed readiness queue.
2. Sections 4–8 of the parent product contract.
3. This roadmap and the current implementation SPEC.
4. The current Chat Wiki and Code Standards.
5. Active code and tests for integration facts.
6. The original RCC-0108 ticket for historical intent.

A builder may make ordinary implementation choices within these contracts. A contradiction that changes an approved lifecycle, routing, persistence, privacy, or presentation rule must stop the current SPEC for owner direction.

## 3. Package Index

| Order | SPEC | Domain | Prerequisite | Status |
|---:|---|---|---|---|
| 01 | [Runtime drain ownership](RCC-0108-SPEC-01-runtime-drain-ownership.md) | Server ownership, immutable route/control context, stale-drain safety | None | READY |
| 02 | [Server step activity and stream frontier](RCC-0108-SPEC-02-server-step-frontier.md) | Canonical `step_begin`, blank suppression, `streamSeq` publication contract | SPEC-01 accepted | READY |
| 03 | [Server terminal errors and diagnostics](RCC-0108-SPEC-03-terminal-errors-diagnostics.md) | Safe terminal catalog, diagnostic persistence/retrieval, durable metadata | SPEC-02 accepted | READY |
| 04 | [Client routing and frontier restoration](RCC-0108-SPEC-04-client-routing-frontier.md) | Types/modules, thread/turn gates, snapshot/live sequencing, deterministic browser fixture | SPEC-03 accepted | READY |
| 05 | [Presentation, acceptance, and documentation](RCC-0108-SPEC-05-presentation-acceptance.md) | Working UI, error UI, diagnostic actions, full Playwright proof, Wiki/ticket evidence | SPEC-04 accepted | READY |

## 4. Dependency Graph

```text
SPEC-01 immutable runtime/drain ownership
  -> SPEC-02 canonical step activity + authoritative server streamSeq
    -> SPEC-03 durable safe terminal errors + diagnostics
      -> SPEC-04 client route/frontier correctness + browser fixture
        -> SPEC-05 presentation + integrated proof + documentation
```

The sequence is intentionally serial. SPEC-01 through SPEC-03 overlap the same server runtime and canonical applier boundaries. SPEC-04 consumes the final server wire contract. SPEC-05 must not add presentation before routing and hydration correctness are proved.

## 5. Cross-SPEC Contracts

### 5.1 One server owner

`ThreadRuntimeManager` is the sole mutable owner of accepted turn state. `LiveTurnSnapshot` is a serializable projection. Connection-wide selected-thread fields, selected wires, and canonical assistant accumulators are not authoritative after prompt acceptance.

Every iterator has a UUID `drainId`. Binding, mutation, stop, terminalization, and cleanup compare the current drain and bound server `turnId`. A late callback cannot touch or clear a replacement drain.

### 5.2 Exact stream frontier

`LiveTurnSnapshot.streamSeq` is the only whole-turn stream sequence:

- `turn_begin` establishes the initial positive integer sequence.
- Every accepted in-flight publication from `turn_begin` through `turn_end` carries the resulting `streamSeq`.
- A live-projection mutation increments the sequence exactly once before publication.
- The published message and cloned snapshot expose the same resulting value.
- Rejected, stale, duplicate, or suppressed events do not increment or publish.
- `activityRevision` orders only Working-state transitions and never substitutes for `streamSeq`.
- No `streamRevision` or second whole-turn counter may be added.

Every state represented by a sequenced publication must be reconstructible from the same or a newer snapshot. This includes accepted input/attachments, assistant parts, tool state needed for reconstruction, usage/status projection, activity/cursor/seen ledger/revision, and terminal state.

### 5.3 Client frontier algorithm

The client keys frontier state by `threadId + turnId`.

1. An accepted snapshot at sequence `N` is installed atomically as an already-revealed baseline.
2. Messages at or below `N` are already represented and are dropped.
3. Messages above `N` that arrive before hydration are buffered by sequence.
4. After hydration, messages drain exactly once in contiguous sequence.
5. A gap is never guessed across. It remains buffered until the missing message arrives or a newer snapshot advances the baseline through it.
6. One thread’s hydration cannot reset another thread’s frontier, renderer, or helper namespace.

### 5.4 Activity and content

`step_begin` is provider-neutral transient activity, not thinking content. Blank/whitespace-only chunks that would create a new thinking or content part are suppressed before accumulation, snapshot, publication, or persistence. Once a real same-type part exists, later chunks are preserved exactly.

Working state, its cursor, identity ledger, and revision never enter durable history. Readable thinking remains actual model output.

### 5.5 Error and diagnostic safety

The ordinary lifecycle, snapshot, transcript, and exchange metadata contain only the fixed safe terminal catalog and optional opaque `diagnosticId`. Raw errors, provider objects, stacks, stderr, prompts, attachments, secrets, and environment values never enter those paths.

The central client WebSocket logger must suppress every retrieved diagnostic report field before console logging or captured-log forwarding. Only the message type, fixed unavailable marker, and opaque route/diagnostic identifiers may be logged.

Only OpenCode may classify its native authentication, timeout, and process-exit signals into the shared closed marker. Shared runtime code never recovers specificity by parsing raw text or provider codes.

Diagnostics use the dedicated table and bound service, are fetched only after user action, and are never automatically placed into model context. Failure of validation, cleanup, persistence, or retrieval cannot block terminalization.

### 5.6 Compatibility path

RCC-0108 remains on the documented pre-SPEC-40b2 `chat:*` compatibility path. It does not call canonical admission, create accepted-only references, publish to canonical-only ledger subscribers, or invent provenance relationships.

### 5.7 Module boundaries

One job per file controls. New/extracted files finish at or below 400 lines. `LiveSegmentRenderer.tsx` remains the documented one-job no-split completion pipeline; only pure presentation children may be extracted.

## 6. SPEC Acceptance Cycle

For each SPEC:

1. Confirm the prerequisite SPEC is accepted and no overlapping implementation is active on the owned files.
2. Read the parent product contract, this roadmap, the current SPEC, AGENTS.md, and the required Chat Wiki pages.
3. Preserve unrelated dirty-worktree changes and record pre-existing modifications that overlap the SPEC.
4. Implement the SPEC’s slices in order.
5. Run the exact focused gate in the SPEC and repair failures.
6. Review the resulting bytes against the parent invariants and SPEC acceptance criteria.
7. Record changed files, commands/results, warnings, deviations, and residual risk.
8. Mark the SPEC accepted only after its gate passes. Do not begin its successor earlier.

An omitted mechanically necessary integration file is not a reason to leave the behavior incomplete. Add it to the evidence and keep the change within the current SPEC’s domain.

## 7. Verification Ownership

| Proof | Owning SPEC |
|---|---|
| Public prompt route, interleaved drains, stale callbacks, Stop/enforcement ownership | SPEC-01 |
| Translator, applier, broadcaster, exact `streamSeq`, activity revision, blank suppression | SPEC-02 |
| Marker translation, terminal catalog, diagnostic redaction/storage/retrieval, public request route, persistence | SPEC-03 |
| Client route/turn gate, helper isolation, snapshot/live race, no replay/gap/duplicate | SPEC-04 |
| Working/error/diagnostic UI, client diagnostic log suppression, accessibility, completion ordering, full lifecycle | SPEC-05 |
| Full server suite and final client build/Playwright run | SPEC-05 |

`fusion-studio-client/e2e/working-activity.spec.ts` and its deterministic WebSocket fixture are created in SPEC-04. SPEC-04 owns the `@routing` and `@frontier` cases. SPEC-05 extends the same file with `@working` and `@terminal-error` cases, so no gate references a test artifact that a later SPEC has not created. Every RCC-0108 Playwright command uses `--workers=1` because the current browser lane is fully parallel by default and the Chat testing authority requires serial execution for app-state-focused specs.

## 8. Parent Acceptance Coverage

| Parent criteria | Primary owner | Final proof |
|---|---|---|
| 1–3 | SPEC-02 + SPEC-04 + SPEC-05 | Canonical translation, explicit route/turn/sequence, and observable activity-revision proof |
| 4–6 | SPEC-05 | Working presentation and post-tool ordering Playwright |
| 7 | SPEC-02 + SPEC-05 | Server suppression tests plus live/history UI proof |
| 8 | SPEC-01 + SPEC-04 | Stale-drain safety and client thread/turn isolation |
| 9 | SPEC-01 + SPEC-03 + SPEC-05 | All terminal paths clear activity and finalize |
| 10–13 | SPEC-04 + SPEC-05 | Reconnect restoration, history exclusion, fallback, accessibility |
| 14–15 | SPEC-05 | Final command record and Chat Wiki/ticket update |
| 16–18 | SPEC-03 + SPEC-05 | Safe terminal server contract and durable UI proof |
| 19 | SPEC-01 | Unique drain and compare-current lifecycle |
| 20 | SPEC-03 + SPEC-04 + SPEC-05 | Terminal snapshot/save merge without duplication |
| 21 | SPEC-01 + SPEC-02 + SPEC-03 | Compatibility-path isolation tests |
| 22 | Every SPEC; final audit in SPEC-05 | One-job/line-boundary review and renderer regression |
| 23–24 | SPEC-02 + SPEC-04 | Stale-symbol sweep and single authoritative `streamSeq` |
| 25–26 | SPEC-04 + SPEC-05 | Completed/in-flight return and snapshot/live race Playwright |
| 27–30 | SPEC-03 + SPEC-05 | Safe diagnostic server boundary and explicit client actions |

No parent criterion is deferred to RCC-0112. That ticket owns only cosmetic catch-up treatment after frontier correctness passes.

## 9. Global Completion Gate

RCC-0108 is complete only when:

- SPEC-01 through SPEC-05 are accepted in order;
- all 30 parent acceptance criteria pass;
- the direct legacy `StepBegin` branch and `stepNumber` are absent;
- there is exactly one whole-turn sequence, `streamSeq`;
- completed returns render instantly and in-flight returns install an already-revealed snapshot baseline;
- snapshot/live races have no replay, gaps, duplicates, or cross-thread state mutation;
- diagnostic bounds, retention, ownership, and safe-failure behavior are proved;
- the client build and full RCC-0108 Playwright file pass;
- the full server test suite passes, with unrelated pre-existing failures separately documented if any;
- the Chat Wiki and RCC-0108 ticket record the implemented contract and evidence.

## 10. Coordination Boundary

While this roadmap is active, pause implementation that overlaps:

- canonical chat event application and bridge routing;
- thread runtime manager/controller/automation;
- live-turn snapshots and broadcaster lifecycle shapes;
- client stream handlers, turn lifecycle, chat state, and live rendering;
- terminal error persistence or chat diagnostics.

Read-only review and unrelated work may continue. The current dirty worktree is not permission to overwrite or normalize unrelated files.
