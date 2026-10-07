---
name: Custom Theme CSS
description: Current Theme Picker and workspace CSS customization, including fixed-loader limits.
metadata:
  source-files:
    - fusion-studio-client/src/components/ThemePicker.tsx
    - fusion-studio-client/src/lib/theme/live-preview.ts
    - fusion-studio-client/src/hooks/useSharedWorkspaceStyles.ts
    - fusion-studio-client/src/lib/panels.ts
    - fusion-studio-server/lib/theme/themes-service.js
    - fusion-studio-server/lib/ws/theme-handlers.js
    - fusion-studio-client/src/lib/ws/theme-handlers.ts
  last-modified: "2026-09-28T04:16:38Z"
---

## Use the Theme Picker

The Theme Picker changes workspace palette values and previews them immediately. Saving the user theme stores an entry in `ai/<machine>/System/styles/themes.json` and regenerates `themes.css`. The picker offers Light, Custom and Dark modes, with controls grouped as Workspace, Thread, Navigation, Chat and Content. [Themes And State](../../005-Enforcement/002-Themes_And_State/PAGE.md) owns the generated tokens and cascade contract.

## Hand-authored CSS today

Shared workspace styles currently live under `ai/<machine>/System/styles/`. The client loads a fixed file list; adding an arbitrary `custom-noir.css` file there does not apply it. For an authorized workspace-wide change, edit an already loaded authored layer with a saved preimage and follow existing CSS variables. Do not hand-edit or move generated `themes.css`: theme activation or save can replace it. A current view capsule may separately provide optional `styles/themes.css` as a scoped override; follow the view path rules in Themes And State.

A new shared layer requires a product code change to the fixed loader list and any preload paths that need it. That is development work, not a file-drop setup step. Theme refresh can reappend `themes.css` after the other layers, so the nominal file list is not a permanent cascade-priority guarantee. Back up authored CSS before editing it.

Editable view instances outside `System` are approved direction, not today's location. An instance's theme or persona cannot grant it plugin capability or executable behavior. [View Configuration And Agents](../../001-Workspaces_And_Views/022-View_Configuration_And_Agents/PAGE.md) explains the protected plugin boundary.
