const { app, BrowserWindow, ipcMain, Menu, dialog, webFrameMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const exportController = require('./export/export-controller.cjs');
const { createDocumentSubmodule } = require('./export/submodules/documents/index.cjs');
const htmlArtifactSubmodule = require('./export/submodules/html-artifacts/index.cjs');
const spreadsheetSubmodule = require('./export/submodules/spreadsheets/index.cjs');
const { registerCaptureHandlers } = require('./ipc/capture-handlers.cjs');
const { registerScreenshotHandlers } = require('./ipc/screenshot-handlers.cjs');
const { registerDocumentHandlers } = require('./ipc/document-handlers.cjs');
const focusState = require('./focus-state.cjs');
const { spawnServer } = require('./server-spawn.cjs');
const { stopChildProcess } = require('./process-shutdown.cjs');
const { writePort, clearPort } = require('./port-file.cjs');
const { registerScheme, registerHandler, setWorkspaceRoot } = require('./protocol-handler.cjs');
const { createRendererConsoleLogger } = require('./renderer-console-logging.cjs');
const { createRuntimeDescriptorOwner } = require('./runtime-descriptor.cjs');
const { registerRuntimeDescriptorIpc } = require('./runtime-ipc.cjs');
const { createAuthorizedIpcMain } = require('./authorized-ipc.cjs');
const { createViewCapsuleRegistryOwner } = require('./view-capsule-registry.cjs');
const { createServerWorkspaceBindingAuthority } = require('./server-workspace-binding.cjs');
const { createShellLaunchAuthority } = require('./shell-launch-authority.cjs');
const { registerShellProofIpc } = require('./shell-proof-ipc.cjs');
const { SHELL_URL, registerShellHandler, resolveShellRoot } = require('./shell-protocol.cjs');
const {
  attachShellNavigationPolicy,
  installSubframeHeaderPolicy,
} = require('./shell-navigation-policy.cjs');

// MUST be called before app is ready — registers scheme privileges
registerScheme();

app.setName('Fusion Studio');

if (process.env.FUSION_APP_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.FUSION_APP_USER_DATA));
}

let mainWindow;
let serverProcess = null;
let documentHandlers = null;
let cleanupPromise = null;
let quitCleanupComplete = false;
let isQuitting = false;
const runtimeDescriptorOwner = createRuntimeDescriptorOwner();
const viewCapsuleRegistryOwner = createViewCapsuleRegistryOwner({
  getRuntimeGeneration: () => runtimeDescriptorOwner.getCurrent()?.generation || null,
});
let runtimeDescriptorIpc = null;
let shellLaunchAuthority = null;
const serverWorkspaceBindingAuthority = createServerWorkspaceBindingAuthority({
  getRuntimeGeneration: () => runtimeDescriptorOwner.getCurrent()?.generation || null,
  getExpectedGeneration: () => shellLaunchAuthority?.generation || null,
  installBinding: (binding, generation) => viewCapsuleRegistryOwner.setWorkspaceBinding(binding, generation),
  revokeBinding: (generation) => viewCapsuleRegistryOwner.clearWorkspaceBindingForGeneration(generation),
  getInstalledBinding: () => viewCapsuleRegistryOwner.getWorkspaceBinding(),
  setWorkspaceRoot,
});
let workspaceMenuState = {
  workspaces: [],
  activeWorkspaceId: null,
};

function cleanup() {
  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    try { documentHandlers?.cleanup(); } catch (error) {
      logElectron('error', `document output cleanup failed: ${error.message}`);
    }
    clearPort();

    const processToStop = serverProcess;
    serverProcess = null;
    const result = await stopChildProcess(processToStop, {
      log: (message) => logElectron('error', message),
    });
    logElectron('info', `server shutdown status=${result.status}`);
  })();

  return cleanupPromise;
}

async function cleanupAndExit() {
  await cleanup();
  process.exit(0);
}

process.on('SIGTERM', () => { void cleanupAndExit(); });
process.on('SIGINT',  () => { void cleanupAndExit(); });

const RENDERER_LOG = path.join(os.tmpdir(), 'electron-renderer.log');
const ELECTRON_DIAG_LOG = path.join(os.tmpdir(), 'fusion-electron.log');
// Clear on each launch so the log stays fresh
try { fs.writeFileSync(RENDERER_LOG, `--- renderer log started ${new Date().toISOString()} ---\n`); } catch {}
const rendererConsoleLogger = createRendererConsoleLogger({
  appendFileSync: fs.appendFileSync,
  rendererLog: RENDERER_LOG,
  stdout: process.stdout,
});

function logElectron(level, message) {
  const entry = `[${new Date().toISOString()}] [Electron] ${message}\n`;
  if (level === 'error') {
    console.error(entry.trimEnd());
  } else {
    console.log(entry.trimEnd());
  }
  try { fs.appendFileSync(ELECTRON_DIAG_LOG, entry); } catch {}
}

function handleWorkspaceBindingChannelError() {
  viewCapsuleRegistryOwner.retire();
  serverWorkspaceBindingAuthority.retire();
  logElectron('error', 'server workspace binding channel invalid');
}

/** Log navigation failures with Chromium net error codes (e.g. ERR_CONNECTION_REFUSED = -102). */
function attachNavigationDiagnostics(webContents) {
  webContents.on('did-start-loading', () => {
    logElectron('info', 'navigation-load-started');
  });

  webContents.on('did-finish-load', () => {
    logElectron('info', 'navigation-load-finished');
  });

  webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    const boundedCode = Number.isInteger(errorCode) ? errorCode : 'unknown';
    logElectron('error', `navigation-load-failed stage=committed code=${boundedCode}`);
  });

  webContents.on('did-fail-provisional-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    const boundedCode = Number.isInteger(errorCode) ? errorCode : 'unknown';
    logElectron('error', `navigation-load-failed stage=provisional code=${boundedCode}`);
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
  if (isQuitting) return;
  // Called on unexpected crash after ready signal
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;

  if (win) {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Fusion Studio',
      message: 'Server crashed, restarting…',
      buttons: [],
      noLink: true,
    });
  }

  clearPort();
  runtimeDescriptorIpc?.publish(null);
  runtimeDescriptorIpc?.clearMainFrame();
  runtimeDescriptorOwner.clear();
  viewCapsuleRegistryOwner.retire();
  serverWorkspaceBindingAuthority.retire();
  shellLaunchAuthority = createShellLaunchAuthority();

  spawnServer({
    onExit: handleServerExit,
    resourcesPath: getElectronResourcesRoot(),
    userDataPath: getServerUserDataPath(),
    bootstrapAuthority: shellLaunchAuthority,
    onWorkspaceBinding: (binding, generation) => {
      serverWorkspaceBindingAuthority.accept(binding, generation);
    },
    onWorkspaceBindingError: handleWorkspaceBindingChannelError,
  })
    .then(async ({ port, process: proc }) => {
      if (isQuitting) {
        await stopChildProcess(proc, {
          log: (message) => logElectron('error', message),
        });
        return;
      }
      serverProcess = proc;
      writePort(port);
      runtimeDescriptorOwner.activate(port, shellLaunchAuthority.generation);
      await serverWorkspaceBindingAuthority.activate(shellLaunchAuthority.generation);
      const reloadWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
      if (reloadWindow) reloadWindow.webContents.loadURL(SHELL_URL);
      // Close the dialog — Electron dialogs auto-close when parent navigates
    })
    .catch((err) => {
      logElectron('error', `Server respawn failed: ${err.message}`);
    });
}

function getElectronResourcesRoot() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname, 'resources');
}

function getElectronUserDataPath() {
  return app.getPath('userData');
}

function getServerUserDataPath() {
  if (app.isPackaged || process.env.FUSION_APP_USER_DATA) {
    return getElectronUserDataPath();
  }
  return null;
}

function createWindow() {
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

  focusState.trackWindow(mainWindow);

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
  attachShellNavigationPolicy(wc, {
    log: (code) => logElectron('error', code),
    onMainFrameNavigation: () => {
      runtimeDescriptorIpc?.clearMainFrame();
      viewCapsuleRegistryOwner.retire();
      serverWorkspaceBindingAuthority.invalidateInstallation();
    },
  });
  wc.on('did-finish-load', () => {
    const descriptor = runtimeDescriptorOwner.getCurrent();
    if (!descriptor || !runtimeDescriptorIpc?.commitMainFrame()) return;
    runtimeDescriptorIpc.publish(descriptor);
  });

  // Allow any website to render inside iframes by stripping frame-blocking headers.
  // This only affects <iframe> subframe requests, not the main app window.
  installSubframeHeaderPolicy(wc);

  wc.on('render-process-gone', (_event, details) => {
    viewCapsuleRegistryOwner.retire();
    serverWorkspaceBindingAuthority.invalidateInstallation();
    logElectron('error', `render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
    if (mainWindow.isDestroyed()) return;
    if (details.reason !== 'clean-exit') {
      logElectron('info', 'render-process-gone → reloading webContents');
      wc.reload();
    }
  });

  // Pipe renderer console → log file so we can debug without opening DevTools
  wc.on('console-message', (_e, level, message, line, sourceId) => {
    rendererConsoleLogger.log(level, message, line, sourceId);
  });

  logElectron('info', `loadURL ${SHELL_URL}`);
  wc.loadURL(SHELL_URL);

  // Track browser iframe navigations so the address bar updates for cross-origin sites.
  // The browser iframe is the only direct child frame of the main webContents.
  function handleBrowserFrameNav(url, isMainFrame, frameProcessId, frameRoutingId) {
    if (isMainFrame) return;
    if (!url || url === 'about:blank') return;
    try {
      const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
      if (frame && frame.parent === wc.mainFrame && runtimeDescriptorIpc?.hasCommittedShellAuthority()) {
        wc.send('browser:url-changed', { url });
      }
    } catch {
      // Frame may have been destroyed
    }
  }

  wc.on('did-frame-navigate', (_event, url, _code, _text, isMainFrame, frameProcessId, frameRoutingId) => {
    handleBrowserFrameNav(url, isMainFrame, frameProcessId, frameRoutingId);
  });

  wc.on('did-navigate-in-page', (_event, url, isMainFrame, frameProcessId, frameRoutingId) => {
    handleBrowserFrameNav(url, isMainFrame, frameProcessId, frameRoutingId);
  });

  // Open DevTools in development
  // wc.openDevTools();
}

function sendMenuAction(payload) {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  if (win && runtimeDescriptorIpc?.hasCommittedShellAuthority()) {
    win.webContents.send('menu-action', payload);
  }
}

function sanitizeWorkspaceMenuState(state) {
  if (!state || typeof state !== 'object') {
    return { workspaces: [], activeWorkspaceId: null };
  }

  const activeWorkspaceId = typeof state.activeWorkspaceId === 'string'
    ? state.activeWorkspaceId
    : null;
  const workspaces = Array.isArray(state.workspaces)
    ? state.workspaces
        .map((workspace, index) => {
          if (!workspace || typeof workspace !== 'object') return null;
          if (typeof workspace.id !== 'string' || workspace.id.length === 0) return null;
          const label = typeof workspace.label === 'string' && workspace.label.trim().length > 0
            ? workspace.label
            : workspace.id;
          const ribbonSortOrder = typeof workspace.ribbonSortOrder === 'number'
            ? workspace.ribbonSortOrder
            : null;
          const sortOrder = typeof workspace.sortOrder === 'number'
            ? workspace.sortOrder
            : index;
          return {
            id: workspace.id,
            label,
            ribbonVisible: workspace.ribbonVisible !== false,
            ribbonSortOrder,
            sortOrder,
            index,
          };
        })
        .filter(Boolean)
    : [];

  workspaces.sort((a, b) => {
    const aOrder = a.ribbonSortOrder ?? a.sortOrder;
    const bOrder = b.ribbonSortOrder ?? b.sortOrder;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.index - b.index;
  });

  return { workspaces, activeWorkspaceId };
}

function setWorkspaceMenuState(state) {
  const nextState = sanitizeWorkspaceMenuState(state);
  if (JSON.stringify(nextState) === JSON.stringify(workspaceMenuState)) return;
  workspaceMenuState = nextState;
  buildMenu();
}

function buildWorkspacesSubmenu() {
  const workspaceItems = workspaceMenuState.workspaces.map((workspace) => ({
    label: workspace.id === workspaceMenuState.activeWorkspaceId
      ? `${workspace.label} ✓`
      : workspace.label,
    type: 'checkbox',
    checked: workspace.ribbonVisible,
    click: (menuItem) => {
      if (workspace.ribbonVisible && menuItem.checked === false) {
        sendMenuAction({
          type: 'workspace-menu:set-ribbon-visible',
          workspaceId: workspace.id,
          visible: false,
        });
        return;
      }

      if (!workspace.ribbonVisible && menuItem.checked === true) {
        sendMenuAction({
          type: 'workspace-menu:set-ribbon-visible',
          workspaceId: workspace.id,
          visible: true,
        });
        return;
      }

      sendMenuAction({ type: 'workspace-menu:switch', workspaceId: workspace.id });
    },
  }));

  return [
    {
      label: 'Show Workspace Ribbon',
      click: () => sendMenuAction({ type: 'workspace-menu:show-ribbon' }),
    },
    { type: 'separator' },
    ...(
      workspaceItems.length > 0
        ? workspaceItems
        : [{ label: 'No registered workspaces', enabled: false }]
    ),
    { type: 'separator' },
    {
      label: 'Add Project...',
      click: () => sendMenuAction({ type: 'workspace-menu:add-project' }),
    },
    {
      label: 'Create New Project...',
      click: () => sendMenuAction({ type: 'workspace-menu:create-project' }),
    },
  ];
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
      label: 'Workspaces',
      submenu: buildWorkspacesSubmenu(),
    },

    {
      label: 'Tools',
      submenu: [
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
    shellLaunchAuthority = createShellLaunchAuthority();
    const { port, process: proc } = await spawnServer({
      onExit: handleServerExit,
      resourcesPath: getElectronResourcesRoot(),
      userDataPath: getServerUserDataPath(),
      focusStatePath: focusState.getStateFilePath(),
      bootstrapAuthority: shellLaunchAuthority,
      onWorkspaceBinding: (binding, generation) => {
        serverWorkspaceBindingAuthority.accept(binding, generation);
      },
      onWorkspaceBindingError: handleWorkspaceBindingChannelError,
    });
    if (isQuitting) {
      await stopChildProcess(proc, {
        log: (message) => logElectron('error', message),
      });
      return;
    }
    serverProcess = proc;
    writePort(port);
    runtimeDescriptorOwner.activate(port, shellLaunchAuthority.generation);
    await serverWorkspaceBindingAuthority.activate(shellLaunchAuthority.generation);
    logElectron('info', `server ready port=${port}`);

    // 2. Register protocol request handler (scheme was registered before ready)
    registerHandler({ getViewCapsuleRegistry: () => viewCapsuleRegistryOwner.getCurrent() });
    registerShellHandler({
      protocol: require('electron').protocol,
      net: require('electron').net,
      shellRoot: resolveShellRoot({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        moduleDirectory: __dirname,
      }),
      getRuntimeDescriptor: () => runtimeDescriptorOwner.getCurrent(),
    });
    runtimeDescriptorIpc = registerRuntimeDescriptorIpc({
      ipcMain,
      getMainWindow: () => mainWindow,
      getRuntimeDescriptor: () => runtimeDescriptorOwner.getCurrent(),
      log: (code) => logElectron('error', code),
    });
    const authorizedIpcMain = createAuthorizedIpcMain(ipcMain, {
      authorize: (event) => runtimeDescriptorIpc.authorize(event),
      log: (code) => logElectron('error', code),
    });
    registerShellProofIpc({
      authorizedIpcMain,
      getLaunchAuthority: () => shellLaunchAuthority,
      log: (code) => logElectron('error', code),
    });
    registerCaptureHandlers(authorizedIpcMain);
    registerScreenshotHandlers(authorizedIpcMain);
    authorizedIpcMain.handle('workspace:set-binding', async (_, request) => {
      const validRequest = request && typeof request === 'object' && !Array.isArray(request)
        && Object.keys(request).sort().join(',') === 'bindingRevision,runtimeGeneration,workspaceId'
        && Number.isSafeInteger(request.bindingRevision) && request.bindingRevision >= 1;
      if (!validRequest) return false;
      if (runtimeDescriptorOwner.getCurrent()?.generation !== request.runtimeGeneration) return false;
      const accepted = await serverWorkspaceBindingAuthority.correlate(
        request.workspaceId,
        request.bindingRevision,
        request.runtimeGeneration,
      );
      if (runtimeDescriptorOwner.getCurrent()?.generation !== request.runtimeGeneration) return false;
      return accepted;
    });
    authorizedIpcMain.handle('workspace:set-view-capsules', async (_, request) => {
      const validRequest = request && typeof request === 'object' && !Array.isArray(request)
        && Object.keys(request).sort().join(',') === 'projection,runtimeGeneration';
      if (!validRequest) return false;
      if (request.projection === null) {
        return viewCapsuleRegistryOwner.clearForGeneration(request.runtimeGeneration);
      }
      return viewCapsuleRegistryOwner.replace(request.projection, request.runtimeGeneration);
    });
    authorizedIpcMain.on('workspace-menu:set-state', (_, state) => setWorkspaceMenuState(state));

    // 3. Register IPC handlers
    authorizedIpcMain.handle('show-emoji-panel', () => {
      app.showEmojiPanel();
      return { success: true };
    });

    documentHandlers = registerDocumentHandlers(authorizedIpcMain, { exportController });

    
    exportController.register('document', createDocumentSubmodule({ getPandocPath: documentHandlers.getPandocPath }));
    exportController.register('html-artifact', htmlArtifactSubmodule);
    exportController.register('spreadsheet', spreadsheetSubmodule);

    // 4. Create window — now uses dynamic port
    createWindow();
    buildMenu();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
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

  // Electron does not await async will-quit listeners. Hold the first quit,
  // supervise the server child, then issue a second quit after cleanup.
  app.on('before-quit', (event) => {
    if (quitCleanupComplete) return;
    event.preventDefault();
    if (isQuitting) return;

    isQuitting = true;
    void cleanup().finally(() => {
      quitCleanupComplete = true;
      app.quit();
    });
  });
}
