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

Navigation and thread identity are also being reorganized around views. The current right-side navigation will move to the left beside the thread list. Threads, currently workspace-wide, will become bound to individual views. Chat, threads, and content are independently presentable parts of the shell: without chat, the thread list becomes a menu of saved content-worksurface states; without chat or threads, the view becomes a full-screen app. Each thread preserves only the content worksurface state needed to resume its work, including tabs, documents, locations, selections, and scroll positions. New tabs are generic containers for components rather than chat-owned surfaces. When a new thread has no saved worksurface, its view configuration chooses only the initial container content: load a registered landing/view target or begin Empty. Tab count universally determines centered versus tabbed identity, so configuration does not select alternate chrome for that first container. New Thread itself does not know which content choice the view made. The same configuration declares whether tab addition is available and which selector buttons appear. Every later `+` action has one behavior: open another empty selector container. Domain creation controls stay inside landing modules rather than becoming tab-launcher effects. Sidebars, landing modules, previews, and similar navigation sources can all ask the shared tab host to open a typed resource in the current tab or a new tab. Before applying either placement, the host checks the target's stable identity; if it is already open, Fusion activates that tab and asks its component to reveal or recenter the resource instead of opening a duplicate. **Open in Current Tab** is a non-destructive preference: if no match exists, Fusion fills the current tab only when it is empty and otherwise creates a new tab. A non-empty tab is never replaced by this flow. The target also identifies the view-owned presenter responsible for the resource rather than asking the tab host to infer appearance from a filename. Capture's landing surface is its own module, and Markdown opened from Capture uses Capture's rendered presentation. File Explorer uses its fullscreen syntax-highlighted file display and editor. Wiki links bypass popups: a right-click tab action opens an in-scope page with the Wiki presenter, while a file outside the Wiki root opens through File Explorer's single-file presenter without the File-tree drawer. This lets File Explorer use its File tree as a sidebar picker, lets Capture open a selected item from its landing surface in a new tab without a sidebar, and lets a Project Manager Bulletin sidebar open claimed work in new tabs while returning to an existing match. Project Viewer combines these ordinary capabilities into a unified workspace through its view configuration: slide-out launcher options can open the Wiki Guide, Capture landing surface, Browser, and other registered presenter targets in tabs, while linked files open beside them through their assigned presenter. The Project thread and its current chat remain the owning shell context. Project's broad catalog is a configured product privilege, not a separate tab system or nested-view runtime. Configured drawers receive individual right-edge icons instead of sharing one generic drawer control, and those controls reuse the top workspace header's action sizing and spacing. Files uses a folder icon; other drawer icons remain semantically specific and configurable. This container/launcher foundation is separate from modular chat and must exist before Send to Side Chat can place a chat component in a new tab. An assigned folder can anchor that worksurface without becoming a hard filesystem or reasoning boundary. View configuration defines the folder/tag choices in the thread dropdown, while thread metadata always retains multiple stable, ranked collection IDs. The default folder mode projects the highest-ranked valid assignment; optional tags mode projects them all. Changing folders raises a rank without discarding dormant memberships. A non-removable Archive collection catches any thread with no currently valid assignment, and its button clears all assignments instead of setting a separate archive status.

The tab-container presentation now uses one universal two-row shell rather than Home and Content layout kinds. With one tab, the first row centers that tab's short name and view icon; with multiple tabs, the same identity appears in the ordinary tab rail. Every active tab then receives a second, breadcrumb-style location row on shell background before its presenter body begins. Optional Back and Forward controls sit before that breadcrumb and remain owned by the active presenter. Landing surfaces, addressed documents, and Empty tabs all provide a human-readable location: Capture may show `Capture Documents and Artifacts` for its landing surface and `Capture > Collection > Name` for an opened document, while Empty can show a neutral identifier such as `New Tab`. These strings are display only; stable placement continues to use explicit presenter and target identities. A future Wiki flag may omit `PAGE.md` from the displayed breadcrumb without changing the full target. “App Home” is therefore ordinary presenter behavior distinguished by previews or internal navigation, not a special shell mode. A view's future configuration chooses whether its first container loads a registered view target or begins Empty, but tab count alone controls centered versus tabbed identity and the location row is universal.

The generic component-tab host, Empty reservation/fill lifecycle, and first
Tab Shell Presentation Foundation have been implemented, independently
reviewed, and accepted by the owner, while remaining uncommitted and
deliberately unused by production views. Before target placement, a corrective
TABS-02A package now replaces downstream use of the role-specific Home/Content
presentation with the universal identity-and-location shell. Empty remains
lifecycle state, landing behavior belongs to presenters, and one-versus-many
layout remains derived without changing tab or component identity. Chat
remains held until the owner-defined tab platform milestone is complete.
Typed target placement and its Provenance-facing controller chokepoint follow
the correction; declarative view configuration and production view adoption
still wait for the registration/permission control-plane foundation.

Email, Calendar, and comparable productivity capabilities will use the same landing-presenter pattern without changing the decision to group them inside Productivity Suite. Email begins with one landing surface and therefore receives the universal centered single-tab identity. Expanding a draft full-size reveals the tab rail, preserves the Email landing tab, and opens the draft as another loaded presenter target. The landing surface remains the only place to browse or open another message and to invoke Compose for new mail; the expanded draft tab is focused on that item rather than becoming another navigation or creation surface. Calendar and similar tools can apply the same landing-to-addressed-content division to their own domain items.

The same primitives make productivity capabilities selectively composable across other views. A view can configure an Email Inbox drawer whose rows launch message targets, and it can expose an action that opens Email's landing presenter in a tab. The host view retains its thread, shell, and saved worksurface; it does not mount Email's thread list or navigate into a nested application. Drawer sources, registered landing and addressed targets, and shared find-or-open placement therefore provide broad configurability without adding a bespoke Email tab system.

Because configured drawers exclusively launch tab targets, they no longer form a separately themed navigation system. The drawer shell uses Workspace Background, its ordinary controls follow Workspace Chrome, and its active icon uses Workspace Chrome Accent. Content styling reduces to four controls: Background, Foreground, Accent, and Content Contrast. Contrast jointly attenuates headers, body text, and content-derived borders, while Foreground attenuates structural content such as Home navigation or Wiki navigation. An open right-side drawer occupies layout space below the global top header and pushes the content container left rather than overlaying it. This makes the drawer's icon appear at its top in the unchanged header row. The active accented icon closes its drawer when clicked; another drawer icon switches the occupied region directly to that drawer.

Capture and Tickets retain their preview modes but no longer need a separate fullscreen expand path. Their existing expand controls become **Open in New Tab** actions that submit the same typed open-target request used by sidebars. The shared host first looks for an existing presenter-and-resource match and activates and centers it; only when no match exists does it create another loaded tab. Capture remains differentiated as a lightweight Note experience by previewing on ordinary selection before the user explicitly opens the full tab. Office documents can later adopt direct-to-tab behavior, where ordinary selection invokes the same operation without a preview-first step. Preview policy therefore belongs to the originating view, while every full presentation is a registered presenter target and every tab-opening source shares one deduplicated placement behavior.

The downloaded product will open with **Fusion Home** as its default folder. Users can add more specialized workspaces for code, bookkeeping, media production, research, or system management. Fusion Home adopts an “everything is a plugin” direction and presents a grouped left navigation spanning attention and project management, office and personal-productivity suites, health and household domains, core knowledge and browsing surfaces, extensibility tools, and settings. Lower-density capabilities such as email, calendar, tasks, notes, and contacts move from separate app identities into a consolidated Productivity Suite so thread binding occurs at a useful level of activity.

Conversation creation is now deliberately thin. Alongside Link and Send to Chat, content can start a new conversation or be sent into a side chat hosted as a content tab. A side chat remains a distinct conversation and can continue prior work through a bounded handoff prepared from the earlier chat. Starting or opening a chat consumes an already-registered view context and never creates project folders, routine folders, or starter content. Fusion waits for the harness-side identity or accepted creation result before registering the durable conversation. Project, Routine, Agent Profile, and Plugin creation remain explicit domain actions rather than alternate labels for a filesystem-writing New Chat operation.

View capsules form a machine-scoped control plane under `ai/<machine>/System/Views/`, while each capsule's declared content root remains independent and may live inside the machine AI tree or in a Git-tracked workspace folder. A workspace-level folder in System mirrors the orientation and configuration structure used by the view capsules. It provides the inherited base and explains how to navigate the workspace; the active view capsule specializes that base and explains how to navigate the view. The workspace README makes the whole convention self-describing by explaining the folder layout, inheritance order, prompt assembly, configuration locations, and navigation paths. Prompt assembly follows the same visible hierarchy: Fusion supplies the workspace `prompt.md` first, appends the active view's `prompt.md`, and passes the combined result through the configured harness/provider request. RC expects an OpenRouter request setting to support this combined system context, but the exact adapter field remains to be verified when implementation is scoped. Their versioned JSON is the canonical configuration used by both purpose-built GUI editors and direct user editing, making view definitions and component assemblies portable and clonable. Every capsule also carries a readable `README.md` that orients the active assistant to the view. A short common footer at the end points to the canonical configuration and view prompt, explains that sibling view capsules share the same navigable tree, and describes the read-only script used to list them. The assistant can then inspect another view's README, prompt, configuration, and declared source folder when the conversation needs cross-app knowledge, without loading every view into every prompt. A small shared System Wiki supplies the wider Fusion Studio and capability map, and view-panel packages contribute their own discoverable Wiki entries in the same repository. Portability does not transfer authority: imports and clones receive new identities and omit secrets, permission grants, consent, sessions, thread history, and local runtime or view state. The target protected-System policy lets the configured harness read effective configuration and guidance, run the bounded discovery needed to list and inspect views, and guide the user, but reserves mutation for validated, user-mediated Fusion services. New-thread creation likewise requires a verified user action or separately user-authorized automation. The folder placement establishes the architecture; a later security implementation must enforce the boundary across every write path.

The Plugins experience now separates three things that had briefly been combined. Its view capsule remains under `ai/<machine>/System/Views/`; its locked Browse surface queries a curated SQLite catalog of Fusion-approved text-oriented packages; and its inspectable installed source lives under `ai/<machine>/System/plugins/`. The System Manager repository remains the approved upstream distribution source, while the registry remains authoritative for registration, activation, permissions, and consent. Clicking `+` in Plugins opens the Browse overlay and therefore enters the approved installation channel. A user may also download, author, receive, or share a compatible folder containing a view, workflow, Agent Profile, or other plugin resources and drag or copy it into the installed root. Fusion offers no visual sideload action and no approval badge. Folder presence permits discovery but not execution and never adds the package to Browse. After placement, the user provisions its settings and completes the applicable registration, permission, consent, and activation steps. Right-click Add View, Duplicate View, and `+ Project` consume only registered definitions through validated Fusion paths, and later Provenance work can help reduce more built-in views to declarative configurations over the same system.

Templates and interface modules are themselves plugins and can declare dependencies on one another. A high-level **Code Space** offering can therefore require the File Tree Drawer, File Editor Content tab, Capture Home, Capture Content tab, Wiki Content tab, and its associated templates rather than duplicating each implementation. The Plugins Home can reuse a modular Capture Home layout: introductory text above a one-folder-deep hierarchy in which first-level folders become sections and files become cards in a scrolling grid. Card width and presentation remain configurable. Plugin cards borrow the Ticket interaction pattern, allowing a preview before opening a full Plugin Content tab. That detail presentation uses one Markdown document for its descriptive body, exposes basic switches and the plugin's source folder beneath it, and opens source files in additional tabs through the File Viewer Content presenter. The same reusable Home and list presenters can cross domains—for example, an Email-inbox layout can supply an Issues inbox—without merging their data or permissions.

The emerging declarative chain is: an optional Home presenter, an optional preview presenter, a selected presenter for the expanded tab, then the data source and permissions or dependencies the surface requires. Exact field names and the unfinished choice behind “opens in tab as” remain for the configuration contract; it is a presenter reference rather than one universal renderer. Duplicate View does not need an exhaustive selective-copy dialog. If an instance starts from defaults and the user wants selected behavior from another view, the assistant can use the injected System hierarchy to compare the inspectable configurations and guide the user through Fusion's validated configuration UI without receiving direct write access to protected System files.

This split also creates an explicit trust boundary. Browse is locked: arbitrary local or downloaded folders cannot write into it or make themselves appear Fusion approved. The installed root is intentionally open to both validated catalog installations and user-controlled filesystem sideloading, preserving the ability to share a view, workflow, Agent Profile, or other folder-shaped capability directly. The UI does not need badges to restate the distinction: Browse is the approved channel, while folder dragging occurs outside the Plugins interface. Both routes use the same plugin contract after discovery. Scripts stored in the catalog or found in a sideloaded folder remain inert until the relevant validation, registration, permission review, and authorization complete.

Inside Issues, inbox items can expand in place or open into the full content area. Any item can start a new chat. Once a ticket has a view-bound thread, selecting that thread restores the exact ticket content in the Issues area and lets the user watch its work evolve. This creates a user-in-the-loop form of background agency: tickets may be generated automatically and queued, the user can choose when to run them, and an agent can monitor the inbox and surface significant changes rather than requiring constant manual inspection.

Heartbeats give that monitoring a persistent, thread-visible control. A `pulse_alert` icon appears in the user input area between the plus button and Access permissions only after a heartbeat has been configured. Initial setup begins from the plus button; once configured, the pulse icon provides direct access. A user can ask the AI to monitor something and allow it to establish its own heartbeat. The heartbeat can watch explicit variables or filter the opt-in notification changes associated with a thread, wake when a relevant change occurs, restart or adjust a process, append behavior or information to the open inbox item, and return to sleep. The same pattern can watch long-running project processes such as a multi-day web scraper.

Scheduled work and assignment use tickets as the universal work object. The Scheduled area has a calendar and is intended to support cron scheduling plus arbitrary ticket content. A scheduler can instantiate a saved ticket template into **In Progress**. Any ticket entering In Progress is automatically assigned: an automation performs the equivalent of Send to New Chat and Send, creating the ticket thread on the left without moving the user's current focus. Users can produce the same transition by dragging a ticket into In Progress or using Assign in To Do. Organic creation, manual assignment, calendar/cron schedules, and trigger events therefore converge on the same ticket-and-thread flow, eliminating the need for Background Agents as a separate product category.

The **Agent Profiles** view is a way to discover, define, and invoke capabilities already available through the configured harness rather than a system for managing persistent agent beings. A profile can be selected from the plus button, named in ticket frontmatter, loaded automatically as a workspace default, or invoked by another agent or workflow as a subagent. Profiles can range from lightweight orientation and tool awareness to elaborate gated workflows with role-specific subagents and validation. The governing philosophy is that the profile is a frozen capability container—a mask a thread wears when that set of abilities is needed. Schedules and triggers live outside the profile; durable state belongs to the ticket, workflow, project state, or event history; the user interacts with the work and its thread rather than managing an agent entity.

The surrounding view family is becoming more concrete. Routines presents an n8n-like semantic graph of triggers, scripts, heartbeats, reasoning steps, applications, and outputs backed by an inspectable `triggers.md` and supporting files. Its visible assistant explains the graph and available capabilities instead of representing an invisible persistent agent. After Provenance, installed and authorized schedules, file changes, derived folder conditions, script state, heartbeat intervals, and plugin outputs can wake the routine. Short work may wait inline; long work can sleep, wake to inspect and repair, rerun when needed, and sleep again. Routines can combine JSON, scripts, regex, file matching, AI synthesis, inbox reports, files, and tickets. Linking one routine to another remains a proposal pending loop, permission, and failure semantics.

Projects use the ordinary view model rather than an upper-level Project Manager exception. The side-navigation plus opens a name-and-icon pop-up, clones the registered universal project template into the default Projects location, registers the folder as a Project Viewer, and places it above the plus and divider. Ordinary apps follow beneath; Routines and Plugins occupy a lower group after a gap. Conversation creation performs none of this domain work.

The universal project template begins with four carefully shaped Markdown files and points to the available patterns for adding more files and subfolders as the work earns them. Project Viewer's frontmost tab is the folder itself: a left-side navigator places Markdown files above subfolders such as Transcripts and Research for rapid scanning and jumping. A slide-out bulletin preserves quick situational awareness, while the same bulletin remains inspectable as JSON in the folder view. This folder-and-guidance pattern can work in other folder-backed contexts.

Project Viewer adds the exceptional ability to host other views and arbitrary project-relevant surfaces as header tabs. Tools, previews, research surfaces, and side agents can remain gathered around the project. Multiple visible threads share the project folder; each can contain a main chat and peer side chats. Relevant Skills and semantic orientation turn this ordinary composition into Launchpad by default rather than requiring a bespoke Launchpad runtime. A side agent remains visible within the project's thread family and uses an Agent Profile as a temporary capability mask.

The existing Capture product surface will be renamed **Project Manager**. Its left-side plus asks for the folder name and icon, then creates and registers the resulting folder-backed view. This preserves Capture's useful note-taking, riffing, and brain-dump character while making the project role explicit; there is no separate promotion from Capture into Project Manager. Each bound view has configuration that contributes view-specific system guidance to its conversations. That configuration behavior is already being shaped in the in-progress SPEC and is only cataloged here, not redesigned.

Settings follow the same plugin philosophy. Fusion's core provides useful but deliberately compact per-workspace palette controls: primary and secondary colors plus a handful of sliders. Installing a **Theme Customization** plugin adds a Custom mode between Light and Dark, granular color pickers, and context-menu entries for deeper control. Other plugins can enable Inbox Alerts, Heartbeats, Auto-Rename Chat Threads, or a Wiki Maintainer assembled from ticket schedules, Agent Profiles, triggers, and durable state. The auto-rename plugin owns deterministic attachment and ticket rules as well as optional LLM-assisted naming, keeping that policy outside the core conversation component. Plugins are folder-based bundles of Markdown, scripts, configurations, regex, and related resources. Installed plugins appear as sectioned browser-extension-style cards with right-side switches for trigger and output permissions. Plugins may request reusable dependencies such as local model weights, but downloads and activation remain explicit. The speech-to-text example composes microphone audio, reusable local STT weights, an editable regex formatter, and the chat input; video transcription can reuse that resource while requesting additional voice and timestamp capabilities.

Plugins can also extend Wiki into personal-context surfaces. **Context Manager** is a planned semantic and indexable history that can include basic user data. It may appear as a second Wiki tab or as another Wiki type; that presentation remains open. **User Profile** is another candidate Wiki variant. Any extraction feeding these surfaces is opt-in, and the user retains control over what the system records and what it surfaces back into product context.

Plugin availability and execution are consent-gated through a future database registry tied to the related Provenance work. The registry drives the plugin UI and distinguishes an installed, registered, consented capability from an arbitrary folder on disk. An unregistered folder must not become runnable merely because it was downloaded or placed in a plugin location.

**System Manager** is the bootstrap exception and prerequisite. It is distributed as a repository that Fusion downloads and registers as a workspace before any other plugin can be installed. That workspace contains a fully developed System Wiki and the plugin catalog in its Plugins folder. Fusion's local Plugins viewer remains deliberately thin: it points to the System Manager workspace's configuration catalog, derives user-facing controls from those configurations, and uses the database registry as the authoritative activation and permission state. Toggle changes are written through to configuration. If configuration grants a permission that the registry does not, the server removes that grant from configuration; the database's recorded authority wins rather than treating configuration as a second consent path.

The work should remain at the level of broad product behavior and conceptual systems. Where relevant, it will catalog systems that already exist and roughly explain how the vision connects to them. It will also describe systems that may need to be built in terms of their purpose, responsibilities, relationships, and open questions. It should not descend into file-level change analysis, detailed architecture prescriptions, delivery sequencing, or implementation planning.

This capture is expected to branch into many future roadmaps and SPECs. The working title does not mean that this folder is itself a roadmap. Its job is to establish a coherent umbrella vision, keep cross-cutting relationships visible, and make later bounded planning efforts possible without forcing the whole product direction into one monolithic implementation plan.

The current documented chat architecture is thread-centered and server-owned: durable identity belongs to the thread, live routing uses `threadId`, completed exchanges hydrate from SQLite, and the renderer presents server-owned state. That is current-system context, not a constraint that predetermines the future vision. Later conversation can identify which existing concepts remain useful, which need to evolve, and which broader system relationships are missing.

The inferred phase is **framing and shaping**. The first implementation SPEC covers the composable conversation/thread foundation. The earlier second SPEC has now been split under the approved single-domain rule: System View Capsule Control-Plane Foundation owns relocation and Fusion-route protection, while View-Configured Thread Collections owns only effective collection configuration, persistence, and thread-list/menu behavior. Workspace/view prompt composition remains a separate future SPEC. The current conversation is broader product shaping for Project Manager, Launchpad-as-composition, Routines, heartbeats, and plugin resources; it does not itself authorize those other implementation changes. Template contents, Capture rename/migration, bulletin authority, hosted-tab lifecycle, routine loops, and permission detail remain open for later bounded work.

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
- **Summary:** Continue with the intended Thread Management behavior that will govern view-bound threads. The content-to-new-chat and ticket-agent path is now defined, while rules for creating new daily threads, resuming earlier ones, coexistence, and other lifecycle behavior remain open.
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

### CAP-119 — Shape the view family around composable conversations

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Routines, Agent Profiles, Plugins, and Project Manager host-surface description on 2026-09-02
- **Summary:** Continue shaping the views that motivate the composable conversation model: Routines as inspectable semantic automation graphs with visible assistants; Agent Profiles as invoked capability masks; Plugins as permission-bearing cards with reusable dependencies; and Project Manager as the renamed Capture surface that creates folder-backed views whose Markdown tab, bulletin, threads, side chats, hosted views, and side-agent tabs compose Launchpad. Resolve the remaining template contents, Capture rename/migration, bulletin authority, hosted-tab lifecycle, and routine-chain behavior without turning this umbrella capture into a roadmap.
- **Related:** CAP-003, CAP-005, CAP-117, CAP-125, CAP-127, CAP-130, CAP-138, CAP-146, D-078, D-081, D-084, D-101, D-103, D-106, D-114, D-115, D-118, D-119, P-009, P-010

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

### CAP-154 — Reconcile the new-thread project field with Create Project

- **Origin:** user
- **Type:** decision_prompt
- **Status:** open
- **Source:** RC's chat-routing function and project-name field example on 2026-09-02
- **Summary:** Determine whether the default surface attached to every new thread merely collects a project name as appended chat text, creates or selects a Project Viewer, or replaces part of the existing side-navigation Create Project flow. The choice must preserve or explicitly revise the settled boundary that ordinary conversation creation consumes an existing view and does not itself create a project folder.
- **Related:** D-082, D-101, D-104, D-114, D-125

### CAP-155 — Define chat-assisted plugin setup versus installation

- **Origin:** user
- **Type:** decision_prompt
- **Status:** open
- **Source:** RC's plugin repository, manual-download, Install, and Send to Chat example on 2026-09-02
- **Summary:** Define whether the plugin card's Install action directly performs validated registration or instead routes the plugin location and its self-contained setup folder into a chat, and clarify the adjacent Send to Chat button's distinct behavior. In either case, loading the folder into chat must remain separate from granting registry-backed permissions or activation authority.
- **Related:** D-045, D-046, D-096, D-125, CAP-075, CAP-122

### CAP-157 — Define the tab-container component catalog and lifecycle

- **Origin:** user
- **Type:** decision_prompt
- **Status:** open
- **Source:** RC's New Tabs as Containers direction on 2026-09-02
- **Summary:** Capture and File Viewer now establish the first selector examples, and tab selectors no longer contain domain creation effects. Settle the remaining catalog and lifecycle questions: whether an unfilled tab survives restart, whether a filled tab can replace its component in place, how unavailable configured components appear, and which labels, icons, ordering, or defaults a view may override.
- **Related:** D-118, D-126, D-127, CAP-142, CAP-156

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

### CAP-117 — Compose conversations and saved worksurfaces by view

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's composable chat, side-chat, view configuration, and launch-action direction on 2026-09-02
- **Summary:** Make chat, thread navigation, and content independently presentable; persist only a thread's content worksurface; treat assigned folders as contextual worksurfaces; host side chats in content tabs with bounded prior-chat handoff; let each view configure its New action, thread collections, instructions, working-directory override, and transcript behavior from the view folder; retain project root as the default working directory; and deliver automatic renaming as a plugin.
- **Related:** D-078, D-079, D-080, D-081, D-082, D-083, D-084, D-085, D-086, D-087

### CAP-127 — Separate conversation registration from domain creation

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's project, routine, and conversation simplification on 2026-09-02
- **Summary:** Starting or opening a chat performs no folder or starter-file work, and Fusion waits for the harness-side creation result before registering the conversation. Projects and routines are created through explicit domain actions.
- **Related:** D-103

### CAP-128 — Create Project control and navigation hierarchy

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's side-navigation and project-creation direction on 2026-09-02
- **Summary:** Use the side-navigation plus to collect a project name and icon, place created projects above it, separate ordinary apps with a divider, and place Routines and Plugins in a lower group after a gap.
- **Related:** D-104

### CAP-129 — Explicit Create Routine boundary

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's routine-folder clarification on 2026-09-02
- **Summary:** Opening or discussing a routine does not create a folder; the explicit Create Routine action establishes the folder in which its definition and supporting materials are built.
- **Related:** D-105

### CAP-130 — Semantic routine graph and triggers document

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's node-based routine interface direction on 2026-09-02
- **Summary:** Present routines as connected drag-and-drop blocks backed by a readable `triggers.md` with metadata, semantic explanation, triggers, scripts, heartbeats, and outputs; allow direct inspection of script-backed nodes.
- **Related:** D-106

### CAP-131 — Provenance-authorized routine wake conditions

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's heartbeat and trigger direction on 2026-09-02
- **Summary:** After Provenance, allow installed and authorized schedules, file changes, derived folder conditions, script state, heartbeat intervals, and plugin outputs to wake a routine.
- **Related:** D-107

### CAP-132 — Proportional heartbeat execution

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's long- and short-running process examples on 2026-09-02
- **Summary:** Let short work wait in the active process and let longer work sleep, wake later, inspect, repair, rerun, and sleep again; variables and defaults may be shaped by an assistant or provided by a plugin.
- **Related:** D-108

### CAP-133 — Visible fronting assistant for routines

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's routine-chat description on 2026-09-02
- **Summary:** Give the Routines surface an assistant that explains the graph, available triggers and outputs, connected apps, documentation, installed plugins, and useful additions without representing a persistent invisible agent.
- **Related:** D-109

### CAP-134 — Scriptable conditions and routine outputs

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's routine composition examples on 2026-09-02
- **Summary:** Allow routines to connect JSON, scripts, file and extension matching, regex, AI synthesis, inbox reports, files, and ticket creation while keeping the effects inspectable.
- **Related:** D-110

### CAP-135 — Permission-bearing plugin cards

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's installed-plugin UI direction on 2026-09-02
- **Summary:** Present installed plugins as sectioned browser-extension-style cards with right-side switches for trigger permissions and output permissions.
- **Related:** D-111

### CAP-136 — Plugin dependencies and reusable resources

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugin-resource direction on 2026-09-02
- **Summary:** Let plugins prompt for required plugin or resource dependencies and make explicitly installed local resources such as model weights reusable across compatible plugins and routines.
- **Related:** D-112

### CAP-137 — Modular local speech-to-text pipeline

- **Origin:** user
- **Type:** observation
- **Status:** routed
- **Source:** RC's speech and video transcription example on 2026-09-02
- **Summary:** Compose microphone audio through a reusable local STT capability and editable regex formatter into the input box; require explicit weight installation and allow video workflows to reuse it with additional dependencies.
- **Related:** D-113

### CAP-138 — Universal project template and guided extension

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's project-template refinement on 2026-09-02
- **Summary:** Create a project by cloning a registered universal template with four carefully shaped starting files plus a discoverable way to add further files and subfolders as needed.
- **Related:** D-114

### CAP-139 — Launchpad as an ordinary project composition

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Launchpad unification on 2026-09-02
- **Summary:** Compose Launchpad from the project folder, default files, semantic orientation, Skills, multiple threads, and peer side chats instead of maintaining a bespoke Launchpad runtime.
- **Related:** D-115

### CAP-140 — Markdown-first default project tab

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Project Viewer folder-navigation description on 2026-09-02
- **Summary:** Make the project folder the frontmost tab, with a left-hand navigator that lists Markdown files first and subfolders such as Transcripts and Research below for rapid browsing.
- **Related:** D-116

### CAP-141 — Bulletin drawer and JSON representation

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's bulletin-access clarification on 2026-09-02
- **Summary:** Make the project bulletin available through a slide-out bar and as inspectable JSON in the default folder view.
- **Related:** D-117

### CAP-142 — Project-hosted tabs and side agents

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's project-tab and side-agent clarification on 2026-09-02
- **Summary:** Let only Project Viewer host unrestricted project-relevant tabs such as other views, tools, and side agents, while the underlying universal folder pattern remains usable elsewhere.
- **Related:** D-118

### CAP-143 — Capture as a progressive project on-ramp

- **Origin:** user
- **Type:** idea
- **Status:** routed
- **Source:** RC's Capture-as-hidden-Project-Manager idea on 2026-09-02
- **Summary:** Consider teaching the universal working-memory pattern through low-ceremony Capture notes, riffs, and brain dumps before the plus action reveals or creates the fuller project experience.
- **Related:** P-010

### CAP-144 — Link routines together

- **Origin:** user
- **Type:** idea
- **Status:** routed
- **Source:** RC's routine-composition direction on 2026-09-02
- **Summary:** Consider allowing routines to invoke other routines as reusable connected automation fragments, subject to later loop, permission, state, and failure semantics.
- **Related:** P-009

### CAP-146 — Rename Capture to Project Manager

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Project Manager naming and view-configuration clarification on 2026-09-02
- **Summary:** Rename the Capture product surface Project Manager; use its left-side plus to name and icon a new folder; register and list that folder as a view; and rely on each bound view's configuration to contribute view-specific system guidance through the already in-progress SPEC.
- **Related:** D-119


### CAP-153 — Reusable chat-routing function checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** routed
- **Source:** RC's explicit three-destination, optional-send, and appended-text scope on 2026-09-02
- **Summary:** Settled a reusable chat-routing capability that can send content to a parent chat, a newly created side chat, or a newly created thread; each route may stop with the populated composer or send immediately and may append caller text after the attachment. Preserved the assistant's one-operation implementation shape as a proposal rather than owner-approved architecture. Identified project-name onboarding and plugin setup as immediate consumers whose domain-creation and permission boundaries still require clarification.
- **Related:** D-125, P-012

### CAP-156 — New tabs as view-configured component containers

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's New Tabs as Containers scope correction on 2026-09-02
- **Summary:** Separated generic tab hosting from modular chat. A new tab is an empty component container whose launcher buttons come from configuration stored with the active view. The tab-container foundation becomes an explicit prerequisite for Send to Side Chat, while the component catalog and remaining empty/filled lifecycle choices stay open for this fork to shape.
- **Related:** D-126, D-127

### CAP-158 — View-owned default surfaces and tab-launch behavior

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's default-surface, preview, tab-launcher, Capture, and File Viewer refinement on 2026-09-02
- **Summary:** Removed view-specific worksurface setup from New Thread. When a new thread has no saved content state, the owning view's canonical configuration supplies its default module and single-surface header, decides whether the plus action is present, and declares the buttons available in an empty tab. View-native items may open in a popup or preview and then open in a new tab through the same owning module. Picker-style entries such as Open File may open the shared File tree drawer and fill the waiting tab after selection. Capture and File Viewer will provide the first bounded examples while side chat remains the shared MVP hosted component.
- **Related:** D-128, D-129, D-130, D-131

### CAP-159 — Keep domain creation inside Home modules

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Capture launcher simplification on 2026-09-02
- **Summary:** Resolved the earlier New Collection placement question by removing domain creation effects from empty-tab selectors. Frequent create controls belong to the configured Home module that owns their domain. A selector may open a module, open an existing resource through a picker, or instantiate a Side Chat, but it does not create Capture collections, projects, folders, files, or comparable domain objects.
- **Related:** D-135

### CAP-162 — Separate initial-container policy from later tab addition

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's File Explorer and Capture initial-container examples on 2026-09-02
- **Summary:** Split view configuration into an initial-container choice and a universal later-tab behavior. File Explorer starts without a Home module, renders its first selector container as a visible tab, and offers Open File plus New Side Chat. Capture starts with its Home module under centered single-surface identity; pressing plus converts that worksurface to tabbed presentation and opens a new selector containing Capture Home plus New Side Chat. Every later plus action opens another selector container rather than rerunning the initial policy.
- **Related:** D-134, D-136

### CAP-163 — Give navigation sources shared current-tab and new-tab placement

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's File Explorer, Capture Home, and Project Manager Bulletin placement refinement on 2026-09-02
- **Summary:** Generalized tab placement beyond previews and empty-tab launchers. A sidebar, Home module, preview, or other navigation source may pass a typed resource target to the shared tab host and request either the current tab or a new tab. The host checks stable target identity first; an existing match is activated and asked to reveal or recenter the resource instead of being duplicated. File Explorer's File tree fills the current tab by default and can offer Open in New Tab, Capture Home can replace the old fullscreen file route by opening Capture material in a new tab without a sidebar, and claimed Project Manager Bulletin items open in a new tab by default while returning to an existing matching tab.
- **Related:** D-137, D-138, D-139

### CAP-164 — Make Open in Current Tab non-destructive

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's exact Open in Current Tab precedence clarification on 2026-09-02
- **Summary:** Defined Open in Current Tab as a safe placement preference rather than permission to replace content. The host first looks for the same target in another open tab and activates and recenters that match. If no match exists, it fills the current tab only when that tab is empty. If the current tab is non-empty, it is unavailable and the host opens a new tab. This removes the need for special replacement handling for Home, pinned, dirty, or other populated surfaces.
- **Related:** D-140

### CAP-165 — Preserve view-owned presentation when resources enter tabs

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Capture, File Explorer, and Wiki presentation clarification on 2026-09-02
- **Summary:** Separated tab placement from resource presentation. Capture Home remains its own module, while Markdown originating from Capture opens through Capture's rendered document presentation. File Explorer opens files through its fullscreen, syntax-highlighted display and editing presentation. Wiki does not use the Capture-style popup or preview flow; a right-click link action may open an in-scope Wiki page in a Wiki tab, while a linked file outside the Wiki folder opens as a single-file File Explorer tab without revealing the File-tree drawer.
- **Related:** D-141, D-142

### CAP-166 — Compose Project Viewer as a configured unified workspace

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Project drawer and unified-workspace simplification on 2026-09-02
- **Summary:** Defined Project Viewer as a broad configuration of the shared container, placement, presenter, and chat systems rather than a bespoke nested-view runtime. Its configured slide-out options can open other view Home modules, including Wiki Home and Capture Home, alongside Browser and standalone files linked from project material. These are content presentations inside the current Project thread and chat context. Project's unusually broad component catalog remains an intentional product privilege, but it is expressed through view configuration and the shared infrastructure rather than special Project tab mechanics.
- **Related:** D-143

### CAP-167 — Give each configured drawer its own header icon

- **Origin:** mixed
- **Type:** thread
- **Status:** routed
- **Source:** RC's per-drawer icon and workspace-header spacing direction, plus inspection of the current workspace-header action styling, on 2026-09-02
- **Summary:** Replaced the single generic right-side drawer icon in the target experience with one semantic action icon per configured drawer. The drawer actions reuse the top workspace header's shared action sizing and spacing rather than introducing Project-specific measurements; the current implementation resolves those tokens to 32-pixel buttons, 18-pixel glyphs, a 4-pixel gap, and an 8-pixel trailing inset. Files uses a folder icon. Home-surface and Bulletin icons remain an owner-selectable detail; the assistant suggested `apps` for the available-Home-surfaces drawer and `campaign` for Bulletin.
- **Related:** D-144

### CAP-168 — Reduce container presentation to Empty, Home, and Content

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's shared title, location row, Wiki default, and three-paradigm clarification on 2026-09-02
- **Summary:** Defined three configurable container presentation kinds. Empty shows the view's picker. Home shows an app-style landing module and omits the file-location row. Content shows an optional resource-location row above the view-owned renderer. Centered single-surface identity and tab-strip labels share the same icon size and typography. Any kind can be a view default: Wiki defaults to Content on the Wiki Guide with direct navigation and no separate Home depth, while Capture and Tickets can default to Home. Project Viewer can combine a Project Home default, configured Empty-tab options, Files and Bulletin drawers, and an app-launcher drawer limited to self-contained Home or Content targets that do not require another sidebar. Other views remain narrower through configuration rather than hardcoded exclusions.
- **Related:** D-145, D-146, D-147

### CAP-169 — Replace Capture and Ticket expansion with shared tab opening

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Capture and Ticket expand-button simplification on 2026-09-02
- **Summary:** Replace the existing expand actions in Capture and Tickets with Open in New Tab. Both actions call the same typed open-target path used by a sidebar: first find an existing tab with the same presenter and resource and activate and center it; otherwise create a new Content tab. This removes a separate fullscreen-expansion path and keeps cards, previews, and drawer navigation on the same deduplicated placement contract.
- **Related:** D-148

### CAP-170 — Separate preview policy from full Content-tab presentation

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Capture, Ticket, and future Office document interaction clarification on 2026-09-02
- **Summary:** Retain the existing preview modes for Capture and Tickets while making their full presentation a Content tab rather than a separate fullscreen route. Capture remains intentionally Note-like by previewing on ordinary selection before an explicit Open in New Tab action. Office documents can later use direct-to-tab behavior on ordinary selection, while still calling the same shared find-and-center-or-create operation. Preview is an originating-view interaction policy, not another container type.
- **Related:** D-149

### CAP-171 — Treat drawers as workspace chrome and make them push content

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's drawer theming, simplified Content settings, and push-layout interaction direction on 2026-09-02
- **Summary:** Since drawer contents exclusively open tabs, eliminate a separate Nav theme category for them. Use Workspace Background for the drawer surface, Workspace Chrome for its ordinary treatment, and Workspace Chrome Accent for the active drawer button. Reduce Content settings to Background, Foreground, Accent, and Content Contrast; use Contrast to jointly attenuate headers, body text, and content-derived borders, and Foreground for structural elements such as Home or Wiki navigation. Place the open right drawer below the persistent top header and make it consume width so the content container shifts left rather than being overlaid. Clicking the accented active icon closes it; clicking another drawer icon switches directly to that drawer.
- **Related:** D-150, D-151, D-152

### CAP-172 — Define shell and presenter style ownership across container rows

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Kanban, Capture Home, tab-rail background, location-row, and Content ownership clarification on 2026-09-02
- **Summary:** Defined vertical style ownership for the three container presentations. A single centered Home extends its own background through the full view area beneath the global header, including behind its centered identity, allowing Kanban and Capture Home color to reach the top. When tabs exist, the shared shell owns the tab rail and derives it from the owning view's Content Background. A Home presenter begins immediately below that rail. A Content presentation places its optional workspace-owned location row beneath the rail and begins presenter-owned Content below the location row. Empty places its picker beneath the same shell-owned rail.
- **Related:** D-153

### CAP-173 — Require identical shell rails for every Content tab

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's mandatory tab-and-path rail correction on 2026-09-02
- **Summary:** Tightened the Content presentation from an optional location row to one invariant three-layer stack: shell-owned Tabs, shell-owned File Location and Path, then presenter-owned Content. Capture Markdown, Wiki pages, and File Explorer files use the same two top rails even when their originating view defaults to Home. Tabbed Empty remains entirely shell-owned. This supersedes the earlier optional-location wording while retaining the centered Home fill and tabbed Home body behavior.
- **Related:** D-154

### CAP-174 — Fix the reference configurations for Home, Content, and Empty

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Wiki, Capture, File Explorer, and Tickets presentation refinement on 2026-09-02
- **Summary:** Fixed the three presentation examples and their transition behavior. Home is the centered presenter-owned canvas whose background reaches the top of its container. Content follows the universal shell-owned Tabs and File Location and Path rails. Empty is shell-owned. Wiki has no Home and starts as a visible Content tab at the Wiki Guide with plus on its right. Capture is the reference Home view and File Explorer the reference Empty view. Tickets will also start as Home; opening an expanded Ticket converts the centered Home into the left Home tab and opens the Ticket under the universal Content rules, matching Capture's transition when one of its documents opens.
- **Related:** D-155

### CAP-175 — Apply the Home-to-Content pattern to productivity apps

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Email, Calendar, and expanded-draft clarification on 2026-09-02
- **Summary:** Extended the Home presentation to Email, Calendar, and comparable productivity capabilities. Email begins as Home. Expanding a draft full-size converts Email Home into the first tab and opens the draft as ordinary Content. Email Home remains the sole place to browse or open another message or invoke Compose for new mail, keeping navigation and domain creation out of the focused draft tab. This presentation pattern does not undo the decision to group these capabilities inside Productivity Suite.
- **Related:** D-156

### CAP-176 — Compose Email drawers and Home targets into other views

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's cross-view Email Inbox drawer and pop-out observation on 2026-09-02
- **Summary:** Recognized the broader compositional payoff of the tab system. A view may configure an Email Inbox drawer that launches messages as Content and an action that opens Email Home as a hosted Home tab. The surrounding view retains its own thread, shell, and saved worksurface instead of mounting a nested Email view or thread list. This establishes the pattern as configuration over shared drawer sources and registered targets rather than an Email-specific integration.
- **Related:** D-157

### CAP-177 — Put the reusable view-plugin library inside System

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's plugin/view template hierarchy and protected-System placement correction on 2026-09-02
- **Summary:** Established `ai/<machine>/System/plug-ins/views/` as the local reusable source library. It contains `view-templates/<type-name>/` plus `app-home-displays/`, `content-tab-displays/`, and `sidebar-modules/`. View templates provide copyable configuration for ready-to-use view instances; live view configuration references reusable displays and sidebar modules by stable identity. Right-click Add View, Duplicate View, and `+ Project` consume the library through validated Fusion flows. Live capsules remain under `System/Views/`, and later Provenance work can help reduce more built-in views to declarative configurations. A read-only repository check found no existing root plugin directory, so this records a target structure rather than current implementation.
- **Related:** D-158

### CAP-178 — Make the Plugins folder itself a protected view capsule

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's correction that the plugin source and Plugins view are the same folder on 2026-09-02
- **Summary:** Replaced the intermediate `System/plug-ins/views/` layout with `ai/<machine>/System/Views/plug-ins/`. This one protected folder is both the Plugins view capsule and the source of truth for all local plugin material. Its view-oriented library remains under `views/view-templates/`, `views/app-home-displays/`, `views/content-tab-displays/`, and `views/sidebar-modules/`. Other live view capsules call those definitions by stable identity, while the registry retains separate authority over registration, activation, permissions, and consent.
- **Related:** D-159

### CAP-179 — Compose templates, presenters, and views as dependent plugins

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Code Space, modular Plugins Home, plugin-detail, and declarative presentation-chain refinement on 2026-09-02
- **Summary:** Made templates and interface modules first-class plugins that can depend on one another. Code Space is the reference aggregate: it requires File Tree Drawer, File Editor Content tab, Capture Home, Capture Content tab, Wiki Content tab, and its templates. Plugins Home reuses a modular Capture-style layout with top text, one folder of sections, and configurable grid cards; plugin cards borrow Ticket preview-and-expand behavior. A full Plugin Content tab uses one Markdown description, basic switches, and a browsable source folder whose files open through File Viewer Content. View configuration selects an optional Home presenter, optional preview presenter, expanded-tab presenter, data source, permissions, and dependencies. Selective post-duplication copying remains an assistant-guided, validated configuration task rather than a bespoke cloning workflow or direct agent write.
- **Related:** D-160, D-161, D-162, D-163

### CAP-180 — Consider SQLite for Browse and protected files for Installed

- **Origin:** user
- **Type:** idea
- **Status:** routed
- **Source:** RC's SQLite-backed Browse catalog and `ai/System/plugins` installed-source idea on 2026-09-03
- **Summary:** Proposed separating plugin discovery from installed source. Browse would query text-only plugin packages stored in SQLite, including Markdown, configurations, folder paths, and scripts but excluding images and nested database files. Installation would validate and materialize a readable package beneath `ai/<machine>/System/plugins/`. The Plugins view would present both sources without making catalog scripts executable, while the registry would remain authoritative for registration, activation, permissions, and consent. Adopting the split would supersede D-159's combined Plugins-view/source folder.
- **Related:** P-013, D-164

### CAP-181 — Lock Browse while preserving folder-based sideloading

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Fusion-approved Browse boundary and external-folder sharing refinement on 2026-09-03
- **Summary:** Established Browse as a locked catalog containing only Fusion-approved packages rather than a general listing of folders in the installed root. Users may still author, download, receive, or share a compatible folder containing a view, workflow, Agent Profile, or other plugin resources and drag or copy it beneath `ai/<machine>/System/plugins/`. Fusion may discover, inspect, validate, register, and authorize those filesystem-sideloaded packages, but copying a folder neither activates it nor adds it to Browse nor grants Fusion-approved provenance.
- **Related:** D-164

### CAP-182 — Open approved Browse from Plus and keep sideloading in the filesystem

- **Origin:** user
- **Type:** thread
- **Status:** routed
- **Source:** RC's Browse-overlay, drag-to-sideload, and no-badge clarification on 2026-09-03
- **Summary:** Defined the Plugins `+` action as opening the locked, approved Browse overlay. Fusion will not expose a visual sideload command, source picker, or approval badge. Users sideload through the ordinary filesystem by dragging or copying a compatible folder into `ai/<machine>/System/plugins/`, then provisioning its settings and completing the applicable registration, permission, consent, and activation steps. Browse membership itself communicates the approved route.
- **Related:** D-165

### CAP-183 — Carve the generic component-tab host out before chat extraction

- **Origin:** mixed
- **Type:** thread
- **Status:** routed
- **Source:** RC's first-SPEC scope and Provenance sequencing direction, plus inspection of the committed Universal View Tab Bar implementation on 2026-09-03
- **Summary:** Fixed the next bounded implementation family: build only the generic tab-content host that accepts component-backed contents and defines new-empty-tab behavior on top of the completed Universal View Tab Bar. Do not relocate or convert view folders, build plugin configuration, or extract chat in this SPEC; chat and Side Chat consume the resulting contract next. Full plugin behavior and declarative conversion of existing views wait for Provenance so the product does not migrate views onto a temporary registry and then refactor them again. RC then approved the serializable component reference, injected first-party resolver, legacy-content fallback, correlated empty-to-filled transition, and inert unavailable-component state by authorizing `GENERIC_COMPONENT_TAB_HOST_SPEC.md`.
- **Related:** D-166, D-167, P-014

### CAP-184 — Split the earlier combined chat and Side Chat execution bundle

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's instruction to extract earlier SPEC material that mixed chat-system extraction with Side Chat work on 2026-09-03
- **Summary:** Replaced the earlier combined implementation bundle with three explicit gates. Generic Component Tab Host owns component-backed content and empty lifecycle. Composable Threaded Chat owns the portable ChatSurface, one-member view-bound groups, Pending New Chat integration, and content-only worksurface continuity without creating a Side Chat. Move Chat to Side Chat separately owns the multi-member transition, component-tab placement, recovery, and legacy Secondary Chat retirement. The former combined document remains only in `999-Archive` as provenance. View-Configured Thread Collections depends on Composable Chat and is independent of Move Chat to Side Chat.
- **Related:** D-168

### CAP-185 — Split capsule control-plane migration from thread collections

- **Origin:** mixed
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's single-domain SPEC preference and authorization to repair the altered SPEC bundle until clean on 2026-09-03
- **Summary:** Applied the approved single-domain rule to the former View-Configured Thread Collections bundle. A new System View Capsule Control-Plane Foundation SPEC exclusively owns canonical `System/Views` resolution, journaled quiescent relocation, registry cutover, and protection of Fusion-owned generic file routes. The reduced Collections SPEC consumes that accepted foundation and owns only effective thread presentation configuration, ranked assignments, synthetic Archive, filtering, and the shared row menu. Workspace/view prompt composition remains a separate future SPEC.
- **Related:** D-169

### CAP-186 — Accept the generic host and finish the tab platform before Chat

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's owner acceptance and explicit pre-Chat tab sequencing on 2026-09-03, reconciled with `002-SPECs/TABS-PROVENANCE-COORDINATION/`
- **Summary:** Accepted the implemented Generic Component Tab Host and kept its no-production-adopter boundary. Chat is now explicitly held until the owner-defined tab platform milestone is complete. The Provenance coordination handoff showed that the next safe slice is shell presentation, followed by a separate typed placement/controller slice; the latter supplies the first bounded tab-action chokepoint that BRIDGE-01 can consume. Declarative view configuration and adoption still require the future registration, validation, permission, consent, and revocation control plane rather than treating Agent Tool Provenance as that missing authority.
- **Related:** D-170, D-171, TPC-D09, TPC-O02, TPC-O04, TPC-O05

### CAP-187 — Accept the Tab Shell Presentation Foundation

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's explicit owner authorization on 2026-09-04 after reviewing `TAB_SHELL_PRESENTATION_FOUNDATION_ORCHESTRATOR_REPORT.md`
- **Summary:** Accepted the implemented Tab Shell Presentation Foundation, its reviewed repairs and compatible deviations, and its deliberate lack of a production adopter. Independent owner verification reran the 68-test integrated gate, TypeScript, targeted lint, production build, and whitespace check. RC explicitly classified the aggregate-fingerprint discrepancy as bookkeeping rather than a code, file-placement, branch, or acceptance failure. Both accepted tab foundations remain uncommitted; target placement is the next separate Tabs package.
- **Related:** D-172, TPC-D10, TPC-O02

### CAP-188 — Universalize tab identity and location chrome

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's 2026-09-04 riff refining the accepted presentation model before target placement
- **Summary:** Every single tab now uses centered short identity and view icon; every active tab uses a second breadcrumb-style location row, with optional presenter-owned Back/Forward controls before it. Landing surfaces no longer require a Home shell kind: they provide meaningful locations such as `Capture Documents and Artifacts`, while addressed content may show `Capture > Collection > Name` and Empty supplies its own neutral identifier. Display policies such as omitting Wiki `PAGE.md` do not alter full target identity. Authorized TABS-02A as a corrective SPEC before TABS-03.
- **Related:** D-173, TPC-D11

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

### CAP-118 — Composable conversation and view-launch checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-09-02
- **Summary:** Refined the earlier view-bound thread model into an independently composable chat/thread/content shell, narrowed saved thread state to the content worksurface, added side-chat tabs and bounded continuation, proposed view-configured launch recipes and folder worksurfaces, kept project root as the default working directory, placed view overrides in view folders, added folder-or-tag thread collections and configurable transcript destinations, separated automatic naming into a plugin, and preserved the surrounding Routines, Agent Profiles, Plugins, and project presentation as an open shaping thread. CAP-125 and D-101 later superseded thread-time project launch recipes with separate Project Viewer creation.
- **Related:** CAP-117, CAP-119, D-078, D-079, D-080, D-081, D-082, D-083, D-084, D-085, D-086, D-087

### CAP-120 — Composable threaded-chat specification checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Owner refinements, code-standards review, and SPEC drafting on 2026-09-02
- **Summary:** Bounded the first implementation SPEC to a rename-safe view-bound visible-thread umbrella, peer chat sessions, a pure reusable chat surface with connected hosts, per-thread content worksurfaces stored in the owning view folder, and an exact Move Chat to Side Chat transition that creates a cold empty primary. Kept `thread:action` as the canonical command family, separated `threadGroupId`, `threadId`, `viewId`, and `surfaceId`, defined post-commit fan-out and cross-store repair, replaced horizontal work phases with vertical slices, and removed context-cloning branch behavior from active standards and plans.
- **Related:** CAP-117, CAP-118, D-078, D-079, D-081, D-088, D-089, D-090, D-091, D-092, D-093, D-094

### CAP-121 — System-owned view-capsule and thread-authority checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's view-location and protected-System clarification on 2026-09-02
- **Summary:** Recognized that existing `content.json` roots already separate a view definition from its primary content folder. Moved the target capsule location to `ai/<machine>/System/Views/`, allowing Wiki and other content to remain either machine-local under `ai/` or independently Git-tracked at workspace root. Defined the future System tree as readable to agents but writable only through trusted user-mediated Fusion services, preventing agents from modifying their own configuration, permissions, launch policy, or authority to create new threads.
- **Related:** CAP-117, CAP-120, D-084, D-088, D-095, D-096

### CAP-122 — Portable System configuration checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's GUI, raw JSON, component-composition, and cloning clarification on 2026-09-02
- **Summary:** Expanded System into a portable declarative control plane. Purpose-built GUI editors and direct user JSON access operate on the same canonical validated files; reusable components and other customization can be referenced from those configurations. Configurations may be cloned or exported, while new instance IDs, fresh permission consent, and exclusion of secrets, thread history, sessions, and local runtime/view state prevent portability from becoming authority transfer. OpenCode is the first explicitly named read-only harness under the future protected-System boundary, which also applies to later harnesses.
- **Related:** CAP-121, D-045, D-046, D-095, D-096, D-097, D-098

### CAP-123 — Configured thread tags and Archive fallback checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's thread-dropdown and fallback clarification on 2026-09-02
- **Summary:** Defined the view configuration as the source of the folder/tag choices shown in the thread dropdown. Both modes use stable collection IDs underneath. Fusion injects a non-removable Archive collection for every thread with no currently valid configured assignment, including when direct configuration changes remove collections that existing threads used. Automatic title-renaming rules remain configurable through the separate Auto-Rename Chat Threads plugin.
- **Related:** CAP-118, CAP-120, CAP-122, D-085, D-086, D-099, D-100

### CAP-124 — Lossless ranked collection-mode checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's collection-rank clarification on 2026-09-02
- **Summary:** Made collection metadata permanently multi-assignment and ranked even though `mode: "folders"` is the default single-group presentation. Folder mode shows the highest-ranked valid assignment, selecting another folder reranks it without removing lower-ranked memberships, and `mode: "tags"` reveals all valid memberships across multiple groupings. Configuration-absent IDs remain dormant. The Archive button is the intentional destructive exception: it clears every assignment and Archive is derived from having no valid assignments. Reused the Office Viewer's newest-rank-wins principle while keeping thread ranking in the server-owned thread domain rather than extracting the Office color-policy module.
- **Related:** CAP-120, CAP-123, D-085, D-099, D-100

### CAP-125 — One ordinary Project Viewer per project checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's Project Viewer simplification on 2026-09-02
- **Summary:** Replaced the proposed thread-time folder/template launch recipe and special Project Manager host with a separate side-navigation Create Project flow. Each project becomes its own numbered Project Viewer capsule with an immutable manifest ID and one established content-root/configuration binding. The project can then contain several ordinary primary threads, each with several side-chat peers. New Chat consumes the existing view context and never creates project/content files or passes folder identity through thread creation; the existing generated chat transcript mirror remains ordinary session persistence.
- **Related:** CAP-117, CAP-118, CAP-120, D-078, D-082, D-083, D-084, D-101

### CAP-126 — View-configured thread collections specification checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** RC's second-SPEC boundary and shared-menu direction on 2026-09-02
- **Summary:** Created the second composable-chat SPEC for relocating view capsules into `System/Views`, extending existing `content.json` chat configuration, projecting New-action and collection display behavior, storing ranked group-level collection metadata, filtering by configured collections plus derived Archive, and adopting the shared menu for thread right-click and kebab actions. The Collections/`sub_header` submenu uses radio semantics in default folder mode and adds correct checkbox semantics with keep-open interaction in advanced tag mode. The public New Chat request gains no project/content folder, path, or config fields.
- **Related:** CAP-120, CAP-122, CAP-123, CAP-124, CAP-125, D-084, D-085, D-095, D-099, D-100, D-101, D-102

### CAP-145 — Project, Routine, and plugin composition checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-09-02
- **Summary:** Separated conversation registration from project and routine creation; established the project-first navigation and universal template direction; defined Project Viewer's Markdown-first folder tab, bulletin surfaces, conversation families, hosted tabs, and side-agent visibility; reframed Launchpad as the default project composition; developed Routines as semantic `triggers.md`-backed graphs with proportional heartbeat execution; and added permission-bearing plugin cards, dependencies, reusable model resources, and the modular STT example. Preserved Capture as a progressive project on-ramp and routine-to-routine linking as proposals.
- **Related:** CAP-127, CAP-128, CAP-129, CAP-130, CAP-131, CAP-132, CAP-133, CAP-134, CAP-135, CAP-136, CAP-137, CAP-138, CAP-139, CAP-140, CAP-141, CAP-142, CAP-143, CAP-144, D-103, D-104, D-105, D-106, D-107, D-108, D-109, D-110, D-111, D-112, D-113, D-114, D-115, D-116, D-117, D-118, P-009, P-010

### CAP-147 — Project Manager naming checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** Launchpad reconciliation on 2026-09-02
- **Summary:** Rejected the proposed Capture-to-Project promotion model. Capture is instead renamed Project Manager, whose plus creates a named and icon-bearing folder registered as a view. Confirmed that view folders contribute bound view-specific system guidance and kept the detailed configuration behavior within the existing in-progress SPEC.
- **Related:** CAP-143, CAP-146, D-084, D-119, P-010

### CAP-148 — Transparent view orientation and discovery checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's per-view system-message, README, sibling-discovery, navigable-tree, and System Wiki clarification on 2026-09-02
- **Summary:** Made each view capsule's `README.md` the transparent orientation entry point for its bound conversations. A short common footer points to the canonical configuration and prompt, explains the sibling-view tree and read-only listing script, and enables selective inspection of another view's folder, prompt, and declared source folder. Added a small shared Fusion Studio Wiki for application and capability awareness and required view-panel packages to contribute discoverable Wiki documentation in their repository, while preserving user editability and the protected boundary against agents rewriting their own governing System policy.
- **Related:** CAP-121, CAP-122, CAP-147, D-084, D-095, D-096, D-097, D-120, D-121

### CAP-149 — Workspace-to-view inheritance checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's workspace-folder inheritance clarification on 2026-09-02
- **Summary:** Added a workspace-level System folder whose orientation and configuration structure matches the view capsules. Its README explains the folder layout, inheritance, prompt assembly, configuration locations, and workspace-wide navigation. The workspace folder provides the inherited base; each view folder specializes it and explains how to navigate its own view. Exact path naming and per-field configuration merge behavior remain later contract work.
- **Related:** CAP-148, D-084, D-095, D-120, D-121, D-122, D-123

### CAP-150 — Workspace-first prompt composition checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's matching-folder and prompt-append clarification on 2026-09-02
- **Summary:** Standardized on a `prompt.md` at workspace scope and a matching `prompt.md` in each view capsule. Fusion supplies the workspace prompt first and appends the active view prompt as the more specific tail layer before passing the combined system context through the configured harness/provider. The README explains this contract alongside the rest of the folder convention. RC identified an OpenRouter request setting as the likely delivery mechanism; the exact adapter field is an implementation fact to verify later rather than part of this conceptual decision.
- **Related:** CAP-148, CAP-149, D-084, D-120, D-122, D-123

### CAP-151 — Single-domain SPEC decomposition checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** routed
- **Source:** RC's implementation-chunking preference plus the current code, standards, and harness survey on 2026-09-02
- **Summary:** RC settled the process preference for focused, single-domain implementation SPECs because they give the implementation orchestrator and reviewer a clearer judgment boundary. The survey found that the current second SPEC combines three distinct domains: System-tree and capsule migration, workspace/view prompt composition through the harness, and ranked thread-collection persistence plus UI. It therefore proposed a capsule-foundation prerequisite followed by independent prompt-composition and reduced collection SPECs. RC later adopted the domain split in D-169; the prompt-composition SPEC remains future work.
- **Related:** D-124, P-011, CAP-120, CAP-126, CAP-148, CAP-149, CAP-150

### CAP-152 — OpenCode on-demand capability discovery checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** closed
- **Source:** RC's OpenCode discovery question, installed OpenCode `1.18.24`, and official OpenCode agent, Skill, command, CLI, and server documentation checked on 2026-09-02
- **Summary:** Verified that OpenCode does not require Fusion to paste every Agent Profile or workflow into each view's system prompt. The selected primary agent owns its full system prompt and permissions; permitted subagents are exposed to the active model through a lightweight ID-and-description catalog and can also be invoked directly by the user. Skills expose names and descriptions before loading their full instructions on demand. Agents and commands are listable through the CLI and server API, while messages and commands can select an agent explicitly. OpenCode commands provide a natural user- or agent-invoked prompt-workflow primitive, but schedules, triggers, durable routine state, and product authority remain Fusion responsibilities. Stable and next-generation OpenCode documentation currently differ on command-created subtask behavior, so integration must capability-check the installed harness rather than assume that detail.
- **Related:** CAP-066, CAP-119, CAP-130, CAP-150, D-075, D-111, D-123

### CAP-160 — Main Chat and Side Chat terminology checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** closed
- **Source:** RC's user-facing chat-designation clarification on 2026-09-02
- **Summary:** Standardized user-facing vocabulary on **Main Chat** for the ordinary chat surface and **Side Chat** for a chat mounted in a content tab. Recorded that the existing internal `primary` role/history and `side-chat` projection discriminators remain unchanged, because the new names describe presentation rather than adding mutable membership roles. Updated deterministic tab fallbacks to `Side Chat 1`, `Side Chat 2`, and so on.
- **Related:** CAP-120, CAP-153, D-089, D-090, D-125, D-132

### CAP-161 — Tabs as Containers dependency checkpoint

- **Origin:** user
- **Type:** observation
- **Status:** routed
- **Source:** RC's parallel-fork and dependency-boundary clarification on 2026-09-02
- **Summary:** Confirmed that a separate chat owns the Tabs as Containers work and that generic tab containers are removed from the threads domain. The composable-thread work may advance through its independent foundations, but **Move Chat to Side Chat** is hard-blocked until the separate container SPEC is implemented and accepted. The Side Chat slice consumes the resulting host contract and cannot recreate generic container creation, empty-tab behavior, launchers, component registration, or lifecycle locally.
- **Related:** CAP-156, CAP-158, D-126, D-127, D-133

### CAP-189 — System view relocation and configured tab-adoption checkpoint

- **Origin:** mixed
- **Type:** observation
- **Status:** routed
- **Source:** RC's 2026-09-07 sequencing decision plus reconciliation of the accepted tab, trusted-shell, Provenance, code-standards, and active-code contracts
- **Summary:** Closed the remaining pre-Bridge view-platform boundary as two focused SPECs. The first relocates the entire machine-scoped view capsule tree into `System/Views` through a startup-gated, journaled atomic move and protects the canonical and retired namespaces across Fusion-owned generic mutations. The second extends the existing view `content.json` with closed, code-owned initial/Empty tab policy and makes Capture and File Explorer the first production adopters of universal tab chrome and TABS-03 placement. It deliberately excludes Chat, Side Chat, dynamic plug-ins, prompts, collections, and Provenance events, and requires an owner visual pass before Bridge begins.
- **Related:** CAP-121, CAP-126, CAP-151, CAP-161, D-095, D-096, D-124, D-137, D-169, D-171, D-173, D-174
