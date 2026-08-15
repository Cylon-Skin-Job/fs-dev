/**
 * Panel file HTTP route.
 *
 * Serves panel files (images, etc.) with fuzzy filename matching to
 * handle macOS Unicode spaces in screenshot names.
 * Mounted at /api/panel-file in server.js.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const ALLOWED_DOT_DIRECTORIES = new Set(['.thumbnails']);

function dotSegments(filePath) {
  return filePath
    .split(/[\\/]+/)
    .filter(segment => segment.startsWith('.') && segment !== '.' && segment !== '..');
}

function canServeHiddenPath(filePath) {
  const hiddenSegments = dotSegments(filePath);
  return hiddenSegments.length === 0 || hiddenSegments.every(segment => ALLOWED_DOT_DIRECTORIES.has(segment));
}

function sendPanelFile(res, absolutePath, requestPath) {
  if (!canServeHiddenPath(requestPath)) {
    return res.status(404).send('Not found');
  }

  res.set('Cache-Control', 'no-cache');
  const options = dotSegments(requestPath).length > 0 ? { dotfiles: 'allow' } : undefined;
  return res.sendFile(absolutePath, options);
}

/**
 * @param {object} deps
 * @param {(ws?: import('ws').WebSocket) => string|null} deps.getProjectRoot
 * @param {(panel: string, ws?: import('ws').WebSocket) => string|null} deps.getPanelPath
 */
function createRouter({ getProjectRoot, getPanelPath }) {
  const router = express.Router();

  router.get('/:panel/*splat', (req, res) => {
    const panel = req.params.panel;
    // Express 5: *splat is an array of path segments; Express 4 used a string.
    const splat = req.params.splat;
    const filePath = Array.isArray(splat) ? splat.join('/') : String(splat ?? '');
    const root = getProjectRoot();
    if (!root) return res.status(503).send('No active workspace');
    // Resolve via the same view resolver the file-tree WS handler uses, so
    // views point at their V2 content root rather than their view capsule.
    const panelPath = getPanelPath(panel);
    if (!panelPath) return res.status(404).send('Not found');
    const baseDir = panelPath;
    const dirPath = path.join(baseDir, path.dirname(filePath));
    const fileName = path.basename(filePath);

    try {
      const realDir = fs.realpathSync(dirPath);
      // Try direct match first
      const directPath = path.join(realDir, fileName);
      if (fs.existsSync(directPath)) {
        return sendPanelFile(res, directPath, filePath);
      }

      // Fuzzy match: normalize Unicode spaces for macOS screenshot filenames
      const entries = fs.readdirSync(realDir);
      const normalizedTarget = fileName.replace(/[\s\u00a0\u202f\u2009]/g, " ");
      const match = entries.find(e => e.replace(/[\s\u00a0\u202f\u2009]/g, " ") === normalizedTarget);

      if (match) {
        return sendPanelFile(res, path.join(realDir, match), filePath);
      }

      res.status(404).send('Not found');
    } catch {
      res.status(404).send('Not found');
    }
  });

  return router;
}

module.exports = {
  createRouter,
  __test__: {
    canServeHiddenPath,
    sendPanelFile,
  },
};
