---
name: mc-spec-review-gate
description: Govern fail-forward independent review inside approved roadmap/SPEC execution and assigned Commit Supervisor integration jobs. Use for their distinct builder, acceptance, handoff and final gates; repair current bytes until clean and reserve holds for genuine missing authority, evidence or capability.
---

# SPEC Review Gate

Review the current work product rigorously, route evidenced corrections, and keep execution moving until the current bytes are clean or a genuine blocker remains.

## Boundary

- Apply this policy only inside an approved roadmap or SPEC execution chain, or an explicitly assigned accepted integration unit owned by a Commit Supervisor.
- Keep `$clean-room-loop` as the separate user-invoked check for ordinary primary-chat work.
- Review the supplied contract, current implementation, tests, and immediate integration surface.
- Review against the repository code-standards hub and routed standards pages supplied for the current slice/SPEC. A hard-rule conflict with approved behavior is material and must be surfaced; an optional preference without observable impact remains advisory.
- Do not invent product intent. Return `AUTHORITY_BLOCKED` only when contradictory or missing owner intent makes a necessary choice impossible.
- Treat the owner as trusted in a local single-owner development workspace. Owner edits and changing hashes are normal; re-review current bytes instead of treating drift as contamination or misconduct.

## Gate Scope

Keep each level distinct:

- Builder-owned review: slice implementation and immediate integration points.
- Orchestrator slice acceptance: slice contract, deviations, and accepted prerequisites.
- SPEC integration: cross-slice behavior and integrated SPEC criteria.
- Roadmap integration: cross-SPEC contracts and roadmap-level behavior.
- Commit Supervisor initial review: current accepted integration inputs, all five review lenses and evidence gaps; a clean initial result does not certify the final candidate.
- Commit Supervisor worker-handoff: one bounded repair or documentation output against its original assignment, current bytes and immediate seams. The manager assigns a fresh reviewer; leaf writers never accept themselves.
- Commit Supervisor final integration: whole current candidate, cross-source seams, accepted handoffs, all five lenses, known consumers and required checks. A fresh final orchestrator and reviewers must be independent of initial review and all repairs.

Reuse still-valid raw evidence while independently checking the broader contract owned by the current level. A higher gate cannot waive an unresolved lower-gate product defect, but it decides whether a reported deviation is acceptable, requires correction, or affects later work.

## Reviewer Runtime And Lifecycle

Use one fresh read-only `clean-room-reviewer` per pass. Give it the bounded raw packet, current paths or revision identity, acceptance criteria, validation evidence, and reported deviations without prior reviewer conclusions.

In an assigned Commit Supervisor job, proportionate disjoint lens coverage may use multiple fresh reviewers; one combined reviewer suffices with explicit coverage. Every successive gate/pass uses new identities without author/manager conversation, underlying author/research work or prior reviewer history. Preserve invoking root model/effort. Initial/final review reports `REVIEW_COMPLETE` with `clean`, `findings` or `insufficient-evidence`; manager-recorded `HANDOFF_VALIDATED` requires a clean fresh assignment gate. These returns do not replace owner approval or runtime handoff.

After each terminal reviewer result, record its identity and result and attempt `close_agent` when available. Missing closure is lifecycle evidence only. Block only on an active conflicting writer, an actual spawn rejection with no usable alternative, or another substantive execution impossibility.

## Materiality And Severity

Require all four for a material finding:

1. violated owner decision, approved criterion, invariant, or required handoff;
2. affected artifact or execution path;
3. realistic observable impact; and
4. direct source, diff, test, runtime, rendering, or reproducible evidence.

Classify findings:

- `critical`: realistic data loss/corruption, security boundary failure, irreversible wrong action, unusable core flow, or contradictory intent;
- `high`: common-flow incorrectness, cross-component divergence, lifecycle failure, or severe regression;
- `material`: another evidenced acceptance violation with observable impact;
- `advisory`: style, speculative hardening, future scope, optional polish, or unsupported edge cases.

Advisories coexist with `CLEAN`. Do not promote a finding because it is novel, because a prior pass missed it, or because a file changed during review.

## Fail-Forward Review Loop

Stop after the first materially clean pass. Until then:

1. Validate all reported material findings independently.
2. Return one consolidated repair packet to the responsible builder.
3. Permit the smallest correct implementation, including mechanically necessary files or integration work omitted by the SPEC's advisory file list.
4. Require the builder to record every out-of-scope touch or SPEC deviation with its reason, authority, observable effect, tests, and downstream impact.
5. Rerun only invalidated checks during repair, then run the required cumulative gate before handoff.
6. Review the repaired current bytes with a fresh reviewer.

There is no arbitrary discovery-pass ceiling and no instability verdict based only on finding count, novelty, severity trend, or changed hashes. Repeated findings from one root cause require a root-cause repair, not a terminal label. New findings require correction, not abandonment.

Continue the loop while executable work remains. Return terminal `BLOCKED` only when work literally cannot proceed because of an external/runtime impossibility. Return `AUTHORITY_BLOCKED` only for an owner decision that cannot be inferred safely. Test failures, missing file authorization, stale hashes, incomplete evidence, or review findings are repair work, not terminal states.

For Commit Supervisor jobs, route the consolidated packet through the Supervisor to a bounded leaf repair worker. Missing independent review capability/evidence is `unmet-gate`; necessary intent is `needs-owner`; an absent prerequisite is `waiting-dependency`. Include checked sources, exact question/evidence, provider/consumer, resolver and observable release condition. Preserve independent progress, do not dispatch an unapproved feature or prerequisite build, and investigate a repeated no-progress root cause rather than retrying guesses. Deferred material findings stay open. These operational phase holds do not change the existing builder/SPEC/roadmap terminal rules.

## Scope And Deviation Policy

- The approved SPEC defines intended behavior, not an exhaustive file allowlist.
- Implement omitted mechanical integration needed to make the behavior real.
- Do not start an unrelated later feature merely because nearby code is convenient.
- Bank genuine product choices for the owner while continuing every independent task.
- The orchestrator classifies each deviation as `accepted`, `repair_required`, `owner_ruling_required`, or `downstream_impact`.
- No deviation is silent. Include it in builder, orchestrator, SPEC, and supervisor reports until the supervisor and owner have reviewed it.
- Assigned integration jobs use the same four deviation classifications, owned by the Commit Supervisor; workers propose classifications and reviewers report without granting scope. See [workflow](../mc-commit-supervisor/references/workflow.md) for raw findings, stable disposition history and evidence records.

## Invalidation And Current Bytes

- Re-review changed product, runtime, schema, state-machine, migration, fixture, or oracle bytes that affect a claim.
- Preserve valid evidence outside the changed dependency surface.
- A hash identifies reviewed bytes for provenance; a hash change is not itself a defect.
- If bytes change during review, finish or pause the active writer, identify the current work product, rerun affected checks, and review those current bytes.
- Never reject solely because the owner edited a file or because current bytes differ from an earlier manifest.

## Passing The Gate

Return `CLEAN` when:

- current bytes satisfy the owner-approved behavior;
- required applicable checks pass;
- no validated material product finding remains;
- every deviation is recorded at every gate; builder-owned gates include a proposed classification, while orchestrator and supervisor gates require classification by that owning level;
- residual risks are explicit; and
- reviewer lifecycle evidence is recorded.

Report gate level, current candidate identity when useful, reviewer identities, findings and repairs, invalidated/rerun evidence, deviations, downstream impacts, advisories, residual risks, and final `CLEAN`, `BLOCKED`, or `AUTHORITY_BLOCKED`.

## Local session contract

Read [session-contract.md](../../../session-contract.md) before assigning or editing work. Use the explicit memory folder and implementation checkout; preserve instruction discovery and assigned manager/reporting boundaries. Creation of these procedures does not authorize a build or activate Mission Control.
