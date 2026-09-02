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
- Wiki uses this shared sequential-history control. Capture uses it only where real sequential history exists. Issues is excluded because its collection/detail transition uses a resource back action, and File Viewer is excluded because its tabs are the navigation model.

## Universal View Chrome System

Fusion Studio views are assembled from a small set of shared chrome primitives. A view chooses the primitives and capabilities it needs; it must not recreate their geometry, action order, transition rules, or color ownership privately.

Do not turn these primitives into one header with view-specific conditionals. Keep layout state in the shell or owning view controller and pass commands and content into stable slots.

### Header hierarchy

| Layer | Standard geometry | Responsibility |
|------|------:|------|
| Application header | 40px | Workspace identity and global application controls |
| View header | 40px | Universal chat/content controls, optional history, and centered view or resource identity |
| Resource header | 47px | Back-to-collection action, prominent resource title, and resource actions |
| Navigation slot | 70px | Segmented navigation or a replacement search control using the same footprint |

The application header and view header are always different layers even when they are visually adjacent. The resource header and navigation slot are conditional secondary layers.

### View header

The universal view header has three stable slots:

- **Left:** history navigation, back navigation, drawer controls, or chat/content layout controls.
- **Center:** a filename, breadcrumb, view title, resource identity, or an intentionally empty placeholder.
- **Right:** view actions followed by layout controls.

The center slot remains visually centered in the available view, independent of the widths or number of controls in the left and right slots. Adding an action must not shift a centered filename or title.

The header presents commands but does not own workspace layout state. The shell-owned layout controller decides what collapse chat, hide content, restore content, dock navigation, or open navigation means for the active view.

### Resource header

The resource header is the shared second header used when a document-like item becomes the primary content:

- A back action appears at the left of the resource title.
- The title uses the prominent document-title treatment.
- Resource actions appear at the right in the standard order below.
- A subtle header shadow may separate it from a scrolling resource without adding an extra border.
- When a resource owns the full-screen surface, its background continues through this header instead of exposing an unrelated workspace surface.

Capture notes, full-screen tickets, Wiki articles, and subsequent document-like resources should compose this header rather than implement private variants.

### Resource action order

Resource actions use this order when present:

`Link -> Send to Chat -> Archive -> Star -> More`

The vertical ellipsis is always the final **resource action**. Window and layout actions follow the resource group and occupy the far edge:

`Expand or Restore -> Close or Dock`

Actions that do not apply to a resource are omitted without changing the relative order of those that remain. Lower-priority resource actions move into the More menu as horizontal space contracts; primary navigation and layout controls remain visible longest.

### Resource preview frame

Capture previews, ticket previews, and later resource previews share one behavioral frame with placement and sizing policies:

- Placement may be centered or right-anchored.
- Width and height limits are supplied by the owning view.
- The preview uses the shared resource identity and action group.
- Clicking outside or pressing Escape closes it and restores focus.
- Expand transitions to the corresponding full-resource view without changing the resource identity or available actions.
- The preview owns its scroll area and must not accidentally scroll the collection behind it.

Placement is a variant of one preview pattern, not justification for a separate preview implementation.

### Full-resource frame

A full-resource view composes:

1. The universal 40px view header.
2. The conditional 47px resource header.
3. One independently scrolling resource surface.

If the collection uses the workspace background but the opened resource has its own surface color, the resource surface owns both its body and the header immediately attached to it.

### Segmented navigation and search

Segmented navigation and search are alternate occupants of one fixed navigation slot:

- Navigation-row height: **70px**.
- Control height: **50px**.
- Pill radius: **25px**.
- Search uses the same width, height, radius, border role, and foreground role as the segmented control it replaces.
- Opening search replaces navigation in place. It must not add a row, push the title down, or shift the content vertically.
- Search filters and results may appear below the navigation slot after a search begins, but the primary 40px identity header remains fixed.

Pill roundness is structural control geometry. Its interactive outline uses Content Foreground and remains visible when workspace Borders is off.

### Content interactive-control color contract

Buttons, search fields, segmented navigation, tab-like selectors, filter pills, and comparable controls inside a content view use **Content Settings** color roles. They do not invent private white, gray, glass, or border colors, and they do not fall back to Workspace, Navigation, Thread, or legacy global Chrome controls.

| State or part | Color ownership |
|------|------|
| Resting text and icon | **Content Foreground** |
| Resting outline or divider | **Content Foreground** |
| Resting fill | Transparent or Content Background, according to whether the control is outlined or surface-filled |
| Unselected hover fill | A subtle, consistent low-opacity blend of **Content Accent** over Content Background |
| Unselected hover text/icon | **Content Foreground** unless additional contrast is required |
| Selected or active fill | **Content Accent** |
| Selected or active text/icon | Pure white in dark mode; pure black in light mode |
| Focus indication | **Content Accent**, drawn separately from the resting Content Foreground outline |
| Disabled state | An attenuated form of Content Foreground; never the selected Content Accent treatment |

The selected-state contrast color is categorical and mode-aware. It is not a second accent blend and must not be hard-coded to white for both modes.

Search follows the same contract as the segmented navigation it replaces:

- its outline, typed text, placeholder, search icon, and dismiss icon use Content Foreground;
- its background is transparent or Content Background according to the shared navigation control style;
- focus uses Content Accent without permanently replacing the Foreground outline;
- search result selection uses Content Accent with the mode-aware white/black selected foreground.

The workspace Borders switch does **not** erase interactive-control outlines intentionally drawn with Content Foreground. Those outlines communicate control shape and operability. The Borders switch only affects the structural workspace-chrome border family defined below.

The interaction grammar may be reused in other product regions, but its token source does not transfer implicitly. Threads, Navigation, Chat, and Workspace continue to use the separately documented controls for their own regions.

### Top view-header color contract

The top 40px view header is a **Content Foreground**-owned region:

- centered filenames, view names, titles, breadcrumbs, and identity icons use Content Foreground;
- left and right header icons use Content Foreground;
- passive path separators and secondary identity text use an attenuated form of Content Foreground;
- header text must not fall back to pure white, a legacy global Accent, `--accent-dim`, or an unrelated heading token;
- the header's structural bottom separator follows the workspace Borders contract, while the text and controls inside it continue to follow Content Foreground.

The File Viewer tab rail is the reference for selection within this top region:

- inactive tab label and icon: Content Foreground;
- tab divider lines: Content Foreground;
- hovered or active tab fill: Content Accent;
- hovered or active tab label and icon: pure white in dark mode, pure black in light mode;
- the close control inherits the tab state's foreground and appears only for the active or hovered tab.

Other top-header selectors should use this same Content Foreground/Content Accent relationship even when their geometry is not tab-shaped.

### History as a capability

History controls are opt-in rather than automatic header decoration:

- Wiki and browser-like sequential surfaces use back/forward history.
- File Viewer uses tabs and does not also show history arrows.
- Issues does not show history arrows because its collection/detail transition is a resource back action.
- Capture only shows history where real sequential history exists.

All non-tabbed views that adopt history use the shared offset and button geometry defined under Universal content header bar.

### Resource identity

Resource identity supports an icon plus either a title or breadcrumb:

- A simple identity may be centered in the view header.
- A breadcrumb uses stable separators and fades or truncates without moving neighboring actions.
- In the top 40px view header, the complete identity—including terminal filename—uses Content Foreground. Parent path segments may use an attenuated form of Content Foreground, but the filename must not switch to an unrelated white or Accent token.
- A lower resource header may use its explicitly assigned document-title role; this does not override the top-header Foreground contract.
- Identity geometry remains stable while drawers open, close, or resize.

### Shared content rendering

Wiki, Capture, File Viewer Markdown, and ticket content should use one rendered-Markdown presentation component. Each product area supplies a metadata adapter, while Markdown structure, syntax highlighting, links, tables, code blocks, and document-border behavior remain shared.

Metadata responsibilities remain view-specific:

- Wiki supplies Wiki frontmatter, description, and navigation context.
- Capture supplies note identity and Capture actions.
- Issues supplies ticket status, labels, and ticket metadata.
- File Viewer supplies filesystem identity and file actions.

### Shared overlay behavior

Preview frames, drawers, menus, and temporary panels use common overlay rules for:

- outside-click dismissal;
- Escape dismissal;
- focus entry and restoration;
- backdrop and scroll locking;
- stacking order;
- pinned versus temporary presentation;
- responsive behavior.

### Tabs remain a distinct pattern

File tabs are not segmented navigation or history controls. Their proportional shrinking, fixed leading icons, gradient title fade, divider suppression, active Accent surface, and hover/active close button remain a dedicated tab-navigation pattern.

## Border Ownership And Borders Switch

The Workspace Settings **Borders** switch controls application chrome, not document meaning. A border must first be classified as **workspace chrome**, **document structure**, **interaction feedback**, or **semantic status** before it is assigned a color token.

Turning Borders off means that workspace-chrome border colors become transparent. It does not mean every CSS border in the application disappears.

### Borders controlled by the switch

The following are workspace-chrome borders and follow the Borders color and on/off state:

| Border | Definition |
|------|------|
| Application header border | The horizontal separator under the top-level 40px application header |
| View header border | The horizontal separator under a universal 40px content/view header when that view uses a separator |
| Primary navigation rail border | The inward-facing edge of the application navigation rail, regardless of whether the rail is placed on the left or right |
| Thread/chat divider | The visible 1px draggable separator between the thread list and primary chat |
| Chat/content divider | The visible 1px draggable separator between primary chat and content |
| Content-navigation borders | The outer separators between content-owned navigation drawers and their document surface |
| Content top chrome separator | The horizontal chrome line across the top of a content region, including the area above an opened drawer, when it is a view-layout boundary rather than part of the document |
| Structural chrome containers | Optional perimeter outlines around panels, drawers, previews, cards, and similar application surfaces when the outline separates application regions rather than communicating an interactive control |

The two workspace-column dividers are also resize handles. Turning Borders off makes their 1px painted strip transparent but must preserve their width, hit target, pointer behavior, and draggable layout boundary.

Interactive-control outlines are excluded from this table. Search fields, segmented navigation, buttons, filter pills, and comparable operable controls inside content views use Content Foreground as defined in the Content interactive-control color contract and remain legible when workspace Borders is off.

When Borders is off, the thread, chat, and content outer-container radii become **5px** as currently defined. This radius fallback applies to those three shell containers only. It must not overwrite the intentional pill, card, preview, menu, code-block, or document radii inside them.

### Borders not controlled by the switch

The following remain visible and are derived automatically from their owning surface or semantic color:

| Border | Required behavior |
|------|------|
| Markdown heading rule | Remains a subtle content-derived rule beneath headings that define document hierarchy |
| Markdown code-block outline | Remains visible so a fenced code block retains its boundary |
| Markdown table grid | Remains visible so rows and columns do not lose structure |
| Markdown blockquote rule | Remains visible and follows the content heading/accent treatment |
| Markdown thematic break | Remains visible as document structure |
| Code line-number divider | Uses the automatic attenuated code-chrome color and is independent of Borders |
| Code document-information divider | The line beneath the filename/path information uses the same automatic tone as line numbers and is independent of Borders |
| Focus ring | Remains visible for keyboard and accessibility feedback |
| Active/selected outline | Remains visible when it communicates selection rather than container chrome |
| Warning, error, success, and status outline | Remains visible and follows its semantic status color |
| Media or diagram frame | Remains visible when needed to communicate the boundary of document content |

These borders must not consume `--workspace-border-color`, `--neutral-chrome-border`, or another token that becomes transparent when Borders is off.

### Required border-token split

Use separate token families:

- `--workspace-border-color`: user-selected workspace chrome color; becomes transparent when Borders is off.
- `--document-structure-border`: automatic tone derived from Content Background and Content Text; never disabled by the workspace Borders switch.
- `--content-attenuated`: automatic code/document chrome tone used for line numbers and closely related structural separators; never disabled by the workspace Borders switch.
- owning Accent or status tokens: selection, focus, warning, error, success, and other semantic feedback; never disabled merely because workspace Borders is off.

Do not use `--content-border` as an ambiguous alias for both workspace chrome and document structure. New work must select the correct ownership family explicitly.

### Current implementation mismatch — 2026-08-25

The current theme border generator writes `transparent` into `--content-border` when Borders is switched off. Shared rendered-Markdown CSS also uses `--content-border` for heading rules, fenced code blocks, table cells, and thematic breaks. Wiki and File Viewer additionally bind local Markdown border behavior directly to `--workspace-border-color`.

Consequences today:

- Wiki article structural borders disappear when Borders is off.
- Capture rendered Markdown uses the same shared token and can lose the same structures.
- Markdown opened through File Viewer can lose the same structures.
- Ticket Markdown would inherit the defect when Tickets adopt the shared Markdown renderer.
- Blockquote behavior is inconsistent because some views use the heading color while Wiki and File Viewer override it with the workspace border color.

This behavior violates the border ownership contract above. The implementation repair is to introduce the document-structure token, migrate shared Markdown to it, remove view-level rebinding to workspace borders, and leave shell/header/navigation/resize borders on `--workspace-border-color`.

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
- The Wiki page's Link and Send to Chat controls use Content Foreground at rest. If hover or active state applies a Content Accent surface, their glyphs switch to pure white in dark mode or pure black in light mode.
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

### Obsolete global controls

The former bottom-of-picker sections named **Accent settings** and **Chrome settings**, each containing generic Luminance and Tint sliders, are obsolete and must not appear in the Theme Picker.

They are not part of the current color-ownership model and must not be consulted when defining a new component. Existing persisted `accentLuminance`, `accentTint`, `chromeLuminance`, and `chromeTint` fields may remain temporarily as compatibility inputs while older theme derivations are migrated, but they are not user-facing controls or sources of new design authority.

New work selects the scoped owner first—Workspace, Threads, Navigation, Chat, or Content—and then consumes that owner's Background, Foreground, Accent/Headings, Text, or other explicitly defined role.

### Shared slider math

Foreground and Accent sliders use the same base interpolation:

- **0:** Secondary Color
- **100:** Background Color
- Intermediate values are the same linear color blend for every owning section.

Workspace Accent is the one defined presentation adjustment: its interpolated result receives a fixed 10% mode-aware contrast lift. This does not alter its slider endpoints or give the workspace name Accent ownership; the workspace name follows Workspace Foreground.

For Content Accent, the selected-state foreground is categorical: pure white in dark mode and pure black in light mode. It is not another slider range. Other product regions retain only the selected-state treatment explicitly defined for their scoped owner.
