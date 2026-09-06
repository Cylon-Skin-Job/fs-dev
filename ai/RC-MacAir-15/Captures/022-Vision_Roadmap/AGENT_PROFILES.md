# Agent Profiles Model

> Broad analysis of harness-backed capabilities, ticket profile selection, reusable workflow composition, and durable state alternatives. Owner decisions remain authoritative in DECISIONS.md; this document does not define harness APIs or implementation.

## Product Role

The **Agent Profiles** view is a capability library and composition surface. It hooks into roles, personas, Skills, workflows, and subagent behavior already available through the configured harness instead of inventing a second execution universe inside Fusion Studio.

The inspectable source form is folder-based. A profile can begin as a folder named for the agent with one primary instruction document plus optional `Skills` and `Sub-agents` folders. The exact primary filename—such as `AGENTS.md` or `Prompt.md`—remains open. This keeps the profile portable and legible outside the GUI.

The view can project that folder as a simple hierarchy: the profile appears at the top, Skills and subagents branch beneath it with indentation and connector lines, and each item can open into a readable or editable detail surface. **New Agent** is the view-specific presentation of the shared New action.

RC referenced OpenCode as the available harness foundation and OpenClaw as supporting role discovery and invocation. Current OpenCode `1.18.24` verification resolves a useful part of that boundary: OpenCode natively discovers configured primary agents, subagents, Skills, and commands. Fusion can surface and select those harness-owned capabilities instead of copying their full definitions into every view prompt. The remaining OpenClaw relationship and Fusion-owned configuration boundary still need separate verification.

## Harness-Backed Roles

A user can find a role and invoke it as the persona present at the beginning of a chat, or treat the same role as a subagent used by another workflow. Fusion provides discoverability, organization, ticket binding, and product context around the underlying harness capability.

The view should not imply that every role is a separately running process. A role is available to be invoked when a thread or workflow needs that set of abilities.

This same boundary applies when a project opens a side agent as a header tab. The tab makes delegated work visible and conversationally accessible, while the selected profile remains an invoked capability associated with the project's thread family rather than a newly managed entity.

OpenCode keeps the active identity and the available catalog separate. The selected primary agent contributes its own system prompt, model preference, and permissions. Other permitted subagents are advertised to the active model by ID and description through its delegation tool rather than concatenating every subagent prompt into the active system context. The user can also invoke a visible subagent directly by name. Skills follow the same progressive-disclosure pattern: OpenCode advertises their names and descriptions and loads a Skill's full instructions only when selected. This makes concise descriptions part of the capability-routing contract.

## Ticket Profile Selection

Ticket metadata/frontmatter can name the agent profile or workflow to invoke. This lets scheduling, triggers, and manual assignment use the same ticket template while selecting the intended execution capability declaratively.

A properly constructed ticket template may need little beyond:

- basic orientation;
- awareness of the relevant tools;
- the work object and desired outcome; and
- a profile or workflow reference when the view heuristic does not supply one.

Reusable behavior belongs in the profile, Skills, or workflow rather than being copied into every ticket.

## Invocation Paths

An Agent Profile can be invoked through several product paths:

- **Composer selection:** the user opens the plus menu and chooses a profile for the thread.
- **Ticket selection:** ticket metadata/frontmatter identifies the profile or workflow to use.
- **Workspace default:** the workspace automatically loads its configured default profile.
- **Agent-to-agent invocation:** an active agent invokes another profile as a bounded subagent.
- **Workflow delegation:** a reusable workflow invokes one or more profiles for bounded roles or stages.

These paths all apply a capability mask to a thread or subtask; none creates a persistent agent entity. Precedence among explicit selection, ticket metadata, view heuristics, and workspace defaults remains open.

OpenCode already exposes list operations for agents and commands and accepts an agent identifier when a message or command is run. Its command files provide reusable named prompt workflows, can choose an agent or model, and can run as a delegated subtask in the current stable interface. Fusion can therefore treat OpenCode's registry as a discoverable harness catalog. Because OpenCode's next-generation documentation currently differs on some command-subtask semantics, Fusion should capability-check the installed harness version rather than make durable product behavior depend on one undocumented assumption.

## Workspace Default Profile

A workspace can define a default Agent Profile that loads automatically. This gives every thread in that workspace a useful baseline orientation and tool awareness without requiring the user to select the same profile repeatedly.

The workspace default is a starting capability context, not a permanent identity. The user may explicitly invoke another profile, and a ticket may request a more specific profile. The replacement, layering, and precedence behavior remain to be shaped.

## Lightweight Profiles

A simple task can invoke a narrow profile. RC's bug-fix example includes:

- a bug-fix persona;
- a small set of relevant Skills;
- a few subagents for blast-radius and knock-on-effect checks;
- a small plan;
- plan validation;
- execution and repair; and
- a final report.

The workflow can remain compact while still preserving checks proportionate to the task.

## Orchestrated Workflows

More complex work can invoke an elaborate reusable workflow. RC's Wiki example resembles Launchpad and Second Brain in that it may contain:

- gating and review points;
- distinct subagent tasks;
- role-specific workers;
- validation agents invoked in sequence;
- persistent progress state;
- incremental nightly work; and
- a scheduled ticket that invokes the workflow without reproducing its internal logic.

The ticket is the activation object and visible work record. The reusable workflow owns the branching process.

## Workflow State

Long-lived or recurring workflows need durable progress that does not depend on the invoked persona pretending to persist between runs.

Two candidate approaches are currently open:

1. A state folder with a JSON checkpoint updated by individual processes.
2. A tool call that queries the event bus and event ledger for relevant activity since that workflow's previous invocation.

These approaches may be alternatives or complements. The correct balance depends on whether a workflow needs explicit checkpoints, reconstructable event history, or both.

## Wiki Maintenance Example

A scheduled Wiki workflow could process one bounded chunk each night. It could track which chunk was last completed, discover relevant changes since its prior run, assign focused subagents, validate the results, update its durable state, and wait for the next scheduled ticket.

This is a product example, not an approved canonical-Wiki automation or implementation scope.

The broader capability could be packaged as a **Wiki Maintainer** plugin that installs its ticket templates, schedules, Agent Profiles, triggers, state resources, and configurable UEB hooks as one inspectable bundle.

## Bug-Fix Example

A simple bug ticket could name a bug-fix profile. The thread wears that capability mask, builds and validates a small plan, executes the repair, uses focused subagents to check blast radius and knock-on effects, and generates a report.

The example demonstrates that the same invocation model can support both small bounded work and elaborate orchestrated processes.

## Scheduling and Trigger Boundary

Agent profiles do not own schedules or triggers. Scheduled and Triggers create or assign tickets. A ticket invokes the profile or workflow when it reaches the assignment boundary.

This keeps timing and event policy in the ticket automation system, reusable capability in the Agent Profiles surface, and observable execution in the ticket thread.

Routines provide a second visible invocation context. Their fronting assistant can explain and edit the routine, while a reasoning node can invoke an Agent Profile when the graph reaches work requiring that capability. The routine remains the inspectable automation identity; the profile supplies a temporary mask.

## Open Questions

- What remains of the OpenClaw and Fusion-owned layer after mapping OpenCode agents, commands, and Skills into Agent Profiles?
- Is the profile's primary instruction file standardized as `AGENTS.md`, `Prompt.md`, or selected through its manifest/configuration?
- Which folder entries are first-class profile resources, and how does the GUI represent user-added resource types?
- Which ticket metadata field selects a profile, and how is compatibility validated?
- What precedence applies among ticket metadata, view heuristics, workflow defaults, and explicit user selection?
- Does an explicitly selected profile replace or layer on top of the workspace default?
- How are profile versions frozen or upgraded for recurring scheduled tickets?
- Can a thread change masks during execution, and how is that visible in its history?
- What authority and context does a calling agent pass to an invoked Agent Profile?
- How is a side-agent project tab related to its caller, thread family, invoked profile, and resulting artifacts?
- When should workflow state be explicit JSON, reconstructed from the event ledger, or both?
- How are workflow checkpoints, subagent results, validation evidence, and reports reflected in the inbox artifact?
- How does Access permissions constrain the tools and subagents available to an invoked profile?
