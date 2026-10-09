# Mission Control — Tasks for Owner-Managed Chats

**Home:** Mission Control working memory · **Parent:** [Plugin System](../Captures/030-Plugin_System/plugin-system-vision.md)
**Status:** Mission Control setup in progress; task states shown below
**Updated:** 2026-09-24 (PDT)
**Trickle-down:** owner instructions and recorded proposals · **Roll-up:** completed guidance, profiles and coordination tools

## Current home and migration

Continue this existing TODO through folder-bound workspaces under `launchpad/`. This is not a new roadmap or a bulk Capture migration. MC-T01–03 completion labels and outcomes are imported source records; see [source-map.md](source-map.md). This bootstrap extends MC-T02 with the new home, explicit decisions, workspace/session binding and record templates. It does not complete MC-T04–12.

MC-T04 should address [template-review.md](template-review.md), reuse the existing template, and define how a selected Capture is reconciled into a particular Launchpad folder with provenance. MC-T11 owns instructions and turnover validation; MC-T12 owns monitoring. D-023 keeps the general assistant default: `$mission-control` selects the coordinator; Monitor schedules shared incremental Status with explicit cycle ends. It supersedes D-021's activation mapping and preserves the removal of D-004's universal hold. This setup installs definitions without activation. No setup task requires a live monitor or its acknowledgment.

## How to use this list

The owner will start and manage separate chats, working through tasks one at a time. This is a TODO list for building the Mission Control system, not a product roadmap or implementation SPEC bundle. Listing a task does not approve unresolved design choices or dispatch it. D-010 separately authorizes an owner-designated main Launchpad session to dispatch bounded investigators within its active project; it does not authorize starting the other setup tasks. The suggested order can change at the owner's direction.

Each task should return its decisions, changed files, checks, unresolved issues and exact next action. Record its chat ID and result here when assigned/completed. Do not mark a task complete merely because a draft or proposal exists. For a profile task, distinguish guidance drafted, profile installed and behavior exercised.

Established requirements: MC coordinates rather than authors roadmaps or searches deeply; continuity lives in files; unspecified intent is surfaced by both creator and reviewer; integration timing/grouping is deliberate. D-023 defines the explicit Mission Control role, shared Status/Monitor and cycle ends; D-021/D-024 retain same-folder Commit Supervisor dispatch; owner approval remains required before commit/push. Future roadmap identities and unadopted detailed workflow choices remain separate decisions.

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
- **Construction constraint:** exercise filled-out assignment/hold/resume records without running MC. Controller registration, ownership and acknowledgment are deferred launch steps, not item 2 closure requirements. The existing illustrative walkthrough does not prove an executed exercise.
- **Start with:** [coordination-system.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/coordination-system.md), [registry.md](registry.md), [bulletin.md](bulletin.md). Use MC-T01's boundaries.
- **Outcome:** Flat Markdown registry, bulletin and assignment/resumption packet were created. The owner's instruction to continue the TODO is treated as acceptance of this setup convention; later evidence can refine fields without reopening the completed setup task.

### MC-T03 — Define Mission Control's domain and future-roadmap interface

- [x] **Deliver:** Mission Control's own domain-routing model and the interface for accepting three product roadmaps later.
- **Decide:** which domain boundaries MC needs to function, how future roadmap supervisors register source/dependencies, and how an existing Capture is selected as a domain's memory. Roadmap subjects, owners and SPECs are intentionally deferred.
- **Done when:** MC can accept a future roadmap assignment without redesigning its records; current domain routing is clear. Do not invent or preselect the three roadmaps.
- **Start with:** [domain-routing.md](domain-routing.md) and the domain/Capture distinction in [coordination-system.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/coordination-system.md); record the result using MC-T02. Earlier five-track proposals are not approved input structure.
- **Outcome:** Defined routing by accountable role and a source-backed domain brief, plus a future roadmap intake packet. Product domains and roadmaps will be named only when the owner assigns real work.

### MC-T04 — Adapt the existing Launchpad domain agent and working-memory workflow

- **Owner sequencing (D-018):** Launchpad use/exercise is deferred until the owner returns to it. It is not a prerequisite for rebuilding or directly using Roadmap Creator.

- [ ] **Deliver:** adapt the existing Launchpad fronting agent and its folder-local instructions for ideation → shaping → review → planning handoff. One main session fronts each domain; bounded side chats share its CWD and can checkpoint its registered history. Do not create a duplicate fronting role.
- **Progress:** the template two-role contract is reconciled under D-005. The [skills/agent inventory](skills-and-agents.md) identifies v1 replacement gaps and migration dependencies (D-006). D-007 created nine local skills, three namespaced profiles and extracted helpers; see [deployment.md](deployment.md). Global definitions remain intact; local skills and profiles use mc- names. D-017 prepared five source-linked Launchpad homes without starting sessions or moving Captures. Runtime discovery confirmation, selected Capture migration and the continuity example remain open; see [template-review.md](template-review.md).
- **Documentation review:** D-013 adds change-driven Document Sweep with saved text baselines and carried findings; retires Second Brain while preserving explicit Checkpoint and record helpers. A real-domain semantic exercise and independent Release Validation remain open.
- **Planning readiness:** D-015 adds inline [mc-preflight](.agents/skills/mc-preflight/SKILL.md) for First Draft or Roadmap Creation, with distinct thresholds and visible gaps. Definition validation does not establish runtime behavior or complete MC-T04/05/06.
- **Conversation evidence:** D-016 adds scoped read-only CWD/main-source resolution and FTS5/BM25 conversation search, with context locators, proposal/decision tracing and explicit coverage limits. Shared contract and tools are installed/tested; no main source or checkpoint cursor was registered.
- **Starter documents:** D-011 adds adaptable core templates, a bulletin and static schema, with conversation prompts, typed ambiguity/contradiction records and supersession rules. A populated domain migration and successor exercise remain open.
- **Investigation contract:** D-009 establishes [shared governance](investigation-contract.md), specialty responsibilities, assignment/report fields, parallelism, synthesis and stopping rules. Launchpad, First Draft and the template reference it. D-010 adds standing dispatch/follow-up authority for the main Launchpad session within its active project. No specialist profiles or live investigation exercise are claimed complete.
- **Decide:** source/decision/issue ownership, bounded specialist assignments, report size and how replacement sessions resume. Adapt the existing Launchpad role; replace legacy Second Brain v1 with focused procedures while preserving needed schema, provenance and validation behavior.
- **Done when:** a bounded example produces a useful domain brief and unresolved questions, and a replacement session can pick it up without the original transcript.
- **Start with:** MC-T01–03 and [coordination-system.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/coordination-system.md). This task defines the role; it does not launch all domain agents.

### MC-T05 — Build the independent Release Validation profile

- [ ] **Deliver:** Release Validation instructions/profile, review assignment templates and readiness report.
- **Installed under D-018:** `mc-planning-validation` and `mc-planning-validator` with draft, candidate-stage and independent release modes; four explicit review perspectives, source/approval tracing, exact candidate identity and repair ownership. Definitions and structural checks are complete; independent agent exercises remain open.
- **Worker review (D-022):** worker-handoff mode and manager routing installed for drafts, candidates and substantive reports. Still exercise fresh session isolation, a useful conditional draft, unsupported investigator claims, factual source-check exemptions, repairs that invalidate earlier evidence, and distinct worker/stage/release reviewers.
- **Cover:** intent/coverage; architecture/code standards; blast radius/dependencies/concurrent work; verification/handoff. Decide which checks require separate specialists and which can be combined.
- **Done when:** independent exercises show it catches missing intent and a dependency gap, accepts a useful First Draft with disclosed open questions in draft mode, and refuses to call an unresolved release candidate ready in release mode. It reports independently to MC and leaves repairs to the creator.
- **Terminology:** D-015 reserves Preflight for the installed inline input-readiness skill; this independent final gate is now Release Validation, installed under D-018 and awaiting independent behavioral exercise. The source below uses the older name.
- **Start with:** historical planning preflight in [integration-jobs.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md); MC-T01–02. Preserve applicable existing review discipline without automatically duplicating review layers.

### MC-T06 — Update the SPEC/Roadmap Creator for First Draft and Release Validation

- [ ] **Deliver:** targeted creator-guidance changes connecting First Draft, issue disclosure, shaping, release candidate and independent Release Validation.
- **D-015 design:** implement the Roadmap Creation Supervisor's two-stage assignment/return and bounded acceptance loop from the role hierarchy, keeping it distinct from the existing implementation supervisor. D-018 now installs the Creation Supervisor, stage orchestrator, leaf candidate author and independent planning validator, including a shared packet/repair/approval contract. Launchpad remains optional.
- **Progress:** D-008 adds the separate [First Draft skill](.agents/skills/mc-first-draft/SKILL.md) and profile, with candidate vertical slices, smoke scenarios, progressive wiki/standards and impact checks, and explicit decision gaps. Creator preserves these inputs without treating them as approved contracts. D-018 rebuilds the entry point and connects stage/release validation. Behavioral exercise remains open; this side conversation did not launch agents.
- **Draft Supervisor (D-019):** standalone skill/profile installed; reuses the first-draft stage, leaf author and independent draft validator, with bounded supervisor repair/acceptance and discussion-only handoff. Exercise direct conversation input, honest open intent, material repair, unchanged-evidence reuse and runtime/owner waits; no automatic candidate creation.
- **Preserve:** standards routing, authority distinctions, dependency checks and applicable owner approval gates. The primary creator must raise missing intent itself; it cannot outsource that responsibility to review.
- **Done when:** a bounded example returns a rough draft and meaningful questions without inventing intent, and later revisions resolve or explicitly defer issues before claiming release readiness.
- **Start with:** MC-T05's agreed handoff contract, [integration-jobs.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md) and the installed roadmap-creator skill. Exercise the installed stage and release contracts, including reviewer independence and current-candidate approval.

### MC-T07 — Build the requirements-definition agent

- [ ] **Deliver:** a bounded investigation profile, issue-to-requirements report and its evaluation contract.
- **Cover:** what is missing, existing authority, feasibility facts, acceptance needs, dependencies, alternatives and genuine owner choices. Decide its relationship to the domain-agent role and how Release Validation evaluates this type of report.
- **Done when:** a missing-capability example yields an evaluated report usable by the creator without pretending the report approves product scope or implements the missing feature.
- **Start with:** MC-T04–06 and the prerequisite-work path in [integration-jobs.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md).

### MC-T08 — Build and pilot ticket sessions and reconciliation

- [ ] **Deliver:** executable ticket-session/review guidance, a bounded small-fix workflow pilot, current inventory comparison and a small reviewed set of ticket-to-work mappings. Record the remaining batches separately.
- **Progress:** D-014 defines [ticket intake and workflow](ticket-workflow.md), including independent review, exact candidate evidence, finding disposition and MC return points. Runtime procedures/profiles and a pilot remain open; documentation alone does not close this task.
- **Cover:** active, superseded, obsolete and duplicate intent; projected/partial/approved coverage; delivery and acceptance evidence; uncovered requirements. Preserve many-to-many mappings.
- **Done when:** the pilot distinguishes superseded from implemented and records disputed/incomplete mappings. Recheck the dated RCC-0104 registry discrepancy instead of assuming it remains. Canonical status changes follow recorded authority.
- **Start with:** [ticket-inventory.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/ticket-inventory.md), MC-T02–04 and current ticket/SPEC sources. A pilot does not constitute a review of the entire backlog.

### MC-T09 — Build the Commit Supervisor

- **Current S5 state:** installed; isolated rehearsal pending. Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. [Canonical entry/profile and active routes](deployment.md) replace historical `mc-review-and-merge`; [owner assignment](planning/commit-supervisor/execution/approval-receipt.md) authorizes S1–S6 setup/rehearsal. [Current execution evidence](planning/commit-supervisor/execution/S5-builder.md) does not complete MC-T09. S6 owns actual independent role/app/recovery rehearsal and final completion evidence.

- **D-024 planning result:** [SPEC-COMMIT-SUPERVISOR-01](planning/commit-supervisor/SPEC.md) defines the integrated workflow and identifier migration; separate independent worker-handoff, stage and release reviews passed. [Exact candidate/evidence](planning/commit-supervisor/PLANNING.md) is ready for owner assignment. SPEC preparation does not finish this task; implementation and the isolated behavioral rehearsal remain required.

- **Historical D-021/D-023 installation:** `mc-review-and-merge` skill/profile and bounded packet/evaluation/approval procedure installed. Commit/push requires owner go-ahead; Mission Control may dispatch preparation after its cycle stops. Behavioral rehearsal below remains unperformed; installation is not whole-task completion.
- [ ] **Deliver:** profile, MC assignment packet, integration evaluation gate, change/issue report and checkpoint/resume procedure.
- **Decide:** accepted SPEC grouping, scoped commit ownership, conflict routing, PR-only versus merge outcomes and standing Git authority. Include the path from a missing requirement to MC-T07/06 and prerequisite execution while integration waits.
- **Done when:** an isolated rehearsal preserves unrelated work, evaluates a combined candidate, records a dependency wait and resumes from its checkpoint. It distinguishes capability landed from consumer adoption and retains notification obligations. No production merge is needed to prove the workflow.
- **Start with:** [integration-jobs.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md), MC-T01–02 and MC-T05–07. Keep planning Release Validation and implementation/integration evaluation distinct; preserve Fusion's separate Alpha follow-up rules.

### MC-T10 — Build the navigable HTML skeleton

- [ ] **Deliver:** the three-root artifact: Roadmap → Milestone/SPEC → Slice → Checklist, with source links, status, owners, evidence freshness, dependencies, holds and ticket relationships.
- **Decide:** where it lives, how it reads the records and how refresh works. The registry remains the source; HTML must not become an independently edited progress ledger.
- **Done when:** one representative branch can be expanded to checklist detail and a cross-roadmap dependency inspected. Unknown/unassigned work stays visibly unknown; no invented SPECs or progress percentages.
- **Start with:** MC-T02–03. Use three clearly unassigned future-roadmap slots and labeled sample data, never invented product roadmaps.

### MC-T11 — Assemble the Mission Control profile and rehearse turnover

- **D-023 status:** general-assistant AGENTS and explicit `mission-control` role installed; Status and Monitor are separate shared skills. The owner will hand off/archive/start and pin the selected task. Earlier construction-only dispatch language below is historical where it conflicts with D-021/D-023; turnover rehearsal remains open.
- [ ] **Deliver:** MC profile/instructions that connect the agreed roles, registry, reports, artifact and successor entry point.
- **Exercise:** dispatch versus hold, issue routing, an integration requiring prerequisite work, and a successor reading exercise conducted by a setup/review chat, without launching the first MC agent during construction. Keep deep work with the assigned role and preserve owner-managed chat creation until explicitly changed.
- **Done when:** a successor determines the current state and next action from the compact packet; it neither duplicates an active writer nor mistakes an owner wait for a stopped run.
- **Start with:** MC-T01–10, using bounded scenarios rather than live product implementation.

### MC-T12 — Configure the hourly monitoring and recovery loop

- **D-023 status:** shared incremental Status, hourly Monitor, cycle ends, duplicate prevention and supervisor pause/resume after authorized dispatch defined. No schedule created; runtime checks remain. The earlier “fully built” condition below is historical.
- [ ] **Deliver:** the monitoring configuration, notification rules, recovery classifications and stop/pause/resume behavior, prepared without activating the recurring loop. Record an automation identity only if actually created inactive; otherwise record creation as a launch step.
- **Decide:** the launch procedure after the system is fully built and the exact standing authority for follow-up messages, resumption and replacement sessions. Distinguish an intentionally waiting job, completed assignment, owner gate and premature termination.
- **Done when:** bounded component checks and explicit sample scenarios validate durable updates, artifact refresh, quiet unchanged behavior and stopped-job classification without running MC or its recurring loop. Distinguish construction validation from deferred first-live-run checks. Activation remains off until the system is fully built; do not claim live monitoring has been exercised.
- **Start with:** MC-T11's tested behavior and existing scheduling capabilities. Preserve still-valid evidence and prevent duplicate dispatch/mutations after interruption.

## First chat to open

MC-T01 through MC-T03 have completed their setup deliverables. Under D-018, the owner defers Launchpad use and selects the Roadmap Creator rebuild. Its definitions and MC-T05 validation dependency are now installed; a future owner-managed session can exercise MC-T05/06 or take another selected setup task. MC-T04 remains available when the owner returns to Launchpad. Product roadmap selection remains a later owner action.

When opening each later chat, assign only that task ID, link its named inputs and prior outcomes, and specify where its return packet belongs. The task closes with a useful result or explicit unresolved issue; listing later tasks is not permission to start them automatically.
