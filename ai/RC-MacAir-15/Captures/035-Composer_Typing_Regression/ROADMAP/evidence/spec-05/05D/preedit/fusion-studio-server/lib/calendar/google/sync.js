const client = require('./client');
const convert = require('./convert');
const dbWriter = require('../db-writer');
const bus = require('../../event-bus');

const WINDOW_DAYS = 90;

async function run() {
  const now = Math.floor(Date.now() / 1000);
  const start = now - WINDOW_DAYS * 86400;
  const end = now + WINDOW_DAYS * 86400;

  const [rawCalendars, rawEvents] = await Promise.all([
    client.post('getCalendars'),
    client.post('getEvents', { start, end }),
  ]);

  if (!rawCalendars || !rawEvents) return; // not configured or call failed

  const calendars = rawCalendars.map(convert.calendar);
  const events = rawEvents.map(convert.event);

  await dbWriter.upsertCalendars(calendars);
  await dbWriter.upsertEvents(events);

  bus.emit('calendar:sync_complete', {
    source: 'google',
    calendarCount: calendars.length,
    eventCount: events.length,
  });
}

module.exports = { run };
