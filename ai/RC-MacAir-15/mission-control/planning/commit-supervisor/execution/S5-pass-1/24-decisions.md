# Owner decisions

## D-001 — Controller and Launchpad homes

Owner direction in this side conversation: Mission Control has its own durable AGENTS.md and CWD; individual Launchpad folders are subordinate sessions' CWDs. Use the existing template to align new folders. The folder persists when its assigned session changes.

## D-002 — Continue the existing TODO

Owner: “complete our current to do, but through the lens of this new system” and “go ahead and populate mission control with it's necessary files”. This authorizes the controller-home bootstrap. Preserve the task sequence and recorded outcomes. Discuss template changes before treating proposed additions as settled; no bulk migration was performed.

## D-003 — Full Access

Owner: “yes, I want sessions to have Full Access.” Record the project-local default for this home and descendants: `sandbox_mode = "danger-full-access"`, `approval_policy = "never"`. This does not remove the existing per-SPEC owner acceptance checkpoint or turn an hourly-check plan into an active automation. Verify effective settings when a real session is registered.

## D-004 — Build the system before running Mission Control

Owner: “We will not run our first Mission Control Agent until the system is fully built.” Continue construction through owner-managed setup chats. Do not launch the first MC agent or activate its hourly loop during construction. Prepare and validate records, profiles, handoffs and monitoring using document examples and bounded component checks that do not run MC. Live controller acknowledgment and registry ownership are launch-time steps, not MC-T02 completion requirements. This supersedes the earlier immediate-controller-handoff expectation without claiming any unperformed exercise complete.

Latest revision: D-021 supersedes this universal launch prerequisite with a general assistant and deliberately selected Alert-Monitor. Installation still does not activate a timer or dispatch work. Retain this paragraph as historical owner direction, not the current monitor activation rule.

Recorded by Codex side chat (ephemeral), 2026-09-25T15:50:36Z. The first MC session is deliberately absent, not a stalled run or missing setup dependency.

## D-005 — One fronting main session and bounded side chats per domain folder

The owner clarified that the main session takes the existing Launchpad/fronting domain role and its Codex side chats inherit its CWD. Side chats may run `/checkpoint` against the main session. The owner requested reconciliation of the template so agents know which of these two roles applies.

The adapted local AGENTS.md now distinguishes the owner-designated main domain session from its bounded support side chats. Shared CWD selects the memory home; it does not establish identity or transfer the main session's authority. Side chats use the registered main task as a history source without acquiring its UUID or creating a separate domain workspace. Launchpad, Capture, Second Brain and Checkpoint remain procedures used within those roles, not extra fronting agents. The inert template and deferred Mission Control launch remain unchanged constraints.

Recorded by Codex side chat (ephemeral), 2026-09-26T00:49:22Z. No global skill was edited or main task registered by this change.

## D-006 — Second Brain is legacy v1

Owner: “second brain is the v1 of this. Checkpoint, and some other skills will replace it.” The owner accepted a bounded inventory of the existing roles, skills, dependencies and proposed homes. Treat Second Brain as a legacy source, not the default support role to perpetuate in the new system. Preserve needed capabilities while identifying their replacements; do not claim Checkpoint replaces initialization, schema maintenance, research and all record-routing behavior by itself. The other replacement skills remain to be identified from actual needs.

Recorded by Codex side chat (ephemeral), 2026-09-26T00:59:37Z. [skills-and-agents.md](skills-and-agents.md) contains the inventory and proposed migration boundary. No global installation was changed by the inventory.

## D-007 — Create local profiles and skills

Owner: “Okay, let's create our profiles and skills. Approved.” Implement the discussed local package and cross-references, preserving main/side roles, owner-managed folder-bound sessions and the no-MC-until-built constraint. Creation is not authority to start a roadmap or live controller.

Implementation uses distinct `mc-` names for both local skills and profiles, avoiding ambiguity with installed global definitions. Project-only suppression of same-name skills did not remove duplicates in the prompt-rendering check, so that approach was removed. Global definitions and general utilities remain intact. The exact created definitions, validation results and runtime limits are in [deployment.md](deployment.md).

Recorded by Codex side chat (ephemeral), 2026-09-26T02:11:26Z.

## D-008 — Add a First Draft role

Owner proposed an agent that takes a prepared packet, assembles a basic skeleton and identifies discussion, decisions and code lookup needs, then authorized creation: “Let’s do it.” The owner asked how to remain aware of vertical slices and smoke tests without defining too deeply, and when wiki, code standards, blast radius and dependencies enter.

Implementation: local `mc-first-draft` skill/profile with provisional slice cards, observable smoke scenarios, early source constraints and impact hypotheses, and explicit research/intent gaps. Detailed checks and executable slices remain Creator work; independent Preflight remains a separate unfinished task. This is the setup chat’s concrete design response to those questions, not owner approval of any product draft or future gate design. No agent is launched by installing the role.

Recorded by Codex side chat (ephemeral), 2026-09-26T11:08:58Z.

## D-009 — Shared investigation governance

Owner: “Let’s do that. Let’s define the contract.” This accepts the distinction discussed in this side conversation: establish shared responsibilities, assignment/report fields, evidence and authority rules, while the fronting Launchpad agent chooses project-specific questions, specialties, sources, parallelism and follow-up.

[investigation-contract.md](investigation-contract.md) records that design, including minimum orientation before First Draft, decision-driven investigation after it, bounded rechecks, separate investigative reports and main-session synthesis. The five specialties are assignment responsibilities, not newly installed profiles. This authorization defines the system; it does not launch investigators or supersede owner-managed session creation, side-chat restrictions or the deferred first MC run.

Recorded by Codex side chat (ephemeral), 2026-09-26T11:30:21Z.

## D-010 — Main Launchpad may dispatch bounded investigators

Owner: “Okay, this is good. Let’s set that up.” This approves the preceding standing-rule proposal: the main Launchpad agent may scope and start investigators when their answers can materially inform the next planning decision, run independent assignments in parallel, track identities/revisions/reports, and synthesize results. No separate owner approval is required for each investigation within the active project scope.

This narrowly supersedes D-009’s owner-routed investigation dispatch and earlier blanket owner-managed session language. The owner still creates and assigns main domain sessions. Side-chat delegation restrictions, product-choice authority, per-SPEC acceptance and D-004’s deferred MC/monitor launch remain intact. The investigator authority includes scoped steering/follow-up and recovery after verifying the old writer is inactive, not unrelated task creation, external messaging or product execution. Current tool and session restrictions continue to apply.

The dispatch procedure lives in [investigation-contract.md](investigation-contract.md#dispatch-and-follow-up). A main session may use an available general agent with explicit specialty instructions while bespoke investigator profiles remain uninstalled. No investigator is launched by this setup change.

Recorded by Codex side chat (ephemeral), 2026-09-26T11:38:53Z.

## D-011 — Restore conversational starter templates

Owner: “Let’s bring these ideas onto our templates.” This authorizes adapting the recovered five-document core and its section/record conventions into the Launchpad template. Source: the August 9 “Review CSS UI capture files” discussion, task `019fe600-09bc-7a83-b172-2682291bf7f4`, and [Capture 020 decisions D-15–D-18](../Captures/020-CSS_UI_Changes/DECISIONS.md). Historical naming/Second Brain dispatch choices remain superseded where newer MC decisions differ.

The template now separates conversation recall, owner intent, explicit decisions, typed issues and proposals. Newer owner direction includes consequential ambiguity and missing intent in Issues; casual exploration remains in Capture. Clear owner revisions retain supersession history; possible contradictions and agent interpretation drift remain sourced questions. Sections guide discussion without demanding answers to every prompt. Added a starter index and bulletin for a coherent reusable folder; no sample product claims, identities or approvals were fabricated.

Recorded by Codex side chat (ephemeral), 2026-09-26T11:48:39Z. Templates remain inert; live history review and migration are separate work.

## D-012 — Add reference, change-surface and contract templates

Owner: “Let’s add references, change surfaces and contracts.” The owner requested sections that distinguish reference kinds such as code/user quotes and change surfaces beyond code, including wiki. Added the three templates to the starter pack and schema, with stable record IDs, source context, authority/evidence distinctions and cross-links. H2 sections group concerns; H3 records may use H4 subheadings for deeper treatment. Projects may adapt or omit unused extensions without inventing content.

Recorded by Codex side chat (ephemeral), 2026-09-26T11:58:49Z. No live records, domain migration or product changes are implied.

## D-013 — Retire Second Brain and add documentation sweeps

Owner requested deleting the “hidden brain” skill in the context of Second Brain and Checkpoint, and a new skill that periodically examines documentation changes after meaningful batches of issues rather than checkpointing conversation on a timer. Inspection found `second-brain` as the sole installed brain-named skill. It was removed from personal skill discovery with a rollback copy outside discovery; necessary record helpers were retained and its five legacy caller files repaired.

Created local `mc-document-sweep`: initial package review or comparison with the previous reviewed document snapshot; intent/decision propagation; bounded source discovery and sufficiency review; carried findings; separate review completeness and readiness assessment. Trigger through the main Launchpad session after material changes and before planning handoff. Preserve explicit Checkpoint invocation/cursors, side-chat restrictions, independent Preflight and deferred MC launch. No recurring automation or live sweep is authorized merely by installation.

Recorded by Codex side chat (ephemeral), 2026-09-26T12:08:25Z. New procedure and helper validation are recorded in the changelog; no semantic review result is implied.

## D-014 — Ticket intake and unattended project sessions

Owner approved the proposed ticket-session model: “Okay, let's do it that way then.” The preceding discussion defines TICKET.md as an initial brief for objectives, evidence, scope, success conditions, unresolved intent and authority; a working thread backed by a durable Launchpad folder; proportionate small-fix workflows; separate independent review reports in that folder; and owner steering with an auditable trail through repair, verification and acceptance.

The owner also specified that MC provisions, monitors unattended activity including First Draft, answers broadly across projects and may ask the responsible agent for an answer to relay. Record that as eventual operating behavior, with a user-selected schedule. MC keeps coordination context while domain sessions keep depth. [ticket-workflow.md](ticket-workflow.md) records the concrete contract. Setup adds documentation, not a live ticket, operational MC, product authorization or a waiver of existing SPEC acceptance gates. D-010's construction-stage investigator authority and all side-chat restrictions remain unchanged.

Recorded by Codex side chat (ephemeral), 2026-09-26T23:07:47Z.

## D-015 — Inline Preflight and process Validation

Owner: “Alright, let's make it so, then add the new defintions to our role-hierarchy.” This approves the preceding distinction: the Launchpad workfolder agent runs an inline Preflight skill before First Draft or Roadmap Creation; autonomous stage checks are Validation, and the independent final planning review is Release Validation.

Created `mc-preflight` with separate destination thresholds, support for an existing draft or conversation/documents, current Code Standards and User Preferences checks, source/sweep freshness, explicit intent and dependency gaps, exact handoff inputs and a compact readiness report. It does not create the plan, dispatch work, approve scope or replace downstream analysis. Existing Document Sweep, explicit Checkpoint, side-chat boundaries and owner acceptance remain intact.

Updated the role hierarchy to show Launchpad's inline procedure, the two-stage Roadmap Creation Supervisor design, stage validation and its bounded acceptance/routing loop, and independent Release Validation. The final gate formerly called Preflight remains unbuilt under MC-T05; MC-T06's broader supervisor/stage implementation and behavioral exercises remain open. The local roadmap supervisor profile still owns implementation, not creation. This change installs only the inline skill and reconciles guidance; it does not launch sessions or activate MC.

Recorded by Codex side chat (ephemeral), 2026-09-28T02:13:13Z.

## D-016 — Conversation evidence tools and proposal authority

Owner: “Fantastic. Let's integrate our ability to read conversations and add any tools we need. Are agents able to find the main thread or ask?” The owner then identified shared CWD as a lookup aid. The preceding correction selects PROPOSALS.md with explicit DECISIONS links instead of adding APPROVALS.md.

Implemented bounded read-only conversation retrieval in the existing session-hub-codex tools checkout: exact-CWD candidate listing, registered/explicit main-source resolution, in-memory FTS5/BM25 search with turn/message locators and limits, and existing context reads. Configured the MCP server only in Mission Control's local config and retained an absolute CLI fallback. CWD or request matches do not designate the main role; ambiguous cases return candidates and a clarification question. Registries/cursors and source databases are not modified by retrieval.

The shared conversation-evidence contract now governs Launchpad, preflight, creators, investigators, sweeps and checkpoint guidance. It requires checking existing proposal/decision and Wiki authority before escalating missing intent, preserving citation scope and later supersession, and labeling inference or unavailable history. An Intent and Authority investigation is a selectable specialty, not a new spawned profile. Current side-chat restrictions, explicit history checkpoint invocation and deferred MC activation remain intact.

Recorded by Codex side chat (ephemeral), 2026-09-28T03:08:36Z. No product scope, main-thread registration or agent launch is approved by this setup change.

## D-017 — Prepare distinct Launchpad homes before choosing build details

The owner agreed to separate plugin foundation, governed events and ledger, plugin views and provisioning, and fusion health and observability into distinct Launchpad folders. The owner then requested another folder for remaining CHAT-AR close-out before plugin builds, said “Do it,” and clarified: “I'll sort out the details when the new folders are built.” This authorizes provisioning and source-backed local scope boundaries. It does not select the installed plugin path, first proving plugin, exact chat verification exit gate, executable roadmaps, implementation sessions or Mission Control activation.

Four new folders were prepared under [launchpad](launchpad/), alongside the existing health folder. [Registry workspace bindings](registry.md#workspace-and-session-bindings) and local TICKET/index/AGENTS packets provide re-entry. The chat folder owns transferred verification and retirement; the health folder retains observations and logger-consumer planning. Source Captures and accepted CHAT-AR records remain in place.

Recorded by Codex side chat (ephemeral), 2026-09-27 PDT / 2026-09-28 UTC.

## D-018 — Rebuild Roadmap Creator around the planning hierarchy

Owner: “I will use the launchpad workflow later. For now, I need to work on other items. Let's rebuild the Roadmap Creator using our new hierarchy.” This selects the creator rebuild without making Launchpad exercise a prerequisite.

The local mc-roadmap-creator entry becomes the Creation Supervisor. Added a bounded planning-stage orchestrator, a leaf executable-candidate author extracted from the prior creator, and an independent planning validator with draft/candidate-stage/release modes. First Draft remains a leaf author. The shared contract defines stage packets, parallel investigation with one author, independent gates, supervisor acceptance/routing, safe deferrals, source/approval tracing, durable waits/resumption and exact-candidate owner approval. The existing implementation supervisor and SPEC/slice execution gates remain separate and unchanged.

A first draft or conversation/documents may enter directly; a simple settled packet may omit draft generation. Current Code Standards and User Preferences remain required at appropriate depth. No planning result can claim approval from search, a self-check or a clean reviewer alone. Installing the required Release Validation role supports this rebuild; independent agent behavior remains to be exercised under MC-T05/06.

This authorizes local definitions/configuration and bounded helper/structural verification, not a product roadmap, implementation, an operational MC run, timers, or delegation from this restricted side conversation. No global skills or runtime limits were changed.

Recorded by Codex side chat (ephemeral), 2026-09-28T06:51:56Z.

## D-019 — Standalone First Draft Supervisor

Owner: “Now let's do the equivelent for our draft supervisor.” Following D-018, this authorizes the equivalent local hierarchy and guidance for a standalone draft-only process.

Added mc-draft-supervisor as a skill and thin local profile. It owns intake, bounded stage assignment, evidence-based acceptance/repair, owner-question routing and durable discussion handoff. It reuses mc-planning-stage in first-draft mode, the existing leaf mc-first-draft author and independent draft-mode mc-planning-validator. Roadmap Creator still assigns its own first-draft stage directly; the supervisors are not nested and the stage process is not duplicated.

The entry accepts conversation/documents, an existing draft or a Launchpad handoff. It follows current Code Standards, User Preferences and conversation/proposal authority. A useful conditional draft can complete with visible open questions after independent draft validation; it does not require executable SPEC detail, a release manifest or implementation approval. It stops for discussion and does not automatically start Roadmap Creator. Existing session restrictions, owner-managed persistent tasks and deferred MC activation remain unchanged.

Updated shared contracts, caller routing, hierarchy and successor/task records. This setup request does not launch a draft, agents, an automation or product implementation. Independent behavior remains to be exercised under MC-T06.

Recorded by Codex side chat (ephemeral), 2026-09-28T07:42:42Z.

## D-020 — Owner-directed ticket changes by any agent

Owner: “Adding tickets later, redefining thier scope, or changing them and closing them, should be allowed by any agent at my request.” The owner explains that a current discussion may split to handle an interim build before the main build being discussed, and that part of an existing ticket may be absorbed into an interim ticket followed by a second build ticket.

Any agent receiving the owner's request may perform the requested ticket-record changes, including creation, revision, splitting, combining scope and closure. This authority is not reserved to Mission Control, shaping sessions or a folder's main chat, and it does not require returning to those roles for repeat approval. The agent acts within the actual request and coordinates overlapping writes to the same records; shared-file ownership prevents collisions, not owner-directed ticket editing. This qualifies D-005/D-014 where their role language might otherwise be read as an exclusive ticket-editing gate.

Tickets are revisable boundaries for work. Preserve the source intent and scope-change history, identify which portions move and their destination ticket, and keep deferred work visible. A possible sequence is existing ticket A → interim ticket B absorbing a named portion → later build ticket C for the remaining or reshaped outcome. Link dependencies only where B's result actually enables C; succession alone does not establish a dependency. The owner may revise or close A with a stated disposition. Do not label removed or deferred work delivered merely because A closes, and do not require a receiving agent's acknowledgment to invent an additional approval gate after the owner has explicitly directed the transfer.

Record intent and design now. Numbering, roster storage, allocation tooling and template/rule migration remain unimplemented under the owner's preceding instruction to discuss intended changes first. This decision defines ticket-record authority; a ticket change is not itself a product-build, commit, merge or monitoring assignment. See [P-001](template-review.md#p-001--intake-shaping-and-numbered-ticket-conversations).

Recorded by Codex side chat (ephemeral), 2026-10-02T00:01:39Z (2026-10-01 PDT). No main-task UUID is asserted and no live ticket has been changed by this record.

## D-021 — General assistant, explicit Alert-Monitor and owner-gated Review and Merge

Historical activation mapping: D-023 now names the explicit role Mission Control and separates Status/Monitor. D-021's Review and Merge authority and owner commit/push gate remain applicable.

Latest owner revision (2026-10-03 PDT): engineer this home's AGENTS.md as a general-purpose Mission Control Assistant. The owner will hand off, archive the old chat, start a fresh Alert-Monitor and pin it. One long-standing selected task owns alert/monitor work. The owner can separately create same-folder tasks for maintenance, scheduling and questions.

`/monitor` at the beginning of a session explicitly primes the Alert-Monitor role; `$monitor` invokes the same local skill. Once selected, an intentional owner instruction to monitor enables one hourly thread heartbeat to check registered work and associated processes. Selection, quoted discussion and installation do not start the schedule. Repeated activation updates/reuses the heartbeat. A successor must resolve ownership and disable/transfer the predecessor's schedule before enabling its own. Archival/pinning remains owner-managed.

The selected monitor has standing authority to hand eligible completed builds to separate persistent Review and Merge tasks in this same memory folder. It chooses whether dependencies or the accepted integration unit require a hold, gives a bounded packet and avoids duplicate dispatch. Product checkouts remain separate from memory CWD. Other roadmap/build dispatch authority and existing per-SPEC acceptance gates are unchanged.

Review and Merge prepares the concrete integration candidate, records issues/checks and satisfies required independent evaluation, then ends its turn waiting for the owner's say-so before commit and push. Commands that create commits indirectly are inside this gate. Monitoring, a green evaluation, build completion and another agent's recommendation do not supply owner approval. PR publication/merge and Alpha operations require their applicable authority; no push or deployment is implied by preparation.

This revision supersedes the earlier universal D-004 launch prerequisite and startup controller identity where they conflict: general assistant tasks may operate now, and the monitor is a deliberately invoked persona rather than every session's default. Earlier role hierarchy and records remain useful for separately assigned workflows, not automatic dispatch. No timer, task dispatch or live monitor activation is authorized by this setup discussion itself.

Recorded by Codex side chat (ephemeral), 2026-10-04T03:26:55Z (2026-10-03 PDT). No main-task UUID is asserted. Local definitions and continuity records are the scope of this setup change.

## D-022 — Independent planning worker handoff review

Owner, after discussing independent review of individual planning steps before higher review: “Let's do it. Can we resuse the same clean room idea? Do we need to adapt it?” This authorizes adapting the local planning workflow, not launching a planning job or agents in this restricted side conversation.

Reuse clean-room independence, original-source assessment, material findings and fresh repair passes through the existing mc-planning-validator. Add worker-handoff mode for draft/candidate authors and substantive decision-bearing investigation reports. Their manager assigns reviewers and routes repairs; authors and investigators remain leaf workers. Small factual lookups may receive a documented direct source check. Worker review checks the bounded assignment and evidence; separate stage review checks assembled coverage and seams; release review checks the complete executable package. Fresh reviewer sessions inherit no author/manager conversation or prior reviewer history and cannot reuse authors, underlying investigators or earlier-gate reviewers.

Adapt the acceptance threshold to the deliverable: a faithful draft can retain explicit open intent, and an honest partial investigation can pass report fidelity while its unanswered question still holds dependent work. Executable candidates must meet their assigned contracts; a handoff pass is not stage readiness, release readiness or owner approval. Leaf authors return authored work awaiting review, including FIRST_DRAFT_AUTHORED; the manager owns discussion-ready status after the required gates. Missing review capability preserves provisional work without self-certification. Existing implementation reviews and approval/delegation restrictions remain intact.

Recorded by Codex side chat (ephemeral), 2026-10-04T03:51:06Z (2026-10-03 PDT). Definitions and durable records are the scope; live behavior remains unexercised under MC-T05/06.

## D-023 — Mission Control role with shared incremental Status and bounded Monitor cycles

Owner clarification: Mission Control ends a monitoring cycle whenever it informs the owner of any next action or performs one. It continues only for status-only incremental progress. Any tracked build completion ends the cycle, whether reported for the owner, held or passed to Review and Merge. Roadmap Supervisors monitor their child orchestrators, disable monitoring for their own review/next-step work, and resume after the next authorized child dispatch. Every Status builds on previous Status. The owner approved two shared skills and the separate Mission Control entry by “Let's do it.”

`$mission-control` explicitly establishes the designated coordination role; it does not schedule anything. The separate `monitor` skill enables/reuses an hourly thread heartbeat and invokes `status`. `/monitor` no longer selects a persona; in an eligible assigned role it requests scheduling. Status observes, persists incremental evidence and returns role-relative events; Monitor pauses recurrence before actionable reporting or role transitions; the owning role performs authorized actions after pause confirmation. Status housekeeping/progress-only reporting is not a next-step action.

For Mission Control, one completed tracked build ends the whole cycle even when other tickets are active. Retain them in the report and do not automatically re-arm after the completion report/Review and Merge dispatch. A new owner monitor directive begins another cycle. Constituent slice/SPEC progress stays incremental where its responsible parent owns the next transition and MC need not act.

For an assigned approved Roadmap Supervisor run, this gives standing monitoring authority for acknowledged child execution unless the owner pauses/narrows it. On child return or actionable failure/stall, pause first, perform supervisor checks/repair routing, and preserve the mandatory per-SPEC owner acceptance checkpoint. Start a new cycle only after an authorized repair resumption or fresh next-SPEC orchestrator is acknowledged. Scheduling never supplies owner acceptance. Final roadmap completion leaves the supervisor heartbeat inactive.

Status retains prior valid completion/acceptance, current hierarchy, observed-versus-progress time, scope changes, holds and explicit unknowns. Reopening work requires invalidation evidence. Detailed supervisor/orchestrator and compact MC views derive totals/review phases from actual ledgers; the owner's sample ticket/roadmap numbers are illustrative, not live assignments. Role-relative event reporting prevents an underlying slice completion from being confused with a full build completion.

This supersedes D-021's Alert-Monitor identity and continuous-after-action behavior while preserving its general-assistant home, same-folder Review and Merge dispatch and explicit owner commit/push gate. D-022 planning review rules and unrelated assignments are unchanged. No live role, Status snapshot, heartbeat, task, product build or agent run is activated by installing these definitions.

## D-024 — Commit Supervisor and one integrated workflow SPEC

Owner: “Let's rename the review and merge to ‘Commit Supervisor’ since it is a top level role. It's lower level roles can use Orchestrator or variations on that.” The owner requests one SPEC integrating the recorded workflow into a process Mission Control can assign, producing a commit-ready end product, with the clean-room loop added where it fits.

**Commit Supervisor** is the current top-level role name. Review and Merge is its historical alias; the installed `mc-review-and-merge` entry/profile retain their existing identifiers until the SPEC's migration is implemented. The requested deliverable here is the SPEC, not execution of a live integration or installation of the replacement roles.

The SPEC must integrate intake and recoverable checkpoints, subordinate review orchestration, bounded technical repairs, Wiki updates, independent evaluation, verified development-app handoff and durable recovery. Preserve D-021's explicit owner gate before every commit-producing operation/push and D-023's separate MC cycle boundaries. Clean-room independence/materiality belongs in the required gates; the ordinary personal clean-room-loop budget does not become an arbitrary ceiling or success criterion for automated integration review. Unspecified consequential owner intent remains a reported issue rather than an invented solution.

Recorded by Codex main chat, 2026-10-04T07:13:38Z. This decision does not authorize commit, push, PR publication/merge, Alpha operations, implementation of this SPEC or a monitoring cycle.

Recorded by Codex side chat (ephemeral), 2026-10-04T04:10:15Z (2026-10-03 PDT). No main-task UUID is asserted. Scope: local entry/shared skills, affected supervisor/orchestrator guidance and continuity records; runtime rehearsal remains future work.

## Attribution and earlier authority

D-001–D-003 are sourced directly from the current side conversation. Recorded by Codex side chat (ephemeral), 2026-09-25T05:22:57Z. No main-task UUID is asserted. Earlier role hierarchy and acceptance decisions are carried from Capture 037 with their provenance in [source-map.md](source-map.md); source labels are not new approvals issued by this side chat.
