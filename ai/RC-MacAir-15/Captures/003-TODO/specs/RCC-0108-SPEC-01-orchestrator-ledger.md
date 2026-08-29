# RCC-0108 SPEC-01 Orchestrator Ledger (resumed run)

**Orchestrator:** spec-orchestrator (fresh spawn, resume of owner-cancelled run)
**Worktree:** `/Users/rccurtrightjr./projects/fs-dev-rcc-0108` · Branch `agent/rcc-0108-roadmap`
**Baseline:** `4f972c5` (5 suites / 69 tests green pre-change)
**Resume authentication (current bytes vs baseline):**

| File | State | Slice | Authenticated finding |
|---|---|---|---|
| lib/thread/canonical-drain-context.js | NEW 179 ln | B | Complete: deep copy + recursive freeze, attachment array/object copy, non-serializable control closing over injected callables |
| lib/thread/canonical-turn-accumulator.js | NEW 67 ln | C | Complete: non-serializable accumulator + idempotent settle |
| lib/wire/canonical-chat-text-events.js | NEW 99 ln | A/C | Complete: content/thinking via applyLiveMutation, pre-binding + stale drops |
| lib/wire/canonical-chat-tool-events.js | NEW 336 ln | A/C/D | Complete: tool lifecycle + enforcement bounce stopping BOUND harness via control |
| lib/wire/canonical-chat-terminal-events.js | NEW 79 ln | A/C | Complete: snapshot-sourced assembly, idempotent terminalize, clear-if-current |
| lib/thread/thread-runtime-manager.js | MOD 393 ln | C | Complete authority API: claimActiveDrain / isDrainCurrent / beginCanonicalTurn / bindTurnToDrain / resolveBoundTurnId / applyLiveMutation→streamSeq / terminalizeTurn / clearActiveDrainIfCurrent |
| lib/thread/live-turn-snapshot.js | MOD 131 ln | C | Complete: attachments cloned into JSON-safe snapshot; streamSeq single frontier preserved |
| lib/thread/thread-runtime-controller.js | MOD 403 ln | B/C/**D-partial** | Slice B complete (claim before iteration, rollback on binding failure). **Slice D INCOMPLETE by code comment:** stopRuntimeTurn still resolves wire via `getWireForThread/session.wire` instead of bound control; unconditional markCold/unregister risks stomping a replacement drain (D4) |
| lib/thread/thread-runtime-automation.js | MOD 333 ln | B/C/D | Complete parity: claim before drain, bind-once, superseded completion/error no-ops |
| lib/wire/canonical-harness-event-bridge.js | MOD 185 ln | C | Complete: drainContext pass-through + accepted-begin bind-once |
| lib/wire/message-router.js | MOD 124 ln | C | Complete: bindDrainTurn wired per connection |
| test/* (6 suites) | MOD/NEW | all | Broad coverage; see gaps below |

**Gate on inherited bytes:** 6 suites, **112/113 pass**. Single failure: `test/ws/prompt-canonical-route.integration.test.js:275` expects `parts[0].content === 'reply'` while the same test asserts `text: 'A reply'` / `fullText: 'A reply'` (lines 261/269/283) — stale test expectation, product behavior correct (parts accumulate streamed text verbatim).

**Compatibility audit:** no `publishCanonical` / `AcceptedCanonicalRef` / canonical-admission references / `streamRevision` anywhere in lib or test. Pre-SPEC-40b2 `chat:*` emit path intact.

**Scope ruling recorded:** parent §4.6 "exception terminalization must use the bound drain control" — baseline had NO canonical terminalization on iterator exceptions (verified against 4f972c5); SPEC-01 §3.D4 requires only superseded-case no-ops; error-turn normalization belongs to SPEC-03 (roadmap §8 maps parent criteria 9/16 to SPEC-01+03+05). SPEC-01 keeps baseline exception behavior + drain-safety guards; no invented exception-path turn_end.

## Slice ledger

| Slice | Scope | Prereq | State | Builder/reviewer identities | Deviations |
|---|---|---|---|---|---|
| A | Module boundaries (applier factory + text/tool/terminal extraction, ≤400 ln, chat:* compat) | none | **accepted** — gates CLEAN on current bytes | builder `ses_fc75487e8ffeTwBD2ioeicrEAk`; reviewers `ses_fc74662faffeDei3wzWalH8srr` (builder gate), `ses_fc73c9536ffegJ5DbHzvv9rGQb` (acceptance), `ses_fc7320be7ffeOCOvkZVEEEHkwQ` (final integration) — all CLEAN first pass | see SPEC-01 report §6 |
| B | Bound route + control (immutable context, non-serializable control, claim-before-iteration, interactive+automation) | A | **accepted** — same gates | same | none beyond report |
| C | Runtime authority (manager sole owner, bind-once, compare-current, applyLiveMutation streamSeq) | B | **accepted** — same gates | same | none beyond report |
| D | Stop/enforcement/cleanup via bound control; supersession-safe stop completion; attachment preservation proof; enforcement isolation proof | C | **completed + accepted this run** (R1/R2/R3 repairs; late-stop guard; orphan clear) | same | DEV-1/2/6 in report |

**Final:** SPEC_READY_FOR_SUPERVISOR_REVIEW · gate 117/117 · full suite 722 passed / 1 skipped · boot smoke clean · report: `RCC-0108-SPEC-01-report.md`

## Required §5 test → coverage map (authenticated)

| Required test | Coverage status |
|---|---|
| Non-mocked public prompt route w/ fake harness iterator | ✅ integration test (mocks only persistence + child-process edges) |
| Two interleaved threads isolated route/input/attachments/control/lease | ✅ integration (b) + applier interleaved test |
| Stop on A cannot stop B; preserves A attachments | ❌ MISSING (R3a) |
| Enforcement rejection on A stops only A's harness | ⚠️ bound-harness-stopped proven; only-A isolation not asserted (R3b) |
| Old drain A vs replacement B: late event/error/Stop-completion/cleanup no-ops | ⚠️ late event/error/turn_end covered; late Stop-completion missing (R3c) |
| turn_begin binds once; rejected/spurious/duplicate never rebind | ✅ bridge + applier + automation + integration (d) |
| Interactive AND automation terminals clear only current drain | ✅ both suites |
| Snapshot serializable, no functions/harness/control | ✅ applier contract tests + integration (c) |
