# Worker Handoff: RCC-0076 Follow-Up - Close-State Reset

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
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Issues/inbox/RCC-0076.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Views/doc-viewer/specs/ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-slice-6-zero-ribbon-splash-state.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-electron-workspaces-menu.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Focus reading:

- `RCC-0076.md` lines 65-100: Workspace State Reset on Close.
- `ROADMAP.md` lines 713-728: State Reset Behavior.

## Current Architecture Facts

- Closing a workspace from the top ribbon or Electron menu currently means `workspace:ribbon_remove_requested`.
- Server handling is in `fusion-studio-server/lib/workspace/workspace-controller.js`.
- Server broadcasts workspace events from `fusion-studio-server/lib/ws/workspace-broadcaster.js`.
- Renderer workspace WebSocket handling is in `fusion-studio-client/src/lib/ws/workspace-handlers.ts`.
- Client workspace focus/cache state lives primarily in `fusion-studio-client/src/state/panelStore.ts`.
- Persisted lightweight workspace state is saved through `workspace:cache_push` to `fusion-studio-server/lib/workspace/state-cache.js`.
- File explorer tabs are currently global in `fusion-studio-client/src/state/fileStore.ts`; `activateWorkspace()` explicitly says tabs are not workspace-scoped yet. Do not clear them in this slice.
- `viewStates` contains both focus-ish state and preserved geometry-ish state:
  - Preserve: `widths`, `collapsed`, `tints`.
  - Reset: active thread ids, open popup/thread focus, selected/current focus fields.
- `currentPanel` is currently cached per workspace and should be treated as focus state for this slice.

## Goal

When a workspace is closed from the ribbon or Electron Workspaces menu, reset its focus state while preserving geometry, collections, and theme-related state.

This is a soft reset only. The 24-hour grace period and hard-reset behavior are separate future work.

## Product Behavior

When a workspace is removed from the ribbon:

- It remains registered.
- It disappears from the ribbon.
- If it was active, Fusion Studio switches to the next ribbon workspace or the zero-ribbon splash state.
- Its focus state is reset before it is restored later.
- Reopening/restoring it from the ribbon plus dropdown or Electron Workspaces menu should not restore stale focused view/page/thread/popup selection.
- File explorer tabs are preserved.
- Panel widths, sidebar/chat collapse geometry, and tint/theme settings are preserved.

Reset/discard:

- Active view / focused panel (`currentPanel`).
- Current project/view chat thread focus (`currentThreadIds`, view state current thread ids).
- Open secondary/popup focus and thread bindings.
- Wiki selected/viewed page state.
- Any per-view focus data represented by `currentThreadId`, `secondaryThreadId`, or open popup thread state.

Preserve:

- Registered workspace row and `ribbonVisible === false` state.
- File explorer tabs.
- `panelConfigs` and `panelRoots` needed for fast reload.
- Layout geometry: pane widths and collapse state.
- Theme/tint settings.
- Workspace view registry files.

## Suggested Event Contract

Add a broadcast event after a workspace has been removed from the ribbon:

```js
emit('workspace:ribbon_removed', { workspaceId })
```

Broadcast wire message:

```json
{ "type": "workspace:ribbon_removed", "workspaceId": "fs-dev" }
```

Important ordering:

- For active workspace removal, emit `workspace:switched` first, then `workspace:ribbon_removed`.
- Rationale: the client switch path may save the old active workspace state into cache. The reset event must run after that save so it can replace the stale focus cache with the reset cache.
- For non-active workspace removal, emit `workspace:ribbon_removed` after `workspace:registry_changed`.

## Client Requirements

Add a focused reset helper in `panelStore` such as:

```ts
resetWorkspaceFocusState(workspaceId: string): void
```

The helper should:

- Reset cached state for `workspaceId` in `workspaceState`.
- If `workspaceId` is currently active in `panelStore`, also reset live panel focus state safely.
- Preserve `panelConfigs` and `panelRoots` if available.
- Preserve `viewStates[view].widths`.
- Preserve `viewStates[view].collapsed`.
- Preserve `viewStates[view].tints`.
- Reset `currentPanel` to the first available panel id, otherwise `file-viewer`.
- Reset chat/thread focus containers for that workspace.
- Reset view popup/thread focus while preserving popup size/position if currently present.
- Send a replacement `workspace:cache_push` for the reset state when the WebSocket is open.

Use existing defaults where possible:

- `createEmptyWorkspaceState()` in `panelStore.ts`.
- `DEFAULT_VIEW_UI_STATE` in `state/slices/viewSlice.ts` if needed.

In `workspace-handlers.ts`:

- Handle `workspace:ribbon_removed`.
- Call `usePanelStore.getState().resetWorkspaceFocusState(msg.workspaceId)`.
- If the removed workspace is currently active in `wikiStore`, reset wiki focus state or rely on `activateWorkspace(...)` if the switch already happened. Do not add broad resets unless necessary.

Do not clear `fileStore.tabs`.

## Server Requirements

In `workspace-controller.js`:

- Emit `workspace:ribbon_removed` after `registry.updateRibbonVisibility(workspaceId, false)`.
- Preserve existing `workspace:registry_changed` behavior.
- Preserve existing active-workspace switching behavior.
- For active removal, emit `workspace:switched` before `workspace:ribbon_removed`.
- For non-active removal, emit `workspace:ribbon_removed` after `workspace:registry_changed`.

In `workspace-broadcaster.js`:

- Broadcast `workspace:ribbon_removed` to all clients.

No DB migration is expected.

## Implementation Scope

Primary client scope:

```text
fusion-studio-client/src/state/panelStore.ts
fusion-studio-client/src/state/panelStoreTypes.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/types/index.ts
```

Primary server scope:

```text
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/lib/ws/workspace-broadcaster.js
```

Support scope only if build/tests prove it is directly required:

```text
fusion-studio-client/src/state/wikiStore.ts
fusion-studio-client/src/state/fileStore.ts
fusion-studio-server/lib/workspace/state-cache.js
fusion-studio-server/lib/ws/workspace-request-handlers.js
```

## Non-Goals

- Do not implement the 24-hour grace period.
- Do not implement hard reset of file tabs.
- Do not clear file explorer open tabs.
- Do not change workspace registration or unregister/delete behavior.
- Do not change `ribbon_sort_order` or drag reorder behavior.
- Do not change Add Project or Create New behavior.
- Do not change screenshot capture or carousel transitions.
- Do not edit workspace view registry files.
- Do not introduce a new persistence model.

## Acceptance Checks

Run from repo root:

```bash
rg -n "workspace:ribbon_removed|resetWorkspaceFocusState|workspace:cache_push" fusion-studio-client/src fusion-studio-server/lib
```

Expected:

- Server emits/broadcasts `workspace:ribbon_removed`.
- Client handles `workspace:ribbon_removed`.
- Client has a focused reset helper and pushes replacement cache state.

Run:

```bash
rg -n "tabs|activeTabPath|workspaceTrees" fusion-studio-client/src/state/fileStore.ts fusion-studio-client/src/state/panelStore.ts fusion-studio-client/src/lib/ws/workspace-handlers.ts
```

Expected:

- The reset path does not clear `fileStore.tabs`.

Run:

```bash
rg -n "widths|collapsed|tints|currentThreadId|secondaryThreadId|popup|currentPanel" fusion-studio-client/src/state/panelStore.ts fusion-studio-client/src/state/slices/viewSlice.ts fusion-studio-client/src/state/panelStoreTypes.ts
```

Expected:

- Reset helper preserves geometry/tints and clears focus/thread bindings.

Run targeted diff whitespace check for touched files. Example:

```bash
git diff --check -- fusion-studio-client/src/state/panelStore.ts fusion-studio-client/src/state/panelStoreTypes.ts fusion-studio-client/src/lib/ws/workspace-handlers.ts fusion-studio-client/src/types/index.ts fusion-studio-server/lib/workspace/workspace-controller.js fusion-studio-server/lib/ws/workspace-broadcaster.js
```

Run client build:

```bash
cd fusion-studio-client
npm run build
```

Run server syntax checks:

```bash
cd fusion-studio-server
node --check lib/workspace/workspace-controller.js
node --check lib/ws/workspace-broadcaster.js
```

Optional targeted server tests if they still apply cleanly:

```bash
cd fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/thread/thread-messages.test.js
```

## Manual Smoke

If the Electron app can be launched safely:

1. Open a workspace and switch to a non-default view.
2. Open or focus a thread/page/popup state that should be discarded.
3. Resize/collapse panes or confirm existing geometry is non-default.
4. Open one or more file explorer tabs.
5. Remove the workspace from the ribbon or uncheck it in Electron `Workspaces` menu.
6. Restore the workspace from the plus dropdown or Electron menu.
7. Confirm it does not restore stale focused view/page/thread/popup state.
8. Confirm file tabs are still present.
9. Confirm panel widths/collapse state/theme/tints are still preserved.

If manual smoke is skipped, report why.

## Report Back

Report:

- Files changed.
- Exact reset helper behavior.
- Event ordering used for active vs non-active ribbon removal.
- Verification commands and results.
- Whether manual smoke was run.
- Any remaining ambiguity around which view-specific fields should count as focus vs geometry.
