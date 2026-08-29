# RCC-0108 SPEC-02 Terminal Report — Server Step Activity and Stream Frontier

**Status:** `SPEC_READY_FOR_SUPERVISOR_REVIEW`

**Orchestrator:** spec-orchestrator (resumed run 2; prior run killed by transient provider/infrastructure error mid-Slice-D, before any Slice-D terminal report)
**Worktree:** `/Users/rccurtrightjr./projects/fs-dev-rcc-0108` · branch `agent/rcc-0108-roadmap` · nothing committed (isolation contract preserved)
**Baseline:** `4f972c5` + accepted SPEC-01 uncommitted bytes (authoritative integration baseline, not contamination)
**Date:** 2026-08-25
**Ledger:** `RCC-0108-SPEC-02-orchestrator-ledger.md` (extended in place, not discarded)

---

## 1. Resume authentication summary

The prior run had ACCEPTED Slices A/B/C (each with builder-owned CLEAN + orchestrator acceptance CLEAN on their bytes) and died while writing Slice-D bytes across the broadcaster, router, bridge, applier modules, snapshot/accumulator/runtime files, and two new test files — with no terminal report.

This run did NOT replay A/B/C. It authenticated current bytes against the prior ledger:

- **Slices A/B/C:** bytes match ledger decisions #1–#10 and deviations S2-D1..D8; no contradiction found. Verified concretely: both OpenCode spellings translate to canonical `step_begin` (`json-event-translator.js:134`, `translateStepBegin :229`); `step_begin` excluded from useful output (`opencode/index.js:84-89`); identity-before-time ordering + full-turn ledger + one captured now (`canonical-chat-event-applier.js:243-338`); suppression inside the gated mutator before any mutation (`canonical-chat-text-events.js:64-79`); terminal clears with conditional revision bump (`live-turn-snapshot.js:completeLiveTurn`).
- **Inherited Slice-D bytes (unreviewed ⇒ unvalidated per resume rule 2):** verified against §3.D — sequenced status_update/subagent/terminal publications through `applyLiveMutation`; bound `turnId` incl. status_update; legacy StepBegin router branch deleted without shim (test-pinned `message-router.test.js:87-104`); `chat:step_begin` via compatibility bus only; companion live-error boundary intact per decision #7.
- **Arrival state:** exact gate green at 7 suites / 206 tests; stale-symbol sweep clean on `lib`.

**Two orchestrator findings routed to the builder as required repairs (both repaired and re-gated):**

- **F1 (`repair_current_spec`):** accepted-but-unparseable `tool_call_args` chunks published with a REPEATED `streamSeq` (`applyLiveMutation` returns the unchanged frontier when no snapshot helper bumps). Violated ledger decision #1 (uniform frontier: tool_* bump exactly once), SPEC §2 rule 2, §3.D rule 3, and roadmap §5.3 contiguous client drain (≤baseline messages are dropped → chunk loss). Repaired: exactly-once advance per accepted publication via before/after frontier comparison inside the single gated mutation (`canonical-chat-tool-events.js:206-215`), pinned both orderings.
- **F2 (`repair_current_spec`):** usage/status projection published by `chat:status_update` at seq N lived only on the runtime accumulator; the served snapshot had no usage field, so state at N was not reconstructible from any snapshot. Violated SPEC §2 rule 8 sentence 1 and roadmap §5.2. Repaired: JSON-safe `usage` mirror written inside the same gated mutation (`setUsage`, `live-turn-snapshot.js:134-143`; applier `:207-217`), explicit `usage: null` init at begin, terminal retention decision documented (cleared — accumulator symmetry).

**Boundary ruling recorded as authorized decision #11:** disabled legacy adapters `lib/harness/clis/{gemini,qwen,claude-code,codex}/index.js` emit direct unsequenced `chat:status_update`/`chat:turn_end` bus events — pre-SPEC compatibility emitters outside the accepted-canonical drain path; parent §4.11 forbids retrofitting non-OpenCode adapters; broadcaster test pins their byte-compatibility.

## 2. Slice-by-slice completion

| Slice | Scope | State | Gates earned (all on final current bytes unless inherited-accepted) |
|---|---|---|---|
| A | Harness translation: canonical StepBeginEvent, both OpenCode spellings, finite-timestamp preservation only, non-empty id preservation, step_begin excluded from useful-output predicate | ACCEPTED (prior run; re-authenticated this run) | builder READY + builder review CLEAN 1st + acceptance CLEAN 1st (prior run identities in ledger rows 1–3) |
| B | Identity & activity: dedupe BEFORE time normalization, single captured now, activityRevision only on real transitions, full activity/cursor/ledger/revision in snapshot, terminal clears | ACCEPTED (prior run; re-authenticated) | same (ledger rows 4–6) |
| C | Renderable-output suppression before ANY mutation; exact continuation; first renderable clears Working once | ACCEPTED (prior run; re-authenticated) | same (ledger rows 7–9) |
| D | Sequenced publication: streamSeq+turnId on every in-flight shape; each publication represented by snapshot projection; DELETE legacy StepBegin branch + stepNumber (no shim); chat:step_begin via compatibility bus only | **ACCEPTED (this run)** | builder READY (`ses_fc68d9425fferD680aTZfvo1W9`) + builder-owned review CLEAN 1st pass (`ses_fc675a6e1ffeDGgBnZv8E79h1E`) + orchestrator inspection CLEAN + acceptance CLEAN 1st pass (`ses_fc58aedd7ffey0KOBY8Ce5VDqo`) |
| Final integration | Cross-slice contracts, all §7 criteria, all §5 bullets, compatibility posture, single-frontier proof | **CLEAN** | final-integration reviewer CLEAN 1st pass (`ses_fc58150deffePHfXre1HBEflFg`) |

## 3. Changed-file manifest (whole SPEC vs baseline `4f972c5`)

SPEC-01's accepted files are part of these same dirty bytes; entries below state each file's SPEC-02 purpose. ⚑ = touched by this run's Slice-D repairs.

**Modified product (12):**

| File | Purpose |
|---|---|
| `lib/harness/types.js` | Canonical `StepBeginEvent` type (provider-neutral) |
| `lib/harness/opencode/json-event-translator.js` | Both `step_start` / part `step-start` spellings → `step_begin`; finite-timestamp + non-empty-id preservation; ahead of synthesized-time fallback |
| `lib/harness/opencode/index.js` | `step_begin` excluded from useful-output predicate (step-only clean exit still fails closed) |
| `lib/thread/live-turn-snapshot.js` ⚑ | Snapshot owns activity/cursor/seenStepIdentities/activityRevision projection; init at begin; `setUsage` mirror (JSON-safe clone + single bump); terminal path clears transient fields + usage, bumps revision iff real clear |
| `lib/thread/thread-runtime-manager.js` | Drain authority API: claim/bind-once/compare-current/`applyLiveMutation`(→resulting streamSeq)/terminalizeTurn/clear-if-current |
| `lib/thread/thread-runtime-controller.js` | Claim-before-iteration interactive path; bound-control stop synthesizing interrupted turn_end through the sequenced terminal path |
| `lib/thread/thread-runtime-automation.js` | Headless parity: claim/bind/drain through identical applier/bridge composition |
| `lib/wire/canonical-chat-event-applier.js` ⚑ | Drain-driven dispatcher; step_begin identity/dedupe/normalization handler; sequenced status_update (+usage mirror) & subagent handlers; turn_begin emits initial frontier |
| `lib/wire/canonical-chat-text-events.js` | Content/thinking accumulation with in-gate blank suppression + Working-clear revision bump; sequenced emissions |
| `lib/wire/canonical-chat-tool-events.js` ⚑ | Tool lifecycle; enforcement bounce; R-FINDING-1 repair: exactly-one frontier advance per accepted args chunk |
| `lib/wire/canonical-chat-terminal-events.js` | turn_end assembly from post-terminalize clone (final frontier + post-clear revision); idempotent terminalize; clear-if-current |
| `lib/wire/canonical-harness-event-bridge.js` | step_begin forwarded verbatim (timestamp untouched); bind-once of accepted begin result |

**Modified product (2, wire surface):**

| File | Purpose |
|---|---|
| `lib/wire/message-router.js` | Legacy direct `StepBegin` ws.send branch + `stepNumber` DELETED (no shim); generic unknown-event forward only; bindDrainTurn composition |
| `lib/wire/wire-broadcaster.js` | Every in-flight shape forwards scope/threadId/turnId/streamSeq 1:1; activityRevision on step_begin/content/thinking/tool_call/turn_end; post-terminal ack family unchanged |

**Modified tests (6):** `json-event-translator.test.js`, `harness-send-message.test.js`, `canonical-harness-event-bridge.test.js`, `canonical-chat-event-applier.test.js` ⚑ (incl. sequenced-publication describe + R-FINDING pins), `thread-crud-live-turn.test.js` ⚑ (served-overlay reconstruction pins), plus controller/automation suites (SPEC-01 slice D coverage retained).

**New for SPEC-02 (2):**

| File | Lines | Purpose |
|---|---|---|
| `test/wire/message-router.test.js` | 282 | Router transport guard; StepBegin generic-path no-shim pin; auth_error classification; live bind-once composition proof |
| `test/wire/wire-broadcaster.test.js` | 343 | Per-shape bus→wire mapping incl. status_update turnId/streamSeq gain; byte-compat legacy shapes; post-terminal family sequence-less; drop paths |

(Also present, created by accepted SPEC-01 and extended by SPEC-02 slices B/C/D: `canonical-drain-context.js`, `canonical-turn-accumulator.js`, `canonical-chat-{text,tool,terminal}-events.js`, their tests, and `prompt-canonical-route.integration.test.js`.)

## 4. Exact acceptance gate — command and results

```bash
cd fusion-studio-server && npx jest --runInBand \
  test/harness/opencode/json-event-translator.test.js \
  test/harness/opencode/harness-send-message.test.js \
  test/wire/canonical-harness-event-bridge.test.js \
  test/wire/canonical-chat-event-applier.test.js \
  test/wire/message-router.test.js \
  test/wire/wire-broadcaster.test.js \
  test/thread/thread-crud-live-turn.test.js

if rg -n "case ['\"]StepBegin['\"]|stepNumber|streamRevision" lib; then
  echo "stale RCC-0108 symbols remain"; exit 1
fi
```

Run on FINAL current bytes four independent times: builder post-repair (**211/211 passed**, sweep clean), orchestrator (**211/211**, sweep clean), slice-acceptance reviewer (**211/211**, sweep clean reproduced), final-integration reviewer (**211/211**, sweep clean). Arrival baseline on inherited partial bytes was 206/206 (pre-repair).

## 5. Other checks

| Check | Result |
|---|---|
| Full server suite `npx jest --runInBand` | **82 suites, 813 passed, 1 skipped, 0 failed** (builder, orchestrator, and both reviewers independently on final bytes; skip is pre-existing; zero unrelated failures to document) |
| Boot smoke `node server.js` | `SERVER_READY:3001` (orchestrator-run); subscribers started (WireBroadcaster/Audit/etc.); clean SIGTERM shutdown — watchers released, DB closed, cleanup complete |
| Single-frontier proof | `streamSeq += 1` solely in `live-turn-snapshot.js:bump()`; init `streamSeq:1` at begin; every publication derives seq from `applyLiveMutation` or the post-mutation clone; automation path uses identical applier/bridge composition; no second counter anywhere |
| Compatibility posture | `publishCanonical`/`AcceptedCanonicalRef`/canonical-admission: zero product references (only the negative-guard regex in a test); executable fs guard over touched files; chat:* stays on pre-40b2 compatibility bus; broadcaster byte-compat pins for legacy shapes |
| Shared-path provider syntax | Zero OpenCode tokens outside `lib/harness/opencode/` |
| §5 bullet coverage | All fifteen bullets covered by named tests on final bytes (full table in final-integration reviewer evidence; summarized in §2/§7 criteria verification) |
| Stop path coherence | Interrupted turn_end synthesized through bound context into the SAME sequenced terminal path — no second publication route |

## 6. Deviation ledger (complete: inherited S2-D1..D8 + new S2-D9..D12)

Full field detail lives in the ledger file; summary here. Inherited from prior run, carried forward unchanged and re-authenticated:

| ID | Slice | One-line substance | Classification |
|---|---|---|---|
| S2-D1 | A | Identifiers trim-gated for emptiness but returned verbatim/untrimmed | accepted_no_downstream_impact |
| S2-D2 | A | Part extraction hoisted; step check precedes synthesized-time fallback | accepted_no_downstream_impact |
| S2-D3 | A | Shared types.js avoids native provider token even in comments | accepted_no_downstream_impact |
| S2-D4 | A | Part-spelling e2e envelope omits top-level type field (stronger-than-minimum) | accepted_no_downstream_impact |
| S2-D5 | B | `touchStatus` inside step mutator so emitted seq is resulting frontier (decision #1 uniform invariant) | accepted_no_downstream_impact |
| S2-D6 | B | `touchThreadSession()` first in applyStepBegin (sibling convention, parent §4.6 lease touching) | accepted_no_downstream_impact |
| S2-D7 | B | Guarded getActiveDrain read as ledger pre-check instead of new manager API | accepted_no_downstream_impact |
| S2-D8 | B | "Assert no canonical-admission references" realized as executable fs guard test | accepted_no_downstream_impact |

New this run (orchestrator-final classifications, confirmed by acceptance reviewer):

| ID | Slice | Original contract | Actual change | Reason | Files | Tests | Observable effect | Risk | Downstream impact | Classification |
|---|---|---|---|---|---|---|---|---|---|---|
| S2-D9 | D | Repair packet: decide terminal usage retention explicitly | Terminal snapshots carry `usage: null` (mirror cleared in completeLiveTurn) | Accumulator already resets usage at terminal; keeps dual representations in agreement; avoids ghost usage on completed overlay | live-turn-snapshot.js | turn_end + seq-10 reconstruction + terminal overlay asserts | Terminal snapshots expose usage:null | none | SPEC-04 must not read usage from terminal snapshots | accepted_no_downstream_impact |
| S2-D10 | D | Packet named no mechanism for snapshot usage mirror | New exported `setUsage(snapshot, usage)` (JSON-safe clone of 4 fields + single bump) called inside the status gated mutation | Keeps projection-write + frontier-advance atomic; prevents aliasing; reuses single bump primitive (no second sequence site) | live-turn-snapshot.js, canonical-chat-event-applier.js | deep-clone independence test; frontier-once-per-status test | None beyond intended mirror | none (advisory: clones only tokenUsage — safe under primitive-valued contract) | none | accepted_no_downstream_impact |
| S2-D11 | D | Repair invariant: touch once when parse fails | Before/after streamSeq comparison + conditional touchStatus inside args mutator | Also covers degenerate parse-success-but-guard-skipped paths; guarantees exactly-once per accepted publication (decision #1) | canonical-chat-tool-events.js | both-orderings strictly +1 tests; mixed-turn contiguity | Unique seq even on degenerate chunks | none | none | accepted_no_downstream_impact |
| S2-D12 | D | Packet listed two R-FINDING-1 pin-tests | Third test added: rejected args input → zero publication, byte-identical projection | §5 bullet 13 lacked a pin on the exact repaired handler | canonical-chat-event-applier.test.js | itself | Stronger-than-minimum proof | none | none | accepted_no_downstream_impact |

**Counts by classification:** accepted_no_downstream_impact 12 · accepted_update_downstream_packet 0 · repair_current_spec 0 formal deviations (findings F1/F2 were orchestrator-directed intra-slice repairs, completed and validated through the full gate chain before acceptance; their implementation-shape deltas are S2-D10/S2-D11/S2-D12) · invalidate_accepted_dependency 0 · owner_ruling_required 0.

## 7. Child subagent identities and terminal results (this run)

| # | Role | Agent | Task ID | Terminal result |
|---|---|---|---|---|
| 10 | Slice D builder | spec-slice-builder | ses_fc68d9425fferD680aTZfvo1W9 | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 11 | Slice D builder-owned review | clean-room-reviewer (spawned by builder) | ses_fc675a6e1ffeDGgBnZv8E79h1E | CLEAN first pass; 0 material; 5 advisories (terminal) |
| 12 | Slice D orchestrator acceptance | clean-room-reviewer | ses_fc58aedd7ffey0KOBY8Ce5VDqo | CLEAN first pass; 0 material; 4 advisories (terminal) |
| 13 | Final SPEC integration review | clean-room-reviewer | ses_fc58150deffePHfXre1HBEflFg | CLEAN first pass; 0 material; 5 advisories (terminal) |

Every spawn terminated normally; no missing closure; no active conflict at any sibling spawn; no spawn rejections. Exactly one slice writer active at any time. Every descendant inherited the invoking root thread's model/reasoning effort; none pinned or substituted. Prior-run children (#1–#9) remain recorded in the ledger. Each gate stopped at its first clean pass.

## 8. Residual risks, skipped checks, temporary adapters

- **Residual risks:** (1) sequence-less `chat:status_update`/`chat:turn_end` from disabled legacy adapters persist until owner-directed retrofit (decision #11) — SPEC-04 client gating must tolerate sequence-less shapes; (2) companion routed errors remain unsequenced notifications (decision #7); failure-path terminalization slot stays vacant for SPEC-03 (SPEC-01 DEV-5); (3) until SPEC-03 lands, error-failed turns retain an in_flight snapshot with warn-logged leftover drain record replaced on next claim (baseline-identical); (4) wire `status_update` omits messageId/planMode and wire `turn_begin` omits attachments — baseline-faithful forwarding sets; all fields reconstructible from the snapshot mirror (advisories A1/A2 for SPEC-04 awareness).
- **Skipped checks:** client build/Playwright — not in SPEC-02's gate (client work owned by SPEC-04/05 per roadmap §7). Server boot smoke WAS run.
- **Temporary adapters:** none. No migrations. No shims (StepBegin deletion verified shim-free by sweep + test).

## 9. Handoff to SPEC-03 (SPEC §8 — required fields)

**Final server wire union after SPEC-02** (every outbound chat-derived wire message carries `scope:'project'` + `threadId`; optional keys omitted when unset):

| Wire type | Fields beyond scope/threadId |
|---|---|
| `turn_begin` | turnId, streamSeq, userInput |
| `step_begin` | turnId, streamSeq, identity, startedAt, activityRevision, [stepId], [messageId] |
| `content` / `thinking` | turnId, streamSeq, activityRevision, text |
| `tool_call` | toolName, toolCallId, turnId, streamSeq, activityRevision |
| `tool_call_args` | toolCallId, argsChunk, turnId, streamSeq |
| `tool_result` | toolCallId, toolArgs, toolOutput, toolStatus, toolDisplay, returnedDiff, isError, turnId, streamSeq (bounce results additionally carry enforcementPhase on the bus/snapshot part) |
| `subagent_event` | turnId, streamSeq, parentToolCallId, agentId, subagentType, subagentEventType, subagentPayload |
| `status_update` | turnId, streamSeq, contextUsage, tokenUsage |
| `turn_end` | turnId, streamSeq, activityRevision, fullText, hasToolCalls, userInput, parts, reason, partial |
| Post-terminal family (NEVER streamSeq) | `exchange_metadata` {turnId, ts, userInput, metadata}; `chat-turn:saved` {turnId, exchangeId, seq, ts, partial, reason, metadata} |

**Final LiveTurnSnapshot shape (JSON-safe; served verbatim on thread-open):**
`{ workspaceId, scope, threadId, turnId, userInput, attachments[], status: 'in_flight'|'complete'|'interrupted', fullText, parts: [{type:'text'|'think', content} | {type:'tool_call', toolCallId, name, arguments, result}], activity: TurnActivity|null, stepCursor: {identity,startedAt}|null, seenStepIdentities: string[], activityRevision: number, usage: {contextUsage, tokenUsage, messageId, planMode}|null, streamSeq: number (starts 1), updatedAt }`

**Binding notes for SPEC-03 (per supervisor instruction):**
- SPEC-03 extends `turn_end` and error snapshots WITHOUT changing the frontier algorithm and WITHOUT adding an alternate terminal publication path — `turn_end` remains the sole sequenced terminal publication (post-terminalize clone read; final frontier; post-clear activityRevision).
- SPEC-03 owns failure-path canonical terminalization through the existing `terminalizeTurn(key, {drainId, turnId}, status)` / bound-context machinery. The exception-path slot is deliberately vacant (SPEC-01 DEV-5); today an exception-failed turn leaves an in_flight snapshot + leftover record replaced-with-warn on next claim.
- Companion live-error boundary stands per ledger decision #7: direct `auth_error`/`error` sends stay unsequenced transport notifications; SPEC-03 owns routing them into bound terminalization where a target turn exists.
- Disabled legacy adapter emissions remain unsequenced by decision #11; do not treat them as terminal publications.

## 10. Acceptance criteria recap (SPEC §7, 1–10)

All ten verified on final integrated bytes by the final-integration clean-room review with file:line evidence: canonical-only step translation (1); no provider syntax in shared path (2); dedupe before normalization (3); full-turn ledger blocks delayed replay (4); blank new parts never mutate live/durable output (5); exact resulting streamSeq on every accepted publication (6); snapshot/publication atomicity proven clone-at-each-sequence (7); activityRevision narrower than streamSeq (8); legacy branch/stepNumber/duplicate counter absent (9); focused gate green (10).
