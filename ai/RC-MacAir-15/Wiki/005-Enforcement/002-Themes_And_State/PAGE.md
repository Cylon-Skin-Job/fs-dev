---
name: Themes and State
description: V2 boundary between workspace-wide theme styling and per-view layout state.
metadata:
  incoming-edges:
    - Enforcement
    - Code Standards
  outgoing-edges: []
  source-files:
    - fusion-studio-client/src/hooks/useSharedWorkspaceStyles.ts
    - fusion-studio-client/src/lib/viewActivity.ts
    - fusion-studio-client/src/lib/viewCollections.ts
    - fusion-studio-client/src/lib/officePaperBrightness.ts
    - fusion-studio-client/src/components/PaperBrightnessControl.tsx
    - fusion-studio-server/lib/view-state/resolver.js
    - fusion-studio-server/lib/view-state/writer.js
    - fusion-studio-server/lib/workspace/workspace-state.js
    - ai/<machine>/System/styles/themes.json
    - ai/<machine>/System/styles/themes.css
  connected-skills:
    - css-conventions
  related-trigger-files: []
---

# Themes and State

This page defines the V2 filesystem boundary for styling and layout state. The short version: workspace-wide CSS lives in `System/styles`, per-view CSS and icons live in each view capsule's `styles` folder, and per-view UI state lives in each view capsule's `state` folder.

## V2 Paths

| Concern | Path | Scope |
|---------|------|-------|
| Workspace theme source | `ai/<machine>/System/styles/themes.json` | Whole workspace |
| Generated workspace theme CSS | `ai/<machine>/System/styles/themes.css` | Whole workspace |
| Shared workspace CSS layers | `ai/<machine>/System/styles/*.css` | Whole workspace |
| Workspace default state | `ai/<machine>/System/state/state.json` | Whole workspace fallback |
| Workspace shell state | `ai/<machine>/System/state/state.json` under `workspace` | Whole workspace |
| Per-view layout CSS | `ai/<machine>/Views/<view-folder>/styles/layout.css` | One view |
| Per-view theme override | `ai/<machine>/Views/<view-folder>/styles/themes.css` | One view |
| Sidebar icon | `ai/<machine>/Views/<view-folder>/styles/icon.md` | One view |
| Per-view state override | `ai/<machine>/Views/<view-folder>/state/state.json` | One view |
| CLI policy | `ai/<machine>/System/config/cli.json` | Whole workspace |

Do not use retired non-machine-scoped view, settings, or system paths. V2 is machine-scoped under `ai/<machine>/`.

## View Folder Contract

The numbered view folder is the storage boundary for view-local metadata. The folder name `NNN-view-id` controls sidebar order through its numeric prefix, while `manifest.md` owns the durable `view-id`. Keep sidebar icons in the view's `styles/icon.md` file and view-specific UI state in the view's `state/state.json` file. Do not move either concern into global registries, workspace state, or retired `settings/` folders.

## CSS Loading

Global CSS is fetched from `ai/<machine>/System/styles/`. The client injects the shared layers in a stable order so defaults load before overrides:

1. `variables.css`
2. `themes.css`
3. `components.css`
4. `views.css`
5. `tints.css`

Per-view CSS is fetched from the active view capsule under `ai/<machine>/Views/<view-folder>/styles/`. `layout.css` is for geometry and structure. `themes.css` is an optional manual override for one view. Icon selection comes from `styles/icon.md`.

## State Loading

State is resolved per view:

1. Load workspace defaults from `ai/<machine>/System/state/state.json`.
2. Load the view override from `ai/<machine>/Views/<view-folder>/state/state.json` when it exists.
3. Deep-merge workspace defaults with the view override.

Workspace shell state also lives in `ai/<machine>/System/state/state.json`. The `workspace.currentPanel` field stores the active view panel for that workspace, so switching away and back returns to the same built-in or custom view. Do not store this in server-global runtime files.

State files own geometry and UI placement such as pane widths, collapsed flags, popup dimensions, selected thread IDs, view modes, scroll positions, drawer state, activity, and collections. They do not own colors, backgrounds, borders, or icon names.

Shared per-view activity and collections also live in state:

- `activity.recents` stores recent files/pages/documents and is capped at 100 items/365 days.
- `activity.navigation` stores back/forward stacks for views such as Wiki.
- `activity.tabs` and `activity.activeTabId` store File Explorer open tabs.
- `collections.starred` stores starred files for Capture and Office.
- `collections.pinnedFolders` stores Office pinned folders.
- `officeDocumentSidePanel` stores whether the Office document Recent drawer is open.
- `officePaperBrightness` stores the Office paper mute control used by document pages and thumbnail previews.

Use `viewActivity.ts` and `viewCollections.ts` for these mutations. Do not create separate recent-doc, starred-doc, or pinned-folder state files.

## Rules

- Built-in views are React surfaces. Do not add iframe theme-bridge requirements for built-in views.
- Custom and browser-style iframe surfaces inherit the surrounding shell CSS but are not the storage model for built-in view styling.
- Do not create or read retired per-view `settings/` files. V2 per-view files belong under `styles/` or `state/`.
- Do not put view state in `styles/`; view state belongs in `state/state.json`.
- Do not put icons in JSON registries; sidebar icons belong in `styles/icon.md`.
- Do not put recents, starred files, pinned folders, or open tabs in SQLite or ad hoc JSON when they are view-local UI state. Use the per-view state helpers.
- Do not programmatically create per-view CSS as a workaround for missing theme variables. Add shared variables to `System/styles` instead.

## Quick Reference

| Change | File |
|--------|------|
| Workspace colors or tint toggles | `ai/<machine>/System/styles/themes.json` |
| Last active workspace view panel | `ai/<machine>/System/state/state.json` under `workspace.currentPanel` |
| Generated theme CSS | `ai/<machine>/System/styles/themes.css` |
| Shared chrome/component CSS | `ai/<machine>/System/styles/views.css` or `components.css` |
| A view's layout CSS | `ai/<machine>/Views/<view-folder>/styles/layout.css` |
| A view's sidebar icon | `ai/<machine>/Views/<view-folder>/styles/icon.md` |
| A view's UI state override | `ai/<machine>/Views/<view-folder>/state/state.json` |
| View recents, stars, pins, tabs | `ai/<machine>/Views/<view-folder>/state/state.json` |
| Harness defaults and allow-list | `ai/<machine>/System/config/cli.json` |
