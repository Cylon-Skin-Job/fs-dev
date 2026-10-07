# Mission Control — Master Vision for Fusion Studio

> Owner-directed vision capture. The purpose is established; the product design below is a working synthesis, not an approved roadmap or a claim of implemented behavior.

**Created:** 2026-09-26 (PDT)
**Home:** this fork, [Mission Control](codex://threads/01a0ddfd-81fe-7e03-8786-e514d762a797)
**Related working system:** [Capture 037](../037-Plugin_Integration_And_Parallel_Roadmaps/mission-control.md)

## Purpose and owner direction

The owner established this fork as the home for a **Mission Control master vision Capture: how fs-dev will absorb the concepts developed in the Mission Control discussion and setup work.**

This Capture translates those concepts into product questions, desired behavior and boundaries for Fusion Studio. Capture 037 retains the existing Codex-based setup tasks, role guidance and coordination records. Progress on those tasks supplies experience and evidence for this vision; it does not by itself establish that Fusion Studio implements the same capabilities.

This fork develops the vision with the owner. It does not take over the original setup task or its assignments. No product roadmap, SPEC, code change or deployment is authorized by creating this Capture.

## Current refinement — October 2

The owner narrows the product concept into **Inbox Manager**, **Branch Manager** and **System Manager**. Inbox Manager contains alerts flagged for user attention and carries forward CURRENT/UPCOMING, database persistence and direct chat actions. Branch Manager visually represents roadmap/SPEC work, separate worktrees, branching, integration, commits and GitHub publication. System Manager manages Wiki and context and ensures interoperability.

The proposed Branch Manager view is a graph of lines and named circles, potentially driven by JSON the agent fills in to show the big picture and how work from separate folders is staged, branched and merged. The graph links back to auditable Work Folders. JSON representation is a proposal; its storage and schema are undecided. See [the manager refinement and owner sketch](launchpad-and-work-folders.md#focused-managers--october-2-refinement).

This supersedes treating Mission Control's attention list as the entire management experience. Earlier Mission Control references below preserve the coordination concept; the umbrella name, placement of the three managers and their relationship to the existing execution hierarchy remain to be shaped.

## Working product thesis

**Current owner direction:** Fusion Home, Code Workspace, Research Library and Media Studio (earlier called Media Editor) are the main workspace templates, all with Launchpad at the top. A named **Work Folder within a workspace/project** becomes the bounded home for intake, checkpoints, references, drafts, roadmaps and reports. Capture and Notes are unnecessary as separate destinations; use Work Folders. Tickets also goes away as a separate destination: **Ticket = Work Folder.** In Code Workspace, Mission Control is Launchpad's top thread, followed by New Work Folder; creating one names the folder, creates a thread and opens the existing Capture viewer interface scoped to that folder. Read [Launchpad and Work Folders](launchpad-and-work-folders.md) for the recorded flow.

The basic Code Workspace retains **File Explorer (Code Editor), Wiki, Browser, Agents and Plug-Ins**, alongside Launchpad. Fusion Home can have its own apps, and Research Library can have the JSON Library view. Further evolution of Launchpad in Media Studio is deferred.

Mission Control would give the owner a durable place to understand and direct complex work across multiple agents and roadmaps: what is intended, what is being done, what is waiting, what evidence exists and which decision or action comes next.

The attention view, now assigned to **Inbox Manager**, is an **attention list**: frozen builds needing input, approvals before a next review/audit or other step, proposed merges, and housekeeping such as Wiki updates. The owner proposes **CURRENT** and **UPCOMING**, with “Update wiki — Pending Merge Acceptance” as an example. The working interpretation is actionable attention versus follow-up waiting on a prerequisite; these are attention states rather than build execution states.

Fusion Home extends this to everyday planning and collection: vacations, goals, studying and workouts. A person can gather external research in a Work Folder, create rows for assorted information and make artifacts. The existing Capture viewer supplies the interface baseline: folder headings and document-tile rows, scoped here to one Work Folder. Loose collection is a useful activity in its own right. The Work Folder model must accommodate this alongside formal delivery work.

Mission Control exercises judgment over the attention list and user notifications: what to surface, its priority, CURRENT/UPCOMING placement and when to notify, guided by user instructions and work context. Optional scripts may support these operations. This flexibility concerns attention management; existing approval requirements for the work remain in force.

The attention/notification layer lives in the **app database**. Items provide a synopsis and direct links into the associated chat, where the user can give approval or respond to the agent and hit Send. This establishes persistence and the interaction direction for this part of Mission Control; Work Folder documents continue to hold the material described above.

**The Work Folder is one auditable object:** its thread family and files belong to the same body of work, with associated attention items, approvals and responses connected to it. The intended experience is to follow the work from request through conversation, evidence, decision and outcome across its app-database records and files.

Continuity survives a chat ending, a context limit or an agent replacement. Detailed work stays with its accountable role; Mission Control retains enough understanding to route work and explain consequences across domains. The owner can inspect underlying records rather than relying on a summary alone.

The existing three-roadmap concept is the initial scenario. It does not yet establish a permanent product limit or require choosing three product roadmaps during this vision work.

## Concepts to carry into Fusion Studio

| Capability | Intended experience to explore | Direction/source status |
|---|---|---|
| Durable work memory | Resume a body of work with its decisions, open intent, sources, assignments and next action intact. | Established continuity goal; storage and product mechanics open. |
| Domain-scoped assistance | Assign a bounded subject to an accountable agent with a known memory home; get findings and implications back. | Proposed domain model in 037; detailed role/profile mechanics open. |
| Shaping and planning | Develop ideas in Launchpad Work Folders, keep working-memory documents in Intake, produce a First Draft, surface unresolved intent and refine a release candidate where appropriate. | Owner-directed Work Folder model; detailed planning stages remain proposed. |
| Independent Preflight | Assess intent, standards, blast radius/dependencies and verification separately from the creator. | Proposed role; draft readiness differs from release readiness. |
| Hierarchical execution | MC assigns the responsible manager; supervisors, orchestrators and builders manage their own branches. | Owner-confirmed hierarchy; existing per-SPEC acceptance retained. |
| Shared coordination | Inspect current assignments, dependencies, holds and material handoffs through a registry and bulletin. | Setup records exist in 037; Fusion runtime behavior not established. |
| Integration jobs | Select an appropriate unit of accepted work, prepare/evaluate its integration, produce a PR or authorized merge and notify consumers. | Owner-directed concept; precise Git/service/authority mechanics open. |
| Navigable work view | Open one Work Folder with its subfolder headings; inspect roadmap/SPEC/slice/checklist detail where the work calls for it, following evidence and dependencies. | Scoped Work Folder view is owner direction; detailed roadmap presentation and packaging remain open. |
| Monitoring and recovery | Periodically check work, update visible state and recover eligible interrupted assignments from checkpoints. | Desired hourly workflow; runtime, permissions and recovery contract open. |

These are capability groups, not an implementation sequence or a required number of plugins, services or agent types.

## Responsibilities and authority

The previously confirmed execution hierarchy is preserved below. The October 2 product-manager refinement still needs to be mapped onto it; no change to the per-SPEC owner-acceptance requirement has been requested:

```text
Owner
└── Mission Control
    ├── Roadmap Supervisor
    │   └── SPEC Orchestrator
    │       └── Slice Builder
    └── Branch Manager
        └── Scoped subagents
```

Domain assistance, creation, requirements investigation and independent Preflight support this structure; their exact placement remains to be shaped. Managers direct their own subordinates. MC need not absorb source-level investigation to understand a job's scope and coordination implications.

Owner decisions, agent proposals, verified observations and completion reports remain distinguishable. A completed drafting assignment can still leave an unfinished roadmap. Planned ticket coverage does not establish delivery. A PR is not a landed change; a landed capability is not yet adopted by every consuming branch. An intentionally waiting job is not a crashed agent.

Unspecified intent must be raised by the primary creator and independently checked in review. Resolve necessary owner choices or explicitly narrow/defer affected scope before claiming implementation readiness. Preserve per-SPEC owner acceptance unless the owner changes that exact contract.

## How Fusion could absorb the workflow

The working hypothesis is to express these capabilities through Fusion's existing workspace, view, chat and controlled-service model. The user should be able to inspect and act on the same durable work through the appropriate surface, with one accountable owner for each fact or operation.

For example, a work view could display a SPEC's status and evidence, open its owning chat, expose a dependency hold and show the owner's acceptance action. Its display would not itself become authority to launch an agent or mutate Git. Those operations need defined platform/service contracts and explicit authorization.

Use the current [Platform And Plugins overview](../../Wiki/011-Platform_And_Plugins/000-Platform_And_Plugins/PAGE.md) when shaping that fit. It separates shell, platform services, components, plugin contributions, configured instances and custom regions. This Capture does not choose whether Mission Control becomes a built-in view, plugin, workspace type, composition of several pieces or some combination.

Fusion delegates AI execution to configured harnesses; the vision should describe required operations and outcomes before choosing a harness-specific adapter. Codex task IDs, local profile files and the existing checkpoint helper are useful prototype details, not automatically Fusion's future public contracts.

## Questions to shape with the owner

1. **Scope:** Launchpad is the entry point, with Mission Control as its top thread in the Code Workspace example. Does one Mission Control oversee one workspace or a wider portfolio, and how do other workspace templates present it?
2. **Work Folder experience:** with the existing Capture viewer as the interface baseline, how do conversation and agent activity connect to it? Which template differences matter first?
3. **Memory and identity:** attention/notification records live in the app database. How do the remaining records and work, role, assignment, chat session and checkpoint identities relate to those records and Work Folder documents?
4. **Assignment and supervision:** what can MC do under standing instructions, what belongs to managers, and which actions require an owner checkpoint?
5. **Agent portability:** how are reusable role behavior, job-specific instructions, runtime capabilities and available tools kept distinct?
6. **Evaluation and evidence:** how are draft review, release readiness, implementation review, owner acceptance and integration represented to the user?
7. **Recovery and delivery:** how do readable checkpoints support re-entry and account for work since the last checkpoint? What proves an interrupted job can safely resume, a dependency is satisfied, or a notification has been received?
8. **Deployment scope:** how does this relate to the separate Fusion Server/remote-work direction, without making those future capabilities implicit prerequisites?

These are an initial discussion queue, not demands that every choice be answered now. Deeper investigations should be bounded and delegated when they are needed to resolve a product decision.

## Current checkpoint

The latest direction names Inbox Manager, Branch Manager and System Manager, and proposes a JSON-backed visual work graph for Branch Manager. The earlier workspace templates and Work Folder flow remain the foundation. [Launchpad and Work Folders](launchpad-and-work-folders.md) is the current detailed product concept. No product feasibility audit or runtime verification has been performed. Continue shaping that experience via [handoff.md](handoff.md); use [sources.md](sources.md) for selective reading.
