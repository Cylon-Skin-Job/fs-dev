'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { app, BrowserWindow, ipcMain } = require('electron');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-preload-sandbox-'));
const cleanupRoot = () => fs.rmSync(root, { force: true, recursive: true });
const cleanupHelperPath = path.join(__dirname, 'preload-sandbox-smoke-cleanup.cjs');
const cleanupChild = spawn(process.execPath, [cleanupHelperPath, root, String(process.pid)], {
  detached: true,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'ignore',
});
let cleanupHelperError;
cleanupChild.once('error', (error) => { cleanupHelperError = error; });
cleanupChild.unref();
app.disableHardwareAcceleration();
app.setPath('userData', path.join(root, 'user-data'));

const channels = [
  'capture-page',
  'capture-rect',
  'export-document',
  'send-document-email',
  'print-document',
  'show-emoji-panel',
  'screenshots:list',
  'screenshots:read',
];
const invokeCounts = Object.fromEntries(channels.map((channel) => [channel, 0]));
const officeContent = '| A | B |\n| --- | --- |\n| one | two |';
const officeHash = crypto.createHash('sha256').update(officeContent).digest('hex');
const officePayload = {
  sourceType: 'document',
  sourceFormat: 'markdown',
  format: 'pdf',
  content: officeContent,
  filename: 'sandbox-office',
  presentationMode: 'office-tables',
  tablePresentation: {
    markdownSha256: officeHash,
    tables: [{
      tableIndex: 0,
      sourceSha256: officeHash,
      logicalWidth: 2,
      columns: [96, 96],
      overflow: 'overflow',
      titleRow: false,
      borderWidth: 1,
      borderColor: 'default',
    }],
  },
};

async function run() {
  for (const channel of channels) {
    ipcMain.handle(channel, (_event, payload) => {
      invokeCounts[channel] += 1;
      return { channel, payload };
    });
  }
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  try {
    await window.loadURL('data:text/html;charset=utf-8,<main>preload sandbox smoke</main>');
    const result = await window.webContents.executeJavaScript(`(async () => {
      const api = window.electronAPI;
      const methods = [
        'capturePage', 'captureRect', 'exportDocument', 'sendDocumentEmail',
        'printDocument', 'showEmojiPanel', 'onMenuAction', 'onBrowserUrlChanged',
        'setWorkspaceRoot', 'setWorkspaceMenuState', 'listScreenshots', 'readScreenshot',
      ];
      const remover = api?.onMenuAction(() => {});
      remover?.();
      const legacy = { arbitrary: { preserved: 'sandbox' } };
      const office = ${JSON.stringify(officePayload)};
      const wrongIndex = structuredClone(office);
      wrongIndex.tablePresentation.tables[0].tableIndex = 9;
      const partialColumns = structuredClone(office);
      partialColumns.tablePresentation.tables[0].columns = [96];
      const invalidCodes = [];
      for (const invalid of [wrongIndex, partialColumns]) {
        try {
          await api?.exportDocument(invalid);
        } catch (error) {
          invalidCodes.push(error?.message);
        }
      }
      return {
        apiType: typeof api,
        methodsCallable: methods.every((name) => typeof api?.[name] === 'function'),
        capture: await api?.capturePage(),
        exported: await api?.exportDocument(legacy),
        officeExported: await api?.exportDocument(office),
        invalidCodes,
        emailed: await api?.sendDocumentEmail(legacy),
        printed: await api?.printDocument(legacy),
      };
    })()`);
    if (
      result.apiType !== 'object'
      || !result.methodsCallable
      || result.capture?.channel !== 'capture-page'
      || result.exported?.channel !== 'export-document'
      || result.officeExported?.channel !== 'export-document'
      || result.emailed?.channel !== 'send-document-email'
      || result.printed?.channel !== 'print-document'
      || result.exported?.payload?.arbitrary?.preserved !== 'sandbox'
      || result.officeExported?.payload?.presentationMode !== 'office-tables'
      || result.invalidCodes?.length !== 2
      || result.invalidCodes.some((code) => code !== 'INVALID_TABLE_PRESENTATION')
      || result.emailed?.payload?.arbitrary?.preserved !== 'sandbox'
      || result.printed?.payload?.arbitrary?.preserved !== 'sandbox'
      || invokeCounts['export-document'] !== 2
    ) throw new Error(`Sandboxed preload API assertion failed: ${JSON.stringify(result)}`);
    if (process.env.FUSION_OFFICE_PRELOAD_SANDBOX_FORCE_FAILURE === '1') {
      throw new Error('Forced sandbox smoke failure for cleanup verification');
    }
    fs.writeSync(process.stdout.fd, 'OFFICE_PRELOAD_SANDBOX_OK\n');
  } finally {
    window.destroy();
  }
}

function finish(exitCode, error) {
  let finalError = error || cleanupHelperError;
  let rootRemoved = false;
  try {
    for (const channel of channels) ipcMain.removeHandler(channel);
    cleanupRoot();
    if (fs.existsSync(root)) throw new Error(`Sandbox smoke root still exists: ${root}`);
    rootRemoved = true;
  } catch (cleanupError) {
    finalError = finalError
      ? new AggregateError([finalError, cleanupError], 'Sandbox smoke and cleanup failed')
      : cleanupError;
    exitCode = 1;
  }

  if (rootRemoved) fs.writeSync(process.stdout.fd, `OFFICE_PRELOAD_SANDBOX_ROOT_REMOVED=${root}\n`);
  if (finalError) fs.writeSync(process.stderr.fd, `${finalError?.stack || finalError}\n`);
  app.exit(exitCode);
}

app.whenReady().then(run).then(
  () => finish(0),
  (error) => finish(1, error),
);
