# Thread Management Model

> Broad analysis of how content starts or joins view-bound threads and how ticket context activates view-specific behavior. Owner decisions remain authoritative in DECISIONS.md; this document does not define message protocols, prompt internals, or implementation.

## Content Actions

Every content surface will expose three related actions:

- **Link** preserves the existing linking behavior.
- **Send to Chat** attaches or sends the content to the current chat and keeps the existing lined chat icon.
- **Send to New Chat** creates a new chat with the content already attached.

The Send to New Chat icon reuses the empty chat shape and places a plus sign inside it. This makes the relationship between the two chat actions visible: the lined version targets the current conversation, while the plus version creates a conversation.

The composer also becomes the access point for heartbeats. Initial setup is available from the plus button. Once a heartbeat exists, a `pulse_alert` icon appears between that button and Access permissions and opens the configured heartbeat directly.

The same plus menu can invoke an Agent Profile for the current thread. A workspace may also load a default profile automatically, while ticket frontmatter can request a task-specific profile.

## New Thread Creation

Send to New Chat creates the thread inside the active view because threads are view-bound. The new thread begins with the selected content present as an attachment, ready for the user to add instructions or send the attachment by itself when the view defines a default interpretation.

The behavior provides a consistent path from any content into focused work without requiring the user to create a thread first, navigate back to the content, and attach it manually.

In the Issues view, the source may be an inbox row, an expanded item, or a full-page ticket. Any of these can start a new chat while preserving the item's identity and content.

Ticket automation can invoke the same path without taking over the interface. When a ticket enters In Progress, the system performs the equivalent of Send to New Chat and Send. The new ticket thread appears in the left list, but the user's active thread and content remain unchanged.

## Ticket-Derived Thread Identity

When the attached content is a ticket, the new thread inherits the ticket's identity and title. The intended naming pattern is:

`Ticket 000123 - Ticket title`

Ticket titles may exceed the available thread-list width. The row remains compact normally. While the user hovers over it, a small ticker/scroll effect reveals the complete name; the effect stops when hover ends.

## View-Level Guidance

Binding threads to individual views allows each view to supply system messages and heuristics appropriate to its domain. The same low-friction action can therefore mean something more specific in Issues than it does in Wiki, Files, Office, or another plugin surface.

View-level guidance supplies the context needed to interpret attachment-only sends without requiring every content object to carry a full workflow prompt. The exact precedence and composition of view guidance, user instructions, attachments, Skills, and other context remain open.

Thread selection also drives view content. Clicking among threads in Issues changes the main area to the ticket or inbox artifact bound to the selected thread. Returning to a thread therefore restores both its conversation and the exact content through which the work is being performed or observed.

## Ticket-Agent Activation

The Issues flow uses an attachment-only send as a meaningful command:

1. The user chooses Send to New Chat on a ticket.
2. Fusion creates a view-bound chat named from the ticket and attaches it.
3. The user presses Send without entering additional instructions.
4. The assistant adopts the ticketing-agent role and begins the defined ticket workflow.

If the user adds instructions, those instructions should inform the turn rather than being discarded. The precise rule for how explicit instructions modify or override the default ticket-agent workflow is not yet settled.

## Skills and Workflow Definition

The ticketing-agent role, heuristics, and workflow will be defined in the Skills section. This keeps the behavior visible and maintainable as part of Fusion Studio's extensibility system instead of hard-coding a large workflow into the attachment action itself.

The selected profile becomes the persona or capability mask of the executing thread. Ticket frontmatter can name that profile, while the thread may also invoke the same profile as a subagent when a narrower task needs it. The profile does not become a persistent entity merely because the thread uses it.

At the vision level, the division of responsibility is:

- the content action creates and seeds the conversation;
- the active view supplies domain context and default interpretation;
- the attachment identifies the work object;
- the Skills section defines the reusable role and workflow; and
- the user's explicit instructions retain authority over the particular turn.

## Open Questions

- What happens when Send to New Chat is used from content that has no natural title?
- Does attachment-only activation require an explicit empty-send affordance, or is the attachment itself treated as sufficient prompt content?
- How are multiple attachments interpreted when more than one could imply a workflow?
- How do explicit user instructions extend, narrow, or override the view's default heuristic?
- Can a user select a different Skill or role before sending the new thread?
- How are ticket-created threads grouped with daily, manual, and long-lived threads in the same view?
- Does the hover ticker pause, restart, or support reduced-motion preferences?
- When queued work has not started, what state and controls appear in its thread and full-page artifact?
- How does a monitoring agent attach reports to the relevant inbox item or thread without overwhelming the primary activity history?
- Can one thread own multiple heartbeats, and how does the composer represent that without losing the single direct-access affordance?
- When an AI creates a heartbeat, what must be shown or confirmed before the heartbeat becomes active?
- How does automated attachment-only dispatch distinguish first assignment from retry or resumed execution?
- What thread-list indicator reveals that a new assigned thread appeared without shifting focus?
- When ticket frontmatter, view heuristics, and explicit user choice name different profiles, which source wins?
- Does invoking a profile from the plus menu replace the workspace default or layer an additional capability mask?
