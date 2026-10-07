# Mission Control — Domain Routing and Future Roadmap Intake

**Capture:** Mission Control working memory · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** MC-T03 working design; no product domains or roadmaps assigned
**Updated:** 2026-09-24 (PDT)
**Trickle-down:** [Mission Control charter](mission-control.md) and current records · **Roll-up:** future agent profiles and roadmap intake

## What Mission Control routes

Mission Control assigns a job according to **responsibility and the evidence needed**, then selects its subject domain from the relevant owner-named Capture or source documents. Domains are not fixed to the three eventual roadmaps. A roadmap may span domains, and one domain may support several roadmaps.

| Job need | Accountable role | Return to Mission Control |
|---|---|---|
| Domain understanding, intent shaping, source reconciliation | Domain agent assigned a bounded subject/Capture | Current brief, verified facts, open intent, issues, affected work IDs and next question. |
| Build one approved roadmap | Roadmap Supervisor | Current SPEC, acceptance state, holds, deviations and dependency changes. |
| Execute one approved SPEC | Supervisor assigns its SPEC Orchestrator; orchestrator assigns Slice Builder | Existing SPEC completion packet through the supervisor. MC does not manage individual slices. |
| Integrate accepted work or prepare its PR | Branch Manager | Exact candidate and outcome, integration evidence, PR/commit, downstream dependencies and issues. |
| Independent planning readiness | Preflight agent | Draft/release readiness, source-grounded findings and unresolved owner decisions. |
| Requirements gap, ticket mapping, dependency dispute | Bounded specialist role assigned by the appropriate manager or MC | Finding, evidence, uncertainty and affected IDs; product choices route to the owner. |
| Post-milestone feature walkthrough or standards comparison | Later owner-defined test role | Evidence against the owner-defined criteria and a release/repair implication. The detailed FFmpeg workflow is future work. |

When a request crosses subjects, name one accountable lead and record consulted domain owners. For shared code or state, identify one writer and the affected consumers. If ownership cannot be determined from current authority, MC records the question and holds only the affected assignment.

## Choosing a domain memory home

Use a Capture named by the owner when one exists. Otherwise, find the existing Capture whose purpose and authority cover the question; link other relevant Captures rather than copying them. Create a new numbered Capture only when the question has a distinct enduring purpose and existing homes would confuse authority. The domain agent maintains its bounded brief and points to current Wiki, SPEC, ticket and code evidence. A Capture does not confer permission to rewrite those sources.

Mission Control keeps only the domain's name or working subject, assigned agent/session, memory home, current question, state and link to the returned brief. Subject domains can be named when real work arrives; MC setup does not require preselecting Chat, Plugins, Views or any other product portfolio.

## Future roadmap intake packet

The owner chooses and assigns each roadmap after Mission Control is ready. Before MC treats one of the three unassigned slots as active, the responsible supervisor or owner supplies:

1. **Identity and authority:** roadmap ID/name, owner-approved scope or current planning status, exact normative source/manifest and acceptance policy.
2. **Ownership:** supervisor task/session identity, designated source/working checkout, related domain/Capture homes and responsible integration contact.
3. **Initial state:** current milestone/SPEC, completed and accepted work with evidence links, unresolved intent, known issues and next authorized action.
4. **Dependency edges:** required capability or contract, provider work ID, consumer work ID, exact condition for availability/adoption, hold owner and notification destination.
5. **Verification and recency:** source revision, last state check, test or review evidence relevant to the next action, and any known concurrent writer/merge overlap.

MC records a compact pointer in [registry.md](registry.md) and leaves the full roadmap/SPEC material with its supervisor. An incomplete intake can be registered as `waiting-owner` or `waiting-dependency` with the missing field named. Registration alone does not dispatch implementation or change the roadmap's own acceptance gates.

## Three slots, zero assignments

R1–R3 in the registry express capacity and the planned UI shape. They are unassigned placeholders. MC-T03 defines how future assignments enter those slots; it does not choose their subjects, create roadmaps, or turn the earlier five-track plugin proposal into three projects.

The HTML artifact can render placeholders and clearly labeled sample data during MC development. When real roadmaps arrive, their supervisors supply the sources and statuses. Mission Control checks freshness and routes dependencies; it does not reconstruct a roadmap from scattered implementation files.

## Successor rule

A replacement Mission Control reads the charter, current handoff, registry and active bulletin, then follows only the source links needed for the next coordination decision. Before sending a new assignment or resuming a stopped task, verify whether its manager/writer is already active. Route an unknown product question to the owner or a bounded domain investigation; do not fill the gap from the old plugin planning proposal.
