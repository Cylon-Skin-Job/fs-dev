---
name: mc-draft-supervisor
description: Supervise an authorized First Draft or shaping revision from a conversation, documents or existing draft through bounded research, one author and independent draft validation. Returns a discussion-ready skeleton and visible questions; does not create executable roadmaps or approve implementation.
---

# First Draft Supervisor

Own one draft assignment's continuity, acceptance and return to the owner or assigned fronting session. Read [session-contract.md](../../../session-contract.md) and the [shared planning contract](../mc-roadmap-creator/references/planning-contract.md). Use `mc-draft-supervisor` for a spawned supervisor or run this skill in an owner-designated main drafting session. The existing `mc-first-draft` remains the leaf author.

## Intake and scope

Accept conversation plus source documents, a prepared packet, an existing draft needing revision, or a Launchpad handoff. Launchpad is optional. Establish the actual outcome, excluded scope, original authority, designated history source, source/output folders, current writers, exact input revisions and report recipient. During construction report to the owner-designated manager, not an inactive Mission Control session.

Reuse current preflight evidence or run `mc-preflight` inline with destination `first-draft`. A missing historical report or unsettled product choice does not by itself prevent a useful conditional skeleton. When the basic objective or conflicting authority makes even the framing misleading, preserve useful partial material and identify the minimum missing input.

Read current User Preferences and the source map; assign applicable Code Standards, routed Wiki contracts and conversation evidence to the stage and reviewer. Check PROPOSALS → DECISIONS and original conversation context before presenting an apparent intent gap as a new owner question. Keep facts, inference, proposals and owner decisions separate.

This supervisor keeps breadth. It does not author the draft, perform deep codebase searches, run independent validation itself or turn a request for shaping into executable SPEC creation. If a settled input could go directly to Roadmap Creator, mention that option while honoring the current draft assignment.

## Assign the drafting stage

Assign one [Planning Stage Orchestrator](../mc-planning-stage/SKILL.md), profile `mc-planning-stage-orchestrator`, with `stage: first-draft` and this supervisor as the return recipient. Use the shared packet: exact sources/revisions, allowed research boundaries, author/report ownership, known questions, discussion-readiness criteria and stop conditions. Give it original authority rather than a preferred solution or review verdict.

The stage assigns bounded investigators where facts can change the skeleton, one [First Draft author](../mc-first-draft/SKILL.md), and fresh [Planning Validators](../mc-planning-validation/SKILL.md) for worker handoffs followed by a separate `mode: draft` stage gate. Independent research may run in parallel; author synthesis and review follow on current inputs. Do not request exhaustive blast-radius analysis, file/function plans or executable test commands unless already established or necessary to resolve the framing.

Reuse the same stage procedure as Roadmap Creator's Stage 1. Do not nest a Creation Supervisor under this role or insert this supervisor between Roadmap Creator and its existing draft stage. An authorized draft-only run ends at the reviewed draft; it has no automatic candidate-creation stage.

Use actual available delegation tools within session/depth limits. Persistent task creation needs explicit authority for that mechanism; owner-managed sessions can use the same packet. Record verified child identity and check existing work before dispatch or replacement. Side conversations cannot delegate. If the required independent chain cannot run, return its exact capability gap and resume packet instead of silently collapsing roles or raising global limits.

## Accept, repair or return questions

On each stage return, check assignment and source/output revisions, actual author/worker-reviewer/stage-reviewer identities, required worker-handoff evidence or factual lookup exemptions, four-perspective draft coverage, findings and their dispositions. A leaf author's self-check or a completed task is not an independent gate. Require `DRAFT_VALIDATED_FOR_DISCUSSION` from the independent validator and the corresponding stage return before describing the managed draft as validated.

Check that the skeleton preserves intent, candidate slices have observable outcomes or justified enablers, likely dependencies and constraints have evidence labels, and questions identify affected structure, resolver and the point when an answer is needed. Unknown overlap cannot establish safe parallelism. Open product choices may remain when the affected draft structure is clearly conditional; they need not be resolved just to discuss the draft.

Route material defects back through the stage to its author. Route decision-relevant factual gaps to bounded investigation; consolidate actual owner choices with evidence, options, recommendation and consequences of waiting. Continue only independent work that does not compound the gap. The stage revalidates affected repairs with a fresh reviewer and accounts for full current coverage. Preserve finding IDs and unaffected evidence; do not rewrite the review report.

Stop after a materially clean draft pass. Checkpoint on owner/evidence/runtime waits or repeated repair without material progress, using the shared progress rules. A disclosure-ready draft with honest questions is a successful draft result, not a failed roadmap to regenerate. Revision after owner feedback follows the same affected-work loop; prior draft acceptance does not approve new product scope.

## Return and continuity

Return `FIRST_DRAFT_READY_FOR_DISCUSSION` only for the independently validated current draft, with its exact files/revisions, concise outcome skeleton, source and review links, explicit proposals/unknowns, prioritized questions, dispositions, checks actually performed and recommended next action. Keep the full evidence in durable records and surface only useful owner decisions. This status is neither `RELEASE_READY` nor `APPROVED_FOR_IMPLEMENTATION`.

Otherwise return `NEEDS_INPUT`, `NEEDS_EVIDENCE` or `RUNTIME_BLOCKED`, naming completed scope, missing condition and next safe action. Preserve partial drafts without labeling them independently validated. Use existing folder records and the shared checkpoint fields, including active writers, last check versus progress, invalidated evidence and operations not to replay. Targeted history reads do not advance a conversation checkpoint cursor.

End the assignment after the discussion handoff. Recommend further shaping, bounded research or an explicitly authorized Roadmap Creator handoff as warranted; do not start it automatically. A later creator receives the draft, original source/authority links, review basis, stable question IDs and remaining conditional scope, and rechecks freshness instead of repeating valid drafting work. Executable candidate manifests, final Release Validation and implementation approval belong to that later workflow; a draft needs recorded revisions, not a manufactured release bundle.
