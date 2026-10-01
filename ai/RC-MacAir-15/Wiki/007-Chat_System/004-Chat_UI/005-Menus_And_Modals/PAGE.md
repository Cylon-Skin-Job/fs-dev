---
name: Chat Menus And Modals
description: Dropdown, pop-up, modal, component boundary, accessibility, and styling rules for chat UI.
metadata:
  source-files:
    - fusion-studio-client/src/styles/dropdown.css
    - fusion-studio-client/src/components/chat/ChatAreaHeader.tsx
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - ai/<machine>/System/styles/views.css
    - fusion-studio-client/src/components/chat/ThreadRail.tsx
    - fusion-studio-client/src/components/chat/ThreadRailRowMenu.tsx
    - fusion-studio-client/src/components/chat/useViewChatHost.ts
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
    - fusion-studio-server/lib/thread-groups/member-service.js
    - fusion-studio-server/lib/thread-groups/link-service.js
    - fusion-studio-client/src/components/chat/useChatSessionHost.ts
    - fusion-studio-client/src/components/chat/useChatSessionActions.ts
    - fusion-studio-client/src/components/chat/ConnectedChatHeader.tsx
  last-modified: "2026-09-28T04:56:08Z"
---

Chat menus and modals should match the existing thread ellipses and composer
chrome aesthetic.

## Component Boundary

Presentational components accept data and callbacks. They do not import API
modules, clipboard modules, server services, or global state writers directly.

Hooks/controllers own local modal state and wire callbacks to action/API
modules.

## Styling

- Use `.rv-`-prefixed class names.
- Use workspace/system CSS variables with fallbacks for every authored value.
- New classes are preferred when customization is likely, but they must consume
  the same variables as existing chat chrome and dropdowns.
- Do not hardcode colors, spacing, radius, shadows, z-index, or transitions.

## Side Chat Header Menu

Side Chat tabs render one session without a nested `ThreadRail`. The left Show threads control and the right-hand menu's Show/Hide threads item currently toggle the owning view's outer sidebar through `useChatSessionActions`. Owner direction removes the left-hand control and its sliding thread-panel behavior; the retained right-hand list button's future shared action remains undefined. [Chat UI](../PAGE.md#main-chat-side-chat-and-move) owns this current-versus-target distinction.

## Side Chat Member Menu

In a view host that supplies member callbacks, the shared ThreadRail row kebab exposes the group's non-primary members under a "Side chats" heading. Selecting a member emits `open_member_in_side` with the group and exact member IDs. The server validates the member and its supported view, then reuses its lifetime Side Chat placement. Its completion handler in `thread-handlers.ts` sets that view's active placement and requests the group's worksurface entry so the existing host can materialize it. The current primary is excluded; this action does not create a session, promote a member, or advance MRU.

Each member also has a separate Copy link action. It emits `copy_link` for that exact member; the requester copies the server-returned version-1 URI only after acknowledgement. Copying the row's link names its current primary, and omitting `threadId` from a Copy Link request also encodes the current primary. A genuinely group-only URI omits the member ID and follows the primary at resolution time.

Copy Link success does not establish navigation success. Exact non-primary `resolve_link` responses contain server placement identities but currently have no renderer read/focus consumer: an already-open unselected tab can remain unselected, and a persisted reopen does not itself prove a visible tab reopened. This source-derived integration gap is separate from the implemented menu consumer. See [Group and exact-member links](../../002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md#group-and-exact-member-links) for validation, response handling, and intended presentation.

`ThreadRailRowMenu` now opens the shared portal menu through `openMenuTree`. The Side chats heading, member-open actions and per-member Copy link actions are descriptors in that menu. `ChatAreaHeader` uses the same menu module for its options. The older claim that this migration is still future work is no longer current.

## Accessibility

Icon buttons and menu items need explicit `aria-label` and `title` attributes.
