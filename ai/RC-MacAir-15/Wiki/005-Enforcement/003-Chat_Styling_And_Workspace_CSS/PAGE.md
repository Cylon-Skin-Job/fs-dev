---
name: Chat Styling And Workspace CSS
description: Chat-specific styling constraints, workspace CSS source of truth, and class/token rules.
metadata:
  incoming-edges:
    - Enforcement
    - Chat Menus And Modals
  outgoing-edges:
    - Code Standards
    - Themes And State
  source-files:
    - fusion-studio-client/src/hooks/useSharedWorkspaceStyles.ts
    - fusion-studio-client/src/styles/dropdown.css
    - ai/<machine>/System/styles/views.css
  connected-skills:
    - css-conventions
  related-trigger-files: []
---

Use this page before changing chat-specific CSS.

Chat visual style is owned by workspace/system CSS and theme variables. The
frontend should not hardcode theme values or invent a separate visual language
for chat controls.

## Rules

- New class names are allowed and often preferred for customization.
- New classes must use the same variables as existing chat chrome, composer
  icons, and thread ellipses menus.
- Every authored color, spacing, radius, shadow, z-index, and transition value
  uses a CSS variable with a fallback.
- Do not put component-specific styles into broad global CSS unless the style is
  genuinely shared global chrome.
- Menus should follow the existing `.rv-dropdown` and `.rv-dropdown-item`
  aesthetic even when class names differ.

## Source Of Truth

Workspace/system style files are loaded from disk by the app. Agents should
check the current CSS loading path before assuming a value lives in frontend
source.
