/**
 * Calendar Broadcaster — bus → WebSocket fan-out for calendar sync events.
 * Template: lib/ws/workspace-broadcaster.js. Same shape — subscribe at startup,
 * broadcast to all clients, no state.
 */

const { on } = require('../event-bus');

function createCalendarBroadcaster({ getAllClients }) {
  function broadcastAll(wireMessage) {
    const payload = JSON.stringify(wireMessage);
    for (const ws of getAllClients()) {
      if (ws.readyState !== 1) continue;
      ws.send(payload);
    }
  }

  on('calendar:sync_complete', (event) => {
    broadcastAll({
      type: 'calendar:sync_complete',
      source: event.source,
      calendarCount: event.calendarCount,
      eventCount: event.eventCount,
    });
  });

  console.log('[CalendarBroadcaster] Started');
  return { started: true };
}

module.exports = { createCalendarBroadcaster };
