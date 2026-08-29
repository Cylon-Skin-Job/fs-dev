# RCC-0108 SPEC-01 Terminal Report — Runtime Drain Ownership

**Status:** `SPEC_READY_FOR_SUPERVISOR_REVIEW`

**Orchestrator:** spec-orchestrator (fresh spawn; resumed an owner-cancelled mid-flight run on preserved bytes)
**Worktree:** `/Users/rccurtrightjr./projects/fs-dev-rcc-0108` · branch `agent/rcc-0108-roadmap` · nothing committed (per isolation contract)
**Baseline:** `4f972c5` (pre-change: 5 suites / 69 tests green)
**Date:** 2026-08-25

---

## 1. Resume authentication summary

**Inherited from the cancelled run (authenticated byte-by-byte, not replayed):**
- Slices A–C product bytes complete: `canonical-drain-context.js` (immutable deep-copied/frozen `CanonicalRouteContext`, attachment array+objects copied pre-freeze, non-serializable control), `canonical-turn-accumulator.js`, `canonical-chat-{text,tool,terminal}-events.js` extractions, full `ThreadRuntimeManager` drain-authority API, drain-driven applier/bridge/message-router with bind-once, interactive + automation claim-before-iteration, snapshot attachments clone-in, `streamSeq` untouched single frontier.
- Inherited test suites: broad Slice A/B/C coverage including interleaved drains, stale-mutation drops, bind-once rejection paths, serializable-snapshot proofs.
- Inherited gate state on arrival: **112/113 passing** across the six gate suites (`prompt-canonical-route.integration.test.js` already existed).

**Finished by this run (Slice D completion + repairs, via one fresh builder):**
- R1: fixed stale expectation in integration test (a) (`content 'reply'` → `'A reply'`; product bytes were correct).
- R2: `stopRuntimeTurn` now captures the active drain before synthesis, synthesizes the interrupted `turn_end` through the bound context, stops **only** via `capturedDrain.control.stopHarness()`, re-reads the record after the stop resolves, and makes a superseded Stop completion a diagnostic no-op (no `unregisterWire`, no state transition, no sends); non-superseded completion does registry hygiene + `clearActiveDrainIfCurrent` + STOPPING-gated `markCold`. Legacy no-record branch kept byte-compatible. "SLICE D" placeholder comment removed.
- R3: added the missing SPEC §5 proofs — Stop-on-A-cannot-stop-B with attachment preservation (integration test e), enforcement-bounce-stops-only-A (applier cross-thread test), late-A-Stop-completion-vs-replacement-B via deterministic gated mid-call interleaving (controller suite) + orphan never-begun record clear test; updated the bound-stop test to prove the control (not the registry wire) is the stop mechanism.

**Scope ruling recorded:** no exception-path canonical `turn_end` synthesis was added for harness iterator errors. Baseline had none (verified against `4f972c5`); SPEC-01 §1 limits scope to ownership/routing, §3.D4 requires only superseded-case no-ops (implemented + tested), and roadmap §8 assigns error terminalization (parent criteria 9/16) to SPEC-03.

## 2. Slice-by-slice completion

| Slice | State | Gates earned |
|---|---|---|
| A — Module boundaries (applier dispatcher/factory; text/tool/terminal extraction; ≤400 ln new files; chat:* compat) | Complete (bytes inherited) | builder review + acceptance + final integration, all CLEAN |
| B — Bound route & control (immutable context, non-serializable control, claim-before-iteration both paths) | Complete (bytes inherited) | same |
| C — Runtime authority (sole owner, bind-once, compare-current, idempotent terminalize, clear-if-current, applyLiveMutation→streamSeq) | Complete (bytes inherited) | same |
| D — Stop/enforcement/cleanup via bound control; supersession-safe Stop completion; attachment-preservation & enforcement-isolation proofs | **Completed this run** | same |

## 3. Changed-file manifest (whole SPEC vs baseline 4f972c5; ⚑ = touched by this run)

**Modified (12)**
| File | Purpose |
|---|---|
| `fusion-studio-server/lib/thread/thread-runtime-manager.js` | Sole mutable canonical turn owner; drain authority API (claim/bind/compare-current/applyLiveMutation/terminalize/clear-if-current) |
| `fusion-studio-server/lib/thread/thread-runtime-controller.js` ⚑ | Slice B claim-before-iteration + rollback; Slice D bound-control-only stop with post-await supersession guard and STOPPING-gated cold (440 ln, one job) |
| `fusion-studio-server/lib/thread/thread-runtime-automation.js` | Headless parity: claim before drain, bind-once bridge, superseded completion/error no-ops |
| `fusion-studio-server/lib/thread/live-turn-snapshot.js` | Accepted attachments cloned into JSON-safe projection; `streamSeq` bump semantics unchanged |
| `fusion-studio-server/lib/wire/canonical-chat-event-applier.js` | Provider-neutral drain-driven dispatcher/factory composing the three focused modules |
| `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js` | drainContext pass-through per event; bind-once of accepted begin result |
| `fusion-studio-server/lib/wire/message-router.js` | Per-connection composition wiring `bindDrainTurn → ThreadRuntimeManager.bindTurnToDrain` |
| `test/thread/thread-crud-live-turn.test.js` | Overlay snapshots carry attachments; completed snapshot survives drain clear |
| `test/thread/thread-runtime-controller.test.js` ⚑ | Slice B/C/D coverage incl. late-loop-error no-op, bound-stop mechanism proof, stop-supersession describe (late Stop vs replacement B; orphan clear) |
| `test/thread/thread-runtime-automation.test.js` | Automation claim/bind/duplicate-begin/late-error coverage |
| `test/wire/canonical-chat-event-applier.test.js` ⚑ | Authority-API coverage incl. cross-thread enforcement isolation |
| `test/wire/canonical-harness-event-bridge.test.js` | Drain-context pass-through + bind-once/rejection coverage |

**New (7)**
| File | Lines | Purpose |
|---|---|---|
| `lib/thread/canonical-drain-context.js` | 179 | `CanonicalRouteContext` deep-copy/freeze + attachment normalization; non-serializable `CanonicalDrainControl` |
| `lib/thread/canonical-turn-accumulator.js` | 67 | Non-serializable per-turn accumulator + idempotent settle |
| `lib/wire/canonical-chat-text-events.js` | 99 | Content/thinking accumulation via gated live mutations |
| `lib/wire/canonical-chat-tool-events.js` | 336 | Tool lifecycle + enforcement bounce stopping only the bound harness |
| `lib/wire/canonical-chat-terminal-events.js` | 79 | Snapshot-sourced `turn_end` assembly, idempotent terminalize, clear-if-current |
| `test/thread/canonical-drain-context.test.js` | 185 | Context/control unit tests |
| `test/ws/prompt-canonical-route.integration.test.js` ⚑ | 546 | Public-route proofs (a)–(e); real router→controller→bridge→applier→manager→bus chain; mocks only persistence edge, child-process spawn edge, ESM uuid shim |

## 4. Exact acceptance gate — command and results

```bash
cd fusion-studio-server && npx jest --runInBand \
  test/wire/canonical-harness-event-bridge.test.js \
  test/wire/canonical-chat-event-applier.test.js \
  test/thread/thread-crud-live-turn.test.js \
  test/thread/thread-runtime-controller.test.js \
  test/thread/thread-runtime-automation.test.js \
  test/ws/prompt-canonical-route.integration.test.js
```

Run four times total: once on inherited bytes (112/113, one failure = the stale expectation repaired as R1), once by the builder post-repair (**117/117 passed**), once independently by the orchestrator (**117/117 passed**), and once each by the acceptance reviewer and final-integration reviewer (both **117/117**, matching claims). All on final current bytes.

## 5. Other checks

| Check | Result |
|---|---|
| Full server suite `npx jest --runInBand` | **80 suites, 722 passed, 1 skipped, 0 failed** (orchestrator + builder + both reviewers independently). Skip is pre-existing; no unrelated failures to document. |
| Boot smoke `node server.js` | `SERVER_READY:3001`, clean SIGTERM shutdown, zero chat/runtime-layer errors (orchestrator-run). Unrelated environmental ENOENTs for an absent machine subtree noted, pre-existing. |
| Compatibility sweep | `publishCanonical`, `AcceptedCanonicalRef`, canonical-admission references, `streamRevision`, provider parsing: **0 hits** in lib/test surface; `chat:*` payload shapes field-compared identical to baseline; broadcaster/audit-subscriber consumers have zero diff vs baseline. Legacy `StepBegin` branch retained (deletion owned by SPEC-02+, roadmap §8). |
| Single-frontier sweep | Only bump site `live-turn-snapshot.js:bump`; init `streamSeq:1`; no second counter anywhere. |
| Line/job rules | New lib files ≤400 (179/67/99/336/79); every touched file one describable job. Deviations D3/D4 below cover the two >400 test/controller files. |
| Session-state sweep | Zero canonical reads/writes of `session.currentTurn`/`assistantParts`/pending fields (grep + reviewer trace); remaining `session.wire` uses are pre-acceptance acquisition and the documented no-record stop fallback (SPEC §3.C3-permitted selection concerns). |

## 6. Deviation ledger (complete; orchestrator-final classifications)

| ID | Original contract | Actual change | Reason | Files | Tests | Observable effect | Risk | Downstream impact | Classification |
|---|---|---|---|---|---|---|---|---|---|
| DEV-1 | Legacy stop branch used registry/session lookup + unconditional cold | Wire lookup moved to after event synthesis within the legacy (no-record) branch only | Bound path must not consult mutable selection; reorder is a pure read inside one sync region | thread-runtime-controller.js | gate + full suite | None (verified; behavior pinned by test :341) | none identified | none | `accepted_no_downstream_impact` |
| DEV-2 | Repair packet specified three R3 proofs | Fourth test added: orphan never-begun record clear | Validates the newly mandated clear-if-current hygiene step mechanically | thread-runtime-controller.test.js | included in gates | test-only | none | none | `repair_current_spec` |
| DEV-3 | ≤400 lines for new/extracted files (SPEC §3.A3, R9) | Inherited NEW integration test is 546 lines | Created by cancelled prior run; filename pinned verbatim by SPEC §4/§6 gate; single describable job (public-route drain proofs); splitting would move §5-required tests out of the pinned gate command | test/ws/prompt-canonical-route.integration.test.js | all gates green as-is | none | style-level | **SPEC-05 parent-criterion-22 final audit will re-check line counts repo-wide — flagged here so the audit treats this file as known/intentional or splits at a natural boundary then** | `accepted_update_downstream_packet` |
| DEV-4 | Same guidance | Modified controller now 440 lines | Rule binds new/extracted files; modified files need one job (prompt acceptance + runtime stop ownership = one job) | thread-runtime-controller.js | gates green | none | style-level | optional future extraction | `accepted_no_downstream_impact` |
| DEV-5 | Parent §4.6 "exception terminalization must use the bound drain control" | No exception-path canonical `turn_end` synthesis added; superseded-late-error no-op guards only | Baseline had no such synthesis (verified vs 4f972c5); inventing reason:'error' envelopes is SPEC-03's approved territory (roadmap §8 maps criteria 9/16 there); premature synthesis would breach SPEC-01 §1 "ownership and routing only" | (no product change) | late-error tests :622/:444 prove supersession safety | Error-failed turns persist as in_flight snapshots until next claim replaces the leftover record (warn logged) — baseline-identical user-visible behavior | low; closed by SPEC-03 | **SPEC-03 must implement failure-path terminalization through the existing `terminalizeTurn`/bound-context machinery; the slot is deliberately vacant** | `accepted_update_downstream_packet` |
| DEV-6 | Ledger findings R1/R2/R3 (stale expectation; unowned stop path; missing §5 proofs) | Exactly those directed repairs implemented | Orchestrator-directed resume work | see §3 ⚑ files | see §4 | Correctness per contract | — | — | `repair_current_spec` |

**Counts:** accepted_no_downstream_impact 2 · accepted_update_downstream_packet 2 · repair_current_spec 2 · invalidate_accepted_dependency 0 · owner_ruling_required 0.

## 7. Child subagent identities and terminal results

| # | Agent | Identity / task id | Terminal result |
|---|---|---|---|
| 1 | spec-slice-builder (only slice writer ever active) | `ses_fc75487e8ffeTwBD2ioeicrEAk` | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 2 | clean-room-reviewer (builder-owned gate, fresh spawn by builder) | `ses_fc74662faffeDei3wzWalH8srr` (as reported by builder) | CLEAN — 0 material, 3 advisories (terminal) |
| 3 | clean-room-reviewer (orchestrator slice acceptance) | `ses_fc73c9536ffegJ5DbHzvv9rGQb` | CLEAN — first pass; 0 material; advisories A1–A3 (terminal) |
| 4 | clean-room-reviewer (final SPEC integration) | `ses_fc7320be7ffeOCOvkZVEEEHkwQ` | CLEAN — first pass; 0 material; 5 advisories (terminal) |

Every spawn terminated normally; no missing closure, no active conflict at any sibling spawn, no spawn rejections. Each gate stopped at its first clean pass. All descendants inherited the invoking root model/reasoning effort; none pinned.

## 8. Residual risks, skipped checks, temporary adapters

- **Residual risks:** (1) until SPEC-03 lands, error-failed turns keep an in_flight snapshot + leftover drain record replaced-with-warn on next claim (baseline-identical, owned downstream); (2) pre-claim stop window (between markInFlight and claim) takes the legacy branch — inherited, bounded, documented; (3) a Stop landing in the tiny sync window after natural terminalization marks COLD instead of READY — perf-only, baseline-identical; (4) repeated bounced args chunks re-invoke the bound stopHarness — matches baseline bounce frequency, guarded/idempotent.
- **Skipped checks:** client build/Playwright — not in SPEC-01's gate (client deps deferred to SPEC-04 per supervisor ledger); server boot smoke WAS run (§5).
- **Temporary adapters:** none. Test-only uuid shim mirrors the established crypto.randomUUID ESM precedent.

## 9. Handoff to SPEC-02 (SPEC §8 — required fields)

- **ThreadRuntimeManager API names actually implemented:** `claimActiveDrain(key, control, routeContext)` → active record; `getActiveDrain(key)`; `isDrainCurrent(key, drainId)`; `beginCanonicalTurn(key, drainId, {turnId, userInput, attachments})` → `{accepted, turnId?}`; `bindTurnToDrain(key, drainId, turnId)` → bool (bind-once); `resolveBoundTurnId(key, drainId)` → `turnId|null`; `applyLiveMutation(key, {drainId, turnId}, mutator({snapshot, turn}))` → resulting `streamSeq|number|null when gated out`; `terminalizeTurn(key, identity, status)` → bool (idempotent); `clearActiveDrainIfCurrent(key, drainId)` → bool. Singleton export `threadRuntimeManager`.
- **Serializable live snapshot shape:** `{ workspaceId, scope, threadId, turnId, userInput, attachments[], status: 'in_flight'|'complete'|'interrupted', fullText, parts: [{type:'text'|'think', content} | {type:'tool_call', toolCallId, name, arguments, result}], streamSeq (number, starts 1), updatedAt }` — JSON-safe; no functions/harness/control objects (proven by round-trip + key-pattern tests).
- **Exact method applying a live mutation and returning its resulting streamSeq:** `threadRuntimeManager.applyLiveMutation(runtimeKey, { drainId, turnId }, mutator)` — the single gated mutation primitive all SPEC-02 publications must build on. Do not introduce another accumulator or sequence counter.
- **Also carried forward:** `chat:status_update` intentionally still lacks `turnId` (baseline-faithful; SPEC-02 adds it); error-terminalization slot deliberately vacant for SPEC-03 (DEV-5); legacy `StepBegin` branch deletion owned by SPEC-02+ (roadmap §8 criterion 23).

## 10. Acceptance criteria recap (SPEC §7, 1–11)

All eleven verified on current bytes by two independent clean-room reviews with file:line evidence: sole mutable owner (1); claimed-before-iteration unique UUID drains (2); accepted-server-turnId binds exactly once (3); all post-begin mutations compare drain+turn (4); stop/enforcement/lease-touch/exception-handling/cleanup use the bound control (5); late callbacks cannot affect replacement drains, interactive + automation (6, 7); accepted input/attachments survive interruption without connection-global reconstruction (8); single `streamSeq` frontier preserved (9); no provider parsing / canonical-admission references (10); exact gate green with evidence recorded herein (11).
