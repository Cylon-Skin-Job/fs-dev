# Mission Control — Domain Routing and Future Roadmap Intake

**Capture:** Mission Control working memory · **Parent:** [Plugin System](../Captures/030-Plugin_System/plugin-system-vision.md)
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
| Planning input readiness | Launchpad workfolder agent using inline `mc-preflight` | First Draft or Roadmap Creation readiness, exact inputs and carried gaps; no dispatch or approval. |
| Create or revise a discussion draft | First Draft Supervisor (`mc-draft-supervisor`) | Independently validated skeleton, source/review evidence and prioritized open questions; no automatic roadmap creation. |
| Create a roadmap or single SPEC | Roadmap Creation Supervisor (`mc-roadmap-creator`) | Validated draft/candidate, precise owner questions, exact-candidate approval and executable handoff; no implementation. |
| One planning stage | Planning Stage Orchestrator | Bounded research/author synthesis, independent stage gate, evidence/dispositions and next action. |
| Independent final planning assessment | `mc-planning-validator` in release mode | Whole-candidate coverage, source-grounded findings and unresolved owner decisions; author owns repairs. |
| Requirements gap, ticket mapping, dependency dispute | Bounded specialist role assigned by the appropriate manager or MC | Finding, evidence, uncertainty and affected IDs; product choices route to the owner. |
| Post-milestone feature walkthrough or standards comparison | Later owner-defined test role | Evidence against the owner-defined criteria and a release/repair implication. The detailed FFmpeg workflow is future work. |

When a request crosses subjects, name one accountable lead and record consulted domain owners. For shared code or state, identify one writer and the affected consumers. If ownership cannot be determined from current authority, MC records the question and holds only the affected assignment.

## Choosing a domain memory home

Use the owner-selected `launchpad/<workspace-id>/` as the domain's durable home and session CWD. Adapt the [Launchpad template](launchpad/template/AGENTS.md) for that live folder. Reuse an existing workspace when its purpose matches; create a distinct one only for a distinct enduring purpose.

When migrating a selected Capture, preserve its original path and revision, reconcile newer owner direction, and identify which destination documents now own ongoing updates. Link supporting Captures instead of copying everything. Do not delete sources or imply all historical Captures have migrated. The domain agent maintains its brief and links current Wiki, SPEC, ticket and code evidence; the memory folder does not itself confer permission to rewrite those sources.

Mission Control keeps only the domain's name or working subject, assigned agent/session, memory home, current question, state and link to the returned brief. Subject domains can be named when real work arrives; MC setup does not require preselecting Chat, Plugins, Views or any other product portfolio.

## Governing sessions in subordinate folders

The owner intends Roadmap Supervisors and SPEC Orchestrators to work from their own subordinate folders while MC governs their assignments. The following deployment/dispatch contract is the working design; it does not launch sessions or migrate installations.

**Shared definitions, local assignments.** Maintain MC-owned reusable profiles and skills at the common controller level: `.codex/agents/` for custom spawned-agent profiles and `.agents/skills/` for shared procedures. Keep each assigned roadmap/SPEC folder's role, scope, source pointers and re-entry instructions in its local AGENTS.md and records. Do not bury the only reusable profile inside one worker folder and expect a parent MC session to discover it upward. Launchpad-specific procedures can remain scoped beneath `launchpad/`.

D-007 adds the local `mc-roadmap-supervisor`, `mc-spec-orchestrator` and `mc-spec-slice-builder` profiles; detailed procedures live in the local skills. A normal supervisor main session still uses local instructions plus its supervisor skill; it does not need to be a spawned child. See [deployment.md](deployment.md). Custom-agent TOML configuration is applied to a selected spawned agent; it does not automatically turn every separately opened chat into that profile.

**Two launch mechanisms must remain distinct.** A persistent folder-bound main session can be created by the owner and registered for later MC interaction. A runtime child uses the available spawn interface and its returned child identity. Do not interchange a child-agent ID, a main-task UUID and a folder/workspace ID. The available spawn interface in this setup has no CWD argument. The app's separate-task interface selects a saved project's local directory or worktree, rather than accepting an arbitrary CWD. A role name or assignment mentioning a subfolder therefore does not prove the child started there. Use an actual supported folder-bound launch path and verify the resulting CWD before assigning writes. Main domain and setup sessions remain owner-managed. D-010 separately authorizes main Launchpad sessions to dispatch bounded investigators under [investigation-contract.md](investigation-contract.md); general folder-launch automation remains future work.

**Registration receipt.** Before a real run is marked active, record its workspace/work ID, exact memory CWD, separate implementation checkout and branch if any, session kind, verified runtime ID/host, accountable manager, applicable AGENTS/profile/skill paths and revisions, effective permissions, assignment revision, report path and allowed follow-up actions. The worker acknowledges its role, scope, actual CWD and first action. A missing or conflicting field is a coordination gap, not a reason to guess identities or dispatch twice.

**Govern by message and evidence.** After live operation is authorized, MC uses the registered identity to read status, send authorized assignments/steering, and receive completion or hold reports. The central registry stores the durable mapping; a directory tree, bulletin entry or report-file update is not a messaging or scheduling service. Record delivery separately from acknowledgment. MC owns cross-roadmap coordination; the supervisor owns its SPEC chain; the orchestrator owns its slice chain. A hold must name the affected work and condition for release. A request to hold is not proof the writer stopped: wait for acknowledgment or use supported interruption under the assigned authority before reallocating writes.

**Acceptance and replacement.** Completion evidence does not itself waive the per-SPEC owner checkpoint. Before replacing a session, inspect its last checkpoint and verify the old writer is inactive; keep prior identities as history and bind the new verified identity to the existing work. MC does not need to become the worker role or load its full implementation context to make these decisions.

**Deployment remains to be exercised.** Verify profile discovery from the intended MC launch context and procedure/instruction discovery from each worker launch context. A separate build worktree outside MC ancestry needs its own appropriate deployment. A shared source directory alone does not prove runtime discovery. No MC startup or MC live-dispatch test is permitted until the system is fully built. D-010 permits an already owner-assigned main Launchpad session to dispatch its own bounded investigators during construction, within session/tool restrictions. Construction checks can inspect configuration, validate references and rehearse packets without launching MC.

Sources: [custom-agent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents), [folder instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), and [project primary directories](https://learn.chatgpt.com/docs/projects). Launch-interface limitations above are observations of this conversation's available tool schemas, not claims about every Codex interface.

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
