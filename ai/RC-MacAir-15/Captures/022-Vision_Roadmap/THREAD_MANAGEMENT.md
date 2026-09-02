# Thread Management Model

> Broad analysis of how content starts, joins, branches, and restores view-bound conversations. Owner decisions remain authoritative in DECISIONS.md; this document does not define message protocols, prompt internals, or implementation.

## Content Actions

Every content surface can expose three related actions:

- **Link** preserves the existing linking behavior.
- **Send to Chat** sends or attaches the content to a selected conversation.
- **Send to New Chat** starts a separate conversation with the content already attached.

The same Send to Chat affordance can target a normal view chat or a side chat embedded in a content tab. This allows an inbox reply surface, browser tab, document view, or other host to reuse the conversation component without inventing a separate message system.

The Send to New Chat icon reuses the empty chat shape and places a plus sign inside it. This makes the relationship between the two chat actions visible: the lined version targets an existing conversation, while the plus version creates one.

The composer also becomes the access point for heartbeats. Initial setup is available from the plus button. Once a heartbeat exists, a `pulse_alert` icon appears between that button and Access permissions and opens the configured heartbeat directly.

The same plus menu can invoke an Agent Profile for the current thread. A workspace may also load a default profile automatically, while ticket frontmatter can request a task-specific profile.

## New Thread Creation

The visible **New Chat** action is one presentation of a reusable view launch action. A view can choose its own label and icon—for example **New Routine**, **New Agent**, or **New Plugin**—while using the same underlying creation path.

The launch recipe may:

- instantiate a fresh content surface;
- create a folder from a template;
- place starter resources such as `AGENTS.md` and capture documents into that folder;
- bind the folder as a worksurface;
- attach existing content; and
- start a new view-bound conversation after the required setup exists.

The folder binding supplies a starting context, not a hard boundary. The default working directory remains whatever project root the harness already provides. A launch recipe can explicitly replace it with the new folder or another authorized location when that behavior is useful.

Send to New Chat creates the thread inside the active view because threads are view-bound. The thread begins with the selected content present as an attachment, ready for the user to add instructions or send the attachment by itself when the view or an installed plugin defines a default interpretation.

In the Issues view, the source may be an inbox row, an expanded item, or a full-page ticket. Any of these can start a new chat while preserving the item's identity and content.

Ticket automation can invoke the same path without taking over the interface. When a ticket enters In Progress, the system performs the equivalent of Send to New Chat and Send. The new ticket thread appears in the left list, but the user's active thread and content remain unchanged.

## Ticket-Derived Thread Identity

When the source content already has a deliberate identity, the new thread can begin with that source-provided title. A ticket's intended seed pattern remains:

`Ticket 000123 - Ticket title`

General automatic naming and later renaming belong to the **Auto-Rename Chat Threads** plugin. That plugin can apply deterministic attachment rules, ticket-aware rules, or an LLM-assisted rename. Candidate attachment rules captured by RC include:

- `Attachment: filename.ext` when an attachment supplies the clearest identity;
- `Ticket: RC-1000345 Chat Threads as Component` for a structured work item;
- `filename.ext — Request to examine file/document` when a vague file arrives without meaningful text; and
- `filename.ext — Summary` when the user supplies text that indicates a summarization request.

The exact rule vocabulary and precedence remain plugin configuration, not a required responsibility of the core thread component.

Ticket and attachment titles may exceed the available thread-list width. The row remains compact normally. While the user hovers over it, a small ticker or scroll effect can reveal the complete name; the effect stops when hover ends.

A later visual enhancement may place a file-type icon in a circle before an attachment-derived thread name, add a paperclip badge, and overlap multiple file circles by roughly one third. This is deliberately deferred from the first composable-chat pass.

## View-Level Guidance

Binding threads to individual views allows each view to supply configuration and guidance appropriate to its domain. The same low-friction action can therefore mean something more specific in Issues than it does in Wiki, Files, Office, Routines, Agent Profiles, Plugins, or another custom surface.

View-level configuration lives in the view folder and uses the same conceptual configuration model as workspace-wide defaults. It can describe the launch label and icon, thread collections, folder-or-tag mode, sensible default switches, optional instructions, working-directory override, transcript destination, and other conversation behavior. A view may ship with useful installed defaults, but the user can change those defaults through the exposed switches afterward. Exact file names, schema, and precedence remain open.

The harness project root remains the default working directory. View-specific instructions or prompts are selected from view configuration rather than by changing the working directory. A view can still opt into a different working directory when a launch recipe creates or assigns a more useful worksurface.

Thread selection drives only the content worksurface state that makes the thread resumable. Clicking among threads in Issues can change the main area to the ticket or inbox artifact bound to each thread; another view may restore tabs, documents, URLs, selections, and scroll positions. Chat and thread navigation remain independently hideable shell elements.

Threads within a view can be organized into configurable collections. The default collection is **Threads**. In folder mode, each thread has one collection assignment; in tag mode, it may have more than one. Collections may be added, renamed, or deleted, with deletion reassigning rather than deleting their threads.

## Ticket-Agent Activation

The Issues flow uses an attachment-only send as a meaningful command:

1. The user chooses Send to New Chat on a ticket.
2. Fusion creates a view-bound chat seeded with the ticket's identity and attaches it.
3. The user presses Send without entering additional instructions.
4. The assistant adopts the ticketing-agent role and begins the defined ticket workflow.

If the user adds instructions, those instructions should inform the turn rather than being discarded. The precise rule for how explicit instructions modify or override the default ticket-agent workflow is not yet settled.

## Skills and Workflow Definition

The ticketing-agent role, heuristics, and workflow will be defined in the Skills section. This keeps the behavior visible and maintainable as part of Fusion Studio's extensibility system instead of hard-coding a large workflow into the attachment action itself.

The selected profile becomes the persona or capability mask of the executing thread. Ticket frontmatter can name that profile, while the thread may also invoke the same profile as a subagent when a narrower task needs it. The profile does not become a persistent entity merely because the thread uses it.

Side-chat continuation uses the same principle. A newly created chat remains a separate context, but an agent or helper can read the prior conversation and prepare a bounded handoff when the user wants to continue rather than branch into a new subject.

At the vision level, the division of responsibility is:

- the content action creates or seeds the conversation;
- the active view supplies domain context and default interpretation;
- the attachment identifies the work object;
- the view launch recipe prepares any content surface or folder worksurface;
- Skills define reusable roles and workflows;
- plugins supply optional policy such as automatic thread naming; and
- the user's explicit instructions retain authority over the particular turn.

## Open Questions

- Which view launch actions run immediately, and which require a preview before creating folders or starter documents?
- What universal configuration fields belong at both workspace and view scope, and which are view-specific?
- What precedence applies among workspace defaults, view defaults, user switches, launch-time options, ticket frontmatter, and explicit prompt instructions?
- How are multiple attachments interpreted when more than one could imply a workflow or name?
- Can a user select a different Skill or role before sending the new thread?
- How are ticket-created threads grouped with daily, manual, side-chat, and long-lived threads in the same view?
- Does the hover ticker pause, restart, or support reduced-motion preferences?
- When queued work has not started, what state and controls appear in its thread and full-page artifact?
- How does a monitoring agent attach reports to the relevant inbox item or thread without overwhelming the primary activity history?
- Can one thread own multiple heartbeats, and how does the composer represent that without losing the single direct-access affordance?
- When an AI creates a heartbeat, what must be shown or confirmed before the heartbeat becomes active?
- How does automated attachment-only dispatch distinguish first assignment from retry or resumed execution?
- What thread-list indicator reveals that a new assigned thread appeared without shifting focus?
- When ticket frontmatter, view guidance, and explicit user choice name different profiles, which source wins?
- Does invoking a profile from the plus menu replace the workspace default or layer an additional capability mask?
- What transcript format is saved, and how do explicit destinations interact with a passed worksurface binding?
