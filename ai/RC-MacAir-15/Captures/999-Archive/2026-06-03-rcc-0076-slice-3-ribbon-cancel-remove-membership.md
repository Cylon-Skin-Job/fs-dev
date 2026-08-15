# Worker Handoff: RCC-0076 Slice 3 - Ribbon Cancel Removes Workspace From Ribbon Only

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
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Confirm Slice 1 and Slice 2A are complete:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
rg -n "ribbon_visible|ribbon_sort_order|ribbonVisible|ribbonSortOrder|toRibbonWorkspaces" fusion-studio-server fusion-studio-client/src
```

Expected:

- Obsolete switcher search has no hits.
- Ribbon membership model search has hits in migration, registry/controller, client type, and client store/list consumers.

If `rg` is unavailable in your shell, use the available search tooling and report that substitution.

## Goal

Replace the current ribbon hover trash/delete control with a Material Symbols `cancel` action that removes a workspace from the top ribbon only.

This must not unregister the workspace, delete files, delete themes, or call the existing destructive-ish `workspace:remove_requested` path.

After this slice:

- The top ribbon control uses `cancel`, not `delete`.
- Clicking it sets `workspaces.ribbon_visible = 0` for that workspace.
- The workspace remains in the registered workspace list.
- The workspace disappears from the ribbon because `toRibbonWorkspaces()` filters it out.
- The existing true unregister/remove path remains available internally and is not repurposed.

## Edit Scope

Primary client scope:

```text
fusion-studio-client/src/components/WorkspaceRibbon.tsx
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

Do not edit Electron menu code. Do not edit the plus button/dropdown behavior. Do not add drag reordering. Do not add a designed zero-ribbon splash state in this slice.

## Product Behavior

### Remove From Ribbon

The ribbon item control should:

- Use Material Symbols icon text `cancel`.
- Have copy such as `Remove from ribbon` for `title` and `aria-label`.
- Not use `delete` icon.
- Not call `requestRemove`.
- Not show destructive copy about files/repo deletion.

Confirmation is not required for this non-destructive action. If you keep a confirmation for safety, its copy must say `Remove from ribbon` and must not imply deletion/unregistration. Report the choice.

### Selection Rule When Removing Active Workspace

If removing a non-active workspace from the ribbon:

- Do not change `activeWorkspaceId`.
- Do not emit `workspace:switched`.

If removing the active workspace from the ribbon:

- Compute the current ribbon-ordered list before hiding the workspace.
- Count visible ribbon workspaces to the left and right of the active workspace.
- If the right side has more workspaces, switch to the immediate right neighbor.
- If the left side has more workspaces, switch to the immediate left neighbor.
- If counts are tied, switch to the immediate right neighbor.
- If there are no remaining ribbon workspaces, set active workspace to `null` and emit a switch to `null` so the current empty-state path can render safely.

This slice may rely on the existing empty-state path when active workspace becomes `null`. Do not design the final zero-ribbon splash state; that remains Slice 6.

## Task

### 1. Add a client request action

In `fusion-studio-client/src/state/workspaceStore.ts`, add a new action:

```ts
requestRemoveFromRibbon: (workspaceId: string) => void;
```

It should send:

```ts
{ type: 'workspace:ribbon_remove_requested', workspaceId }
```

Keep the existing `requestRemove` action unchanged. It remains the true unregister/remove request path.

### 2. Update the ribbon control

In `fusion-studio-client/src/components/WorkspaceRibbon.tsx`:

- Replace use of `requestRemove` with `requestRemoveFromRibbon` for the ribbon item control.
- Rename local handler as appropriate, e.g. `onRemoveFromRibbonClick`.
- Change icon text from `delete` to `cancel`.
- Change `title` and `aria-label` to `Remove from ribbon`.
- Keep `e.stopPropagation()` so clicking cancel does not switch workspace.
- Do not change the Add Project button behavior.
- Do not change the ribbon item click-to-switch behavior.

### 3. Add server WebSocket routing

In `fusion-studio-server/lib/ws/workspace-request-handlers.js`, add a handler for:

```text
workspace:ribbon_remove_requested
```

Validate that `workspaceId` is a non-empty string, matching the style of existing workspace request handlers.

Emit an event with the same type and `connectionId`:

```js
emit('workspace:ribbon_remove_requested', {
  workspaceId: clientMsg.workspaceId,
  connectionId: session.connectionId,
});
```

Do not route this to `workspace:remove_requested`.

### 4. Add registry update method

In `fusion-studio-server/lib/workspace/registry-service.js`, add a pure data-access method to update ribbon visibility, for example:

```js
async function updateRibbonVisibility(id, visible) { ... }
```

It should update only:

```text
ribbon_visible
```

Do not delete from `workspaces`. Do not delete from `workspace_themes`. Do not change `sort_order` or `ribbon_sort_order` in this slice.

Export the new method.

### 5. Add controller handler

In `fusion-studio-server/lib/workspace/workspace-controller.js`:

- Subscribe to `workspace:ribbon_remove_requested` in `start()`.
- Add `handleRibbonRemoveRequested(event)`.
- Get the target by id; if unknown, warn and return.
- Build the current ribbon list from `await registry.list()` using the same rule as the client: `ribbonVisible !== false`, ordered by `ribbonSortOrder ?? sortOrder`.
- Hide the target with `registry.updateRibbonVisibility(workspaceId, false)`.
- Emit `workspace:registry_changed` with the full registered workspace list after updating.
- Emit a distinct event such as `workspace:ribbon_removed` if useful, but do not require the client to depend on it for basic behavior.

For active workspace selection:

- If target is not active, stop after registry update/broadcast.
- If target is active, choose the next active workspace using the selection rule above.
- Update `activeWorkspaceId`, `activeWorkspace`, and `last_active_workspace_id` consistently with existing switch/remove logic.
- Emit `workspace:switched` with `{ from, to, repoPath }` when active changes, including `to: null` and `repoPath: null` when no ribbon workspaces remain.

Important: existing `handleRemoveRequested` must remain a true unregister/delete-from-registry path. Do not repurpose or weaken it in this slice.

### 6. Client message handling

`workspace:registry_changed` already updates the client workspace list. Keep using that path.

If you add `workspace:ribbon_removed`, either handle it as a no-op or do not handle it. Do not duplicate state mutation if `workspace:registry_changed` already does it.

If active changes, the existing `workspace:switched` handler should continue to run. If `to: null` exposes a bug in that handler, make the smallest safe fix and report it.

## Non-Goals

- Do not implement the plus dropdown or add-back flow. That is Slice 4.
- Do not implement the final zero-ribbon splash design. That is Slice 6.
- Do not add drag reordering. That is Slice 5.
- Do not add Electron menu behavior.
- Do not delete/unregister workspaces from this ribbon cancel action.
- Do not change `workspace:remove_requested` semantics.
- Do not change screenshots or carousel transition behavior except for safety when no ribbon workspaces remain.

## Acceptance Checks

Run from repo root:

```bash
rg -n "workspace:ribbon_remove_requested|requestRemoveFromRibbon|updateRibbonVisibility|ribbon_removed" fusion-studio-client/src fusion-studio-server
```

Expected result: hits for the new client request action and server request/controller/registry path.

Run:

```bash
rg -n "requestRemove\(|workspace:remove_requested" fusion-studio-client/src/components/WorkspaceRibbon.tsx fusion-studio-client/src/state/workspaceStore.ts fusion-studio-server/lib/ws/workspace-request-handlers.js fusion-studio-server/lib/workspace/workspace-controller.js
```

Expected:

- `WorkspaceRibbon.tsx` should have no `requestRemove(` usage.
- `workspaceStore.ts` should still define existing `requestRemove` for the true unregister path.
- Server should still have the existing `workspace:remove_requested` path unchanged.

Run:

```bash
rg -n 'material-symbols-outlined">delete|>delete<|delete</span>' fusion-studio-client/src/components/WorkspaceRibbon.tsx
```

Expected result: no hits for the ribbon control. If shell quoting is awkward, inspect/search the file and report the result.

Run:

```bash
rg -n "cancel|Remove from ribbon" fusion-studio-client/src/components/WorkspaceRibbon.tsx
```

Expected result: hits for icon/copy.

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

1. Open the workspace ribbon from the header title.
2. Confirm each workspace tile uses a `cancel` icon/action, not `delete`.
3. Remove a non-active workspace from the ribbon; active workspace should not change.
4. Remove the active workspace when there are workspaces on both sides; selection follows the side-count rule, defaulting right on tie.
5. Confirm removed workspace is no longer shown in the ribbon.
6. Confirm removed workspace still exists in the registered workspace data/server DB and was not deleted from disk.
7. Confirm current Add Project behavior is unchanged.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- New WebSocket message type added.
- Whether `workspace:remove_requested` remained unchanged.
- How active-workspace selection is computed when removing the active ribbon item.
- What happens when the last ribbon workspace is removed.
- `rg` acceptance check results.
- `npm run build` result.
- Server test result or why a narrow/no server test was used.
- `git diff --check` result, including targeted result if full repo has pre-existing whitespace failure.
- Whether manual smoke was run; if not, why not.
- Any files touched outside declared scope, with reason.

## Expected Outcome

The ribbon no longer presents workspace removal as deletion. The `cancel` action removes only ribbon membership by updating persisted `ribbon_visible`, while registered workspace records and files remain intact. The app remains buildable and ready for Slice 4, where the plus button becomes the add-back dropdown for registered workspaces not currently in the ribbon.
