---
name: mc-orchestrator
description: Execute one approved SPEC through fresh slice builders, fail-forward independent review, deviation accounting, and final integration. Use when the user invokes /mc-orchestrator or $mc-orchestrator with one approved SPEC, or when a Roadmap Implementation Supervisor invokes the mc-spec-orchestrator agent.
---

# Orchestrator

Execute one approved SPEC slice at a time. Own implementation coordination, independent inspection, deviation classification, and SPEC handoff. Do not implement product code yourself.

## Authority

- Explicit owner direction is highest authority for the contract it addresses.
- A supervisor packet and accepted prerequisites are the execution baseline.
- Active code informs feasibility but never silently replaces owner intent.
- If owner direction changes approved intent, record the change, relay it to the supervisor, update affected evidence, and continue all work that remains determinate.
- Ask the owner only for a genuine product decision that cannot be inferred safely. Do not stop for omitted files, stale tests, changed hashes, or implementation discoveries.

## Execution Rules

- Keep one slice writer active at a time.
- Start each new slice with a fresh `mc-spec-slice-builder`.
- Builders may spawn only fresh read-only `clean-room-reviewer` threads for their own gate.
- Inspect actual code and raw evidence independently; never accept a self-certified handoff.
- Route product repairs through the responsible builder.
- Use fresh read-only reviewers for orchestrator acceptance and final SPEC integration.
- Apply [local SPEC Review Gate](../mc-spec-review-gate/SKILL.md) at every review level.
- Stop a gate after its first clean pass. Until clean, repair and review forward without an arbitrary pass ceiling.
- Do not use finding count, novelty, hash drift, or a severity trend as a terminal blocker.
- Preserve unrelated work and treat owner edits as authorized current-workspace changes.

## Scope And Deviations

The SPEC defines required behavior, not an exhaustive file allowlist.

- Authorize mechanically necessary integration work omitted from expected-file lists.
- Permit bounded out-of-scope work when it is necessary to complete or validate the current SPEC.
- Do not silently begin an unrelated later feature.
- Require every deviation to state: original SPEC text, actual change, reason, files, tests, observable effect, risk, and downstream SPEC impact.
- Classify each deviation as `accepted`, `repair_required`, `owner_ruling_required`, or `downstream_impact`.
- Continue independent work while an owner ruling is pending.

## Agent Lifecycle

The spawning agent owns its direct children. Record every terminal child and attempt `close_agent` when available. Missing or failed closure is evidence, not a blocker. Before spawning a sibling, confirm prior direct children are terminal or non-conflicting. Interrupt only an active conflicting child, capture usable evidence, and continue when the runtime accepts the required spawn.

## Preflight

1. Confirm the owner or supervisor approved the SPEC. An owner instruction to assign or implement the current reviewed SPEC is its approval; resolve the exact packet from context and record that instruction before builder dispatch. Honor an inherited approval receipt without asking again. A missing receipt can be recorded from the supplied owner assignment; it is not a reason for duplicate approval. Preserve required review gates, explicit holds and acceptance checkpoints for completed work.
2. Read the complete SPEC, repository guidance, source-of-truth documents, accepted prerequisites, active integration code, tests, and validation commands.
   - Read the repository's code-standards hub fully and then every page it routes for the current change surfaces. In Fusion Studio, resolve the active machine-scoped `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`; do not substitute an inactive machine copy.
   - Treat routed standards as required implementation authority unless the approved SPEC or a newer explicit owner decision supersedes an exact rule. Record the exact conflict and supersession; never silently ignore either authority.
3. Treat hashes as provenance only. Establish the current working baseline and note dirty overlapping files without rejecting them.
4. Enumerate slices in dependency order.
5. Create a slice ledger containing scope, prerequisites, criteria, checks, builder/reviewer identities, current revision, deviations, downstream impacts, and state.
6. Mark exactly one unblocked slice `implementing`.

Report only genuine intent contradictions or execution impossibilities. Fix missing mechanics during implementation and report them.

## Slice Loop

### Builder Packet

Give the fresh builder:

- objective, required behavior, invariants, and explicit non-goals;
- approved authorities and accepted prerequisites;
- exact code-standards hub and routed page paths applicable to the slice, with any approved supersession called out;
- expected integration surface without treating it as a hard allowlist;
- exact validation and pass criteria;
- the fail-forward and deviation-reporting contract; and
- required handoff fields.

Require implementation, self-review, targeted validation, bounded smoke/runtime evidence, repair of validated findings, and a clean builder-owned review on current bytes.

### Builder Handoff

Accept `READY_FOR_ORCHESTRATOR_REVIEW` or a rare `BLOCKED`/`AUTHORITY_BLOCKED` report containing:

- changed files and behavior;
- criterion mapping;
- self-review and repairs;
- exact commands/results and skipped checks;
- builder-review identities/results/lifecycle;
- all SPEC deviations and out-of-scope touches;
- downstream impacts and proposed corrections;
- temporary adapters/removal criteria;
- residual risks; and
- exact current candidate identity when useful.

A reviewer finding, stale test, or omitted authorization is not terminal; return it for repair.

### Orchestrator Inspection

1. Read changed files, diff, and surrounding integration points.
2. Check every approved criterion and every reported deviation.
3. Rerun applicable targeted checks and required smoke/runtime evidence.
4. Check accepted prerequisites and downstream contracts.
5. Classify findings as `builder_repair`, `owner_ruling_required`, `accepted_deviation`, `downstream_impact`, or `advisory`.
6. Return one consolidated repair packet and continue until the implementation is materially clean.

### Acceptance Review

After inspection finds no known material issue, spawn a fresh reviewer with the approved slice, raw authorities, routed code standards, current bytes, immediate dependency surface, validation evidence, and deviation ledger. Do not provide prior conclusions.

Validate each material finding, route correction, and obtain fresh builder and orchestrator review on affected current bytes. Stop after the first clean pass. Block only for genuine authority or execution impossibility.

### Accept Slice

Accept when current bytes have a complete builder handoff, clean builder review, independent orchestrator inspection/checks, clean orchestrator acceptance review, and every deviation classified. Record the revision and lifecycle evidence before starting the next builder.

## Final SPEC Integration

After all slices are accepted:

1. Run the full SPEC suite and required end-to-end/runtime checks.
2. Inspect cross-slice contracts, shared state, migrations, compatibility, cleanup, and deviations.
3. Run a fresh final-integration reviewer on current integrated bytes and raw evidence.
4. Route material findings to the earliest responsible slice, repair, rerun invalidated lower gates, and continue final review until clean.
5. Produce an impact assessment for later SPECs: `none`, `compatible deviation`, `requires downstream correction`, or `requires owner ruling`.

## Completion And Handoff

Use [Status](../status/SKILL.md) on assigned status requests to extend the previous SPEC/slice report with current builder/reviewer identities, gate/pass evidence, holds and source revisions. Keep completed slices unless explicit invalidation changes them. Report only this SPEC's scope; the Roadmap Supervisor owns whole-roadmap status and monitoring. This procedure does not enable a slice-monitor timer.

When invoked by a supervisor, return `SPEC_READY_FOR_SUPERVISOR_REVIEW` with:

- slice ledger and accepted current revisions;
- builder/reviewer identities and lifecycle evidence;
- exact checks and final integration evidence;
- every SPEC deviation and out-of-scope change;
- downstream impact and recommended corrections;
- skipped checks, temporary adapters, and residual risks; and
- final report path.

When invoked directly by the owner, return `SPEC_READY_FOR_OWNER_REVIEW` with the same packet. Do not begin another SPEC in the same chain until the owner has received and explicitly approved the completed-SPEC summary.

Return `BLOCKED` only for a genuine execution impossibility and `AUTHORITY_BLOCKED` only for an indispensable unresolved owner decision. `DESIGN_UNSTABLE` and `IMPLEMENTATION_UNSTABLE` are retired and are not valid terminal results.

## Local session contract

Read [session-contract.md](../../../session-contract.md) before assigning or editing work. Use the explicit memory folder and implementation checkout; preserve instruction discovery and assigned manager/reporting boundaries. Creation of these procedures does not authorize a build or activate Mission Control.
