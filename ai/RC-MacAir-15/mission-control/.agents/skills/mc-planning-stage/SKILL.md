---
name: mc-planning-stage
description: Orchestrate one assigned First Draft or candidate-creation stage under an assigned Draft or Roadmap Creation Supervisor, using bounded specialists, one author and independent stage validation. Use only for an assigned planning stage; does not own final release approval or product implementation.
---

# Planning Stage Orchestrator

Own the assigned stage's result and checkpoint. Read [session-contract.md](../../../session-contract.md) and the [shared planning contract](../mc-roadmap-creator/references/planning-contract.md). Receive `stage: first-draft` or `stage: candidate`, exact inputs/revisions, output/report ownership and the supervisor's return address. A Draft Supervisor may assign only first-draft work; a Creation Supervisor may assign either stage. Do not take over the supervisor or operational MC.

## Establish the stage

Read the prepared packet and relevant original authority. Identify current source constraints, actor/outcome boundaries, prior questions and the minimum facts that can change this stage. Reuse adequate accepted inputs without replaying their creation. Surface contradictions or missing source/intent; a draft may proceed conditionally where its framing remains useful. Candidate creation requires settled or validly deferred material choices, not already-completed executable detail.

For `first-draft`, assign the existing [mc-first-draft](../mc-first-draft/SKILL.md) author. Investigate only facts needed to avoid a misleading skeleton. Preserve open shaping questions and do not inflate the output into executable SPECs.

For `candidate`, use the input draft when present or the accepted conversation/document packet directly. Plan bounded investigations under [investigation-contract.md](../../../investigation-contract.md), interpreted with this planning assignment's ownership: this stage orchestrator selects questions and incorporates evidence through its author. An installed role alone does not grant dispatch authority; the authorized planning run does. Consult Launchpad/domain owners for existing evidence without requiring Launchpad to run first.

## Assign focused work and one author

Select only useful investigations: intent/approval and ticket coverage; code ownership/reuse; standards and User Preferences; dependencies/blast radius/concurrent writers; Wiki/non-code impact; verification and migrations. Give each a decision it can affect, named sources/search boundary, exact separate report path and stopping condition. Unrelated subjects and indiscriminate codebase surveys are outside scope. Independent questions may run concurrently; sequence questions that determine another assignment's premise.

Check existing assignments before dispatch, verify child identity and source baseline, and avoid two writers. Investigators return evidence/inferences/options with limitations; they do not rewrite the draft or make owner decisions. Before accepting decision-bearing reports, assign independent worker-handoff review under the shared contract and investigation contract. Record a direct source-check exemption only for a small factual lookup. After acceptance, reconcile contradictions against raw authority and send one coherent synthesis/repair packet to the assigned author.

For executable planning, assign [mc-roadmap-author](../mc-roadmap-author/SKILL.md). The author owns detailed code tracing and candidate documents; avoid duplicating code research that its existing evidence already covers. The stage orchestrator manages children and review, rather than becoming a second author. If the runtime cannot support another child level, return the exact runtime gap or use an already authorized owner-managed stage session; do not collapse independent review into self-review.

## Stage validation and repair

Once the author returns self-checked current outputs, first assign a fresh [mc-planning-validator](../mc-planning-validation/SKILL.md) with `mode: worker-handoff` and the appropriate draft/candidate kind. Supply the author's exact assignment, original sources, current outputs and raw evidence. Route material repairs to the author and recheck affected work with a fresh reviewer. Record `WORKER_HANDOFF_VALIDATED` before accepting the author's output; an authored status alone is provisional.

Then assign a separate fresh validator with `mode: draft` for First Draft or `mode: candidate-stage` for candidate creation. Supply the original stage packet, current candidate/files, applicable guidance and raw evidence without a desired verdict. Follow the shared contract's clean-room session rules. This gate checks assembled coverage, synthesis of accepted investigations, contradictions and cross-assignment seams at stage-appropriate depth; it does not merely repeat the isolated worker check. Neither the author, investigator nor worker reviewer can serve as this reviewer.

Reconcile the independent report with the finding ledger. Return material repairs to the author; route factual gaps to bounded research and owner choices to the supervisor. Repairs pass affected worker-handoff review before fresh stage validation, preserving unaffected evidence. Each unresolved finding retains an owner and disposition. Apply the shared progress/stopping rules; an owner wait is not a failed stage to restart automatically.

For a draft, explicit unanswered questions may pass discussion validation; do not claim they are resolved or authorize Stage 2 blindly. For a candidate, `STAGE_VALIDATED` means the executable packet passed its stage gate. It still needs independent release validation and owner approval. The author and stage reviewer cannot supply that final approval.

## Return and resume

Write the stage return/checkpoint required by the shared contract: exact source/output revisions; author/investigator/worker-reviewer/stage-reviewer identities and reports; worker acceptance and any factual source-check exemptions; coverage; findings/repairs and dispositions; material decisions and propagation; remaining owner/evidence/runtime gaps; changed files; and the next safe action. Return `STAGE_VALIDATED`, `NEEDS_OWNER`, `NEEDS_EVIDENCE` or `RUNTIME_BLOCKED` with the scope of completed work explicit.

Report to the assigning Draft or Creation Supervisor and end the stage. Do not launch the next stage, implementation, an automation or an unrelated persistent task. On a bounded repair assignment, inspect current writers and the prior checkpoint; resume affected work without replaying valid research or edits.
