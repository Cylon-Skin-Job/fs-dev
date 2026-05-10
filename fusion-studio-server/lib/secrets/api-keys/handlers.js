/**
 * @module secrets/api-keys/handlers
 * @role Thin WS adapter — maps secrets:api-keys:* client messages to backend
 *       calls, emits UEB events on mutation, and broadcasts state to all
 *       connected clients.
 *
 * On error: ApiKeysBackendError → secrets:api-keys:error to the requesting
 * socket only; other errors bubble (real bugs surface).
 *
 * See SECRETS_MANAGER_SPEC.md §6, §7g, §8a, §11b.
 */

const backend = require('./backend');
const { emit } = require('../../event-bus');

/**
 * @param {object} deps
 * @param {() => import('ws').WebSocket[]} deps.getAllClients
 * @returns {Record<string, Function>} handler map keyed by message type
 */
function createApiKeysHandlers({ getAllClients }) {

  function broadcast(items) {
    const payload = JSON.stringify({ type: 'secrets:api-keys:state', items });
    for (const ws of getAllClients()) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  function sendError(ws, name, code, message) {
    ws.send(JSON.stringify({ type: 'secrets:api-keys:error', name, code, message }));
  }

  function publicFields(row) {
    return {
      kind:        'api-key',
      name:        row.name,
      description: row.description,
      expires_at:  row.expires_at,
      fingerprint: row.fingerprint,
    };
  }

  return {
    'secrets:api-keys:list': async (ws) => {
      try {
        const items = await backend.list();
        ws.send(JSON.stringify({ type: 'secrets:api-keys:state', items }));
      } catch (err) {
        if (err instanceof backend.ApiKeysBackendError) {
          sendError(ws, null, err.code, err.message);
          return;
        }
        throw err;
      }
    },

    'secrets:api-keys:set': async (ws, msg) => {
      try {
        const existing = (await backend.list()).find(r => r.name === msg.name);
        if (existing) {
          const { row, changed_fields } = await backend.update(msg.name, {
            value:       msg.value,
            description: msg.description,
            expires_at:  msg.expires_at,
          });
          emit('secret:updated', { ...publicFields(row), changed_fields });
        } else {
          const row = await backend.add({
            name:        msg.name,
            value:       msg.value,
            description: msg.description,
            expires_at:  msg.expires_at,
          });
          emit('secret:added', publicFields(row));
        }
        broadcast(await backend.list());
      } catch (err) {
        if (err instanceof backend.ApiKeysBackendError) {
          sendError(ws, msg.name, err.code, err.message);
          return;
        }
        throw err;
      }
    },

    'secrets:api-keys:delete': async (ws, msg) => {
      try {
        await backend.remove(msg.name);
        emit('secret:deleted', { kind: 'api-key', name: msg.name });
        broadcast(await backend.list());
      } catch (err) {
        if (err instanceof backend.ApiKeysBackendError) {
          sendError(ws, msg.name, err.code, err.message);
          return;
        }
        throw err;
      }
    },
  };
}

module.exports = createApiKeysHandlers;
