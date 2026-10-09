/**
 * @module harness-ws-handlers
 * @role Per-connection handlers for harness: WebSocket admin messages.
 *
 * Factory — call once per connection inside createClientMessageRouter.
 * Returns a handler map keyed by message type.
 *
 * Inline requires are preserved intentionally (per SPEC-01f Gotcha #3):
 * harness admin commands are rare; lazy-loading the harness modules
 * avoids loading the full harness management stack at startup.
 */

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @returns {Record<string, (msg: object) => Promise<void>>}
 */
function createHarnessWsHandlers({ ws }) {
  return {
    'harness:get_mode'(clientMsg) {
      const { getModeStatus } = require('../harness/compat');
      const { getHarnessMode } = require('../harness/feature-flags');
      ws.send(JSON.stringify({
        type: 'harness:mode_status',
        threadId: clientMsg.threadId,
        data: getModeStatus(clientMsg.threadId),
        mode: getHarnessMode(clientMsg.threadId),
      }));
    },

    'harness:set_mode'(clientMsg) {
      const { setThreadMode } = require('../harness/feature-flags');
      try {
        setThreadMode(clientMsg.threadId, clientMsg.mode);
        ws.send(JSON.stringify({
          type: 'harness:mode_changed',
          threadId: clientMsg.threadId,
          mode: clientMsg.mode,
        }));
        console.log(`[Harness] Mode changed for thread ${clientMsg.threadId?.slice(0, 8)}... to ${clientMsg.mode}`);
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'harness:mode_error',
          threadId: clientMsg.threadId,
          error: err.message,
        }));
      }
    },

    'harness:rollback'(_clientMsg) {
      ws.send(JSON.stringify({
        type: 'harness:mode_error',
        message: 'Legacy runtime rollback has been retired. Use git checkpoint if you need to revert.',
      }));
      console.log('[Harness] Rollback requested but legacy mode has been retired');
    },

    async 'harness:list'(_clientMsg) {
      const { registry } = require('../harness');
      try {
        const harnesses = await registry.getAvailableHarnesses();
        ws.send(JSON.stringify({
          type: 'harness:list_result',
          harnesses,
        }));
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'harness:list_error',
          error: err.message,
        }));
      }
    },

    async 'harness:check_install'(clientMsg) {
      const { registry } = require('../harness');
      try {
        const status = await registry.getHarnessStatus(clientMsg.harnessId);
        ws.send(JSON.stringify({
          type: 'harness:install_status',
          harnessId: clientMsg.harnessId,
          status,
        }));
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'harness:check_error',
          harnessId: clientMsg.harnessId,
          error: err.message,
        }));
      }
    },
  };
}

module.exports = { createHarnessWsHandlers };
