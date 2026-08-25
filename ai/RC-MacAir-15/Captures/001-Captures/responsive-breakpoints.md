# Responsive Breakpoints for Tablet and Mobile

**Date:** 2026-08-24  
**Status:** Active discussion capture; initial width breakpoints are approved, while responsive behavior remains open.

## Purpose

Define how Fusion Studio should adapt from its current desktop layout to tablet and mobile screen sizes. This capture begins with the forked design conversation and will preserve the breakpoint model, layout priorities, and owner decisions as they emerge.

## Current Starting Point

- The desktop app header is 40px tall.
- The primary app navigation rail is 40px wide, with 40px square navigation buttons.
- The current interface can contain a thread list, chat, content area, view-specific navigation, drawers, and overlay controls at the same time.
- Responsive behavior must account for the difference between reducing dimensions and changing the interaction model for touch-sized screens.

## Discussion Areas

- Breakpoint names and exact width ranges for desktop, tablet, and mobile.
- Whether breakpoints should follow the whole app viewport, individual pane width, or both.
- Which areas remain visible, collapse, overlay, or become drawers at each breakpoint.
- Priority between threads, chat, content, and view-specific navigation.
- Tablet portrait versus tablet landscape behavior.
- Mobile navigation placement and the treatment of the 40px desktop rail.
- Touch-target sizing, hover-only interactions, context menus, drag handles, and resize behavior.
- Chat composer, attachment row, menus, theme picker, and floating controls at narrow widths.
- Whether each built-in view needs its own responsive exceptions within a shared shell contract.

## Decisions

### Universal view-header controls

- The app header and top-row chat/view headers use one shared **18px** chrome-icon size token.
- The primary navigation rail uses a separate shared **24px** icon-size token.
- All inner navigation and UI-header button glyphs follow the **18px** rule recorded in `STYLE_GUIDE.md`.
- Header/navigation icon colors follow the owning section's Foreground control: Workspace, Thread, Chat, or Content.
- Workspace, Thread, Navigation, and Content Accent controls own selected/highlighted states; Chat has no Accent control.
- Foreground and Accent sliders share the Secondary Color → Background Color interpolation recorded in `STYLE_GUIDE.md`.
- These shared sizes govern the glyphs without forcing every surface to use the same surrounding control shape or interaction.

### Width Breakpoints

- **600px** is an approved breakpoint.
- **768px** is an approved breakpoint, intended to target smaller iPads and devices below that width.
- **1032px** is an approved breakpoint for the tablet layout, including the 13-inch iPad Pro in full-screen portrait orientation.

The tablet layout applies at 1032px and below. The mobile layout overrides it at 600px and below. No distinct behavior has been assigned to the 768px breakpoint yet.

## 1032px and Below — Tablet Layout

### Threads, navigation, and pinning

- Chat remains vertically arranged as it is in the current app.
- Tapping the left-panel slider opens the thread list as a drawer.
- A vertical strip containing the primary app navigation sits to the left of the thread list.
- Clicking outside the open drawer closes it.
- Long-pressing the drawer control, or tapping it again while the drawer is open, pins the threads.
- When pinned, the chat shifts right rather than being covered.
- The chat-header toggle retains the same behavior as desktop.
- The thread pane can occupy at most 30% of the screen width and remains draggable as on desktop.
- This layout copies the desktop thread behavior without keeping the content display visible beside chat.

### Chat width and positioning

- Chat occupies 50% of the screen width, leaving margins on both sides.
- When threads are pinned, chat centers itself within the remaining area.
- A future desktop change may adopt the same 50% expanded-chat width, but that is not part of this responsive decision yet.

### Composer and content transition

- The composer keeps the desktop-relative size and styling.
- It remains slightly wider than the chat content and begins at two rows high.
- A circular content/app button sits in the bottom-right area.
- Its icon matches the corresponding content/app icon used in the left-hand thread list.
- Activating it changes that control to `robot_2`, echoing the desktop fully expanded-content state.
- The screen transitions from chat to the selected content/app view instead of displaying both side by side.

### Content views

- Content scaling and view-specific CSS will be handled per view during live assistant design sessions rather than being generalized in advance.

### Scroll gesture concept

- When chat is at the bottom of its scroll range, an upward scroll gesture beginning around 70% or farther down the screen and ending around 20% from the top should bring the content/app view in as an overlay.
- The overlay then snaps to the top and the controls transition to their content-view state.
- The precise gesture thresholds and interaction details remain provisional.

## 600px and Below — Mobile Layout

### Threads and navigation drawer

- Replace the side-menu control with `menu_open`.
- Thread pinning is unavailable.
- The drawer opens to 80% of the screen width.
- A dark overlay covers the area behind it, and tapping outside the drawer closes it.
- The drawer inherits the left-side icons and the existing thread structure, scaled for the mobile layout but otherwise structurally identical.

### Chat width

- Chat occupies 96% of the screen width, leaving narrow margins on both sides.

### Composer and content transition

- The composer begins at a single-line height.
- The model dropdown is omitted.
- Activating the composer expands it to the desktop-style two-line height.
- The composer otherwise retains the desktop visual style.
- The app/content button sits immediately to the right of the composer.
- When the app/content button is activated, the chat composer contracts left into one circular `robot_2` button.
- The app/content control expands to hold the controls belonging to the active app.
- The visible surface transitions from chat to content.

### Inherited and deferred behavior

- Mobile inherits the remaining tablet behavior unless this section overrides it.
- View-specific CSS scaling at 600px will be designed ad hoc in future live assistant sessions.

## Device Reference

Apple specifies the 13-inch iPad Pro at **1032 × 1376 points** with a **2×** pixel ratio (**2064 × 2752 physical pixels**). For full-screen CSS media-query sizing, use:

- **Portrait:** `1032px` wide × `1376px` high
- **Landscape:** `1376px` wide × `1032px` high

The 768px breakpoint does not include a full-screen 13-inch iPad Pro in either orientation. It also does not include several modern iPads whose portrait widths are greater than 768 points. Device multitasking, split views, browser chrome, or a resized app window can still produce narrower effective viewport or container widths.

## Open Thread

- Decide whether 768px needs behavior distinct from the 1032px tablet layout and the 600px mobile override.
- Refine and test the tablet scroll gesture before treating its provisional thresholds as an implementation contract.
- Work through content scaling one view at a time in live design sessions.
