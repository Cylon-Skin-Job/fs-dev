const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const exportController = require('./export/export-controller.cjs');
const { createDocumentSubmodule } = require('./export/submodules/documents/index.cjs');
const htmlArtifactSubmodule = require('./export/submodules/html-artifacts/index.cjs');
const spreadsheetSubmodule = require('./export/submodules/spreadsheets/index.cjs');
const { registerCaptureHandlers } = require('./ipc/capture-handlers.cjs');
const { registerDocumentHandlers } = require('./ipc/document-handlers.cjs');
const { spawnServer } = require('./server-spawn.cjs');
const { writePort, clearPort } = require('./port-file.cjs');
const { registerScheme, registerHandler, setWorkspaceRoot } = require('./protocol-handler.cjs');

// MUST be called before app is ready — registers scheme privileges
registerScheme();

let mainWindow;
let serverProcess = null;

function cleanup() {
  clearPort();
  if (serverProcess) serverProcess.kill();
}

process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });

const RENDERER_LOG = path.join(os.tmpdir(), 'electron-renderer.log');
const ELECTRON_DIAG_LOG = path.join(os.tmpdir(), 'fusion-electron.log');
// Clear on each launch so the log stays fresh
try { fs.writeFileSync(RENDERER_LOG, `--- renderer log started ${new Date().toISOString()} ---\n`); } catch {}

function logElectron(level, message) {
  const entry = `[${new Date().toISOString()}] [Electron] ${message}\n`;
  if (level === 'error') {
    console.error(entry.trimEnd());
  } else {
    console.log(entry.trimEnd());
  }
  try { fs.appendFileSync(ELECTRON_DIAG_LOG, entry); } catch {}
}

/** Log navigation failures with Chromium net error codes (e.g. ERR_CONNECTION_REFUSED = -102). */
function attachNavigationDiagnostics(webContents) {
  webContents.on('did-start-loading', () => {
    logElectron('info', `did-start-loading url=${webContents.getURL()}`);
  });

  webContents.on('did-finish-load', () => {
    logElectron('info', `did-finish-load url=${webContents.getURL()}`);
  });

  webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    logElectron(
      'error',
      `did-fail-load code=${errorCode} (${errorDescription}) url=${validatedURL}`,
    );
  });

  webContents.on('did-fail-provisional-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    logElectron(
      'error',
      `did-fail-provisional-load code=${errorCode} (${errorDescription}) url=${validatedURL}`,
    );
  });
}

/** macOS: Chromium can show a blank/white layer after minimize until repainted. */
function nudgeRendererRepaint(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`
    (function () {
      document.body.style.opacity = '0.999';
      requestAnimationFrame(function () { document.body.style.opacity = ''; });
    })();
  `).catch(() => {});
}

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

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    show: false,
    // Match --bg-solid; default #fff shows through when the GPU layer is dropped.
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep WS/timers alive while minimized so restore doesn't look "dead".
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('restore', () => {
    logElectron('info', 'window restore');
    nudgeRendererRepaint(mainWindow);
  });
  mainWindow.on('show', () => {
    if (!mainWindow.isMinimized()) {
      logElectron('info', 'window show');
      nudgeRendererRepaint(mainWindow);
    }
  });
  mainWindow.on('minimize', () => {
    logElectron('info', 'window minimize');
  });

  const wc = mainWindow.webContents;
  attachNavigationDiagnostics(wc);

  wc.on('render-process-gone', (_event, details) => {
    logElectron('error', `render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
    if (mainWindow.isDestroyed()) return;
    if (details.reason !== 'clean-exit') {
      logElectron('info', 'render-process-gone → reloading webContents');
      wc.reload();
    }
  });

  // Pipe renderer console → log file so we can debug without opening DevTools
  wc.on('console-message', (_e, level, message, line, sourceId) => {
    const LEVELS = ['verbose', 'info', 'warn', 'error'];
    const tag = LEVELS[level] ?? 'log';
    const entry = `[renderer:${tag}] ${message}  (${sourceId}:${line})\n`;
    process.stdout.write(entry);
    try { fs.appendFileSync(RENDERER_LOG, entry); } catch {}
  });

  const appUrl = `http://localhost:${port}`;
  logElectron('info', `loadURL ${appUrl}`);
  wc.loadURL(appUrl);

  // Open DevTools in development
  // wc.openDevTools();
}

function sendMenuAction(payload) {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu-action', payload);
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),

    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },

    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
            ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },

    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    {
      label: 'Tools',
      submenu: [
        {
          label: 'Theme Picker',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => sendMenuAction({ type: 'open-theme-picker' }),
        },
        {
          label: 'Secrets Manager',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction({ type: 'open-secrets-manager' }),
        },
        ...(isMac
          ? [
              { type: 'separator' },
              {
                label: 'Connectors',
                submenu: [
                  {
                    label: 'Apple Mail',
                    accelerator: 'CmdOrCtrl+Shift+M',
                    click: () => sendMenuAction({ type: 'toggle-connector-mail' }),
                  },
                  {
                    label: 'Apple Calendar',
                    accelerator: 'CmdOrCtrl+Shift+C',
                    click: () => sendMenuAction({ type: 'toggle-connector-calendar' }),
                  },
                  {
                    label: 'Apple Notes',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => sendMenuAction({ type: 'toggle-connector-notes' }),
                  },
                  {
                    label: 'Apple Reminders',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => sendMenuAction({ type: 'toggle-connector-reminders' }),
                  },
                ],
              },
            ]
          : []),
      ],
    },

    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' },
            ]
          : []),
      ],
    },

    ...(isMac
      ? [
          {
            label: 'Help',
            submenu: [{ role: 'about' }],
          },
        ]
      : []),
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

registerCaptureHandlers(ipcMain);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  logElectron('info', 'second instance blocked — quitting');
  app.quit();
} else {
  app.on('second-instance', () => {
    logElectron('info', 'second-instance — focusing existing window');
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    // 1. Spawn server — resolves when SERVER_READY received
    const { port, process: proc } = await spawnServer({ onExit: handleServerExit });
    serverProcess = proc;
    writePort(port);

    // 2. Register protocol request handler (scheme was registered before ready)
    registerHandler();
    ipcMain.on('workspace:set-root', (_, repoPath) => setWorkspaceRoot(repoPath));

    // 3. Register IPC handlers (unchanged)
    const documentHandlers = registerDocumentHandlers(ipcMain, { exportController });

    exportController.register('document', createDocumentSubmodule({ getPandocPath: documentHandlers.getPandocPath }));
    exportController.register('html-artifact', htmlArtifactSubmodule);
    exportController.register('spreadsheet', spreadsheetSubmodule);

    // 4. Create window — now uses dynamic port
    createWindow(port);
    buildMenu();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(port);
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // will-quit fires for all quit paths including Cmd+Q and app.quit().
  // SIGTERM/SIGINT are handled by process.on() above. SIGKILL: unhandleable.
  app.on('will-quit', cleanup);
}
