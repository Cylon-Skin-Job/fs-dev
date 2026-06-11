/**
 * External CLI harnesses HTTP routes (Phase 3).
 *
 * Harness list with cached status, plus per-harness status lookup.
 * Mounted at /api/harnesses in server.js.
 */

const express = require('express');

function createRouter() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const service = require('../harness/harness-status-service');
    try {
      const harnesses = await service.getAll();
      res.json(harnesses);
      // Fire-and-forget revalidation so repeated hits stay sub-ms while
      // the cache converges on real state. Debounced internally.
      service.revalidateAll().catch(() => {});
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id/status', async (req, res) => {
    const { registry } = require('../harness');
    try {
      const status = await registry.getHarnessStatus(req.params.id);
      if (!status) {
        return res.status(404).json({ error: 'Harness not found' });
      }
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createRouter };
