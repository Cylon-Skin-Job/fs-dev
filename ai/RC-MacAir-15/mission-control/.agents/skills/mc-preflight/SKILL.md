---
name: mc-preflight
description: Check a Launchpad workfolder or supplied conversation/document packet inline before handing it to First Draft or Roadmap Creation. Use when preparing either planning handoff; assess input readiness and return gaps without creating the plan, dispatching agents or granting release approval.
---

# Planning Preflight

Run in the current workfolder conversation, normally as the fronting Launchpad agent. This is a focused procedure, not another agent role. Follow the folder's AGENTS.md and the [session contract](../../../session-contract.md); a side chat can assess its assigned packet without acquiring main-session or dispatch authority.

Preflight asks whether the next process has usable inputs. Stage validation asks whether returned work meets its contract. Independent Release Validation assesses the final candidate. None grants owner approval or substitutes for the others.

## Select the destination and basis

Use `first-draft` or `roadmap-creation`, as requested or unambiguously established by the conversation. If the destination is unclear, report readiness for both rather than silently applying the stricter threshold. Identify the exact workfolder or supplied packet and expected output. A managed `first-draft` handoff targets `mc-draft-supervisor`; `mc-first-draft` remains the stage author. Roadmap Creator may run the same draft stage inside its own already-authorized planning job. Accept an existing draft, a conversation plus documents, or a mixture. A simple single-SPEC assignment needs neither a prior draft nor an invented multi-SPEC roadmap.

Use the [conversation evidence contract](../../../conversation-evidence.md) to resolve the assigned main history source, verify proposal/decision links and retrieve targeted context before escalating apparent missing intent. Shared CWD is a candidate filter, not a main-thread designation. Check known post-checkpoint decisions and side-chat returns that may affect readiness; targeted reads do not establish full interval coverage or advance the cursor.

Read the local index and relevant intent, decisions, issues, proposals, source map and handoff records. For conversation input, cite the available owner statements and identify unavailable history. Do not claim a transcript was checked from a synopsis alone. Record exact source paths and current revisions or content hashes where available; otherwise state the observation time and evidence limit. Dates alone do not establish authority or supersession.

## Check the inputs proportionately

- **Intent and authority:** distinguish owner direction, approved contracts, implementation facts, proposals and unknowns. Check desired outcomes, scope boundaries, observable success and contradictions. Surface unspecified intent and displaced requirements; do not fill them with plausible assumptions.
- **Sources and guidance:** confirm relevant sources are accessible and reconcile material conflicts. Read the current User Preferences and Code Standards router, then the routed articles that can constrain this handoff. In Fusion Studio, use the active machine's `Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md` and `Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`, resolved from the assignment or repository guidance. Include any mandatory domain overview, such as Chat's. Map applicable guidance to the packet's constraints, gaps or justified exceptions; a path list alone is not a check. Specific current owner direction controls its stated scope.
- **Likely obstacles:** identify known shared contracts, consumers, dependency waits, compatibility/data/lifecycle risks, concurrent ownership conflicts, and code or non-code change surfaces. Separate observed facts from impact hypotheses. Unknown overlap is not evidence of safe parallelism. Full code tracing, blast-radius analysis and executable verification design remain Creator work; return bounded investigation questions when those facts prevent the next stage.
- **Continuity:** reuse current Document Sweep reports and unresolved finding IDs. Check whether source or packet changes invalidate their conclusions. Before Creator handoff, follow Launchpad's existing [Document Sweep](../mc-document-sweep/SKILL.md) requirement; a missing, partial or stale required sweep is an explicit preparation gap. Do not duplicate a current sweep or automatically invoke Checkpoint, advance a cursor, start a reviewer, or create sweep state during this inline check. A main session may separately arrange necessary research/review under its existing authority.
- **Assignment:** identify the receiving procedure, exact input documents, allowed scope, expected output/return location, remaining questions and stop conditions. Verify only the tools/profiles actually needed for the intended launch route. Missing a bespoke profile need not block an authorized ordinary session that can read the procedure. Do not assume a file's existence proves runtime discovery or permission to dispatch.

Keep inspection bounded to facts that could change readiness. Do not search the whole codebase, create a roadmap, repair shared documents, or widen an assignment as an incidental part of preflight.

## Apply the destination threshold

| Destination | Required now | Appropriate work for the destination |
|---|---|---|
| `first-draft` | A meaningful objective, sufficient source context to form a useful skeleton, visible authority/boundaries, and known questions. No unresolved conflict that makes even the framing misleading. | Candidate boundaries, tentative slices, preliminary impact and smoke scenarios, and explicit questions for shaping. Open intent is expected when a useful conditional draft is possible. |
| `roadmap-creation` | Coherent outcomes and bounded scope; material owner choices resolved or validly deferred; visible constraints and contradictions; sufficiently consistent, current sources and sweep evidence to proceed without reconstructing the conversation. | Detailed code/dependency/blast-radius research, executable slices, failure/migration behavior, verification and final coverage. Do not demand those completed outputs before allowing their creation. |

A valid deferral names affected work, resolver, resolution point and hold/release condition. Consistent with User Preferences, establish that intervening work will not impede or compound the later fix. If that cannot be established, treat it as a blocker for the affected destination/work, not a blanket stop on independent work. Distinguish a release blocker the next stage is assigned to resolve from a blocker to starting that stage.

## Return a readiness report

Return one compact report in the current conversation or an already assigned report location. Do not invent a new ledger. Choose exactly one readiness status and include:

- Destination, input basis/revisions, scope actually checked and limitations.
- `READY`: sufficient inputs, with no material preparation gaps found within the checked scope.
- `READY_WITH_EXPLICIT_GAPS`: useful work can proceed; each gap is visible, assigned to the receiving stage or a valid deferral, and does not invalidate that work.
- `NEEDS_PREPARATION`: a missing source, intent decision, contradiction, required review or assignment prerequisite prevents a useful or authorized handoff. Name the minimum corrective action.
- For each finding: existing issue ID when available, evidence, affected outcome, consequence, whether it blocks this destination or later release, resolver and next action. Preserve unresolved findings; do not mark them closed merely because they were acknowledged.
- Exact handoff inputs, receiving procedure, carried questions and recommended next action.

Return an honest `NEEDS_PREPARATION` if an essential part of the check could not be performed; do not let unknown coverage become READY. Limit claims to the inspected scope. Durable incorporation belongs to the authorized workfolder owner under its record rules; side chats return findings unless assigned writes.

A readiness report does not launch First Draft, Creator, investigators or implementation, and does not approve a plan. Recheck only affected readiness conclusions when inputs change. Stop when the report is useful; do not loop indefinitely over missing owner input or broaden into downstream validation.
