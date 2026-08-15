# Worker Handoff: RCC-0076 Slice 4 - Ribbon Plus Add-To-Ribbon Dropdown

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

The tree is expected to be dirty. Inspect before editing and do not overwrite unrelated changes.

## Required Reading

Read these before editing:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2a-ribbon-membership-model.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-3-ribbon-cancel-remove-membership.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Confirm prior slices are complete:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
rg -n "workspace:ribbon_remove_requested|requestRemoveFromRibbon|updateRibbonVisibility" fusion-studio-client/src fusion-studio-server
rg -n "ribbon_visible|ribbon_sort_order|ribbonVisible|ribbonSortOrder|toRibbonWorkspaces" fusion-studio-server fusion-studio-client/src
```

Expected:

- Obsolete switcher search has no hits.
- Slice 2A and Slice 3 searches have hits.

If `rg` is unavailable in your shell, use the available search tooling and report that substitution.

## Goal

Convert the far-right ribbon plus from a direct `Add Project` button into a dropdown for adding workspaces to the ribbon.

The dropdown should list registered workspaces that are not currently in the ribbon. Selecting one restores that workspace to the ribbon by setting `workspaces.ribbon_visible = 1` and assigning a persisted ribbon order.

Keep this slice focused on add-to-ribbon membership. Do not implement the later Add Project `/ai` requirement modal or Create New scaffold flow.

## Product Behavior

- Clicking the far-right plus opens a vertically scrollable dropdown.
- The dropdown lists registered workspaces where `ribbonVisible === false`.
- Selecting a hidden registered workspace adds it back to the top ribbon.
- Adding a hidden workspace back to the ribbon does not unregister, recreate, or duplicate it.
- Adding a hidden workspace back should append it to the end of the current ribbon order.
- If there is already an active workspace, adding a hidden workspace back should not switch active workspace.
- If there is no active workspace because all ribbon workspaces were removed, adding one back should make the restored workspace active so the app exits the current empty state safely.
- The dropdown includes `Add Project` and `Create New` actions.
- `Add Project` keeps the existing behavior for now: close the ribbon/dropdown and open the existing add modal.
- `Create New` should be visible but disabled/coming-soon in this slice unless a real existing creation flow already exists. Do not implement project scaffolding in this slice.

## Edit Scope

Primary client scope:

```text
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/components/WorkspaceRibbon.css
fusion-studio-client/src/state/workspaceStore.ts
fusion-studio-client/src/types/index.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
```

Primary server scope:

```text
fusion-studio-server/lib/workspace/registry-service.js
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/lib/ws/workspace-request-handlers.js
```

Support scope only if build/tests prove it is directly required:

```text
fusion-studio-client/src/components/WorkspaceCarousel.tsx
fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
fusion-studio-server/test/
```

Do not edit Electron menu code. Do not edit workspace creation/scaffolding code. Do not edit view registry files. Do not add drag reordering.

## Task

### 1. Add client helpers/actions

In `fusion-studio-client/src/state/workspaceStore.ts`, add a helper for hidden registered workspaces, for example:

```ts
export function toHiddenRibbonWorkspaces(workspaces: Workspace[]): Workspace[] { ... }
```

It should:

- Filter to `workspace.ribbonVisible === false`.
- Sort by `sortOrder` or label for stable display. Prefer `sortOrder` to keep registered order semantics.

Add a new action:

```ts
requestAddToRibbon: (workspaceId: string) => void;
```

It should send:

```ts
{ type: 'workspace:ribbon_add_requested', workspaceId }
```

Keep existing actions unchanged:

```text
requestAdd
requestSwitch
requestRemove
requestRemoveFromRibbon
```

### 2. Convert plus button into dropdown trigger

In `fusion-studio-client/src/components/WorkspaceRibbon.tsx`:

- Keep the far-right plus visually present.
- Clicking plus toggles a dropdown instead of directly opening Add Project.
- The dropdown is anchored near the plus button inside the ribbon.
- The dropdown is vertically scrollable when the hidden workspace list is long.
- The dropdown lists hidden registered workspaces from `toHiddenRibbonWorkspaces(workspaces)`.
- Each hidden workspace item should show its icon and label.
- Clicking a hidden workspace item calls `requestAddToRibbon(workspace.id)`.
- After selecting a hidden workspace, close the dropdown. Keep the ribbon open unless active state changes naturally from the server.
- Include an `Add Project` action that preserves existing behavior: close dropdown, close ribbon, open existing add modal.
- Include a `Create New` action visible in the dropdown. For this slice, make it disabled or clearly marked `Coming soon` unless a real existing creation flow is already present. Do not implement scaffolding.
- Clicking outside the dropdown should close it. The existing ribbon scrim may close the whole ribbon; that is acceptable.
- Pressing Escape while dropdown is open should close the dropdown first, not require adding a global app-level handler.

Implementation notes:

- Local `useState` in `WorkspaceRibbon` is fine for dropdown open/closed state.
- A local `useEffect` for Escape/click-outside is acceptable because this is local UI state, not orchestration.
- Do not introduce a separate component unless the file becomes hard to read. Minimal is preferred.

### 3. Add dropdown styles

In `fusion-studio-client/src/components/WorkspaceRibbon.css`:

- Add styles for the dropdown using existing ribbon tokens and variables.
- Use CSS variables with fallbacks for colors, spacing, radius, z-index, and shadows.
- Keep class prefix consistent with existing file: `.rv-workspace-ribbon-*`.
- Do not hardcode a new visual system.
- Ensure the dropdown works on narrow screens: set a reasonable max-width and max-height with vertical scrolling.

### 4. Add server WebSocket routing

In `fusion-studio-server/lib/ws/workspace-request-handlers.js`, add a handler for:

```text
workspace:ribbon_add_requested
```

Validate `workspaceId` as a non-empty string. Emit:

```js
emit('workspace:ribbon_add_requested', {
  workspaceId: clientMsg.workspaceId,
  connectionId: session.connectionId,
});
```

Do not route this through `workspace:add_requested`. That message means adding/registering a project, not restoring ribbon membership.

### 5. Add registry update method for add-back/order

In `fusion-studio-server/lib/workspace/registry-service.js`, add a pure data-access method, for example:

```js
async function updateRibbonMembership(id, { visible, ribbonSortOrder }) { ... }
```

or extend the existing `updateRibbonVisibility` if it remains clear and minimal.

The add-back path should update:

```text
ribbon_visible = 1
ribbon_sort_order = next ribbon order
```

Do not change `sort_order`. Do not insert a new workspace row. Do not delete anything.

Add a helper to compute max current `ribbon_sort_order` if useful:

```js
async function maxRibbonSortOrder() { ... }
```

When computing max, handle `NULL` by falling back to `sort_order` so migrated rows behave correctly.

### 6. Add controller handler

In `fusion-studio-server/lib/workspace/workspace-controller.js`:

- Subscribe to `workspace:ribbon_add_requested` in `start()`.
- Add `handleRibbonAddRequested(event)`.
- Get the target by id; if unknown, warn and return.
- If target is already ribbon-visible, emit no change and return or just broadcast current registry; report your choice.
- Compute next ribbon order as one greater than the current max ribbon order.
- Update only `ribbon_visible` and `ribbon_sort_order` for the target.
- Emit `workspace:registry_changed` with the full registered workspace list after updating.
- If `activeWorkspaceId` is currently `null`, set active to the restored workspace, write `last_active_workspace_id`, and emit `workspace:switched` with `{ from: null, to: workspaceId, repoPath }`.
- If `activeWorkspaceId` is not null, do not switch active workspace.

Important: existing `workspace:add_requested` must remain the Add Project/register-new-project path. Do not repurpose it.

### 7. Client message handling

`workspace:registry_changed` already updates the client workspace list. Keep using it.

If active changes from `null` on add-back, existing `workspace:switched` should handle it. If it exposes a null/empty-state bug, make the smallest safe fix and report it.

## Non-Goals

- Do not implement `/ai` requirement modal for Add Project. That is Slice 4b.
- Do not implement Create New scaffold flow. That is Slice 4c.
- Do not implement drag reordering. That is Slice 5.
- Do not implement final zero-ribbon splash design. That is Slice 6.
- Do not unregister/delete workspaces.
- Do not change `workspace:remove_requested` semantics.
- Do not change `workspace:ribbon_remove_requested` semantics except for compatibility if absolutely required.
- Do not add Electron menu behavior.

## Acceptance Checks

Run from repo root:

```bash
rg -n "workspace:ribbon_add_requested|requestAddToRibbon|toHiddenRibbonWorkspaces|ribbon_add" fusion-studio-client/src fusion-studio-server
```

Expected result: hits for the new client request action/helper and server request/controller path.

Run:

```bash
rg -n "workspace:add_requested" fusion-studio-client/src/state/workspaceStore.ts fusion-studio-server/lib/ws/workspace-request-handlers.js fusion-studio-server/lib/workspace/workspace-controller.js
```

Expected result: existing Add Project/register path still exists.

Run:

```bash
rg -n "workspace:ribbon_remove_requested|requestRemoveFromRibbon|updateRibbonVisibility" fusion-studio-client/src fusion-studio-server
```

Expected result: Slice 3 remove-from-ribbon path still exists.

Run:

```bash
rg -n "Create New|Add Project|Remove from ribbon|cancel" fusion-studio-client/src/components/WorkspaceRibbon.tsx
```

Expected result: all copy/icon paths present.

Run:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected result: no hits.

Run client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Run relevant server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

If that command is unsupported, report the exact failure and run the narrowest available relevant test command instead.

Then:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Known note: full-repo `git diff --check` may fail on pre-existing trailing whitespace in `fusion-studio-server/lib/transcription/index.js:287`. If so, run targeted `git diff --check` for touched files and report both results.

## Manual Smoke Optional

If validation passes and this session can restart the app safely, smoke these behaviors:

1. Remove a workspace from the ribbon with the `cancel` action.
2. Click the far-right plus. Dropdown opens.
3. Confirm the removed workspace appears in the dropdown.
4. Select the removed workspace. It reappears in the ribbon, appended to the end.
5. Confirm active workspace does not change when adding back while another workspace is active.
6. If possible, remove all ribbon workspaces, then add one back; it should become active.
7. Click `Add Project`; existing add modal opens.
8. Confirm `Create New` is visible but disabled/coming-soon if no real create flow exists.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- New WebSocket message type added.
- How hidden registered workspaces are computed for the dropdown.
- How next ribbon order is computed on add-back.
- Whether `workspace:add_requested` remained unchanged.
- Whether `workspace:ribbon_remove_requested` remained unchanged.
- What happens when adding back while `activeWorkspaceId` is `null`.
- `rg` acceptance check results.
- `npm run build` result.
- Server test result or why a narrow/no server test was used.
- `git diff --check` result, including targeted result if full repo has pre-existing whitespace failure.
- Whether manual smoke was run; if not, why not.
- Any files touched outside declared scope, with reason.

## Expected Outcome

The ribbon plus opens a dropdown that can restore registered workspaces hidden from the ribbon. Add Project remains the existing project-registration flow, Create New is visible but deferred, and no workspace deletion/unregistration behavior changes.
