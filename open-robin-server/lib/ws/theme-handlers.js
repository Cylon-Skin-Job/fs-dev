/**
 * @module theme-handlers
 * @role Thin WS adapter — maps theme:* client messages to themes-service calls.
 *
 * After every mutation, broadcasts theme:state to all connected clients.
 * On error, sends theme:error to the requesting socket only.
 *
 * See THEME_PICKER_SPEC.md §5b.
 */

const themesService = require('../theme/themes-service');

/**
 * @param {object} deps
 * @param {() => import('ws').WebSocket[]} deps.getAllClients
 * @param {() => string|null} deps.getProjectRoot
 * @returns {Record<string, Function>} handler map keyed by message type
 */
function createThemeHandlers({ getAllClients, getProjectRoot }) {

  function broadcast(themes) {
    const active = themes.find(t => t.active);
    const payload = JSON.stringify({
      type:     'theme:state',
      themes,
      activeId: active ? active.id : null,
    });
    for (const ws of getAllClients()) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  function sendError(ws, message) {
    ws.send(JSON.stringify({ type: 'theme:error', message }));
  }

  function root() {
    return getProjectRoot();
  }

  return {
    'theme:list': async (ws) => {
      try {
        const projectRoot = root();
        if (!projectRoot) { sendError(ws, 'No active workspace'); return; }
        const themes  = await themesService.list(projectRoot);
        const active  = themes.find(t => t.active);
        ws.send(JSON.stringify({
          type:     'theme:state',
          themes,
          activeId: active ? active.id : null,
        }));
      } catch (err) {
        sendError(ws, err.message);
      }
    },

    'theme:activate': async (ws, msg) => {
      try {
        const projectRoot = root();
        if (!projectRoot) { sendError(ws, 'No active workspace'); return; }
        const themes = await themesService.activate(projectRoot, msg.id);
        broadcast(themes);
      } catch (err) {
        sendError(ws, err.message);
      }
    },

    'theme:save': async (ws, msg) => {
      try {
        const projectRoot = root();
        if (!projectRoot) { sendError(ws, 'No active workspace'); return; }
        const themes = await themesService.save(projectRoot, msg.theme);
        broadcast(themes);
      } catch (err) {
        sendError(ws, err.message);
      }
    },

    'theme:delete': async (ws, msg) => {
      try {
        const projectRoot = root();
        if (!projectRoot) { sendError(ws, 'No active workspace'); return; }
        const themes = await themesService.deleteTheme(projectRoot, msg.id);
        broadcast(themes);
      } catch (err) {
        sendError(ws, err.message);
      }
    },
  };
}

module.exports = createThemeHandlers;
