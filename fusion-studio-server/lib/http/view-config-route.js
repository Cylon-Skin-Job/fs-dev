/**
 * View config HTTP route.
 *
 * Returns global + per-view theme CSS and the resolved layout state
 * for a panel. Mounted at /api/view-config in server.js.
 */

const express = require('express');
const path = require('path');
const fsPromises = require('fs').promises;
const aiPaths = require('../workspace/ai-paths');
const views = require('../views');
const viewReadiness = require('../views/readiness-runtime');

/**
 * @param {object} deps
 * @param {(ws?: import('ws').WebSocket) => string|null} deps.getProjectRoot
 * @param {() => string|null} deps.getWorkspaceId
 */
function createRouter({ getProjectRoot, getWorkspaceId = () => null }) {
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
      const workspaceId = getWorkspaceId();
      if (!workspaceId) {
        return res.status(503).json({ error: 'view_registry_unavailable' });
      }
      const readinessContext = { workspaceId, projectRoot };
      await viewReadiness.ensureWorkspaceViewReadiness(readinessContext);
      const lease = viewReadiness.acquireViewReadinessLease(readinessContext);

      try {
        let globalCss = '';
        try {
          const globalCssPath = path.join(aiPaths.getSystemStylesRoot(projectRoot), 'themes.css');
          globalCss = await fsPromises.readFile(globalCssPath, 'utf8');
        } catch {
          globalCss = '';
        }

        let viewCss = '';
        try {
          const viewRoot = views.resolveViewRoot(projectRoot, viewName, { includeHidden: true });
          const viewCssPath = viewRoot ? path.join(viewRoot, 'styles', 'themes.css') : null;
          if (!viewCssPath) throw new Error('View not found');
          viewCss = await fsPromises.readFile(viewCssPath, 'utf8');
        } catch {
          viewCss = '';
        }

        const viewStateService = require('../view-state');
        const layout = await viewStateService.resolveViewState(projectRoot, viewName);

        res.json({ globalCss, viewCss, layout });
      } finally {
        lease.release();
      }
    } catch (err) {
      console.error('[ViewConfig] Error:', err.message);
      if (err?.code === 'view_registry_unavailable' || err?.name === 'ViewRelocationError') {
        res.status(503).json({ error: 'view_registry_unavailable' });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  return router;
}

module.exports = { createRouter };
