# RCC-0108 SPEC-02 — Orchestrator Ledger

**SPEC:** Server Step Activity and Stream Frontier (`RCC-0108-SPEC-02-server-step-frontier.md`)
**Worktree:** `/Users/rccurtrightjr./projects/fs-dev-rcc-0108` · branch `agent/rcc-0108-roadmap`
**Integration baseline:** SPEC-01 accepted uncommitted bytes on `4f972c5` (authoritative; not contamination)
**Baseline gate state at start:** 5 existing gate suites = 120/120 passed (message-router/wire-broadcaster suites do not exist yet — creation authorized as mechanically necessary, they are in SPEC §4 expected surface and the §6 gate command)
**Mutation primitive (Supervisor Amendment):** `threadRuntimeManager.applyLiveMutation(runtimeKey, {drainId, turnId}, mutator)` → resulting `streamSeq` — the only gated mutation site; no second accumulator or sequence counter anywhere.

## Slice ledger

| Slice | Scope | State | Builder | Builder review | Orchestrator acceptance |
|---|---|---|---|---|---|
| A | Harness translation: canonical `StepBeginEvent`, both OpenCode spellings, finite-timestamp preservation only, non-empty id preservation, `step_begin` excluded from useful-output predicate | **ACCEPTED** | ses_fc7148631ffeSF072r6vH0GVw5 (READY) | ses_fc70bd804ffe6OqFiV07Nm7TeA CLEAN 1st pass | ses_fc7057c04ffeCTCuJHthrsTo5n CLEAN 1st pass (2 advisories A1/A2 coexist) |
| B | Identity & activity: seen-ledger dedupe BEFORE time normalization, single captured `now`, `activityRevision` only on real Working transitions, full activity/cursor/ledger/revision in live snapshot, terminal clears | implementing | — | — | — |
| B | Identity & activity: seen-ledger dedupe BEFORE time normalization, single captured `now`, `activityRevision` only on real Working transitions, full activity/cursor/ledger/revision in live snapshot, terminal clears | **ACCEPTED** | ses_fc6fb720fffeiyewnI85OKpsnI (READY) | ses_fc6ee3ac6ffeYyhy0an6d00455 CLEAN 1st pass | ses_fc6e36c93ffeVkTCpuDBiKpcOp CLEAN 1st pass (advisories A1–A3; A3 defers duplicate-after-clear test to Slice C) |
| C | Renderable-output suppression: whitespace-only new thinking/content parts suppressed before ANY mutation; later chunks preserved exactly once a real part exists; clear Working + one revision bump on first renderable output | **ACCEPTED** | ses_fc6db1814ffenWhRVl7oVdPpVg (READY) | ses_fc6cb9f51ffeS1lOQ8IsCrDW7Q CLEAN 1st pass | ses_fc6c37bbfffeSGylEoq4eGn8Ks CLEAN 1st pass (0 material; 4 advisories) |
| D | Sequenced publication: `streamSeq` + `turnId` on every in-flight shape incl. status_update/subagent/terminal; each publication represented by snapshot projection; DELETE legacy StepBegin router branch + `stepNumber`; publish chat:step_begin via compatibility bus only | **ACCEPTED** | ses_fc68d9425fferD680aTZfvo1W9 (READY) | ses_fc675a6e1ffeDGgBnZv8E79h1E CLEAN 1st pass, 0 material, 5 advisories | ses_fc58aedd7ffey0KOBY8Ce5VDqo CLEAN 1st pass, 0 material, 4 advisories |

## Resume authentication (run 2, 2026-08-25)

Prior run died mid-Slice-D after writing bytes but before any terminal report. This run re-authenticated current bytes against the recorded decisions/deviations rather than replaying:

- Slices A/B/C bytes match ledger decisions #1–#10 and deviations S2-D1..D8; no contradiction found. Gate suite green on arrival: **7 suites / 206 tests passed**; stale-symbol sweep clean on `lib`.
- Inherited unreviewed Slice-D bytes present across applier/text/tool/terminal modules, bridge, router, broadcaster, snapshot, accumulator, controller/automation, plus new `test/wire/message-router.test.js` + `test/wire/wire-broadcaster.test.js`. Per resume rule 2 these are NOT validated work — Slice D must earn its full gate chain on final bytes.
- §3.D requirements already satisfied by inherited bytes: sequenced status_update/subagent/terminal publications through `applyLiveMutation`; bound `turnId` incl. status_update; StepBegin router branch deleted (no shim, test-pinned); chat:step_begin via compatibility bus only; companion live-error boundary per decision #7; terminal snapshot retained at final frontier.
- **Orchestrator finding F1:** accepted-but-unparseable `tool_call_args` chunks publish with a REPEATED `streamSeq` (`applyLiveMutation` returns the unchanged frontier because no snapshot helper bumps when JSON.parse fails). Violates ledger decision #1 (uniform frontier: tool_* bump exactly once) + §2 rule 2 + §3.D rule 3, and breaks roadmap §5.3 contiguous client drain (≤baseline messages dropped → chunk loss). Repair required.
- **Orchestrator finding F2:** usage/status projection published by `chat:status_update` at seq N lives only on the runtime accumulator; the served snapshot has no usage field, so state at N is NOT reconstructible from any snapshot. Violates SPEC §2 rule 8 sentence 1 + roadmap §5.2 ("usage/status projection … reconstructible from the same or a newer snapshot"). Repair required (JSON-safe mirror inside the same gated mutation).
- Boundary ruling (authorized decision #11 below): disabled legacy adapters `lib/harness/clis/{gemini,qwen,claude-code,codex}/index.js` emit `chat:status_update`/`chat:turn_end` directly on the bus without turn/streamSeq — pre-SPEC compatibility emitters outside the accepted-canonical drain path; parent §4.11 forbids retrofitting non-OpenCode adapters; broadcaster test pins their byte-compatibility. Recorded, not repaired.

## Key implementation decisions (orchestrator-authorized within contract)

1. **Uniform frontier invariant:** every accepted in-flight publication advances `streamSeq` exactly once (turn_begin establishes seq 1; content/thinking/tool_*/subagent/status_update/step_begin/turn_end each bump exactly once via their existing or added snapshot mutations). Rationale: §2.2 + D3 ("each sequenced publication is represented by the corresponding runtime snapshot projection") + client buffering requires unique contiguous sequences. subagent_event gains a `touchStatus` bump (previously no mutation) so its publication has a unique sequence represented by the projection.
2. **Ledger storage:** authoritative `seenStepIdentities: Set<string>` on the non-serializable turn accumulator; JSON-safe `seenStepIdentities: string[]` mirrored onto the live snapshot inside the same gated mutation (parent §4.9 dual representation).
3. **Activity/cursor/revision:** authoritative mutable copies live ON the runtime-owned live snapshot (mutated only inside `applyLiveMutation` gates); clones handed out via `getLiveTurn` remain JSON-safe.
4. **Terminal clears:** `activity`/`stepCursor` cleared and `seenStepIdentities` emptied at terminalization (parent §4.9); `activityRevision` bumps iff activity was non-null (real transition, parent §4.1). Implemented in the snapshot completion path.
5. **activityRevision carriers:** bus+wire messages whose handling may change activity carry it: `step_begin`, renderable `content`/`thinking`/`tool_call`, and `turn_end` (parent §4.9). Other in-flight shapes carry `threadId`+`turnId`+`streamSeq` only.
6. **Post-terminal acknowledgements untouched:** `chat:exchange_metadata` / `chat-turn:saved` are the separate post-terminal family (parent §4.6) — no streamSeq.
7. **Companion live error boundary:** direct `auth_error`/`error` sends in message-router remain unsequenced transport notifications (unscoped transport errors cannot guess a target turn, parent §4.13); SPEC-03 owns failure-path routing/terminalization through bound context. Recorded in handoff.
8. **New test files authorized:** `test/wire/message-router.test.js`, `test/wire/wire-broadcaster.test.js` — absent from baseline, present in SPEC §4 surface and required by §6 gate command.
9. **Timestamp source for step_begin translation:** native envelope `event.timestamp` only (same source all sibling translations use); finite numeric preserved exactly, everything else omitted. No adapter-synthesized time.
10. **Identity fields from native part:** `stepId` ← `part.id` (fallback `event.id`), `messageId` ← `part.messageID` (fallback `event.messageID`); non-empty strings preserved, empty/non-string omitted. Shape selection only.
11. **Legacy adapter boundary (run 2):** disabled non-OpenCode adapters under `lib/harness/clis/*` keep emitting direct unsequenced `chat:status_update`/`chat:turn_end` bus events (pre-SPEC compatibility emitters, no bound turn); the §2 sequenced-publication contract governs accepted canonical drain publications only. SPEC-04 client gating must tolerate sequence-less shapes on those threads (baseline behavior).

## Deviation ledger

| ID | Slice | Original contract | Actual change | Reason | Files | Tests | Observable effect | Risk | Downstream impact | Classification |
|---|---|---|---|---|---|---|---|---|---|---|
| S2-D1 | A | "Preserve non-empty identifiers" ambiguous on trim | Identifiers trim-gated for emptiness but returned verbatim/untrimmed | Literal reading: trim is the emptiness test, not a rewrite; identity judgment is applier-side | json-event-translator.js | translator suite | Whitespace-padded ids pass through raw | none | Slice B identity derivation receives raw values (must treat blank-after-trim consistently) | accepted_no_downstream_impact |
| S2-D2 | A | Statement order unspecified | part extraction hoisted; step check inserted before synthesized-time fallback | Mechanically required so step events never reach `event.timestamp \|\| Date.now()` | json-event-translator.js | full suite green | None for non-step events | none | none | accepted_no_downstream_impact |
| S2-D3 | A | No OpenCode syntax in shared files | Shared types.js prose avoids the native token even in comments | Keeps shared file free of provider syntax | types.js | — | Comment wording only | none | none | accepted_no_downstream_impact |
| S2-D4 | A | e2e coverage of both spellings | Part-spelling e2e envelope omits top-level type field | Proves part-spelling dispatch independent of any top-level marker | harness-send-message.test.js | e2e suite | Stronger-than-minimum test | none | none | accepted_no_downstream_impact |

## Child subagent register

| # | Role | Agent | Task ID | Terminal result |
|---|---|---|---|---|
| 1 | Slice A builder | spec-slice-builder | ses_fc7148631ffeSF072r6vH0GVw5 | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 2 | Slice A builder-owned review | clean-room-reviewer (spawned by builder) | ses_fc70bd804ffe6OqFiV07Nm7TeA | CLEAN first pass, 0 material, 0 advisories from reviewer gate itself (terminal) |
| 3 | Slice A orchestrator acceptance | clean-room-reviewer | ses_fc7057c04ffeCTCuJHthrsTo5n | CLEAN first pass; advisories A1/A2 coexist with CLEAN (terminal) |
| 4 | Slice B builder | spec-slice-builder | ses_fc6fb720fffeiyewnI85OKpsnI | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 5 | Slice B builder-owned review | clean-room-reviewer (spawned by builder) | ses_fc6ee3ac6ffeYyhy0an6d00455 | CLEAN first pass, 0 material, 3 advisories (terminal) |
| 6 | Slice B orchestrator acceptance | clean-room-reviewer | ses_fc6e36c93ffeVkTCpuDBiKpcOp | CLEAN first pass; advisories A1–A3 (terminal) |
| 7 | Slice C builder | spec-slice-builder | ses_fc6db1814ffenWhRVl7oVdPpVg | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 8 | Slice C builder-owned review | clean-room-reviewer (spawned by builder) | ses_fc6cb9f51ffeS1lOQ8IsCrDW7Q | CLEAN first pass, 0 material, 2 advisories (terminal) |
| 9 | Slice C orchestrator acceptance | clean-room-reviewer | ses_fc6c37bbfffeSGylEoq4eGn8Ks | CLEAN first pass; 0 material, 4 advisories (terminal) |

## Slice C deviations

None (builder claim; independently confirmed by acceptance reviewer byte-hunt).

## Slice B deviations (orchestrator-final classifications)

| ID | Original contract | Actual change | Reason | Files | Tests | Observable effect | Risk | Downstream impact | Classification |
|---|---|---|---|---|---|---|---|---|---|
| S2-D5 | Slice B packet's mutator enumeration named no bump | `touchStatus(snapshot)` inside the step mutator so the emitted seq is the resulting frontier | SPEC §2 rule 2 requires increment-exactly-once-before-publish; amendment forbids a second sequence site | canonical-chat-event-applier.js | applier suite (frontier equality asserted) | Each accepted step advances streamSeq exactly once | none | none — uniform frontier invariant per ledger decision #1 | accepted_no_downstream_impact |
| S2-D6 | Handler order list started at bind gate | `control.touchThreadSession()` first in applyStepBegin | Sibling-handler convention + parent §4.6 lease touching for every canonical event | canonical-chat-event-applier.js | applier suite | Step receipt refreshes session lease like siblings | none | none | accepted_no_downstream_impact |
| S2-D7 | Ledger pre-check mechanism unspecified | Guarded getActiveDrain read (drainId-matched) instead of new manager API; authoritative enforcement stays the in-gate re-check | No extra API surface; read-only pre-check mirrors tool-event convention | canonical-chat-event-applier.js | applier suite | None | none | none | accepted_no_downstream_impact |
| S2-D8 | "Assert no canonical-admission references" | Realized as executable fs-based file-content guard test over touched files (text/tool events not yet in list — advisory A1) | Executable > manual assertion | canonical-chat-event-applier.test.js | guard test runs in suite | Test-level only | none | none | accepted_no_downstream_impact |

## Slice D deviations (run 2; orchestrator-final classifications, confirmed by acceptance reviewer)

| ID | Original contract | Actual change | Reason | Files | Tests | Observable effect | Risk | Downstream impact | Classification |
|---|---|---|---|---|---|---|---|---|---|
| S2-D9 | Repair packet: decide terminal usage retention explicitly | Terminal snapshots carry `usage: null` (`completeLiveTurn` clears the mirror) | `settleAccumulatorForTerminal` already resets accumulator usage on every terminal path; clearing keeps dual representations in exact agreement and avoids ghost usage on the completed overlay | live-turn-snapshot.js | turn_end tests; seq-10 reconstruction assert; terminal overlay assert | Terminal snapshots expose `usage: null` | none | SPEC-04 must not read usage from terminal snapshots | accepted_no_downstream_impact |
| S2-D10 | Packet named no mechanism for the snapshot usage mirror | New exported `setUsage(snapshot, usage)` helper (JSON-safe clone of 4 known fields + single `bump()`); status mutator calls it inside the same gated mutation | Keeps projection-write + frontier-advance atomic; prevents accumulator↔snapshot aliasing; reuses the single bump primitive (no second sequence site) | live-turn-snapshot.js, canonical-chat-event-applier.js | deep-clone independence test; frontier-once-per-status test | None beyond intended mirror | none (advisory: clones only tokenUsage — safe under primitive-valued harness contract) | none | accepted_no_downstream_impact |
| S2-D11 | Repair invariant: advance once via touch when parse fails | Implemented as before/after `streamSeq` comparison + conditional touchStatus inside the args mutator | Also covers degenerate paths where JSON.parse succeeds but applyToolArgs guards skip its bump — guarantees exactly-once for EVERY accepted publication per ledger decision #1 | canonical-chat-tool-events.js | both-orderings strictly +1 tests; mixed-turn contiguity | Unique seq even on degenerate chunks | none | none | accepted_no_downstream_impact |
| S2-D12 | Packet listed two R-FINDING-1 pin-tests | Added third test: rejected tool_call_args input → zero publication, byte-identical projection | §5 bullet 13 had no pin on the exact repaired handler path | canonical-chat-event-applier.test.js | itself | Stronger-than-minimum proof | none | none | accepted_no_downstream_impact |

## Run 2 child subagent register

| # | Role | Agent | Task ID | Terminal result |
|---|---|---|---|---|
| 10 | Slice D builder (resumed run 2) | spec-slice-builder | ses_fc68d9425fferD680aTZfvo1W9 | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 11 | Slice D builder-owned review | clean-room-reviewer (spawned by builder) | ses_fc675a6e1ffeDGgBnZv8E79h1E | CLEAN first pass, 0 material, 5 advisories (terminal) |
| 12 | Slice D orchestrator acceptance | clean-room-reviewer | ses_fc58aedd7ffey0KOBY8Ce5VDqo | CLEAN first pass, 0 material, 4 advisories A–D (terminal) |
| 13 | Final SPEC integration review | clean-room-reviewer | ses_fc58150deffePHfXre1HBEflFg | CLEAN first pass, 0 material, 5 advisories A1–A5 (terminal) |

## Final integration outcome (run 2)

SPEC gate green on final integrated bytes: exact §6 command **7 suites / 211 passed**; stale-symbol sweep clean; broader suite **82 suites / 813 passed / 1 skipped / 0 failed** (skip pre-existing; zero unrelated failures); boot smoke `SERVER_READY:3001` + clean SIGTERM shutdown. Downstream impact: SPEC-03 none · SPEC-04 compatible (consume wire union/snapshot as handed off; tolerate sequence-less legacy adapter shapes per decision #11) · SPEC-05 none. Status: **SPEC_READY_FOR_SUPERVISOR_REVIEW**.
