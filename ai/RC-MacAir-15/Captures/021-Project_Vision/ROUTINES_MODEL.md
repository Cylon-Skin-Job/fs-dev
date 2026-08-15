# ROUTINES MODEL — Conversational, Stateful Workflows

> Working synthesis of RC's Routines concept for Robin. DECISIONS.md remains authoritative and PROPOSALS.md owns candidate mechanisms; this document does not authorize implementation, app access, health claims, scripts, schedules, or autonomous execution.

## Role and Scope

Routines is a System Manager app that turns memory into repeatable, conversational action. A routine can be as small as a companion-like sequence of reminders or as substantial as a stateful workflow that gathers context, invokes tools, coordinates background workers, writes to domain apps, and improves over time.

The system should not require a universal definition of a routine. It provides a small common kernel, then lets each routine earn the schema, heuristics, steps, integrations, and subnodes required by its actual purpose.

## Routine Nodes

A routine is an executable extension of the same memory-node model. It may have its own database-backed Launchpad container, but it can also be injected into the appropriate topic, entity, project, health, learning, or other memory nodes as an executable facet or subnode.

The standalone Routines app provides a cross-cutting catalog and runner for these capabilities. It does not detach them from the knowledge contexts they serve: a vitamin routine can attach to Health, Nutrition, and Morning nodes; a flashcard routine can attach to a Coding Learning node; and one routine can reference several nodes without merging their permissions or canonical data.

Its durable container may include:

- identity, title, aliases, and semantic invocation phrases;
- the chat or request that originated the routine;
- user intent, desired outcomes, constraints, and definition of done;
- current instructions, steps, heuristics, schemas, and versions;
- decisions, unresolved issues, candidate improvements, and rejected changes;
- apps, data scopes, tools, API operations, scripts, and background workers it may use;
- prior run state, receipts, completion history, exceptions, and corrections;
- learned preferences and context that remain within the routine's approved scope;
- internal subnodes for sessions, knowledge, future suggestions, or domain-specific state; and
- attachment records identifying the memory nodes in which the routine is available and why.

The node always retains prior state. Refinement changes the maintained container rather than replacing its history with one opaque prompt.

## Conversational Execution

Routine execution should feel like a chat companion guiding the user through the current moment.

A simple morning transition could say:

1. Clean up the bedroom before going into the kitchen.
2. Grab the trash.
3. Pick up the mail on the way back inside.
4. Confirm the first group is complete.
5. Present the vitamin list.
6. Record the user's responses in the appropriate store.

The runner should support acknowledgement, skip, defer, reorder, clarify, pause, resume, and branch behavior without making the user operate a workflow editor during the routine. It must preserve the distinction among a user saying something is done, an app verifying it, and the system inferring it.

## Semantic Invocation

Robin can recognize routine aliases or natural-language intent such as “Status” or “update my flash cards.”

A candidate invocation flow is:

1. resolve the utterance to a routine node and disambiguate collisions when confidence is insufficient;
2. inject the routine's current synthesis, schema, heuristics, state, and recent executions together with the appropriate attached or semantically relevant memory-node context;
3. determine what context is already available and what is missing;
4. create a bounded work receipt or routine-specific bulletin for the missing items;
5. dispatch compatible background workers and wait, stream partial progress, or continue within the routine's response contract;
6. reply conversationally using the returned context; and
7. reconcile new state, evidence, and suggestions into the routine node and applicable domain stores.

This product-level receipt mechanism is analogous to the Second Brain bulletin but needs its own authority, lifecycle, and user-facing behavior.

## State and Evidence

Each execution needs a durable run identity separate from the routine definition.

A run may record:

- invocation, start and completion time, active version, and triggering context;
- steps presented, acknowledged, skipped, deferred, or changed;
- user-reported, app-verified, agent-observed, and inferred outcomes as distinct evidence types;
- app writes, tool calls, script results, background assignments, retries, and failures;
- source links and the exact data scope used;
- changes proposed to the routine after the run; and
- the state required to resume an interrupted session.

Routine state can inform future behavior without rewriting historical runs. Corrections should propagate into summaries and derived statistics while preserving the audit trail.

## Apps, Tools, and Scripts

A routine can compose capabilities from multiple apps while keeping ownership explicit.

- The routine node owns orchestration intent, steps, permitted capabilities, and run history.
- Domain apps own their canonical records, such as vitamin intake, hydration, calendar items, health tracking, or flashcard performance.
- The routine stores references or projections needed to explain what it did without silently duplicating every domain record.
- Tool and API operations need declared inputs, outputs, secrets handling, failure behavior, and write scope.
- A custom script may become a versioned component of the routine when ordinary tool composition is insufficient.
- App, tool, API, and script access must remain capability-based rather than inheriting ambient System Manager or database access.

The user should be able to see which apps a routine interacts with and what information each interaction reads or changes.

## Background Refinement

Background processes may help maintain a routine by inspecting conversation and run history within an approved scope.

Candidate work includes:

- checking whether the maintained instructions still express the user's stated intent;
- detecting friction, skipped steps, recurring exceptions, or stale assumptions;
- collecting user suggestions and unresolved questions;
- proposing changes to steps, heuristics, scripts, schemas, or app interactions;
- refreshing contextual knowledge required by the routine;
- maintaining future-item queues, such as candidate flashcards; and
- returning bounded findings through a routine-specific bulletin or review surface.

Background refinement should propose or apply changes according to the routine's declared authority. It must not silently reinterpret the user's goal or broaden app and data access.

## Automation and Control

Manual or conversational invocation is the initial baseline. Over time, the user may explicitly enable automatic updates, scheduled runs, event triggers, or safe background preparation for an individual routine.

Automation controls should distinguish:

- refreshing the routine's context;
- proposing an instruction or schema change;
- applying an approved routine-definition change;
- preparing the next run;
- starting a conversational run; and
- performing actions or writes without live user interaction.

Each level needs its own trigger, permission, notification, failure, pause, rollback, and review behavior. Turning on automatic context refresh must not silently authorize autonomous health, communication, financial, calendar, or other consequential actions.

A supervisory routine may also use a conditional heartbeat. It remains dormant when no watched builds, tickets, or orchestrators are active; while work is running, it wakes on a configured cadence or event, checks authoritative state, and reports material changes through Robin. Event-driven updates and terminal completion or failure should not wait unnecessarily for the next hourly poll.

When a watched orchestrator needs owner input, the routine can surface its exact question in Robin, preserve the originating run and checkpoint, relay the user's response, and invoke the specifically authorized continuation operation. Resume, retry, restart, and worker replacement are distinct controls rather than synonyms.

## Example Routines

**Morning transition.** Robin conversationally sequences small household actions, then presents a vitamin list. The run records which steps the user reports completing, while vitamin and hydration records project into a Health and Nutrition app.

**Status.** Robin resolves “Status” to a stateful routine that has already run several times, loads its heuristics and prior context, identifies a bounded set of missing facts, dispatches background checks, waits or reports progress, responds, and stores the new receipts for the next invocation.

**Update my flash cards.** Robin reviews the coding concepts that challenged the user, prior explanations, existing cards, practice history, adaptation speed, and a maintained queue of future card suggestions. It adds or defers cards according to the routine's current heuristics and preserves why each change was made.

**Habit and calendar view.** A routine can coordinate morning habits, vitamins, water, and scheduled events while a mobile-friendly app or view renders icons and progress from the same canonical domain records.

**Build and orchestrator watch.** While automated work is active, a supervisory routine checks status on an hourly heartbeat or material event, bundles grounded progress into a proactive Robin update, surfaces blocked questions, relays owner answers, and continues the originating run using explicit resume, retry, restart, or replacement semantics.

These examples establish breadth, not approved implementation details or medical advice.

## Open Design Questions

- What is the smallest common routine-node schema, and which fields or subnodes are earned per routine?
- How does the database preserve the Launchpad authority distinctions among intent, decisions, issues, proposals, sources, and execution state?
- When does an utterance invoke a routine, resume a prior run, ask about its state, or merely mention its topic?
- What confidence threshold requires disambiguation for short aliases such as “Status”?
- What is the routine-specific equivalent of a bulletin, and how do receipts move between workers, the runner, the node, and the user?
- Which records belong to the routine node versus a domain app, and how are cross-store transactions and corrections reconciled?
- How are API definitions, tool calls, secrets, scripts, versions, and capability grants represented safely?
- Which routine refinements may be applied automatically, which require review, and which always require an owner decision?
- How do automatic refresh, automatic modification, scheduled invocation, and autonomous action remain separate controls?
- How are sensitive health and habit records displayed, retained, exported, corrected, and deleted?
- How are watched runs discovered, subscribed to, grouped, and retired so the routine sleeps when no supervision is needed?
- Which status changes deserve immediate notification, an hourly digest, silent history, or escalation?
- What envelope preserves an orchestrator question, the owner's exact answer, any Robin transformation, and the authorized continuation action?
- How do run identity, checkpoints, leases, idempotency keys, and side-effect receipts make resume, retry, restart, and replacement safe?
