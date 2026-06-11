# Worker Handoff: RCC-0076 Follow-Up - Screenshot Render Transition

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

## Current Worktree Note

At handoff creation time, the worktree already contained approved RCC-0076 docs and runtime-cache eviction changes, plus `fusion-studio-server/data/workspace-cache.json` modified by live smoke testing.

Do not revert or normalize unrelated dirty files. Avoid editing runtime cache data unless this task explicitly requires a manual smoke check.

## Required Reading

Read these before working:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/issues-viewer/inbox/RCC-0076.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-implementation-report.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-09-rcc-0076-ribbon-removal-runtime-cache-eviction.md
```

Focus ticket section:

- `RCC-0076.md`, “Bug Fix: Screenshot -> Render Transition”.

## Problem

Original RCC-0076 reports a workspace-switch transition bug:

- A screenshot is shown during workspace switching, then the live workspace render replaces it.
- The screenshot can appear with different sizing than the live render.
- The screenshot can appear darker than the live render.

This slice should investigate and fix the transition path without changing ribbon membership semantics.

## Current Architecture Facts

Likely relevant client files:

```text
fusion-studio-client/src/hooks/useScreenshotCapture.ts
fusion-studio-client/electron/ipc/capture-handlers.cjs
fusion-studio-client/src/lib/ws/screenshot-handlers.ts
fusion-studio-client/src/state/screenshotStore.ts
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/components/WorkspaceCarousel.tsx
fusion-studio-client/src/components/App.tsx
fusion-studio-client/src/components/App.css
```

Likely relevant server files:

```text
fusion-studio-server/lib/screenshot/ws-handlers.js
fusion-studio-server/lib/screenshot/router.js
fusion-studio-server/lib/workspace/screenshot-service.js
fusion-studio-server/lib/db/migrations/020_workspace_screenshots.js
```

Current capture path:

- `useScreenshotCapture()` watches the active workspace and ribbon open state.
- It captures `.rv-panel.active` using `window.electronAPI.captureRect(...)`.
- Electron handles `capture-rect` with `win.webContents.capturePage(rect)` and returns PNG base64.
- The renderer sends `screenshot:capture` over WebSocket.
- The server stores PNG blobs in `workspace_screenshots`.
- Ribbon and carousel display screenshot data URLs from `screenshotStore`.

Important observed detail:

- `captureRect` currently receives rounded CSS-pixel `getBoundingClientRect()` values.
- Electron `capturePage(rect)` behavior may involve device scale factor / DIP versus physical pixel ambiguity.
- The reported sizing mismatch may come from capturing at one coordinate/scale and rendering into another aspect ratio.
- The reported darkness mismatch may come from overlay styling, image opacity, backdrop filters, or native image color conversion.

## Goal

Determine whether the bug is caused by capture geometry/color or by how screenshots are displayed during workspace switching, then make the smallest correct fix.

Prefer preserving the existing screenshot thumbnail system unless investigation shows it is the root cause.

## Non-Goals

- Do not change ribbon add/remove/cache-eviction behavior.
- Do not reintroduce the deleted `WorkspaceSwitcher` drawer.
- Do not add a new global transition framework unless a minimal local fix cannot work.
- Do not modify durable workspace state files.
- Do not hand-edit `fusion.db`.
- Do not treat `System Source Files` as active app code.

## Investigation Steps

1. Reproduce in Electron.
2. Identify where the screenshot appears during workspace switching.
3. Confirm whether the screenshot shown during transition is the same data used by ribbon/carousel thumbnails.
4. Compare captured rect dimensions to live `.rv-panel.active` dimensions.
5. Check whether CSS displays screenshots with opacity, filters, background blending, object-fit, or forced aspect ratio.
6. Check whether `capturePage(rect)` needs explicit device scale factor handling.
7. Decide the minimal fix from the evidence.

Useful temporary instrumentation, remove before final report:

```ts
console.log('[screenshot-capture]', {
  workspaceId,
  rect: el.getBoundingClientRect(),
  dpr: window.devicePixelRatio,
});
```

If inspecting Electron capture behavior, include the rect passed to IPC and the returned image dimensions if practical.

## Preferred Fix Order

Try these in order and stop at the smallest fix that resolves the issue:

1. Fix display sizing if screenshots are rendered with the wrong aspect ratio.
2. Fix capture rect math if Electron is receiving coordinates in the wrong coordinate space.
3. Remove or simplify the switch-time screenshot transition if it is inherently unreliable.
4. Replace switch-time screenshot with a neutral placeholder/fade, while preserving ribbon thumbnails.

## Acceptance Criteria

- Workspace switching no longer shows a visibly darker screenshot before live render.
- Workspace switching no longer jumps due to screenshot/live render dimension mismatch.
- Ribbon thumbnails still render.
- Workspace carousel still renders or is intentionally adjusted with documented rationale.
- Screenshot capture still works after switching workspaces.
- No regression to zero-ribbon splash or runtime cache eviction behavior.

## Suggested Manual Smoke

Run Electron and test:

1. Open workspace A and wait for it to render.
2. Switch to workspace B.
3. Switch back to workspace A.
4. Watch for screenshot darkness during transition.
5. Watch for layout jump when live render replaces the screenshot.
6. Open the ribbon and confirm thumbnails still appear.
7. Remove and add back a workspace to confirm the prior cache-eviction slice still behaves.

## Verification

Run targeted checks for touched files.

Client build if client code changes:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Electron syntax if Electron files change:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
node --check electron/ipc/capture-handlers.cjs
```

Server syntax if server screenshot files change:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node --check lib/screenshot/ws-handlers.js
node --check lib/screenshot/router.js
node --check lib/workspace/screenshot-service.js
```

Whitespace check for touched files:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check -- <touched-files>
```

Known caveat:

- Full repo `git diff --check` may report pre-existing trailing whitespace in `fusion-studio-server/lib/transcription/index.js`. Prefer targeted checks for files touched by this handoff.

## Report Back

When complete, report:

- Root cause found.
- Files changed.
- Whether the fix was capture geometry, display CSS, transition removal, or placeholder replacement.
- Whether ribbon thumbnails still work.
- Whether workspace carousel still works.
- Verification commands and results.
- Manual Electron smoke result.
