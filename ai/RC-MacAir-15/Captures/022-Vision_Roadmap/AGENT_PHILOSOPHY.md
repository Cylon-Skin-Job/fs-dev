# Agent Design Philosophy

> Owner-directed philosophy for how Fusion Studio should conceptualize agent profiles. Detailed settled choices remain in DECISIONS.md; this document does not authorize implementation or imply that profiles possess independent agency or identity.

## Core Principle

An agent profile is not a persistent entity. It is a frozen, invocable container of abilities: a mask that any thread can wear when that set of capabilities is useful.

The system should resist anthropomorphizing profiles into beings that must be managed, monitored, tracked, or maintained as ongoing relationships. The user's durable relationship is with the work, its ticket, its thread, and the outcomes—not with a fabricated agent identity.

## Capability Without Entityhood

A profile can still be rich. It may define:

- a persona or role;
- domain orientation;
- available tools and Skills;
- subagents it can invoke;
- branching procedures;
- gates and validation behavior; and
- expected outputs and reports.

Complexity of capability does not imply persistence of entity. The container remains inert until invoked.

## The Thread Wears the Mask

When a ticket or conversation needs a capability set, its thread invokes the profile and wears that mask for the relevant work. The same profile may be used as the thread's starting persona or called as a subagent inside another workflow.

Invocation may come from an explicit plus-menu choice, ticket frontmatter, a workspace default, another agent, or workflow delegation. The source changes how the mask is selected, not the philosophy of what the profile is.

The thread remains the durable conversational identity. The profile supplies temporary behavior and perspective; it does not replace the thread or become a parallel user-facing identity.

## Work Owns State

Durable state belongs to the work:

- tickets hold work identity, intent, and lifecycle;
- threads hold conversation and view context;
- workflows hold process structure and checkpoints;
- project state or explicit JSON can hold incremental progress; and
- the event ledger can preserve reconstructable activity.

State should not be hidden inside the fiction of a continuously existing persona.

## Scheduling Lives Outside the Profile

Schedules, cron rules, triggers, and heartbeats determine when work is created, assigned, checked, or resumed. They do not live inside an agent profile.

A schedule or trigger produces or assigns a ticket. The ticket invokes a profile. The profile supplies capability while the thread performs visible work. This separation keeps timing, work identity, capability, and state conceptually clean.

## Reusable Second-Brain Abilities

Branching Second Brain abilities can be defined once as a reusable profile or workflow: focused subagent roles, validation roles, gates, handoffs, state, and reporting. A ticket can then invoke that container without copying the entire procedure into its own content.

This makes sophisticated capability portable while retaining the same non-entity model. The container is ready to be conjured when needed and dormant when not in use.

## User Relationship

The user does not need to maintain a roster of artificial workers as though they were employees living inside the application. The user chooses work, context, capability, permissions, and timing.

Fusion should make the active capability visible enough to understand and control, while centering tickets, threads, artifacts, progress, and outcomes in the interface.

## Design Consequences

- Do not make profile presence imply that a process is currently running.
- Do not put schedules or triggers inside profile identity.
- Do not store durable workflow truth only in persona memory.
- Do make invoked capabilities inspectable and replaceable.
- Do make the ticket and thread the stable surfaces of work.
- Do let the same capability serve as a primary thread persona or a bounded subagent.
- Do preserve explicit user instructions and permissions above the invoked mask.

## Open Philosophy Questions

- How much persona styling is useful before it begins to imply false persistence or entityhood?
- How should Fusion show which mask a thread is currently wearing without turning the profile into a character roster?
- Can a thread wear multiple masks in sequence or combination, and what level of history should be visible?
- What parts of a profile should be immutable for reproducibility, and what parts may inherit updated Skills or tools?
- How should user-created profiles communicate capability boundaries without encouraging hidden state or identity assumptions?
