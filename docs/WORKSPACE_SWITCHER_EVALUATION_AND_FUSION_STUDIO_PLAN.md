# Workspace Switcher Evaluation & Fusion Studio Transition Plan

> **Session context document** — Created 2026-05-08 after evaluating the workspace switcher bug and designing the Fusion Home architecture. Read this before continuing work.

---

## 1. The Bug: Why the Workspace Switcher "Wasn't Working"

### Symptom
Switching to the `karens-lab` workspace caused the UI to hang indefinitely on **"Discovering panels..."**.

### Root Cause
`karens-lab` was added as a workspace but never had valid panel configurations. Its `ai/views/` folder contained:
- `index.json` referencing `code-viewer` (stale ID from before the rename to `file-viewer`)
- A `chat/` folder with **no `index.json`**
- No actual view directories (`file-viewer/`, `doc-viewer/`, etc.)

When the client switched workspaces, `workspace-handlers.ts` called `rediscoverPanels()`, which:
1. Set `panelConfigs = []` (UI shows "Discovering panels...")
2. Sent `file_tree_request` for `__panels__`
3. Found only the `chat` folder
4. Tried to load `chat/index.json` — **ENOENT**
5. `loadAllPanels` returned `[]`
6. `configs.length === 0` remained true forever

**The switcher UI itself was fine.** The server switched workspaces correctly. The client just had no valid panels to render after the switch.

### Critical Downstream Risk
`last_active_workspace_id` in the DB was set to `karens-lab`. If the server restarted, **all new connections would hang** because the server restores the active workspace at boot.

### Fix Applied (2026-05-08)
- Set `last_active_workspace_id` back to `open-robin` in the DB
- Added `fusion-home` to the workspace registry
- Fixed missing TypeScript types (`clipboard:use`, `clipboard:delete`, `clipboard:state`, `clipboard:error`) in `src/types/index.ts` that were blocking the client build
- Restarted the server via `restart-kimi.sh`

---

## 2. Workspace Switch Architecture (Full Pipeline)

No single module owns switching. It's a cross-cutting pipeline across client and server.

### Client Side

| Step | Module | Role |
|------|--------|------|
| 1 | `WorkspaceSwitcher.tsx` | UI drawer. Calls `requestSwitch(workspaceId)` on row click. |
| 2 | `workspaceStore.ts` | Sends `{ type: 'workspace:switch_requested', workspaceId }` over WS. |
| 3 | `ws-client.ts` | Receives incoming WS messages, routes to `handleWorkspaceMessage()`. |
| 4 | `workspace-handlers.ts` | Handles `workspace:switched`: updates active ID, closes switcher, resets file store, resets shared styles, closes secondary chat, then calls `rediscoverPanels(ws).then(() => loadRootTree())`. |
| 5 | `panels.ts` | `rediscoverPanels()` clears configs, discovers panels via WS, loads each config. If result is `[]`, UI hangs. |
| 6 | `App.tsx` | Gates rendering on `configs.length === 0` (loading branch) vs. normal branch. |

### Server Side

| Step | Module | Role |
|------|--------|------|
| 1 | `client-message-router.js` | Receives `workspace:switch_requested`. Validates `workspaceId` is a string. Emits to event bus: `emit('workspace:switch_requested', { workspaceId, connectionId })`. |
| 2 | `workspace-controller.js` | Subscribed to bus. `handleSwitchRequested()`: looks up workspace in DB, guards against switching to already-active, updates module-level `activeWorkspaceId` and `activeWorkspace` cache, writes `last_active_workspace_id` to DB, emits `workspace:switched`. |
| 3 | `workspace-broadcaster.js` | Listens for `workspace:switched`. Broadcasts it to **all connected clients** via `broadcastAll()`. |
| 4 | `server.js` | Per-connection listener on `workspace:switched`: updates `session.projectRoot = event.repoPath` so subsequent file/thread operations resolve against the new root. |

### Key Design Notes
- **Single shared active workspace**: All browser tabs share one server-wide active workspace. Switching in one tab force-switches all others. This is documented as "sufficient for today's single-tab reality" in `workspace-controller.js`.
- **Module-level cache**: `activeWorkspaceId` and `activeWorkspace` are cached in `workspace-controller.js` so `getProjectRoot()` can resolve synchronously without async DB hops.
- **Silent message drops**: `workspaceStore.ts` `sendWorkspaceMessage()` silently drops messages if the WebSocket is not `WebSocket.OPEN`. No retry, no error.

---

## 3. What Was Built Today: Fusion-Home

Created `~/Projects/Fusion-Home/` as a scaffolded workspace that can be switched to and used immediately.

### Structure

```
~/Projects/Fusion-Home/
├── ai/
│   ├── settings/
│   │   ├── cli.json
│   │   ├── components.css
│   │   ├── doc-viewer.css
│   │   ├── file-viewer.css
│   │   ├── state.json
│   │   ├── themes.css
│   │   ├── themes.json
│   │   ├── tints.css
│   │   ├── variables.css
│   │   └── views.css
│   └── views/
│       ├── index.json              # lists all 5 views
│       ├── chat/threads/           # global chat storage
│       ├── file-viewer/
│       │   ├── index.json
│       │   ├── content.json
│       │   ├── api.json
│       │   ├── chat/
│       │   └── settings/
│       │       ├── layout.json
│       │       └── layout.css
│       ├── doc-viewer/
│       │   ├── index.json
│       │   ├── content.json
│       │   ├── chat/
│       │   ├── content/
│       │   └── settings/
│       │       ├── layout.json
│       │       └── layout.css
│       ├── issues-viewer/
│       │   ├── index.json
│       │   ├── content.json
│       │   ├── chat/
│       │   ├── content/
│       │   └── settings/
│       │       ├── layout.json
│       │       ├── layout.css
│       │       └── state.json
│       ├── wiki-viewer/
│       │   ├── index.json
│       │   ├── content.json
│       │   ├── api.json
│       │   ├── chat/
│       │   ├── content/
│       │   └── settings/
│       │       ├── layout.json
│       │       ├── layout.css
│       │       ├── state.json
│       │       └── themes.css
│       └── agents-viewer/
│           ├── index.json
│           ├── content.json
│           ├── registry.json
│           ├── chat/
│           ├── content/
│           └── settings/
│               ├── layout.json
│               ├── layout.css
│               ├── state.json
│               └── agents.json
```

### What Was NOT Copied (Project-Specific Content)
- Thread files (`chat/threads/*.md`)
- Open Robin wiki topics (`wiki-viewer/content/project/`, `system-tools/`, etc.)
- Open Robin tickets (`issues-viewer/KIMI-*.md`)
- Open Robin specs (`doc-viewer/content/specs/`)
- Open Robin agent background workers (`agents-viewer/Background Workers/`)
- Runtime state files (`threads.json`, `history.json`, etc.)

### Verification
A Node.js WebSocket test script connected to the running server, switched to `fusion-home`, and successfully discovered all 6 panels (`agents-viewer`, `chat`, `doc-viewer`, `file-viewer`, `issues-viewer`, `wiki-viewer`).

---

## 4. Long-Term Vision: Fusion Studio

### Rebrand
- **Open Robin** → **Fusion Studio**
- Fusion Studio is the product name, not an AI agent name. Users can name their AI whatever they want.
- All references to "Robin" in code, CSS classes, docs, and prompts will eventually be refactored.

### Fusion-Home (The Hub Workspace)
- Lives at `~/Projects/Fusion-Home/`
- Is the **default workspace** when a user downloads the app
- Contains the standard `ai/views/` structure PLUS app-specific views for local AppleScript automations (Calendar, Email, etc.)
- Outside `ai/`, contains folders for: docs, sample scripts, agent workflows, web scrapers, OCR, email automations, calendar automations, code automations, code enforcement agents
- The **wiki** describes the entire app, its features, and abilities — and links to filesystem folders (doesn't duplicate content)
- The **file viewer** browses markdown files (not just code)
- Serves as the **template source** for new workspaces

### New Workspace Onboarding Flow
When a user adds a new project/repo/folder:
1. Folder picker selects the path
2. Dialog shows checkboxes for which views to scaffold
3. **Minimum**: Tickets (`issues-viewer`), Wiki (`wiki-viewer`), File Viewer (`file-viewer`)
4. **Optional**: Agent Viewer (`agents-viewer`), Dock Viewer, Browser, Terminal View
5. Selected views are copied from the template source into the new workspace's `ai/views/`
6. Future views can be added to the list unchecked

---

## 5. Template System Design Decision (Open)

There are two ways to store view templates:

### Option A: Fusion-Home IS the template
`bootstrap-service.js` copies views directly from `~/Projects/Fusion-Home/ai/views/{viewId}/` into the new workspace.

- **Pro**: Single source of truth. Update Fusion Home → all new workspaces get the latest.
- **Con**: If Fusion Home's views accumulate project-specific content (e.g., AppleScript docs in `file-viewer/content/`), those get copied into every new repo.

### Option B: Dedicated `templates/` folder
`open-robin-server/templates/workspace-views/` contains stripped-down "factory fresh" versions of each view.

- **Pro**: Clean separation. Fusion Home can have rich content without polluting new workspaces.
- **Con**: Two copies to maintain.

**Current leaning**: Option B is safer because Fusion Home is meant to be a living hub workspace with its own wiki and documentation, not a sterile factory template.

---

## 6. Module That Needs Changing for Templates

`bootstrap-service.js` (`open-robin-server/lib/workspace/bootstrap-service.js`) is the module responsible for scaffolding a new workspace's `ai/` tree.

**Current behavior:**
```js
const DIRS = [
  'ai',
  'ai/views',
  'ai/views/chat',
  'ai/views/chat/threads',
];
const FILES = {
  'ai/views/index.json': JSON.stringify({ views: [{ id: 'file-viewer', ... }] }),
};
```

**Future behavior:**
```js
function bootstrap(repoPath, selectedViews = ['file-viewer', 'issues-viewer', 'wiki-viewer']) {
  // 1. Create ai/views/chat/threads (global chat)
  // 2. For each selected view, copy template from templates/workspace-views/{viewId}/
  // 3. Write ai/views/index.json with the selected views
}
```

---

## 7. Current System State (Post-Restart)

- **Server**: Running on `http://localhost:3001` (PID tracked in `/tmp/open-robin.pid`)
- **Restart script**: `~/Projects/open-robin/restart-kimi.sh`
  - Kills old server by PID file + port
  - Runs `npm run build` in `open-robin-client`
  - Starts server with `nohup`
  - Verifies health via curl
- **Active workspace**: `fusion-home`
- **Registry**: `open-robin`, `karens-lab`, `fusion-home`
- **Broken workspace**: `karens-lab` still has no valid panels. Switching to it will still hang.

---

## 8. Open Questions / Next Steps

1. **Fix or remove `karens-lab`**? It's still in the registry and will hang if switched to.
2. **Choose template strategy**: Option A (Fusion Home as template) or Option B (dedicated `templates/` folder)?
3. **Build the view-picker UI**: Replace the simple folder picker with a two-step dialog (pick folder → select views).
4. **Rebrand scope**: Incremental refactor of `open-robin/` strings, or new `fusion-studio/` codebase?
5. **New view types**: Dock Viewer, Browser, Terminal View — are these net-new view types or renames of existing ones?
6. **Empty-panel fallback**: Should `App.tsx` show "No views found" instead of "Discovering panels..." when `configs.length === 0`?

---

## 9. Key File Paths

| File | Path |
|------|------|
| Restart script | `~/Projects/open-robin/restart-kimi.sh` |
| Server entry | `~/Projects/open-robin/open-robin-server/server.js` |
| Workspace controller | `~/Projects/open-robin/open-robin-server/lib/workspace/workspace-controller.js` |
| Bootstrap service | `~/Projects/open-robin/open-robin-server/lib/workspace/bootstrap-service.js` |
| Workspace broadcaster | `~/Projects/open-robin/open-robin-server/lib/ws/workspace-broadcaster.js` |
| Client message router | `~/Projects/open-robin/open-robin-server/lib/ws/client-message-router.js` |
| Client workspace handlers | `~/Projects/open-robin/open-robin-client/src/lib/ws/workspace-handlers.ts` |
| Workspace store | `~/Projects/open-robin/open-robin-client/src/state/workspaceStore.ts` |
| Panel discovery | `~/Projects/open-robin/open-robin-client/src/lib/panels.ts` |
| App root | `~/Projects/open-robin/open-robin-client/src/components/App.tsx` |
| Switcher UI | `~/Projects/open-robin/open-robin-client/src/components/WorkspaceSwitcher.tsx` |
| DB | `~/Projects/open-robin/open-robin-server/data/robin.db` |
| Fusion Home | `~/Projects/Fusion-Home/` |
| This document | `~/Projects/open-robin/docs/WORKSPACE_SWITCHER_EVALUATION_AND_FUSION_STUDIO_PLAN.md` |
