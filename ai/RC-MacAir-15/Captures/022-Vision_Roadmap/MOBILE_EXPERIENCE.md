# Mobile Experience Model

> Broad analysis of Fusion Studio's phone experience and its transition between chat and app views. Owner decisions remain authoritative in DECISIONS.md; this document does not prescribe responsive components, gesture frameworks, breakpoints, or implementation.

## Product Principle

The phone experience is chat-centered without reducing Fusion Studio to a chat application. Conversation is the default home state, and every workspace view remains close enough to enter with one contextual control.

The mobile design unifies chat, workspaces, view-bound threads, notifications, activity context, and full app views in one surface. It does not create a separate lightweight companion product or discard desktop capabilities.

## Chat-Centered State

The main phone screen opens around chat. At the bottom is a familiar chat input bar with a round contextual button immediately to its right.

That round button carries the icon of the active view. If the user is in Wiki, for example, it shows the Wiki icon. The button makes the current relationship between conversation and app context visible without permanently giving the app view most of the screen.

## Chat-Mode Header

In chat mode, the upper-left corner contains the control that opens the slide-out navigation or thread menu. The upper-right corner contains an `event_list` control.

The event list gives the user compact access to activity and context associated with the current work, including:

- files modified;
- subagent status; and
- relevant metadata.

The exact grouping, persistence, and depth of this information remain open. The event list is distinct from the notification inbox: it explains what is happening around the active conversation, while Notifications collects attention routed from workspaces.

## Workspace and Notification Navigation

The thread/navigation menu has a primary-width header showing the current workspace name. Tapping that workspace header changes workspaces. Whether the chooser behaves as a dropdown, slide-up sheet, or another mobile-native control remains open.

A notification bell sits immediately to the left of the workspace header in this menu state. Tapping it replaces the ordinary thread menu with a **Notifications** mode that includes:

- a back arrow at the top;
- **Notifications** as the heading; and
- the notification-thread entries available to open.

Those entries connect to the system-inbox model: each workspace has one persistent notification-handling chat. Selecting the relevant entry opens that chat and its system-level notification context.

The outer menu control and the bell belong to different navigation layers: the first opens the mobile navigation surface from the main chat screen, and the second switches that surface into Notifications mode. Their exact spatial transition can be refined later without changing their roles.

## View and Thread Navigation

When Notifications is not open, the navigation surface exposes the active workspace's view icons along its left side. Selecting a view icon changes the active view and causes the adjacent thread list to switch to that view's threads.

This carries the desktop view-bound threading model onto the phone: view choice determines which threads are relevant, and selecting a thread restores conversation in the context of that view. The workspace header changes the larger workspace boundary; the view icons change location within it; the thread list changes with the selected view.

## Chat-to-App Transition

The round button beside the composer is the bridge from chat mode into the active app view. When the user taps it:

1. The main screen changes from chat to the active view's app surface.
2. The round view button expands across the bottom into the app's navigation bar.
3. The chat input collapses into a compact button with a robot icon.
4. The expanded bottom bar presents the icons needed to navigate the app view.

The result is a reciprocal emphasis shift rather than a route into another product: chat gives most of the screen to the app, while remaining visibly available through the compact robot control.

## App-Mode Chrome

The chat-mode `event_list` button disappears when the app view takes over. The entire top header area becomes available for the active app's own chrome, controls, title treatment, and context.

App mode therefore does not reserve phone header space for controls that only make sense in chat. Different views may use the available header differently while preserving the common bottom-mode relationship between the app surface and compact chat access.

## Cross-Mode Continuity

Chat mode and app mode are two presentations of the same workspace, view, and conversational context. Switching modes should not imply changing workspaces, selecting a different view, or abandoning the active thread.

The desktop and phone layouts can organize controls differently while preserving the same conceptual relationships:

- the workspace contains views;
- the active view determines the relevant thread population;
- the active thread carries conversation and working context;
- Notifications opens the persistent workspace notification chat; and
- the active view can expand to occupy the phone without severing chat continuity.

## Open Questions

- Does the workspace chooser use a dropdown, slide-up sheet, full-screen picker, or an adaptive choice based on device size?
- How does the outer drawer control transition into the workspace header, bell, view icons, and thread list?
- What exact events, metadata, and subagent states appear in `event_list`, and how are noisy or historical entries managed?
- Does selecting an event-list item navigate, attach context to chat, expand details, or offer several actions?
- In Notifications mode, are workspace names the only entries, or can batches and other groupings appear beneath them?
- What information remains visible beside a notification-chat entry on a narrow phone screen?
- Does tapping the compact robot button return directly to the prior chat state, or open another chat control first?
- Which app-view navigation icons belong in the expanded bottom bar, and can plugins extend them?
- How does the app-mode header preserve recognizable placement while allowing each view to use all of its space?
- How are keyboard appearance, safe areas, orientation changes, tablets, and mobile desktop-class layouts handled later?
