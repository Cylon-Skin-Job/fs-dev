# Worker Handoff: RCC-0076 Follow-Up - Ribbon Removal Runtime Cache Eviction

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

Inspect before editing and do not overwrite unrelated changes.

If `rg` is unavailable in your shell, use available grep/search tooling and report the substitution.

## Required Reading

Read these before working:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/issues-viewer/inbox/RCC-0076.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-implementation-report.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-close-state-reset.md
```

Standards note:

- Earlier handoffs referenced `/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.
- That live path was not present when this handoff was written.
- The only matching file was under `System Source Files`, which is scaffold/template source. Do not edit scaffold source for this task unless explicitly needed.

## Paradigm Decision

The product decision is now:

- Switching workspaces means “park this workspace for fast return.”
- Removing a workspace from the ribbon means “evict this workspace from active memory.”
- The original 24-hour grace period is intentionally dropped.
- Do not add close timestamp files, cleanup timers, delayed hard resets, or app-support grace-period storage.

## Current Architecture Facts

- Ribbon removal starts as `workspace:ribbon_remove_requested`.
- Server lifecycle handling is in `fusion-studio-server/lib/workspace/workspace-controller.js`.
- Server runtime workspace cache persistence is in `fusion-studio-server/lib/workspace/state-cache.js`.
- Server request routing is in `fusion-studio-server/lib/ws/workspace-request-handlers.js`.
- Server broadcasts are in `fusion-studio-server/lib/ws/workspace-broadcaster.js`.
- Client workspace message handling is in `fusion-studio-client/src/lib/ws/workspace-handlers.ts`.
- Client panel/runtime workspace cache is in `fusion-studio-client/src/state/panelStore.ts`.
- Client file tree workspace cache is in `fusion-studio-client/src/state/fileStore.ts`.
- File explorer tabs are currently global. Do not clear tabs in this slice.
- Durable workspace state is not the runtime cache. Do not modify durable state files for this behavior.

## Goal

When a workspace is removed from the ribbon, immediately evict runtime cache for that workspace.

Adding the workspace back later should reload through normal disk-backed discovery and state hydration.

## Product Behavior

When switching workspaces:

- Keep lightweight client workspace cache for fast return.
- Keep server `workspace-cache.json` entry for fast restart/refresh restoration.
- Keep file tree expansion cache if present.

When removing a workspace from the ribbon:

- Hide it from the ribbon.
- If it was active, switch to the next ribbon workspace or zero-ribbon splash state.
- Evict client `panelStore.workspaceState[workspaceId]`.
- Evict server `workspace-cache.json[workspaceId]`.
- Evict safe in-memory file tree cache for that workspace.
- Do not clear global file tabs.
- Do not unregister the workspace.
- Do not delete project files.
- Do not mutate durable workspace state files.

## Durable Files To Preserve

Do not modify these as part of ribbon removal cache eviction:

```text
ai/system/state/state.json
ai/views/<view>/settings/state.json
ai/system/workspace/views.json
ai/views/index.json
```

The runtime cache file may be modified:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/data/workspace-cache.json
```

## Server Requirements

### 1. Invalidate Server Runtime Cache On Ribbon Removal

Use the existing helper in:

```text
fusion-studio-server/lib/workspace/state-cache.js
```

It already exports:

```js
invalidate(workspaceId)
```

Call this when `workspace:ribbon_removed` is emitted or immediately before it is emitted.

Preferred minimal placement:

- Import `state-cache` in `fusion-studio-server/lib/workspace/workspace-controller.js`.
- In `handleRibbonRemoveRequested`, after `registry.updateRibbonVisibility(workspaceId, false)` and before emitting `workspace:ribbon_removed`, call `stateCache.invalidate(workspaceId)`.
- Preserve current event ordering.

Current ordering must remain:

- Non-active removal: `workspace:registry_changed`, then cache invalidation, then `workspace:ribbon_removed`.
- Active removal: `workspace:registry_changed`, then `workspace:switched`, then cache invalidation, then `workspace:ribbon_removed`.

Rationale:

- During active removal, the switch path may push the old active workspace to server runtime cache.
- The invalidation must happen after that possible cache push is allowed by the current event sequence, or the stale runtime cache can survive.
- Current broadcaster behavior already queues `workspace:ribbon_removed` behind async `workspace:switched`; keep that contract intact.

### 2. Optional Server Unit Test

If existing server tests make this cheap, add or update a targeted test proving that ribbon removal invalidates `workspace-cache.json` for that workspace.

Do not add a large new test harness if this requires broad refactoring.

## Client Requirements

### 1. Replace Focus Reset With Cache Eviction For Ribbon Removed

Current client behavior handles:

```ts
case 'workspace:ribbon_removed':
  usePanelStore.getState().resetWorkspaceFocusState(msg.workspaceId);
```

Change this paradigm to evict runtime cache instead.

Add a helper in `fusion-studio-client/src/state/panelStore.ts`, for example:

```ts
evictWorkspaceRuntimeState(workspaceId: string): void
```

Expected behavior:

- Remove `workspaceState[workspaceId]`.
- If the evicted workspace is not active, only update `workspaceState`.
- If the evicted workspace is still active due to an unexpected ordering edge case, reset live panel/runtime state to an empty workspace state without writing it back under that workspace id.
- Do not send `workspace:cache_push` from this helper. This is eviction, not replacement.

Keep the existing `resetWorkspaceFocusState` only if other current code uses it. If it becomes unused, delete it and its private helpers rather than leaving dead code.

Update `fusion-studio-client/src/state/panelStoreTypes.ts` if needed.

### 2. Evict File Tree Cache Without Clearing Tabs

Add a helper in `fusion-studio-client/src/state/fileStore.ts`, for example:

```ts
evictWorkspaceTree(workspaceId: string): void
```

Expected behavior:

- Remove `workspaceTrees[workspaceId]`.
- Do not modify `tabs`.
- Do not modify `activeTabPath`.
- Do not close the file viewer.
- If the evicted workspace is still active due to an unexpected ordering edge case, reset only current tree state to empty values and keep global tabs intact.

### 3. Use Eviction Helpers In Workspace Handler

In `fusion-studio-client/src/lib/ws/workspace-handlers.ts`, update `workspace:ribbon_removed` handling:

```ts
case 'workspace:ribbon_removed':
  if (msg.workspaceId) {
    usePanelStore.getState().evictWorkspaceRuntimeState(msg.workspaceId);
    useFileStore.getState().evictWorkspaceTree(msg.workspaceId);
  }
  return true;
```

Do not clear `fileDataStore` here unless there is a concrete active-workspace stale-data issue. The switch path already clears it on `workspace:switched`.

## Acceptance Criteria

- Switching workspaces still caches the old workspace for fast return.
- Removing a non-active workspace from the ribbon removes its client `workspaceState` entry.
- Removing an active workspace from the ribbon does not preserve a runtime cache entry for the removed workspace after the switch completes.
- Server `workspace-cache.json` no longer contains the removed workspace id after ribbon removal.
- Adding the workspace back works and reloads through normal discovery/hydration.
- Durable workspace state files are untouched.
- File explorer tabs remain untouched.
- No 24-hour grace-period timer/storage is added.
- No workspace unregister/delete behavior is introduced.

## Suggested Manual Smoke

Use Electron if possible:

1. Open workspace A.
2. Switch to workspace B.
3. Switch back to workspace A and confirm normal fast-return behavior still works.
4. Remove workspace A from the ribbon.
5. Confirm A disappears from ribbon and app switches away or shows zero-ribbon splash.
6. Inspect `fusion-studio-server/data/workspace-cache.json` and confirm A is absent.
7. Add A back through ribbon plus dropdown or Electron Workspaces menu.
8. Confirm A loads through normal discovery and remains registered.
9. Confirm file tabs were not closed by the ribbon removal path.

## Verification

Run targeted syntax/checks:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check -- fusion-studio-client/src/state/panelStore.ts fusion-studio-client/src/state/panelStoreTypes.ts fusion-studio-client/src/state/fileStore.ts fusion-studio-client/src/lib/ws/workspace-handlers.ts fusion-studio-server/lib/workspace/workspace-controller.js fusion-studio-server/lib/workspace/state-cache.js
```

Client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Server syntax:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node --check lib/workspace/workspace-controller.js
node --check lib/workspace/state-cache.js
```

If you touched tests or server request/broadcast routing, run the narrowest relevant tests. A previously useful targeted command was:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/thread/thread-messages.test.js
```

Known caveat:

- Full repo `git diff --check` may report pre-existing trailing whitespace in `fusion-studio-server/lib/transcription/index.js`. Prefer targeted checks for files touched by this handoff.

## Report Back

When complete, report:

- Files changed.
- Whether server cache invalidation happens after any active-workspace switch/save path.
- Whether client panel runtime cache is deleted, not reset-and-pushed.
- Whether file tree cache is deleted without clearing tabs.
- Verification commands and results.
- Any manual Electron smoke performed or skipped.
