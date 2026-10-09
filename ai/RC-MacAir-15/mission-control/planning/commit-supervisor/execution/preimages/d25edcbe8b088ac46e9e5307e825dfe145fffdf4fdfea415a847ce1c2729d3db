# Mission Control — Integration Jobs and Prerequisite Work

**Capture:** Mission Control working memory · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** owner-directed operating concept; packet/state details are assistant proposals
**Updated:** 2026-09-23 (PDT)
**Trickle-down:** owner's integration-agent vision · **Roll-up:** future profiles, registry and dispatch guidance

## Owner direction

During an hourly check, Mission Control may discover a completed SPEC ready for integration. MC decides whether to assign an integration session or wait for more SPECs to complete a feature or satisfy dependencies. Integration is a deliberate assignment, not an automatic consequence of every SPEC completion.

The assigned session uses a robust profile, reads the instructions and applicable historical records, determines the integration approach, performs its assigned branch/merge and PR work, evaluates its work and ends with a durable report. It records changes and issues. MC retains the scheduling decision and consumes the result without doing the deep integration investigation itself.

The owner also proposes a requirements-definition agent with its own evaluation gate. Its reviewed report can feed a SPEC/roadmap creator, followed by execution of the resulting authorized work, while the original integration job waits. This is a supported design path, not a requirement to create a roadmap for every conflict.

This discussion establishes workflow intent. It does not dispatch an integration session or authorize a specific current commit, push or merge.

## Integration unit and assignment packet

**Proposed rule:** MC selects an integration unit, which may be one accepted SPEC or several that jointly deliver a usable capability. Record why to integrate now or what named prerequisite justifies waiting. The absence of downstream consumers alone is neither a universal prohibition nor a requirement to merge; owner's delivery instructions also matter.

The assignment identifies:

- Job ID, included SPECs and exact candidate/source locations.
- Intended target branch and outcome: prepared/published PR, or authorized merge to main; these are distinct milestones.
- Applicable owner instructions, acceptance receipts and relevant historical decisions, prior integration findings and deviations. Use an indexed source map rather than rereading all history.
- Required capability, known consumers, dependencies, write scope and allowed bounded repairs.
- Evaluation criteria, report/changelog/issue locations, completion condition and resumption route.

The profile supplies reusable behavior; the packet supplies this job's facts and authority. Avoid embedding live branches, SPEC states or task IDs permanently in the profile.

## Integration work and evaluation

The integration agent owns its investigation, isolated candidate preparation and coordination with bounded specialists. It preserves unrelated work, handles necessary scoped repairs, and produces a reviewable PR through the assigned workflow. It may employ separate preparation, conflict-analysis and validation agents, with one writer per integration candidate.

Its evaluation gate should inspect the combined candidate: required accepted work is present, unrelated changes are excluded, semantic conflicts are resolved, affected behavior and dependency contracts pass, and the report/PR accurately describes scope and deviations. Independent review and repair follow the applicable evaluation policy; this capture does not invent a new review count or bypass existing SPEC acceptance.

If repair changes reviewed behavior, refresh the affected evidence. If main advances while the job waits, reconcile against the new target before relying on prior integration results. Preserve still-valid evidence rather than repeating all work mechanically.

## When integration reveals missing work

Separate a bounded mechanical integration repair from missing product behavior, architectural requirements or unresolved intent. The first stays within the assigned repair scope. The second produces a durable prerequisite record and a checkpoint of the original integration job.

The requirements agent receives that record and the relevant sources. Its job is to define the gap, known constraints, acceptance needs, dependencies, alternatives, unanswered owner choices and why the existing approved work does not cover it. Its separate evaluation gate checks that this account is supported, complete enough to plan and does not invent owner intent. It returns a reviewed report, not an implementation approval.

MC can then route the report to a planning specialist. An approved resulting SPEC/roadmap goes through the appropriate execution chain and acceptance gates. The integration job records the prerequisite work ID and resumes after the required result is accepted and available. A reviewed requirements report alone does not authorize new product scope.

Waiting is a durable job state, not a requirement to keep an agent actively running. The original session can end with a checkpoint; the same or a replacement session later resumes from it. This preserves context capacity and makes premature termination distinguishable from an intentional dependency wait.

## Proposed First Draft checkpoint

**Origin:** owner asks whether a First Draft should expect further input, assemble rough pieces, surface issues and return for review. This checkpoint is proposed, not yet an installed workflow.

The creator's initial assignment produces a reviewable model of the work, not a release-ready roadmap. It assembles grounded intent and sources, tentative work boundaries and dependencies, relevant ticket relationships, assumptions, missing evidence and unresolved intent. Provisional details stay visibly provisional; defer exhaustive slices/checklists where an unresolved choice would invalidate them.

The return packet contains: what is established; the rough proposed structure; issues and their affected scope; which questions need owner judgment versus specialist research; and a recommended next assignment. Prioritize decisions that alter architecture, scope or ordering. Do not manufacture questions when existing authority already answers them or require the owner to repeat settled decisions.

First-draft review asks whether the problem is represented faithfully, uncertainty is disclosed and the right questions have been surfaced. Known open issues can coexist with a successful draft checkpoint; that outcome means ready for feedback, never implementation-ready. Reviewers also seek omissions beyond the draft's own issue list.

MC routes bounded research to domain specialists and genuine intent choices to the owner, then sends the resulting evidence/decisions back to the creator. Independent shaping may continue while an affected section waits. The creator propagates resolutions and produces a release candidate for the more exacting planning preflight below. Material new uncertainty returns affected scope to shaping rather than being disguised as a technical assumption.

Suggested progression: First Draft → intent/feasibility review → shaping and resolution → release candidate → planning preflight → owner approval. This refines the earlier Capture ideation/shaping/review model rather than creating a second competing lifecycle. MC coordinates this progression; a planning specialist authors the plan. A completed drafting assignment does not mean the roadmap is finished.

## Proposed planning preflight

**Independent role proposal:** The owner suggests a Preflight agent separate from the Roadmap Creator. MC would assign it directly and receive its report. The creator owns drafting and repairs; Preflight owns review coverage, bounded specialist review assignments and an evidence-backed readiness finding. The creator cannot waive Preflight findings or declare its own release readiness without that independent result.

Preflight receives the identified candidate plus primary owner decisions, requirements, standards and relevant dependency/source references. It starts without the creator's conversational reasoning or desired verdict. Candidate issue/decision records remain available as evidence, but do not limit what it checks. It may delegate the four review responsibilities below; the existing read-only clean-room reviewers remain leaf reviewers and do not themselves acquire orchestration duties.

Preflight writes its own findings/report, not repairs to the normative roadmap. It sends material issues to MC and the creator with affected scope, evidence, readiness impact and required resolution. The creator repairs; domain specialists establish missing facts; the owner resolves genuine intent choices; Preflight rechecks affected findings against the revised candidate. Keep valid unaffected evidence. Findings may be challenged with evidence and reconciled explicitly rather than silently waived.

Use phase-specific conclusions: First Draft review may report a usable draft with recorded open decisions; release review may report ready for owner approval, revision required, or owner decision required. A completed Preflight assignment need not have a passing result. Preflight does not approve product intent, authorize implementation or certify code behavior that has not yet been built. It consolidates the relevant reviews rather than automatically adding another duplicate review layer; detailed policy remains to be designed.

**Origin:** owner asked whether relying on one evaluation-gate type warrants more specific preflight before release. This is a proposal, not an edit to the installed creator or review policy.

Inspection of the installed roadmap-creator skill, clean-room-reviewer profile and spec-review-gate skill shows one reusable reviewer role with different review scopes. The creator explicitly requires standards routing, dependencies, regression surfaces, feasibility checks and independent bundle review. The execution review policy distinguishes builder, slice, SPEC and roadmap integration gates. These are meaningful scoped gates, but the creator does not explicitly assign separate planning reviews for cross-roadmap concurrency, integration units or consumer-release conditions. The execution policy applies to approved implementation; do not silently treat it as a complete planning preflight rubric.

Proposed planning checks before a bundle is released for owner approval:

**Owner refinement:** Both the primary creator and the Intent and Coverage reviewer must identify and record unspecified intent. The creator must report unresolved issues and readiness consequences directly to MC; it cannot rely on review to discover them or label affected work finished. The reviewer checks primary intent sources for omissions as well as checking the candidate's own criteria. See [the intent-completeness requirement](mission-control.md#intent-completeness--owner-requirement).

| Review responsibility | Required answer/evidence |
|---|---|
| Intent and coverage | Each intended requirement and applicable ticket maps to observable criteria or an explicit deferral; missing/ambiguous/contradictory intent is recorded with affected scope and readiness impact; owner decisions and supersessions are preserved; no invented scope. |
| Architecture and standards | Existing owners/routes, applicable standards, state/data ownership, migration/compatibility and cleanup behavior are identified; relevant lifecycle and failure assumptions are grounded. |
| Blast radius and parallel integration | Affected producers/consumers and shared contracts are mapped, along with active work overlaps, shared files/migrations, concurrency restrictions, integration units and exact downstream release conditions. |
| Verification and handoff | Criteria have observable pass/fail evidence, including relevant failure/recovery cases; baseline, fixtures, environment and dependencies permit execution; the next agent can act without inventing product decisions. |

Use a shared independent-review discipline with explicit assignments and outputs. For this three-roadmap program, separate reviewers for these responsibilities are a candidate default; small changes may combine related responsibilities with explicit coverage. Do not assume different role labels or multiple same-model agents provide uncorrelated judgment. Source checks, requirement traceability and behavioral evidence remain essential.

Each review returns checked obligations, evidence, missing/contradictory facts, material findings, justified non-applicability and residual risks. Missing required evidence remains unresolved; it is not silently passed. Give reviewers primary authority/source references as well as the candidate so they can detect omissions in its checklist. Check packet structure and references mechanically where useful, without mistaking that for semantic correctness.

Under the independent-role proposal, Preflight reconciles the reports and verifies overall review coverage; MC routes the resulting actions and owner checkpoint. No majority vote can waive an unresolved material finding. Repair and rerun affected review only. Owner approval remains distinct from review readiness. Recheck relevant baseline/dependency assumptions at dispatch and again at integration rather than assuming planning evidence stays current forever.

Mission Control receives the compact coverage/findings/release summary, not all review transcripts. Preflight is the proposed review owner; its precise profile and dispatch policy remain to be established. No profile was installed or reviewers dispatched.

## Durable state and reporting

Suggested states: queued, preparing, evaluating, waiting-for-prerequisite, PR-ready, landed, complete. Record explicit owner/authority waits separately from failed execution. Completion is relative to the assigned outcome: a clean PR can complete a PR-only assignment without claiming the feature is available on main.

Each job retains source/target revisions, current candidate, assigned session IDs, authority, evidence, deviations, issue/prerequisite links, PR URL, landed revision if any and next action. Append material transitions to a concise changelog. New issues belong to the assigned findings surface; do not silently change canonical ticket status.

After landing, notify consumers of the exact available capability/revision. Downstream adoption and remaining acceptance gates still determine whether dependent work can start. The registry retains pending notification/acknowledgement obligations across session turnover.

MC's return packet stays compact: outcome, PR/commit, gate result, meaningful changes, remaining issues, dependency effects and next action. Detailed investigation remains linked. This makes the same integration job recoverable by both a new integration agent and a new Mission Control.
