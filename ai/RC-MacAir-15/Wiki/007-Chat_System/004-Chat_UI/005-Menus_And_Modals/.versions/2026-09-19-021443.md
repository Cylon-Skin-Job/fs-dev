---
name: Chat Menus And Modals
description: Dropdown, pop-up, modal, component boundary, accessibility, and styling rules for chat UI.
metadata:
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

## Side Chat Member Menu

The shared thread-row kebab exposes the group's non-primary members as a nested
"Side chats" group. Each member entry opens/focuses that member's Side Chat and
carries a trailing Copy Link control for the exact-member version-1 application
link. Both emit canonical `thread:action` intents (`open_member_in_side`,
`copy_link`) and touch no store directly. The current Main Chat is never a
member target.

The member group currently renders inside the existing ThreadRail kebab
(`.rv-thread-menu-dropdown`) rather than the portal `components/menu/` module.
This is an accepted SPEC-04 carry (04C-D6 / 04D): the kebab predates SPEC-04 and
is asserted by the accepted threaded-chat-host lane, so migrating the whole
kebab to the portal module is a broader menu-migration task tracked outside this
roadmap.

## Accessibility

Icon buttons and menu items need explicit `aria-label` and `title` attributes.
