# Ticket Automation Model

> Broad analysis of scheduled, triggered, and manual ticket assignment and its relationship to view-bound threads. Owner decisions remain authoritative in DECISIONS.md; this document does not define file watchers, state machines, cron infrastructure, or implementation.

## Product Principle

Tickets are the universal work object for deferred, assigned, automated, and user-in-the-loop work. The system does not need a separate Background Agents product category when every unit of work has a visible ticket, thread, content state, activity history, and assignment lifecycle.

Agents and Skills still perform work. The distinction being removed is the separate product container called Background Agents. Execution becomes a property of assigned tickets rather than a different kind of object.

The planned **Routines** view is the user-facing place to organize the schedules and triggers that activate this work. Its framing question is not “which agent stays alive?” but “what wakes this capability and causes it to act?” A routine therefore composes a wake condition with a ticket, profile, workflow, or launch recipe rather than becoming a persistent agent entity itself.

## Scheduled Calendar and Cron

The Scheduled area already has a calendar according to RC. Its future role includes configuring cron-driven ticket creation and allowing the scheduled ticket to contain whatever content the intended workflow requires.

A schedule determines when work should be instantiated. The ticket template determines what the work is. Assignment into In Progress determines when execution begins.

## Ticket Templates

A reusable ticket template is retained as the source for recurring work. When a schedule fires, the scheduler copies or instantiates the template as a working ticket in In Progress.

The template can include the instructions, attachments, fields, or other content needed by the ticket's view-level heuristic and Skills-defined workflow. The exact template representation, versioning behavior, and relationship to later edits remain open.

Ticket frontmatter may also identify the profile or reusable workflow to invoke. A strong template can remain concise because the selected capability owns its reusable orientation, tools, subagents, gates, and validation behavior.

A plugin such as Wiki Maintainer can install a coordinated set of ticket templates, schedules, triggers, Agent Profiles, and state resources without making any one of those primitives plugin-specific.

## In Progress as Assignment Boundary

In Progress is the universal automatic-assignment boundary. Any ticket that appears there is assigned, regardless of how it arrived.

This makes state transition the shared language among manual, scheduled, and triggered work. Producers do not each need their own agent-launch mechanism; they place a valid ticket into the same assignment state.

## Manual Assignment

The user can initiate the transition in either of two ways:

- drag a ticket into In Progress; or
- choose Assign from the To Do section.

Both actions converge on the same automatic assignment behavior as a scheduler or trigger.

## Automated Dispatch

An automation observes the ticket entering In Progress and performs the equivalent of:

1. Send to New Chat on the ticket.
2. Create the view-bound, ticket-named thread with the ticket attached.
3. Send the attachment without additional instructions.
4. Allow the view heuristic and Skills-defined ticket-agent workflow to begin.

The automation reuses the same product behavior available to the user rather than inventing a separate hidden dispatch path.

## Non-Focus-Stealing Thread Creation

Automatic assignment creates the new thread in the left-side thread list without changing the user's current focus. The user can continue the present task, notice the new thread when appropriate, and open it later to restore the ticket content and observe progress.

The visual treatment for a newly created but unopened thread remains open.

## Assignment Sources

The initial sources of ticket work are:

- **Organic creation:** a ticket arises through ordinary product use or AI-assisted capture.
- **Manual assignment:** the user drags the ticket into In Progress or selects Assign.
- **Scheduled assignment:** a calendar or cron schedule instantiates a ticket template into In Progress.
- **Triggered assignment:** a system event causes a ticket to be created or moved into In Progress.

Each source converges on the same assignment boundary, thread creation, and observable workflow.

Schedules and triggers belong to the ticket-production and assignment system, not to the agent profile. The profile remains inert until a ticket or thread invokes it.

## State-Derived Ticket Creation

A trigger does not have to correspond to one event producing one ticket. It can inspect derived state across existing tickets and locations, then create a ticket when the configured condition becomes true.

RC's concrete example is a sibling count: Fusion can count tickets alongside one another in a folder and generate a new ticket when that count satisfies a rule. The broader pattern supports any number of tickets performing different work in different locations contributing to another ticket-producing condition.

The generated item may aggregate attention. For example, ten completed jobs can produce one summary notification that is delivered to the workspace inbox and simultaneously escalated to the system-wide bell. The original tickets remain available for inspection without generating ten separate interruptions.

The output remains an ordinary ticket and therefore enters the same review, assignment, thread, and activity lifecycle as manually, scheduled, or directly triggered work. Rule scope, deduplication, threshold reset, and prevention of recursive ticket-generation loops remain later design questions.

## Background Agents Reframed

Background work is no longer modeled as a discrete category of agent objects. It is ticket-driven work whose execution may happen while the user focuses elsewhere.

This preserves the benefits usually associated with background agents—parallelism, autonomy, scheduling, event triggers, monitoring, and later inspection—while giving every activity a consistent user-facing artifact and lifecycle.

## Open Questions

- Is a scheduled ticket copied directly into In Progress, or created in To Do and transitioned atomically?
- Is **Routines** the final view name, and which schedule, trigger, and launch-recipe objects appear there together?
- How are ticket identifiers allocated for recurring template instances?
- How are template updates versioned relative to already scheduled or previously instantiated tickets?
- How does the system prevent duplicate dispatch if the same In Progress addition is observed more than once?
- What happens if thread creation succeeds but sending fails, or if the ticket workflow fails before accepting assignment?
- How are retries, cancellation, pause, resumption, and manual takeover represented?
- How is an executing agent or Skill selected when a ticket does not name one explicitly?
- What visual cue announces a newly assigned thread without stealing focus?
- Which trigger events may auto-assign immediately, and which must create a queued ticket for user review?
- How do derived-state rules select ticket locations, count or combine observations, and remember which conditions have already fired?
- How are self-triggering or mutually triggering ticket loops detected and stopped?
- How is a missing, unavailable, or incompatible profile reference handled when a ticket reaches In Progress?
