---
name: mc-planning-validation
description: Independently review assigned planning worker handoffs, drafts, candidate stages or releases against original authority and evidence. Use within an authorized review; report findings without repairing deliverables or approving product scope.
---

# Independent Planning Validation

Read [session-contract.md](../../../session-contract.md) and the [shared planning contract](../mc-roadmap-creator/references/planning-contract.md). This is a leaf reviewer role. Inspect sources and write only the assigned review report; do not edit candidate documents or dispatch other agents. The assigning supervisor/stage may arrange additional independent specialist assignments when needed.

## Establish independence and mode

Require an explicit `mode: worker-handoff`, `draft`, `candidate-stage` or `release`, review recipient, exact scope/current files or manifest, original requirements/owner decisions and relevant raw evidence. Worker mode also requires `deliverable_kind: draft`, `candidate` or `investigation`, its bounded assignment and return criteria. Do not infer a favorable result from preflight, prior summaries or the author's desired verdict.

Run in a newly created session with no inherited author/manager conversation or prior reviewer history. If you authored the deliverable, supplied its underlying investigation or reviewed it at an earlier gate, return `INCOMPLETE_REVIEW` and request a fresh reviewer. Stage reviewers are fresh relative to worker reviewers; release reviewers are fresh relative to all earlier package reviewers. Each repair pass is fresh too. Preserve applicable session/delegation restrictions; an unavailable independent runtime cannot be replaced by self-review.

Read the current User Preferences, Code Standards router and relevant routed pages completely, plus mandatory domain contracts. Use [conversation evidence](../../../conversation-evidence.md) to verify consequential owner claims and later revisions. Separate missing original evidence from a supported interpretation; do not turn search results or Wiki inference into new owner approval. Record paths/turn locators, revisions and inspection limits.

## Review four explicit perspectives

Scale depth by the assigned mode and bounded deliverable. Every report accounts for all four perspectives, marking genuinely inapplicable portions with reasons, or explicitly identifies an assigned specialist-only scope and returns partial coverage; a specialist report is never a whole-gate pass. Worker review does not require a complete roadmap from one investigator. Stage review checks assembled evidence and cross-assignment coverage; final release checks the combined candidate from raw authority even when supporting specialist reports exist.

| Perspective | Questions and evidence |
|---|---|
| Intent, authority and coverage | Does each required outcome trace through the proposal/decision chain into the plan? Is owner wording preserved? Are missing intent, partial approvals, supersession, tickets and exclusions explicit? Have unresolved questions been disguised as finished requirements? |
| Architecture, standards and preferences | Are existing owners/reuse and shared consumers identified? Are applicable routing, governance, persistence/lifecycle and portability rules reflected at the right stage? Are introduced complexity, file responsibility and deferrals justified against the User Preferences? Cite actual rules and impacts, not just a standards-path checklist. |
| Dependencies, blast radius and brittleness | Are providers/consumers, shared contracts/state, failure paths, migration/retirement and concurrency conflicts covered? Are release conditions observable, ordering acyclic and ownership clear? Distinguish implemented capability from approved direction or missing foundations; code imports alone do not prove behavioral impact. Check user, data, Wiki, operational and downstream adoption surfaces. |
| Verification, evidence and handoff | Are outcomes observable through meaningful vertical slices or justified enablers? Do planned smoke, failure, regression, migration and integration checks cover the change? Distinguish future tests from tests actually run. Can the next agent act on the packet without reconstructing intent? Verify candidate identity, source freshness and all required report/approval boundaries. |

Trace representative high-risk paths through original sources; deepen only where evidence can change the verdict. Do not demand exhaustive speculative edge cases or promote style preferences into blockers. For final release, ensure full required-outcome coverage and examine cross-SPEC seams/parallel claims, not merely a sample of the easiest slices. Record any review portion that could not be completed.

## Apply the correct threshold

- **Worker-handoff:** check the output against its own assignment before the manager accepts it. For a draft, verify faithful framing, useful provisional outcomes and visible uncertainties without demanding settled architecture. For a candidate, verify the assigned executable contracts, grounded claims, source/output identity and disclosed gaps; do not certify the whole release. For an investigation, independently trace decision-bearing conclusions to inspected sources, distinguish facts/inferences/unknowns, check search/freshness limits and whether the answer or honest partial result serves its bounded question. A disclosed gap may pass report fidelity while still holding dependent work. Assess relevant standards and impact claims only within the assignment; do not expand a narrow report into an audit.
- **Draft:** assess a faithful useful skeleton, candidate vertical slices/smoke scenarios, plausible impact and visible decision/research gaps. Unknown architecture detail or unsettled owner choices can remain if clearly conditional and the draft is useful for discussion. Do not require detailed implementation files/test commands or final SPEC boundaries.
- **Candidate-stage:** assess executable SPEC/slice contracts, source/standards traceability, detailed dependencies and impact, planned verification, propagated decisions and valid deferrals. The original Stage 2 input need not have contained these outputs; the returned candidate must.
- **Release:** independently assess the current complete candidate and every required perspective. Check the manifest's normative set for omissions and confirm current bytes with the candidate helper. Ensure material findings are resolved or validly deferred under the shared contract, cross-SPEC handoff is coherent and no necessary owner choice is silently inferred. This is readiness for owner approval, not proof of implementation correctness.

An omission is material only with violated authority or a necessary unspecified decision, affected scope, realistic consequence and source evidence. Advisories may coexist with a pass. A complete review with material findings is not an incomplete review; distinguish a negative verdict from inability to assess. Report material owner questions as `NEEDS_OWNER`, correctable defects as `REVISE`, and missing essential evidence/runtime capability as `INCOMPLETE_REVIEW` with the minimum recovery action. Hold only affected progression.

## Return the independent report

Include:

- Mode, deliverable ID/kind and assignment criteria, review scope, author/verified reviewer identity and independence basis, recipient, timestamp and input/output/source revisions; exact candidate ID where applicable.
- A four-perspective coverage table: examined sources/paths or locators, evidence, conclusion and limitations. Mark any specialist-only/inapplicable scope with reasons.
- Findings with stable IDs, severity, confidence, violated authority or missing intent, affected artifacts, consequence, direct evidence and required resolution. Separate suggestions from blockers.
- Deferral assessment, current source changes, untested claims and any missing part of the assigned review.
- `WORKER_HANDOFF_VALIDATED`, `DRAFT_VALIDATED_FOR_DISCUSSION`, `CANDIDATE_STAGE_VALIDATED`, `RELEASE_READY`, `REVISE`, `NEEDS_OWNER` or `INCOMPLETE_REVIEW`, matching the assigned mode. Passing modes require their full coverage and no unresolved material violation of that gate's contract. An incomplete review cannot pass. A worker pass is neither stage acceptance nor release readiness; identify questions and progression holds that remain.

Return the report unchanged to the assigned recipient. Release results are addressed to the designated MC/owner-facing recipient independently of the author; during construction this is the owner-designated manager. The Creation Supervisor may route repairs but cannot rewrite the verdict. Do not ask the owner to approve product scope yourself, close issues in someone else's ledger, or start implementation. A new pass uses a fresh reviewer against repaired current bytes; do not turn this leaf review into a self-managed retry loop.
