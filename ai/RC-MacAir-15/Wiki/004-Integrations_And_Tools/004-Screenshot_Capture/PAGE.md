---
name: Screenshot Capture
description: Direct app captures, exact chat attachments, saved-image gallery, workspace previews, and storage limits.
metadata:
  source-files:
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-client/src/lib/chat/side-chat-placements.ts
    - fusion-studio-client/src/state/slices/chatSurfaceSlice.ts
    - fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx
    - fusion-studio-client/src/components/chat/ChatSurface.tsx
    - fusion-studio-client/src/components/chat/ConnectedChatComposer.tsx
    - fusion-studio-client/src/components/chat/ChatComposerAddMenu.tsx
    - fusion-studio-client/src/components/App.tsx
    - fusion-studio-server/lib/screenshot/ws-handlers.js
    - fusion-studio-client/electron/ipc/capture-handlers.cjs
    - fusion-studio-client/electron/ipc/screenshot-handlers.cjs
    - fusion-studio-client/src/screenshots/chatScreenshotCapture.ts
    - fusion-studio-client/src/screenshots/ScreenshotsTrigger.tsx
    - fusion-studio-client/src/hooks/useScreenshotCapture.ts
    - fusion-studio-server/lib/workspace/screenshot-service.js
    - fusion-studio-client/src/lib/chat-action-controller.ts
    - fusion-studio-client/src/lib/chat-action.ts
    - fusion-studio-client/src/lib/chat-material-target.ts
    - fusion-studio-client/src/lib/chat-material-commit.ts
    - fusion-studio-client/src/state/slices/mountedChatState.ts
    - fusion-studio-client/src/components/chat/useMountedChatBinding.ts
    - fusion-studio-client/src/state/chatSubmissionStore.ts
  last-modified: "2026-10-09T01:12:37Z"
---

## In-app captures and attachments

In the desktop app, **Take screenshot** captures the focused Fusion Studio window through Electron/preload. The screenshot source begins through the shared Chat material owner before native work, capturing the source workspace and socket. It sends the existing `screenshot:file-capture` request with a unique request ID. The server validates the active workspace and protected target path, then saves a PNG under its `ai/<machine>/Data/Screenshots/`. Each save uses a timestamp plus a server-generated UUID in its filename and exclusive file creation: same-time captures retain separate paths, and an existing path causes a correlated `screenshot:error` without overwriting its bytes. Only the correlated `screenshot:file-captured` response provides the original saved absolute path; the attachment retains `Data/Screenshots/<basename>` metadata.

The global header camera uses the same last-active open mounted Main/Side destination as global resource insertion. Main row selection and Side tab selection cannot override actual composer activity; there is no Main/Legacy fallback. The composer Add menu uses its own committed workspace, view, group, session, surface generation and, for Side, exact open placement. Explicit Main components and Side Chat keep their own session independently of unrelated Main selection.

The source revalidates shared ownership after native capture before save and the common action consumer revalidates synchronously at insertion after save. Unrelated view/focus changes preserve a retained binding. Actual rebind, unmount/close, lost workspace/session/hydration authority or placement replacement cancels permanently, including after equal-string return. Before-save cancellation sends zero save requests. After-save cancellation can leave its source gallery PNG; it adds no attachment and makes no rollback/deletion claim.

The source retains its 30-second save deadline and removes the request's message listener, close listener and timer on every terminal result, including save rejection, send throw, disconnect and timeout. Foreign/out-of-order/duplicate responses cannot cross-write or insert twice. Missing/empty/failed native capture, unavailable target, pending acceptance or invalid prepared material leaves drafts and attachments unchanged with bounded feedback. The screenshot source owns preparation and correlation; only the shared Chat action consumer writes the existing exact-session attachment store. Successful local insertion retains eligible best-effort warming of that captured session, separate from ordinary Send and durable acceptance.

The Screenshots gallery lists image files from the workspace folder and can attach an existing one. Workspace preview images are separate: they capture the app panel on workspace changes and are stored as one PNG row per workspace in SQLite for the ribbon and carousel.

## macOS screenshots

Automatic import from the macOS screenshot folder and source-folder refresh are retired. Taking a screenshot with Fusion Studio remains available through the direct in-app capture path described above. Existing files already saved in a workspace's `ai/<machine>/Data/Screenshots/` remain available to the gallery and can be attached manually. No source-folder monitor is running.

## Optional source location and CLI route

Changing the macOS screenshot destination does not configure Fusion Studio imports. No refresh command or restart will bind an automatic source-folder watcher. A CLI working in this repository may separately use `ai/screenshots/desktop` as a symlink to a macOS source folder after checking that no path would be replaced.

A symlink only exposes its target to processes with appropriate permissions. It is not inherently read-only, does not feed the app gallery and does not route captures to a workspace.

## Storage and privacy

Git ignore rules for the repository's screenshot and machine-scoped data folders affect ordinary tracking, not other access or sharing paths. Saved screenshots and previews can contain sensitive content. Review an image before attaching it to an AI chat or sharing a workspace. The gallery limits its display to 20 items, not storage to 20 files; deleting a saved image can break a chat attachment that refers to it. [Setup](../../006-Operations/001-Setup/PAGE.md) treats source-location changes as optional.
