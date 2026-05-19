/**
 * @module document-handlers
 * @role IPC handlers for document export, print, and email (macOS Mail).
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { shell } = require('electron');

function getPandocPath() {
  const binName = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc';
  const prodPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'pandoc', process.platform, binName)
    : null;
  const devPath = path.join(__dirname, '..', 'resources', 'pandoc', process.platform, binName);
  if (prodPath && fs.existsSync(prodPath)) return prodPath;
  if (fs.existsSync(devPath)) return devPath;
  return null;
}

function sanitizeFilename(name) {
  const cleaned = String(name || '').replace(/[\\/:*?"<>|]/g, '').trim();
  return cleaned || 'document';
}

/**
 * @param {object} deps
 * @param {{ exportDocument: Function }} deps.exportController
 */
function createDocumentHandlers({ exportController }) {
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

  return {
    getPandocPath,

    async handleExportDocument(_event, payload) {
      const { format, content, filename, sourceType, sourceFormat } = payload || {};

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
            base64: Buffer.from(buffer).toString('base64'),
            filename: `${safeName}.pdf`,
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      return { success: false, error: `Unsupported export format: ${format}` };
    },

    async handleSendDocumentEmail(_event, { format, content, filename }) {
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
        setTimeout(cleanup, 30000);
      }
    },

    async handlePrintDocument(_event, { content, filename }) {
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
          shell.openPath(tmpPdf);
        }

        setTimeout(() => {
          try { fs.unlinkSync(tmpPdf); } catch {}
        }, 5 * 60 * 1000);

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  };
}

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ exportController: { exportDocument: Function } }} deps
 */
function registerDocumentHandlers(ipcMain, deps) {
  const handlers = createDocumentHandlers(deps);

  ipcMain.handle('export-document', handlers.handleExportDocument);
  ipcMain.handle('send-document-email', handlers.handleSendDocumentEmail);
  ipcMain.handle('print-document', handlers.handlePrintDocument);

  return handlers;
}

module.exports = { registerDocumentHandlers, createDocumentHandlers, getPandocPath };
