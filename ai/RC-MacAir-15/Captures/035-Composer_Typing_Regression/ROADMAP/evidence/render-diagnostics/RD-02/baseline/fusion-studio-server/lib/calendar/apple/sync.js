const reader = require('./reader');
const convert = require('./convert');
const dbWriter = require('../db-writer');
const bus = require('../../event-bus');

const WINDOW_DAYS = 90;
const APPLE_EPOCH_OFFSET = 978307200;

async function run() {
  const now = Math.floor(Date.now() / 1000);
  const startApple = (now - WINDOW_DAYS * 86400) - APPLE_EPOCH_OFFSET;
  const endApple = (now + WINDOW_DAYS * 86400) - APPLE_EPOCH_OFFSET;

  const rawCalendars = reader.readCalendars();
  const rawEvents = reader.readEvents(startApple, endApple);

  if (rawCalendars === null || rawEvents === null) return; // SQLITE_BUSY, try next fire

  const calendars = rawCalendars.map(convert.calendar);
  const events = rawEvents.map(convert.event);

  await dbWriter.upsertCalendars(calendars);
  await dbWriter.upsertEvents(events);

  bus.emit('calendar:sync_complete', {
    source: 'apple',
    calendarCount: calendars.length,
    eventCount: events.length,
  });
}

module.exports = { run };
