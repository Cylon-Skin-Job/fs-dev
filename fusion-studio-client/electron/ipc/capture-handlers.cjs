/**
 * @module capture-handlers
 * @role IPC handlers for page screenshot capture (full page and rect).
 */

const { BrowserWindow } = require('electron');

/**
 * @param {import('electron').IpcMain} ipcMain
 */
function registerCaptureHandlers(ipcMain) {
  ipcMain.handle('capture-page', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const image = await win.webContents.capturePage();
    return image.toPNG().toString('base64');
  });

  ipcMain.handle('capture-rect', async (_event, rect) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const image = await win.webContents.capturePage(rect);
    return image.toPNG().toString('base64');
  });
}

module.exports = { registerCaptureHandlers };
