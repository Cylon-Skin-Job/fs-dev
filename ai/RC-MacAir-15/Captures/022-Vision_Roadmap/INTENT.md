# Vision Roadmap Intent

> Owner-directed purpose, outcomes, goals, constraints, and non-goals. This document establishes vision scope but does not approve detailed proposals, roadmaps, SPECs, or implementation.

## Purpose

Develop an umbrella vision for a universal Fusion Studio system inbox, the UI flow around it, the evolution of chat and threading, and a mobile experience that integrates the desktop product's capabilities seamlessly.

## Desired Outcomes

- A broad definition of the universal system inbox and the role it plays across Fusion Studio.
- A universal location for anything that needs the user's attention, including stopped autonomous work, replies awaiting the user, active work, review work, and general alerts.
- Inbox items that can expand for quick inspection or open into a full-page working context.
- A coherent product-level UI flow connecting inbox, chat, threads, workspaces, views, and related desktop and mobile capabilities.
- Fusion Home as a useful default folder for the downloaded product, with specialized workspace families available to add as needed.
- An “everything is a plugin” product model that allows capabilities and workspace experiences to remain modular.
- A protected, machine-scoped Plugins architecture that separates the view capsule under `System/Views/`, a locked SQLite Browse catalog of Fusion-approved packages, and inspectable installed or sideloaded folders under `System/plugins/`.
- Templates and interface modules represented as dependency-bearing plugins, allowing higher-level offerings to compose complete views from reusable Home, preview, Content, drawer, data-source, and permission declarations.
- A grouped Fusion Home information architecture that gives related capabilities enough shared context and activity density to support meaningful view-bound threads.
- A left-side navigation and thread area that makes the relationship between product location, view, and conversation immediately legible.
- A clear conceptual account of how the current threading and chat experience may need to evolve.
- A clean boundary in which chats consume existing view context while explicit project and routine actions create any required folders or starter material.
- View-bound threads that restore their own view-specific working context, including open tabs, documents, and other content state.
- Project creation that clones a universal four-file starter pattern, exposes guided ways to add earned files and subfolders, and registers the result as an ordinary Project Viewer.
- Project Manager as the renamed Capture surface, preserving low-ceremony notes and brain dumps while making explicit folder-backed project creation its primary role.
- A Markdown-first project folder tab with principal files above organized subfolders, a slide-out bulletin, and transparent bulletin JSON.
- A Launchpad experience composed from the ordinary project template, Skills, semantic guidance, threads, side chats, and project-hosted tabs rather than a bespoke subsystem.
- View-folder configuration that contributes system guidance according to the view a conversation is bound to, with its detailed behavior left to the active SPEC.
- A transparent orientation layer in which every view capsule includes a readable `README.md`, points to its canonical configuration, prompt, and source content, and tells the active assistant how to discover sibling views with a read-only listing script without preloading all of them.
- A workspace-level System folder whose orientation and configuration structure matches the view capsules, supplying the inherited base for every view and using its README to explain the layout, inheritance, prompt assembly, and workspace-wide navigation.
- Deterministic prompt composition in which the workspace `prompt.md` is supplied first and the active view's `prompt.md` is appended as the more specific tail layer.
- A small shared Fusion Studio Wiki that explains the application shell, configured harness environment, major capabilities, and view ecosystem, with every new view-panel package contributing its own discoverable Wiki entry.
- A Project Viewer capable of hosting other views, tools, and visible side agents as project-header tabs while other folders can still use the universal document structure.
- Consistent content actions that let the user link content, attach it to the current chat, or start a new chat with it already attached.
- Ticket-created threads that inherit useful identity and view-specific behavior without requiring the user to restate an obvious workflow.
- An Issues experience where selecting a ticket thread restores its exact content and makes ongoing agent work directly observable.
- A user-in-the-loop autonomy model in which auto-generated work can wait in a queue, run when the user chooses, and be monitored for significant changes.
- Thread-visible heartbeats that can monitor explicit variables or opt-in change streams, wake for relevant changes, perform authorized follow-up behavior, and return to sleep.
- Inspectable Routines that present triggers, scripts, heartbeat steps, reasoning, and outputs as a semantic node graph backed by readable files.
- Proportional routine execution that waits inline for short work and uses heartbeat-driven inspect, repair, rerun, and sleep cycles for longer work.
- A unified ticket-driven work model in which organic, manual, scheduled, and triggered work all enter the same visible assignment and thread lifecycle.
- Calendar and cron scheduling that can instantiate reusable ticket templates with the content needed for their future work.
- Non-focus-stealing automatic assignment so newly dispatched work becomes visible without interrupting what the user is doing.
- An Agent Profiles surface that exposes reusable harness-backed capabilities without introducing a separate persistent-agent management model.
- Flexible profile invocation through explicit plus-menu selection, ticket metadata, workspace defaults, or bounded subagent delegation.
- A plugin-oriented Settings experience that keeps core controls simple while allowing optional capabilities to add deeper configuration and behavior.
- Per-workspace appearance controls that are useful by default and substantially extensible through an optional Theme Customization plugin.
- Visible, user-customizable controls for every plugin hook into or out of the Universal Event Bus.
- Sectioned plugin cards that distinguish trigger permissions from output permissions and expose reusable dependencies such as local model weights.
- A database-backed plugin registry that connects installed capabilities to their UI and prevents arbitrary folders from becoming executable without user registration and consent.
- A simple channel boundary in which Plugins `+` opens approved Browse, while compatible external folders can only be sideloaded through the filesystem and provisioned without entering Browse or requiring approval badges.
- Plugin-added personal-context surfaces whose extraction is opt-in and whose recorded and surfaced information remains under user control.
- Ticket-selectable capability profiles ranging from basic orientation to complex gated workflows with subagents and validation.
- A mobile vision that integrates the desktop feature set into one cross-device experience rather than standing apart from it.
- A chat-centered phone experience that can shift into the active full app view while preserving workspace, view, thread, notification, and conversational continuity.
- An event-fed attention model in which the wider system can filter relevant bus activity into UI updates, automation, records, queries, and writes.
- An observable path from Launchpad capture through ticket shaping, review, planning, assurance sweeps, and eventual autonomous construction.
- A catalog of relevant existing systems and integration points at the level needed to understand the vision.
- Rough descriptions of systems that may need to be built, without turning those descriptions into detailed implementation plans.
- A durable umbrella that can later be divided into multiple bounded roadmaps and SPECs.

## Enduring Goals

- Make Fusion Studio feel like one connected system across capabilities, surfaces, and devices.
- Let the default home experience be useful immediately while allowing code, bookkeeping, media, research, and system-management workspaces to be added without changing the product's core mental model.
- Prefer composable plugin surfaces and coherent suites over a growing collection of disconnected, low-density mini-apps.
- Let a conversation carry the working context of its view so returning to the thread also restores the place and materials in which the work was happening.
- Let a universal folder structure support lightweight capture and deeper projects without making conversation creation responsible for filesystem changes.
- Let content initiate the appropriate conversation and workflow with minimal ceremony while keeping the action visible and understandable to the user.
- Give the user one reliable place to see what requires attention and to understand the history and current state of longer-running work.
- Make autonomous work legible enough that the user can inspect progress, failures, handoffs, review points, and completion without micromanaging execution.
- Let the user choose when queued autonomous work begins and delegate ongoing inbox observation without surrendering access to the underlying ticket and work history.
- Support long-running project processes without requiring a continuously active chat turn or constant manual checking.
- Avoid a separate Background Agents mental model by making every autonomous or deferred activity inspectable as a ticket and thread.
- Treat roles and personas as reusable capabilities invoked by work, not as artificial entities the user must manage, track, or maintain relationships with.
- Keep the base product approachable while allowing advanced capabilities to be installed as inspectable, composable folders rather than permanently expanding the core interface.
- Preserve the relationships among inbox, conversation, work, navigation, and context while allowing each future planning branch to remain bounded.
- Provide enough shared vision that future roadmaps and SPECs can align without requiring every branch to reconstruct the whole conversation.

## Success Conditions

- The vision can explain the user's experience across desktop and mobile in broad, coherent terms.
- The inbox taxonomy distinguishes stopped, waiting, active, review, and general-alert states without scattering them across unrelated surfaces.
- A compact item can expand into enough chronological context for the user to understand what happened and act when appropriate.
- An inbox item can become a full-page working artifact or seed a new chat without losing its identity.
- The relationship among events, inbox artifacts, tickets, conversations, and autonomous work is understandable at a conceptual level.
- Returning to a thread can restore the relevant view and its working content rather than presenting conversation history without its surrounding context.
- Creating a chat never creates a project or routine folder, and a thread is not registered until its underlying creation result has been accepted.
- A new project opens into its four-file Markdown-first folder surface, can grow through discoverable file and subfolder patterns, and can host relevant auxiliary tabs and side agents.
- Sending a ticket into a new chat produces a recognizable ticket-named thread and can activate the defined ticket workflow without redundant prompt text.
- Switching Issues threads restores the exact associated content and provides a stable place to observe the work being performed.
- A configured heartbeat is visible and directly accessible from the thread composer while remaining absent when no heartbeat exists.
- A heartbeat can filter the monitored thread's opt-in changes, respond to an authorized condition, update or recover the associated work, and become dormant again.
- Moving or assigning a ticket into In Progress starts the same visible ticket-thread workflow whether the initiating source is a user, schedule, or trigger.
- Automatically created ticket threads appear without stealing the user's active focus.
- A ticket can select a reusable profile or workflow while durable work state remains attributable to the ticket, workflow, project, or event history rather than to a fictional agent identity.
- Installing a plugin reveals what event-bus behavior it enables, chooses sensible defaults, and lets the user change those choices.
- A routine can show what wakes it, what each connected step does, what it may output, and why it woke without relying on an invisible-agent mental model.
- Downloading or placing a plugin folder on disk does not by itself install, activate, or authorize the plugin.
- Long ticket-derived thread titles remain compact in the list while being readable on demand.
- Fusion Home's grouped navigation remains understandable while covering work management, office and personal tools, health and household needs, knowledge, browsing, extensibility, and settings.
- Existing systems that materially shape the vision are cataloged without unnecessary code-level detail.
- Conceptual new-system needs are distinguishable from current capabilities and from approved implementation direction.
- Cross-cutting questions and dependencies remain visible while future roadmap and SPEC families stay separately bounded.
- A reader can understand what should feel seamless even when the detailed implementation has deliberately not been designed.
- On a phone, the user can move among workspaces, view-bound thread lists, persistent notification chats, chat mode, and full app mode without encountering a separate mobile mental model.

## Constraints

- Stay in broad generalities rather than enumerating code systems and specific alterations.
- Inspect or describe existing systems only to the extent needed to understand reuse, integration, or conceptual gaps.
- Describe systems that may need to be built roughly, focusing on purpose and relationships rather than technical design.
- Do not enter full roadmap or SPEC production in this capture.
- Treat future roadmaps and SPECs as multiple bounded descendants of the umbrella vision, not one monolithic plan.
- Preserve current-system facts, owner intent, open questions, and assistant proposals as distinct kinds of information.
- Treat plugin registration and explicit user consent as prerequisites for activation and execution.
- Keep System orientation and view configuration inspectable and user-changeable while ordinary agent actions can read and navigate them without rewriting the policy that governs those actions.

## Non-goals

- A file-by-file or module-by-module change inventory.
- Detailed technical architecture, migrations, APIs, schemas, or implementation sequencing.
- A complete implementation roadmap for the umbrella vision.
- An orchestrator-ready SPEC bundle.
- Product-code changes or canonical Wiki changes during this phase.
