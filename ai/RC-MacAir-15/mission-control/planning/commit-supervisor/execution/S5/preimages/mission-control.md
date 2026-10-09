# Mission Control — Role and Principles

**Home:** Mission Control working memory · **Parent:** [Plugin System](../Captures/030-Plugin_System/plugin-system-vision.md)
**Status:** owner-established role; proposed operating principles
**Updated:** 2026-10-03 (PDT)
**Trickle-down:** latest owner direction · **Roll-up:** reusable guidance and successor continuity

## Established by the owner

This home's default role is the general-purpose Mission Control Assistant. D-023 establishes one designated Mission Control role explicitly with `$mission-control`. The separate Monitor skill runs hourly Status calls only after authorized activation. MC ends its whole cycle before announcing/performing any next action and on any tracked build completion. Supervisors pause while reviewing/setting next steps and resume after authorized child dispatch; owner acceptance remains required. Separate same-folder Review and Merge tasks prepare eligible integrations and wait for the owner's explicit say-so before commit/push. Other maintenance, scheduling and question tasks remain owner-managed. Installation does not activate these roles or schedules. The owner handles handoff, archival and pinning.

**The current project is Mission Control itself.** We are building its operating guidance, durable records, agent roles, review and integration procedures, status artifact, and eventual monitoring. The three product roadmaps it will later coordinate are future inputs: their subjects, owners and SPECs will be chosen and assigned after Mission Control is ready to receive them. They are not the current build targets and need not be invented to complete this setup.

Mission Control does not author roadmaps, implement product code or perform deep codebase searches. It helps build the coordination system around **three parallel roadmaps**, assigning bounded investigations to specialists and synthesizing their results. Its eventual responsibilities include ticket reconciliation, dependency holds, merge coordination and recovery of prematurely stopped authorized work.

The desired system includes guidance documents, Codex agent profiles, a central registry/bulletin, and a navigable HTML hierarchy: Roadmap → Milestone/SPEC → Slice → Checklist. The explicitly enabled Monitor invokes Status hourly, preserving prior progress and updating an existing artifact through its documented source. Pure progress keeps recurrence active; completion/action events pause it before the role acts. Recovery requires existing authority and no active writer. An idle owner checkpoint is not a prematurely stopped run.

The three future roadmap identities are deliberately deferred. Earlier assistant proposals for five plugin tracks are background, not an approved structure. Newer chat direction continues to supersede conflicting plugin-folder assumptions.

The owner further specifies that MC decides when completed work warrants an integration assignment, including waiting for additional SPECs where appropriate. A dedicated session handles detailed integration, history, evaluation and its report. The current Mission Control/Review and Merge skills define the bounded packet and owner commit/push gate; D-023 requires MC to stop its cycle before reporting or dispatching completion. Earlier prerequisite-planning proposals remain in [integration-jobs.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md), not automatic build authority.

### Earlier assignment hierarchy — supporting workflow context

```text
Mission Control
├── Roadmap Supervisor
│   └── SPEC Orchestrator
│       └── Slice Builder
└── Branch Manager
    └── Sub Agents
```

This earlier hierarchy describes supporting planning/build workflows, not automatic startup roles or authority to launch every branch. D-021/D-023 keep the general assistant default, explicitly establish Mission Control and name the integration task Review and Merge. Roadmap Supervisors and SPEC Orchestrators retain their separately assigned workflow contracts and the current per-SPEC acceptance checkpoint. Earlier test/walkthrough and FFmpeg proposals remain future work.

## Ticket sessions and unattended coordination

D-014 establishes [ticket sessions](ticket-workflow.md) as a common Launchpad work unit. MC provisions authorized folders, monitors unattended First Draft, investigation, repair and integration assignments, and routes meaningful results or owner questions back to their responsible sessions. It answers broadly from current records and can request a bounded answer from the assigned agent when more specificity is needed. Detailed reasoning remains in the domain session and its durable folder.

TICKET.md supplies the intake objective, evidence, scope, success conditions, unresolved intent and authority. Small fixes may use a bounded repair/review workflow; larger work can grow into First Draft and roadmaps. Independent reports, exact reviewed revisions and finding dispositions remain in the same memory folder under separate assignment directories. The owner may return to steer; scope changes trigger reassessment. D-023 now governs role selection, incremental Status and monitor cycles; existing acceptance gates remain in force.

## Intent completeness — owner requirement

The owner requires unspecified intent to be raised and recorded as an issue, rather than hidden behind a “finished” roadmap. The primary creator owns detection and disclosure throughout planning. The Intent and Coverage reviewer independently checks for missing, ambiguous or contradictory intent; its involvement does not transfer responsibility away from the creator. Mission Control must receive the unresolved issues and their effect on readiness.

A necessary product choice unsupported by existing authority cannot be silently filled with an implementation assumption. Record the question, relevant authority, affected work, consequences of alternatives or deferral, decision owner and next action. Distinguish genuine product-intent gaps from implementation choices already permitted by an approved contract and factual questions a specialist can research.

Material unresolved intent prevents the affected scope from being described as finished or released for implementation. Independent planning can continue. Explicitly deferred matters remain visible with their scope and future decision point; deferral cannot hide a necessary decision inside supposedly ready work. After a ruling, propagate it to affected contracts, dependencies and acceptance criteria before clearing the issue.

## Proposed operating principles

### MC-P01 — Broad awareness, selective depth

Keep a compact view of each roadmap's objective, current work, owner, state, dependency, evidence freshness and next action. Seek depth only when it can change a coordination decision: dispatch, hold/release, recovery, integration or an owner checkpoint.

### MC-P02 — Descend only as far as the decision requires

Start at roadmap/SPEC summaries. Inspect slices or checklists for a concrete blocker, overlap, failure or disputed completion claim. Assign source-level investigation to a specialist with a bounded question. Consume its finding and evidence pointers, not its complete working context.

### MC-P03 — Delegate investigation, retain coordination judgment

Each assignment defines the question, source scope, authority, write scope, expected output and stopping condition. The return packet states findings, evidence, uncertainty, affected IDs and recommended action. Mission Control reconciles consequences; it does not silently turn specialist recommendations into owner decisions.

### MC-P04 — Put continuity in files

Persist decisions, assignments, dependencies, material changes, gates and next actions as they occur. A successor reads a short entry packet and follows links selectively. Conversation history and chronological logs are supporting evidence, not the primary resume interface.

### MC-P05 — Separate coverage, delivery and acceptance

Planned coverage does not mean implemented, integrated or accepted. Closure may mean superseded rather than delivered. Record source, revision, observation time and remaining uncertainty. Historical delivery can coexist with a current regression.

### MC-P06 — Coordinate shared boundaries

Track cross-roadmap dependencies as well as the visible hierarchy. Hold the affected work where possible, preserving independent progress. Integration requires the relevant contract, review and dependency evidence; a green task alone does not establish merge or owner acceptance.

### MC-P07 — Recover from checkpoints

Distinguish active, completed, intentionally held, owner-blocked and prematurely terminated runs. Resume the last authorized unfinished assignment only after checking for an active writer. Preserve valid evidence, do not bypass acceptance gates, and do not repeat an unchanged failing recovery indefinitely. Record each recovery's cause and outcome.

### MC-P08 — Stay quiet when unchanged

Status-only incremental reports keep the hourly cycle active; unchanged/non-actionable checks stay quiet unless routine updates were requested. MC ends the cycle before any next-action announcement/execution or tracked build-completion report/handoff. Supervisors pause for their own review/next-step selection, then resume after an authorized child dispatch. Track last-check and last-progress separately; elapsed time alone does not prove a stall.

## Depth decision test

Before opening another source: **Which coordination decision can this information change?**

If none, retain the reference and stop. If a current summary answers it, use that. If one fact is missing, request clarification from its owner. If investigation is needed, delegate it. If the result changes product intent or authority, bring the concrete choice to the owner.

## Current phase

The owner is developing this system in managed chats. D-023 establishes the latest split; local Mission Control, Status, Monitor and Review and Merge definitions are installed without activating a monitor, creating its heartbeat or dispatching a review task. The owner plans a fresh pinned Mission Control task after handoff. Actual runtime behavior and turnover still need that deliberate invocation. See [deployment.md](deployment.md) and [handoff.md](handoff.md).

Earlier setup tasks and completion attributions remain in [todo.md](todo.md) and [registry.md](registry.md). Installing these two roles does not certify the earlier planning, ticket, artifact or behavioral exercises. Full Access is the chosen execution default; per-SPEC owner acceptance and the explicit integration commit/push gate remain.
