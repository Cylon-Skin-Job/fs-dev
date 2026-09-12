# Vision Roadmap Decisions

> Sole durable register of explicit owner decisions for this capture. Entries record settled direction without creating roadmap, SPEC, or implementation authority.

## Identity and Scope

### D-001 — Use Vision Roadmap as the umbrella capture name

- **Date:** 2026-08-22
- **Category:** process
- **Status:** active
- **Source:** CAP-005

The working capture is named **Vision Roadmap**. The name describes an umbrella vision that may later produce many roadmaps and SPECs; it does not classify this folder as an implementation roadmap.

### D-006 — Ship with Fusion Home as the default folder

- **Date:** 2026-08-22
- **Category:** product
- **Status:** active
- **Source:** CAP-021

The downloaded app opens with **Fusion Home** as its default folder. Users can add specialized workspaces for code, bookkeeping, media production, research, and system management.

## Experience Direction

### D-002 — Make the inbox the universal attention surface

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** active
- **Source:** CAP-010

Fusion Studio's system inbox is the universal location for anything that needs the user's attention. The detailed item model, alert presentation, and interaction controls remain open for shaping.

### D-003 — Place navigation on the left beside threads

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** active
- **Source:** CAP-016

Move the current right-side navigation bar to the left side of the interface, adjacent to the thread list.

### D-008 — Use the grouped Fusion Home left navigation

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** superseded
- **Source:** CAP-023

Fusion Home's left navigation is grouped as follows:

1. Issues, including its inbox; and Projects, represented by individually created Project Viewer entries and formerly framed as one Launchpad/Project Manager surface.
2. Office Suite; Productivity Suite; Health & Fitness Tracker; and Recipes, Meal Tracker & Shopping List.
3. Wiki; File Explorer; and Browser.
4. Agent Profiles under a brain/node-network icon; and Settings Manager under a gears icon.

Exact labels and the Office Suite's internal presentation-builder naming can be refined later without changing the grouped direction.

D-104 and D-119 supersede this four-group hierarchy. They retain the left-side
direction while making the renamed Project Manager project-first, placing
Routines and Plugins in the lower group, and leaving Agent Profiles placement
open.

### D-009 — Consolidate lower-density productivity capabilities into suites

- **Date:** 2026-08-22
- **Category:** product
- **Status:** active
- **Source:** CAP-024

Email, Calendar, To Do, Notes, and Contacts will be combined into a Productivity Suite rather than remaining separate application surfaces. Related lower-density capabilities should be grouped at a level that can sustain meaningful view-bound threads.

### D-010 — Add Send to New Chat to every content surface

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** active
- **Source:** CAP-028

Every content surface will provide Link, Send to Chat, and Send to New Chat actions. Send to Chat retains the lined chat icon. Send to New Chat uses the corresponding empty chat icon with a plus sign, creates a new chat, and places the selected content there as an attachment.

### D-011 — Name ticket-created threads from the ticket

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** active
- **Source:** CAP-029

When a ticket is sent to a new chat, the thread name will use the ticket identifier and title, following the pattern `Ticket 000123 - …`.

### D-012 — Reveal complete thread titles with a hover ticker

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** active
- **Source:** CAP-030

Long thread titles will use a small ticker/scroll effect only while the user hovers over the thread row, allowing the full ticket name to be read without permanently widening the list.

### D-015 — Let inbox items expand or open full page

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** active
- **Source:** CAP-034

An inbox item can be expanded for additional context or opened into the full content area.

### D-016 — Let any inbox item start a new chat

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** active
- **Source:** CAP-035

Every inbox item can use Send to New Chat, creating a new view-bound thread with the item attached.

### D-017 — Restore Issues content from thread selection

- **Date:** 2026-08-22
- **Category:** experience
- **Status:** active
- **Source:** CAP-036

In the Issues view, selecting a thread changes the main content area to the exact ticket or inbox content associated with that thread. Returning to the thread restores that content and allows the user to observe its ongoing work.

### D-020 — Use a conditional pulse-alert heartbeat control

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-041

When a heartbeat has been configured, show a `pulse_alert` icon in the user input area between the plus button and Access permissions. Initial heartbeat setup begins from the plus button. After setup, tapping the pulse icon provides direct access to the heartbeat. Do not show the pulse icon when no heartbeat exists.

### D-024 — Use Scheduled for calendar and cron ticket creation

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-047

The Scheduled area uses a calendar and will allow the user to schedule cron-driven tickets with whatever ticket content the workflow requires.

### D-028 — Support manual assignment by drag or Assign action

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-051

The user can assign a ticket by dragging it into In Progress or by using an Assign action within To Do.

### D-029 — Do not steal focus when assignment creates a thread

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-052

When ticket assignment creates a new thread, the thread appears in the left-side list while the user's current focus remains unchanged.

### D-125 — Make chat routing a reusable three-destination capability

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-153

Fusion provides reusable actions that send content to the invoking surface's
parent chat, create a new side chat and place the content there, or create a new
view-bound thread and place the content there. Each destination can either
populate the target composer for review or immediately send the resulting
message. Every form may append caller-supplied text after the routed attachment
or content. Product surfaces reuse these behaviors instead of implementing
their own chat-transfer rules.

### D-132 — Call the two user-facing chat surfaces Main Chat and Side Chat

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-160

Fusion calls the ordinary conversation surface **Main Chat** and a chat mounted
in a content tab **Side Chat** everywhere user-facing, including labels,
fallback titles, accessible names, help text, and documentation. Internal
persistence and protocol retain `primary` for the current-member role and
`side-chat` for tab/projection discriminators. This is a vocabulary decision,
not a schema migration: no mutable main/side membership role is added, and the
existing append-only primary history remains authoritative.

## System Direction

### D-004 — Bind threads to individual views

- **Date:** 2026-08-22
- **Category:** system
- **Status:** active
- **Source:** CAP-017

Threads will no longer be workspace-wide. Each thread will be bound to an individual view.

### D-005 — Preserve view content state per thread

- **Date:** 2026-08-22
- **Category:** system
- **Status:** active
- **Source:** CAP-018

Each view-bound thread will preserve the content state needed to resume its working context in that view, including which tabs, documents, and related content were open.

### D-007 — Adopt an everything-is-a-plugin principle

- **Date:** 2026-08-22
- **Category:** system
- **Status:** active
- **Source:** CAP-022

Fusion Home and the broader product direction will adopt the principle that everything is a plugin. The exact plugin contracts and implementation boundaries are outside this capture's current scope.

### D-013 — Apply system guidance and heuristics per view

- **Date:** 2026-08-22
- **Category:** system
- **Status:** active
- **Source:** CAP-031

View-bound threads may receive system messages and heuristics specific to their view so the assistant can interpret content and actions in the appropriate domain context.

### D-014 — Treat an attachment-only ticket send as ticket-agent activation

- **Date:** 2026-08-22
- **Category:** system
- **Status:** active
- **Source:** CAP-032

When a ticket is attached to a new view-bound chat and the user sends it without additional instructions, the assistant should take on the ticketing-agent role. The role and workflow will be defined through the Skills section.

### D-018 — Queue auto-generated tickets for user-triggered execution

- **Date:** 2026-08-22
- **Category:** system
- **Status:** active
- **Source:** CAP-038

Tickets may be generated automatically and placed into a queue without beginning execution. The user can choose when to run the queued work.

### D-019 — Support agent monitoring of inbox significance

- **Date:** 2026-08-22
- **Category:** system
- **Status:** active
- **Source:** CAP-039

The user can assign an agent to monitor an inbox and report when significant changes occur. The meaning of significant and the notification policy remain to be shaped.

### D-021 — Let an AI establish a heartbeat for assigned monitoring

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-042

When the user instructs an AI to monitor something, the AI can configure the heartbeat needed to carry out that assignment. The permission, disclosure, and confirmation rules remain to be shaped.

### D-022 — Let heartbeats filter variables and opt-in thread changes

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-043

A heartbeat can monitor explicitly selected variables and filter relevant changes from the opt-in notification stream associated with a thread and its inbox activity.

### D-023 — Let heartbeats wake, act, and return to sleep

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-044

When a monitored condition is met, a heartbeat can wake, perform authorized behavior such as restarting a process or updating the associated open inbox item, and then return to a dormant state.

### D-025 — Instantiate scheduled ticket templates into In Progress

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-048

Scheduled work can preserve a reusable ticket template and instantiate a copy of that template in In Progress when the work is due.

### D-026 — Auto-dispatch tickets added to In Progress

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-049

An automation will observe a ticket entering In Progress and perform the equivalent of Send to New Chat followed by Send, creating the view-bound ticket thread and beginning its defined workflow.

### D-027 — Treat In Progress as the automatic assignment boundary

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-050

Any ticket that appears in In Progress is automatically assigned, regardless of whether the transition was caused by a scheduler, trigger event, drag action, or Assign control.

### D-030 — Represent background work as tickets rather than a separate category

- **Date:** 2026-08-23
- **Category:** product
- **Status:** active
- **Source:** CAP-053

Background Agents will not remain a discrete product category. All such work is represented as tickets created organically and assigned by the user, a scheduler, or a trigger event. Agents and Skills may still execute ticket workflows; the removed distinction is the separate Background Agents product category.

### D-031 — Surface harness-backed roles through Agent Profiles

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-055

The Agent Profiles view will expose and organize role, persona, Skill, workflow, and subagent capabilities already supported by the configured harness environment. RC referenced OpenCode and OpenClaw; the exact division between those names and capabilities should be verified when integration work is scoped.

### D-032 — Let ticket frontmatter select an agent profile

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-056

Ticket metadata/frontmatter may identify the agent profile to invoke for that ticket. A well-built ticket template may require only basic orientation and tool awareness rather than a large embedded prompt.

### D-033 — Support both lightweight profiles and orchestrated workflows

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-057

An invoked capability may be a lightweight persona with a few Skills or an elaborate reusable workflow with gates, role-specific subagents, validation agents, durable state, and reporting. Tickets and schedules invoke the capability; they do not have to reproduce its internal process.

### D-034 — Treat agent profiles as invocable masks, not managed entities

- **Date:** 2026-08-23
- **Category:** product
- **Status:** active
- **Source:** CAP-061

An agent profile is a frozen, invocable container of abilities—a mask worn by a thread when that capability set is useful. It is not a persistent entity that owns schedules, triggers, lifecycle state, or an ongoing relationship the user must manage. Tickets and threads own visible work; workflows own process; durable state lives outside the persona.

### D-035 — Name the view Agent Profiles

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-063

The left-navigation capability view is named **Agent Profiles**. Skills, workflows, roles, and subagent patterns are capabilities composed by profiles rather than separate identities in the view title.

### D-036 — Invoke Agent Profiles from the plus menu

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-064

The user can open the plus menu and invoke an Agent Profile for the thread.

### D-037 — Support an automatically loaded workspace default profile

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-065

A workspace can define a default Agent Profile that loads automatically. Precedence and layering with explicit plus-menu selection, ticket frontmatter, and view heuristics remain to be shaped.

### D-038 — Let agents invoke Agent Profiles as subagents

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-067

An active agent or workflow can invoke another Agent Profile as a subagent when it needs that capability set. Invocation composes a reusable mask into the current work; it does not create a persistent managed entity.

### D-039 — Make Settings plugin-oriented

- **Date:** 2026-08-23
- **Category:** product
- **Status:** active
- **Source:** CAP-068

Settings will combine a small core configuration surface with installed plugin configuration. Advanced capabilities should be delivered through plugins instead of permanently expanding a monolithic Settings system.

### D-040 — Provide compact per-workspace palette controls in core

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-069

Core Fusion provides per-workspace appearance customization through primary and secondary colors plus a small set of sliders.

### D-041 — Add deep theming through Theme Customization

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-070

Installing the **Theme Customization** plugin adds a Custom mode between Light and Dark, literal color pickers for granular values, and right-click menu entries in relevant places for deeper customization.

### D-042 — Deliver optional operational systems as plugins

- **Date:** 2026-08-23
- **Category:** product
- **Status:** active
- **Source:** CAP-071

Optional operational capabilities such as Inbox Alerts, Heartbeats, and Wiki Maintainer can be enabled as plugins. A plugin may compose ticket schedulers, Agent Profiles, trigger-created tickets, state folders, and other existing product primitives.

### D-043 — Represent plugins as folder-based bundles

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-072

Plugins are folder-based bundles that may contain Markdown, scripts, configuration, regex, and other resources needed to define and operate the capability.

### D-044 — Expose plugin UEB hooks as configurable toggles

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-073

Every plugin hook into or out of the Universal Event Bus is represented by a user-visible UI toggle. Installation applies intelligent defaults, and the user can customize the enabled hooks afterward.

### D-045 — Back plugin UI and activation with a database registry

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-075

After the related Provenance work, Fusion will use a database registry to connect registered plugins to their UI, configuration, hooks, and activation state.

### D-046 — Require registration and consent before plugin execution

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-076

The presence of a plugin folder on disk does not make it installed or runnable. A plugin must be registered and authorized through user consent before Fusion exposes its active UI elements, enables its hooks, or executes its resources.

### D-048 — Distribute System Manager as a repository-backed workspace

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-079

System Manager is a repository that Fusion downloads and registers as a workspace. It is both a plugin and a workspace-level system resource.

### D-049 — Require System Manager before other plugins

- **Date:** 2026-08-23
- **Category:** product
- **Status:** active
- **Source:** CAP-079

System Manager must be installed and registered before Fusion permits installation of any other plugin.

### D-050 — Put the System Wiki and plugin catalog in System Manager

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-080

The System Manager workspace contains a fully developed System Wiki and a Plugins folder containing the other available plugin bundles.

### D-051 — Drive the local Plugins viewer from System Manager configuration

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** superseded
- **Source:** CAP-081

Fusion's local Plugins viewer points to configuration in the registered System Manager workspace. Those declarations generate the relevant UI controls; the local viewer does not maintain a second independent catalog.

D-164 supersedes the direct-viewer relationship by introducing a locked local
SQLite Browse catalog synchronized from the approved upstream source.

### D-052 — Make the database registry authoritative for plugin toggles and permissions

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-082

The database registry is the source of truth for plugin activation and permission state. Toggle changes persist through the registry and are written through to configuration.

### D-053 — Remove configuration-only permission grants

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-083

Database state wins when registry and configuration disagree. In particular, if configuration grants a permission that is not granted in the database, the server overwrites the configuration to remove that unauthorized grant. Other mismatches are not universally forced off.

### D-054 — Put the system-wide notification bell in the upper-left

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-085

Fusion uses a bell icon in the upper-left corner of the app as the entry point for system-wide notifications.

### D-055 — Preserve workspace inboxes as local notification sources

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-086

Workspace inboxes retain their own organization and notification policy. The system-wide layer receives only the workspace notifications selected for escalation or batching.

### D-056 — Support immediate escalation and batching

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-087

Users can route selected workspace inbox notifications to the app-wide bell immediately or accumulate them into a batch for later delivery.

### D-057 — Drive notification batches with schedules or trigger-and-state rules

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-088

Notification batches can be released on a schedule or when configured trigger and durable-state conditions are satisfied.

### D-058 — Allow derived state to generate tickets

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-090

Triggers can evaluate state derived from any number of tickets and locations, then generate an ordinary ticket when a configured condition matches. Counting sibling tickets in a folder is one supported example of this broader pattern.

### D-059 — Allow one notification to target workspace and system-wide inboxes

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-091

A derived-state rule can aggregate multiple jobs into one notification and deliver it to both the relevant workspace inbox and the system-wide bell. Workspace and system-wide delivery are compatible targets, not mutually exclusive routing modes.

### D-060 — Open the system-wide inbox as a full-screen panel

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-092

Clicking the upper-left bell brings down a full-screen system-wide inbox panel that retains Fusion's familiar visual language.

### D-061 — Navigate the system-wide panel by workspace name only

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-093

The system-wide panel omits the normal side-icon navigation. Its left-side entries are workspace names rather than the workspace's ordinary thread list; each name selects that workspace's dedicated system-inbox context.

### D-062 — Filter system notifications by contributing workspace

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-094

Selecting a workspace name in the system-wide panel displays the system-level notifications contributed by that workspace.

### D-063 — Present system-wide notifications as cards

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-095

The system-wide inbox uses a card-notification presentation. It intentionally does not reproduce the workspace inbox's richer ticket-and-activity interaction paradigm.

### D-064 — Persist one system-inbox chat per workspace

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-097

Each workspace has one persistent chat in the system-wide inbox. Selecting the workspace restores that chat, which serves as the durable thread for handling the workspace's escalated notification cards.

### D-065 — Use a divided mail-inbox style for system notifications

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-098

The system-wide inbox uses a familiar Gmail-like mail-inbox visual rhythm, with compact notification cards or rows separated by divider lines for scanability.

### D-066 — Make chat the default phone state

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-101

Fusion Studio's phone experience is centered on chat as its default screen while retaining direct access to full app views.

### D-067 — Pair the mobile composer with the active-view button

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-102

The bottom of mobile chat mode contains a typical chat input with a round button immediately to its right. The button displays the icon of the active view.

### D-068 — Use drawer and event-list controls in mobile chat mode

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-103

Mobile chat mode places the slide-out navigation control in the upper-left and an `event_list` control in the upper-right.

### D-069 — Show active-work context in event_list

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-104

The mobile `event_list` exposes context such as files modified, subagent status, and metadata associated with the active conversation.

### D-070 — Switch mobile workspaces from the workspace-name header

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-105

The mobile thread/navigation menu uses a primary-width header showing the current workspace name. Tapping it opens workspace switching; the exact picker presentation remains open.

### D-071 — Switch the mobile thread menu into Notifications

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-106

A bell to the left of the workspace header replaces the ordinary mobile thread menu with a Notifications mode containing a back arrow and Notifications heading. Selecting an entry opens the corresponding persistent workspace notification chat.

### D-072 — Change mobile thread populations with view icons

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-107

Outside Notifications mode, the active workspace's view icons appear along the left side of the mobile navigation surface. Selecting a view changes the active view and the thread list shown for it.

### D-073 — Transform the mobile bottom bar between chat and app modes

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-108

Tapping the round active-view button changes the main phone surface from chat to that app view, expands the view control across the bottom into app navigation, and collapses the chat composer into a compact robot-icon button.

### D-074 — Give app mode control of the full top header

- **Date:** 2026-08-23
- **Category:** experience
- **Status:** active
- **Source:** CAP-109

When an app view takes over the phone screen, the chat-mode `event_list` disappears and the entire top header area becomes available for app-specific chrome.

### D-075 — Let plugins add Wiki-derived personal-context surfaces

- **Date:** 2026-08-23
- **Category:** product
- **Status:** active
- **Source:** CAP-111

Plugins can add personal-context surfaces related to Wiki rather than being limited to extending one fixed Wiki content type.

### D-076 — Make Context Manager a semantic, indexable history

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-112

The planned **Context Manager** plugin provides semantic, indexable history and may contain basic user data.

### D-077 — Require opt-in extraction and user control over context

- **Date:** 2026-08-23
- **Category:** system
- **Status:** active
- **Source:** CAP-113

Personal-context extraction is opt-in. The user controls what the system records and, separately, what recorded information it surfaces into product context.

### D-078 — Compose views from independent chat, thread, and content surfaces

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-117

Chat, thread navigation, and the content view are independently presentable parts of the Fusion Studio shell. A view can show all three, retain threads without chat, retain chat without threads, or occupy the full window without either one.

### D-079 — Persist only the content worksurface state with a thread

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-117

Per-thread continuity applies to the content worksurface: open tabs, documents, locations, selections, scroll positions, and similar view-owned state. Surrounding chat and thread chrome do not need to be stored as part of that worksurface state. This decision narrows D-005 without reversing its continuity goal.

### D-080 — Treat assigned folders as worksurfaces rather than hard boundaries

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-117

A folder assigned to a view, thread, or launched work item is a starting context and body of related material. It is not by itself a filesystem, permission, or reasoning boundary.

### D-081 — Host side chats as content tabs with bounded handoff

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-117

Side chats use the same composable conversation component and can appear as tabs inside a content surface. Each side chat remains a distinct conversation associated with its parent view and originating context. When it continues prior work, an agent or helper can read the prior chat and pass forward only the context the new conversation needs.

### D-082 — Make New a configurable view launch action

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** superseded
- **Source:** CAP-117

A view controls the label and icon presented for its creation action. The earlier proposal also coupled thread creation to folder templates, starter files, worksurface creation, and CWD selection. D-101 supersedes that coupling: creating a thread consumes an existing view context, while creating a project or another domain object is a separate flow.

### D-083 — Keep the harness project root as the default working directory

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-117

New sessions continue to use the workspace/project-root working directory already supplied by the harness unless the registered view configuration explicitly overrides it. A separately created Project Viewer may bind that override once for every thread it owns; New Chat does not calculate or negotiate a working directory.

### D-084 — Store view-level conversation configuration in view folders

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-117

View-specific conversation configuration belongs in the view folder and uses the same conceptual configuration approach as workspace-wide defaults. It may cover launch presentation and behavior, instructions, thread organization, sensible default switches, working-directory policy, transcript behavior, and related settings. Installed view defaults remain user-changeable through those settings, and view instructions do not require changing the working directory.

### D-085 — Support folder or tag organization for view threads

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-117

A view's thread collections begin with a default collection named **Threads**, which may be renamed, extended, or deleted. Thread metadata can retain multiple ranked collection assignments in either mode. Folder mode projects only the highest-ranked valid assignment, while tag mode projects all valid assignments. Deleting a configured collection never deletes a thread; an affected thread resolves into Archive when it has no other valid assignment.

### D-086 — Deliver automatic thread renaming as a plugin

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-117

Automatic attachment-aware, ticket-aware, and LLM-assisted naming belongs to an **Auto-Rename Chat Threads** plugin rather than the core conversation component. The core continues to support explicit titles and source-provided identity.

### D-087 — Make transcript destinations configurable

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-117

Saving a transcript can target an explicit folder, create a folder under a selected location, or use the folder passed through a worksurface binding. The exact transcript format and retention behavior remain open.

### D-088 — Give every view capsule an immutable manifest identity

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-120

Each view capsule carries an immutable `metadata.view-id` inside its own `manifest.md`. Folder names, display names, and ordering prefixes may change without changing thread ownership or saved view state. Filesystem inode metadata may help correlate a live rename but is not durable application identity.

### D-089 — Treat the visible thread as an umbrella of peer chat sessions

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-120

The row users see as a thread is a stable umbrella for one body of work. It normally contains one chat session but may contain multiple peer sessions. The umbrella is their parent; sessions do not form a parent/child tree. Immutable membership order records chronology, and append-only primary-change events record which member was treated as primary over time.

### D-090 — Define Move Chat to Side Chat as an empty-primary transition

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-120

**Move Chat to Side Chat** places the current primary chat in a content tab and immediately creates a durable, cold, completely empty primary chat within the same visible thread. It transfers no transcript, provider session, summary, prompt, or hidden context. The prior chat remains unchanged and interactive; explicit **Send to Chat** plus later resume guidance is the only context-transfer path.

### D-091 — Use the full chat module in a centered side-chat tab

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-120

A side-chat tab centers the same complete chat module used by the primary surface, including its list/menu button and shared menu behavior. It does not place another persistent thread list beside the chat.

### D-092 — Remove context-cloning conversation branches from the product

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-120

Fusion Studio will not expose a context-cloning branch action in its UI, public protocol, server services, provider invocation, tests, active roadmaps, or plans. **Send to Chat** supersedes that model with an explicit, simpler transfer of selected material.

### D-093 — Keep one canonical thread-action family

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-120

User-initiated visible-thread and chat-session operations continue through `thread:action`. Thread group is internal domain/storage language rather than a new transport family. `threadGroupId` identifies the visible body of work, `threadId` remains the live route for one chat session, `viewId` identifies its owning view, and `surfaceId` scopes one transient mounted chat instance.

### D-094 — Store group-keyed worksurfaces in the owning view folder

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-120

SQLite owns visible-thread structure, session membership, primary-role history,
and a bounded outbox for unapplied cross-store projections. The owning view
capsule stores each visible thread's content-worksurface snapshot in its view
state. The two stores do not duplicate the worksurface; a failed view-state
projection retries idempotently from its pending outbox instruction without
reopening a tab the user intentionally closed later.

### D-095 — Place view capsules under the machine-scoped System folder

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-121

View definitions move from `ai/<machine>/Views/` to
`ai/<machine>/System/Views/`. A capsule contains the view's manifest,
configuration, styles, and application-owned state, while `content.json`
continues to point independently at the view's primary content root. Wiki or
another content collection may therefore live under the machine AI tree or in
a Git-tracked workspace-root folder without moving the view definition.

### D-096 — Make System policy readable but not directly writable by agents

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-121

The future System access boundary permits agents to read effective
configuration so they can understand and explain it, but denies them direct or
indirect mutation of System configuration and permissions. Changes occur only
through a trusted Fusion UI/service path; an agent may guide the user through
that interface but may not invoke a generic file operation to make the change.
This prevents an agent from granting itself capabilities, altering launch
policy, or enabling agent-controlled thread creation. New threads require an
explicit user action or a separately user-authorized automation enforced by the
server.

### D-097 — Make System configuration portable and editable through GUI or source

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-122

System configuration is an inspectable, versioned file representation that can
be edited through purpose-built Fusion GUI tools or directly as JSON by the
user. Both editing surfaces operate on the same canonical schema and validated
write service; the GUI is not a second source of truth. System may hold view
definitions, reusable component references, templates, and other declarative
customization needed to assemble richer experiences.

### D-098 — Clone configuration without cloning authority or local state

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-122

System configurations can be copied, exported, and cloned between compatible
workspaces. A clone receives new instance identity and retains portable
declarations and stable component references. It does not inherit secrets,
granted permissions, user-consent records, active sessions, thread history, or
ordinary runtime/view state. Requested capabilities may travel as declarations
but require fresh user review and consent before activation.

### D-099 — Use stable tag assignments with a permanent Archive fallback

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-123

A view's configuration defines the folders or tags available in its thread
dropdown. Both presentation modes use stable collection identifiers underneath,
and changing a label does not change its identity. Fusion always injects a
non-removable **Archive** collection for threads with no currently configured
assignment. If configuration removes one or more assigned collections, the
thread is not deleted or stranded; it appears in Archive whenever no valid
assignment remains.

### D-100 — Preserve ranked collection memberships across presentation modes

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-124

Thread metadata always supports multiple stable collection-ID assignments,
each carrying server-owned precedence rank. View configuration uses
`mode: "folders" | "tags"` and defaults to `"folders"`. Folder mode projects
only the highest-ranked valid assignment; tags mode projects all valid
assignments. Selecting another folder raises that assignment's rank without
deleting the others, so switching modes is lossless. Assignments missing from
current configuration remain dormant and become effective again if the same ID
returns. The Archive action deliberately clears every assignment, including
dormant ones, and Archive remains the derived zero-valid-assignment grouping
rather than a separate status flag.

### D-101 — Represent each project as its own ordinary Project Viewer

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-125

The user creates projects directly in side navigation. Each project is a
separate numbered Project Viewer capsule, such as `001-project-viewer` or
`002-project-viewer`, with its own immutable manifest ID and project content
root. The numeric folder prefix controls presentation order but is not project
identity. Project creation establishes the folder/content binding and any
view-level instructions or CWD policy once.

New Chat inside a Project Viewer creates only a view-bound visible thread and
its initial chat session. It does not create project/content folders, copy
starter files, create another view, or pass a folder ID/path through the thread
creation transaction. Multiple primary threads share the Project Viewer's
worksurface, and each may own multiple side-chat sessions. Project Viewer uses
the same viewer, thread-list, content-tab, and chat contracts as other views
rather than introducing a special Project Manager host paradigm.

### D-102 — Use the shared menu with radio folders and checkbox tags

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-126

The thread row's right-click and kebab actions use the recently extracted shared
menu module rather than another bespoke dropdown. A **Collections** item with
the Material Symbol `sub_header` opens a standard right-side submenu containing
the effective configured collections. Folder mode uses mutually exclusive radio
items and closes after selection. Tag mode extends the shared menu with true
checkbox items, uses `menuitemcheckbox` semantics, and remains open for multiple
selections. Both use the same visual checkmark column. Archive is a separate
clear-all action, not a tag checkbox.

### D-103 — Keep conversation creation separate from domain-object creation

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-127

Starting or opening a chat does not create folders, starter files, projects, or
routines. A conversation is registered only after its harness-side identity or
accepted creation result has returned. Project and routine folders are created
through their own explicit product actions before a conversation uses them.

### D-104 — Create projects from the side-navigation plus control

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-128

The side-navigation plus control opens a pop-up for a project name and icon.
Created projects appear above that control. A divider separates project creation
from the ordinary application views beneath it, while Routines and Plugins occupy
a lower group after a visual gap. The permanent placement of Agent Profiles
within this revised hierarchy remains open.

### D-105 — Create routine folders only through an explicit routine action

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-129

Opening the Routines chat or discussing an existing routine does not generate a
folder. **Create Routine** is the explicit boundary that establishes a new
routine folder in which the user and AI can develop its definition, scripts,
state, and documentation.

### D-106 — Present routines as semantic node graphs backed by inspectable files

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-130

A routine is presented as a connected, drag-and-drop sequence of triggers,
scripts, heartbeats, applications, transformations, reasoning steps, and
outputs. Its human-readable anchor is `triggers.md`, whose metadata supports
identity and categorization and whose README-style body explains the routine.
Users can select a node to inspect its underlying script or resource.

### D-107 — Let authorized triggers wake routines after Provenance

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-131

Once the Provenance event and permission foundation exists, a routine may wake
from any installed, registered, configured, and authorized trigger. Examples
include schedules, file changes, derived folder conditions, script state,
heartbeat intervals, and plugin outputs. Trigger authority remains explicit and
registry-backed.

### D-108 — Use proportional waiting and heartbeat follow-up

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-132

Short operations may remain in the active turn and wait for completion. Longer
work can use a heartbeat cycle that sleeps, wakes later, inspects the result,
repairs or reruns when necessary, and returns to sleep. Monitored variables and
defaults may be shaped by the assistant or supplied by an installed plugin, but
the routine's permissions and visible definition govern what may execute.

### D-109 — Give each routine a visible fronting assistant

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-133

The Routines chat is the semantic interface for understanding and shaping an
automation. Its assistant can explain the graph, available triggers and outputs,
connected applications, documentation, installed plugins, and useful missing
plugins. It is a visible capability invoked for the routine, not a persistent or
invisible agent entity.

### D-110 — Allow routines to combine scriptable conditions and visible outputs

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-134

Routine steps may exchange JSON, run scripts, inspect file contents or
extensions, apply regular expressions, and pass a semantic status and payload
into an AI step. Authorized outputs may include reports, inbox items, files, or
tickets. The product keeps the connected steps and their effects inspectable.

### D-111 — Present plugins as sectioned permission-bearing cards

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-135

Installed plugins use a browser-extension-like card presentation organized into
readable sections. Right-side switches expose the plugin's trigger permissions
and output permissions so its wake conditions and possible consequences remain
legible and user-controlled.

### D-112 — Treat plugin dependencies and local model resources as reusable capabilities

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-136

A plugin may request another plugin or resource package and prompt the user to
install it. Large resources such as local model weights require an explicit
installation step and, once registered and authorized, can be reused by multiple
compatible plugins and routines instead of being privately duplicated.

### D-113 — Compose speech-to-text as a modular reusable pipeline

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-137

The microphone can feed a local speech-to-text capability, pass its output
through a user-editable regular-expression formatter, and return the result to
the chat input. The connection may ship preconfigured while model weights remain
an explicit download. Other plugins, such as video transcription with additional
speaker or timestamp resources, can reuse the installed capability.

### D-114 — Clone a registered template when creating a project

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-138

Create Project clones the registered project template into Fusion's default
Projects location and registers the resulting folder as a Project Viewer. The
template initially provides four universally useful starting files and a
discoverable catalog or guide for creating additional files and subfolders as
they become useful. The four file names and exact contents, and the later
treatment of multiple templates, remain open rather than inferred.

### D-115 — Make Launchpad the default composition of an ordinary project

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-139

A project folder, its ordinary Project Viewer, the starting template files,
relevant Skills, and semantic orientation together provide Launchpad by default.
The project can contain multiple visible threads, and each thread can contain a
main chat and peer side chats. Launchpad therefore does not require a bespoke
runtime or separate conversation model.

### D-116 — Use the project folder as Project Viewer's default tab

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-140

The frontmost Project Viewer tab is a direct folder surface. A left-hand
navigator lists the project's Markdown files and subfolders so the user can scan,
open, and jump among them quickly. Markdown files appear first and subfolders
below. Projects may organize material into folders such as Transcripts and
Research rather than forcing one flat document list.

### D-117 — Expose the bulletin both as a slide-out surface and inspectable JSON

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-141

Project Viewer provides a slide-out bulletin for quick situational awareness.
The same bulletin is also available as JSON in the default folder view, preserving
a transparent file representation alongside the convenient product surface. Its
authority and synchronization contract remain to be shaped.

### D-118 — Let only Project Viewer host arbitrary project tabs

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-142

Project Viewer is the only ordinary view permitted to host other views and
unrestricted project-relevant surfaces as tabs in its header. Those tabs may
include tools, previews, research surfaces, and side agents. The underlying
folder, starter-document, and guided-extension pattern remains usable by other
folder-backed views, but they do not inherit this unrestricted tab-hosting
privilege. A side agent remains visibly associated with the project's thread
family and invoked profile rather than becoming an invisible Background Agent
category.

### D-119 — Rename Capture to Project Manager

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-146

The existing Capture product surface becomes **Project Manager**. Its left-side
plus creates a folder from the project template after collecting the folder name
and icon. The new folder is registered, listed, and treated as a view; Project
Manager does not introduce a second project identity above that view.

Each view folder has configuration that contributes view-specific system
guidance to conversations bound to that view. The detailed configuration and
prompt behavior remain within the already in-progress SPEC rather than becoming
new implementation scope in this umbrella capture.

### D-120 — Orient each view-bound conversation from the view README

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-148

Every view capsule includes a readable `README.md` that forms the transparent
orientation entry point for conversations bound to that view. It identifies the
active view. A short common footer at the end points to the view's canonical
configuration and prompt, explains that other view capsules live as siblings
in the same navigable System tree, and describes the read-only listing script
available to discover them. The
active assistant may run that listing, read another view's folder and prompt,
and follow its declared source-folder binding when cross-view knowledge is
relevant. The README routes the assistant to authoritative files rather than
duplicating their contents, and view-specific information receives priority
without making the assistant unaware of the rest of Fusion Studio.

### D-121 — Document Fusion Studio and every view in a shared Wiki

- **Date:** 2026-09-02
- **Category:** product
- **Status:** active
- **Source:** CAP-148

System includes a small, readable Wiki that orients assistants and users to
Fusion Studio as the application shell, the configured harness environment,
the product's major capabilities, and the discoverable view ecosystem. A new
view-panel package includes a corresponding Wiki entry in the same repository
so an assistant can understand how that view participates in the wider system
when needed. This shared documentation remains selectively discoverable rather
than being injected wholesale into every conversation.

### D-122 — Inherit workspace orientation and defaults into each view

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-149

System includes a workspace-level folder with workspace-scoped counterparts to
the orientation, prompt, and configuration artifacts available in view
capsules. It supplies the inherited base for every view and tells the assistant
how to navigate the workspace as a whole. The active view folder then
specializes that base and tells the assistant how to navigate that view. This
creates one readable hierarchy—workspace first, view second—rather than
separate workspace-wide and view-specific configuration systems. The workspace
README explains the complete convention: folder layout, inheritance order,
prompt composition, configuration locations, sibling discovery, and navigation
to view and source folders. The exact folder name and field-level merge,
override, and conflict rules remain part of the later configuration contract.

### D-123 — Append the active view prompt to the workspace prompt

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-150

The workspace-level System folder and every view capsule use a matching
`prompt.md` convention. When a conversation runs, Fusion supplies the workspace
`prompt.md` as the global base and appends the active view's `prompt.md` as the
more specific tail layer. The combined system context is then passed through
the configured harness/provider request, and the README explains that assembly
to users and assistants. The precise adapter field and behavior
for OpenRouter or another provider remain implementation facts to verify rather
than reasons to hide or duplicate the prompt content.

### D-126 — Treat new tabs as view-configured component containers

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-156

A new content tab begins as an empty container for a component. The active
view's own configuration determines which component buttons appear in that
empty container. Choosing a button places the corresponding component in the
tab. The generic tab layer supplies the container and launcher paradigm; chat,
browser, terminal, document, embedded-view, agent, and other domains remain
components that may participate rather than owning separate tab systems.

### D-128 — Let each view supply a new thread's default content surface

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-158

New Thread creates the conversation inside its already resolved view without
performing view-specific content setup. When that thread has no saved
worksurface state, the owning view's canonical configuration selects the
default content module and its initial presentation. The default may be a file,
project, card, capture, or settings list with its own frequent creation action;
it does not have to create a file or folder merely because the thread is new.

### D-129 — Configure default, single-surface, and tab-launch behavior together

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-158

The same canonical configuration stored with a view defines its default
surface, whether the tab-add control is available, the configured presentation
of the initial single surface, and the component or picker actions offered when
an empty tab opens. Fusion may ship useful defaults for each view, and later
trusted configuration editing can change them without adding view-specific
logic to New Thread or the shared tab chrome.

### D-130 — Let view-native previews open through the owning module in a tab

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-158

Selecting an item in a view such as Capture or Issues may first open that item
in a popup or preview appropriate to the view. The preview can then open the
same material in a new tab using the presentation supplied by the originating
view module. Opening in a tab does not require a second renderer or a copy of
the preview surface.

### D-131 — Allow an empty-tab action to fill the tab after a picker

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-158

An empty-tab action need not mount content immediately. It may open a selector
such as the shared File tree drawer and keep the new tab as the destination;
choosing a file then fills that waiting tab. This permits File Viewer to offer
Open File alongside direct component entries such as Side Chat without making
the plus button or New Thread own file-selection behavior.

### D-134 — Configure initial-container policy separately from tab addition

- **Date:** 2026-09-02
- **Category:** system
- **Status:** superseded
- **Source:** CAP-162

For a new thread with no saved worksurface, the view configuration independently
chooses what the initial container shows and how that one-container state is
presented. It may load the view's Home module under centered identity, or load
the selector surface and expose the first container as a visible tab from the
start. This initial policy does not redefine the plus action: every later plus
creates another empty selector container using the same view-configured
selector list.

D-173 supersedes configuration-selected one-container presentation. It
preserves the separation between initial content and later plus behavior: the
initial choice is now a registered loaded target or Empty, and either choice
uses the universal single-tab header while it stands alone.

### D-135 — Keep domain creation effects in Home modules

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-159

Empty-tab selectors do not create Capture collections, project folders, files,
or other domain objects. Frequent domain creation controls live on the Home
module that understands and presents those objects. Selector entries may mount
an available module, open an existing resource through a picker, or instantiate
a Side Chat as the selected component, but they do not become a second domain-
creation surface.

### D-136 — Use File Explorer and Capture as the initial configuration proofs

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** superseded
- **Source:** CAP-162

File Explorer sets Home off, displays its initial selector container as a tab
from the start, and offers **Open File** and **New Side Chat**. Open File reveals
the File tree and fills that waiting tab after selection.

Capture sets Home on, loads the Capture Home module as its initial centered
surface, and exposes the plus control. Pressing plus preserves Capture Home as
the first tab, reveals tabbed presentation, and opens a new selector container
offering **Capture Home** and **New Side Chat**. Later plus actions open the same
selector rather than creating domain content directly.

D-173 supersedes the Home flag and the visible-rail exception for a sole Empty
container. File Explorer and Capture remain candidate adopter proofs, but their
initial loaded-versus-Empty choice does not select chrome; every sole tab uses
the same centered identity and location rail.

### D-137 — Use one placement contract for all navigation sources

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-163

Sidebars, Home modules, previews, empty-tab pickers, and other navigation
sources do not own tab state. They pass a typed resource target to the shared
tab host and request either **Open in Current Tab** or **Open in New Tab**.
The source may expose one or both actions and choose its default disposition;
the tab host alone applies placement and lifecycle rules. This makes a sidebar
an optional source of navigation rather than a required part of a view's
layout.

### D-138 — Resolve an already-open target before applying tab disposition

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-163

Every open request carries stable target identity sufficient to distinguish
the presenting component and resource. Before filling the current tab or
creating a new one, the tab host checks the active worksurface for that target.
If a match is already open, Fusion activates the existing tab and asks the
owning component to reveal, select, or recenter the resource. The tab host does
not interpret component-specific scroll, focus, or selection state.

### D-139 — Apply the shared placement contract to File, Capture, and Bulletin

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-163

File Explorer's sidebar is its File tree. Selecting a file can fill the current
tab, and the source also offers **Open in New Tab**. Capture Home needs no
sidebar for this flow: selecting or previewing Capture material can open that
resource in a new tab through the Capture presentation, replacing the old
fullscreen file route. Project Manager may expose a **Bulletin** sidebar;
selecting a claimed item opens it in a new tab by default, while selecting an
item already represented in the worksurface activates and recenters the
existing tab.

### D-140 — Make Open in Current Tab a non-destructive preference

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-164

**Open in Current Tab** never replaces a populated tab. The host applies this
ordered flow:

1. If the target already exists in another tab, activate that tab and ask its
   component to recenter or reveal the target.
2. Otherwise, if the current tab is empty, fill it with the target.
3. Otherwise, treat the non-empty current tab as unavailable and open the
   target in a new tab.

The current-tab label therefore expresses a placement preference, not
destructive replacement authority. Home, pinned, dirty, and other populated
surfaces need no special branch in this flow because all non-empty tabs receive
the same protection.

### D-141 — Carry the owning presenter with each resource target

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-165

The shared tab host controls placement but does not infer a resource's
appearance from its path or file extension. An open target identifies both the
resource and the view-owned presenter responsible for it. Capture Home remains
its own module, and Markdown originating from Capture opens with Capture's
rendered document presentation. File Explorer opens a file with its fullscreen,
syntax-highlighted display and editing presentation. The same underlying file
may therefore be presented differently when reached through a different
product context.

### D-142 — Route Wiki link tabs by Wiki scope without previews

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-165

Wiki does not use popup or preview surfaces for ordinary page navigation. A
link may expose a right-click action to open its target in a tab. A target
inside the Wiki folder opens through the Wiki presenter. A file target outside
the Wiki folder opens through File Explorer's single-file presenter, without
opening or attaching the File-tree slide-out drawer.

### D-143 — Compose Project Viewer through configuration over the shared host

- **Date:** 2026-09-02
- **Category:** system
- **Status:** superseded
- **Source:** CAP-166

Project Viewer becomes a unified workspace by configuring the same tab host,
placement rules, presenter registry, saved worksurface, and composable chat used
elsewhere. Its configuration may expose several slide-out launcher options that
open registered content surfaces such as Wiki Home, Capture Home, Browser, and
standalone linked files in tabs. Those surfaces remain content presentations
inside the current Project thread and chat context; they do not mount another
view's thread list or require a nested-view runtime.

D-118's unusually broad Project hosting privilege is therefore a product and
configuration policy, not a separate Project-specific tab implementation.

D-155 supersedes this record only to remove the nonexistent Wiki Home target;
it preserves the shared-host, current-thread, and no-nested-runtime contract.

### D-144 — Replace the generic drawer control with semantic drawer actions

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-167

The right edge does not use one generic slide-out-drawer icon. Each drawer
available in the active view receives its own semantic icon action and
accessible label, supplied by the view's configuration. These actions reuse the
same shared button sizing, glyph sizing, spacing, and trailing inset as the top
workspace header rather than defining a separate Project-only rhythm. The Files
drawer uses a folder icon. Other drawers, including the available-Home-surfaces
list and Bulletin, use distinct configured icons; their exact symbols remain
open.

### D-145 — Use Empty, Home, and Content as the three container presentations

- **Date:** 2026-09-02
- **Category:** system
- **Status:** superseded
- **Source:** CAP-168

Every view container uses one of three presentation kinds:

1. **Empty** shows the view-configured component or resource picker.
2. **Home** shows an app-style landing module and omits the resource-location
   row.
3. **Content** shows the owning presenter's content beneath an optional
   resource-location row when a file or comparable address applies.

The centered icon-and-title used when one surface stands alone and the
icon-and-title used as tab text share the same font and icon size. Their
position changes between centered and tabbed presentation, but their visual
scale does not. Below that shared identity chrome, the optional location row
and presenter-owned body follow the selected presentation kind.

D-154 supersedes this presentation contract by making the File Location and
Path rail mandatory for every tabbed Content presentation while retaining the
three presentation kinds and shared identity sizing.

### D-146 — Let view configuration choose any presentation as its default

- **Date:** 2026-09-02
- **Category:** system
- **Status:** superseded
- **Source:** CAP-168

Empty, Home, or Content may be the initial presentation for a view. Wiki
defaults to Content at the Wiki Guide, shows the applicable file location in
the second row, and navigates directly among Wiki content without a separate
Home depth. Capture and Tickets may set a Home default, using their landing-page
styling without the location row. A view's default, available Empty-tab
choices, drawers, and reachable presenters are configuration rather than
hardcoded limits tied to the view type.

D-173 supersedes the Empty/Home/Content presentation choice and its
chrome-specific consequences. It preserves configuration ownership only for
choosing a registered initial target versus Empty and for choosing available
launchers; tab count now determines the universal header.

### D-147 — Keep the app-launcher drawer limited to self-contained targets

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** superseded
- **Source:** CAP-168

The app-launcher drawer lists registered targets that open directly as Home or
Content and do not require their own sidebar. It does not list targets whose
landing state is Empty. Project Viewer may separately configure a Files drawer
and a Bulletin drawer, use its own Home as the default, and configure the
choices shown in Empty tabs. This gives Project Viewer a broad buffet of useful
surfaces while other views remain narrowly scoped through their own
configuration rather than hardcoded branches.

D-173 supersedes classification by Home/Content presentation kind. The
self-contained-target intent may be expressed later as registered loaded
targets that need no sidebar, while Empty and its configured selector remain a
separate initial or plus-created content choice.

### D-148 — Replace Capture and Ticket expansion with Open in New Tab

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-169

Capture and Ticket cards do not retain a separate fullscreen **Expand** action.
That control becomes **Open in New Tab** and submits the same typed open-target
request used by sidebar sources. The shared host first checks for an existing
tab with the same presenter and resource. If found, Fusion activates that tab
and asks its component to center or reveal the target. If no match exists, the
host creates a new Content tab. Capture, Tickets, previews, and sidebars do not
implement separate find, deduplication, or placement behavior.

D-173 supersedes only the `Content` shell-role wording in this active decision.
The resulting surface is a loaded tab using the explicit presenter and target;
the shared Open in New Tab behavior remains unchanged.

### D-149 — Keep preview policy separate from Content-tab presentation

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-170

Capture and Tickets retain their preview modes. Their full presentation is a
Content tab reached through **Open in New Tab**, not a separate fullscreen
state. Capture remains differentiated as a Note-like surface by opening its
preview on ordinary selection before the user explicitly requests the full
tab. Office documents may later use direct-to-tab behavior on ordinary
selection instead, bypassing the preview-first step.

Preview behavior belongs to the originating view and is not a fourth container
kind. Whether opening follows a preview or happens directly, the resulting tab
request uses the shared presenter-and-resource match: activate and center an
existing match, otherwise create a new Content tab.

D-173 supersedes only the `Content` shell-role wording in this active decision.
Preview policy remains separate, and its full presentation is an addressed
loaded presenter target under the universal header.

### D-150 — Treat tab-launching drawers as workspace chrome, not navigation

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-171

Configured drawer contents exist only to open tab targets, so they do not
retain a separate Nav styling category. The drawer surface uses Workspace
Background. Its ordinary chrome follows Workspace Chrome, and the button for
the currently open drawer uses Workspace Chrome Accent. Home or Wiki navigation
inside a launched content surface remains part of Content styling rather than
reintroducing drawer-level Nav theming.

### D-151 — Reduce Content settings to four controls

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-171

Content styling exposes **Background**, **Foreground**, **Accent**, and
**Content Contrast**. Content Contrast jointly attenuates headers, body text,
and content-derived borders instead of exposing unrelated controls for each.
Foreground supplies attenuated structural treatment for Home-page elements,
Wiki navigation, and comparable content-owned navigation. Accent supplies the
content emphasis and interactive color. The exact derivation formulas remain
an implementation concern, but the four-control product model is authoritative.

### D-152 — Make the right drawer push content and switch from its header icons

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-171

An open right-side drawer begins below the persistent global top header and
occupies layout width. The content container narrows and shifts left rather
than being covered by an overlay. The drawer's configured action icons remain
in the header, making the active accented icon read as the control at the top
of the open drawer. Clicking that active icon closes the drawer. Clicking a
different drawer icon switches the occupied region directly to the selected
drawer. Only one configured right drawer is open at a time.

### D-153 — Divide container styling between shell rows and presenter bodies

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** superseded
- **Source:** CAP-172

When a Home presentation is the only centered surface, its Home canvas fills
the entire view region beneath the global top header, including the area behind
the centered icon and title. Kanban and Capture Home can therefore carry their
configured background color to the top without introducing a separate header
band.

Once the worksurface is tabbed, the shared shell owns the tab rail and derives
its surface from the owning view's Content Background. The active presenter
does not restyle that shared rail. Beneath it:

- **Home** begins its presenter-owned Home styling immediately, with no
  location row.
- **Content** places an optional workspace-owned file or resource-location row
  first, then begins the presenter-owned Content body.
- **Empty** places the shell-owned picker directly below the tab rail.

D-154 supersedes this row-ownership contract while preserving its centered
Home and tabbed Home behavior.

### D-154 — Normalize every tabbed Content presentation under identical shell rails

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** superseded
- **Source:** CAP-173

Every container continues to use one of three presentation kinds: Empty, Home,
or Content. Their tabbed stacks are authoritative and distinct:

1. **Content** always presents a shell-owned Tabs rail, then a shell-owned File
   Location and Path rail, then the presenter-owned Content body.
2. **Home** presents the shell-owned Tabs rail and begins the presenter-owned
   Home body immediately beneath it, without a path rail.
3. **Empty** is entirely shell-owned and presents its configured picker beneath
   the Tabs rail.

Capture Markdown, Wiki pages, and File Explorer files therefore have identical
top rails when opened as Content. A view's Home default does not alter the
chrome of its individual Content tabs. When Home is the only centered surface,
its canvas still fills the view region beneath the global header, including
behind the centered identity. The centered identity and tab-strip label retain
the same icon and font size; only their placement differs.

D-154 supersedes D-145 and D-153.

This ownership rule preserves immersive centered Home surfaces while keeping
tab chrome and resource location consistent across hosted presenters.

D-173 supersedes this three-kind stack. Every active tab now receives the
location rail, while tab count alone determines centered identity versus the
ordinary tab rail.

### D-155 — Use Wiki, Capture, File Explorer, and Tickets as the reference presentations

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** superseded
- **Source:** CAP-174

The three presentations have distinct reference configurations and one shared
transition rule:

1. **Wiki is Content.** It has no Home presentation. It starts at the Wiki Guide
   as a visible Content tab, using the mandatory Tabs and File Location and Path
   rails, with the plus control immediately to the tab's right.
2. **Capture is Home.** It begins as one centered Home canvas whose background
   reaches the top of the container.
3. **File Explorer is Empty.** It begins with the shell-owned picker already
   visible as an Empty tab.
4. **Tickets is Home.** When added, it begins as one centered Ticket Home canvas.

When Capture opens a document or Tickets opens an expanded Ticket, the shell
reveals the tab rail and places the former centered Home at the left as a Home
tab. The Home body begins beneath Tabs without a path rail. The newly opened
document or Ticket is a Content tab and follows D-154 without view-specific
chrome. The same transition applies when plus introduces another tab to a Home
view.

Project Viewer's shared-host composition remains as defined by D-143, except
that its launcher targets the Wiki Guide as Content rather than a nonexistent
Wiki Home. The launched surface remains inside the current Project thread and
does not mount another thread list or nested view runtime.

D-155 supersedes D-143. D-136 and D-146 remain compatible and active; this
decision fixes their reference defaults and makes the Home-to-tab transition
explicit.

D-173 supersedes these reference presentation kinds and the assertion that
D-146 remains active. Wiki, Capture, File Explorer, and Tickets may still serve
as future adopter examples, but all use the same universal one-versus-many
header and active location rail.

### D-156 — Use Home as the control surface for productivity capabilities

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-175

Email, Calendar, and comparable productivity capabilities use the same Home-
to-Content pattern as Capture and Tickets while remaining grouped inside
Productivity Suite. Email begins as a centered Home surface. Expanding a draft
full-size reveals the tab rail, places Email Home first, and opens the draft as
an ordinary Content tab under D-154.

Email Home is the sole surface for browsing or opening another message and for
invoking Compose to create new mail. An expanded draft remains focused on that
item and does not become a second navigation or creation surface. Calendar and
comparable productivity tools may apply the same Home-to-Content division to
their own expanded items. This presentation choice does not give each tool a
separate left-navigation identity or thread population.

D-173 supersedes the Home-to-Content shell-role transition and the dependency
on D-154. The active product rule is landing-presenter to addressed-presenter
behavior: one tab is universally centered, and adding a draft reveals the
ordinary tab rail without replacing the landing tab.

### D-157 — Allow views to configure Email launchers without nesting Email

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-176

A view may configure an Email Inbox drawer whose rows open messages as Content
and may expose an action that opens Email Home as a hosted Home tab. Both use
the shared registered-target and find-or-open placement contracts. The calling
view remains the owner of the thread, shell, and saved worksurface; opening
Email does not mount Email's thread list or create a nested application runtime.

This is an instance of the general configuration model rather than a bespoke
Email integration. Other registered Home and Content targets can participate
through the same view-configured drawer and launcher boundaries.

D-173 supersedes only the Home/Content shell-role terminology. The active
contract remains that registered Email landing and addressed-message targets
may be hosted without mounting a nested Email view or thread list.

### D-158 — Keep reusable view plugins and templates inside protected System

- **Date:** 2026-09-02
- **Category:** system
- **Status:** superseded
- **Source:** CAP-177

The local reusable view library lives at
`ai/<machine>/System/plug-ins/views/` with this initial organization:

```text
view-templates/<type-name>/
app-home-displays/<module-id>/
content-tab-displays/<module-id>/
sidebar-modules/<module-id>/
```

View templates contain copyable configuration for creating or adapting view
instances. Home displays, Content-tab displays, and sidebar modules are reusable
definitions referenced by stable identity from view configuration. Instantiated
view capsules remain under `ai/<machine>/System/Views/`; the source library and
live instances do not become one mutable folder.

Right-click Add View, Duplicate View, and `+ Project` consume the library
through Fusion's validated creation service. Folder presence alone does not
register, authorize, or activate a plugin or module. The System Manager catalog
remains the distribution source, and the local System library remains subject
to the Provenance-backed registry, permission, and consent model. As that
foundation matures, existing built-in views can be progressively represented
as configuration over the reusable library.

D-159 supersedes this intermediate layout by making the plugin library itself
a view capsule under `System/Views/`.

### D-159 — Make the Plugins view the protected plugin source of truth

- **Date:** 2026-09-02
- **Category:** system
- **Status:** superseded
- **Source:** CAP-178

The local plugin source and the Plugins view are the same protected folder:
`ai/<machine>/System/Views/plug-ins/`. It carries the ordinary capsule identity
and configuration required to appear as a view, while its contents are the
inspectable source of truth for local plugin definitions and templates.

Its initial view-composition library is:

```text
views/view-templates/<type-name>/
views/app-home-displays/<module-id>/
views/content-tab-displays/<module-id>/
views/sidebar-modules/<module-id>/
```

The `views/` subtree is the first defined family inside the Plugins folder;
other plugin families may live alongside it as their own contracts are settled.
Other live view capsules reference these reusable definitions by stable
identity. Add View, Duplicate View, and `+ Project` consume them through
Fusion's validated creation service. The Plugins folder is authoritative for
the reusable local definitions, each instantiated view capsule is authoritative
for its own configuration, and the database registry remains authoritative for
registration, activation, permissions, and consent. The System Manager
workspace supplies its distribution catalog through the same Plugins-view
shape. Folder presence alone grants no execution authority.

D-159 supersedes D-158.

D-164 supersedes D-159 by separating the Plugins view capsule, the locked
Browse catalog, and the installed-plugin root.

### D-160 — Treat templates and interface modules as dependent plugins

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-179

Templates, Home presenters, preview presenters, Content presenters, and drawer
modules are first-class plugins and may declare dependencies on one another.
Higher-level offerings compose them rather than privately copying their
implementations.

**Code Space** is the reference aggregate plugin. It requires File Tree Drawer,
File Editor Content tab, Capture Home, Capture Content tab, Wiki Content tab,
and the templates needed for the complete view. Dependency resolution does not
bypass registration, compatibility checks, permission review, or consent.

### D-161 — Reuse Capture Home and Ticket card behavior for Plugins

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-179

Capture Home establishes a reusable layout with introductory text followed by a
one-folder-deep hierarchy rendered as a scrolling card grid. First-level folders
become sections and their files become cards. Card width and display treatment
are configurable.

Plugins Home reuses that layout and gives its cards Ticket-like optional preview
and full-tab behavior. A Plugin Content tab uses one Markdown document for its
descriptive body, displays basic switches and a browsable source folder beneath
it, and opens selected source files in other tabs through the File Viewer Content
presenter. Reusing a layout does not merge its data source or permissions; the
same rule permits an Email-inbox layout to present an Issues inbox.

### D-162 — Configure views as an optional presentation chain

- **Date:** 2026-09-02
- **Category:** system
- **Status:** active
- **Source:** CAP-179

A view or plugin configuration can select an optional Home presenter, an
optional preview presenter, the registered presenter used when an item opens in
a tab, its data source, and its permissions and dependencies. The exact field
names and schema remain open. The unfinished “opens in tab as” choice is a
presenter reference, not a requirement that every expanded item use one global
renderer.

### D-163 — Keep selective post-duplication copying conversational

- **Date:** 2026-09-02
- **Category:** experience
- **Status:** active
- **Source:** CAP-179

Duplicate View does not need to encode every possible selective-copy workflow.
If a duplicate starts from template defaults and the user wants selected settings
or behavior from another view, the assistant can use the injected System
hierarchy to compare the inspectable capsules and guide the user through Fusion's
validated configuration UI. The assistant does not receive direct write access
to protected System files.

### D-164 — Separate locked Browse from sideloadable installed plugins

- **Date:** 2026-09-03
- **Category:** system
- **Status:** active
- **Source:** CAP-180, CAP-181

The Plugins view capsule remains under `ai/<machine>/System/Views/`, but it is
not itself the installed-plugin source. **Browse** reads a locked, curated
catalog of Fusion-approved, text-oriented plugin packages from SQLite.
Installed package files are materialized or discovered under
`ai/<machine>/System/plugins/` and remain inspectable as ordinary folders.

Browse is a trust and provenance channel rather than a general folder listing.
Only packages admitted through Fusion's approved catalog process appear there;
users and external bundles cannot add entries merely by copying files. A user
may download, receive, author, or share a compatible folder containing a view,
workflow, Agent Profile, or other plugin resources and drag or copy it into
the installed-plugin root. Fusion treats that package as sideloaded and does
not confer Fusion-approved provenance on it.

Catalog presence and folder presence remain distinct from execution authority.
Browse scripts are inert data, and a sideloaded folder is only discovered until
Fusion validates and registers it and the user grants the required permissions
and consent. Sideloaded plugins can become functional through that explicit
path, but they never enter locked Browse or acquire its approval designation
solely because they were installed.

D-164 supersedes D-051 and D-159 while preserving D-050's System Manager
repository as the approved upstream distribution source.

### D-165 — Make Plus Browse-only and sideloading filesystem-only

- **Date:** 2026-09-03
- **Category:** experience
- **Status:** active
- **Source:** CAP-182

Clicking `+` in Plugins opens the plugin Browse overlay backed by the locked
SQLite catalog. That interaction is the approved installation channel. Fusion
does not add a visual sideload command, source picker, import flow, or approval
badge.

To sideload, the user drags or copies a compatible folder into
`ai/<machine>/System/plugins/` through the filesystem and then provisions its
settings. Registration, permission review, consent, and activation rules still
apply. Browse membership itself communicates that a package came from the
approved channel; packages outside Browse do not require an additional badge.

### D-166 — Scope the first Tabs as Containers SPEC to the generic host

- **Date:** 2026-09-03
- **Category:** system
- **Status:** active
- **Source:** CAP-183

The first Tabs as Containers SPEC builds directly on the completed Universal
View Tab Bar foundation. It adds only the generic ability for a tab container
to hold a component and defines the lifecycle of a newly created empty tab.
It does not relocate or convert view folders, introduce plugin-backed
configuration, build plugin installation, or extract chat. The resulting host
contract is the prerequisite consumed by the following chat-extraction and
Side Chat work.

## Process and Governance

### D-167 — Complete Provenance before declarative view and plugin conversion

- **Date:** 2026-09-03
- **Category:** process
- **Status:** active
- **Source:** CAP-183

Do not refactor existing views around an interim plugin or dynamic-configuration
system that will be replaced when Provenance lands. The generic component-tab
host may expose a narrow registration or resolution seam now, but full plugin
behavior and conversion of existing views to declarative component assemblies
wait until Provenance supplies the authoritative registration, validation,
permission, and trust foundation. This sequencing avoids migrating views twice.

### D-168 — Separate generic tabs, composable chat, and Move to Side Chat

- **Date:** 2026-09-03
- **Category:** process
- **Status:** active
- **Source:** CAP-184

Retire the earlier combined Composable Threaded Chat and Move Chat to Side Chat
document as an executable bundle. Preserve it only as requirements provenance.
The active implementation sequence is three independently judged domains:

1. Generic Component Tab Host and Empty-Tab Lifecycle;
2. Composable Threaded Chat Module, including one-member view-bound groups and
   content-only worksurface continuity; and
3. Move Chat to Side Chat, which adds the multi-member transition and Side Chat
   tab placement only after both prerequisites are accepted.

Pending New Chat remains the normative sub-SPEC inside Composable Chat after its
group commit primitive exists. View-Configured Thread Collections depends on
Composable Chat but not on Move Chat to Side Chat. Neither later SPEC may absorb
generic empty-container lifecycle, plugin/view configuration, or Provenance.

### D-124 — Prefer single-domain implementation SPECs

- **Date:** 2026-09-02
- **Category:** process
- **Status:** active
- **Source:** CAP-151

When a prospective implementation bundle crosses materially different ownership,
risk, or verification boundaries, split it into focused SPECs with explicit
dependencies. This gives each implementation orchestrator and reviewer one
coherent domain to judge. Shared groundwork should become its own prerequisite
instead of being duplicated or hidden inside a later feature SPEC.

### D-127 — Make tab containers a prerequisite for Send to Side Chat

- **Date:** 2026-09-02
- **Category:** process
- **Status:** superseded
- **Source:** CAP-156

Peel generic tab-container and empty-tab launcher work out of modular chat and
treat it as a separately judged prerequisite for **Send to Side Chat**. The
chat component may consume the resulting host contract, but it does not define
generic container creation, the view-configured launcher, or the broader
component catalog.

D-133 supersedes this narrower statement. Tabs as Containers is a hard gate for
**Move Chat to Side Chat** itself, as well as for later Send to Side Chat flows.

### D-133 — Make Tabs as Containers a hard gate for Move Chat to Side Chat

- **Date:** 2026-09-02
- **Category:** process
- **Status:** active
- **Source:** CAP-161

Generic tab containers are a separately owned domain being specified outside
the threads work. The threads implementation may build its group model,
reusable chat surface, runtime isolation, and content-state foundations, but it
must not begin or ship **Move Chat to Side Chat** until the Tabs as Containers
SPEC is implemented and independently accepted. The Side Chat feature consumes
that stable host contract; it does not absorb generic container creation,
empty-tab behavior, launchers, component registration, or container lifecycle
into the threads domain.

### D-169 — Separate capsule control-plane migration from thread collections

- **Date:** 2026-09-03
- **Category:** process
- **Status:** active
- **Source:** CAP-185

Apply D-124 to the earlier View-Configured Thread Collections bundle. The
**System View Capsule Control-Plane Foundation** exclusively owns canonical
`System/Views` path resolution, journaled quiescent relocation, registry
cutover, and protection of Fusion-owned generic file mutation routes. The
reduced **View-Configured Thread Collections** SPEC consumes that accepted
foundation and owns effective thread presentation configuration, ranked
collection assignments, synthetic Archive behavior, filtering, and the shared
thread-row menu.

Both follow Composable Threaded Chat because it establishes stable view identity
and trusted-shell mutation authority. Collections remains independent of Move
Chat to Side Chat. Workspace/view prompt composition is a separate future SPEC
and is not absorbed into either domain.

### D-170 — Accept the Generic Component Tab Host implementation

- **Date:** 2026-09-03
- **Category:** process
- **Status:** active
- **Source:** CAP-186

Accept the implementation and review evidence recorded in
`../002-SPECs/GENERIC_COMPONENT_TAB_HOST_ORCHESTRATOR_REPORT.md`, including its
deliberate lack of a production adopter and its compatible defensive
deviations. Commit and publication remain separate actions; acceptance does not
claim that the current working-tree implementation is already an immutable
repository baseline.

### D-171 — Finish the owner-defined tab platform milestone before Chat

- **Date:** 2026-09-03
- **Category:** process
- **Status:** active
- **Source:** CAP-186

Do not begin Composable Chat implementation merely because the Generic
Component Tab Host is accepted. Complete and accept the remaining owner-defined
tab platform milestone first, including the shared presentation and placement
foundations and whatever control-plane/configuration and first-party adoption
packages are later named as part of that milestone. Reconcile Chat with the
accepted Tabs and Provenance contracts only after that gate is explicit.

### D-172 — Accept the Tab Shell Presentation Foundation implementation

- **Date:** 2026-09-04
- **Category:** process
- **Status:** active
- **Source:** CAP-187

Accept the implementation and review evidence recorded in
`../002-SPECs/TAB_SHELL_PRESENTATION_FOUNDATION_ORCHESTRATOR_REPORT.md`,
including its reviewed repairs, compatible deviations, deliberate lack of a
production adopter, and authorized verification deferrals. The aggregate hash
discrepancy is bookkeeping rather than a product or branch failure; the owner
accepted the current working-tree bytes after the integrated tests, TypeScript,
targeted lint, production build, and whitespace validation passed again.
Commit and publication remain separate actions. Tab Target Placement is the
next independently specified Tabs package.

### D-173 — Use universal tab identity and location chrome

- **Date:** 2026-09-04
- **Category:** experience
- **Status:** active
- **Source:** CAP-188

Every worksurface with one tab displays that tab's short name and view icon as
centered shell identity. With multiple tabs, the ordinary tab rail presents the
same identities. Every active tab then displays a second breadcrumb-style
location row on shell background, with optional presenter-owned Back and
Forward controls before it. That row defaults to 150 percent of the top row's
height.

Landing or “Home” behavior is no longer a shell layout kind. It is ordinary
presenter behavior that may offer previews or internal navigation and supplies
its own meaningful location, such as `Capture Documents and Artifacts`.
Addressed Capture content may display `Capture > Collection > Name`, and Empty
supplies a neutral location identifier. Breadcrumb strings and policies such as
omitting Wiki `PAGE.md` are display-only; exact placement continues to use full
explicit presenter and target identities. A corrective TABS-02A SPEC precedes
Tab Target Placement.

### D-174 — Finish the view platform with relocation and configured adopters

- **Date:** 2026-09-07
- **Category:** process
- **Status:** active
- **Source:** CAP-189

Before beginning the Tabs↔Provenance bridge or Composable Chat, complete two
focused, dependency-ordered view-platform SPECs. First move complete view
capsules into canonical `ai/<machine>/System/Views/` through a journaled,
quiescent control-plane cutover. Then let relocated view configuration select
safe code-owned initial/Empty tab behavior and adopt the accepted generic tab
platform in Capture and File Explorer. The second package requires an explicit
owner visual acceptance. Side Chat, dynamic plug-ins, thread storage, prompts,
and Bridge events remain outside both SPECs.

This supersedes only D-169's former sequencing statement that the capsule
control-plane migration follows Composable Chat. D-169's domain split and
control-plane ownership remain active.

### D-047 — Use Provenance as the project name

- **Date:** 2026-08-23
- **Category:** process
- **Status:** active
- **Source:** CAP-078

The related registry-enabling project is named **Provenance**. This latest owner clarification is authoritative.
