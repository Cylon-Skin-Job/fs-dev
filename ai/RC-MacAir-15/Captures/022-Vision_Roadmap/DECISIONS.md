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
- **Status:** active
- **Source:** CAP-023

Fusion Home's left navigation is grouped as follows:

1. Issues, including its inbox; and Projects, represented by individually created Project Viewer entries and formerly framed as one Launchpad/Project Manager surface.
2. Office Suite; Productivity Suite; Health & Fitness Tracker; and Recipes, Meal Tracker & Shopping List.
3. Wiki; File Explorer; and Browser.
4. Agent Profiles under a brain/node-network icon; and Settings Manager under a gears icon.

Exact labels and the Office Suite's internal presentation-builder naming can be refined later without changing the grouped direction.

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
- **Status:** active
- **Source:** CAP-081

Fusion's local Plugins viewer points to configuration in the registered System Manager workspace. Those declarations generate the relevant UI controls; the local viewer does not maintain a second independent catalog.

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

## Process and Governance

### D-047 — Use Provenance as the project name

- **Date:** 2026-08-23
- **Category:** process
- **Status:** active
- **Source:** CAP-078

The related registry-enabling project is named **Provenance**. This latest owner clarification is authoritative.
