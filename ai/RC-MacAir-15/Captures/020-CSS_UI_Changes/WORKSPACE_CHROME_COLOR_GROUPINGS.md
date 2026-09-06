---
name: Workspace Chrome Color Groupings
description: Current owner direction for grouping workspace header and primary navigation elements under the Workspace Foreground and Workspace Accent controls.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files:
    - fusion-studio-client/src/components/App.tsx
    - fusion-studio-client/src/components/App.css
    - fusion-studio-client/src/components/Fusion/fusion.css
    - fusion-studio-client/src/components/WorkspaceTitle.css
    - fusion-studio-client/src/components/ToolsPanel.css
    - fusion-studio-client/src/components/capture/CaptureTabStrip.css
    - fusion-studio-client/src/components/capture/DocViewerHeader.tsx
    - fusion-studio-client/src/components/file-explorer/FileViewer.tsx
    - fusion-studio-client/src/lib/theme/live-preview.ts
    - fusion-studio-client/src/styles/variables.css
    - ai/RC-MacAir-15/System/styles/capture-viewer.css
    - ai/RC-MacAir-15/System/styles/file-viewer.css
  connected-skills: []
  related-trigger-files: []
---

## Direction

Workspace header and primary-navigation colors are organized into two semantic groups: **Foreground** for the normal workspace chrome and **Accent** for the two states that need to stand apart. These are behavioral groupings. The elements do not need to share one CSS class, but every element in a group must respond to the same Workspace Settings control.

## Workspace Foreground Group

The Workspace Settings **Foreground** control targets:

- Header text, including the workspace name and other ordinary header labels.
- All ordinary header icons and navigation buttons.
- Sidebar view icons that are not currently selected.

## Workspace Accent GroupOkay

The Workspace Settings **Accent** control targets:

- The Connected indicator.
- The currently selected view icon.

The selected-view state overrides the icon's normal membership in the Foreground group for as long as that view remains selected.

## Upper-Right Header Icon Pattern

The upper-right header actions establish the reference pattern for comparable icon-button clusters elsewhere in Fusion Studio. Reuse the same button size, glyph size, gap, and distance from the trailing edge so separate clusters feel like one component system.

The current reference measurements are:

| Property | Reference value |
|---|---|
| Header height | `40px` |
| Right-edge inset | `8px` |
| Gap between button boxes | `4px` |
| Icon-button box | `32px × 32px` |
| Icon glyph | `18px` |
| Button corner radius | `8px` |
| Vertical space around each button | `4px` above and below |
| Center-to-center distance between adjacent buttons | `36px` |
| Nominal space between adjacent `18px` glyph boxes | `18px` |

The button is a transparent, borderless flex container with its glyph centered horizontally and vertically. Its normal color belongs to the Workspace Foreground group. The current hover treatment adds an 8% `--accent-dim` background tint without changing the established button geometry. Disabled header actions use 35% opacity and suppress the hover background.

The reusable spacing contract is already named at the app-shell level:

- `--trailing-action-inset: 8px` controls the distance from the rightmost button box to the window edge.
- `--trailing-action-gap: 4px` controls the distance between adjacent button boxes.
- `--chrome-icon-size: 18px` controls the glyph size.

The `32px` button box is currently applied by the header context rather than through a named size variable. New uses of this pattern should preserve that measurement even when their structural CSS class differs.

### View-Tab Plus Exception

The plus button attached to the universal view-tab strip is an explicit exception to the upper-right header pattern. Because it belongs to the tab sequence rather than the trailing window-edge action cluster, the `8px` trailing-edge rule does not apply. Its `20px` glyph is also an accepted exception to the standard `18px` chrome glyph. It retains the shared `32px × 32px` button box and `8px` corner radius. This exception is specific to the view-tab plus and does not redefine the default measurements for other icon buttons.

## Universal View-Tab Header

The upper view-tab area is intended to become a shared pattern used by every view. Views may supply their own tabs, labels, icons, and actions, but they should not independently recreate the tab rail's layout, measurements, spacing, or surface treatment.

The current Capture and Files implementations have not yet reached that shared boundary:

- Capture places its tab strip inside `.rv-capture-viewer-main-header`, whose background is `--document-surface-bg`.
- Files places its tab strip inside `.rv-file-viewer-header`, whose background is `--panel-chrome-bg`.

This separate ownership is why the two upper tab areas currently display different backgrounds. The future shared tab-header component must use one semantic background contract across all views. Which existing background becomes the canonical shared value remains an owner choice; the current difference must not be treated as an intentional per-view variation.

## Component Contract

Components may retain separate classes appropriate to their structure, such as header action buttons, workspace navigation buttons, and sidebar view buttons. Group membership is expressed by consuming the group's shared semantic color variable rather than by requiring every component to use one universal button class.

The intended mapping is:

| Semantic group | Shared variable | Workspace control |
|---|---|---|
| Normal workspace chrome | `--workspace-foreground-color` | Foreground |
| Connected and selected-view emphasis | `--workspace-accent-color` | Accent |

## Prototype Boundary

This is a prototype Wiki article recording the owner's current direction. The upper-right header's current hover and disabled styling is documented as part of its reference pattern. Focus, disconnected, and selection-marker treatments are not settled by this article unless the owner adds them to one of these groups.
