# Multi-Agent Scope Autonomy and Convergence-Loop Lessons

Distilled from the OE-009 Office Editor roadmap run (2026-07-12 → 07-13): two SPECs accepted through a stack of GPT builders, GPT internal clean-room loops, a Claude orchestrator, and Claude Opus acceptance reviews. Everything below is grounded in what actually happened, not theory.

## 1. Workers going outside scope

Four scope deviations occurred across two SPECs. Every one of them followed the same pattern: **the packet's file list under-scoped a behavior the bundle's own normative text already required.**

- Fixture variant selection needed `fixture-lifecycle.mjs` (the catalog contract promised the variant would work).
- Metadata publication needed `useCrepeEditor.ts` (guidance required exactly one dirty/save per Forward/Undo/Redo — that file owns the callbacks).
- Logical column counting needed `officeTableNodeView.ts` (guidance literally says "never first-row physical cell count" — that file held the computation).
- Malformed-metadata browser tests needed two extra fixture variants (the SPEC required the pruning behavior; "never renders" is only checkable in a browser).

Zero deviations were creep. The workers weren't wandering — the packets were imperfect maps of where required behavior lives. Frozen-packet processes should *expect* this failure mode.

**When to accept without asking the owner** (all must hold):

1. The bundle/roadmap's own text already requires the behavior — the deviation is the *vehicle*, not the intent.
2. The change is additive and useful, not a rewrite of accepted work, and describable in one sentence without "and."
3. It does not add meaningful new complexity or bug surface relative to what it enables.
4. Full validation + independent review gates cover it.
5. The ratification and its grounding get *recorded* (audit trail is what makes autonomy safe).

**When to stop and ask the owner:** product-observable behavior changes; contract/schema changes; removals or rewrites of previously accepted work; anything where you cannot cite the normative sentence that requires it. Rule of thumb: *if the grounding is a quote, ratify; if the grounding is a preference, ask.*

## 2. Tight management vs. autonomy

The overnight data is unambiguous: **permission prompts are where time goes to die.** The single worst stall (2+ hours) was a worker sitting at an interactive approval prompt while the owner slept. Meanwhile, workers operating under recorded standing delegations moved continuously and produced auditable, reviewable work.

Manage agents by **contract + gates + audit trail**, not by interactive permission:

- The contract (SPEC/guidance) defines intent — make it authoritative and say so explicitly.
- The gates (validation, regression, independent review) catch deviation — they are the real control surface.
- The audit trail (rulings recorded with grounding) preserves owner authority after the fact.
- Interactive prompts should be reserved for the "stop and ask" list above — and routed through an async file protocol (a `NEEDS_RULING` status in a shared report file) rather than a blocking terminal prompt, so nobody stalls while a human sleeps.

## 3. Is the clean-room loop worth it?

Yes — with sharp diminishing returns that must be managed structurally.

**Evidence for:** on the hardest slice (the table-mutation atomicity core), internal clean-room passes 1–4 found genuine data-corruption-class defects that all passing tests missed: a shell-expansion isolation bypass, undo bleeding into text history, double save schedules, non-atomic internal stores. Separately, a *cross-family* reviewer (Claude Opus reviewing GPT-built work) caught a scope deviation that nine same-family reviews had looked straight past. Fresh eyes work; *differently-shaped* fresh eyes work better.

**Evidence against (the burden):** that same slice took **nine** rejection cycles (~10 hours). Findings narrowed each round — from "corrupts data" to "the Step's JSON codec isn't provably lossless." Meanwhile, once the core locked, the next two slices passed in 78 and 45 minutes with 1–2 passes each. The loop wasn't broken; it was pointed at an artifact too big and too foundational to converge quickly, at maximum reviewer strength, with no cap.

## 4. Convergence heuristics

**H1 — Cap passes, promote residuals.** Internal clean-room loops get a hard cap (3 passes). Unresolved findings at the cap are not dropped — they're *promoted* to the next gate up (the orchestrator's acceptance review), which has different eyes anyway. A 7th pass with the same reviewer model is worth less than a 1st pass at the next layer.

**H2 — The failure-scenario test (how an agent decides "fix it" vs. "close the loop").** A finding must be fixed *now* if the reviewer can state a concrete failure scenario: specific input/state → wrong observable outcome, *within the contract's own scope*. If no concrete scenario can be articulated, or the scenario lives in a future SPEC's domain, it is recorded as a residual/forward note and the loop may close. "This could theoretically be cleaner" is not a failure scenario. This one rule answers most close-or-continue questions.

**H3 — Watch the finding-class trend, not the count.** Defect counts oscillated (5→3→2→4→2…) and were noisy; the *class* of findings moved monotonically: data corruption → history exactness → publication timing → codec losslessness → test completeness. When two consecutive passes produce findings only in classes below the contract's acceptance bar (coverage-of-covered-behavior, style, hypotheticals with no scenario), close.

**H4 — Escalate diversity, not iterations.** After ~3 same-model passes, a different model family (or a different vantage: whole-diff vs per-slice, code-first vs contract-first) finds more per token than another same-model pass. The catalog-scope catch came from exactly this.

**H5 — Keep review close to the diff.** Per-slice review of small diffs converged in 1–2 passes; the same machinery pointed at a whole subsystem looped for hours. If a loop isn't converging, the artifact is usually too big — split the review surface before adding passes.

**H6 — Match reviewer strength to blast radius, not uniformly.** Strong reviewers on data-integrity/sync/codec work; small-fast reviewers (Luna-class) on presentation/menu work, where the worst escape is cosmetic and the acceptance gate backstops it. Current Codex-side setup reflects this: Luna Medium and Terra High agents handle internal review; Sol is reserved for building, not for looping reviews.

## 5. Recommended default stack (as of 2026-07-13)

1. Builder (strongest model justified by tier) with self-review.
2. Internal clean-room: small/fast reviewer, loop until clean **or 3-pass cap**, residuals promoted with H2 applied.
3. Orchestrator acceptance: independent validation rerun (build/lint/full suites/smokes — never skipped, they're cheap and deterministic), scope containment vs recorded rulings, contract walk.
4. Cross-family acceptance reviewer (cold context, read-only), loop until CLEAN — this is where H4's diversity dividend lives.
5. Owner touchpoints: manual smokes, product-intent rulings, and nothing else.

The meta-lesson: the expensive failures in this run were never "an agent did something dumb." They were *coordination* failures — prompts nobody answered, packets that under-scoped, loops without exits. Fix the coordination structure and the agents' intelligence takes care of the rest.

## Addendum (2026-07-14): spec-writing lessons from the same run

1. **Intent readback before freezing.** The costliest defect was flawless specification of wrong intent (the color cascade the owner didn't want). Before a behavior contract freezes, walk the owner through 3–5 plain-language scenarios of what a user will observe. Exactness amplifies whatever intent it's given — verify the intent first.
2. **Scenarios in the spec, not just invariants.** Builders misimplement abstract clauses (SPEC-02B's clear-path pruning) far more than concrete scenario lines ("clear the row: covered cells stay painted"). Scenario lines double as acceptance tests. Invariants are for reviewers; scenarios are for builders.
3. **Expected Changed Areas are advisory.** Every scope stall came from file lists; none from behavior text. Mark file lists "expected, not exhaustive — request a ruling for extensions" and let the delegation protocol absorb the gaps.
4. **Tier the exactness: MUST vs SHOULD.** MUST = anything with an articulable failure scenario (data integrity, atomicity, undo-exactness) — keep maximal precision, it caught real corruption bugs. SHOULD = quality/lossless/style clauses — reviewer discretion, not loop fuel. This is the spec-side twin of the reviewer-side failure-scenario heuristic.
5. **Unchanged:** single-domain SPECs, exact validation commands, slice gates, cumulative regression contracts, and terminal report formats all earned their keep — as did precision itself, wherever the blast radius justified it.

## Addendum (2026-07-15): sizing and role lessons

1. **Don't slice smaller — verification dominates wall-clock.** Cumulative regression gates rerun per slice and per review pass; thinner slices multiply gate executions and produce fragments that can't be independently smoke-tested (which reignites review churn). Vertical 3-4-slice SPECs with one final cumulative gate were the right shape.
2. **Give 01.1-class artifacts their own SPEC.** A cross-cutting core that everything downstream consumes (the mutation/undo atomicity bridge took ~10h and nine review cycles as "slice 1 of 4") should be a dedicated SPEC so its convergence loops don't hold sibling slices hostage, and so its acceptance is a roadmap-visible milestone.
3. **Sub-process supervisor layers are fragile; humans are a fine transport.** The Codex-internal four-level hierarchy broke on plumbing (agent routing, model pinning, sentinel mapping). The working topology: the planning AI session IS the supervisor; the human hand-carries packet paths to interactive orchestrator sessions; a shared report file is the entire coordination protocol. Fewer moving parts than any automated bridge we tried, and every failure is visible.
4. **Wall-clock trust: a run that lands accepted on the first coherent handback beats anything you could slice it into.** Spec quality (scenario contracts + intent readback) is the highest-leverage speed optimization, demonstrated by SPEC-02C's first-pass CLEAN after its predecessor's five correction cycles.
