---
name: Chat Menus And Modals
description: Dropdown, pop-up, modal, component boundary, accessibility, and styling rules for chat UI.
metadata:
  last-modified: "2026-09-19T10:34:31Z"
  incoming-edges:
    - Chat UI
  outgoing-edges:
    - Reply Action Chrome
    - Chat Styling And Workspace CSS
  source-files:
    - fusion-studio-client/src/styles/dropdown.css
    - fusion-studio-client/src/components/chat/ChatAreaHeader.tsx
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - ai/<machine>/System/styles/views.css
    - fusion-studio-client/src/components/chat/ThreadRail.tsx
    - fusion-studio-client/src/components/chat/useViewChatHost.ts
    - fusion-studio-client/src/lib/ws/thread-handlers.ts
    - fusion-studio-server/lib/thread-groups/member-service.js
    - fusion-studio-server/lib/thread-groups/link-service.js
    - fusion-studio-client/src/components/chat/useLegacyChatHost.ts
  connected-skills: []
  related-trigger-files: []
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

Current Side Chat tabs render one chat without a nested ThreadRail. The left-hand `dock_to_right` / Show threads button toggles the owning view dock state. The separate right-hand `event_list` / More options button opens the existing menu; its Show threads item currently invokes the same callback. These controls are active current behavior, not the future list design. Owner direction removes the left-hand control and sliding thread-panel behavior while retaining the right-hand list button; the retained button's future shared action is unresolved. See [Chat UI](../PAGE.md#main-chat-side-chat-and-move) for the production host map and product gap.

## Side Chat Member Menu

In a view host that supplies member callbacks, the shared ThreadRail row kebab exposes the group's non-primary members as a nested "Side chats" group. Selecting a member emits `open_member_in_side` with the group and exact member IDs. The server validates the member and its supported view, then reuses its lifetime Side Chat placement. Its completion handler in `thread-handlers.ts` sets that view's active placement and requests the group's worksurface entry so the existing host can materialize it. The current primary is excluded; this action does not create a session, promote a member, or advance MRU.

Each member entry also has a trailing Copy Link control. It emits `copy_link` for that exact member; the requester copies the server-returned version-1 URI only after acknowledgement. Copying the row's link names its current primary, and omitting `threadId` from a Copy Link request also encodes the current primary. A genuinely group-only URI omits the member ID and follows the primary at resolution time.

Copy Link success does not establish navigation success. Exact non-primary `resolve_link` responses contain server placement identities but currently have no renderer read/focus consumer: an already-open unselected tab can remain unselected, and a persisted reopen does not itself prove a visible tab reopened. This source-derived integration gap is separate from the implemented menu consumer. See [Group and exact-member links](../../002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md#group-and-exact-member-links) for validation, response handling, and intended presentation.

The member group currently renders inside the existing ThreadRail kebab (`.rv-thread-menu-dropdown`) rather than the portal `components/menu/` module. A migration of the whole existing kebab to the shared portal module is separate future menu work; the current member-menu behavior does not depend on that migration.

## Accessibility

Icon buttons and menu items need explicit `aria-label` and `title` attributes.
