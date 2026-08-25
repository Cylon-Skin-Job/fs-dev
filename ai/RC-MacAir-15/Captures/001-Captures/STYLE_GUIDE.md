# Fusion Studio Style Guide

**Date established:** 2026-08-24  
**Status:** Active design guidance

## Icon Sizing

### Top application bar

- Icon glyph size: **18px**
- Use the shared `--chrome-icon-size` token.

### Primary sidebar navigation

- Icon glyph size: **24px**
- Use the shared `--navigation-rail-icon-size` token.

### Inner navigation and UI headers

- All icon glyphs used for inner navigation or UI-header buttons: **18px**
- Use the shared `--chrome-icon-size` token.
- This includes view headers, chat headers, page-navigation headers, drawer headers, and comparable navigation chrome inside a view.

### Universal content header bar

- Header height: **40px**, including its structural bottom border.
- Use the shared `--view-header-height` token. `--chat-header-height` remains only as a compatibility alias.
- Use consistent left, center, and right slots. Simple title text belongs in the center slot.
- Search controls, filters, mode selectors, and other secondary header elements belong in a row beneath the primary 40px bar.
- Reserve the primary bar's outer 40px on both sides for the universal chat/content layout controls.
- File Viewer, Wiki Viewer, Capture Viewer, and subsequent content views follow this same geometry.
- Non-tabbed views with sequential content navigation use the shared back/forward control at the Wiki-established offset: the 40px universal-control reserve plus an 80px rightward offset.
- Wiki, Capture, and Issues use this navigation control. File Viewer is explicitly excluded because its tabs are the navigation model.

## Application Rule

- These measurements govern the **icon glyph**, not the surrounding button or touch target.
- Button dimensions, padding, shape, and touch-target requirements remain separate component decisions.
- Do not hard-code a competing glyph size in an inner navigation or UI-header component. Consume the appropriate shared token.
- Content icons, status indicators, document imagery, empty-state illustrations, and other non-navigation graphics are outside this rule unless explicitly adopted later.

## Universal View Layout Controls

- Every content/view type uses the shell-owned layout controls; individual views must not implement private copies.
- **Upper left:** `first_page` collapses chat and changes to `robot_2` while chat is collapsed.
- **Upper right:** `dock_to_left` hides content and expands chat into the released space.
- When content is hidden, the matching content-expansion control appears in the chat header.
- These controls use identical 32px button targets, 18px glyphs, and 4px top/edge insets in every built-in, browser, iframe, and fallback view.
- Layout state remains per view, but component behavior and placement are universal.

## Universal Sidebar / List Navigation

- Inner navigation rails use the Threads pane's 16px left/right inset.
- A navigation rail's first primary item uses the same 15px top offset as Active Threads, measured from the top of the full rail. If a view has a separate content header (such as Wiki), the navigation rail spans behind that header so the header height is not added to this offset.
- The Wiki Guide primary row follows New Chat typography and spacing: 10px row padding, 8px icon gap, 24px icon, and a 15px bold label.
- The rail's collapse, expand, dock, or pin control occupies the universal header-control position. Its presence must not alter the primary title/action row's top or left position; use a stable header slot or equivalent structural space so titles and list rows never shift.
- Primary rail titles and buttons align to the same content inset whether the control is in a dedicated header or in the rail container. Separate content headers must not add a second vertical offset.
- Primary navigation actions are followed by a 1px divider driven by that section's Foreground color.
- Content-owned navigation rails are independently draggable and persist their own per-view widths; resizing them must not alter Threads, Chat, or another view's drawer width.
- Navigation labels remain single-line and use a transparency mask at the narrow right edge instead of a text ellipsis or hard clip. The final **24px** fades from fully opaque text to transparent; use `--list-nav-edge-fade-width`.
- Hover-only row actions do not reserve label width. Labels continue beneath an absolutely positioned action layer so narrow rails preserve the maximum readable title length.
- The action layer uses the row's opaque selected/Accent surface behind its buttons. A **24px** gradient immediately to its left runs from transparent to that opaque surface, allowing the underlying label to disappear smoothly beneath the controls; use `--list-nav-action-fade-width`.
- Action layers are hidden and non-interactive at rest, then become visible and interactive on row hover or keyboard focus. Their appearance must not reflow the label, metadata, neighboring rows, or rail width.
- Hovered rows preview the same owning Accent surface used by selection, with the calculated selected foreground for their label, metadata, icons, and surfaced actions.
- A row's leading icon is never exempt from its hover or active presentation. Wiki Guide reference icons use pure white in both states, matching their Guide labels.
- The Wiki page's floating glass Link and Send to Chat controls use pure-white glyphs at rest and on hover.
- Threads and Wiki navigation are the reference implementations. New sidebar, drawer, tree, and list-style navigation should inherit this geometry, right-edge label fade, action-overlay behavior, and Accent/Foreground ownership rather than defining a separate truncation or hover system.
- The Wiki's left and right navigation rails both follow the complete paradigm, including full-height rail ownership and stable first-primary-row alignment around the shared content-header controls.
- File Explorer follows the row-level paradigm—Accent hover, selected foreground, right-edge label fade, and no-reflow action overlays—but is intentionally exempt from the primary-title/header geometry. Its hierarchy begins beneath the existing top border that separates the tree from the file-view collapse controls, and tree indentation remains structural.

## Icon Color Ownership

Each navigation/header icon belongs to the **Foreground** control for the section that owns it:

- **Workspace Foreground:** the top application bar, primary sidebar navigation, and workspace name.
- **Thread Foreground:** the thread pane's top control and the ellipsis menu button inside each thread row.
- **Chat Foreground:** chat-header icons.
- **Content Foreground:** content-view navigation and content UI-header icons.

Base/idle icon color follows the owning Foreground token. Hover, selected, active, warning, and other semantic states may use the owning section's appropriate accent or status color when explicitly defined.

## Accent Ownership

Accent represents selection and highlighting. Accent controls exist for **Workspace**, **Threads**, **Navigation**, and **Content**:

- **Workspace Accent:** selected primary-sidebar icon. After the shared slider blend, add 10% white in dark mode or 10% black in light mode so selection remains distinct.
- **Thread Accent:** selected-thread background and its selected/hover presentation.
- **Navigation Accent:** selected and highlighted items inside navigation panels.
- **Content Accent:** selected or hovered content tabs; the tab label and icon use the calculated white/black contrast color over the Accent background.
- **Chat:** no Accent control. Chat retains its purpose-specific Foreground, Headings, Tools, Text, and surface controls.

### Shared slider math

Foreground and Accent sliders use the same base interpolation:

- **0:** Secondary Color
- **100:** Background Color
- Intermediate values are the same linear color blend for every owning section.

Workspace Accent is the one defined presentation adjustment: its interpolated result receives a fixed 10% mode-aware contrast lift. This does not alter its slider endpoints or give the workspace name Accent ownership; the workspace name follows Workspace Foreground.

The selected-state foreground over an Accent background is calculated separately as white or the dark-mode/theme contrast color needed for legibility; it is not another slider range.
