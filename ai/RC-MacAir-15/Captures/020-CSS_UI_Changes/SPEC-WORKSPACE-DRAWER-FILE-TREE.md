# SPEC — Workspace Drawer and FileTree Separation

> **Status:** Owner-authorized implementation handoff.
>
> **Scope:** Create one Workspace-owned drawer that compresses the active View Host, make File Viewer its only initial provider, and separate the complete FileTree content component from sidebar layout and theming. Later view providers, Content cards, and drawer registries are deferred.

## Purpose and Authority

Fusion Studio needs one persistent drawer pattern that future views can use without recreating width, animation, toggle, compression, theme, focus, or resizing behavior. The first proving consumer is File Viewer.

This SPEC implements RC's 2026-08-30 direction:

- the top drawer control universally opens a Workspace-owned drawer;
- opening the drawer compresses view content to make room rather than covering it;
- drawer navigation uses Workspace surface, Foreground, Accent, and background-derived interaction states;
- substantive non-navigation content added later will be placed inside a Content-background card within the Workspace drawer;
- File Viewer is the only consumer in this package; and
- the File tree is a distinct content component rendered inside the drawer, not the owner of drawer layout or chrome.

The implementation session is authorized to make and verify the bounded product changes in this SPEC. It must preserve unrelated user and concurrent work in the dirty worktree.

## Current Architecture and Required Boundary

Today `FileExplorer.tsx` owns both the document viewer and a right-side `.rv-file-tree-sidebar`. The sidebar is absolutely positioned over the view, gets its width from `viewStates['file-viewer'].widths.rightCol`, includes `RightColResize`, and directly owns tree loading, error, empty, scroll, and hidden-folder footer presentation.

The recursive `FileTree.tsx` already exists, but it represents only the nested rows. `FileExplorer` still owns the complete file-tree experience and its sidebar wrapper. `FileViewer.tsx` separately renders the file-tree dock control.

The required end state is:

```text
App Shell / View Host
├── Active view content
└── WorkspaceDrawer
    └── FileTree content component
```

Ownership must be split by responsibility:

| Responsibility | Owner |
|---|---|
| Toggle contract and availability | WorkspaceDrawer module / App Shell host |
| Open/closed state and persisted width | Existing controlled panel/view state |
| Width, animation, compression, surface, resize boundary | WorkspaceDrawer |
| File data, loading, expansion, selection, actions, hidden-folder control | FileTree content component and file-domain stores/hooks |
| Document tabs and rendered file content | File Viewer |

File Viewer must not retain an independently styled or positioned sidebar after migration.

## WorkspaceDrawer Component Contract

Create one neutral shared component module, such as `fusion-studio-client/src/components/workspace-drawer/`. Exact filenames may follow repository conventions, but the public boundary must remain view-agnostic.

### Controlled interface

The drawer must be controlled. Its interface must provide the equivalent of:

```ts
interface WorkspaceDrawerProps {
  id: string;
  label: string;
  open: boolean;
  width: number;
  onOpenChange(open: boolean): void;
  onWidthChange(width: number): void;
  children: React.ReactNode;
}
```

The exact API may integrate the repository's existing pane-state and resize primitives rather than duplicating callbacks. It must not import File Viewer, `useFileStore`, file-tree hooks, or file-specific types.

The associated toggle may be a companion `WorkspaceDrawerToggle`, a controlled host action, or an equivalent compound-component boundary when the toggle and drawer render in different App Shell locations. The drawer module must own their ARIA relationship and state contract even if the host determines physical placement.

### Layout behavior

The drawer must:

- occupy a real width beside the active view content;
- reduce the active View Host's available content width by the drawer's current width;
- never cover ordinary File Viewer document content while it is open;
- leave the global header, Threads panel, and Chat panel dimensions unchanged;
- preserve a `min-width: 0` content path so compressed content can shrink and scroll correctly;
- animate only the required width/position properties rather than using `transition: all`;
- respect reduced-motion preferences; and
- disappear entirely from layout when unavailable for the active view.

File Viewer currently provides the right-side case. Do not add left/right placement options, multiple simultaneous drawers, stacking, overlay modes, or a generalized docking engine until a later real consumer requires them.

### Availability and view changes

For this package:

- File Viewer is the only active view with drawer content;
- the drawer toggle is hidden when any other view is active;
- drawer content is not mounted or visible for views without a provider;
- File Viewer's controlled open/width state may remain stored while another view is active; and
- returning to File Viewer restores its stored state without creating global drawer state for every view.

Do not build a registration system or public provider registry. The App Shell/View Host may select the FileTree content through an explicit File Viewer branch. Preserve a clean seam so a later second consumer can earn a provider contract without replacing `WorkspaceDrawer`.

### Toggle and focus contract

The drawer toggle must:

- use the established Workspace icon-button contract;
- expose an accurate accessible name such as `Show files` / `Hide files`;
- expose `aria-expanded` and `aria-controls` for the drawer element;
- remain keyboard operable through its native button behavior;
- use Workspace Foreground at rest and the shared background-derived icon interaction treatment;
- avoid Workspace Accent merely because the drawer is open; and
- be disabled or absent rather than interactive when no drawer content exists. This package uses absence for non-File views.

The persistent open drawer is nonmodal and does not trap focus. If it closes while focus is inside it, focus returns to the toggle or the nearest valid host control. Focus-visible remains separate from hover, pressed, and selected states.

### Resize and state persistence

Preserve the current File Viewer state path unless a concurrent approved refactor has already replaced it:

- `viewStates['file-viewer'].collapsed.rightCol` represents closed/open;
- `viewStates['file-viewer'].widths.rightCol` represents the drawer width; and
- current clamping and persisted view-state behavior remain intact.

Reuse `RightColResize` or its approved successor rather than creating a second drag implementation. If the D-25 accessible resize package is already present, the drawer must consume it. If it has not landed, preserve the shared primitive and report the accessibility dependency rather than embedding new drawer-only resize mechanics.

The existing sticky secondary-chat path may continue to occupy the same reserved right-side region and temporarily cover or supersede drawer visibility while sticky. It must not cause the View Host to reserve two independent right-side widths. When sticky chat leaves, the File drawer returns to its stored width and state.

## FileTree Content Component Contract

The drawer must receive one complete FileTree content component rather than constructing file rows, loading states, or footer controls itself.

The implementation may retain `FileTree` as the public name and rename the recursive list, or introduce a neutral distinction such as `FileTreeContent` plus `FileTreeList`. The final public child rendered by `WorkspaceDrawer` must own the complete file-domain experience.

### FileTree owns

- the file-tree WebSocket listener and tree-specific loading lifecycle;
- root and expanded-folder loading;
- loading, error, and empty states;
- folder expansion and recursive rows;
- current file selection and file opening;
- file and folder icons and labels;
- path-copy and send-to-chat actions;
- hidden-folder visibility and its footer control;
- its internal scrolling; and
- tree-specific accessibility and keyboard behavior.

Viewer-specific activity hydration, open document tabs, outstanding file-content requests, document rendering, tab actions, and file breadcrumbs remain outside the FileTree component.

### FileTree must not own

- drawer width or open state;
- absolute positioning, docking, or App Shell grid placement;
- the outer Workspace surface or divider;
- the universal drawer toggle;
- drawer resize mechanics;
- view-content compression; or
- Workspace theme calculations.

The FileTree may consume inherited semantic variables and component-local layout values. It must not redefine the drawer as a dark File-specific sidebar.

### Navigation states

FileTree is Workspace-owned navigation when rendered directly in `WorkspaceDrawer`:

- ordinary file/folder labels, icons, action icons, empty/loading text, and footer control use Workspace Foreground;
- row hover and brief pressed feedback derive from the actual drawer background through the shared interaction contract;
- the currently viewed file is identified with Workspace Accent and appropriate current-item semantics;
- a selected/current row may also use the background-derived persistent selected fill, but its Accent foreground remains distinct from hover;
- expanded folders are disclosure state, not selected navigation, and do not become Accent merely because they are open;
- disabled/loading rows do not react as enabled rows; and
- focus-visible remains independently visible.

The component must identify the current file from existing File Viewer/store state rather than creating a second selection source of truth.

## Workspace Theme Contract

Publish or consume a semantic drawer surface alias equivalent to:

```css
--workspace-drawer-bg: var(--panel-chrome-bg);
```

The exact fallback may follow the active Workspace background contract established by concurrent theme work. The drawer must bind the local interaction surface from `SPEC-WORKSPACE-CHROME-INTERACTION-CONTRACT.md` to this actual background so hover, pressed, and selected fills are surface-relative.

Within the drawer:

- surface comes from the Workspace background contract;
- ordinary contents come from `--workspace-foreground-color`;
- current navigation comes from `--workspace-accent-color`;
- hover, pressed, and selected fills come from local-background interaction tokens;
- borders/dividers follow the active Workspace border contract where a structural divider is required; and
- no File-specific color slider or Navigation slider is introduced.

Moving Workspace Background, Foreground, or Accent in live preview must update the drawer and FileTree immediately and must match the persisted/reloaded theme.

This package extends Workspace Accent usage to current navigation inside the Workspace drawer. It does not change the earlier rule that generic hover, pressing, or selected tabs are background-derived rather than Accent-driven.

## File Viewer Integration

### Required structural migration

1. Remove the `.rv-file-tree-sidebar` wrapper from `FileExplorer` after the shared drawer mounts the complete FileTree content.
2. Move tree-specific loading/error/footer behavior out of `FileExplorer` and into the complete FileTree content component.
3. Leave viewer activity hydration, file-content requests, `FileViewer`, tabs, breadcrumbs, and rendered documents in the File Viewer path.
4. Remove the File-specific dock button from `FileViewer` and connect the shared drawer toggle through the App Shell/View Host control location.
5. Replace the absolute overlay layout with the drawer's width-consuming layout so the document viewer is compressed.
6. Remove or narrow File-specific layout/theme selectors that style the old sidebar shell; retain only tree-internal structure and file-domain presentation.

### Behavior preservation

Preserve:

- initial root loading;
- expanded-folder restoration and lazy child loading;
- hidden-folder toggling and reload;
- file opening and active tab behavior;
- copy-path and send-to-chat actions;
- loading, error, and empty states;
- current drawer width and collapse persistence;
- resizing and clamping;
- file-tree scrolling and footer accessibility;
- sticky secondary-chat interaction; and
- current workspace/view switching behavior outside the new drawer availability rule.

Do not change file APIs, WebSocket message shapes, file paths, symlink policy, context-menu commands, store persistence, or document/tab behavior.

## Implementation Slices

### Slice WDF.1 — Shared controlled drawer shell

1. Create `WorkspaceDrawer` and its toggle contract.
2. Connect controlled File Viewer `rightCol` open/width state.
3. Render the right-side drawer only when File Viewer is active.
4. Replace overlay behavior with content compression.
5. Reuse the shared resize primitive and preserve sticky-secondary width behavior.
6. Establish Workspace surface, Foreground, Accent, interaction, focus, transition, and reduced-motion styling.

**Gate:** an inert placeholder child can open, close, resize, restore, and compress File Viewer content without affecting header, Threads, Chat, or other views; non-File views show no toggle or drawer; client build passes.

### Slice WDF.2 — Complete FileTree content extraction

1. Form one complete FileTree content component from the existing recursive tree plus the root lifecycle currently in `FileExplorer`.
2. Render it as the drawer child.
3. Remove old sidebar shell markup and its superseded layout/theme CSS.
4. Apply Workspace navigation colors and shared interaction states.
5. Mark the current file through the existing active-file/tab source of truth.
6. Recheck loading, errors, folders, files, actions, hidden items, resize, switching, and sticky secondary chat.

**Gate:** File Viewer contains no independent sidebar shell; FileTree contains no drawer geometry; all preserved file behavior passes; active cascade inspection finds no old absolute sidebar or duplicate drawer-state styling.

## Verification and Acceptance

### Required verification

1. Run `npm run build` in `fusion-studio-client/`.
2. Open File Viewer with the drawer open and confirm the document width is reduced rather than covered.
3. Toggle closed/open repeatedly and confirm the brief button state, focus, `aria-expanded`, `aria-controls`, and restored width.
4. Resize to current minimum and maximum bounds; switch views and return; reload persisted state if the current environment supports it.
5. Confirm the toggle and drawer are absent in every non-File view.
6. Exercise root loading, expanded folders, lazy children, empty folders, hidden-folder toggle, errors, file opening, active file, copy path, send to chat, and internal scrolling.
7. Confirm Workspace Background, Foreground, and Accent update the drawer, ordinary tree navigation, and current file live in both dark and light modes.
8. Confirm hover/pressed/selected fills derive from the drawer surface and are distinguishable from current-file Accent.
9. Exercise keyboard focus through the toggle, resize handle at its currently supported accessibility level, tree rows/actions, and footer control.
10. Dock and undock secondary sticky chat and confirm only one right-side width is reserved and the File drawer returns correctly.
11. Search the active cascade for `.rv-file-tree-sidebar`, obsolete absolute overlay rules, duplicate dock controls, view-owned drawer backgrounds, and parallel open/width state.

### Terminal acceptance

- One reusable WorkspaceDrawer owns toggle state contract, width, animation, compression, surface, focus boundary, and resize placement.
- File Viewer is the only initial drawer provider and other views show no empty/disabled drawer UI.
- One complete FileTree content component owns file-domain navigation and renders inside the drawer.
- FileTree does not own sidebar placement, width, surface, resize, or compression.
- Opening the drawer compresses document content rather than covering it.
- Drawer navigation follows Workspace Foreground/Accent and background-derived interaction states with live/persisted theme parity.
- The active file uses the existing source of truth and receives current-navigation semantics.
- Existing file loading, expansion, hidden-folder, action, tab, persistence, resize, and sticky-chat behavior remains intact.
- No generalized provider registry, Content card system, or unrelated drawer migration is introduced.
- Client production build succeeds.

## Deferred Work

This SPEC intentionally does not implement or settle:

- drawer content for Capture, Wiki, Office, Email, Calendar, or future views;
- a drawer-provider registry, manifest contract, plugin API, or arbitrary injection system;
- multiple drawers, simultaneous drawer contents, left-side drawers, overlay drawers, or detachable drawers;
- the future Content-background card component for bulletins, todo lists, or other substantive drawer content;
- migration of Calendar, Office, Email, Theme Picker, Chat Todo, Threads, or other existing elements named “drawer” or “sidebar”;
- Content-owned Wiki navigation or removal of Navigation sliders;
- new file operations, menus, file APIs, store schemas, or WebSocket messages;
- the separate accessible-resize implementation beyond consuming its shared result when available; or
- final drawer width, animation-duration, border, and geometry redesign beyond preserving current File Viewer behavior while changing overlay to compression.

## Implementer Handoff

Before editing, re-read repository `AGENTS.md`, this SPEC, `SPEC-WORKSPACE-CHROME-INTERACTION-CONTRACT.md`, and the current dirty-worktree diff for every affected file. Inspect `FileExplorer.tsx`, `FileTree.tsx`, `FileTreeNode.tsx`, `FileNode.tsx`, `FolderNode.tsx`, `FileViewer.tsx`, `ViewLayoutControls.tsx`, `App.tsx`, `ResizeHandle.tsx`, panel/view state, the File Viewer layout CSS, and machine-scoped File Viewer theme CSS before choosing exact ownership boundaries.

Preserve concurrent File Viewer, tabs, header, theme, resize, and style-guide changes. Do not overwrite the shared ViewTabBar or MenuSurface work.

The final implementation report must include:

- final WorkspaceDrawer and toggle API;
- final FileTree public/internal component split;
- state paths and resize primitive reused;
- shell/view files and CSS layers changed;
- old sidebar selectors and duplicate controls removed or intentionally retained;
- compression, view-switch, sticky-chat, file-behavior, accessibility, and theme verification;
- build/test results; and
- every deviation affecting later provider registration, Content cards, Wiki navigation, Navigation-slider removal, or other views.
