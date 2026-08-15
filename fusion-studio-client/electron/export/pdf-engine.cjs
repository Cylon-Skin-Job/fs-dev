/**
 * @module pdf-engine
 * @role Shared HTML → PDF converter using Electron's built-in Chromium
 *
 * All export submodules (documents, html-artifacts, spreadsheets) funnel
 * through here to produce PDF output. No external binary required.
 */

const { BrowserWindow } = require('electron');

const DEFAULT_STAGE_TIMEOUT_MS = 30_000;

function withDeadline(operation, timeoutMs, stage) {
  let timeout;
  return Promise.race([
    Promise.resolve(operation),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`PDF renderer ${stage} timed out`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

/**
 * Convert HTML content to a PDF buffer.
 * @param {string} htmlContent
 * @param {object} options
 * @returns {Promise<Buffer>}
 */
async function htmlToPdf(htmlContent, options = {}) {
  const { stageTimeoutMs = DEFAULT_STAGE_TIMEOUT_MS, ...printOptions } = options;
  if (!Number.isSafeInteger(stageTimeoutMs) || stageTimeoutMs <= 0) {
    throw new TypeError('stageTimeoutMs must be a positive safe integer');
  }
  const win = new BrowserWindow({
    show: false,
    width: 720,
    height: 1056,
    webPreferences: {
      javascript: true,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  try {
    const inertHtml = htmlContent.includes('<head>')
      ? htmlContent.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'">')
      : `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">${htmlContent}`;
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(inertHtml)}`;
    await withDeadline(win.loadURL(dataUrl), stageTimeoutMs, 'load');
    win.webContents.setZoomFactor(1);
    win.webContents.debugger.attach('1.3');
    await withDeadline(
      win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' }),
      stageTimeoutMs,
      'print-media setup',
    );
    const readiness = await withDeadline(win.webContents.executeJavaScript(`(async () => {
      try {
        if (document.fonts) await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: String(error && error.message || error) };
      }
    })()`), stageTimeoutMs, 'readiness');
    if (!readiness?.ok) throw new Error(`PDF renderer readiness failed: ${readiness?.message ?? 'unknown'}`);
    return await withDeadline(win.webContents.printToPDF({
      marginsType: 1, // no margins — @page CSS owns the printable box
      printBackground: true,
      pageSize: 'Letter',
      preferCSSPageSize: true,
      scale: 1,
      ...printOptions,
    }), stageTimeoutMs, 'print');
  } finally {
    if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { htmlToPdf };
