const fs = require('fs');
const path = require('path');
const { getWorkspaceRoot } = require('../protocol-handler.cjs');

function getScreenshotsDir() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return null;
  const machineRoot = getMachineAiRoot(workspaceRoot);
  if (!machineRoot) return null;
  return path.join(machineRoot, 'Data', 'Screenshots');
}

function getMachineAiRoot(workspaceRoot) {
  const aiRoot = path.join(workspaceRoot, 'ai');
  const envName = process.env.FUSION_LOCAL_MACHINE;
  if (envName) {
    const candidate = path.join(aiRoot, sanitizeMachineName(envName));
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    const entries = fs.readdirSync(aiRoot, { withFileTypes: true });
    const match = entries.find((entry) => {
      if (!entry.isDirectory() || entry.name.startsWith('.')) return false;
      return fs.existsSync(path.join(aiRoot, entry.name, 'System'));
    });
    return match ? path.join(aiRoot, match.name) : null;
  } catch {
    return null;
  }
}

function sanitizeMachineName(value) {
  const sanitized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'local-machine';
}

function registerScreenshotHandlers(ipcMain) {
  ipcMain.handle('screenshots:list', async () => {
    const screenshotsDir = getScreenshotsDir();
    if (!screenshotsDir) return [];

    try {
      const entries = await fs.promises.readdir(screenshotsDir, { withFileTypes: true });
      return entries
        .filter(e => e.isFile() && /\.(png|jpg|jpeg|gif|webp)$/i.test(e.name))
        .map(e => ({
          name: e.name,
          path: path.join(screenshotsDir, e.name),
        }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('screenshots:read', async (_event, filename) => {
    const screenshotsDir = getScreenshotsDir();
    if (!screenshotsDir) {
      throw new Error('No active workspace');
    }

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
