# System Inbox Model

> Broad analysis of the universal inbox's role, conceptual relationships, and owner-described direction. This document does not verify current implementation, settle open design choices, or authorize a roadmap, SPEC, or implementation.

## Product Role

The system inbox is intended to be Fusion Studio's universal attention surface: one place where the user can see anything that needs awareness, judgment, review, or intervention. It is not merely the current Issues inbox renamed. It should unify signals from conversation, ticketing, autonomous work, reviews, alerts, and broader system activity while preserving enough context to understand why an item exists.

The inbox should balance two views of the same work:

- A compact row that communicates time, identity, a one-line summary, state icons, and available high-level actions.
- An expandable artifact that explains the item's chronological activity, current state, relevant replies or handoffs, and context-appropriate controls.
- A full-page working view when the item needs the entire content area.

Every inbox item can also start a new chat, carrying the item into a view-bound thread as an attachment.

## Notification Scope and Bell

The upper-left corner of the app contains a bell icon for system-wide notifications. The bell is not a replacement for each workspace inbox. It is the cross-workspace attention layer above them.

Each workspace retains its own inbox organization and notification policy. From that local policy, the user can choose which notifications:

- remain visible only in the workspace inbox;
- also escalate immediately to the system-wide bell; or
- accumulate into a batch for later workspace, system-wide, or combined delivery.

A batch can be released on a schedule or through a trigger combined with durable state. This allows the user to shape interruption and attention deliberately: critical workspace events can become immediate system signals, while lower-urgency activity can arrive as a timed or condition-driven digest.

For example, a rule can observe ten completed jobs, bundle those completions into a single summary notification, place the result in the relevant workspace inbox, and also send it to the system-wide bell. The underlying jobs remain individually inspectable, but they do not each have to interrupt the user.

The bell's relationship to unread counts, acknowledgement, and cross-workspace grouping remains to be shaped. The item-level icon for the **General alert** class is also still a separate visual decision; it does not have to reuse the app-wide bell.

## System-Wide Panel Experience

Clicking the bell brings down a full-screen panel. The panel should feel immediately familiar because it uses the broader app's visual language, but it deliberately removes the normal side-icon navigation.

The panel's left-side navigation contains only workspace names. Each workspace name corresponds to one persistent notification-handling chat. The panel does not expose the workspace's ordinary collection of view-bound threads; selecting the workspace restores its dedicated system-inbox chat and filters the visible cards to notifications contributed by that workspace.

That chat persists with the workspace and is the durable conversational place where the user handles its system-level notifications. The user can discuss, triage, summarize, or act on notification cards without creating a separate chat for every card.

The selected workspace's system-level notifications appear as cards or compact rows in a familiar mail-inbox rhythm. The visual reference is Gmail-like rather than dashboard-like: divider lines establish clear boundaries and make a dense notification list easy to scan.

The workspace-name list may also show a secondary metadata line beneath each name. That remains a proposal until the useful content is known; candidates might eventually include unread state, latest activity, batch timing, or a short attention summary, but none of those fields is approved here.

This is intentionally not a replica of the workspace inbox itself:

- The **workspace inbox** is the richer local work surface for tickets, activity histories, controls, schedules, triggers, and ongoing execution.
- The **system-wide panel** is a cross-workspace notification center composed of concise cards for attention that has been escalated or batched upward, paired with one persistent handling chat per workspace.

The two surfaces refer to related underlying work without requiring the same information density or interaction paradigm. How a card opens or hands the user back to its originating workspace item remains to be shaped.

On phones, the notification center is entered from the bell beside the workspace-name header inside the mobile thread/navigation menu. The thread menu changes into a **Notifications** mode with a back arrow and Notifications heading. Selecting an entry opens the persistent notification-handling chat for the corresponding workspace. This mobile presentation preserves the same workspace-scoped notification chats without reproducing the desktop full-screen panel literally.

## Owner-Reported Existing Foundation

RC reports that the current Issues tracker already has Inbox, Scheduled, and Triggers areas. The system also reportedly has:

- a calendar in Scheduled;
- cron and trigger hooks based on trigger files and YAML frontmatter;
- a rudimentary ticket-generation path;
- rudimentary monitoring of the ticket system; and
- an existing icon treatment for most of the initial alert classes.

These are owner-reported current-system observations and have not yet been verified against the active Wiki or code for this capture. They are candidates for broad integration cataloging, not assumed implementation contracts.

The current ticketing and monitoring foundation is expected to be remade when the separately scoped Provenance roadmap and SPECs are executed. Vision Roadmap should treat that work as a related future dependency and integration point without absorbing its implementation plan.

## Event and Subscription Vision

The present trigger firehose is expected to evolve into a universal subscriber/filter over the system event bus. The broad concept is that events can flow through a common substrate and different parts of Fusion Studio can select the events relevant to them.

Examples named by RC include:

- updating UI state and rendering after a relevant user action;
- reacting when AI edits change a file that is currently open and being viewed;
- producing or updating database records;
- carrying queries and writes resulting from tool calls; and
- carrying queries and writes resulting from system UI activity.

This model is intentionally conceptual. It establishes a shared event-fed relationship among producers, subscribers, the inbox, UI state, files, tools, and persistence without selecting concrete contracts or implementation mechanisms.

Heartbeats can consume a narrower, opt-in projection of this activity. Instead of treating the entire event stream as actionable, a heartbeat monitors the notification changes associated with its thread or inbox item and filters for selected variables or conditions.

## Attention States

The starting alert taxonomy is:

- **AFK stopped:** an autonomous process was expected to continue but quit or stopped unexpectedly.
- **Awaiting user:** an agent or conversation ended its turn and needs a user reply.
- **In process:** work is actively progressing and should remain observable.
- **Needs review:** a result or checkpoint requires user inspection or approval.
- **General alert:** broader informational attention, including completed auto-generated tickets that intentionally bypass the normal completion/review queue.

RC's current visual concept includes date, time, a one-line summary, icons for the alert classes, and checkbox-like controls associated with the icons. Most category icons reportedly exist already. The app-wide notification surface now has a settled bell treatment, while the icon for an individual general-alert item remains open and may use a distinct treatment.

Inbox Alerts may be packaged as an optional plugin. Installing it can enable the relevant inbound and outbound UEB hooks with intelligent defaults while exposing each hook as a user-adjustable toggle.

## Item and Activity Experience

A compact item might read like a timestamped email subject, for example a ticket identity, roadmap title, and current SPEC position. Opening it reveals an activity history rather than a static notification.

The user can expand an item in its list context or open it into the full content area. From there, Send to New Chat creates a thread around the artifact. In Issues, selecting that thread later restores the exact ticket or inbox content in the main area, so the content and its ongoing work remain coupled.

That expanded history can show:

- timestamped stages and nested milestones;
- slice-builder plans or completed task lists;
- validation passes and failures;
- orchestrator receipt and assignment activity;
- transitions between slices or review stages;
- multiple replies when the work is conversational; and
- dropdowns or other controls when the current state warrants an action.

The durable identity boundary is not settled. One long-running ticket or roadmap might accumulate into one inbox artifact, might emit multiple attention items, or might use a parent item with several related activity branches.

## Workflow Integration

The desired end-to-end lifecycle is broader than a notification queue:

1. Launchpad exploration develops enough substance to generate a first-draft ticket.
2. The work returns to the capture/Launchpad area for shaping and review.
3. Issues are identified and addressed.
4. A bounded branch is sent for separately authorized roadmap and SPEC creation.
5. Further review can generate another ticket to update the roadmap and sweep for additional issues, code compliance, Wiki effects, blast radius, and related assurance concerns.
6. Mature work can eventually be built autonomously.

The inbox makes that lifecycle observable. It should show active progress, stopped work, review needs, and completed informational work in one place while allowing the user to inspect the story behind each item.

Tickets can also enter the system through auto-generation and remain queued until the user decides to run them. This separates discovery or generation from execution and supports a user-in-the-loop form of background agency.

An agent may be assigned to monitor an inbox and report significant changes. This allows the user to delegate observation while retaining control over execution and direct access to the underlying items. Significance thresholds, monitoring scope, and notification frequency remain open.

The monitoring agent may establish a heartbeat for the assignment. When the filter matches, the heartbeat can add information or behavior to the existing open inbox item, restart an authorized process, or otherwise respond within its defined scope before returning to sleep.

Scheduled, triggered, and manually assigned work converge on In Progress. A scheduler can copy a reusable ticket template into In Progress when its calendar or cron condition is due. A trigger can create the same transition, while a user can drag a ticket there or use Assign in To Do. The transition invokes the ticket's new-chat workflow and begins assignment without changing the user's active focus.

Triggers can also evaluate derived state rather than reacting only to a single event. For example, Fusion can count sibling tickets in a folder and create another ticket when the configured count or broader state condition is satisfied. This pattern can aggregate, escalate, summarize, or coordinate any number of tickets across any number of locations while still producing an ordinary visible ticket as its output.

One simple aggregation is a completion digest: after ten jobs complete, a rule creates one summary notification and routes it to both the workspace inbox and the system-wide bell. The original jobs retain their own histories; the summary becomes the single attention item.

This makes the ticket lifecycle the universal representation of background work. The system no longer needs a separate Background Agents category: the agent is an executor of a visible ticket, while the ticket, inbox item, thread, and activity history remain the user's stable surfaces.

## Artifact and Template Direction

RC is considering an inbox that holds HTML artifacts. A set of prefilled templates could establish the expected structure with empty placeholder text. Tools could append the next section to an artifact, after which an AI process fills that section.

This direction could make inbox items readable, extensible, and easy for agents to update incrementally. It remains a proposal rather than a settled storage contract.

## Open Design Questions

- Does one ticket, roadmap, or autonomous body of work correspond to one durable inbox artifact, several attention items, or a parent item with child branches?
- Which activity changes append history, and which only update compact row metadata or current state?
- Should icon state, alert class, timestamps, controls, and relationships live inline with the HTML artifact, in a companion JSON record, or in another metadata layer?
- Is the general-alert icon a notification bell, and how should it differ from work that needs action?
- Is there an all-workspaces view in addition to the workspace-name selectors, or does the panel always open on one workspace?
- Does the panel remember its last selected workspace, or choose based on unread priority or the currently active workspace?
- What information and actions belong on a system notification card?
- Which secondary metadata, if any, belongs beneath a workspace name without making the navigation noisy?
- Are notification cards visually bounded containers, mail-style rows separated by dividers, or a hybrid that changes with density?
- How does a card open the corresponding workspace inbox item while preserving the user's current context?
- How does selecting or acting on a card place its context into the persistent workspace notification chat?
- Does the persistent notification chat ever roll over or archive, or does it remain a single durable workspace conversation indefinitely?
- Which notification settings are global defaults, and which can each workspace override?
- How are scheduled or trigger/state batches named, previewed, edited, suppressed, and acknowledged?
- Can one workspace event participate in more than one batch without producing duplicates?
- Which controls belong in the compact row versus the expanded artifact?
- When are multiple replies appropriate, and how do they relate to the product's durable chat/thread identity?
- What distinguishes inline expansion from full-page opening, and does the choice persist per thread?
- How is significance defined for an inbox-monitoring agent, and how are duplicate or noisy alerts suppressed?
- Which auto-generated tickets wait for explicit user execution, and which workflows may still run autonomously by policy?
- Does a heartbeat subscribe to one inbox item, one thread, one view inbox, or a wider project stream?
- How are monitored variables represented and edited without exposing unnecessary raw event complexity?
- Which heartbeat actions require advance approval, confirmation at wake time, or a permanent prohibition?
- How are duplicate assignment events prevented when a ticket is copied, moved, retried, or observed more than once?
- Does the scheduled template remain reusable after instantiation, and how are later template changes related to already-created tickets?
- What happens when automatic thread creation or the attachment-only send fails after the ticket has entered In Progress?
- How are state-derived ticket rules scoped across folders and workspaces, and how do they prevent self-triggering loops?
