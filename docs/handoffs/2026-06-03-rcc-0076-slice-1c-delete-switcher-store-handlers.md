# Worker Handoff: RCC-0076 Slice 1C - Delete Drawer Store State And Files

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

The tree may already be dirty with unrelated user/session work. Inspect before editing and do not overwrite unrelated changes.

## Dependency

Run this only after Slice 1B has completed and the orchestrator has reviewed the report.

Before editing, confirm `App.tsx` no longer imports or mounts `WorkspaceSwitcher`:

```bash
rg -n "WorkspaceSwitcher" fusion-studio-client/src/components/App.tsx
```

Expected result: no hits. If there are hits, stop and report that Slice 1B is incomplete.

## Required Reading

Read these before editing:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-1b-detach-switcher-from-app.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Goal

Finish Slice 1 by deleting the obsolete drawer implementation, drawer CSS, drawer-only store state/actions, and stale drawer-close calls in workspace message handlers.

After this slice, there should be only one workspace switcher UI path in active client source:

```text
WorkspaceTitle -> workspaceStore.isRibbonOpen -> WorkspaceRibbon + WorkspaceCarousel
```

## Edit Scope

Primary scope:

```text
fusion-studio-client/src/state/workspaceStore.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/components/WorkspaceSwitcher.tsx
fusion-studio-client/src/components/WorkspaceSwitcher.css
```

Support scope only if TypeScript/build proves it is directly required:

```text
fusion-studio-client/src/types/index.ts
```

Do not edit server code, Electron menu code, screenshot code, carousel transition code, or future ribbon membership code.

## Task

1. Delete:

   ```text
   fusion-studio-client/src/components/WorkspaceSwitcher.tsx
   fusion-studio-client/src/components/WorkspaceSwitcher.css
   ```

2. In `fusion-studio-client/src/state/workspaceStore.ts`, remove drawer-only state and actions from the interface and implementation:

   ```text
   isSwitcherOpen
   openSwitcher
   closeSwitcher
   ```

3. Preserve existing ribbon/add-modal/request actions:

   ```text
   isRibbonOpen
   isAddModalOpen
   openRibbon
   closeRibbon
   toggleRibbon
   requestSwitch
   requestRemove
   cycleWorkspace
   openAddModal
   closeAddModal
   ```

4. In `fusion-studio-client/src/lib/ws/workspace-handlers.ts`, replace stale `store.closeSwitcher()` calls with the smallest correct current-ribbon behavior:

   - On `workspace:switched`, use `store.closeRibbon()` so explicit workspace switches dismiss the ribbon.
   - On `workspace:added`, keep `store.closeAddModal()` and do not add a switcher alias. Only close the ribbon if existing current UX requires it; if uncertain, leave ribbon behavior unchanged and report the choice.

5. Do not add no-op aliases like `closeSwitcher: closeRibbon`. Delete the obsolete path cleanly.

## Preserve These Behaviors

- Clicking the workspace name toggles the ribbon.
- Header chevrons cycle workspaces.
- Option/Alt + Left/Right cycles workspaces and opens the ribbon.
- Releasing Option/Alt closes the ribbon.
- Workspace carousel renders while the ribbon is open.
- Ribbon item click switches workspace and closes the ribbon.
- Ribbon Add Project closes the ribbon and opens the add modal.
- Any currently coded ribbon remove control keeps existing `requestRemove` behavior and confirmation copy for Slice 1 only.

## Non-Goals

- Do not implement non-destructive workspace close/remove-from-ribbon behavior.
- Do not change the existing ribbon hover-only remove/delete control.
- Do not replace `workspace:remove_requested` with a new message type.
- Do not add Electron Workspaces menu behavior.
- Do not add 24-hour grace period state.
- Do not change workspace state reset/preservation policy.
- Do not add drag reordering.
- Do not change the plus button into a dropdown.
- Do not add zero-ribbon-workspace splash behavior.
- Do not fix screenshot darkness, sizing, capture, or carousel transition behavior.

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

## Manual Smoke Optional

If validation passes and this session can restart the app safely, use the normal app restart flow for this repo/session, then smoke:

1. Click workspace name in the top header. Ribbon opens.
2. Click workspace name again or the scrim. Ribbon closes.
3. Click a different workspace in the ribbon. It switches and the ribbon closes.
4. Hold Option/Alt and press Left/Right. Workspace cycles, ribbon opens, carousel appears.
5. Release Option/Alt. Ribbon and carousel close.
6. Click Add Project in the ribbon. Ribbon closes and add modal opens.
7. Confirm there is no drawer UI and no old menu-button drawer activation path.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed and files deleted.
- `rg` acceptance check results.
- `npm run build` result.
- `git diff --check` result.
- Whether manual smoke was run; if not, why not.
- Any files touched outside the declared scope, with reason.

## Expected Outcome

No `WorkspaceSwitcher`, `isSwitcherOpen`, `openSwitcher`, `closeSwitcher`, or `.rv-switcher*` drawer path remains in `fusion-studio-client/src`. The current ribbon/carousel path remains intact and the client builds.
