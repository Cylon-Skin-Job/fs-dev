# Heartbeats and Monitoring Model

> Broad analysis of persistent monitoring, conditional composer controls, opt-in event filtering, and wake/action/sleep behavior. Owner decisions remain authoritative in DECISIONS.md; this document does not define scheduling infrastructure, permissions, or implementation.

## Product Role

A heartbeat gives an AI or long-running process a durable way to check selected conditions without remaining continuously active. It connects a thread's conversational context, its inbox activity, and an explicit monitoring assignment.

Heartbeat capability may be delivered as an optional plugin. Installation enables a sensible starting set of UEB subscriptions and actions while exposing those hooks for user review and customization.

The heartbeat is not intended to consume every system event indiscriminately. It observes a bounded, opt-in stream and filters for conditions relevant to the particular thread, inbox item, process, or project assignment.

## Composer Presence

Heartbeat state is visible in the user input area:

- The plus button is the entry point for initial heartbeat setup.
- When no heartbeat exists, no heartbeat icon is shown.
- Once a heartbeat is configured, a `pulse_alert` icon appears between the plus button and Access permissions.
- Tapping the visible pulse icon opens direct access to the configured heartbeat.

This makes persistent monitoring discoverable when it matters without permanently occupying composer space for threads that have no heartbeat.

## Creation and Direct Access

A user can configure a heartbeat manually through the plus button. A user can also tell an AI to monitor something, allowing the AI to create the heartbeat needed for that assignment.

Once created, the pulse icon becomes the direct management surface. The exact controls are not yet defined, but they may need to expose the monitored target, conditions, variables, timing, recent wake history, current state, and allowed actions.

AI-created heartbeats require a future consent and transparency policy. This vision establishes the capability without deciding whether creation is silent, confirmed inline, limited by Access permissions, or governed by another policy surface.

## Monitoring Scope and Variables

A heartbeat can watch specific variables rather than relying only on a broad textual instruction. Examples of monitored state might include process status, timestamps, counts, error conditions, data freshness, completion markers, or another value exposed by the associated system.

The representation of those variables remains open. They may be selected from known fields, defined through a natural-language condition, expressed through a structured filter, or combined. The user should be able to understand what is being monitored even if an AI helped configure it.

The assistant may help establish a monitored variable while shaping a routine, and an installed plugin may supply a known variable, default, or reusable condition as part of its package. Neither source grants execution authority by itself; the resulting trigger and actions remain visible and permission-controlled.

## Opt-In Inbox Filtering

The universal inbox is envisioned as an opt-in notification fabric. A heartbeat can monitor the notification activity associated with its thread or inbox item and filter for any relevant kind of change.

This creates a bounded chain:

1. System events produce opt-in notifications or updates.
2. The thread or inbox item receives the changes relevant to its work.
3. The heartbeat filters those changes against its monitored variables or conditions.
4. Only a match wakes the heartbeat's behavior.

The precise subscription boundary—item, thread, view, workspace, or project—is not yet settled.

## Wake, Action, and Sleep Cycle

When a monitored condition matches, the heartbeat can wake and perform behavior authorized for that assignment. RC's examples include:

- restarting a process;
- adding its own behavior or update to the open inbox item; and
- returning to sleep after the response is complete.

This is a small event-driven autonomy loop rather than a permanently running agent. The permissions, retry limits, escalation conditions, failure handling, and audit trail remain open and must eventually distinguish observation from consequential action.

Once Provenance supplies the event and permission foundation, the same cycle can begin from any installed, registered, configured, and authorized routine trigger. Schedules, file changes, derived folder conditions, script results, plugin outputs, and heartbeat intervals all use the same conceptual wake boundary.

Waiting should be proportional to the operation. Work expected to finish in seconds can remain within the active turn. Longer operations can run, sleep for a meaningful interval, wake to verify and repair the result, rerun when necessary, and sleep again. Limits, escalation, and retry policy remain to be shaped.

## Long-Running Project Use

Within a project, a heartbeat could monitor work that spans days. RC's example is a web scraper expected to run for three days. The heartbeat could watch process health, output progress, errors, or staleness, then alert, recover, or annotate the associated work according to its authorization.

The thread and inbox item provide the human-facing history. The heartbeat provides intermittent observation and response between user visits.

Scheduled and triggered ticket assignment use the same visible ticket lifecycle rather than creating a separate class of background agent. A heartbeat can monitor or recover that ticket-driven work, while Scheduled and Triggers determine when new work should be instantiated or assigned.

## Open Questions

- Is a heartbeat owned by a thread, inbox item, view, workspace, project, agent, or a combination of these?
- Can one thread have multiple heartbeats, and if so, what does the single pulse icon open?
- How are monitored variables discovered, named, validated, and edited?
- How are assistant-created variables and plugin-supplied defaults distinguished and approved?
- Are checks scheduled, event-driven, or hybrid?
- How do heartbeats persist across app restarts, device changes, offline periods, or upgraded plugins?
- Which actions can be pre-authorized, which require confirmation when triggered, and which are never allowed autonomously?
- How are repeated failures, restart loops, noisy changes, and duplicate alerts prevented?
- What decides when work waits inline versus scheduling a heartbeat follow-up?
- What history shows when the heartbeat woke, what it observed, what it did, and why it returned to sleep?
- How does Access permissions constrain heartbeat creation, subscriptions, tools, and recovery actions?
- When a heartbeat restarts ticket-driven work, does it reuse the existing thread or trigger a new assignment attempt?
