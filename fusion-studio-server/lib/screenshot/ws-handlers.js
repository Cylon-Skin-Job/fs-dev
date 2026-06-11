/**
 * Screenshot WebSocket handlers.
 *
 * Handles client messages for capturing and retrieving screenshots.
 * Returns a map keyed by message type for delegation from client-message-router.
 */

const screenshotService = require('../workspace/screenshot-service');
const stateCache = require('../workspace/state-cache');

function createScreenshotHandlers({ getAllClients }) {
  return {
    'screenshot:capture': async (ws, msg) => {
      const { workspaceId, dataUrl, panelId } = msg;
      if (!workspaceId || typeof dataUrl !== 'string') {
        ws.send(JSON.stringify({
          type: 'screenshot:error',
          message: 'screenshot:capture requires workspaceId and dataUrl',
        }));
        return;
      }

      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      await screenshotService.save(workspaceId, buffer, panelId || null);

      ws.send(JSON.stringify({
        type: 'screenshot:updated',
        workspaceId,
        panelId: panelId || null,
        capturedAt: Date.now(),
      }));
    },

    'screenshot:request': async (ws, msg) => {
      const { workspaceId } = msg;
      if (!workspaceId) {
        ws.send(JSON.stringify({
          type: 'screenshot:error',
          message: 'screenshot:request requires workspaceId',
        }));
        return;
      }

      const row = await screenshotService.get(workspaceId);
      const cached = stateCache.get(workspaceId);
      if (!row || !row.screenshot_png) {
        ws.send(JSON.stringify({
          type: 'screenshot:missing',
          workspaceId,
          activePanelId: cached ? cached.currentPanel : null,
        }));
        return;
      }

      const dataUrl = `data:image/png;base64,${row.screenshot_png.toString('base64')}`;
      ws.send(JSON.stringify({
        type: 'screenshot:data',
        workspaceId,
        panelId: row.panel_id,
        activePanelId: cached?.currentPanel || row.panel_id || null,
        dataUrl,
        capturedAt: row.captured_at,
      }));
    },

    'screenshot:list': async (ws, _msg) => {
      const rows = await screenshotService.list();
      const cachedStates = stateCache.loadAll();
      ws.send(JSON.stringify({
        type: 'screenshot:list',
        screenshots: rows.map((r) => ({
          workspaceId: r.workspace_id,
          panelId: r.panel_id,
          activePanelId: cachedStates[r.workspace_id]?.currentPanel || r.panel_id || null,
          capturedAt: r.captured_at,
        })),
        activePanels: Object.entries(cachedStates).map(([workspaceId, state]) => ({
          workspaceId,
          activePanelId: state.currentPanel || null,
        })),
      }));
    },
  };
}

module.exports = createScreenshotHandlers;
