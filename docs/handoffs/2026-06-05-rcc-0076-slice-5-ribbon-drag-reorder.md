# Worker Handoff: RCC-0076 Slice 5 - Workspace Ribbon Drag Reordering

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

The tree is expected to be heavily dirty. Inspect before editing and do not overwrite unrelated changes.

If `rg` is unavailable in your shell, use available grep/search tooling and report the substitution.

## Required Reading

Read these before working:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2a-ribbon-membership-model.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-3-ribbon-cancel-remove-membership.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4-ribbon-plus-add-dropdown.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Current Architecture Facts

- Top workspace ribbon UI is `fusion-studio-client/src/components/WorkspaceRibbon.tsx`.
- Ribbon sorting uses `toRibbonWorkspaces()` in `fusion-studio-client/src/state/workspaceStore.ts`.
- Existing persisted fields are `workspaces.ribbon_visible` and `workspaces.ribbon_sort_order`.
- Server registry access is `fusion-studio-server/lib/workspace/registry-service.js`.
- Server orchestration is `fusion-studio-server/lib/workspace/workspace-controller.js`.
- Existing ribbon membership messages:
  - `workspace:ribbon_remove_requested`
  - `workspace:ribbon_add_requested`
- Carousel and keyboard cycling already depend on `toRibbonWorkspaces()`, so reordering `ribbonSortOrder` should automatically update those flows.

## Goal

Allow users to drag workspace tiles within the top ribbon to reorder ribbon-visible workspaces.

Persist the order by updating `ribbon_sort_order` for the visible ribbon workspaces. Do not change registered workspace `sort_order`.

## Product Behavior

- Dragging a workspace tile within the ribbon reorders visible ribbon workspaces.
- The order persists across sessions.
- Keyboard workspace cycling follows the new order.
- Fullscreen workspace carousel follows the new order.
- Removing from ribbon still only sets `ribbon_visible = false`.
- Adding a hidden workspace back still appends at the end.
- Dragging does not switch the active workspace just because a drag happened.
- Clicking without dragging still switches workspace as before.
- The Add button/dropdown remains fixed at the far right and is not draggable.
- Dragging should not trigger the remove/cancel button.

## Data Rules

- Reorder only ribbon-visible workspaces.
- Persist all visible ribbon workspaces with contiguous `ribbon_sort_order` values after a reorder.
- Preserve `sort_order` unchanged.
- Preserve hidden workspaces and their visibility state.
- Hidden workspaces may keep old `ribbon_sort_order` values; they are ignored while hidden.
- On add-back, existing Slice 4 behavior can continue to append by max visible ribbon order + 1.

## Implementation Scope

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
fusion-studio-server/lib/ws/workspace-request-handlers.js
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/lib/workspace/registry-service.js
fusion-studio-server/lib/ws/workspace-broadcaster.js
```

Support scope only if tests prove it is required:

```text
fusion-studio-server/test/**
fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
fusion-studio-client/src/components/WorkspaceCarousel.tsx
```

Do not edit view-management files from Slices 2C/2D unless a type/build issue directly requires it.

## Suggested Message Contract

Client request:

```json
{
  "type": "workspace:ribbon_reorder_requested",
  "workspaceIds": ["fs-dev", "fusion-home", "media-editor"]
}
```

Rules:

- `workspaceIds` should contain exactly the currently visible ribbon workspace ids in desired order.
- Server validates the list against currently visible ribbon workspaces.
- On success, emit existing `workspace:registry_changed` with full workspace list.
- On rejection, send targeted error if current request-handler patterns support that; otherwise emit/log a clear rejection message without changing data.

If current request-handler architecture makes a targeted rejection awkward, use the same error response style already used for invalid workspace requests.

## Server Requirements

Add data access in `registry-service.js`:

- A focused method to update multiple `ribbon_sort_order` values.
- Use a transaction if available/easy with current DB access.
- Do not update `sort_order`.
- Do not change `ribbon_visible`.

Add controller behavior:

- Listen for `workspace:ribbon_reorder_requested`.
- Validate `workspaceIds` is a non-empty array of strings.
- Load registered workspaces and compute current visible ribbon ids using the same order convention as the client.
- Reject if the submitted set differs from current visible ribbon ids.
- Persist contiguous order values in submitted order.
- Emit `workspace:registry_changed` with the updated full registry.
- Do not emit `workspace:switched`.

Validation details:

- Duplicate ids reject.
- Missing visible ids reject.
- Extra ids reject.
- Hidden workspace ids reject.
- Unknown ids reject.

## Client Requirements

Implement drag behavior in `WorkspaceRibbon.tsx`.

Acceptable minimal approach:

- Use native HTML drag events on ribbon item elements.
- Track `draggingWorkspaceId` and `dragOverWorkspaceId` locally.
- Set `draggable` on workspace items.
- Use `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`.
- Prevent dragging from the remove/cancel button.
- On drop, compute the new ordered visible ribbon ids and send `workspace:ribbon_reorder_requested`.
- Optionally update local visual state optimistically, but do not create a separate source of truth. Existing `workspace:registry_changed` should reconcile state.

Visual behavior:

- Add a subtle dragging class for the dragged item.
- Add a subtle drop-target/over class for the target item.
- Keep styles in `WorkspaceRibbon.css` using existing CSS variables/fallbacks.
- Do not redesign the ribbon.

In `workspaceStore.ts`:

- Add `requestRibbonReorder(workspaceIds: string[])` or equivalent.
- Keep `toRibbonWorkspaces()` as the single client order helper.

In types/handlers:

- Add message type(s) as needed.
- Existing `workspace:registry_changed` should update local workspace order.

## Non-Goals

- Do not implement drag reordering for left-nav views.
- Do not implement zero-ribbon splash state. That is Slice 6.
- Do not change Add Project/Create New behavior.
- Do not change remove-from-ribbon behavior.
- Do not change workspace deletion/unregister behavior.
- Do not update registered workspace `sort_order`.
- Do not add a new persistence model.
- Do not redesign the ribbon/carousel.

## Acceptance Checks

Run from repo root:

```bash
rg -n "workspace:ribbon_reorder_requested|requestRibbonReorder|ribbon_sort_order|updateRibbon" fusion-studio-client/src fusion-studio-server/lib
```

Expected: reorder message and persistence path exist.

Run:

```bash
rg -n "draggable|onDragStart|onDragOver|onDrop|is-dragging|is-drop" fusion-studio-client/src/components/WorkspaceRibbon.tsx fusion-studio-client/src/components/WorkspaceRibbon.css
```

Expected: drag UI path exists.

Run:

```bash
rg -n "sort_order" fusion-studio-server/lib/workspace/registry-service.js fusion-studio-server/lib/workspace/workspace-controller.js
```

Expected: no new reorder code writes registered workspace `sort_order`; only `ribbon_sort_order` should be updated for this slice.

Run:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected: no hits.

Run client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Run targeted server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/thread/thread-messages.test.js
```

Add or run a narrow reorder persistence test if practical.

Run targeted diff check:

```bash
git diff --check -- \
  fusion-studio-client/src/components/WorkspaceRibbon.tsx \
  fusion-studio-client/src/components/WorkspaceRibbon.css \
  fusion-studio-client/src/state/workspaceStore.ts \
  fusion-studio-client/src/types/index.ts \
  fusion-studio-client/src/lib/ws/workspace-handlers.ts \
  fusion-studio-server/lib/ws/workspace-request-handlers.js \
  fusion-studio-server/lib/workspace/workspace-controller.js \
  fusion-studio-server/lib/workspace/registry-service.js \
  fusion-studio-server/lib/ws/workspace-broadcaster.js
```

Avoid relying only on full-repo `git diff --check`; the repo has known pre-existing whitespace in `fusion-studio-server/lib/transcription/index.js:287`.

## Manual Smoke

If validation passes and the app can be restarted safely:

1. Open the workspace ribbon.
2. Drag a workspace tile to a different position.
3. Confirm the ribbon order changes and persists after refresh/restart.
4. Confirm header chevrons cycle in the new order.
5. Confirm Option/Alt + Left/Right cycles in the new order and carousel tracks it.
6. Confirm clicking a tile without dragging still switches workspaces.
7. Confirm remove-from-ribbon still removes only from ribbon.
8. Confirm Add dropdown still appends hidden workspace back to the end.

If manual smoke changes real ribbon order, report final order. Do not revert unrelated changes.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files intentionally changed.
- Message contract implemented.
- How drag/drop computes order.
- How server validates the submitted order.
- How `ribbon_sort_order` is persisted.
- Confirmation that `sort_order` was not changed.
- Acceptance check results.
- Build/test results.
- Manual smoke results, or why smoke was not run.
- Any files touched outside declared scope, with reason.

## Expected Outcome

Users can drag workspace tiles in the top ribbon to reorder visible ribbon workspaces. The new order persists via `ribbon_sort_order` and automatically drives ribbon display, carousel order, and keyboard cycling.
