const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ── Helper: run JXA (JavaScript for Automation) via osascript ────────────────
function runJxa(script, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('osascript', ['-l', 'JavaScript', '-e', script]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`JXA script timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(stderr.trim() || 'JXA script failed'));
      else resolve({ stdout: stdout.trim() });
    });
  });
}

const exportController = require('./export/export-controller.cjs');
const { createDocumentSubmodule } = require('./export/submodules/documents/index.cjs');
const htmlArtifactSubmodule = require('./export/submodules/html-artifacts/index.cjs');
const spreadsheetSubmodule = require('./export/submodules/spreadsheets/index.cjs');

let mainWindow;

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

app.whenReady().then(() => {
  // Register export submodules
  exportController.register('document', createDocumentSubmodule({ getPandocPath }));
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

// IPC: capture the full page as PNG and return base64
ipcMain.handle('capture-page', async () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return null;

  const image = await win.webContents.capturePage();
  return image.toPNG().toString('base64');
});

// IPC: capture a specific rect of the page
ipcMain.handle('capture-rect', async (_event, rect) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return null;

  const image = await win.webContents.capturePage(rect);
  return image.toPNG().toString('base64');
});

function getPandocPath() {
  const binName = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc';
  const prodPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'pandoc', process.platform, binName)
    : null;
  const devPath = path.join(__dirname, 'resources', 'pandoc', process.platform, binName);
  if (prodPath && fs.existsSync(prodPath)) return prodPath;
  if (fs.existsSync(devPath)) return devPath;
  return null;
}

function sanitizeFilename(name) {
  const cleaned = String(name || '').replace(/[\\/:*?"<>|]/g, '').trim();
  return cleaned || 'document';
}

// IPC: export current document to .docx (inline Pandoc) or .pdf (via export controller)
ipcMain.handle('export-document', async (_event, payload) => {
  const { format, content, filename, sourceType, sourceFormat } = payload || {};

  // ── DOCX: keep existing inline Pandoc path ──────────────────────────
  if (format === 'docx') {
    const pandocPath = getPandocPath();
    if (!pandocPath) {
      return { success: false, error: 'Pandoc not found in bundle' };
    }

    const safeName = sanitizeFilename(filename);
    const uid = crypto.randomBytes(6).toString('hex');
    const tmpInput = path.join(os.tmpdir(), `fs-export-${uid}.md`);
    const tmpOutput = path.join(os.tmpdir(), `fs-export-${uid}.docx`);

    try {
      fs.writeFileSync(tmpInput, content ?? '', 'utf8');
    } catch (err) {
      return { success: false, error: `Failed to write temp file: ${err.message}` };
    }

    const cleanup = () => {
      try { fs.unlinkSync(tmpInput); } catch {}
      try { fs.unlinkSync(tmpOutput); } catch {}
    };

    return await new Promise((resolve) => {
      const proc = spawn(pandocPath, [tmpInput, '-o', tmpOutput]);
      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('error', (err) => {
        cleanup();
        resolve({ success: false, error: err.message });
      });
      proc.on('close', (code) => {
        if (code !== 0 || !fs.existsSync(tmpOutput)) {
          cleanup();
          resolve({ success: false, error: (stderr || 'Pandoc failed').trim() });
          return;
        }
        try {
          const base64 = fs.readFileSync(tmpOutput).toString('base64');
          resolve({ success: true, base64, filename: `${safeName}.docx` });
        } catch (err) {
          resolve({ success: false, error: `Failed to read output: ${err.message}` });
        } finally {
          cleanup();
        }
      });
    });
  }

  // ── PDF: route through export controller ────────────────────────────
  if (format === 'pdf') {
    try {
      const { buffer } = await exportController.exportDocument({
        sourceType: sourceType || 'document',
        sourceFormat: sourceFormat || 'markdown',
        content,
        filename,
      });
      const safeName = sanitizeFilename(filename);
      return {
        success: true,
        base64: buffer.toString('base64'),
        filename: `${safeName}.pdf`,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: `Unsupported export format: ${format}` };
});


// ── Helper: export to a temporary file on disk ──────────────────────────────
async function exportToTempFile({ format, content, filename, sourceType, sourceFormat }) {
  const safeName = sanitizeFilename(filename);
  const uid = crypto.randomBytes(6).toString('hex');

  if (format === 'docx') {
    const pandocPath = getPandocPath();
    if (!pandocPath) throw new Error('Pandoc not found in bundle');

    const tmpInput = path.join(os.tmpdir(), `fs-export-${uid}.md`);
    const tmpOutput = path.join(os.tmpdir(), `fs-export-${uid}.docx`);
    fs.writeFileSync(tmpInput, content ?? '', 'utf8');

    await new Promise((resolve, reject) => {
      const proc = spawn(pandocPath, [tmpInput, '-o', tmpOutput]);
      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => {
        try { fs.unlinkSync(tmpInput); } catch {}
        if (code !== 0 || !fs.existsSync(tmpOutput)) {
          reject(new Error(stderr || 'Pandoc failed'));
        } else {
          resolve();
        }
      });
    });

    return { filePath: tmpOutput, cleanup: () => { try { fs.unlinkSync(tmpOutput); } catch {} } };
  }

  if (format === 'pdf') {
    const { buffer } = await exportController.exportDocument({
      sourceType: sourceType || 'document',
      sourceFormat: sourceFormat || 'markdown',
      content,
      filename,
    });
    const tmpOutput = path.join(os.tmpdir(), `fs-export-${uid}.pdf`);
    fs.writeFileSync(tmpOutput, buffer);
    return { filePath: tmpOutput, cleanup: () => { try { fs.unlinkSync(tmpOutput); } catch {} } };
  }

  if (format === 'markdown') {
    const tmpOutput = path.join(os.tmpdir(), `fs-export-${uid}.md`);
    fs.writeFileSync(tmpOutput, content ?? '', 'utf8');
    return { filePath: tmpOutput, cleanup: () => { try { fs.unlinkSync(tmpOutput); } catch {} } };
  }

  throw new Error(`Unsupported export format: ${format}`);
}

// IPC: send document as email attachment via Apple Mail (macOS)
ipcMain.handle('send-document-email', async (_event, { format, content, filename }) => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Email sending is only supported on macOS' };
  }

  let tmpFile;
  let cleanup = () => {};

  try {
    const result = await exportToTempFile({ format, content, filename });
    tmpFile = result.filePath;
    cleanup = result.cleanup;

    const subject = filename ? `Document: ${filename}` : 'Shared document';
    const script = `
      tell application "Mail"
        set newMessage to make new outgoing message with properties {visible:true, subject:"${subject.replace(/"/g, '\\"')}"}
        tell content of newMessage
          make new attachment with properties {file name:"${tmpFile.replace(/"/g, '\\"')}"} at after last paragraph
        end tell
        activate
      end tell
    `;

    await new Promise((resolve, reject) => {
      const proc = spawn('osascript', ['-e', script]);
      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) reject(new Error(stderr.trim() || 'AppleScript failed'));
        else resolve();
      });
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    // Keep temp file around briefly so Mail can attach it, then clean up
    setTimeout(cleanup, 30000);
  }
});


// IPC: print document via PDF export → system print dialog
ipcMain.handle('print-document', async (_event, { content, filename }) => {
  try {
    const { buffer } = await exportController.exportDocument({
      sourceType: 'document',
      sourceFormat: 'markdown',
      content,
      filename: filename || 'document',
    });

    const uid = crypto.randomBytes(6).toString('hex');
    const tmpPdf = path.join(os.tmpdir(), `fs-print-${uid}.pdf`);
    fs.writeFileSync(tmpPdf, buffer);

    if (process.platform === 'darwin') {
      // Open Preview and trigger the print dialog
      const script = `
        tell application "Preview"
          activate
          open POSIX file "${tmpPdf}"
        end tell
        delay 0.5
        tell application "System Events"
          keystroke "p" using command down
        end tell
      `;
      await new Promise((resolve, reject) => {
        const proc = spawn('osascript', ['-e', script]);
        let stderr = '';
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('close', (code) => {
          if (code !== 0) reject(new Error(stderr.trim() || 'AppleScript failed'));
          else resolve();
        });
      });
    } else {
      // Windows / Linux: open in default PDF viewer
      shell.openPath(tmpPdf);
    }

    // Clean up temp file after 5 minutes
    setTimeout(() => {
      try { fs.unlinkSync(tmpPdf); } catch {}
    }, 5 * 60 * 1000);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Calendar IPC handlers (JXA → Apple Calendar.app) ─────────────────────────

ipcMain.handle('calendar:list-calendars', async () => {
  console.log('[IPC calendar:list-calendars] called');
  if (process.platform !== 'darwin') {
    console.log('[IPC calendar:list-calendars] rejected: not macOS');
    return { success: false, error: 'Calendar access requires macOS' };
  }
  try {
    const script = `
      var Calendar = Application('Calendar');
      var result = [];
      var calendars = Calendar.calendars();
      for (var i = 0; i < calendars.length; i++) {
        var cal = calendars[i];
        var color = cal.color();
        var hex = '';
        if (color && color.red !== undefined) {
          var r = Math.round(color.red * 255).toString(16).padStart(2, '0');
          var g = Math.round(color.green * 255).toString(16).padStart(2, '0');
          var b = Math.round(color.blue * 255).toString(16).padStart(2, '0');
          hex = '#' + r + g + b;
        }
        var calId = '';
        try { calId = cal.id(); } catch(e) { calId = cal.name(); }
        var accountName = 'Local';
        try {
          if (cal.account) {
            var a = cal.account();
            if (a && a.title) accountName = a.title();
          }
        } catch(e) { accountName = 'Local'; }
        result.push({
          id: calId,
          name: cal.name(),
          color: hex,
          account: accountName
        });
      }
      JSON.stringify({ success: true, calendars: result });
    `;
    const { stdout } = await runJxa(script, 30000);
    const parsed = JSON.parse(stdout);
    console.log('[IPC calendar:list-calendars] returned', parsed.calendars?.length, 'calendars');
    return parsed;
  } catch (err) {
    console.error('[IPC calendar:list-calendars] JXA error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('calendar:list-events', async (_event, { startDate, endDate }) => {
  console.log('[IPC calendar:list-events] called with range:', startDate, 'to', endDate);
  if (process.platform !== 'darwin') {
    console.log('[IPC calendar:list-events] rejected: not macOS');
    return { success: false, error: 'Calendar access requires macOS' };
  }
  try {
    const script = `
      var Calendar = Application('Calendar');
      var start = new Date("${startDate}");
      var end = new Date("${endDate}");
      var result = [];
      var calendars = Calendar.calendars();
      for (var i = 0; i < calendars.length; i++) {
        var cal = calendars[i];
        // Pre-filter: only events that start before the range end
        var events = cal.events.whose({ startDate: { _lessThan: end } })();
        for (var j = 0; j < events.length; j++) {
          var e = events[j];
          var es = e.startDate();
          var ee = e.endDate();
          // Verify overlap: event end must be after range start
          if (ee > start) {
            result.push({
              uid: e.uid(),
              title: e.summary(),
              startDate: es.toISOString(),
              endDate: ee.toISOString(),
              allDay: e.alldayEvent(),
              calendar: cal.name(),
              location: e.location() || '',
              notes: e.description() || ''
            });
          }
        }
      }
      JSON.stringify({ success: true, events: result });
    `;
    console.log('[IPC calendar:list-events] running JXA...');
    const { stdout } = await runJxa(script, 60000);
    console.log('[IPC calendar:list-events] JXA raw stdout length:', stdout.length);
    const parsed = JSON.parse(stdout);
    console.log('[IPC calendar:list-events] parsed event count:', parsed.events?.length);
    return parsed;
  } catch (err) {
    console.error('[IPC calendar:list-events] JXA error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('calendar:create-event', async (_event, { calendarName, title, startDate, endDate, allDay, location, notes }) => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Calendar access requires macOS' };
  }
  try {
    const script = `
      var Calendar = Application('Calendar');
      var calendars = Calendar.calendars.whose({ name: "${calendarName.replace(/"/g, '\\"')}" })();
      if (calendars.length === 0) throw new Error('Calendar not found: ${calendarName.replace(/"/g, '\\"')}');
      var cal = calendars[0];
      var event = Calendar.Event({
        summary: "${title.replace(/"/g, '\\"')}",
        startDate: new Date("${startDate}"),
        endDate: new Date("${endDate}"),
        alldayEvent: ${allDay ? 'true' : 'false'}
        ${location ? `, location: "${location.replace(/"/g, '\\"')}"` : ''}
        ${notes ? `, description: "${notes.replace(/"/g, '\\"')}"` : ''}
      });
      cal.events.push(event);
      JSON.stringify({ success: true, uid: event.uid() });
    `;
    const { stdout } = await runJxa(script);
    return JSON.parse(stdout);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('calendar:update-event', async (_event, { uid, calendarName, title, startDate, endDate, allDay, location, notes }) => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Calendar access requires macOS' };
  }
  try {
    const script = `
      var Calendar = Application('Calendar');
      var calendars = Calendar.calendars.whose({ name: "${calendarName.replace(/"/g, '\\"')}" })();
      if (calendars.length === 0) throw new Error('Calendar not found');
      var cal = calendars[0];
      var events = cal.events.whose({ uid: "${uid}" })();
      if (events.length === 0) throw new Error('Event not found');
      var e = events[0];
      e.summary = "${title.replace(/"/g, '\\"')}";
      e.startDate = new Date("${startDate}");
      e.endDate = new Date("${endDate}");
      e.alldayEvent = ${allDay ? 'true' : 'false'};
      ${location !== undefined ? `e.location = "${location.replace(/"/g, '\\"')}";` : ''}
      ${notes !== undefined ? `e.description = "${notes.replace(/"/g, '\\"')}";` : ''}
      JSON.stringify({ success: true });
    `;
    const { stdout } = await runJxa(script);
    return JSON.parse(stdout);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('calendar:delete-event', async (_event, { uid }) => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Calendar access requires macOS' };
  }
  try {
    const script = `
      var Calendar = Application('Calendar');
      var calendars = Calendar.calendars();
      var deleted = false;
      for (var i = 0; i < calendars.length; i++) {
        var events = calendars[i].events.whose({ uid: "${uid}" })();
        if (events.length > 0) {
          calendars[i].events.splice(calendars[i].events.indexOf(events[0]), 1);
          deleted = true;
          break;
        }
      }
      if (!deleted) throw new Error('Event not found');
      JSON.stringify({ success: true });
    `;
    const { stdout } = await runJxa(script);
    return JSON.parse(stdout);
  } catch (err) {
    return { success: false, error: err.message };
  }
});
