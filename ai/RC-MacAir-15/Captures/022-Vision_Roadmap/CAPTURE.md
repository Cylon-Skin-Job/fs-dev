# Vision Roadmap Capture

> Conversational memory and re-entry context. This document preserves owner threads, open questions, and provenance; it does not approve proposals, roadmaps, SPECs, or implementation.

## Working Synthesis

Vision Roadmap is an umbrella product-vision conversation for making Fusion Studio feel like one coherent system across desktop and mobile. Its central ideas are a universal system inbox, an understandable end-to-end UI flow, changes to how chat and threads participate in the wider product, and a mobile experience that integrates the desktop feature set seamlessly rather than behaving like a disconnected companion.

On phones, chat is the default center of gravity. A normal composer occupies the bottom of the screen with a round current-view button beside it. The chat-mode header provides the slide-out navigation control and an `event_list` for modified files, subagent status, and metadata. Inside the navigation surface, a workspace-name header changes workspaces, a bell switches the thread menu into Notifications, and the active workspace's view icons determine which thread list is shown. Tapping the current-view button shifts emphasis from chat to the app: the view takes over the main screen, the view button expands into bottom app navigation, the composer collapses to a robot button, the chat-only event list disappears, and the entire top header becomes available to the active app's chrome.

The system inbox is now framed as Fusion Studio's universal attention surface. It should bring together autonomous work that stopped or needs intervention, conversations awaiting a user reply, work in progress, items needing review, completed auto-generated work that bypasses a completion/review queue, and general alerts. An inbox row presents a compact status summary, while opening it reveals a chronological, expandable activity history resembling an email or conversation thread. The activity stream can expose relevant controls as the item's state changes.

An app-wide bell in the upper-left corner exposes the system-level notification layer. Opening it brings down a full-screen panel that retains Fusion's familiar visual language but removes the normal side-icon navigation. Its left-side list contains workspace names. Each name represents one persistent notification-handling chat for that workspace, occupying the thread position without exposing the workspace's ordinary collection of view-bound threads. Selecting a workspace restores that chat and reveals the workspace's contributions to the system-wide inbox as notification cards. The panel uses a familiar Gmail-like mail-inbox rhythm, with dense rows or cards separated by divider lines rather than a loose dashboard layout. Workspace entries may gain a secondary metadata line beneath the name once the useful fields are shaped. This notification center is intentionally a different paradigm from the workspace's own richer ticket-and-activity inbox, while the persistent chat provides the place to discuss and act on its escalated notifications.

Workspace inboxes remain the local source and organization boundary. The user decides which workspace notifications escalate immediately to the system-wide bell and which accumulate into batches. Batches can be released on a schedule or through trigger-and-state rules, allowing attention policy to range from immediate interruption to deliberate digest delivery. Workspace and system-wide delivery can occur together: for example, a rule can count ten completed jobs, bundle them into one summary notification, place it in the workspace inbox, and also escalate it to the system bell. The same stateful trigger model can create tickets from other derived conditions across arbitrary ticket locations.

The longer-term substrate is an event-fed system rather than a set of isolated notification producers. The owner envisions the current trigger firehose becoming a universal subscriber/filter over the event bus so system events can drive UI updates, react when AI edits affect an open view, and carry database activity, queries, tool-driven writes, and UI-driven writes into relevant downstream behavior. This remains a broad conceptual direction, not a technical design.

The inbox also participates in the full work lifecycle: Launchpad work can generate a first-draft ticket, return here for shaping and review, route through issue resolution and separately authorized roadmap/SPEC creation, undergo later compliance, Wiki, issue, and blast-radius sweeps, and eventually proceed to autonomous construction. The inbox should make this activity observable and actionable without requiring the user to chase separate subsystems.

Navigation and thread identity are also being reorganized around views. The current right-side navigation will move to the left beside the thread list. Threads, currently workspace-wide, will become bound to individual views. Each thread will preserve the content state needed to return to its working context inside that view, including which tabs, documents, and related content were open. This establishes a contextual continuity layer that the owner expects to simplify the next set of features.

The downloaded product will open with **Fusion Home** as its default folder. Users can add more specialized workspaces for code, bookkeeping, media production, research, or system management. Fusion Home adopts an “everything is a plugin” direction and presents a grouped left navigation spanning attention and project management, office and personal-productivity suites, health and household domains, core knowledge and browsing surfaces, extensibility tools, and settings. Lower-density capabilities such as email, calendar, tasks, notes, and contacts move from separate app identities into a consolidated Productivity Suite so thread binding occurs at a useful level of activity.

Thread creation becomes a first-class action on content. Alongside the existing Link and Send to Chat actions, every content surface will offer Send to New Chat. The existing lined chat icon continues to target the current chat; the matching empty icon gains a plus sign to create a new chat and place the content there as an attachment. Ticket attachments give the new thread the ticket's full name, reveal long names with a hover-only ticker effect, and can activate view-specific ticket-agent behavior when the user sends the attachment without additional instructions. The role, heuristics, and workflow are defined through the view's guidance and the Skills area rather than embedded in the ticket itself.

Inside Issues, inbox items can expand in place or open into the full content area. Any item can start a new chat. Once a ticket has a view-bound thread, selecting that thread restores the exact ticket content in the Issues area and lets the user watch its work evolve. This creates a user-in-the-loop form of background agency: tickets may be generated automatically and queued, the user can choose when to run them, and an agent can monitor the inbox and surface significant changes rather than requiring constant manual inspection.

Heartbeats give that monitoring a persistent, thread-visible control. A `pulse_alert` icon appears in the user input area between the plus button and Access permissions only after a heartbeat has been configured. Initial setup begins from the plus button; once configured, the pulse icon provides direct access. A user can ask the AI to monitor something and allow it to establish its own heartbeat. The heartbeat can watch explicit variables or filter the opt-in notification changes associated with a thread, wake when a relevant change occurs, restart or adjust a process, append behavior or information to the open inbox item, and return to sleep. The same pattern can watch long-running project processes such as a multi-day web scraper.

Scheduled work and assignment use tickets as the universal work object. The Scheduled area has a calendar and is intended to support cron scheduling plus arbitrary ticket content. A scheduler can instantiate a saved ticket template into **In Progress**. Any ticket entering In Progress is automatically assigned: an automation performs the equivalent of Send to New Chat and Send, creating the ticket thread on the left without moving the user's current focus. Users can produce the same transition by dragging a ticket into In Progress or using Assign in To Do. Organic creation, manual assignment, calendar/cron schedules, and trigger events therefore converge on the same ticket-and-thread flow, eliminating the need for Background Agents as a separate product category.

The **Agent Profiles** view is a way to discover, define, and invoke capabilities already available through the configured harness rather than a system for managing persistent agent beings. A profile can be selected from the plus button, named in ticket frontmatter, loaded automatically as a workspace default, or invoked by another agent or workflow as a subagent. Profiles can range from lightweight orientation and tool awareness to elaborate gated workflows with role-specific subagents and validation. The governing philosophy is that the profile is a frozen capability container—a mask a thread wears when that set of abilities is needed. Schedules and triggers live outside the profile; durable state belongs to the ticket, workflow, project state, or event history; the user interacts with the work and its thread rather than managing an agent entity.

Settings follow the same plugin philosophy. Fusion's core provides useful but deliberately compact per-workspace palette controls: primary and secondary colors plus a handful of sliders. Installing a **Theme Customization** plugin adds a Custom mode between Light and Dark, granular color pickers, and context-menu entries for deeper control. Other plugins can enable Inbox Alerts, Heartbeats, or a Wiki Maintainer assembled from ticket schedules, Agent Profiles, triggers, and durable state. Plugins are folder-based bundles of Markdown, scripts, configurations, regex, and related resources. Any inbound or outbound Universal Event Bus hooks are surfaced as UI toggles with intelligent installation defaults that remain customizable.

Plugins can also extend Wiki into personal-context surfaces. **Context Manager** is a planned semantic and indexable history that can include basic user data. It may appear as a second Wiki tab or as another Wiki type; that presentation remains open. **User Profile** is another candidate Wiki variant. Any extraction feeding these surfaces is opt-in, and the user retains control over what the system records and what it surfaces back into product context.

Plugin availability and execution are consent-gated through a future database registry tied to the related Provenance work. The registry drives the plugin UI and distinguishes an installed, registered, consented capability from an arbitrary folder on disk. An unregistered folder must not become runnable merely because it was downloaded or placed in a plugin location.

**System Manager** is the bootstrap exception and prerequisite. It is distributed as a repository that Fusion downloads and registers as a workspace before any other plugin can be installed. That workspace contains a fully developed System Wiki and the plugin catalog in its Plugins folder. Fusion's local Plugins viewer remains deliberately thin: it points to the System Manager workspace's configuration catalog, derives user-facing controls from those configurations, and uses the database registry as the authoritative activation and permission state. Toggle changes are written through to configuration. If configuration grants a permission that the registry does not, the server removes that grant from configuration; the database's recorded authority wins rather than treating configuration as a second consent path.

The work should remain at the level of broad product behavior and conceptual systems. Where relevant, it will catalog systems that already exist and roughly explain how the vision connects to them. It will also describe systems that may need to be built in terms of their purpose, responsibilities, relationships, and open questions. It should not descend into file-level change analysis, detailed architecture prescriptions, delivery sequencing, or implementation planning.

This capture is expected to branch into many future roadmaps and SPECs. The working title does not mean that this folder is itself a roadmap. Its job is to establish a coherent umbrella vision, keep cross-cutting relationships visible, and make later bounded planning efforts possible without forcing the whole product direction into one monolithic implementation plan.

The current documented chat architecture is thread-centered and server-owned: durable identity belongs to the thread, live routing uses `threadId`, completed exchanges hydrate from SQLite, and the renderer presents server-owned state. That is current-system context, not a constraint that predetermines the future vision. Later conversation can identify which existing concepts remain useful, which need to evolve, and which broader system relationships are missing.

The inferred phase is **framing and shaping**. The active thread is the phone interaction model: the transition among main chat, slide-out workspace/view/thread navigation, Notifications, the active app surface, and app-owned chrome. The exact workspace-picker presentation, event-list depth, robot-button return behavior, and responsive variants remain open for later shaping.

## User Threads to Resume

### CAP-001 — Universal system inbox

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Launchpad instructions on 2026-08-22
- **Summary:** Define a universal system inbox as a central part of the product vision, including its broad user purpose and relationship to the rest of Fusion Studio.
- **Related:** CAP-002, CAP-003, CAP-004

### CAP-002 — Coherent UI flow

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Launchpad instructions on 2026-08-22
- **Summary:** Shape an end-to-end UI flow that makes the inbox, conversations, workspaces, views, and other product capabilities feel like parts of one system.
- **Related:** CAP-001, CAP-003, CAP-004

### CAP-003 — Chat and threading evolution

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Launchpad instructions on 2026-08-22
- **Summary:** Explore broad changes to the current thread-centered chat experience and how chat should integrate with the universal inbox and the wider product.
- **Related:** CAP-001, CAP-002, CAP-004

### CAP-004 — Seamless mobile integration

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Launchpad instructions on 2026-08-22
- **Summary:** Define a mobile experience that integrates the desktop product's features seamlessly and preserves a coherent cross-device experience.
- **Related:** CAP-001, CAP-002, CAP-003

### CAP-005 — Umbrella vision and future planning families

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's scope clarification on 2026-08-22
- **Summary:** Keep this work broad and conceptual, catalog existing systems and rough new-system needs only as useful, and expect the umbrella vision to produce roughly a dozen separately bounded roadmaps and SPECs later.
- **Related:** D-001, CAP-001, CAP-002, CAP-003, CAP-004

### CAP-008 — Owner-reported existing ticket and trigger foundation

- **Origin:** user
- **Type:** observation
- **Status:** open
- **Source:** RC's system-inbox description on 2026-08-22
- **Summary:** The current Issues tracker reportedly includes Inbox, Scheduled, and Triggers areas; cron and trigger hooks use trigger files with YAML frontmatter; and rudimentary ticket-generation and ticket-monitoring capabilities already exist. These claims have not yet been verified against current sources in this capture.
- **Related:** CAP-001, CAP-009, CAP-011

### CAP-009 — Universal event subscriber and filtered actions

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's system-inbox description on 2026-08-22
- **Summary:** Evolve the trigger firehose into a universal subscriber/filter over the system event bus so relevant events can drive actions such as UI-state updates, refreshes after AI edits to an open file, and downstream behavior associated with database records, queries, tool calls, and UI writes.
- **Related:** CAP-001, CAP-002, CAP-008, CAP-010

### CAP-011 — Vision-to-autonomous-build lifecycle

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's system-inbox description on 2026-08-22
- **Summary:** Connect Launchpad capture, first-draft ticket generation, shaping and review, issue resolution, separately authorized roadmap/SPEC creation, later roadmap updates and compliance/Wiki/blast-radius sweeps, and eventual autonomous construction into one visible lifecycle.
- **Related:** CAP-005, CAP-008, CAP-012

### CAP-012 — Expandable activity timeline

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's system-inbox description and example on 2026-08-22
- **Summary:** Let a compact inbox row open like an email or conversation into a chronological activity history for a ticket, roadmap, SPEC, or autonomous process, with nested milestones, validation results, orchestrator handoffs, optional multiple replies, and context-appropriate controls.
- **Related:** CAP-001, CAP-010, CAP-011, CAP-013

### CAP-013 — HTML artifacts and appendable templates

- **Origin:** user
- **Type:** idea
- **Status:** open
- **Source:** RC's system-inbox description on 2026-08-22
- **Summary:** Consider representing inbox content as HTML artifacts created from prefilled templates with placeholder text, append operations for new sections, and AI-authored content inside those sections.
- **Related:** CAP-012, CAP-014, P-001

### CAP-019 — Features enabled by view-bound thread context

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's navigation and threading direction on 2026-08-22
- **Summary:** Continue with the features that become easier once navigation sits beside threads, threads belong to views, and each thread restores its view-specific content state.
- **Related:** D-003, D-004, D-005

### CAP-025 — Daily thread granularity for lower-density views

- **Origin:** user
- **Type:** idea
- **Status:** open
- **Source:** RC's Fusion Home direction on 2026-08-22
- **Summary:** A single daily thread may be sufficient across the consolidated Productivity Suite, and a new daily thread may likewise be sufficient when the Health & Fitness Tracker is opened. This remains provisional until the Thread Management model is explained.
- **Related:** D-004, D-008, D-009, P-002

### CAP-026 — Forthcoming Thread Management model

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Fusion Home direction on 2026-08-22
- **Summary:** Continue with the intended Thread Management behavior that will govern view-bound threads. The content-to-new-chat and ticket-agent path is now defined, while daily-thread creation, rollover, coexistence, and other lifecycle behavior remain open.
- **Related:** CAP-019, CAP-025, D-004, D-005

### CAP-037 — User-in-the-loop background agency

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Issues inbox and thread-flow direction on 2026-08-22
- **Summary:** Shape the combined inbox, ticket, thread, and live-content experience as background-agent work with the user in the loop: work can progress independently while remaining inspectable, controllable, and available for intervention.
- **Related:** D-017, D-018, D-019, CAP-011, CAP-012

### CAP-045 — Multi-day project monitoring

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's heartbeat direction on 2026-08-23
- **Summary:** Use project-scoped heartbeats to monitor long-running work such as a web scraper operating for several days, with relevant changes and recovery behavior flowing through the associated thread and inbox item.
- **Related:** D-021, D-022, D-023

### CAP-058 — Durable workflow-state alternatives

- **Origin:** user
- **Type:** idea
- **Status:** open
- **Source:** RC's agent and workflow direction on 2026-08-23
- **Summary:** Consider durable workflow state stored in a dedicated folder and updated through JSON, or retrieved through a tool that queries the event bus and event ledger for relevant activity since the workflow's previous invocation.
- **Related:** P-003, P-004, D-033, D-034

### CAP-059 — Nightly incremental Wiki workflow

- **Origin:** user
- **Type:** idea
- **Status:** open
- **Source:** RC's agent and workflow direction on 2026-08-23
- **Summary:** Explore an elaborate scheduled Wiki-maintenance workflow that processes one chunk nightly, tracks progress, gates stages, delegates role-specific subagents, and invokes validation agents.
- **Related:** CAP-058, D-033

### CAP-060 — Reusable bug-fix persona and workflow

- **Origin:** user
- **Type:** idea
- **Status:** open
- **Source:** RC's agent and workflow direction on 2026-08-23
- **Summary:** Explore a lightweight bug-fix profile with a small skill set and subagents for blast-radius and knock-on-effect checks that plans, validates, executes, repairs, and reports.
- **Related:** D-033, D-034

## Assistant Possibilities

No assistant-originated product direction has been adopted or queued yet.

## Decision Queue

### CAP-006 — Define the inbox's primary unit

- **Origin:** assistant
- **Type:** decision_prompt
- **Status:** open
- **Source:** Bootstrap synthesis on 2026-08-22
- **Summary:** The user has established that the inbox holds attention-requiring items backed by expandable artifacts, but the durable identity boundary remains open: determine whether one ticket or body of work maps to one accumulating inbox item, can emit several items, or can be regrouped as its state changes.
- **Related:** CAP-001, CAP-010, CAP-012, CAP-013

### CAP-014 — Artifact metadata representation

- **Origin:** user
- **Type:** decision_prompt
- **Status:** open
- **Source:** RC's system-inbox description on 2026-08-22
- **Summary:** Weigh inline artifact metadata against a separate JSON representation for icon state, alert classification, timestamps, controls, and other inbox-row presentation needs when the design is mature enough.
- **Related:** CAP-010, CAP-012, CAP-013

## Routed Outcomes

### CAP-010 — Universal attention surface

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's system-inbox description on 2026-08-22
- **Summary:** The inbox is the universal location for anything that needs the user's attention, with a defined starting alert taxonomy and an unresolved general-alert icon.
- **Related:** D-002

### CAP-016 — Move navigation beside threads

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's navigation and threading direction on 2026-08-22
- **Summary:** Move the current navigation bar from the right to the left, adjacent to the thread list.
- **Related:** D-003

### CAP-017 — Bind threads to views

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's navigation and threading direction on 2026-08-22
- **Summary:** Replace workspace-wide thread placement with threads bound to individual views.
- **Related:** D-004

### CAP-018 — Preserve per-thread view content state

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's navigation and threading direction on 2026-08-22
- **Summary:** Preserve the view content state associated with each thread, including the tabs, documents, and other content that were open.
- **Related:** D-005

### CAP-021 — Fusion Home as the default folder

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Fusion Home direction on 2026-08-22
- **Summary:** Ship the downloaded app with Fusion Home as its default folder and allow the user to add specialized workspace types.
- **Related:** D-006

### CAP-022 — Everything is a plugin

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Fusion Home direction on 2026-08-22
- **Summary:** Adopt an “everything is a plugin” principle for Fusion Home and the broader product model.
- **Related:** D-007

### CAP-023 — Fusion Home left navigation

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Fusion Home direction on 2026-08-22
- **Summary:** Establish the grouped Fusion Home left-navigation structure across issues, project management, office/productivity/health/household suites, Wiki/files/browser, extensibility, and settings.
- **Related:** D-008

### CAP-024 — Consolidate productivity applications into suites

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Fusion Home direction on 2026-08-22
- **Summary:** Replace the current separate-app paradigm for lower-density productivity features with consolidated suite views that provide a more useful unit for view-bound threads.
- **Related:** D-009

### CAP-028 — Add Send to New Chat to all content

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Thread Management direction on 2026-08-22
- **Summary:** Add a Send to New Chat action to every content surface alongside Link and Send to Chat, using the empty chat icon with a plus sign and placing the selected content into the new chat as an attachment.
- **Related:** D-010

### CAP-029 — Derive ticket-thread names from tickets

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Thread Management direction on 2026-08-22
- **Summary:** When a ticket is sent to a new chat, use the ticket identifier and title as the thread name.
- **Related:** D-011

### CAP-030 — Reveal long thread names on hover

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Thread Management direction on 2026-08-22
- **Summary:** Use a hover-only ticker/scroll effect on thread rows so the complete ticket-derived title can be read without permanently expanding the list.
- **Related:** D-012

### CAP-031 — Apply per-view system guidance and heuristics

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Thread Management direction on 2026-08-22
- **Summary:** Use view-bound threading to supply system messages and heuristics appropriate to the active view.
- **Related:** D-013

### CAP-032 — Activate ticket-agent behavior from attachment-only send

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Thread Management direction on 2026-08-22
- **Summary:** In a new view-bound chat containing a ticket attachment, sending with no additional user instructions should activate the ticketing-agent role and its Skills-defined workflow.
- **Related:** D-014

### CAP-034 — Open or expand inbox items into the full content area

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Issues inbox and thread-flow direction on 2026-08-22
- **Summary:** Allow an inbox item to expand within the list context or open as a full-page content experience.
- **Related:** D-015

### CAP-035 — Send any inbox item to a new chat

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Issues inbox and thread-flow direction on 2026-08-22
- **Summary:** Make every inbox item eligible for Send to New Chat so it can become the attachment and context of a new view-bound thread.
- **Related:** D-016

### CAP-036 — Drive Issues content from the selected thread

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Issues inbox and thread-flow direction on 2026-08-22
- **Summary:** In Issues, switching among threads changes the main content area to the exact ticket or inbox content associated with the selected thread and exposes its evolving work.
- **Related:** D-017

### CAP-038 — Queue auto-generated tickets for user-triggered execution

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Issues inbox and thread-flow direction on 2026-08-22
- **Summary:** Permit tickets to be generated automatically and placed into a queue so the user can decide when to run them.
- **Related:** D-018

### CAP-039 — Let agents monitor inboxes for significant changes

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Issues inbox and thread-flow direction on 2026-08-22
- **Summary:** Allow the user to instruct an agent to monitor an inbox and report when significant changes occur.
- **Related:** D-019

### CAP-041 — Show a conditional heartbeat control in the composer

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's heartbeat direction on 2026-08-23
- **Summary:** Place a `pulse_alert` control between the plus button and Access permissions only when a heartbeat is configured; initial setup starts from the plus button and the visible pulse icon provides direct access afterward.
- **Related:** D-020

### CAP-042 — Let an AI establish its own heartbeat when asked to monitor

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's heartbeat direction on 2026-08-23
- **Summary:** Allow a user to ask an AI to monitor something and allow the AI to configure the heartbeat needed to perform that monitoring.
- **Related:** D-021

### CAP-043 — Monitor explicit variables and opt-in thread changes

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's heartbeat direction on 2026-08-23
- **Summary:** Let a heartbeat monitor specific variables or filter any relevant change from the opt-in notification stream associated with a thread and its inbox activity.
- **Related:** D-022

### CAP-044 — Wake, act, and return to sleep

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's heartbeat direction on 2026-08-23
- **Summary:** When a configured condition is met, allow the heartbeat to wake, restart a process or add behavior to the open inbox item, and then return to sleep.
- **Related:** D-023

### CAP-047 — Schedule cron-driven tickets from a calendar

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's ticket-automation direction on 2026-08-23
- **Summary:** Use the Scheduled calendar to define cron-driven ticket creation and allow any desired content to be included in the scheduled ticket.
- **Related:** D-024

### CAP-048 — Instantiate ticket templates into In Progress

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's ticket-automation direction on 2026-08-23
- **Summary:** Preserve reusable ticket templates and let the scheduler copy an instantiated ticket into In Progress when it is time for the work to run.
- **Related:** D-025

### CAP-049 — Auto-dispatch tickets entering In Progress

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's ticket-automation direction on 2026-08-23
- **Summary:** Detect a ticket entering In Progress and perform the equivalent of Send to New Chat followed by Send so the ticket is assigned and its workflow begins.
- **Related:** D-026

### CAP-050 — Use In Progress as the automatic assignment boundary

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's ticket-automation direction on 2026-08-23
- **Summary:** Automatically assign any ticket that appears in In Progress, regardless of whether it arrived through scheduling, a trigger, or a user action.
- **Related:** D-027

### CAP-051 — Support drag and Assign-button dispatch

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's ticket-automation direction on 2026-08-23
- **Summary:** Let the user assign a ticket by dragging it into In Progress or selecting an Assign action from the To Do section.
- **Related:** D-028

### CAP-052 — Create assigned threads without stealing focus

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's ticket-automation direction on 2026-08-23
- **Summary:** When assignment creates a ticket thread, add it to the left-side thread list without changing the user's current view or active focus.
- **Related:** D-029

### CAP-053 — Replace Background Agents with ticket-driven work

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's ticket-automation direction on 2026-08-23
- **Summary:** Eliminate Background Agents as a discrete product category; represent all work as tickets created organically and assigned manually, by schedule, or by trigger event.
- **Related:** D-030

### CAP-055 — Surface harness-backed roles and subagents

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's agent and workflow direction on 2026-08-23
- **Summary:** Make the Agent Profiles view hook into role and subagent capabilities already available through the configured OpenCode/OpenClaw environment, allowing a role to be invoked as the initial chat persona or as a subagent.
- **Related:** D-031

### CAP-056 — Select an agent profile from ticket frontmatter

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's agent and workflow direction on 2026-08-23
- **Summary:** Allow ticket metadata/frontmatter to name the agent profile that should be invoked for the ticket.
- **Related:** D-032

### CAP-057 — Support simple profiles and elaborate orchestrated workflows

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's agent and workflow direction on 2026-08-23
- **Summary:** Support both lightweight profiles with basic orientation and tool awareness and complex reusable workflows with gates, role-specific subagents, validation, state, and reporting, invoked by a ticket when needed.
- **Related:** D-033

### CAP-061 — Treat agent profiles as masks rather than managed entities

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's agent design philosophy and explicit emphasis on 2026-08-23
- **Summary:** Treat an agent profile as a frozen, invocable container of capabilities—a mask worn by any thread that needs it—rather than a persistent entity with its own schedule, triggers, tracking, and user relationship.
- **Related:** D-034

### CAP-063 — Name the view Agent Profiles

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's explicit naming decision on 2026-08-23
- **Summary:** Name the capability-library view **Agent Profiles**.
- **Related:** D-035

### CAP-064 — Invoke an Agent Profile from the plus button

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's profile-invocation direction on 2026-08-23
- **Summary:** Allow the user to open the plus menu and invoke an Agent Profile for the thread.
- **Related:** D-036

### CAP-065 — Load a workspace default Agent Profile

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's profile-invocation direction on 2026-08-23
- **Summary:** Let a workspace define a default Agent Profile that loads automatically.
- **Related:** D-037

### CAP-067 — Let agents invoke other Agent Profiles

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's explicit profile-composition direction on 2026-08-23
- **Summary:** Allow an active agent to invoke another Agent Profile as a subagent when it needs that capability set.
- **Related:** D-038

### CAP-068 — Treat Settings as a plugin-oriented capability surface

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugins and settings direction on 2026-08-23
- **Summary:** Make Settings primarily a surface for configuring core options and installed plugins rather than a monolithic collection of permanent features.
- **Related:** D-039

### CAP-069 — Keep core workspace palette controls compact

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugins and settings direction on 2026-08-23
- **Summary:** Provide basic per-workspace appearance control through primary and secondary colors plus a small set of sliders.
- **Related:** D-040

### CAP-070 — Add deep theming through a Theme Customization plugin

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugins and settings direction on 2026-08-23
- **Summary:** Let a Theme Customization plugin add a Custom mode between Light and Dark, literal color pickers for granular values, and deeper right-click customization entries across relevant surfaces.
- **Related:** D-041

### CAP-071 — Install operational capabilities as plugins

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugins and settings direction on 2026-08-23
- **Summary:** Allow plugins to enable capabilities such as Inbox Alerts, Heartbeats, and a Wiki Maintainer composed from ticket schedulers, Agent Profiles, trigger-created tickets, and durable state.
- **Related:** D-042

### CAP-072 — Use folder-based plugin bundles

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugins and settings direction on 2026-08-23
- **Summary:** Represent plugins as folders containing Markdown, scripts, configuration, regex, and other resources needed by the capability.
- **Related:** D-043

### CAP-073 — Expose UEB hooks as customizable toggles

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugins and settings direction on 2026-08-23
- **Summary:** Surface each plugin's inbound and outbound Universal Event Bus hooks as UI toggles with intelligent defaults applied at installation and user customization afterward.
- **Related:** D-044

### CAP-075 — Back plugin UI with a database registry

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugin registry direction on 2026-08-23
- **Summary:** After the related Provenance work, create a database registry that connects registered plugins to their Settings UI and product integrations.
- **Related:** D-045

### CAP-076 — Require registration and user consent before plugin execution

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugin registry direction on 2026-08-23
- **Summary:** Prevent an unregistered plugin folder from being treated as installed or executed merely because it was downloaded or placed on disk; registration and user consent must authorize activation.
- **Related:** D-046

### CAP-078 — Confirm the Provenance project name

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC clarification on 2026-08-23
- **Summary:** The related project is named **Provenance**; this latest owner clarification is authoritative.
- **Related:** D-047

### CAP-079 — Make System Manager the bootstrap plugin workspace

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's System Manager clarification on 2026-08-23
- **Summary:** System Manager is a repository that Fusion downloads and registers as a workspace. It is also the prerequisite plugin installation that must occur before any other plugin can be installed.
- **Related:** D-048, D-049

### CAP-080 — Host system knowledge and the plugin catalog in System Manager

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's System Manager clarification on 2026-08-23
- **Summary:** The System Manager workspace contains a fully developed System Wiki and a Plugins folder containing the available plugin bundles.
- **Related:** D-050

### CAP-081 — Keep the local Plugins viewer thin

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's System Manager clarification on 2026-08-23
- **Summary:** Fusion's local Plugins viewer points to a configuration folder in the registered System Manager workspace. Configuration declarations are used to generate the relevant UI toggles rather than duplicating the catalog locally.
- **Related:** D-051

### CAP-082 — Make plugin activation registry-authoritative

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's System Manager clarification on 2026-08-23
- **Summary:** The database registry is the source of truth for plugin toggle state. User toggle changes are persisted through the registry and written back to the plugin configuration projection.
- **Related:** D-052

### CAP-083 — Reject configuration-only permission grants

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's System Manager clarification on 2026-08-23
- **Summary:** The database registry remains authoritative during reconciliation. If configuration grants a permission that is not granted in the database, the server overwrites the configuration to remove that unauthorized grant. Other mismatches are reconciled from database state rather than being universally forced off.
- **Related:** D-053

### CAP-085 — Add the app-wide notification bell

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Universal Inbox continuation on 2026-08-23
- **Summary:** Fusion presents a bell icon in the upper-left corner of the app as the entry point for system-wide notifications.
- **Related:** D-054

### CAP-086 — Route workspace inbox attention into the system layer

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Universal Inbox continuation on 2026-08-23
- **Summary:** Workspace inboxes remain independently arranged, while selected workspace notifications can be escalated into the app-wide notification layer.
- **Related:** D-055

### CAP-087 — Support immediate escalation and notification batching

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Universal Inbox continuation on 2026-08-23
- **Summary:** Workspace notification policy can escalate selected events immediately or collect them into batches instead of surfacing each event independently.
- **Related:** D-056

### CAP-088 — Release batches through schedules or trigger-and-state rules

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Universal Inbox continuation on 2026-08-23
- **Summary:** Batched notifications can be delivered on a schedule or when configured trigger and state conditions are satisfied.
- **Related:** D-057

### CAP-090 — Generate tickets from derived state conditions

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's state-trigger example on 2026-08-23
- **Summary:** Triggers can evaluate derived state across arbitrary ticket locations and create another ticket when a condition matches. One concrete example is counting sibling tickets in a folder and generating a ticket when the configured count or state threshold is met.
- **Related:** D-058

### CAP-091 — Aggregate completed jobs into one dual-delivery notification

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's notification aggregation example on 2026-08-23
- **Summary:** A state rule can bundle a set such as ten completed jobs into one summary notification, deliver it to the originating workspace inbox, and also escalate it to the system-wide bell. Local and system-wide delivery are compatible destinations rather than mutually exclusive choices.
- **Related:** D-059

### CAP-092 — Open the system inbox as a full-screen descending panel

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's system-wide inbox UI description on 2026-08-23
- **Summary:** Clicking the upper-left bell brings down a full-screen system inbox panel with a familiar Fusion appearance.
- **Related:** D-060

### CAP-093 — Replace side icons with workspace-name navigation

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's system-wide inbox UI description on 2026-08-23
- **Summary:** The full-screen system inbox omits the app's normal side icons. Its navigation entries are workspace names, each corresponding to the workspace's persistent notification-handling chat rather than exposing its ordinary thread list.
- **Related:** D-061

### CAP-094 — Show each workspace's system-wide notification subset

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's system-wide inbox UI description on 2026-08-23
- **Summary:** Selecting a workspace name reveals the system-wide notifications contributed by that workspace.
- **Related:** D-062

### CAP-095 — Use cards instead of the workspace inbox paradigm

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's system-wide inbox UI description on 2026-08-23
- **Summary:** The system-wide panel presents notification cards and intentionally does not reproduce the richer ticket-and-activity paradigm of the workspace inbox itself.
- **Related:** D-063

### CAP-097 — Persist one notification-handling chat per workspace

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's system inbox chat clarification on 2026-08-23
- **Summary:** Each workspace name in the system-wide inbox corresponds to one persistent chat for that workspace. The chat is the durable thread in which the user handles that workspace's escalated notification cards.
- **Related:** D-064

### CAP-098 — Use a divided mail-inbox visual language

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's system inbox style direction on 2026-08-23
- **Summary:** Give the system-wide panel a familiar Gmail-like mail-inbox style, arranging its notification cards or rows with clear divider lines and compact list rhythm.
- **Related:** D-065

### CAP-099 — Consider secondary workspace metadata

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's system inbox style direction on 2026-08-23
- **Summary:** Consider displaying a secondary metadata line beneath each workspace name in the system-wide panel. The fields, priority, and behavior are not yet settled.
- **Related:** P-005

### CAP-101 — Center the phone experience on chat

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile unification description on 2026-08-23
- **Summary:** The phone experience opens around a chat-centered screen rather than a reduced standalone app view.
- **Related:** D-066

### CAP-102 — Pair the mobile composer with a round current-view button

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile unification description on 2026-08-23
- **Summary:** Place a typical chat input at the bottom of the phone screen with a round button immediately to its right that bears the icon of the active view.
- **Related:** D-067

### CAP-103 — Add chat-mode drawer and event-list controls

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile unification description on 2026-08-23
- **Summary:** In mobile chat mode, place the slide-out navigation control in the upper-left and `event_list` in the upper-right.
- **Related:** D-068

### CAP-104 — Use event_list for active-work context

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile unification description on 2026-08-23
- **Summary:** Let `event_list` expose files modified, subagent status, metadata, and related context around the active conversation.
- **Related:** D-069

### CAP-105 — Switch workspaces from the mobile thread-menu header

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile unification description on 2026-08-23
- **Summary:** Show the current workspace name in the main-width thread-menu header and switch workspaces when it is tapped. Whether the chooser drops down, slides up, or uses another mobile presentation remains open.
- **Related:** D-070, P-006

### CAP-106 — Give the mobile thread menu a Notifications mode

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile unification description on 2026-08-23
- **Summary:** Place the notification bell to the left of the workspace header. Tapping it switches the thread menu to a Notifications screen with a back arrow and Notifications heading; selecting an entry opens the corresponding persistent workspace notification chat.
- **Related:** D-071

### CAP-107 — Switch mobile thread lists with workspace view icons

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile unification description on 2026-08-23
- **Summary:** When Notifications is not open, show the active workspace's view icons along the left side of the navigation surface and switch the visible thread list when the selected view changes.
- **Related:** D-072

### CAP-108 — Transform the bottom controls when entering app mode

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile unification description on 2026-08-23
- **Summary:** Tapping the round current-view button changes the main screen from chat to that app view, expands the view button across the bottom into app navigation, and collapses the composer into a robot-icon button.
- **Related:** D-073

### CAP-109 — Give app mode the full mobile header

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mobile chrome clarification on 2026-08-23
- **Summary:** In app mode, remove the chat-only `event_list` control and make the entire top header area available for whatever app-specific chrome the active view requires.
- **Related:** D-074

### CAP-111 — Let plugins add Wiki-derived context surfaces

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's personal-context plugin direction on 2026-08-23
- **Summary:** Allow plugins to add Wiki-derived personal-context surfaces rather than limiting Wiki to one fixed content type.
- **Related:** D-075

### CAP-112 — Define Context Manager as semantic indexable history

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's personal-context plugin direction on 2026-08-23
- **Summary:** A planned **Context Manager** plugin provides a semantic, indexable history and may include basic user data.
- **Related:** D-076

### CAP-113 — Require opt-in extraction and user-controlled visibility

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's personal-context plugin direction on 2026-08-23
- **Summary:** Extraction into personal-context Wiki surfaces is opt-in. The user controls what information is recorded and what information the system surfaces.
- **Related:** D-077

### CAP-114 — Choose between a second tab and a distinct Wiki type

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's personal-context plugin direction on 2026-08-23
- **Summary:** Context Manager may appear as a second Wiki tab or as another type of Wiki. The final information-architecture treatment remains open.
- **Related:** P-007

### CAP-115 — Consider a User Profile Wiki variant

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's personal-context plugin direction on 2026-08-23
- **Summary:** Consider **User Profile** as another plugin-added Wiki variant governed by the same opt-in extraction and user-control principles.
- **Related:** P-008


## Capture History

### CAP-007 — Launchpad bootstrap

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad session on 2026-08-22
- **Summary:** Created the Vision Roadmap working-memory folder, established its broad non-implementation boundary, and recorded the four initial product threads plus the expectation of many future planning branches.
- **Related:** D-001, CAP-001, CAP-002, CAP-003, CAP-004, CAP-005

### CAP-015 — System inbox model checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-22
- **Summary:** Established the attention taxonomy, event-fed activity direction, expandable timeline experience, vision-to-build lifecycle, HTML/template idea, and metadata decision prompt; added SYSTEM_INBOX.md as the first earned domain extension.
- **Related:** CAP-008, CAP-009, CAP-010, CAP-011, CAP-012, CAP-013, CAP-014, D-002, P-001

### CAP-020 — Navigation and view-bound threading checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-22
- **Summary:** Recorded left-side navigation, view-bound threads, and per-thread restoration of view content state as owner decisions; added THREADS_AND_VIEWS.md to hold their broad conceptual model.
- **Related:** CAP-016, CAP-017, CAP-018, CAP-019, D-003, D-004, D-005

### CAP-027 — Fusion Home and plugin-shell checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-22
- **Summary:** Recorded Fusion Home, specialized addable workspaces, the plugin principle, grouped left navigation, and suite consolidation; preserved daily threads and the forthcoming Thread Management explanation as open threads; added FUSION_HOME.md.
- **Related:** CAP-021, CAP-022, CAP-023, CAP-024, CAP-025, CAP-026, D-006, D-007, D-008, D-009, P-002

### CAP-033 — Content-to-ticket-thread checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-22
- **Summary:** Recorded Send to New Chat, ticket-derived naming, hover title reveal, per-view guidance, and attachment-only ticket-agent activation; added THREAD_MANAGEMENT.md while leaving daily and mixed thread lifecycles open.
- **Related:** CAP-028, CAP-029, CAP-030, CAP-031, CAP-032, D-010, D-011, D-012, D-013, D-014

### CAP-040 — Issues content and user-in-loop autonomy checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-22
- **Summary:** Connected expandable/full-page inbox artifacts, new-chat actions, thread-selected Issues content, queued auto-generated tickets, user-triggered execution, and significance monitoring into the inbox and Thread Management models.
- **Related:** CAP-034, CAP-035, CAP-036, CAP-037, CAP-038, CAP-039, D-015, D-016, D-017, D-018, D-019

### CAP-046 — Heartbeat and monitoring checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded the conditional composer control, plus-menu setup, direct access, AI-created heartbeats, variable and opt-in event filtering, wake/action/sleep behavior, and long-running project use; added HEARTBEATS_AND_MONITORING.md.
- **Related:** CAP-041, CAP-042, CAP-043, CAP-044, CAP-045, D-020, D-021, D-022, D-023

### CAP-054 — Ticket automation and unified-work checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded calendar/cron ticket scheduling, template instantiation, In Progress auto-assignment, automated new-chat dispatch, manual drag/Assign paths, non-focus-stealing thread creation, and the removal of Background Agents as a separate category; added TICKET_AUTOMATION.md.
- **Related:** CAP-047, CAP-048, CAP-049, CAP-050, CAP-051, CAP-052, CAP-053, D-024, D-025, D-026, D-027, D-028, D-029, D-030

### CAP-062 — Agent capability and philosophy checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded harness-backed role discovery, ticket-selected profiles, simple and complex workflow composition, state alternatives, reusable Wiki and bug-fix examples, and the owner philosophy of profiles as invocable masks; added AGENT_PROFILES.md and AGENT_PHILOSOPHY.md.
- **Related:** CAP-055, CAP-056, CAP-057, CAP-058, CAP-059, CAP-060, CAP-061, D-031, D-032, D-033, D-034, P-003, P-004

### CAP-066 — Agent Profiles naming and invocation checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Named the view Agent Profiles and recorded plus-menu invocation and automatically loaded workspace defaults while preserving profile-precedence behavior as open.
- **Related:** CAP-063, CAP-064, CAP-065, D-035, D-036, D-037

### CAP-074 — Plugins and settings checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded the plugin-oriented Settings model, compact core palette controls, Theme Customization extension, operational plugin examples, folder-based bundles, and customizable UEB hook toggles; added PLUGINS_AND_SETTINGS.md.
- **Related:** CAP-068, CAP-069, CAP-070, CAP-071, CAP-072, CAP-073, D-039, D-040, D-041, D-042, D-043, D-044

### CAP-077 — Plugin registry and consent checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Added the future database registry as the authority behind plugin UI, registration, activation, and consent, preventing arbitrary unregistered folders from becoming runnable.
- **Related:** CAP-075, CAP-076, D-045, D-046

### CAP-084 — System Manager and registry checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded System Manager as the required repository-backed bootstrap workspace, its System Wiki and plugin catalog, the thin local Plugins viewer, registry-authoritative toggles and permissions, configuration write-through, and removal of configuration-only permission grants.
- **Related:** CAP-079, CAP-080, CAP-081, CAP-082, CAP-083, D-048, D-049, D-050, D-051, D-052, D-053

### CAP-089 — System-wide notification routing checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded the upper-left system bell, workspace inboxes as local attention sources, selective system-wide escalation, notification batching, and schedule- or trigger/state-driven release.
- **Related:** CAP-085, CAP-086, CAP-087, CAP-088, D-054, D-055, D-056, D-057

### CAP-096 — System-wide inbox panel checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded the bell-triggered full-screen panel, workspace-name-only navigation, workspace-filtered system notifications, and distinct card-based presentation.
- **Related:** CAP-092, CAP-093, CAP-094, CAP-095, CAP-097, D-060, D-061, D-062, D-063, D-064

### CAP-100 — System inbox styling checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded the familiar divided mail-inbox style and preserved secondary metadata beneath workspace names as an open design proposal.
- **Related:** CAP-098, CAP-099, D-065, P-005

### CAP-110 — Mobile unification checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Added MOBILE_EXPERIENCE.md and recorded the chat-centered phone state, event list, workspace and notification navigation, view-driven thread switching, chat-to-app bottom-bar transformation, and app-owned top chrome.
- **Related:** CAP-101, CAP-102, CAP-103, CAP-104, CAP-105, CAP-106, CAP-107, CAP-108, CAP-109, D-066, D-067, D-068, D-069, D-070, D-071, D-072, D-073, D-074, P-006

### CAP-116 — Personal-context plugin checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-08-23
- **Summary:** Recorded plugin-added Wiki variants, Context Manager's semantic indexable history, opt-in extraction, user control over recording and surfacing, and the open tab/type and User Profile proposals.
- **Related:** CAP-111, CAP-112, CAP-113, CAP-114, CAP-115, D-075, D-076, D-077, P-007, P-008
