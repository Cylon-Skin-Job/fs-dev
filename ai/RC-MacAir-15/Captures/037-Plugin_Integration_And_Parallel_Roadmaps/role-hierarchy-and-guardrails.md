# Mission Control System — Role Hierarchy and Guardrails

**Capture:** Mission Control working memory · **Parent:** [Mission Control](mission-control.md)
**Status:** owner-directed system design; local planning hierarchy installed under D-018; independent behavioral exercise pending
**Updated:** 2026-09-28 (PDT)
**Trickle-down:** owner directions recorded in this Capture · **Roll-up:** agent profiles, supervisor guidance and operating procedure

Terminology updated under [D-015](../../mission-control/decisions.md#d-015--inline-preflight-and-process-validation): **Preflight** is inline planning-input readiness; **Validation** checks process outputs; **Release Validation** is the independent final planning gate previously called Preflight. Current procedures live in [Mission Control](../../mission-control/deployment.md); historical profile inventories below do not establish runtime availability.

## Purpose

This document defines the proposed operating tree that Mission Control will supervise. It turns rough inputs into reviewable plans, runs approved SPECs through existing gates, coordinates branch integration and reports only decisions or meaningful changes to the owner.

Mission Control is the portfolio coordinator. It keeps enough awareness of all active work to assign, sequence, hold and recover it. It does not become the builder, code reviewer or roadmap author. Managers and specialists own the deep work and return evidence-backed reports through durable records.

## System hierarchy

```text
Owner
└── Mission Control (portfolio coordinator and owner-facing contact)
    ├── Launchpad workfolder agent (fronting domain session)
    │   └── Inline mc-preflight skill → readiness report before planning handoff
    ├── First Draft Supervisor (standalone shaping and discussion handoff)
    │   └── Shared First Draft Stage Orchestrator
    │       ├── Bounded investigators and one First Draft author
    │       └── Independent draft-mode validation
    ├── Roadmap Creation Supervisor (planning continuity and routing)
    │   ├── Step 1 Orchestrator: First Draft / intake and shaping
    │   │   └── Assigned specialists and stage validation
    │   └── Step 2 Orchestrator: investigate, enrich and create SPEC/roadmap
    │       ├── Intent / coverage and ticket researchers
    │       ├── Codebase / blast-radius / dependency researchers
    │       ├── Code-standards / User Preferences / wiki analysts
    │       ├── Candidate Author and verification specialists
    │       └── Stage validation
    ├── Independent Release Validation (candidate review; reports to MC)
    │   └── Leaf validator; manager commissions supporting lens reviews if needed
    ├── Roadmap Supervisor (implementation of one approved roadmap)
    │   └── SPEC Orchestrators (one accepted SPEC at a time)
    │       └── Slice Builders
    │           └── Existing builder-owned review roles, as permitted
    └── Branch / Merge Supervisor (one selected integration job)
        └── Integration Orchestrator or assigned lead
            ├── Candidate-preparation agents
            ├── Conflict / impact investigators
            └── Integration-evaluation reviewers

Domain Stewards hold durable subject-area knowledge and can advise any branch.
They are a cross-cutting responsibility, not an extra command tier.
```


The owner-confirmed execution chain remains **Mission Control → Roadmap Supervisor → SPEC Orchestrator → Slice Builder**. Branch/Merge work is the second managed branch. The more detailed draft and planning stages below add earlier process management without changing the existing SPEC implementation hierarchy.

Each manager owns the result and directs its own subordinates. Mission Control assigns an accountable manager, sets the outcome, scope and authority, and tracks the result. It does not bypass that manager to direct every child task. Separate work may proceed concurrently under distinct owners; shared integration targets have one active writer.

## Standing owner guidance and attention contract

The [User Profile, Preferences and Design Philosophy](../../Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md) is the current standing owner-preference source. Mission Control reads it when taking over or routing work. The Launchpad workfolder agent, First Draft Supervisor, Roadmap Creation Supervisor, Candidate Author, Roadmap Implementation Supervisor and SPEC Orchestrator receive it in their assignment packet and consult it at their own scope and review gates. The Branch/Merge Supervisor and independent Release Validation use it when assessing tradeoffs, deferrals and owner attention. A current, specific owner instruction controls where it differs from the standing profile. The [Code Standards Wiki](../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md) supplies the applicable technical standards; specialists inspect the relevant articles rather than assuming the profile replaces them.

The profile makes **attention management** part of the workflow. Managers do the bounded, reversible work and return an evidence-backed synthesis. Mission Control decides what the owner needs to know now, what can wait with a named prerequisite, and what may continue quietly. An owner-facing item identifies the decision or change, affected work, recommendation, evidence, consequence of waiting and next action. Routine stage activity stays in the durable report. This keeps the owner aware of what is being built while concentrating their time on intent, steering and architecture.

Human checkpoints are placed where judgment or authority is needed: unresolved product intent, a material architecture tradeoff, a deferral that could create technical debt, release of an implementation-ready roadmap, the existing acceptance checkpoint before the next SPEC, integration choices with cross-roadmap effects, and attended remote Git publication. An agent's review result is evidence for these decisions, not a substitute for them. A First Draft can be returned for feedback with open questions; it is not thereby ready to implement. While an owner decision is pending, continue only independent work that cannot compound the issue.

The owner's 80/20 preference does not permit avoidable technical debt. A roadmap may retain an unresolved edge case when the later fix remains feasible and intervening work will not constrain or compound it. If that cannot be established, hold the affected work and ask. Planning and review must check likely multi-consumer server behavior, a clean path to a universal API, separated consumers, reuse before duplication, code standards, and the under-400-lines-per-file design goal. Escalate a real tradeoff with its consequences rather than silently building on an incompatible assumption.

## Role contracts

### Owner

Sets product intent, resolves choices only the owner can make, and supplies required approvals. Questions should be routed with the smallest useful context, affected work and consequences of waiting. Owner review is distinct from an agent's `CLEAN` result.

### Mission Control

- Maintains current job, dependency, branch/worktree and acceptance state across the active portfolio.
- Assigns work to the accountable supervisor, chooses which accepted SPECs form an integration unit, and decides whether a job proceeds or waits for a named prerequisite.
- Checks a **bounded, identified set of files and status records** heuristically to choose the next route: continue a stage, assign a specialist, ask the owner, enter Release Validation, queue integration, hold affected work, or recover an interrupted assignment. It records the source and reason for its routing choice and seeks a specialist when confidence or evidence is inadequate.
- Monitors ongoing processes as supervised work: distinguishes active progress, owner waits, dependency waits, completion and premature termination; checks for an existing writer before recovery; resumes from durable checkpoints.
- Receives concise syntheses and surfaces owner questions, unresolved material intent, failures, cross-portfolio effects and milestone changes.
- Does not author roadmaps, perform deep code searches, repair code, hand-review diffs, or claim implementation correctness. It reads supplied summaries, reports and narrowly selected coordination records. Git awareness is for inventory and scheduling.

### Domain Steward

Maintains a durable source map, owner decisions, ticket relationships, open issues and compact current brief for an assigned subject area. It answers bounded questions, consults researchers and returns affected work/dependency IDs. Subject authority comes from owner-named sources, not the agent's memory. It cannot decide owner intent, approve its own work or expand a write lease. Domain stewards may be continuing profiles with replaceable sessions; the profile/memory convention is still to be exercised.

All planning roles follow the [conversation evidence contract](../../mission-control/conversation-evidence.md) under D-016. Check PROPOSALS → DECISIONS and applicable Wiki/contracts before escalating missing intent; retrieve the original conversation and later revisions when needed. An authorized Intent and Authority investigation can resolve that bounded question. Exact CWD narrows thread candidates; a registry or verified assignment designates the main source. Targeted reads neither identify the caller nor advance a checkpoint cursor.

### Launchpad workfolder agent and inline Preflight

Launchpad remains the owner-facing working-memory agent. It runs [mc-preflight](../../mission-control/.agents/skills/mc-preflight/SKILL.md) inline before First Draft or Roadmap Creation handoff. This is a skill within the current session, not an extra supervisor, researcher or independent reviewer. The procedure can also assess a bounded supplied packet without taking ownership of its folder.

Preflight checks intent/authority, current source consistency, applicable Code Standards and User Preferences, known dependency/impact obstacles, current Document Sweep findings, and the exact receiving assignment. It identifies questions requiring deeper work without undertaking the Creator's complete code tracing or blast-radius analysis. Reuse existing issue IDs and review evidence; do not duplicate a current sweep or run Checkpoint automatically.

For First Draft, enough grounding for a useful skeleton is sufficient; explicit open questions are expected. For Roadmap Creation, outcomes and scope must be coherent and material owner choices resolved or validly deferred, with enough current evidence to begin detailed planning. An existing draft is optional: a conversation and documents may be sufficient, including for a single SPEC. Missing execution detail is not itself a reason to block the process that will create it.

Return `READY`, `READY_WITH_EXPLICIT_GAPS` or `NEEDS_PREPARATION`, with checked input revisions, limitations, evidence, affected outcomes, destination-versus-release blockers, resolvers and exact next actions. A passing report neither launches the receiving process nor approves a roadmap. Persist findings only within the current assignment's write authority.

### First Draft Supervisor

The installed [mc-draft-supervisor](../../mission-control/.agents/skills/mc-draft-supervisor/SKILL.md) owns a standalone draft-only assignment. It accepts a conversation/document packet, prior draft or Launchpad handoff, runs/reuses inline preflight at the first-draft threshold, and assigns one shared planning-stage orchestrator in first-draft mode. That stage manages bounded research, the existing leaf First Draft author and fresh independent draft validation. The supervisor checks the returned evidence, routes material repairs or genuine owner questions, and preserves a resumable checkpoint.

Completion means an independently validated current skeleton with visible proposals, conditional structure, candidate slices/smoke scenarios, likely dependencies and a prioritized decision/research queue. Open intent may remain when the draft is useful for discussion. Source and draft revisions tie the report to the checked output; an executable release manifest is not required. The supervisor returns to the assigned owner-facing recipient and stops. It does not automatically run Roadmap Creator or approve implementation.

Roadmap Creator continues to assign its own first-draft stage directly when needed. The two supervisors share stage/author/validator procedures without nesting one supervisor under the other. Both use the shared planning contract's ownership, independent validation, bounded repair and runtime limits. D-019 installs this standalone entry/profile; behavioral exercise remains MC-T06 work.

### Roadmap Creation Supervisor and Step Orchestrators

The installed [mc-roadmap-creator](../../mission-control/.agents/skills/mc-roadmap-creator/SKILL.md) is the Roadmap Creation Supervisor. It owns one planning process and its durable continuity. It owns the broader two-stage planning process; the standalone Draft Supervisor owns only shaping and discussion handoff. Both are distinct from the installed Roadmap Supervisor, which owns implementation. It accepts a prepared draft or conversation/document packet and assigns a bounded Step Orchestrator for each needed stage, with input revisions, output ownership, validation criteria and stop conditions.

1. **First Draft / intake and shaping:** organize grounded intent into a useful skeleton, candidate vertical slices, observable smoke scenarios and an explicit decision/research queue. Preserve already-settled detail. An existing adequate draft may satisfy this stage after an intake check; a simple settled packet may proceed directly to creation without manufacturing a draft milestone.
2. **Investigation, enrichment and creation:** resolve decision-relevant factual gaps; trace code, blast radius, dependencies, concurrency, standards, preferences, wiki and ticket coverage; produce the executable SPEC/roadmap candidate and verification/handoff evidence. Investigators return evidence to the assigned writer rather than editing the shared draft concurrently.

Step Orchestrators may divide an authorized stage into focused assignments and independent validation, subject to session/delegation limits. Each returns one synthesis and a durable checkpoint linking outputs, findings and evidence. The First Draft and Candidate Author roles remain leaf writers. Under D-018, the installed stage orchestrator may assign bounded investigators and independent validators during an authorized planning run, using the shared investigation and planning contracts. Existing session/depth restrictions still apply; side conversations cannot delegate. This is separate from Launchpad's existing investigation authority.

Unspecified product intent is recorded by the primary creator and checked during validation. Factual questions may be researched; permitted implementation choices need not be escalated. Material intent questions go to the owner through the assigned manager while unaffected work continues. Completing a useful First Draft with questions does not establish roadmap release readiness.

### Validation and supervisor acceptance loop

**Stage Validation** checks the returned output against that stage's assigned contract, original inputs and applicable guidance. Producer self-checks remain necessary; an independent stage reviewer, when required by the stage contract, is distinct from the author. Use different criteria for discussion-ready drafts and executable candidates. Carry finding IDs and evidence forward so later validation can focus on changed or uncovered conclusions without assuming earlier work proved final readiness.

The supervisor runs a bounded **acceptance and routing loop** after each stage return: verify input/output revisions and coverage; account for findings, repairs and valid deferrals; determine whether the next stage's prerequisites hold; then accept the stage, return precise repairs, route research or an owner question, or hold affected work. It checks evidence and process completion without repeating specialist source review. Revalidate affected work after repairs. Stop and checkpoint on unavailable evidence, owner/dependency waits or repeated attempts without material progress; do not turn the loop into perpetual regeneration.

**Independent Release Validation** separately assesses the final candidate before owner approval. Stage validation, inline preflight and a supervisor's acceptance are evidence, not substitutes for that independent final gate. These definitions preserve the existing SPEC/slice implementation gates and per-SPEC owner acceptance. The planning supervisor, stage, author and validator definitions are installed under [D-018](../../mission-control/decisions.md#d-018--rebuild-roadmap-creator-around-the-planning-hierarchy). MC-T05/06 still require independent behavioral exercise. The [shared planning contract](../../mission-control/.agents/skills/mc-roadmap-creator/references/planning-contract.md) defines stage returns, materiality, recovery, candidate identity and approval. Final validation uses a reviewer fresh relative to both author and stage reviewers. Candidate changes require affected revalidation and renewed explicit owner approval before implementation.

### Roadmap Implementation Supervisor and Candidate Author

The [Candidate Author](../../mission-control/.agents/skills/mc-roadmap-author/SKILL.md), assigned by the planning stage orchestrator, turns clarified, authorized scope from an enriched draft or a sufficient conversation/document packet into an executable roadmap/SPEC bundle. It maps requirements, tickets, standards, dependencies, migrations, failure branches, validation and handoff. It records unresolved intent rather than filling it by assumption.

The Roadmap Supervisor owns execution of one approved roadmap, supervises SPEC Orchestrators and presents required per-SPEC owner acceptance checkpoints. The owner has confirmed that checkpoint remains. After the owner accepts a SPEC, Mission Control can clear the coordination hold and authorize the Supervisor to proceed to its next SPEC. Required owner acceptance is not inferred from automated reviewer status.

Roadmap planning and implementation orchestrators use the User Profile at different depths. The Candidate Author and Release Validation turn its preferences into concrete design and review questions for the specific roadmap. The Roadmap Supervisor and SPEC Orchestrator check deviations against the accepted contract and the profile, then report only material effects upward. Mission Control owns the cross-roadmap attention decision; it does not repeat their source-level review.

### Independent Release Validation

Release Validation uses the installed [mc-planning-validator](../../mission-control/.codex/agents/mc-planning-validator.toml) in release mode, independently of the Candidate Author and stage reviewers. It reports unchanged to the designated Mission Control/owner-facing recipient; while MC is inactive, use the owner-designated manager. It receives the candidate, original requirements, owner decisions, standards and raw source evidence without a desired verdict. The validator is a leaf reviewer. Its assigning manager may commission supporting independent lens reviews when warranted; the final reviewer remains accountable for whole-candidate coverage across:

1. Intent, coverage and ticket disposition.
2. Architecture, standards, compatibility and lifecycle.
3. Blast radius, cross-roadmap dependencies, concurrent work and integration order.
4. Verification, evidence and next-agent handoff.

Release Validation records its own findings and readiness result; the Candidate Author owns repairs through the stage orchestrator. A First Draft's discussion readiness belongs to stage validation; it need not pass this final candidate gate. A release candidate may be ready for owner approval, require revision or require an owner decision. Release Validation cannot grant product approval, implementation authority or owner acceptance.

### SPEC execution roles

The SPEC Orchestrator owns one accepted SPEC's slice order, integrated result, deviations and reports. It assigns a Slice Builder for each slice and enforces the existing builder/orchestrator review gates. The Slice Builder implements one slice, runs its required checks, records bounded deviations and returns its review packet. Existing reviewer roles remain read-only and scoped by the established SPEC review policy.

### Branch / Merge Supervisor

Mission Control chooses whether to dispatch integration now or wait for additional accepted SPECs that complete a feature or satisfy a dependency. The Branch/Merge Supervisor reads applicable instructions and historical records, prepares the selected candidate, delegates bounded investigation, resolves or routes findings, evaluates the combined change and produces a PR/merge report. It records source/target revisions, included SPECs, changes, issues, evidence, deviations, dependency effects and a resumable checkpoint.

If integration finds missing product behavior, it records a prerequisite and may checkpoint/end while a Requirements Investigator and then an authorized Roadmap Creator define and plan that work. Integration resumes when the required result is accepted and available. The Requirements Investigator reports evidence and questions; it does not set intent or authorize implementation.

The Merge Supervisor's final report says whether its review passed, what it verified and whether the candidate is PR-ready or landed. A clean review does not itself publish or merge.

## Fail-forward and SPEC progression

Use the existing SPEC review process to repair material findings on current bytes, record deviations and downstream effects, and preserve valid evidence. A correctable issue is assigned an owner and remedy; it does not automatically halt unrelated or later work. Mission Control may let the Roadmap Supervisor continue **after that SPEC's required owner acceptance checkpoint**, while surfacing deviations and their planned correction to the user.

Hold the affected progression when a blocker cannot safely be corrected later, when added work would impair or compound an unresolved edge case, when it would invalidate a downstream SPEC or its evidence, when it risks irreversible loss/security/incorrect authority, or when it depends on an unresolved product-intent decision. Record why it is not safely deferrable, which work is held, and the specific resolution required. Continue every independent workstream. Do not conceal deviations, relabel incomplete evidence as passing, waive required owner acceptance, or call a waiting task a failure.

At a milestone, Mission Control may coordinate owner-defined walkthrough/test agents and standards comparisons. Criteria must be supplied or approved by the owner; milestone exercises do not invent product requirements.

## File-set triage and Git awareness

Mission Control may inspect a named packet, registry/bulletin entries, roadmap summaries, supervisor reports, worktree status, branch names, commit ancestry and PR metadata to decide what needs attention. Its branch map should track branch/worktree identity, base and current revision, ahead/behind state, dirty status, owner/session, claimed SPECs/PRs, changed-area summaries from the responsible report, dependencies and last checked time.

This is scheduling awareness. Mission Control does not inspect diffs to decide code quality or repair files. When metadata or reports leave a material uncertainty, it assigns the Branch/Merge Supervisor or a specialist and records the question.

## Remote Git publishing ritual

Mission Control may tell the owner:

> “Merge review passed. Here is the report and branch state. Say the word and I will push this to GitHub.”

An unattended assistant must never autonomously choose or run `git push` or `git pull`, or publish/sync through GitHub/GitLab. The attended session first gives the concrete source/target and report. Only the owner's explicit go-ahead triggers the agreed scripted operation. An evaluation pass, PR-ready status or hourly check is not authorization to publish. If the owner is absent, checkpoint and wait. Local commit/merge permissions must be stated in that job's authority packet; they are not inferred from this remote-publishing rule.

## Durable reports and continuing work

Every long-running manager keeps a compact report/checkpoint with assignment ID, authority, current state, active children, source revisions, finished work, evidence, deviations/issues, blockers or owner questions, last progress and next safe action. Each step returns one synthesis with links to its child reports. Mission Control keeps the portfolio summary and routes only material changes or decisions to the owner.

No unattended process relies on conversation memory alone. On wake/restart, inspect task and writer state before resuming; do not replay a completed mutation because its acknowledgement was lost. Wait states can persist without keeping an agent session alive.

## User Wiki as the owner-guidance source

The User Profile article linked above now supplies the standing preferences previously contemplated for a `USER.md`. Assignment packets should link it instead of copying it into every prompt or creating a second preference file. Role-specific instructions still define work authority, while current owner direction takes precedence for the current job. A later decision to create `USER.md` would need a clear distinct purpose and update owner so preferences do not drift between copies.

## Explicitly still open

- Which events trigger immediate owner notification versus waiting for the next hourly report.
- Exact recovery/replacement-task creation authority for unattended supervisors.
- Local commit/merge authority; remote push/pull always remains attended.
- How many review responsibilities can share a reviewer without weakening coverage.
- The profile-specific schemas, real roadmaps, milestone acceptance standards and future HTML artifact implementation.

## Agent profile and skill file index

This is a file-path inventory for the current Mission Control prototype, not a claim that every role above has been installed or exercised. The global profiles below are an earlier inventory; use the local deployment record for current MC definitions. The Fusion background workers use a separate in-app agent registry and are not substitutes for Mission Control's planned roles. Refresh this index when an owner-managed profile task creates or moves a file.

### Existing agent profiles

| Profile | File | Relation to this tree |
|---|---|---|
| SPEC Orchestrator | [/Users/rccurtrightjr./.codex/agents/spec-orchestrator.toml](/Users/rccurtrightjr./.codex/agents/spec-orchestrator.toml) | Existing approved-SPEC execution role. |
| SPEC Slice Builder | [/Users/rccurtrightjr./.codex/agents/spec-slice-builder.toml](/Users/rccurtrightjr./.codex/agents/spec-slice-builder.toml) | Existing slice execution role. |
| Clean-room reviewer | [/Users/rccurtrightjr./.codex/agents/clean-room-reviewer.toml](/Users/rccurtrightjr./.codex/agents/clean-room-reviewer.toml) | Existing independent read-only reviewer; its exact use depends on the review workflow. |
| Fusion code manager | [../../Agents/Background Workers/code-manager/settings/PROMPT.md](../../Agents/Background%20Workers/code-manager/settings/PROMPT.md) | Existing Fusion background worker; separate runtime. |
| Fusion wiki manager | [../../Agents/Background Workers/wiki-manager/settings/PROMPT.md](../../Agents/Background%20Workers/wiki-manager/settings/PROMPT.md) | Existing Fusion background worker; separate runtime. |
| Fusion ops manager | [../../Agents/Background Workers/ops-manager/settings/PROMPT.md](../../Agents/Background%20Workers/ops-manager/settings/PROMPT.md) | Existing Fusion background worker; separate runtime. |

The Fusion agents are mapped in [../../Agents/registry.json](../../Agents/registry.json). Mission Control, Domain Steward, Requirements Investigator and Branch/Merge Supervisor do **not** yet have local profile files. Their creation and exercise remain the named tasks in the [live TODO](../../mission-control/todo.md); a conceptual place in the tree does not imply an installed agent.

### Current local planning definitions

| Definition | File | Responsibility |
|---|---|---|
| Inline Preflight | [mc-preflight](../../mission-control/.agents/skills/mc-preflight/SKILL.md) | Input readiness within the workfolder session; no new agent profile. |
| Launchpad | [mc-launchpad](../../mission-control/launchpad/.agents/skills/mc-launchpad/SKILL.md) | Workfolder conversation, source memory and handoff. |
| First Draft Supervisor | [mc-draft-supervisor](../../mission-control/.agents/skills/mc-draft-supervisor/SKILL.md) | Draft-only stage management, independent validation and discussion handoff; [profile](../../mission-control/.codex/agents/mc-draft-supervisor.toml). |
| First Draft | [mc-first-draft](../../mission-control/.agents/skills/mc-first-draft/SKILL.md) | Provisional skeleton and explicit gaps; [local profile](../../mission-control/.codex/agents/mc-first-draft.toml). |
| Roadmap Creation Supervisor | [mc-roadmap-creator](../../mission-control/.agents/skills/mc-roadmap-creator/SKILL.md) | Planning continuity, stage acceptance and owner approval; [profile](../../mission-control/.codex/agents/mc-roadmap-creation-supervisor.toml). |
| Planning Stage Orchestrator | [mc-planning-stage](../../mission-control/.agents/skills/mc-planning-stage/SKILL.md) | One draft or candidate stage, specialists, author and validation; [profile](../../mission-control/.codex/agents/mc-planning-stage-orchestrator.toml). |
| Candidate Author | [mc-roadmap-author](../../mission-control/.agents/skills/mc-roadmap-author/SKILL.md) | Executable candidate and traceability; [profile](../../mission-control/.codex/agents/mc-roadmap-author.toml). |
| Independent Planning Validator | [mc-planning-validation](../../mission-control/.agents/skills/mc-planning-validation/SKILL.md) | Draft, candidate-stage or independent release mode; [profile](../../mission-control/.codex/agents/mc-planning-validator.toml). |
| Document Sweep | [mc-document-sweep](../../mission-control/.agents/skills/mc-document-sweep/SKILL.md) | Documentation propagation and source sufficiency. |

D-018 installed the creation supervisor, stage orchestrator, candidate author and independent validator. Structural verification does not establish live dispatch or behavioral correctness. See [deployment.md](../../mission-control/deployment.md) for all current local implementation roles and runtime limits.

### Earlier global Codex workflow skills

| Workflow | Skill file | Current use |
|---|---|---|
| Launchpad | [/Users/rccurtrightjr./.codex/skills/launchpad/SKILL.md](/Users/rccurtrightjr./.codex/skills/launchpad/SKILL.md) | Pre-roadmap working memory. |
| Capture | [/Users/rccurtrightjr./.codex/skills/capture/SKILL.md](/Users/rccurtrightjr./.codex/skills/capture/SKILL.md) | Explicit working-memory checkpoint. |
| Checkpoint | [/Users/rccurtrightjr./.codex/skills/checkpoint/SKILL.md](/Users/rccurtrightjr./.codex/skills/checkpoint/SKILL.md) | Explicit cross-task durable checkpoint. |
| Roadmap Creator | [/Users/rccurtrightjr./.codex/skills/roadmap-creator/SKILL.md](/Users/rccurtrightjr./.codex/skills/roadmap-creator/SKILL.md) | Roadmap and SPEC authoring. |
| Delegater | [/Users/rccurtrightjr./.codex/skills/delegater/SKILL.md](/Users/rccurtrightjr./.codex/skills/delegater/SKILL.md) | Legacy explicit alias for Roadmap Creator. |
| Roadmap Implementation Supervisor | [/Users/rccurtrightjr./.codex/skills/roadmap-implementation-supervisor/SKILL.md](/Users/rccurtrightjr./.codex/skills/roadmap-implementation-supervisor/SKILL.md) | Approved-roadmap execution and per-SPEC acceptance. |
| SPEC Orchestrator | [/Users/rccurtrightjr./.codex/skills/orchestrator/SKILL.md](/Users/rccurtrightjr./.codex/skills/orchestrator/SKILL.md) | Approved-SPEC execution. |
| SPEC Review Gate | [/Users/rccurtrightjr./.codex/skills/spec-review-gate/SKILL.md](/Users/rccurtrightjr./.codex/skills/spec-review-gate/SKILL.md) | Independent fail-forward review inside SPEC execution. |
| Clean Room Loop | [/Users/rccurtrightjr./.codex/skills/clean-room-loop/SKILL.md](/Users/rccurtrightjr./.codex/skills/clean-room-loop/SKILL.md) | Explicit ordinary-work review, separate from the SPEC gate. |
| Fusion Electron Restart | [/Users/rccurtrightjr./.codex/skills/fusion-electron-restart/SKILL.md](/Users/rccurtrightjr./.codex/skills/fusion-electron-restart/SKILL.md) | Development-app restart workflow when requested. |

### Bundled Codex skills in the local skill directory

These complete the on-disk `/Users/rccurtrightjr./.codex/skills/` inventory. They are utility skills, not Mission Control roles.

| Skill | File |
|---|---|
| Image generation | [/Users/rccurtrightjr./.codex/skills/.system/imagegen/SKILL.md](/Users/rccurtrightjr./.codex/skills/.system/imagegen/SKILL.md) |
| OpenAI documentation | [/Users/rccurtrightjr./.codex/skills/.system/openai-docs/SKILL.md](/Users/rccurtrightjr./.codex/skills/.system/openai-docs/SKILL.md) |
| Plugin creator | [/Users/rccurtrightjr./.codex/skills/.system/plugin-creator/SKILL.md](/Users/rccurtrightjr./.codex/skills/.system/plugin-creator/SKILL.md) |
| Read-only review agent | Historical entry: `/Users/rccurtrightjr./.codex/skills/.system/review-agent/SKILL.md`; absent at D-018 verification. |
| Skill creator | [/Users/rccurtrightjr./.codex/skills/.system/skill-creator/SKILL.md](/Users/rccurtrightjr./.codex/skills/.system/skill-creator/SKILL.md) |
| Skill installer | [/Users/rccurtrightjr./.codex/skills/.system/skill-installer/SKILL.md](/Users/rccurtrightjr./.codex/skills/.system/skill-installer/SKILL.md) |

Plugin-cached skills live outside this local profile/skill inventory and may change with plugin installation. Their presence does not grant a Mission Control role or standing authority.
