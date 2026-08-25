# Agent Profiles Model

> Broad analysis of harness-backed capabilities, ticket profile selection, reusable workflow composition, and durable state alternatives. Owner decisions remain authoritative in DECISIONS.md; this document does not define harness APIs or implementation.

## Product Role

The **Agent Profiles** view is a capability library and composition surface. It hooks into roles, personas, Skills, workflows, and subagent behavior already available through the configured harness instead of inventing a second execution universe inside Fusion Studio.

RC referenced OpenCode as the available harness foundation and OpenClaw as supporting role discovery and invocation. The exact product and integration boundary between those names should be verified later; the durable vision is that Fusion surfaces existing harness capabilities coherently.

## Harness-Backed Roles

A user can find a role and invoke it as the persona present at the beginning of a chat, or treat the same role as a subagent used by another workflow. Fusion provides discoverability, organization, ticket binding, and product context around the underlying harness capability.

The view should not imply that every role is a separately running process. A role is available to be invoked when a thread or workflow needs that set of abilities.

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

## Open Questions

- What is the exact relationship among OpenCode, OpenClaw, Fusion Skills, profiles, and subagents?
- Which ticket metadata field selects a profile, and how is compatibility validated?
- What precedence applies among ticket metadata, view heuristics, workflow defaults, and explicit user selection?
- Does an explicitly selected profile replace or layer on top of the workspace default?
- How are profile versions frozen or upgraded for recurring scheduled tickets?
- Can a thread change masks during execution, and how is that visible in its history?
- What authority and context does a calling agent pass to an invoked Agent Profile?
- When should workflow state be explicit JSON, reconstructed from the event ledger, or both?
- How are workflow checkpoints, subagent results, validation evidence, and reports reflected in the inbox artifact?
- How does Access permissions constrain the tools and subagents available to an invoked profile?
