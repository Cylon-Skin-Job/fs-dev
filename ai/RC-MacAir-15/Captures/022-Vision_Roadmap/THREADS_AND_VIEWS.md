# Threads and Views Model

> Broad analysis of the relationship among navigation, views, threads, and restored working context. Owner decisions remain authoritative in DECISIONS.md; this document does not prescribe storage, APIs, migrations, or implementation.

## Navigation Relationship

The current navigation bar sits on the right. The intended experience moves it to the left beside the thread list. This places two related forms of orientation together:

- navigation answers where the user is in Fusion Studio; and
- threads represent the conversations and work contexts available within that location.

The detailed left-side layout and interaction behavior are not yet defined. The settled direction is the adjacency of navigation and threads, not a particular component structure.

## View-Bound Thread Identity

Threads are currently workspace-wide. The new direction binds each thread to an individual view.

This makes a thread more than a conversation that happens somewhere in the workspace. It becomes the durable conversational context of a particular view. The view provides the product surface and capabilities; the thread preserves the conversation associated with work in that surface.

The existing documented chat system treats the thread as the durable conversational identity and uses `threadId` for routing. The vision changes the thread's product placement and context relationship without yet deciding how the existing identity and routing model will be adapted.

## Per-Thread View State

Each thread needs to preserve the content state of its bound view. Examples explicitly named by RC include:

- which tabs were open;
- which documents were open; and
- other view-specific content state needed to resume the thread's working context.

The desired experience is contextual return: selecting a thread should restore not only its messages, but also the relevant working materials and arrangement inside its view.

This capture deliberately does not define the persistence representation, ownership boundary, synchronization strategy, or exact list of state fields.

## Experience Consequences

View binding and per-thread content state create a foundation for features that would be harder to express with workspace-wide conversations. A thread can reopen into a recognizable place, preserve the materials that gave its conversation meaning, and allow navigation, content, and chat to operate as one context.

Fusion Home's grouping adds a density consideration to view binding. Several related but individually low-density capabilities—such as Email, Calendar, To Do, Notes, and Contacts—will share a Productivity Suite view rather than each owning a separate left-navigation icon and thread population. This makes the bound view a meaningful domain context rather than a miniature application boundary.

RC is considering one daily thread for the Productivity Suite and a daily thread when lower-density views such as Health & Fitness are opened. That idea remains provisional until the complete Thread Management behavior is described.

The system-wide inbox introduces a deliberate workspace-level exception to ordinary view thread lists. Its navigation shows one entry per workspace, and each entry restores one persistent chat dedicated to handling that workspace's escalated notification cards. The workspace name therefore acts as both the system-inbox filter and the identity of its notification-handling thread; the panel does not expose all of the workspace's normal view-bound threads.

On phones, view-bound threading becomes spatially explicit inside the slide-out navigation surface. The active workspace's view icons appear along the left; selecting an icon changes the active view and swaps the adjacent thread list to that view's conversations. The workspace-name header changes the workspace boundary, while Notifications mode temporarily replaces the ordinary view/thread navigation with persistent workspace notification chats.

The phone's chat-to-app transition preserves the same identity. The round current-view button beside the composer opens the active app view without implying a different thread, and the collapsed robot control keeps chat visibly attached to that view context.

The first defined creation path is content-driven: any content can be sent to the current chat or used to start a new chat with the content attached. Because the new thread belongs to the active view, view-level guidance can interpret the attachment and choose an expected workflow. A ticket attached to a new chat can therefore become a ticket-named thread and activate ticket-agent behavior when the user sends it without adding instructions.

## Open Questions

- Can a thread ever move between views, or is its view binding permanent?
- Can one thread intentionally reference or control content in another view while remaining bound to its own view?
- Which parts of view state belong to the thread, and which remain shared view or workspace state?
- When a thread is selected, does its complete content state restore automatically or selectively?
- How do mobile and desktop represent the same view-bound thread when their available layouts differ?
- How will an inbox item open the correct view-bound thread and its restored context, if that relationship is adopted later?
- When does a daily view thread begin, roll over, resume, archive, or coexist with longer-lived threads?
- Does one daily thread span every capability inside a suite, and how does it preserve which sub-surface was active?
- How do content-created, ticket-created, daily, manual, and longer-lived threads coexist and sort inside one view?
- How is the persistent system-inbox chat related to ordinary view-bound threads when a notification opens its source work?
- When the phone switches from chat to app mode, which parts of thread-specific view state are restored immediately and which wait until the user opens them?
