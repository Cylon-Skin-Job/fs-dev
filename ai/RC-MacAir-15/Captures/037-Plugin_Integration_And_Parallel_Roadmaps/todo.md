# Mission Control — Tasks for Owner-Managed Chats

**Capture:** Mission Control working memory · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** Mission Control setup in progress; task states shown below
**Updated:** 2026-09-24 (PDT)
**Trickle-down:** owner instructions and recorded proposals · **Roll-up:** completed guidance, profiles and coordination tools

## How to use this list

The owner will start and manage separate chats, working through tasks one at a time. This is a TODO list for building the Mission Control system, not a product roadmap or implementation SPEC bundle. Listing a task does not approve unresolved design choices or dispatch it. The suggested order can change at the owner's direction.

Each task should return its decisions, changed files, checks, unresolved issues and exact next action. Record its chat ID and result here when assigned/completed. Do not mark a task complete merely because a draft or proposal exists. For a profile task, distinguish guidance drafted, profile installed and behavior exercised.

Established requirements: MC coordinates rather than authors roadmaps or searches deeply; continuity lives in files; unspecified intent is surfaced by both creator and reviewer; integration timing/grouping is deliberate. The precise domains, three roadmap identities, review organization, record format and standing execution/merge authority still need decisions.

## Ordered TODO list

### MC-T01 — Finalize Mission Control's charter

- [x] **Deliver:** agreed purpose, depth/delegation rules, authority boundaries and successor reading contract.
- **Decide:** which proposed principles to adopt; what MC may assign, resume, hold or escalate; where owner acceptance remains necessary. Preserve the current owner-managed-chat mode.
- **Done when:** a new session can determine its role, allowed actions and next step without reconstructing this conversation; remaining choices are explicit.
- **Start with:** [mission-control.md](mission-control.md), [handoff.md](handoff.md).
- **Outcome:** Owner confirmed the current per-SPEC acceptance checkpoint by answering “Yes” to the retain-it option. The role hierarchy is Mission Control → Roadmap Supervisor → SPEC Orchestrator → Slice Builder, with Branch Manager → Sub Agents as the second branch. Mission Control knows the scope of each job and assigns its owner; assigned managers handle subordinate decomposition. Later milestone test/walkthrough agents are in scope to coordinate when defined. FFmpeg details remain future work.

### MC-T02 — Establish the registry, bulletin and handoff records

- [x] **Deliver:** the minimal durable record structure and templates for assignments, decisions, issues, dependencies, evidence, changelog entries and resumption.
- **Decide:** canonical location/format, IDs, update ownership, stale evidence handling and how concurrent sessions report without overwriting one another. Resolve any artifact/data needs against the current flat-Markdown Capture convention.
- **Done when:** an example assignment can be created, handed off, held and resumed with its evidence intact; records distinguish plans, implementation, integration and acceptance; the owner agrees the records are usable.
- **Start with:** [coordination-system.md](coordination-system.md), [registry.md](registry.md), [bulletin.md](bulletin.md). Use MC-T01's boundaries.
- **Outcome:** Flat Markdown registry, bulletin and assignment/resumption packet were created. The owner's instruction to continue the TODO is treated as acceptance of this setup convention; later evidence can refine fields without reopening the completed setup task.

### MC-T03 — Define Mission Control's domain and future-roadmap interface

- [x] **Deliver:** Mission Control's own domain-routing model and the interface for accepting three product roadmaps later.
- **Decide:** which domain boundaries MC needs to function, how future roadmap supervisors register source/dependencies, and how an existing Capture is selected as a domain's memory. Roadmap subjects, owners and SPECs are intentionally deferred.
- **Done when:** MC can accept a future roadmap assignment without redesigning its records; current domain routing is clear. Do not invent or preselect the three roadmaps.
- **Start with:** [domain-routing.md](domain-routing.md) and the domain/Capture distinction in [coordination-system.md](coordination-system.md); record the result using MC-T02. Earlier five-track proposals are not approved input structure.
- **Outcome:** Defined routing by accountable role and a source-backed domain brief, plus a future roadmap intake packet. Product domains and roadmaps will be named only when the owner assigns real work.

### MC-T04 — Build the domain-agent profile and Capture workflow

- [ ] **Deliver:** reusable domain-agent guidance/profile and the working-memory contract for ideation → shaping → review → planning handoff.
- **Decide:** source/decision/issue ownership, bounded specialist assignments, report size and how replacement sessions resume. Reconcile with existing Launchpad/Second Brain guidance rather than duplicating conflicting duties.
- **Done when:** a bounded example produces a useful domain brief and unresolved questions, and a replacement session can pick it up without the original transcript.
- **Start with:** MC-T01–03 and [coordination-system.md](coordination-system.md). This task defines the role; it does not launch all domain agents.

### MC-T05 — Build the independent Preflight profile

- [ ] **Deliver:** Preflight instructions/profile, review assignment templates and readiness report.
- **Cover:** intent/coverage; architecture/code standards; blast radius/dependencies/concurrent work; verification/handoff. Decide which checks require separate specialists and which can be combined.
- **Done when:** exercises show it catches missing intent and a dependency gap, accepts a useful First Draft with disclosed open questions, and refuses to call an unresolved release candidate ready. It reports independently to MC and leaves repairs to the creator.
- **Start with:** planning preflight in [integration-jobs.md](integration-jobs.md); MC-T01–02. Preserve applicable existing review discipline without automatically duplicating review layers.

### MC-T06 — Update the SPEC/Roadmap Creator for First Draft and Preflight

- [ ] **Deliver:** targeted creator-guidance changes connecting First Draft, issue disclosure, shaping, release candidate and independent Preflight.
- **Preserve:** standards routing, authority distinctions, dependency checks and applicable owner approval gates. The primary creator must raise missing intent itself; it cannot outsource that responsibility to review.
- **Done when:** a bounded example returns a rough draft and meaningful questions without inventing intent, and later revisions resolve or explicitly defer issues before claiming release readiness.
- **Start with:** MC-T05's agreed handoff contract, [integration-jobs.md](integration-jobs.md) and the installed roadmap-creator skill. Coordinate changes to its current creator-owned review instructions so independence is explicit.

### MC-T07 — Build the requirements-definition agent

- [ ] **Deliver:** a bounded investigation profile, issue-to-requirements report and its evaluation contract.
- **Cover:** what is missing, existing authority, feasibility facts, acceptance needs, dependencies, alternatives and genuine owner choices. Decide its relationship to the domain-agent role and how Preflight evaluates this type of report.
- **Done when:** a missing-capability example yields an evaluated report usable by the creator without pretending the report approves product scope or implements the missing feature.
- **Start with:** MC-T04–06 and the prerequisite-work path in [integration-jobs.md](integration-jobs.md).

### MC-T08 — Build and pilot ticket reconciliation

- [ ] **Deliver:** ticket-review guidance/profile, current inventory comparison and a small reviewed set of ticket-to-work mappings. Record the remaining batches separately.
- **Cover:** active, superseded, obsolete and duplicate intent; projected/partial/approved coverage; delivery and acceptance evidence; uncovered requirements. Preserve many-to-many mappings.
- **Done when:** the pilot distinguishes superseded from implemented and records disputed/incomplete mappings. Recheck the dated RCC-0104 registry discrepancy instead of assuming it remains. Canonical status changes follow recorded authority.
- **Start with:** [ticket-inventory.md](ticket-inventory.md), MC-T02–04 and current ticket/SPEC sources. A pilot does not constitute a review of the entire backlog.

### MC-T09 — Build the Branch/Integration agent

- [ ] **Deliver:** profile, MC assignment packet, integration evaluation gate, change/issue report and checkpoint/resume procedure.
- **Decide:** accepted SPEC grouping, scoped commit ownership, conflict routing, PR-only versus merge outcomes and standing Git authority. Include the path from a missing requirement to MC-T07/06 and prerequisite execution while integration waits.
- **Done when:** an isolated rehearsal preserves unrelated work, evaluates a combined candidate, records a dependency wait and resumes from its checkpoint. It distinguishes capability landed from consumer adoption and retains notification obligations. No production merge is needed to prove the workflow.
- **Start with:** [integration-jobs.md](integration-jobs.md), MC-T01–02 and MC-T05–07. Keep planning Preflight and implementation/integration evaluation distinct; preserve Fusion's separate Alpha follow-up rules.

### MC-T10 — Build the navigable HTML skeleton

- [ ] **Deliver:** the three-root artifact: Roadmap → Milestone/SPEC → Slice → Checklist, with source links, status, owners, evidence freshness, dependencies, holds and ticket relationships.
- **Decide:** where it lives, how it reads the records and how refresh works. The registry remains the source; HTML must not become an independently edited progress ledger.
- **Done when:** one representative branch can be expanded to checklist detail and a cross-roadmap dependency inspected. Unknown/unassigned work stays visibly unknown; no invented SPECs or progress percentages.
- **Start with:** MC-T02–03. Use three clearly unassigned future-roadmap slots and labeled sample data, never invented product roadmaps.

### MC-T11 — Assemble the Mission Control profile and rehearse turnover

- [ ] **Deliver:** MC profile/instructions that connect the agreed roles, registry, reports, artifact and successor entry point.
- **Exercise:** dispatch versus hold, issue routing, an integration requiring prerequisite work, and takeover by a fresh MC session. Keep deep work with the assigned role and preserve owner-managed chat creation until explicitly changed.
- **Done when:** a successor determines the current state and next action from the compact packet; it neither duplicates an active writer nor mistakes an owner wait for a stopped run.
- **Start with:** MC-T01–10, using bounded scenarios rather than live product implementation.

### MC-T12 — Configure the hourly monitoring and recovery loop

- [ ] **Deliver:** the actual recurring check, durable automation/task identity, notification rules, recovery classifications and stop/pause/resume behavior.
- **Decide:** when live operation begins and the exact standing authority for follow-up messages, resumption and replacement sessions. Distinguish an intentionally waiting job, completed assignment, owner gate and premature termination.
- **Done when:** bounded checks demonstrate durable updates, artifact refresh, quiet unchanged runs and correct handling of a stopped authorized job. Record actual activation state; do not claim monitoring merely because instructions exist.
- **Start with:** MC-T11's tested behavior and existing scheduling capabilities. Preserve still-valid evidence and prevent duplicate dispatch/mutations after interruption.

## First chat to open

MC-T01 through MC-T03 have completed their setup deliverables. The next bounded chat is **MC-T04 — Build the domain-agent profile and Capture workflow**. Give that chat the charter, [domain-routing.md](domain-routing.md), and the MC-T04 section above. Product roadmap selection remains a later owner action.

When opening each later chat, assign only that task ID, link its named inputs and prior outcomes, and specify where its return packet belongs. The task closes with a useful result or explicit unresolved issue; listing later tasks is not permission to start them automatically.
