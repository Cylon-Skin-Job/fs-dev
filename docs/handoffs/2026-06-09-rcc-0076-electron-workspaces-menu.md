# Worker Handoff: RCC-0076 Follow-Up - Electron Workspaces Menu

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

## Filesystem Orientation

All active project work for this handoff is under:

```text
/Users/rccurtrightjr./projects/fs-dev
```

Use these active source roots:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
/Users/rccurtrightjr./projects/fs-dev/docs
/Users/rccurtrightjr./projects/fs-dev/ai
```

Do not climb through unrelated macOS folders such as `/Users`, `/Applications`, `/System`, `/Library`, or `~/Library` unless an explicit command in this handoff requires it.

Treat this folder as scaffold/template source, not the live app source of truth unless the task explicitly targets templates:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files
```

The tree is expected to be heavily dirty. Inspect before editing and do not overwrite unrelated changes.

If `rg` is unavailable in your shell, use available grep/search tooling and report the substitution.

## Required Reading

Read these before working:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/issues-viewer/inbox/RCC-0076.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2a-ribbon-membership-model.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-3-ribbon-cancel-remove-membership.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4-ribbon-plus-add-dropdown.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-slice-6-zero-ribbon-splash-state.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Current Architecture Facts

- Electron menu construction is in `fusion-studio-client/electron/main.cjs` via `buildMenu()`.
- Renderer menu events arrive through `sendMenuAction(payload)` and `window.electronAPI.onMenuAction(...)`.
- Renderer handler is `fusion-studio-client/src/hooks/useElectronMenu.ts`.
- Preload API is `fusion-studio-client/electron/preload.cjs`; TypeScript window type is `fusion-studio-client/src/types/electron.d.ts`.
- Workspace registry state lives in the renderer store, not Electron:
  - `fusion-studio-client/src/state/workspaceStore.ts`
  - `workspaces`
  - `activeWorkspaceId`
  - `ribbonVisible` / `ribbonSortOrder`
- Existing renderer actions already express the needed intents:
  - `openRibbon()`
  - `openAddModal()`
  - `openCreateModal()`
  - `requestSwitch(workspaceId)`
  - `requestRemoveFromRibbon(workspaceId)`
  - `requestAddToRibbon(workspaceId)`
- Do not read SQLite or server files from Electron main for this slice. The renderer is the source of truth for menu state.

## Goal

Add an Electron menu bar `Workspaces` menu that stays in sync with the renderer workspace registry and delegates actions back to existing workspace flows.

This is the menu-bar counterpart to the top workspace ribbon. It must not reintroduce the deleted `WorkspaceSwitcher` drawer or create another workspace persistence model.

## Product Behavior

- App menu includes a top-level `Workspaces` menu.
- The menu lists registered workspaces as checkbox items.
- Checkbox checked state reflects `workspace.ribbonVisible !== false`.
- Selecting a checked visible item should switch to that workspace.
- Checking a hidden workspace should add it back to the ribbon and switch to it.
- Unchecking a visible workspace should remove it from the ribbon only.
- Menu state updates when workspaces are added, hidden, restored, reordered, removed, or switched.
- Menu provides actions for:
  - `Show Workspace Ribbon`
  - `Add Project...`
  - `Create New Project...`
- Zero-ribbon state remains recoverable from the Electron menu: hidden registered workspaces should be checkable, and Add/Create actions should still work.

## Implementation Model

Use a renderer-to-main snapshot bridge.

Main process:

- Store a module-level `workspaceMenuState` object with safe serializable data only:

```js
{
  workspaces: [
    { id, label, ribbonVisible, ribbonSortOrder, sortOrder }
  ],
  activeWorkspaceId: string | null
}
```

- Add an IPC listener such as `workspace-menu:set-state`.
- Rebuild the application menu when this state changes.
- Add a top-level `Workspaces` menu in `buildMenu()`.
- Each workspace checkbox click should send a `menu-action` payload to the renderer; do not mutate workspace state directly in Electron.

Preload:

- Expose a method such as `setWorkspaceMenuState(state)` that sends the IPC message.
- Keep payload plain JSON; no functions or class instances.

Renderer:

- Add a small hook or effect that subscribes to `useWorkspaceStore` data and calls `window.electronAPI?.setWorkspaceMenuState(...)` whenever the workspace list or active id changes.
- A focused implementation can live in `useElectronMenu.ts`, but keep that file one job: Electron menu bridge. If it gets too broad, create a small sibling hook and call it from `App.tsx` next to `useElectronMenu()`.
- Extend `useElectronMenu.ts` to handle Workspaces menu payloads and call existing store actions.

## Suggested Menu Shape

Add this top-level menu near `File` or after `View`; keep the exact placement consistent with existing menu style.

```text
Workspaces
  Show Workspace Ribbon
  ---------------------
  [x] FS Dev
  [x] Fusion Home
  [ ] Solobooks
  ---------------------
  Add Project...
  Create New Project...
```

Suggested menu-action payloads:

```js
{ type: 'workspace-menu:show-ribbon' }
{ type: 'workspace-menu:add-project' }
{ type: 'workspace-menu:create-project' }
{ type: 'workspace-menu:set-ribbon-visible', workspaceId, visible }
{ type: 'workspace-menu:switch', workspaceId }
```

Acceptable simpler contract:

- One payload for checkbox clicks:

```js
{ type: 'workspace-menu:toggle-ribbon-visible', workspaceId, visible }
```

Renderer behavior for that simpler contract:

- If `visible === false`, call `requestRemoveFromRibbon(workspaceId)`.
- If `visible === true`, call `requestAddToRibbon(workspaceId)` and then `requestSwitch(workspaceId)`.

Clicking an already visible checked workspace may be handled as a switch action if Electron's checkbox click semantics make that easier.

## Ordering Rules

- Menu workspace order should match the ribbon sorting convention when possible:
  - `ribbonSortOrder ?? sortOrder`
- Hidden workspaces should remain listed, checked false.
- If ordering ties exist, preserve the current renderer array order or fall back to label sorting only as a deterministic tie-breaker.
- Do not write `sort_order` or `ribbon_sort_order` in this slice.

## Implementation Scope

Primary client/Electron scope:

```text
fusion-studio-client/electron/main.cjs
fusion-studio-client/electron/preload.cjs
fusion-studio-client/src/hooks/useElectronMenu.ts
fusion-studio-client/src/types/electron.d.ts
fusion-studio-client/src/components/App.tsx
```

Support scope only if build proves it is directly required:

```text
fusion-studio-client/src/types/index.ts
fusion-studio-client/src/state/workspaceStore.ts
```

Server scope:

```text
None expected.
```

Do not edit server workspace controller/registry code unless an existing message contract is broken and the build/runtime proof is clear.

## Non-Goals

- Do not implement close-state reset/preservation policy.
- Do not implement the 24-hour grace period.
- Do not change screenshot capture or carousel transitions.
- Do not reintroduce `WorkspaceSwitcher`.
- Do not add Electron-side SQLite reads.
- Do not create a second workspace registry in Electron.
- Do not change ribbon drag reorder behavior.
- Do not change Add Project `/ai` validation or Create New scaffolding.

## Acceptance Checks

Run from repo root:

```bash
rg -n "Workspaces|workspace-menu|setWorkspaceMenuState|workspace-menu:set-state|onMenuAction" fusion-studio-client/electron/main.cjs fusion-studio-client/electron/preload.cjs fusion-studio-client/src/hooks/useElectronMenu.ts fusion-studio-client/src/types/electron.d.ts fusion-studio-client/src/components/App.tsx
```

Expected:

- Main process has a top-level `Workspaces` menu.
- Preload exposes a renderer-to-main workspace menu state method.
- Renderer handles Workspaces menu actions through existing store actions.
- Renderer syncs workspace list and active id to Electron.

Run:

```bash
rg -n "requestRemoveFromRibbon|requestAddToRibbon|requestSwitch|openRibbon|openAddModal|openCreateModal" fusion-studio-client/src/hooks/useElectronMenu.ts fusion-studio-client/src/state/workspaceStore.ts
```

Expected:

- Menu actions delegate to existing workspaceStore actions.

Run targeted diff whitespace check for touched files. Example:

```bash
git diff --check -- fusion-studio-client/electron/main.cjs fusion-studio-client/electron/preload.cjs fusion-studio-client/src/hooks/useElectronMenu.ts fusion-studio-client/src/types/electron.d.ts fusion-studio-client/src/components/App.tsx
```

Run client build:

```bash
cd fusion-studio-client
npm run build
```

Optional syntax check:

```bash
node --check electron/main.cjs
node --check electron/preload.cjs
```

## Manual Smoke

If the Electron app can be launched safely:

1. Start Fusion Studio.
2. Open the app menu and confirm `Workspaces` exists.
3. Confirm registered workspaces appear as checkbox items.
4. Confirm visible ribbon workspaces are checked and hidden workspaces are unchecked.
5. Select a checked visible workspace and confirm the app switches to it.
6. Uncheck a visible workspace and confirm it disappears from the ribbon but remains registered in the menu unchecked.
7. Check the hidden workspace and confirm it reappears in the ribbon and becomes active.
8. Remove all workspaces from the ribbon and confirm the menu can restore one from the zero-ribbon splash state.
9. Confirm `Show Workspace Ribbon`, `Add Project...`, and `Create New Project...` invoke the same UI as the header/ribbon flows.

If manual smoke is skipped, report why.

## Report Back

Report:

- Files changed.
- Menu action contract implemented.
- How renderer workspace state is synced to Electron.
- Verification commands and results.
- Whether manual smoke was run.
- Any residual risk around checkbox click semantics or menu refresh timing.
