# RCC-0076 Implementation Report - Workspace Ribbon + Menu Bar

## Ticket

Ticket source:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/issues-viewer/inbox/RCC-0076.md
```

Title: `Obsolete WorkspaceSwitcher drawer; ribbon + menu bar only`

Core ticket goal:

- Remove the obsolete slide-out `WorkspaceSwitcher` drawer.
- Make the top workspace ribbon the primary visual switcher.
- Add an Electron menu bar `Workspaces` menu.
- Make closing/removing workspaces non-destructive by hiding them from the ribbon, not unregistering them.
- Support zero visible ribbon workspaces with a recoverable splash state.
- Reset focus state on close while preserving geometry and collections.

## Filesystem Orientation

All active project work is under:

```text
/Users/rccurtrightjr./projects/fs-dev
```

Active source roots:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
/Users/rccurtrightjr./projects/fs-dev/docs
/Users/rccurtrightjr./projects/fs-dev/ai
```

Do not climb through unrelated macOS folders such as `/Users`, `/Applications`, `/System`, `/Library`, or `~/Library` unless an explicit task requires it.

Treat this folder as scaffold/template source, not live app source of truth unless a task explicitly targets templates:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files
```

## Current Status

RCC-0076 core implementation is functionally complete and build-verified through:

- WorkspaceSwitcher drawer removal.
- Ribbon membership model.
- Live workspace view registry migration needed for workspace/view management.
- Remove-from-ribbon behavior.
- Add-to-ribbon dropdown.
- Add Project `/ai` requirement.
- Create New live registry validation.
- Left-nav view management.
- Ribbon drag reordering.
- Zero-ribbon splash state.
- Electron `Workspaces` menu bridge.
- Close-state focus reset.

Remaining RCC-0076 follow-ups:

- 24-hour grace period and hard-reset behavior.
- Screenshot/render transition bug investigation.
- Manual Electron smoke validation across zero-ribbon, menu, and close reset flows.

## Important Repo State Notes

The repo has been heavily dirty throughout this work. Many unrelated files are modified or untracked. Do not assume every dirty file belongs to RCC-0076.

Known repeated constraints:

- Preserve unrelated dirty work.
- Use targeted verification rather than broad destructive cleanup.
- `rg` has been unavailable in some worker shells; workers used built-in search tooling as substitute.
- Full `git diff --check` may encounter unrelated pre-existing whitespace. Use targeted `git diff --check -- <touched-files>`.
- Known pre-existing whitespace mentioned during work: `fusion-studio-server/lib/transcription/index.js:287`.

## Roadmap And Handoff Files

Primary roadmap/handoff:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
```

Implementation and review handoffs produced/used:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-orchestration-plan.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-1a-switcher-drawer-preflight-report.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-1b-detach-switcher-from-app.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-1c-delete-switcher-store-handlers.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2a-ribbon-membership-model.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-registered-workspaces.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-results.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-2b-migrate-live-view-registry.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-2c-left-nav-view-context-menu.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-2d-left-nav-add-restore-view-menu.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-3-ribbon-cancel-remove-membership.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4-ribbon-plus-add-dropdown.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4b-add-project-ai-requirement.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4c-create-new-project-view-templates.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-4c-validate-create-new-live-registry.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-5-ribbon-drag-reorder.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-slice-6-zero-ribbon-splash-state.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-electron-workspaces-menu.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-close-state-reset.md
```

This report:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-implementation-report.md
```

## What Was Implemented

### 1. Removed Obsolete WorkspaceSwitcher Drawer

Goal:

- Remove the old slide-out workspace switcher so there is only one primary visual workspace switcher path.

Outcome:

- Deleted obsolete component and CSS:
  - `fusion-studio-client/src/components/WorkspaceSwitcher.tsx`
  - `fusion-studio-client/src/components/WorkspaceSwitcher.css`
- Removed `WorkspaceSwitcher` imports/usages from app layout.
- Removed obsolete switcher store state/actions such as `isSwitcherOpen`, `openSwitcher`, and `closeSwitcher`.
- Preserved the top ribbon and carousel path:
  - `WorkspaceTitle -> workspaceStore.isRibbonOpen -> WorkspaceRibbon + WorkspaceCarousel`

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/App.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceTitle.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceCarousel.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/workspaceStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/ws/workspace-handlers.ts
```

### 2. Added Ribbon Membership Model

Goal:

- Separate “registered workspace” from “visible in ribbon”.

Outcome:

- Added persisted registry fields:
  - `ribbon_visible`
  - `ribbon_sort_order`
- Added client sorting/filtering helpers:
  - `toRibbonWorkspaces()`
  - `toHiddenRibbonWorkspaces()`
- Updated ribbon, carousel, and keyboard cycling to use ribbon-visible workspaces.

Important behavior:

- A workspace can remain registered while hidden from the ribbon.
- Hidden workspaces can be restored later.
- Ribbon order is independent from registered workspace `sort_order`.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/workspaceStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceCarousel.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/registry-service.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/db/migrations/025_workspace_ribbon_membership.js
```

### 3. Audited And Migrated Live Workspace View Registries

Goal:

- Ensure registered workspaces can safely move to the new live workspace view registry before adding richer workspace/view management.

Outcome:

- Audited registered workspaces.
- Created primary live registry files where needed:
  - `ai/system/workspace/views.json`
- Preserved legacy `ai/views/index.json` as compatibility output only.
- Preserved custom/unknown views explicitly.
- Treated `System Source Files` as template/scaffold source, not global live source of truth.

Registered workspaces audited:

```text
/Users/rccurtrightjr./projects/fs-dev
/Users/rccurtrightjr./projects/fs-dev/System Source Files
/Users/rccurtrightjr./projects/fusion-home
/Users/rccurtrightjr./projects/media-editor
/Users/rccurtrightjr./projects/solobooks
```

External live registry files created:

```text
/Users/rccurtrightjr./projects/fusion-home/ai/system/workspace/views.json
/Users/rccurtrightjr./projects/media-editor/ai/system/workspace/views.json
/Users/rccurtrightjr./projects/solobooks/ai/system/workspace/views.json
```

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/views/index.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/panels.ts
```

### 4. Changed Ribbon Remove To Hide From Ribbon

Goal:

- Make the cancel/remove button on a ribbon tile close/hide the workspace from the ribbon instead of unregistering it.

Outcome:

- Added client request action:
  - `workspace:ribbon_remove_requested`
- Server now updates only `workspaces.ribbon_visible` for remove-from-ribbon.
- True unregister remains separate through `workspace:remove_requested`.
- Removing the active workspace switches to the next visible ribbon workspace when available.
- Removing the final visible workspace sets active workspace to `null`.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/workspaceStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/workspace-controller.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/registry-service.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-request-handlers.js
```

### 5. Added Ribbon Plus Dropdown

Goal:

- Keep the far-right plus action available and make hidden workspaces recoverable.

Outcome:

- Added plus/dropdown UI in `WorkspaceRibbon`.
- Dropdown lists hidden registered workspaces.
- Added actions:
  - `workspace:ribbon_add_requested`
  - Add Project
  - Create New
- Add-back appends by max visible `ribbon_sort_order + 1`.
- If active workspace is `null`, adding a hidden workspace back switches to it.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.css
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/workspaceStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/workspace-controller.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/registry-service.js
```

### 6. Added Add Project `/ai` Requirement

Goal:

- Add Project should register only existing projects that already contain `/ai`.

Outcome:

- Add Project no longer creates top-level `/ai` implicitly.
- Server rejects missing `/ai` with a targeted message:
  - `workspace:add_rejected_missing_ai`
- Client shows a clear modal explaining that the project needs `/ai` or should be created through Create New.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/bootstrap-service.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/workspace-controller.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-broadcaster.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/ws/workspace-handlers.ts
```

### 7. Added Create New Project Flow With View Templates

Goal:

- Create New should scaffold a new project, including `/ai`, from selected view templates.

Outcome:

- Added Create New modal.
- Added workspace creation request flow:
  - `workspace:create_manifest_requested`
  - `workspace:create_manifest`
  - `workspace:create_requested`
  - `workspace:create_rejected`
  - `workspace:created`
- New projects write primary live registry:
  - `ai/system/workspace/views.json`
- Legacy `ai/views/index.json` remains compatibility output.
- New project is registered, made ribbon-visible, appended to ribbon order, and switched active.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceCreateModal.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceCreateModal.css
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/workspaceStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/create-service.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/workspace-controller.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-request-handlers.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-broadcaster.js
```

### 8. Added Left-Nav View Management

Goal:

- Manage views inside the active workspace using the live registry.

Outcome:

- Per-view context menu in `ToolsPanel`:
  - Rename
  - Change icon
  - Move up
  - Move down
  - Hide view
- Empty-space left-nav menu:
  - Restore View
  - Add View
- Added messages:
  - `workspace:view_update_requested`
  - `workspace:view_registry_updated`
  - `workspace:view_update_rejected`
  - `workspace:view_options_requested`
  - `workspace:view_options`
  - `workspace:view_restore_requested`
  - `workspace:view_add_requested`
- View registry is authoritative for label/icon/rank.
- View-management mutations update only `ai/system/workspace/views.json`.
- They do not delete folders and do not edit legacy registry.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/ToolsPanel.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/ToolsPanel.css
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/panelStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/panels.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/views/index.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/client-message-router.js
```

### 9. Added Workspace Ribbon Drag Reorder

Goal:

- Let users reorder visible ribbon workspaces by dragging tiles.

Outcome:

- Native drag/drop implemented in `WorkspaceRibbon`.
- Added request:
  - `workspace:ribbon_reorder_requested`
- Server validates submitted list exactly matches current visible ribbon workspaces.
- Persisted only `ribbon_sort_order`.
- Registered workspace `sort_order` remains unchanged.
- Carousel and keyboard cycling follow the same `toRibbonWorkspaces()` order.
- Edge drops and live scoot preview were fixed during review.
- Threshold logic uses dragged tile edges:
  - Moving right: dragged right edge crossing 50% of underlying tile.
  - Moving left: dragged left edge crossing 50% of underlying tile.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.css
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/workspaceStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/workspace-controller.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/registry-service.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-request-handlers.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-broadcaster.js
```

### 10. Added Zero-Ribbon Splash State

Goal:

- Allow zero visible ribbon workspaces and provide a recoverable empty state.

Outcome:

- `App.tsx` now subscribes to `activeWorkspaceId` through Zustand instead of reading `getState()` during render.
- When `activeWorkspaceId === null`, app renders `EmptyStateView` instead of stale panels or loading forever.
- The zero-active branch keeps mounted:
  - `WorkspaceRibbon`
  - `WorkspaceAddModal`
  - `WorkspaceCreateModal`
  - `ModalOverlay`
- Empty state copy explains “No workspaces in ribbon”.
- Header `WorkspaceTitle` now renders a fallback `No workspace selected` title button so the ribbon remains reachable when there is no active workspace.
- `EmptyStateView.css` was adjusted so the fixed empty state does not cover the header/ribbon trigger.
- Electron protocol root is cleared when workspace root is `null`.
- Server preserves intentional zero-active state on restart when `last_active_workspace_id` is empty.

Review fixes made:

- `WorkspaceTitle.tsx`: render fallback title button for null active workspace.
- `EmptyStateView.css`: start empty state below header using `inset: var(--header-height, 60px) 0 0 0`.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/App.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceTitle.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/EmptyStateView.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/EmptyStateView.css
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/ws/workspace-handlers.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/panelStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/panelStoreTypes.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/types/electron.d.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/workspace-controller.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/protocol-handler.cjs
```

### 11. Added Electron Workspaces Menu Bridge

Goal:

- Add menu-bar workspace management without giving Electron its own workspace registry source of truth.

Outcome:

- Added top-level Electron `Workspaces` menu.
- Renderer syncs workspace menu snapshot to Electron through:
  - `workspace-menu:set-state`
- Menu lists registered workspaces as checkbox items.
- Checkbox checked state reflects `ribbonVisible`.
- Hidden workspace check delegates to:
  - `requestAddToRibbon(workspaceId)`
  - `requestSwitch(workspaceId)`
- Visible workspace uncheck delegates to:
  - `requestRemoveFromRibbon(workspaceId)`
- Menu actions delegate to existing renderer store actions:
  - `workspace-menu:show-ribbon`
  - `workspace-menu:add-project`
  - `workspace-menu:create-project`
  - `workspace-menu:switch`
  - `workspace-menu:set-ribbon-visible`

Important design decision:

- Electron main renders menu state but does not read SQLite or server workspace files.
- Renderer remains the source of truth for workspace menu state.

Caveat:

- Current checkbox semantics follow the simpler toggle contract. Clicking a visible checked workspace acts as uncheck/remove-from-ribbon, not switch. A separate menu design change would be needed if selecting visible checked items should switch without toggling.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/main.cjs
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/preload.cjs
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/hooks/useElectronMenu.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/types/electron.d.ts
```

### 12. Added Close-State Focus Reset

Goal:

- When a workspace is removed from the ribbon/menu, reset focus state but preserve geometry and collections.

Outcome:

- Server emits:
  - `workspace:ribbon_removed`
- Client handles `workspace:ribbon_removed` and calls:
  - `resetWorkspaceFocusState(workspaceId)`
- Reset clears:
  - `currentPanel`
  - project/view thread focus
  - secondary chat focus
  - popup open/thread bindings
  - per-view `currentThreadId`
  - per-view `secondaryThreadId`
  - dropdown focus state
  - live/cached panel focus state
- Reset preserves:
  - `panelConfigs`
  - `panelRoots`
  - `viewStates.*.widths`
  - `viewStates.*.collapsed`
  - `viewStates.*.tints`
  - popup geometry (`x`, `y`, `width`, `height`)
- Reset pushes replacement `workspace:cache_push` when WebSocket is open.
- File explorer tabs are untouched.

Review fixes made:

- `panelStore.ts`: inactive workspaces with no cached state now no-op instead of seeding an empty cached state that could block normal rediscovery later.
- `workspace-broadcaster.js`: `workspace:ribbon_removed` waits behind pending `workspace:switched` broadcast because switch broadcasting is async and performs style/theme reads before sending. This preserves required client ordering.

Key files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/panelStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/panelStoreTypes.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/ws/workspace-handlers.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/types/index.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/workspace-controller.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-broadcaster.js
```

## Current Message/Event Map

Workspace registry and switching:

```text
workspace:init
workspace:registry_changed
workspace:switched
workspace:added
workspace:removed
```

Ribbon membership/order:

```text
workspace:ribbon_remove_requested
workspace:ribbon_add_requested
workspace:ribbon_reorder_requested
workspace:ribbon_removed
workspace:ribbon_reorder_rejected
```

Add/Create:

```text
workspace:add_requested
workspace:add_rejected_duplicate
workspace:add_rejected_missing_ai
workspace:create_manifest_requested
workspace:create_manifest
workspace:create_requested
workspace:create_rejected
workspace:created
```

View registry management:

```text
workspace:view_options_requested
workspace:view_options
workspace:view_update_requested
workspace:view_restore_requested
workspace:view_add_requested
workspace:view_registry_updated
workspace:view_update_rejected
```

Electron menu bridge:

```text
workspace-menu:set-state
workspace-menu:show-ribbon
workspace-menu:add-project
workspace-menu:create-project
workspace-menu:switch
workspace-menu:set-ribbon-visible
```

## Verification Summary

Repeated verification that passed across slices:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Targeted server syntax checks that passed:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node --check lib/workspace/workspace-controller.js
node --check lib/ws/workspace-broadcaster.js
```

Targeted server tests that passed:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/thread/thread-messages.test.js
```

Expected test result:

```text
Test Suites: 2 passed, 2 total
Tests: 10 passed, 10 total
```

Repeated build warnings were non-fatal and pre-existing/expected:

- Vite/gray-matter `eval` warning.
- Vite large chunk warnings.
- Node warning in test command: `--localstorage-file was provided without a valid path`.

Targeted `git diff --check` was used throughout on touched files and passed after review fixes.

## Manual Smoke Still Needed

Electron app smoke was not run during these implementation/review turns. Before calling RCC-0076 fully closed, run a live Electron smoke.

Suggested smoke path:

1. Launch Fusion Studio.
2. Confirm `WorkspaceSwitcher` drawer is gone.
3. Open the top workspace ribbon from the centered title.
4. Switch between visible workspaces from the ribbon.
5. Drag reorder ribbon workspaces and confirm order persists after restart/refresh.
6. Remove one non-active workspace from the ribbon and confirm it remains registered/hidden.
7. Restore it from the ribbon plus dropdown.
8. Remove all visible workspaces from the ribbon.
9. Confirm zero-ribbon splash appears and header title remains clickable.
10. Restore a workspace from the ribbon plus dropdown.
11. Open Electron `Workspaces` menu.
12. Confirm registered workspaces appear as checkboxes.
13. Uncheck a visible workspace and confirm it hides from ribbon.
14. Check a hidden workspace and confirm it returns and switches active.
15. Use Electron menu `Show Workspace Ribbon`, `Add Project...`, and `Create New Project...`.
16. Test close-state reset:
   - Switch to non-default view.
   - Open/focus thread/page/popup state.
   - Resize/collapse panes.
   - Open file explorer tabs.
   - Remove workspace from ribbon/menu.
   - Restore it.
   - Confirm stale focus is reset, geometry remains, file tabs remain.

## Remaining Work

### 24-Hour Grace Period

Original ticket asks for:

- Workspace closed -> soft reset.
- Reopen within 24 hours -> preserved collections remain.
- Closed longer than 24 hours -> hard reset on next launch.
- Timer stored in user data, originally suggested as:
  - `~/Library/Application Support/Fusion Studio/workspace-close-times.json`

This has not been implemented.

Recommended next handoff:

- Define storage location using Electron/server user-data path, not raw hardcoded macOS traversal.
- Add close timestamp recording when `workspace:ribbon_removed` occurs.
- Add startup cleanup that hard-resets expired closed workspace state.
- Preserve current soft-reset semantics for <24h.

### Screenshot / Render Transition Bug

Original ticket mentions screenshot darkness/sizing mismatch during workspace switching.

This has not been investigated in the RCC-0076 implementation slices.

Possible next steps:

- Capture live Electron screenshots during workspace switching.
- Compare screenshot capture dimensions to live renderer dimensions.
- Check color space/gamma behavior.
- Decide whether to fix capture or remove/replace screenshot transition.

### Menu Checkbox Semantics Follow-Up

Current Electron menu uses checkbox toggle semantics. That means a checked visible workspace click may remove it from the ribbon. The handoff accepted this as the simpler checkbox-toggle contract, but the product text also said selecting a checked visible workspace should switch.

If desired, create a small follow-up to change the menu design, for example:

- Workspace submenu item with separate `Switch to <workspace>` and `Show in Ribbon` checkbox.
- Or active workspace disabled/marked, hidden workspaces checkable, visible inactive workspaces switchable.

## Key Architectural Decisions

- Registered workspace membership is distinct from ribbon visibility.
- `workspace:ribbon_remove_requested` hides from ribbon; it does not unregister.
- `workspace:remove_requested` remains true unregister/delete-from-registry behavior.
- `ribbon_sort_order` controls visible ribbon order; `sort_order` is preserved as registration order.
- Live workspace view registry is `ai/system/workspace/views.json`.
- Legacy `ai/views/index.json` is compatibility-only output.
- Electron main does not own workspace registry state. Renderer sends a sanitized menu snapshot to Electron.
- Zero visible ribbon workspaces is a valid state.
- Active workspace can be `null`.
- Close-state reset is soft reset only; 24-hour hard reset remains future work.

## Most Important Files To Review Later

Client app shell and ribbon:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/App.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceTitle.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceRibbon.css
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/WorkspaceCarousel.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/EmptyStateView.tsx
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/EmptyStateView.css
```

Client stores and handlers:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/workspaceStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/panelStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/panelStoreTypes.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/fileStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/wikiStore.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/ws/workspace-handlers.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
```

Electron menu bridge:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/main.cjs
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/preload.cjs
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/protocol-handler.cjs
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/hooks/useElectronMenu.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/types/electron.d.ts
```

Server workspace lifecycle:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/workspace-controller.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/registry-service.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/bootstrap-service.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/create-service.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/workspace/state-cache.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-request-handlers.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/workspace-broadcaster.js
```

Server view registry:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/views/index.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/panels.ts
```

Types:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/types/index.ts
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/types/electron.d.ts
```

## Pick-Up Checklist

When resuming later:

1. Start in `/Users/rccurtrightjr./projects/fs-dev`.
2. Inspect current state:

```bash
git status --short
git log --oneline -10
```

3. Read this report.
4. Read latest remaining-work handoff if one exists.
5. Decide whether to run manual Electron smoke before implementing 24-hour grace period.
6. If implementing grace period, do not change close-state reset semantics unless smoke proves they are wrong.
7. Use targeted checks on touched files.
8. Preserve unrelated dirty files.
