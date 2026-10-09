/**
 * Calendar HTTP routes.
 *
 * Calendar source list and event range queries against the DB.
 * Mounted at /api/calendar in server.js.
 */

const express = require('express');

function createRouter() {
  const router = express.Router();

  router.get('/calendars', async (req, res) => {
    try {
      const knex = require('../db').getDb();
      const rows = await knex('calendar_sources').orderBy('title');
      res.json(rows);
    } catch (err) {
      console.error('[Calendar API] /calendars error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/events', async (req, res) => {
    try {
      const knex = require('../db').getDb();
      const { start, end, source } = req.query;
      let q = knex('calendar_events')
        .where('startDate', '<', Number(end))
        .andWhere('endDate', '>', Number(start))
        .orderBy('startDate');
      if (source) q = q.andWhere('source', source);
      const rows = await q;
      res.json(rows);
    } catch (err) {
      console.error('[Calendar API] /events error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createRouter };
