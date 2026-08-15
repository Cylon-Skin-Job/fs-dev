# Chunk C — Custom Protocol: `fusion-studio://`

**Phase:** 2.3 (partial — protocol only; iframe mounting is Chunk D)
**Depends on:** Chunk K (complete), Chunk B (complete)
**Spec written:** 2026-05-22
**Status:** Ready for handoff

← [ROADMAP-REVISED.md](../ROADMAP-REVISED.md)

---

## Goal

Register `fusion-studio://` as a privileged Electron protocol so iframes can load
view files from the active workspace. The URL structure is:

```
fusion-studio://{viewId}/{relative/path/to/file}
```

Example: `fusion-studio://wiki-viewer/index.html` resolves to
`{activeWorkspace}/ai/<machine>/Views/<wiki-view-folder>/index.html`.

The protocol handler runs in the Electron main process. It needs the active
workspace path — delivered via IPC from the renderer when workspace:init and
workspace:switched are received.

---

## New File: `electron/protocol-handler.cjs`

One job: register the `fusion-studio://` protocol and handle requests.

```js
const path = require('path');
const { protocol, net } = require('electron');
const { pathToFileURL } = require('url');

let activeWorkspacePath = null;

/**
 * Called by main.cjs IPC handler when the renderer signals a workspace change.
 * @param {string} repoPath - Absolute path to the workspace root.
 */
function setWorkspaceRoot(repoPath) {
  activeWorkspacePath = repoPath || null;
}

/**
 * Register scheme privileges. MUST be called before app is ready — call this
 * at the module level of main.cjs, before app.whenReady().
 */
function registerScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'fusion-studio',
    privileges: {
      standard: true,       // relative URLs within served HTML resolve correctly
      secure: true,         // treated as a secure origin (WebCrypto, etc.)
      supportFetchAPI: true, // iframes can fetch() back to localhost server
      corsEnabled: true,    // CORS requests from these iframes are allowed
    },
  }]);
}

/**
 * Register the request handler. Call inside app.whenReady().
 */
function registerHandler() {
  protocol.handle('fusion-studio', async (request) => {
    if (!activeWorkspacePath) {
      return new Response('No active workspace', { status: 503 });
    }

    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    const viewId = url.hostname;          // e.g. "wiki-viewer"
    const relPath = decodeURIComponent(url.pathname).replace(/^\//, '');

    if (!viewId) {
      return new Response('Missing view ID', { status: 400 });
    }

    const viewRoot = path.join(activeWorkspacePath, 'ai', 'views', viewId);
    const target = path.resolve(viewRoot, relPath || 'index.html');

    // Path traversal guard — target must stay inside viewRoot
    if (!target.startsWith(viewRoot + path.sep) && target !== viewRoot) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(target).toString());
  });
}

module.exports = { registerScheme, registerHandler, setWorkspaceRoot };
```

**Why `net.fetch` instead of `fs.readFile`:** `net.fetch` handles MIME types,
range requests, and `file://` semantics automatically. It's the Electron 20+
canonical pattern for `protocol.handle`.

---

## Changes to `electron/main.cjs`

### Step 1 — Add scheme registration before app is ready

At the top of `main.cjs`, after the existing `require` lines, add:

```js
const { registerScheme, registerHandler, setWorkspaceRoot } = require('./protocol-handler.cjs');

// MUST be called before app is ready — registers scheme privileges
registerScheme();
```

### Step 2 — Add IPC handler and register protocol in `app.whenReady()`

In `app.whenReady().then(async () => { ... })`, after the server spawn and
before `createWindow(port)`:

```js
// Register protocol request handler (scheme was registered before ready)
registerHandler();

// Keep protocol handler's workspace root in sync with renderer workspace changes
ipcMain.on('workspace:set-root', (_, repoPath) => setWorkspaceRoot(repoPath));
```

Full `app.whenReady()` block after changes:

```js
app.whenReady().then(async () => {
  // 1. Spawn server
  const { port, process: proc } = await spawnServer({ onExit: handleServerExit });
  serverProcess = proc;
  writePort(port);

  // 2. Register protocol handler
  registerHandler();
  ipcMain.on('workspace:set-root', (_, repoPath) => setWorkspaceRoot(repoPath));

  // 3. Register IPC handlers (unchanged)
  const documentHandlers = registerDocumentHandlers(ipcMain, { exportController });
  exportController.register('document', createDocumentSubmodule({ getPandocPath: documentHandlers.getPandocPath }));
  exportController.register('html-artifact', htmlArtifactSubmodule);
  exportController.register('spreadsheet', spreadsheetSubmodule);

  // 4. Create window
  createWindow(port);
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  });
});
```

---

## Changes to `electron/preload.cjs`

Add `setWorkspaceRoot` to the exposed API:

```js
// Before:
contextBridge.exposeInMainWorld('electronAPI', {
  capturePage: () => ipcRenderer.invoke('capture-page'),
  captureRect: (rect) => ipcRenderer.invoke('capture-rect', rect),
  exportDocument: (payload) => ipcRenderer.invoke('export-document', payload),
  sendDocumentEmail: (payload) => ipcRenderer.invoke('send-document-email', payload),
  printDocument: (payload) => ipcRenderer.invoke('print-document', payload),
  onMenuAction: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('menu-action', listener);
    return () => ipcRenderer.removeListener('menu-action', listener);
  },
});

// After — add one entry:
contextBridge.exposeInMainWorld('electronAPI', {
  capturePage: () => ipcRenderer.invoke('capture-page'),
  captureRect: (rect) => ipcRenderer.invoke('capture-rect', rect),
  exportDocument: (payload) => ipcRenderer.invoke('export-document', payload),
  sendDocumentEmail: (payload) => ipcRenderer.invoke('send-document-email', payload),
  printDocument: (payload) => ipcRenderer.invoke('print-document', payload),
  onMenuAction: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('menu-action', listener);
    return () => ipcRenderer.removeListener('menu-action', listener);
  },
  setWorkspaceRoot: (repoPath) => ipcRenderer.send('workspace:set-root', repoPath),
});
```

---

## Changes to `src/types/electron.d.ts`

Add the new method to the `ElectronAPI` interface:

```ts
export interface ElectronAPI {
  // ... existing methods unchanged ...
  setWorkspaceRoot: (repoPath: string) => void;
}
```

---

## Changes to `fusion-studio-server/server.js` — add `activeRepoPath` to workspace:init

The client needs the active workspace path at `workspace:init` time, before
`panel_config` arrives. Add `activeRepoPath` to the message:

```js
// Find the active workspace's repo_path and include it in the init message
const activeWs = workspaceController.getActiveWorkspaceSync();
const msg = {
  type: 'workspace:init',
  workspaces,
  activeWorkspaceId,
  activeRepoPath: activeWs ? activeWs.repo_path : null,   // ← add this line
  workspaceType: activeWs ? activeWs.type : 'code',
  homePath: require('os').homedir(),
  cliConfig,
  themes,
  activeThemeId,
  styles,
  cachedStates,
};
```

---

## Changes to `src/lib/ws/workspace-handlers.ts`

Call `setWorkspaceRoot` in both workspace message types that carry a repo path.

### In `workspace:init` handler

After `store.markInit()`, add:

```ts
// Keep Electron protocol handler's workspace root in sync
const activeWs = workspaces.find((w: any) => w.id === activeWorkspaceId);
const activeRepoPath = (msg as any).activeRepoPath ?? activeWs?.repo_path ?? null;
if (activeRepoPath) {
  window.electronAPI?.setWorkspaceRoot(activeRepoPath);
}
```

### In `workspace:switched` handler

After `store.closeSwitcher()`, add:

```ts
// Keep Electron protocol handler's workspace root in sync
if (msg.repoPath) {
  window.electronAPI?.setWorkspaceRoot(msg.repoPath);
}
```

The `window.electronAPI?.` optional chain is intentional — the app runs in a
browser context during development (no preload), so this call is a no-op there.

---

## Migration Order

1. `electron/protocol-handler.cjs` — new file
2. `electron/main.cjs` — add `registerScheme()` call at module level, add `registerHandler()` + IPC in `whenReady`
3. `electron/preload.cjs` — add `setWorkspaceRoot` entry
4. `src/types/electron.d.ts` — add type
5. `fusion-studio-server/server.js` — add `activeRepoPath` to workspace:init message
6. `src/lib/ws/workspace-handlers.ts` — call `setWorkspaceRoot` in both handlers
7. Rebuild client: `npm run build`
8. Relaunch Electron

---

## Smoke Tests

- [ ] App launches without errors — `registerScheme()` before app ready, no "scheme already registered" errors
- [ ] `fusion-studio://wiki-viewer/index.html` served: open DevTools in Electron → Console → `fetch('fusion-studio://wiki-viewer/index.html').then(r => r.text()).then(console.log)` → prints HTML (or 404 if no index.html exists yet — that's fine)
- [ ] `fusion-studio://wiki-viewer/../../../etc/passwd` → 403 (path traversal blocked)
- [ ] Workspace switch → `setWorkspaceRoot` IPC fires → subsequent protocol requests use new path (verify via DevTools fetch after switch)
- [ ] Protocol handler returns 503 before first workspace:init (early request with no workspace set)
- [ ] Protocol handler is a no-op in browser dev mode (no `window.electronAPI`) — app doesn't crash

---

## What NOT to Change

- `ContentArea.tsx` — iframe mounting is Chunk D
- The existing IPC handler registrations in `main.cjs` — only add, don't reorder
- Any view file contents — this chunk only makes the protocol available; no views use it yet
- `webPreferences` in `createWindow` — no changes needed; Electron automatically allows
  registered privileged schemes in iframes within the window
