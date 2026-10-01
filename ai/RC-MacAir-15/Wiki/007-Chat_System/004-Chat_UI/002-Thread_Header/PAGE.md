---
name: Chat Thread Header
description: Header Copy Link, Side Chat controls and the owning view’s collapsed thread rail.
metadata:
  source-files:
    - fusion-studio-client/src/components/chat/ChatAreaHeader.tsx
    - fusion-studio-client/src/styles/dropdown.css
    - fusion-studio-client/src/clipboard/clipboard-api.ts
    - fusion-studio-client/src/components/chat/useChatSessionHost.ts
    - fusion-studio-client/src/components/chat/useChatSessionActions.ts
    - fusion-studio-client/src/components/chat/ConnectedChatHeader.tsx
    - fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx
    - fusion-studio-client/src/components/chat/ThreadRail.tsx
    - fusion-studio-client/src/components/Sidebar.tsx
    - fusion-studio-client/src/components/Sidebar.css
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
  last-modified: "2026-09-28T04:56:08Z"
---

The thread header presents group and session actions for its addressed chat. Header Copy Link sends `copy_link` with the group and session IDs; it copies the server-acknowledged version-1 application URI, not a raw `threadId`. The current requester handler uses `navigator.clipboard.writeText` and toast feedback directly. It does not call the managed clipboard-history helper, so managed-history integration must not be assumed from the copy action. See [Menus And Modals](../005-Menus_And_Modals/PAGE.md#side-chat-member-menu) for exact-member links and the separate navigation gap.

## Identity Rule

A session `threadId`, a Thread Group link, and a saved reply's Chat ID have different purposes. Reply chrome Chat ID copies SQLite `exchanges.id`; do not substitute the session or group identity for a saved exchange.

## Side Chat Header Controls

The current shared header still exposes a left-hand Show threads control and a right-hand More options/list control for a Side Chat. `useChatSessionActions` changes the owning view's `leftSidebar` state; it does not create a rail inside the tab. The right-hand portal menu also exposes the same Show/Hide threads action.

Owner direction removes the Side Chat tab's left-hand control and sliding thread-panel behavior, retaining the right-hand list button with its future shared behavior still undefined. That control removal remains a product gap. See [Chat UI](../PAGE.md#main-chat-side-chat-and-move).

## Collapsed Thread Rail

`Sidebar` and `ThreadRail` belong to the owning view's outer shell. `Sidebar.css` supplies the collapsed hover/focus preview without creating a nested rail in Side Chat. Its pin/toggle action restores the outer view sidebar; passive row opening hydrates the selected group without warming a harness. This is view-bound shell behavior, not a surviving null-view Legacy production host.
