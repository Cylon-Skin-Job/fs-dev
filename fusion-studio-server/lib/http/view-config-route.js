/**
 * View config HTTP route.
 *
 * Returns global + per-view theme CSS and the resolved layout state
 * for a panel. Mounted at /api/view-config in server.js.
 */

const express = require('express');
const path = require('path');
const fsPromises = require('fs').promises;

/**
 * @param {object} deps
 * @param {(ws?: import('ws').WebSocket) => string|null} deps.getProjectRoot
 */
function createRouter({ getProjectRoot }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const projectRoot = getProjectRoot();
      const viewName = req.query.panel;
      if (!viewName) {
        return res.status(400).json({ error: 'Missing panel query param' });
      }
      if (!projectRoot) {
        return res.status(503).json({ error: 'No active workspace' });
      }

      let globalCss = '';
      try {
        const globalCssPath = path.join(projectRoot, 'ai', 'system', 'styles', 'themes.css');
        globalCss = await fsPromises.readFile(globalCssPath, 'utf8');
      } catch {
        globalCss = '';
      }

      let viewCss = '';
      try {
        const viewCssPath = path.join(projectRoot, 'ai', 'views', viewName, 'settings', 'themes.css');
        viewCss = await fsPromises.readFile(viewCssPath, 'utf8');
      } catch {
        viewCss = '';
      }

      const viewStateService = require('../view-state');
      const layout = await viewStateService.resolveViewState(projectRoot, viewName);

      res.json({ globalCss, viewCss, layout });
    } catch (err) {
      console.error('[ViewConfig] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createRouter };
