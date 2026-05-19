const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const exportController = require('./export/export-controller.cjs');
const { createDocumentSubmodule } = require('./export/submodules/documents/index.cjs');
const htmlArtifactSubmodule = require('./export/submodules/html-artifacts/index.cjs');
const spreadsheetSubmodule = require('./export/submodules/spreadsheets/index.cjs');
const { registerCaptureHandlers } = require('./ipc/capture-handlers.cjs');
const { registerDocumentHandlers } = require('./ipc/document-handlers.cjs');

let mainWindow;

const RENDERER_LOG = path.join(os.tmpdir(), 'electron-renderer.log');
// Clear on each launch so the log stays fresh
try { fs.writeFileSync(RENDERER_LOG, `--- renderer log started ${new Date().toISOString()} ---\n`); } catch {}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL('http://localhost:3001');

  // Pipe renderer console → log file so we can debug without opening DevTools
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const LEVELS = ['verbose', 'info', 'warn', 'error'];
    const tag = LEVELS[level] ?? 'log';
    const entry = `[renderer:${tag}] ${message}  (${sourceId}:${line})\n`;
    process.stdout.write(entry);
    try { fs.appendFileSync(RENDERER_LOG, entry); } catch {}
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
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
              {
                label: 'Sync Apple Calendar',
                accelerator: 'CmdOrCtrl+Shift+C',
                click: () => sendMenuAction({ type: 'sync-apple-calendar' }),
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

app.whenReady().then(() => {
  const documentHandlers = registerDocumentHandlers(ipcMain, { exportController });

  exportController.register('document', createDocumentSubmodule({ getPandocPath: documentHandlers.getPandocPath }));
  exportController.register('html-artifact', htmlArtifactSubmodule);
  exportController.register('spreadsheet', spreadsheetSubmodule);

  createWindow();
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
