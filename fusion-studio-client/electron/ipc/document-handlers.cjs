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
const {
  INVALID_TABLE_PRESENTATION,
  TABLE_PRESENTATION_MISMATCH,
  hasOfficePresentationFields,
} = require('../shared/office-table-presentation-validation.cjs');
const {
  createDocumentOutputCoordinator,
  createOfficeAttachmentHandlers,
  createOfficePdfHandlers,
  createSharedDocumentAttachmentBuilders,
} = require('../export/submodules/documents/document-output-coordinator.cjs');
const {
  createOfficePdfBuilder,
} = require('../export/submodules/documents/table-presentation.cjs');
const {
  createOfficeDocxBuilder,
} = require('../export/submodules/documents/docx-table-presentation.cjs');

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
function createDocumentHandlers({
  exportController,
  documentOutputCoordinator,
  platform = process.platform,
  temporaryRoot = os.tmpdir(),
  runAppleScript,
  openExternalPath = (candidate) => shell.openPath(candidate),
}) {
  const pdfBuilder = createOfficePdfBuilder({ getPandocPath, temporaryRoot });
  const docxBuilder = createOfficeDocxBuilder({ getPandocPath, temporaryRoot });
  const attachmentBuilders = createSharedDocumentAttachmentBuilders({ pdfBuilder, docxBuilder });
  const attachmentHandlers = createOfficeAttachmentHandlers(attachmentBuilders);
  const pdfHandlers = createOfficePdfHandlers(pdfBuilder);
  const outputCoordinator = documentOutputCoordinator ?? createDocumentOutputCoordinator({
    officeHandlers: {
      export: attachmentHandlers.export,
      email: attachmentHandlers.email,
      print: pdfHandlers.print,
    },
  });

  const executeAppleScript = runAppleScript ?? ((script) => new Promise((resolve, reject) => {
    const proc = spawn('osascript', ['-e', script]);
    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || 'AppleScript failed'));
      else resolve();
    });
  }));

  function officeFailure(error) {
    const code = error?.code;
    return {
      success: false,
      error: code === TABLE_PRESENTATION_MISMATCH
        ? TABLE_PRESENTATION_MISMATCH
        : (code === INVALID_TABLE_PRESENTATION
          ? INVALID_TABLE_PRESENTATION
          : (error?.message || 'Document output failed')),
    };
  }

  async function buildOfficeMode(surface, payload) {
    if (!hasOfficePresentationFields(payload)) return { matched: false };
    try {
      return {
        matched: true,
        artifact: await outputCoordinator.run(surface, payload, async () => {
          throw new Error(INVALID_TABLE_PRESENTATION);
        }),
      };
    } catch (error) {
      return {
        matched: true,
        result: officeFailure(error),
      };
    }
  }

  function writeOfficeTemporaryArtifact(prefix, format, buffer, filename) {
    if (!Buffer.isBuffer(buffer)) throw new Error('Document output failed');
    const root = fs.mkdtempSync(path.join(temporaryRoot, prefix));
    outputCoordinator.trackCleanup(root);
    try {
      const filePath = path.join(root, `${sanitizeFilename(filename)}.${format}`);
      fs.writeFileSync(filePath, buffer, { flag: 'wx', mode: 0o600 });
      return { root, filePath };
    } catch (error) {
      outputCoordinator.cleanupPath(root);
      throw error;
    }
  }

  async function handoffOfficeEmail(artifact, payload) {
    if (platform !== 'darwin') {
      return { success: false, error: 'Email sending is only supported on macOS' };
    }
    let temporary;
    try {
      temporary = writeOfficeTemporaryArtifact(
        'fusion-office-email-', payload.format, artifact.buffer, payload.filename,
      );
      const subject = payload.filename ? `Document: ${payload.filename}` : 'Shared document';
      const script = `
      tell application "Mail"
        set newMessage to make new outgoing message with properties {visible:true, subject:"${subject.replace(/"/g, '\\"')}"}
        tell content of newMessage
          make new attachment with properties {file name:"${temporary.filePath.replace(/"/g, '\\"')}"} at after last paragraph
        end tell
        activate
      end tell
    `;
      await executeAppleScript(script);
      outputCoordinator.scheduleCleanup(temporary.root, 30_000);
      return { success: true };
    } catch (error) {
      if (temporary) outputCoordinator.cleanupPath(temporary.root);
      return officeFailure(error);
    }
  }

  async function handoffOfficePrint(artifact, payload) {
    let temporary;
    try {
      temporary = writeOfficeTemporaryArtifact(
        'fusion-office-print-', 'pdf', artifact.buffer, payload.filename || 'document',
      );
      if (platform === 'darwin') {
        const script = `
        tell application "Preview"
          activate
          open POSIX file "${temporary.filePath.replace(/"/g, '\\"')}"
        end tell
        delay 0.5
        tell application "System Events"
          keystroke "p" using command down
        end tell
      `;
        await executeAppleScript(script);
      } else {
        const openError = await openExternalPath(temporary.filePath);
        if (typeof openError === 'string' && openError.length > 0) {
          throw new Error(openError);
        }
      }
      outputCoordinator.scheduleCleanup(temporary.root, 5 * 60 * 1000);
      return { success: true };
    } catch (error) {
      if (temporary) outputCoordinator.cleanupPath(temporary.root);
      return officeFailure(error);
    }
  }

  async function exportToTempFile({ format, content, filename, sourceType, sourceFormat }) {
    const safeName = sanitizeFilename(filename);
    const root = fs.mkdtempSync(path.join(temporaryRoot, 'fusion-document-email-'));
    outputCoordinator.trackCleanup(root);

    try {
      if (format === 'docx') {
        const pandocPath = getPandocPath();
        if (!pandocPath) throw new Error('Pandoc not found in bundle');

        const tmpInput = path.join(root, 'source.md');
        const tmpOutput = path.join(root, `${safeName}.docx`);
        fs.writeFileSync(tmpInput, content ?? '', { encoding: 'utf8', flag: 'wx', mode: 0o600 });

        await new Promise((resolve, reject) => {
          const proc = spawn(pandocPath, [tmpInput, '-o', tmpOutput]);
          let stderr = '';
          proc.stderr.on('data', (data) => { stderr += data.toString(); });
          proc.on('error', reject);
          proc.on('close', (code) => {
            if (code !== 0 || !fs.existsSync(tmpOutput)) {
              reject(new Error(stderr || 'Pandoc failed'));
            } else {
              resolve();
            }
          });
        });
        fs.unlinkSync(tmpInput);
        fs.chmodSync(tmpOutput, 0o600);
        return { root, filePath: tmpOutput };
      }

      if (format === 'pdf') {
        const { buffer } = await exportController.exportDocument({
          sourceType: sourceType || 'document',
          sourceFormat: sourceFormat || 'markdown',
          content,
          filename,
        });
        const tmpOutput = path.join(root, `${safeName}.pdf`);
        fs.writeFileSync(tmpOutput, buffer, { flag: 'wx', mode: 0o600 });
        return { root, filePath: tmpOutput };
      }

      if (format === 'markdown') {
        const tmpOutput = path.join(root, `${safeName}.md`);
        fs.writeFileSync(tmpOutput, content ?? '', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        return { root, filePath: tmpOutput };
      }

      throw new Error(`Unsupported export format: ${format}`);
    } catch (error) {
      outputCoordinator.cleanupPath(root);
      throw error;
    }
  }

  return {
    getPandocPath,

    cleanup() {
      outputCoordinator.cleanup();
    },

    async handleExportDocument(_event, payload) {
      const officeResult = await buildOfficeMode('export', payload);
      if (officeResult.matched) {
        if (officeResult.result) return officeResult.result;
        try {
          const { format, filename } = payload;
          if (!Buffer.isBuffer(officeResult.artifact?.buffer)) throw new Error('Document output failed');
          return {
            success: true,
            base64: officeResult.artifact.buffer.toString('base64'),
            filename: `${sanitizeFilename(filename)}.${format}`,
          };
        } catch (error) {
          return officeFailure(error);
        }
      }
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

    async handleSendDocumentEmail(_event, payload) {
      const officeResult = await buildOfficeMode('email', payload);
      if (officeResult.matched) {
        if (officeResult.result) return officeResult.result;
        return handoffOfficeEmail(officeResult.artifact, payload);
      }
      const { format, content, filename } = payload;
      if (platform !== 'darwin') {
        return { success: false, error: 'Email sending is only supported on macOS' };
      }

      let temporary;

      try {
        temporary = await exportToTempFile({ format, content, filename });

        const subject = filename ? `Document: ${filename}` : 'Shared document';
        const script = `
      tell application "Mail"
        set newMessage to make new outgoing message with properties {visible:true, subject:"${subject.replace(/"/g, '\\"')}"}
        tell content of newMessage
          make new attachment with properties {file name:"${temporary.filePath.replace(/"/g, '\\"')}"} at after last paragraph
        end tell
        activate
      end tell
    `;

        await executeAppleScript(script);
        outputCoordinator.scheduleCleanup(temporary.root, 30_000);
        return { success: true };
      } catch (err) {
        if (temporary) outputCoordinator.cleanupPath(temporary.root);
        return { success: false, error: err.message };
      }
    },

    async handlePrintDocument(_event, payload) {
      const officeResult = await buildOfficeMode('print', payload);
      if (officeResult.matched) {
        if (officeResult.result) return officeResult.result;
        return handoffOfficePrint(officeResult.artifact, payload);
      }
      const { content, filename } = payload;
      try {
        const { buffer } = await exportController.exportDocument({
          sourceType: 'document',
          sourceFormat: 'markdown',
          content,
          filename: filename || 'document',
        });
        return handoffOfficePrint(
          { buffer: Buffer.from(buffer) },
          { filename: filename || 'document' },
        );
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
