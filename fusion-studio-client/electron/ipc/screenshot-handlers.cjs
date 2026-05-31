const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '..', '..', 'System Source Files', 'Screenshots');

function registerScreenshotHandlers(ipcMain) {
  ipcMain.handle('screenshots:list', async () => {
    try {
      const entries = await fs.promises.readdir(screenshotsDir, { withFileTypes: true });
      return entries
        .filter(e => e.isFile() && /\.(png|jpg|jpeg|gif|webp)$/i.test(e.name))
        .map(e => e.name);
    } catch {
      return [];
    }
  });

  ipcMain.handle('screenshots:read', async (_event, filename) => {
    const filePath = path.join(screenshotsDir, filename);
    const resolvedFile = path.resolve(filePath);
    const resolvedDir = path.resolve(screenshotsDir);
    if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
      throw new Error('Forbidden');
    }
    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType =
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.gif' ? 'image/gif' :
      ext === '.webp' ? 'image/webp' :
      'application/octet-stream';
    return { base64: buffer.toString('base64'), mimeType };
  });
}

module.exports = { registerScreenshotHandlers };
