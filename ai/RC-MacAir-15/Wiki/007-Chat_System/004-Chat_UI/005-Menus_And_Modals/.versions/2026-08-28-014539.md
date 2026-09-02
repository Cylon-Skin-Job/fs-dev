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

## Accessibility

Icon buttons and menu items need explicit `aria-label` and `title` attributes.
