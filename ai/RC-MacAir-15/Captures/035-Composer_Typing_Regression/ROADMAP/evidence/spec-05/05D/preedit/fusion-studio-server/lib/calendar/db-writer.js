const { getDb } = require('../db');

async function upsertCalendars(calendars) {
  const knex = getDb();
  for (const cal of calendars) {
    await knex('calendar_sources')
      .insert({ ...cal, updated_at: Date.now() })
      .onConflict('uuid').merge();
  }
}

async function upsertEvents(events) {
  const knex = getDb();
  for (const ev of events) {
    await knex('calendar_events')
      .insert({ ...ev, updated_at: Date.now() })
      .onConflict('uuid').merge();
  }
}

module.exports = { upsertCalendars, upsertEvents };
