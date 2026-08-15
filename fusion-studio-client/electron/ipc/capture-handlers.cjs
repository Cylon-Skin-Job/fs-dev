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

    let image = await win.webContents.capturePage({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    if (rect.maxWidth || rect.maxHeight) {
      const size = image.getSize();
      const widthScale = rect.maxWidth ? rect.maxWidth / size.width : 1;
      const heightScale = rect.maxHeight ? rect.maxHeight / size.height : 1;
      const scale = Math.min(widthScale, heightScale, 1);
      if (scale < 1) {
        image = image.resize({
          width: Math.max(1, Math.round(size.width * scale)),
          height: Math.max(1, Math.round(size.height * scale)),
        });
      }
    }
    return image.toPNG().toString('base64');
  });
}

module.exports = { registerCaptureHandlers };
