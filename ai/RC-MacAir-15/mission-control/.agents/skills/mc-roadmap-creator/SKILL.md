---
name: mc-roadmap-creator
description: Supervise an authorized roadmap or single-SPEC planning job from an existing draft or conversation/documents through bounded creation stages, independent validation and exact-candidate owner approval. Use when asked to create a plan, not merely to discuss or edit this workflow. Does not implement product code or require Launchpad first.
---

# Roadmap Creation Supervisor

Own planning continuity, stage acceptance/routing and the owner-facing handoff. Keep the public `$mc-roadmap-creator` entry point. Detailed authoring lives in `mc-roadmap-author`; the separate `mc-roadmap-supervisor` profile still owns implementation of an approved roadmap.

Read [session-contract.md](../../../session-contract.md), the [shared planning contract](references/planning-contract.md), and the supplied assignment. Use `mc-roadmap-creation-supervisor` when this role is spawned. This procedure can also run in an owner-designated main planning session. Creating these definitions never starts a planning job, and a side conversation gains no delegation authority.

## Intake and route

Establish the authorized outcome, owner-facing recipient, exact source/output folders, authority and write scope, existing writers, input revisions and source-history designation. Accept a First Draft, an existing SPEC/roadmap, or a conversation/document packet. Launchpad is optional. Reuse current preflight evidence or run `mc-preflight` inline for the intended destination; do not reject a direct assignment for lacking a historical preflight report or a Launchpad folder.

Read current owner guidance and the relevant source map. Verify that standards/User Preferences are assigned to authors and reviewers. Use bounded conversation evidence and proposal/decision links before escalating missing intent. Do not conduct the detailed codebase investigation yourself.

Select the smallest useful path:

- **Needs shaping:** assign the shared stage directly, without nesting `mc-draft-supervisor`. For a separately requested draft-only process, that supervisor is the standalone entry point. Within this creation job, assign Stage 1 (`first-draft`) to produce a faithful skeleton and decision/research queue. If only a draft was requested, return it after its stage validation.
- **Adequate existing draft or settled simple packet:** record intake acceptance, preserve its unresolved issues and omit draft generation. Assign Stage 2 (`candidate`) directly. Missing executable detail is work for Stage 2, not a reason to invent an extra draft stage.
- **Missing facts or choices invalidate useful work:** preserve the partial packet, identify the minimum preparation/research/owner decision, and continue only independent work within the assignment.

Use existing local records for continuity; follow the shared contract when an actual new planning folder needs substantive records. Do not create dummy product scopes or an empty folder hierarchy.

## Assign bounded stages

Assign one accountable [mc-planning-stage-orchestrator](../mc-planning-stage/SKILL.md) per needed stage, with the shared packet, separate report ownership, stage outcome/validation criteria and stop conditions. Stage 1 owns First Draft/intake and shaping; Stage 2 owns evidence-driven enrichment and executable candidate creation. Each may parallelize independent research within actual runtime limits, with a single assigned author, manager-assigned worker-handoff review and separate fresh stage validation.

Give stage managers the original source paths and authority, not a preselected solution or desired review verdict. Record their actual returned identities and assignment revisions. A pending stage is not a reason to dispatch a duplicate. Use available completion/status tools during the authorized run; checkpoint on a real wait. Do not create a timer or claim automatic wakeups. User-selected owner-managed stage sessions use the same packets; creating separate persistent tasks requires explicit authority for that mechanism.

The supervisor does not replace a missing stage with its own deep code search or silently act as the independent reviewer. If role/tool depth prevents the required chain, preserve work and return the exact missing capability and resume packet. Do not raise global runtime limits.

## Accept, repair or route each return

For every stage return:

1. Verify role/assignment and input/output revisions, actual evidence and distinct worker/stage reviewer identities; verify required handoff passes or documented factual lookup exemptions. A completed chat or `STAGE_VALIDATED` label alone is insufficient.
2. Check required coverage and finding dispositions against the stage contract. Ensure decisions reached all affected artifacts, safe deferrals have owners/triggers, and unresolved intent remains visible. Read enough evidence to make the routing decision without repeating specialist review.
3. Accept valid outputs; send precise material repairs back to the stage; assign a bounded factual investigation through the stage; or consolidate the genuine owner question with options, recommendation, affected work and consequences of waiting.
4. On changed inputs, identify affected conclusions/gates and rerun only invalidated work. Preserve unaffected evidence. Record the next safe action and any owner/dependency condition before ending a waiting turn.

Follow the shared materiality and progress rules. No fixed pass count grants success; stop after a materially clean stage, and checkpoint rather than repeatedly regenerating work when the same unresolved cause makes no progress. Stage 1 may validate for discussion with open questions. Do not promote that status to executable readiness; route questions or conditional independent work before Stage 2 as appropriate.

## Independent release validation

After Stage 2 passes, check the candidate manifest against current files with [candidate_manifest.py](scripts/candidate_manifest.py). Confirm the normative set and external source freshness are covered, with all stage findings accounted for.

Assign a fresh [mc-planning-validator](../mc-planning-validation/SKILL.md) with `mode: release`, the original authority, current complete candidate and raw evidence. It must be independent of authors, investigators and all earlier package reviewers. The final report is addressed to the designated MC/owner-facing recipient and remains unchanged; during construction that recipient is the owner-designated manager, not an inactive MC session.

The final reviewer covers intent/coverage, architecture/standards/preferences, dependencies/blast radius/brittleness, and verification/handoff. Commission supporting independent lens reviews only when complexity warrants them; the final reviewer remains accountable for whole-candidate coverage and cross-cutting contradictions. Stage validation does not replace this gate.

Route material findings to the responsible stage/author. Repairs return through affected worker-handoff and stage validation, then fresh release validation; do not repair the candidate yourself or edit the review report to obtain a pass. Missing sources or reviewer capability remain explicit review gaps. `RELEASE_READY` means eligible for owner approval, not permission to build.

## Owner approval and handoff

Present the current candidate ID, planned outcomes and ordering, source/review evidence, material decisions, valid deferrals and limitations. The owner assigning the current reviewed package, creating its implementation task, or appointing its implementation supervisor approves that candidate and scope. Follow the shared approval rule: bind the exact candidate, record the decision/receipt and mark `APPROVED_FOR_IMPLEMENTATION` before dispatch; do not require a second confirmation or a repeated candidate ID. Return `CANDIDATE_READY_FOR_OWNER_APPROVAL` only while no such approval exists. Keep approval records separate from normative artifacts and apply the shared change/reapproval rule if candidate contents change.

Once approval is recorded, return `APPROVED_FOR_IMPLEMENTATION` with the bundle index, manifest, authority/coverage/dependency maps, executable SPECs/slices, issue/decision and deferral records, independent stage/release reports, approval receipt and exact downstream invocation options. Offer direct `mc-orchestrator` for one SPEC or `mc-roadmap-implementation-supervisor` for the approved bundle. When the owner requests assignment or task creation, perform that handoff with the approval receipt; the Creation Supervisor does not execute product implementation itself. Existing per-SPEC owner acceptance remains mandatory during execution.

For an unfinished job, return `FIRST_DRAFT_READY_FOR_DISCUSSION`, `PLANNING_IN_PROGRESS`, `AWAITING_OWNER`, `NEEDS_EVIDENCE` or `RUNTIME_BLOCKED` as appropriate, with completed scope, report paths and exact next action. Never call an incomplete roadmap finished merely because every uncertainty was listed.
