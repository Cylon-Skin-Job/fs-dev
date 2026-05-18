/**
 * @module pdf-engine
 * @role Shared HTML → PDF converter using Electron's built-in Chromium
 *
 * All export submodules (documents, html-artifacts, spreadsheets) funnel
 * through here to produce PDF output. No external binary required.
 */

const { BrowserWindow } = require('electron');

/**
 * Convert HTML content to a PDF buffer.
 * @param {string} htmlContent
 * @param {object} options
 * @returns {Promise<Buffer>}
 */
async function htmlToPdf(htmlContent, options = {}) {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      javascript: false,
      webSecurity: false,
    },
  });

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;

  await win.loadURL(dataUrl);

  // Allow a brief tick for the renderer to settle (fonts, layout).
  await new Promise((resolve) => setTimeout(resolve, 150));

  const pdf = await win.webContents.printToPDF({
    marginsType: 1, // no margins — we control them via @page CSS
    printBackground: true,
    pageSize: 'Letter',
    ...options,
  });

  win.destroy();
  return pdf;
}

module.exports = { htmlToPdf };
