/**
 * @module secrets
 * @role Aggregator over secrets sub-modules. v1 has only API Keys; future
 *       sub-modules (e.g. SSH keys, OAuth tokens) append to the handler map
 *       returned by createHandlers().
 *
 * Mirrors the factory-returning-handler-map convention used by
 * lib/ws/theme-handlers.js and lib/robin/ws-handlers.js so server.js can
 * register `secrets:*` messages with the same getter-closure pattern as the
 * existing feature modules.
 *
 * See SECRETS_MANAGER_SPEC.md §6, §8a.
 */

const createApiKeysHandlers = require('./api-keys/handlers');

/**
 * @param {object} deps
 * @param {() => import('ws').WebSocket[]} deps.getAllClients
 * @returns {Record<string, Function>} merged handler map for all secrets:* messages
 */
function createHandlers(deps) {
  return {
    ...createApiKeysHandlers(deps),
  };
}

module.exports = { createHandlers };
