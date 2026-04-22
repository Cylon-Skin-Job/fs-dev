/**
 * Harness Broadcaster — bus → WebSocket fan-out for harness install
 * status changes. One subscription, one wire message. Follows the same
 * shape as workspace-broadcaster (subscribe on startup, stateless).
 *
 * Emits: `harness:status_changed` per spec §5c.
 */

const { on } = require('../event-bus');

/**
 * @param {object} deps
 * @param {() => import('ws').WebSocket[]} deps.getAllClients
 */
function createHarnessBroadcaster({ getAllClients }) {
  function broadcastAll(wireMessage) {
    const payload = JSON.stringify(wireMessage);
    for (const ws of getAllClients()) {
      if (ws.readyState !== 1) continue;
      ws.send(payload);
    }
  }

  on('harness:status_changed', (event) => {
    broadcastAll({
      type: 'harness:status_changed',
      id: event.id,
      installed: !!event.installed,
      version: event.version ?? null,
      binary_path: event.binary_path ?? null,
      error: event.error ?? null,
    });
  });

  console.log('[HarnessBroadcaster] Started');
  return { started: true };
}

module.exports = { createHarnessBroadcaster };
