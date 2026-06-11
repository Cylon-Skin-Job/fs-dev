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
    // tiled-rows views (doc-viewer / agents-viewer) correctly point at
    // ai/views/{panel}/content/ instead of the bare ai/views/{panel}/.
    const panelPath = getPanelPath(panel);
    const baseDir = panelPath || path.join(root, 'ai', 'views', panel);
    const dirPath = path.join(baseDir, path.dirname(filePath));
    const fileName = path.basename(filePath);

    try {
      const realDir = fs.realpathSync(dirPath);
      // Try direct match first
      const directPath = path.join(realDir, fileName);
      if (fs.existsSync(directPath)) {
        return res.sendFile(directPath);
      }

      // Fuzzy match: normalize Unicode spaces for macOS screenshot filenames
      const entries = fs.readdirSync(realDir);
      const normalizedTarget = fileName.replace(/[\s\u00a0\u202f\u2009]/g, " ");
      const match = entries.find(e => e.replace(/[\s\u00a0\u202f\u2009]/g, " ") === normalizedTarget);

      if (match) {
        return res.sendFile(path.join(realDir, match));
      }

      res.status(404).send('Not found');
    } catch {
      res.status(404).send('Not found');
    }
  });

  return router;
}

module.exports = { createRouter };
