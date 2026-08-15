# Chunk K — Managed Server Spawn + Port Negotiation

**Phase:** 2 (prerequisite — must land before Chunk C custom protocol)
**Depends on:** nothing (independent of A/A2)
**Spec written:** 2026-05-21
**Status:** Ready for handoff

← [ROADMAP-REVISED.md](../ROADMAP-REVISED.md)

---

## Goal

`main.cjs` spawns and manages the Node server as a child process. Port conflicts
are impossible. The app is distributable without manual server startup. Users and
scripts can always find the active port via a known file.

---

## Current State

- `main.cjs` hardcodes `http://localhost:3001` and loads it directly — no spawn
- Server must be started manually (`node server.js`) before Electron launches
- `lib/startup.js` line 39: `const PORT = process.env.PORT || 3001;`
- `lib/startup.js` line 167: `server.listen(PORT, () => { ... })`
- No `SERVER_READY` signal exists

---

## New Files

### `electron/server-spawn.cjs`

One job: spawn the server process and resolve with the port it bound to.

```js
const { spawn } = require('child_process');
const path = require('path');

/**
 * Spawns fusion-studio-server/server.js as a child process.
 * Resolves with the port once the server emits SERVER_READY:{port} on stdout.
 * Rejects if the process exits before signalling ready.
 *
 * @param {object} opts
 * @param {Function} opts.onExit   — called when server process dies unexpectedly
 * @returns {Promise<{ port: number, process: ChildProcess }>}
 */
function spawnServer({ onExit }) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', '..', 'fusion-studio-server', 'server.js');

    const child = spawn(process.execPath, [serverPath], {
      env: { ...process.env, PORT: '0' },   // PORT=0 → OS assigns free port
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`[server] ${text}`);    // pipe to Electron console

      const match = text.match(/SERVER_READY:(\d+)/);
      if (match) resolve({ port: parseInt(match[1], 10), process: child });
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(`[server:err] ${chunk.toString()}`);
    });

    child.on('exit', (code) => {
      // If we already resolved, this is an unexpected crash
      onExit(code);
      reject(new Error(`Server exited with code ${code} before signalling ready`));
    });
  });
}

module.exports = { spawnServer };
```

**Reject guard:** once `resolve()` is called the Promise is settled — subsequent
`onExit` calls for crashes reach `onExit(code)` only, not `reject()`. The caller
handles post-ready crashes separately.

---

### `electron/port-file.cjs`

One job: write and clear the active port in App Support so user scripts can find it.

```js
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

function portFilePath() {
  return path.join(app.getPath('userData'), 'server.port');
}

function writePort(port) {
  try { fs.writeFileSync(portFilePath(), String(port), 'utf8'); } catch {}
}

function clearPort() {
  try { fs.unlinkSync(portFilePath()); } catch {}
}

module.exports = { writePort, clearPort };
```

`userData` resolves to `~/Library/Application Support/Fusion Studio/` on macOS.
The file contains a bare port number, e.g. `52341`. User scripts read it with:
```sh
PORT=$(cat ~/Library/Application\ Support/Fusion\ Studio/server.port)
curl http://localhost:$PORT/api/...
```

---

## Changes to Existing Files

### `lib/startup.js` — emit SERVER_READY signal

Change the `server.listen()` callback to emit the signal after binding. The OS
assigns the port when `PORT=0`; read it back from `server.address()`:

```js
// Replace:
const PORT = process.env.PORT || 3001;
// With:
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// In server.listen() callback, add after the existing console.log:
const boundPort = server.address().port;
process.stdout.write(`SERVER_READY:${boundPort}\n`);
```

`process.stdout.write` (not `console.log`) ensures the signal lands on stdout
cleanly without buffering quirks. `server.address().port` is the authoritative
port — what the OS actually bound, regardless of what was requested.

---

### `main.cjs` — orchestrate spawn before window creation

```js
const { spawnServer } = require('./server-spawn.cjs');
const { writePort, clearPort } = require('./port-file.cjs');
const { dialog } = require('electron');  // already imported? add if not

let serverProcess = null;

function handleServerExit(code) {
  // Called on unexpected crash after ready signal
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!win || win.isDestroyed()) return;

  dialog.showMessageBox(win, {
    type: 'info',
    title: 'Fusion Studio',
    message: 'Server crashed, restarting…',
    buttons: [],
    noLink: true,
  });

  clearPort();

  spawnServer({ onExit: handleServerExit })
    .then(({ port, process: proc }) => {
      serverProcess = proc;
      writePort(port);
      win.webContents.loadURL(`http://localhost:${port}`);
      // Close the dialog — Electron dialogs auto-close when parent navigates
    })
    .catch((err) => {
      logElectron('error', `Server respawn failed: ${err.message}`);
    });
}

// In app.whenReady().then():
app.whenReady().then(async () => {
  // 1. Spawn server — resolves when SERVER_READY received
  const { port, process: proc } = await spawnServer({ onExit: handleServerExit });
  serverProcess = proc;
  writePort(port);

  // 2. Register IPC handlers (unchanged)
  const documentHandlers = registerDocumentHandlers(ipcMain, { exportController });
  exportController.register('document', createDocumentSubmodule({ getPandocPath: documentHandlers.getPandocPath }));
  exportController.register('html-artifact', htmlArtifactSubmodule);
  exportController.register('spreadsheet', spreadsheetSubmodule);

  // 3. Create window — now uses dynamic port
  createWindow(port);
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  });
});

// Pass port into createWindow:
function createWindow(port) {
  // ... existing window setup ...
  const appUrl = `http://localhost:${port}`;
  wc.loadURL(appUrl);
}

// Clean up on quit:
app.on('window-all-closed', () => {
  clearPort();
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
```

**Make `app.whenReady().then()` async** — the `await spawnServer()` requires it.

---

## Smoke Tests

- [ ] App launches cold — server starts, window loads without manual `node server.js`
- [ ] `server.port` file exists in `~/Library/Application Support/Fusion Studio/` after launch, contains a valid port number
- [ ] `server.port` file is deleted after app quits
- [ ] Launch with something already on port 3001 — app still starts, uses a different port
- [ ] Kill the server process externally → dialog appears "Server crashed, restarting…" → server respawns → window reloads on new port
- [ ] `curl http://localhost:$(cat ~/Library/Application\ Support/Fusion\ Studio/server.port)/` → responds
- [ ] Second app launch blocked (single instance lock already exists) — no orphaned server process

---

## What NOT to Change

- `server.js` startup logic beyond the `SERVER_READY` signal — no other changes
- The IPC handler registration order in `main.cjs` — only `app.whenReady` becomes async and `createWindow` receives port
- `lib/startup.js` beyond the two-line port change — all other startup orchestration unchanged
