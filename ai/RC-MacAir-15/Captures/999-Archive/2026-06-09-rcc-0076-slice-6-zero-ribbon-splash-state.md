# Worker Handoff: RCC-0076 Slice 6 - Zero-Ribbon Splash State

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
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2a-ribbon-membership-model.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-3-ribbon-cancel-remove-membership.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4-ribbon-plus-add-dropdown.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-5-ribbon-drag-reorder.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

## Current Architecture Facts

- Ribbon membership is separate from workspace registration.
- Removing a workspace from the ribbon sends `workspace:ribbon_remove_requested` and updates only `workspaces.ribbon_visible`.
- Adding a hidden workspace back sends `workspace:ribbon_add_requested` and appends via `ribbon_sort_order`.
- `fusion-studio-client/src/components/App.tsx` already imports and renders `EmptyStateView` when `activeWorkspaceId` is `null`.
- `fusion-studio-client/src/components/EmptyStateView.tsx` exists and currently opens the Add Project modal.
- `fusion-studio-client/src/components/WorkspaceRibbon.tsx` keeps the Add button/dropdown outside the mapped ribbon items, so the plus action should remain visible when there are zero ribbon-visible workspaces.
- `fusion-studio-server/lib/workspace/workspace-controller.js` can already set `activeWorkspaceId` to `null` when the active workspace is removed from the ribbon and no ribbon workspace remains.
- `fusion-studio-client/electron/protocol-handler.cjs` already accepts a falsy workspace root by storing `null` and returning `503 No active workspace` for protocol requests.

## Goal

Complete and verify the zero-ribbon-workspace splash state.

When every registered workspace is hidden from the ribbon, Fusion Studio should not force-select a registered workspace. It should show a clear empty/splash state while keeping the ribbon plus/dropdown available so the user can restore a hidden workspace, add an existing `/ai` project, or create a new project.

## Product Behavior

- Users may remove the last visible workspace from the ribbon.
- Registered workspaces remain registered; zero ribbon workspaces only means none are currently visible in the ribbon.
- When no ribbon workspace is active, the main workspace area shows a splash/empty state instead of stale workspace panels or `Discovering panels...`.
- The centered workspace title remains usable to open the ribbon.
- The ribbon plus/dropdown remains usable with zero ribbon-visible workspaces.
- The add-to-ribbon dropdown lists hidden registered workspaces when they exist.
- Adding a hidden workspace back to the ribbon should switch to it if active workspace is currently `null`.
- Add Project and Create New actions remain available from the plus/dropdown.
- No workspace folders or view registries are deleted or rewritten by this slice.

## Known Likely Gaps To Check First

Check these before making changes:

1. `App.tsx` currently reads `activeWorkspaceId` through `useWorkspaceStore.getState().activeWorkspaceId` inside render. That is not a Zustand subscription and may not reliably re-render when `workspace:switched` sets the active workspace to `null`. Prefer subscribing with `const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);` and using that value in the branch.
2. `workspace-handlers.ts` handles `workspace:switched` with `to: null`, but only calls `window.electronAPI?.setWorkspaceRoot(...)` when `repoPath` exists. That may leave Electron's protocol handler pointed at the previous workspace. Decide whether to explicitly clear it on `null`; if you do, update the TypeScript type in `src/types/electron.d.ts` from `string` to `string | null` and keep the implementation minimal.
3. `panelStoreTypes.ts` types `setProjectRoot` as `(root: string) => void`, while `panelStore.activateWorkspace(null)` already sets `projectRoot: null`. If you need to set the project root to `null` directly during `workspace:switched`, update the type intentionally to `string | null`.
4. Verify `usePanelStore.getState().activateWorkspace(null)`, `useFileStore.getState().activateWorkspace(null)`, and `useWikiStore.getState().activateWorkspace(null)` clear enough state to avoid showing stale project content before the empty state branch renders.

## Implementation Scope

Primary client scope:

```text
fusion-studio-client/src/components/App.tsx
fusion-studio-client/src/components/EmptyStateView.tsx
fusion-studio-client/src/components/EmptyStateView.css
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/state/panelStore.ts
fusion-studio-client/src/state/panelStoreTypes.ts
fusion-studio-client/src/types/electron.d.ts
```

Primary server scope for validation only unless a bug is proven:

```text
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/lib/ws/workspace-broadcaster.js
fusion-studio-server/server.js
```

Do not edit view-management files from Slices 2C/2D unless a build/type issue directly requires it.

## Client Requirements

Minimal expected fix:

- Subscribe to `activeWorkspaceId` in `App.tsx` instead of reading it with `useWorkspaceStore.getState()` during render.
- Keep the current empty-state branch mounted when `hasReceivedWorkspaceInit && activeWorkspaceId === null`.
- Keep `WorkspaceRibbon`, `WorkspaceAddModal`, `WorkspaceCreateModal`, and `ModalOverlay` mounted in the null-active branch.
- Ensure the empty state does not render `ToolsPanel`, `WorkspaceCarousel`, workspace panels, chat panels, or stale content.

If needed after testing:

- Clear Electron workspace root when `workspace:switched` has `to: null` or `repoPath: null`.
- Clear `panelStore.projectRoot`/`panelRoots` if stale roots survive null activation.
- Adjust `EmptyStateView` copy to make restoring a hidden workspace obvious. Keep this small; do not redesign the app.

Potential copy if you adjust the empty state:

```text
No workspaces in ribbon
Use Add in the workspace ribbon to restore a hidden workspace, add a project, or create a new one.
```

## Server Requirements

Validate existing behavior before changing server code:

- Removing the last ribbon-visible active workspace should set server active workspace to `null`.
- The server should persist `last_active_workspace_id` as empty/null-equivalent when there is no active workspace.
- `workspace:switched` should broadcast `to: null` and `repoPath: null` when there is no next ribbon workspace.
- Adding a hidden workspace back while active is `null` should set it active and emit `workspace:switched` for that workspace.
- Server `workspace:init` should send `activeWorkspaceId: null` and `activeRepoPath: null` after restart/reconnect when no active workspace exists.

Do not change server fallback behavior for a non-null persisted active workspace unless zero-ribbon testing proves it incorrectly selects a hidden workspace after restart.

## Non-Goals

- Do not unregister/delete workspaces.
- Do not delete folders or view registries.
- Do not change `sort_order` or `ribbon_sort_order` semantics.
- Do not change drag reorder behavior from Slice 5.
- Do not change Add Project `/ai` validation from Slice 4B.
- Do not implement Electron menu/state reset/grace period/screenshot follow-ups.
- Do not redesign the ribbon or app shell.

## Acceptance Checks

Run from repo root:

```bash
rg -n "activeWorkspaceId|EmptyStateView|workspace:switched|setWorkspaceRoot|setProjectRoot" fusion-studio-client/src/components/App.tsx fusion-studio-client/src/lib/ws/workspace-handlers.ts fusion-studio-client/src/state/panelStore.ts fusion-studio-client/src/state/panelStoreTypes.ts fusion-studio-client/src/types/electron.d.ts fusion-studio-client/electron/preload.cjs fusion-studio-client/electron/protocol-handler.cjs
```

Expected:

- `App.tsx` subscribes to `activeWorkspaceId` through `useWorkspaceStore(...)`.
- The null-active branch renders `EmptyStateView` and keeps ribbon/add/create modal UI available.
- If Electron root clearing is implemented, `setWorkspaceRoot` accepts `string | null` in client types and falsy roots clear protocol state.

Run:

```bash
rg -n "workspace:ribbon_remove_requested|workspace:ribbon_add_requested|pickNextRibbonWorkspace|activeWorkspaceId = nextId|to: nextId|repoPath: next" fusion-studio-server/lib/workspace/workspace-controller.js
```

Expected:

- Removing the final ribbon workspace allows `nextId` to be `null`.
- Adding back from hidden state activates the restored workspace when active is `null`.

Run targeted diff whitespace check for touched files. Example:

```bash
git diff --check -- fusion-studio-client/src/components/App.tsx fusion-studio-client/src/lib/ws/workspace-handlers.ts fusion-studio-client/src/state/panelStoreTypes.ts fusion-studio-client/src/types/electron.d.ts fusion-studio-client/src/components/EmptyStateView.tsx fusion-studio-client/src/components/EmptyStateView.css
```

Run client build:

```bash
cd fusion-studio-client
npm run build
```

Avoid full `git diff --check` unless you account for known pre-existing whitespace in:

```text
fusion-studio-server/lib/transcription/index.js:287
```

## Manual Smoke

If the app can be launched safely:

1. Start Fusion Studio.
2. Open the workspace ribbon.
3. Remove every visible workspace from the ribbon using the cancel/remove button.
4. Confirm the main area shows the splash/empty state, not stale panels or loading forever.
5. Open the ribbon with zero visible workspace items.
6. Click Add.
7. Confirm hidden registered workspaces appear under Add to ribbon.
8. Restore one hidden workspace.
9. Confirm it appears in the ribbon, becomes active, and normal panels load.
10. Confirm Add Project and Create New are still reachable from the plus/dropdown.

If manual smoke is skipped, report why.

## Report Back

Report:

- Files changed.
- Whether each likely gap above existed and how it was handled.
- Verification commands and results.
- Whether manual smoke was run.
- Any remaining risk around stale Electron protocol root, stale panel root, or restart behavior with zero ribbon workspaces.
