# Roadmap/Handoff: RCC-0076 - Workspace Switcher Ribbon Evolution

## Context

The workspace switcher UX has moved from the old slide-out drawer to the current ribbon/carousel system. This document is both the roadmap for the broader ribbon evolution and the handoff for the first executable slice.

Read this standards page before implementing any slice:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Implementation principle:

- One job per file.
- Delete dead code instead of leaving compatibility shims.
- Do not add features beyond the active slice.
- Keep views, controllers/orchestration, services, and state responsibilities separate.

Preferred behavior that must stay:

- Clicking the workspace name in the top header toggles the workspace ribbon.
- Header left/right chevrons cycle workspaces.
- Holding Option/Alt and pressing Left/Right opens the ribbon and cycles workspaces.
- The fullscreen workspace carousel appears while the ribbon is open and tracks the active workspace.
- The ribbon remains the visual workspace switcher with thumbnails/icons, labels, Add Project, and the existing remove action.

The obsolete behavior to remove in Slice 1:

- `WorkspaceSwitcher` slide-out drawer.
- Drawer CSS.
- Drawer-only store state/actions.
- Stale drawer-close calls in workspace message handlers.

The broader product direction is now: the ribbon becomes a curated, reorderable set of active/pinned workspaces. A `cancel` icon removes a workspace from the ribbon without removing/delisting it from the app, and the far-right plus button opens a vertically scrollable dropdown of available workspaces that can be added back to the ribbon.

Important surface separation:

- The top ribbon manages entire workspaces.
- The ribbon plus/dropdown adds existing or new workspaces to the ribbon.
- Workspaces contain views.
- Views are added, hidden, reordered, or removed from a workspace through the left navigation/right-click workflow, not through the top ribbon.

The original ticket also included broader ideas about Electron menu checkboxes, close-state reset policy, a 24-hour grace period, and screenshot transition bugs. Those remain future work unless explicitly pulled into a later slice.

## Roadmap

Recommended execution order:

1. Slice 1: remove obsolete drawer.
2. Slice 2: define workspace ribbon membership model.
3. Slice 2b-guard: audit existing registered workspaces before any view-registry migration.
4. Slice 2b: migrate live view registry to `ai/<machine>/System/workspace/views.json`.
5. Slice 2c: add left-nav per-view context menu.
6. Slice 2d: add left-nav empty-space add/restore menu.
7. Slice 3: replace ribbon hover trash with workspace `cancel` action.
8. Slice 4: convert ribbon plus to workspace add-to-ribbon dropdown.
9. Slice 4b/4c: add project/create new workspace flows.
10. Slice 5: workspace ribbon drag reordering.
11. Slice 6: zero-ribbon-workspace splash state.

Do not implement multiple slices in one worker handoff unless a later orchestrator explicitly combines them.

### Slice 1: Remove obsolete drawer

Delete the old `WorkspaceSwitcher` drawer path and drawer-only store state. Preserve the current ribbon/carousel behavior exactly.

This is the only executable slice described in detail below.

### Slice 2: Define ribbon membership model

Introduce a clear distinction between:

- Registered workspaces: all workspaces the app knows about.
- Ribbon workspaces: workspaces currently shown in the top ribbon.

Expected product behavior:

- Removing a workspace from the ribbon is not the same as deleting/unregistering the workspace.
- A workspace removed from the ribbon should still be available from the plus dropdown.
- The data model needs a persisted ribbon membership/order field before UI changes are made.
- Removing a non-active workspace from the ribbon should not change the active workspace.
- Removing the active workspace should move selection toward whichever side has more remaining ribbon workspaces, so the selected position feels visually stable as the ribbon reorients. If the left/right counts are tied, default to the right.
- Removing the final ribbon workspace is allowed. That should leave the app in the zero-ribbon-workspace splash state described in Slice 6.

### Slice 3: Replace hover trash with ribbon cancel action

Convert the current hover-only trash/delete control into a `cancel` icon that removes the workspace from the ribbon only.

Expected product behavior:

- The control should use the Material Symbols `cancel` icon, not `delete`.
- The control should communicate “remove from ribbon,” not “delete project.”
- It should not unregister the workspace or delete files.
- The current destructive-ish `workspace:remove_requested` path should not be reused for this behavior.
- After removal from the ribbon, the same workspace should appear in the plus dropdown so it can be added back.
- If the removed workspace is active, selection follows the Slice 2 rule: move toward the side with more remaining ribbon workspaces, defaulting right on a tie.

### Slice 4: Convert far-right plus to add-to-ribbon dropdown

Change the far-right plus button from only “Add Project” into a workspace picker for adding workspaces to the ribbon.

Expected product behavior:

- Clicking plus opens a vertically scrollable dropdown.
- The dropdown lists registered workspaces not currently in the top ribbon.
- Selecting one adds that workspace to the top ribbon.
- The dropdown must include both `Add Project` and `Create New` actions.
- This dropdown is not for adding views inside a workspace.

### Slice 4b: Add project modal requires `/ai`

When the user chooses `Add Project`, show a modal explaining that the project must contain an `/ai` folder to be added.

Expected product behavior:

- The `/ai` folder requirement is mandatory, not optional.
- Canceling the modal aborts the add flow and does not add the project.
- The modal should make the requirement explicit before any project is added.

Add Project flow:

1. User chooses `Add Project`.
2. Modal explains the `/ai` requirement.
3. User confirms or cancels.
4. Confirm continues the existing add-project flow.
5. Cancel aborts without side effects.

### Slice 4c: Create new project with global view types

When the user chooses `Create New`, start a workspace creation flow. That flow can use view templates to choose which views the new workspace starts with.

Expected product behavior:

- Each selected view template creates its own data under the new workspace's `ai/<machine>/Views`.
- The view templates are generated and sourced from `System Source Files`.
- Workspace types still under development should use stubs in `System Source Files` until their real templates are ready.
- The creation flow should produce the `ai` folder structure as part of the new project setup.
- Cancelling the flow should leave the project uncreated and unadded.
- The server should read the available views from `System Source Files/views.manifest.json`.
- The create flow should use the manifest's `templatePath` to scaffold the selected view.
- Stubbed views should scaffold placeholder content from their template folder until real templates are provided.

Initial view catalog:

- Default:
  - `file-viewer`
  - `wiki-viewer`
  - `issues-viewer`
  - `agents-viewer`
  - `system-viewer`
- Optional:
  - `email` (active development)
  - `calendar` (active development)
  - `todo` (stub)
  - `doc-viewer` (exists; needs some work, but composable/transportable)
  - `office-viewer` (exists)
  - `library` (stub)
  - `media-editor` (stub)

Notes:

- The code workspace / default workspace views already exist and are part of the default set.
- These individual pieces are referred to as views.
- Calendar and email are the main active-development views.
- Doc viewer and calendar viewer need some work, but the architecture is already composable and transportable.

## View Registry Model

The live view/workspace metadata should be file-based and live in the actual workspace's `ai/<machine>/System/`, not in SQLite.

`System Source Files` is the template bundle and should mirror this structure for scaffolding purposes, but it is not the live source of truth.

Proposed storage:

```text
ai/<machine>/System/workspace/views.json
ai/<machine>/System/state/workspace.json
System Source Files/views.manifest.json
System Source Files/view-templates/
  default/
  optional/
```

Why this model:

- The catalog stays composable and portable.
- Templates and registry live together.
- The server can read the available views directly from the workspace files.
- SQLite can remain reserved for durable app-level state and cross-workspace registry data.
- `default` and `optional` are the only groups for now.

Proposed manifest shape:

```json
{
  "version": 1,
  "views": [
    {
      "id": "file-viewer",
      "label": "File Viewer",
      "group": "default",
      "status": "ready",
      "templatePath": "view-templates/default/file-viewer"
    },
    {
      "id": "wiki-viewer",
      "label": "Wiki Viewer",
      "group": "default",
      "status": "ready",
      "templatePath": "view-templates/default/wiki-viewer"
    },
    {
      "id": "issues-viewer",
      "label": "Issues Viewer",
      "group": "default",
      "status": "ready",
      "templatePath": "view-templates/default/issues-viewer"
    },
    {
      "id": "agents-viewer",
      "label": "Agents Viewer",
      "group": "default",
      "status": "ready",
      "templatePath": "view-templates/default/agents-viewer"
    },
    {
      "id": "system-viewer",
      "label": "System Viewer",
      "group": "default",
      "status": "ready",
      "templatePath": "view-templates/default/system-viewer"
    },
    {
      "id": "email",
      "label": "Email",
      "group": "optional",
      "status": "active-development",
      "templatePath": "view-templates/optional/email"
    },
    {
      "id": "calendar",
      "label": "Calendar",
      "group": "optional",
      "status": "active-development",
      "templatePath": "view-templates/optional/calendar"
    },
    {
      "id": "todo",
      "label": "To Do",
      "group": "optional",
      "status": "stub",
      "templatePath": "view-templates/optional/todo"
    },
    {
      "id": "doc-viewer",
      "label": "Doc Viewer",
      "group": "optional",
      "status": "active-development",
      "templatePath": "view-templates/optional/doc-viewer"
    },
    {
      "id": "office-viewer",
      "label": "Office Viewer",
      "group": "optional",
      "status": "ready",
      "templatePath": "view-templates/optional/office-viewer"
    },
    {
      "id": "library",
      "label": "Library",
      "group": "optional",
      "status": "stub",
      "templatePath": "view-templates/optional/library"
    },
    {
      "id": "media-editor",
      "label": "Media Editor",
      "group": "optional",
      "status": "stub",
      "templatePath": "view-templates/optional/media-editor"
    }
  ]
}
```

Suggested fields:

- `id`: stable machine identifier.
- `label`: human-readable name.
- `group`: `default` or `optional`.
- `status`: `ready`, `active-development`, or `stub`.
- `templatePath`: folder path under `System Source Files` used when scaffolding a project.

Interpretation rules:

- `ready` means the view exists and can be created normally.
- `active-development` means the view exists but may need extra work before it is considered finished.
- `stub` means the view is available in the catalog but only generates a placeholder scaffold for now.
- The live workspace should display whatever the workspace metadata declares; it should not hardcode the catalog in SQLite.

Live workspace metadata model:

- `ai/<machine>/System/workspace/views.json` should hold the workspace's view list, order, icon, and any membership flags.
- `ai/<machine>/System/state/workspace.json` can hold active/ephemeral workspace UI state if needed.
- `ai/<machine>/Views/` should stay focused on the actual view folders/content, not the workspace registry.

### Slice 2b: Migrate live view registry out of `ai/<machine>/Views/index.json`

Move the live workspace view registry to `ai/<machine>/System/workspace/views.json` so `ai/<machine>/Views/` only contains view content folders.

Proposed `ai/<machine>/System/workspace/views.json` schema:

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    {
      "id": "file-viewer",
      "baseViewId": "file-viewer",
      "label": "Code",
      "icon": "code_blocks",
      "rank": 1,
      "enabled": true,
      "source": "default",
      "viewPath": "ai/<machine>/Views/file-viewer"
    },
    {
      "id": "issues-viewer",
      "baseViewId": "issues-viewer",
      "label": "Issues",
      "icon": "business_messages",
      "rank": 3,
      "enabled": true,
      "source": "default",
      "viewPath": "ai/<machine>/Issues"
    }
  ]
}
```

Field meanings:

- `version`: schema version for future migrations.
- `sort`: how the list should be ordered; currently `ranked`.
- `views`: ordered registry of views available in this workspace.
- `id`: stable view id, matching the folder name under `ai/<machine>/Views/`.
- `baseViewId`: underlying view template/type id. For normal views this matches `id`; for manual prefixed duplicates it is the suffix/base type, e.g. `office-viewer`.
- `label`: user-facing view name.
- `icon`: Material Symbols icon name shown in the left/sidebar view rail.
- `rank`: numeric ordering used by the view rail, keyboard cycling, and future drag reorder.
- `enabled`: whether the view is currently shown/available in this workspace.
- `enabled: false` means hidden from the UI/rail but still installed in the workspace.
- `source`: `default`, `optional`, or `custom`.
- `viewPath`: project-relative path to the actual view folder.

Rules:

- `views.json` stores stable workspace view registry data only.
- Active/focused view, scroll position, selected ticket, and other ephemeral UI state do not belong in `views.json`.
- Future right-click rename/icon/reorder actions should update `ai/<machine>/System/workspace/views.json`.
- Future hide/show actions should update `enabled` in `ai/<machine>/System/workspace/views.json` without deleting folders.
- The view folder's own `ai/<machine>/Views/<viewId>/index.json` can continue to describe the view implementation itself, but not global workspace ordering.
- If both old `ai/<machine>/Views/index.json` and new `ai/<machine>/System/workspace/views.json` exist during migration, the new `ai/<machine>/System/workspace/views.json` should win.
- Removing a view folder from disk is the only true uninstall/removal path.
- True folder deletion must be a deliberate direct user action, not an accidental click or normal hide/cancel action.

Duplicate view rule:

- Do not expose duplicate view creation as a normal user-facing feature.
- `Add View` should offer only view templates that are not already present in the current workspace.
- The right-click view menu should not include a duplicate/clone action.
- The server should still tolerate manually created duplicate view folders for advanced/manual/AI-assisted workflows.
- Manual duplicate folders must use a descriptive alphabetic prefix before the base view id.
- Prefix words may be separated with `-`, e.g. `assets-office-viewer`, `desktop-office-viewer`, `RC-Exhaust-office-viewer`.
- Numeric-only prefixes like `02-office-viewer` should not be the convention.
- The final suffix should remain the base view type id so humans and AI can infer the underlying view type.
- The server should infer manual duplicate `baseViewId` by matching known manifest view ids as folder-name suffixes.
- If more than one manifest id matches a folder suffix, the longest matching suffix wins.
- Example: `RC-Exhaust-office-viewer` resolves to `baseViewId: "office-viewer"`.
- `Add View` filtering should use `baseViewId` so a view template already present through a manual duplicate is not offered again in the normal beginner-facing UI.
- Renaming a view changes the `label` only; it must not rename the folder/id.
- This keeps the novice UI simple while allowing advanced users to manually clone and specialize views when needed.

Expected product behavior:

- The workspace's view list, icons, and ranks are loaded from `ai/<machine>/System/workspace/views.json`.
- The legacy `ai/<machine>/Views/index.json` registry is no longer the source of truth.
- The migration should preserve the current order and icon values.
- The migration should not change the visible UI until the new path is fully wired.
- The templates in `System Source Files/view-templates/` remain the scaffolding source.

### Slice 2c: Add left navigation view-management context menu

Add a right-click context menu on the left navigation for managing views inside the active workspace.

Expected product behavior:

- The left navigation shows views where `enabled: true`.
- Right-clicking a view opens a context menu.
- The context menu supports renaming the view label.
- The context menu supports changing the Material Symbols icon.
- The context menu supports hiding the view by setting `enabled: false` in `ai/<machine>/System/workspace/views.json`.
- The context menu supports moving the view up/down by changing `rank`.
- The context menu must not include destructive folder removal/deletion.
- True folder deletion remains outside this menu and must be a separate deliberate user action if implemented later.

This slice manages views inside a workspace. It does not affect top-ribbon workspace membership.

### Slice 2d: Add left navigation empty-space context menu

Add a right-click context menu on the empty space below the left-navigation icons for view add/restore actions.

Expected product behavior:

- Right-clicking empty left-nav space opens a context menu.
- The menu includes `Add View`.
- The menu includes `Restore View` when hidden views exist.
- `Restore View` lists views with `enabled: false` from `ai/<machine>/System/workspace/views.json`.
- Restoring a view sets `enabled: true` without recreating or copying files.
- `Add View` uses the available view/template catalog to add a new view to the current workspace.
- This menu must not affect top-ribbon workspace membership.

### Slice 2b-guard: Audit and migrate existing registered workspaces

Before changing view folder naming, registry paths, or instance-id semantics, audit every currently registered workspace in the app's workspace registry.

Context:

- The current app demo already has registered workspaces used for active development.
- Those workspaces may contain live view folders and partially built features.
- Migration work must not break existing demo/dev workspaces.

Expected migration behavior:

- List all registered workspaces from the current workspace registry.
- For each workspace, inspect its `ai/<machine>/Views/` folders and existing view `index.json` files.
- Record each view's current folder name, declared `id`, label, icon, rank, content config, and layout settings.
- Generate or update `ai/<machine>/System/workspace/views.json` from the existing workspace data.
- Preserve existing folder names unless a specific migration step safely renames them.
- Preserve current visible order, icons, labels, and enabled/visible state.
- Support existing unprefixed view folders during migration.
- Do not introduce numbered/prefixed duplicate view folders.
- Run the app after migration and confirm every registered workspace still opens and its left navigation still matches pre-migration behavior.

Non-goals for this guard slice:

- Do not mass-rename existing view folders just to match the future convention.
- Do not delete or recreate existing view folders.
- Do not remove partially built demo/dev views.
- Do not assume `System Source Files` is the live source of truth for these workspaces.

Create New flow:

1. User chooses `Create New`.
2. A workspace creation flow shows available view templates from `views.manifest.json`.
3. User picks the views/template bundle for the new workspace.
4. The flow creates the new project scaffold, including `/ai`.
5. The selected views' `templatePath` values are used to populate `ai/<machine>/Views`.
6. Stub views create placeholder scaffolds from their stub template folders.
7. The new project is then registered and added to the ribbon.
8. Cancel at any step aborts the flow without creating or adding the project.

### Slice 5: Add drag reordering within ribbon

Allow users to drag workspace tiles within the ribbon to reorder them.

Expected product behavior:

- Dragging changes the ribbon order.
- Order persists across sessions.
- Keyboard cycling and carousel order follow the same persisted ribbon order.

### Slice 6: Add zero-ribbon-workspace splash state

Allow the ribbon to contain zero workspaces and add an explicit splash/empty state for that condition.

Expected product behavior:

- Users may remove the last workspace from the ribbon.
- With no ribbon workspaces, the main workspace area should show a splash/empty state instead of forcing a workspace selection.
- The splash state should make adding a workspace back to the ribbon obvious.
- The plus/dropdown action must remain available when the ribbon has zero workspaces.
- Registered workspaces still exist; zero ribbon workspaces means none are currently shown in the ribbon.

### Future/Separate: Electron menu, state reset, grace period, screenshots

These are not part of Slice 1 and should be handled only after the ribbon membership model is defined:

- Electron Workspaces menu.
- Close-state reset/preservation policy.
- 24-hour grace period.
- Screenshot darkness/sizing/transition issues.

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

Confirm:

```bash
git rev-parse --show-toplevel
git status --short
git log -1 --oneline
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The tree may already be dirty with unrelated runtime/user/session work. Inspect before editing and do not overwrite unrelated changes.

Known unrelated dirty/runtime files may include:

```text
System Source Files/ai/<machine>/System/state/state.json
ai/<machine>/System/state/state.json
ai/<machine>/Views/<wiki-view-folder>/styles/state.json
fusion-studio-server/data/workspace-cache.json
```

## Slice 1 Goal

Remove the obsolete `WorkspaceSwitcher` drawer path while preserving the current ribbon/carousel workspace switching UX exactly.

After this slice, there should be only one workspace switcher UI path in the client:

```text
WorkspaceTitle -> workspaceStore.isRibbonOpen -> WorkspaceRibbon + WorkspaceCarousel
```

There should be no `WorkspaceSwitcher` component, drawer CSS, or `isSwitcherOpen` state left in active source.

This slice intentionally does not implement the future ribbon membership model. It only clears the obsolete drawer path so later ribbon work has one switcher surface to build on.

## Current State

Current preferred path:

```text
fusion-studio-client/src/components/WorkspaceTitle.tsx
fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/components/WorkspaceCarousel.tsx
fusion-studio-client/src/state/workspaceStore.ts
```

Current obsolete drawer path:

```text
fusion-studio-client/src/components/WorkspaceSwitcher.tsx
fusion-studio-client/src/components/WorkspaceSwitcher.css
```

Known references to remove or update:

```text
fusion-studio-client/src/components/App.tsx
fusion-studio-client/src/state/workspaceStore.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
```

## Scope

Primary scope:

```text
fusion-studio-client/src/components/App.tsx
fusion-studio-client/src/state/workspaceStore.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/components/WorkspaceSwitcher.tsx
fusion-studio-client/src/components/WorkspaceSwitcher.css
```

Support scope only if TypeScript/build proves it is directly required:

```text
fusion-studio-client/src/types/index.ts
```

Do not edit server code in this slice.

Do not edit Electron menu code in this slice.

Do not edit screenshot/carousel transition code in this slice.

## Non-Goals

Do not implement non-destructive workspace close/remove-from-ribbon behavior in Slice 1.

Do not change the existing ribbon hover-only remove/delete control in Slice 1. Later slices will redesign this as a ribbon exit/remove-from-ribbon action.

Do not replace `workspace:remove_requested` with `workspace:close_requested` or a new ribbon-membership message in Slice 1.

Do not add or modify Electron Workspaces menu behavior.

Do not add 24-hour grace period state.

Do not change workspace state reset/preservation policy.

Do not add drag reordering in Slice 1.

Do not change the plus button into a dropdown in Slice 1.

Do not add the zero-ribbon-workspace splash state in Slice 1.

Do not fix screenshot darkness, sizing, capture, or carousel transition behavior.

Do not redesign the ribbon, carousel, header title, chevrons, or keyboard shortcut behavior.

Do not add backward-compatible no-op switcher aliases. Delete the obsolete path cleanly.

## Task

1. Delete the obsolete drawer component and stylesheet.

   Remove:

   ```text
   fusion-studio-client/src/components/WorkspaceSwitcher.tsx
   fusion-studio-client/src/components/WorkspaceSwitcher.css
   ```

2. Remove drawer imports and mounts from `App.tsx`.

   Remove:

   ```ts
   import { WorkspaceSwitcher } from './WorkspaceSwitcher';
   ```

   Remove all `<WorkspaceSwitcher />` mounts from all render branches.

   Preserve all existing mounts for:

   ```text
   WorkspaceRibbon
   WorkspaceCarousel
   WorkspaceAddModal
   ```

3. Remove drawer-only state and actions from `workspaceStore.ts`.

   Remove from the interface and store implementation:

   ```text
   isSwitcherOpen
   openSwitcher
   closeSwitcher
   ```

   Preserve:

   ```text
   isRibbonOpen
   openRibbon
   closeRibbon
   toggleRibbon
   requestSwitch
   requestRemove
   cycleWorkspace
   openAddModal
   closeAddModal
   ```

4. Update stale drawer-close calls in `workspace-handlers.ts`.

   Existing `store.closeSwitcher()` calls are stale because the drawer path is gone.

   Replace them with the smallest correct behavior:

   - On `workspace:switched`, close the ribbon if it should dismiss after explicit switch events.
   - On `workspace:added`, close the add modal. Only close the ribbon if preserving current UX requires it.
   - Do not add a new switcher-close alias.

   Prefer direct existing store actions like `store.closeRibbon()` only when appropriate.

5. Confirm the preferred current UX path is untouched.

   Do not modify the logic in these files unless TypeScript requires a tiny cleanup from removed types:

   ```text
   fusion-studio-client/src/components/WorkspaceTitle.tsx
   fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
   fusion-studio-client/src/components/WorkspaceRibbon.tsx
   fusion-studio-client/src/components/WorkspaceCarousel.tsx
   ```

## Preserve These Behaviors

- Clicking the workspace name toggles the ribbon.
- Header chevrons cycle workspaces.
- Option/Alt + Left/Right cycles workspaces and opens the ribbon.
- Releasing Option/Alt closes the ribbon.
- Workspace carousel renders while the ribbon is open.
- Ribbon item click switches workspace and closes the ribbon.
- Ribbon Add Project closes the ribbon and opens the add modal.
- Any currently coded ribbon remove control keeps the existing `requestRemove` behavior and confirmation copy for Slice 1 only.
- Empty/loading states still mount `WorkspaceRibbon` and `WorkspaceAddModal` as they do today.

## Acceptance Checks

Run from repo root:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected result: no hits.

Run:

```bash
rg -n "WorkspaceRibbon|WorkspaceCarousel|toggleRibbon|openRibbon|closeRibbon|cycleWorkspace" fusion-studio-client/src/components fusion-studio-client/src/hooks fusion-studio-client/src/state
```

Expected result: hits still exist for the current ribbon/carousel path.

Run:

```bash
rg -n "workspace:close_requested|workspace-close-times|Workspaces'|label: 'Workspaces'" fusion-studio-client fusion-studio-server
```

Expected result: no new hits from this slice. If there were pre-existing hits, report them and do not change them.

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Then:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

## Manual Smoke

If validation passes, use the normal app restart flow for this repo/session, then smoke:

1. Click workspace name in the top header. Ribbon opens.
2. Click workspace name again or the scrim. Ribbon closes.
3. Click a different workspace in the ribbon. It switches and the ribbon closes.
4. Hold Option/Alt and press Left/Right. Workspace cycles, ribbon opens, carousel appears.
5. Release Option/Alt. Ribbon and carousel close.
6. Click Add Project in the ribbon. Ribbon closes and add modal opens.
7. Confirm there is no drawer UI and no old menu-button drawer activation path.

## Worker Final Response Requirements

Include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- `rg` acceptance check results.
- `npm run build` result.
- `git diff --check` result.
- Any files touched outside the declared scope, with reason.
