/**
 * Screenshot HTTP router.
 *
 * Serves workspace screenshots as PNG images.
 * Mounted at /api/screenshot in server.js.
 */

const express = require('express');
const screenshotService = require('../workspace/screenshot-service');

function createRouter() {
  const router = express.Router();

  router.get('/:workspaceId', async (req, res) => {
    const row = await screenshotService.get(req.params.workspaceId);
    if (!row || !row.screenshot_png) {
      return res.status(404).end();
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=60');
    res.send(row.screenshot_png);
  });

  return router;
}

module.exports = { createRouter };
