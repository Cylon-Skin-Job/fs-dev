/**
 * Recent docs — WebSocket handler map.
 *
 * One job: map recent_docs:* messages to index-table calls, broadcast
 * updated state to all connected clients.
 *
 * Follows the clipboard handlers pattern (lib/secrets/clipboard/handlers.js).
 */

'use strict';

const indexTable = require('./index-table');

function createRecentDocsHandlers({ getAllClients }) {
  function broadcast(type, workspaceId, items, total) {
    const payload = JSON.stringify({
      type,
      workspaceId,
      items,
      total,
    });
    for (const ws of getAllClients()) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  function sendError(ws, workspaceId, message) {
    ws.send(JSON.stringify({
      type: 'recent_docs:error',
      workspaceId,
      error: message,
    }));
  }

  async function broadcastList(workspaceId) {
    const { items, total } = await indexTable.list(workspaceId);
    broadcast('recent_docs:updated', workspaceId, items, total);
  }

  return {
    'recent_docs:list': async (ws, msg) => {
      try {
        const workspaceId = msg.workspaceId;
        if (!workspaceId) {
          sendError(ws, msg.workspaceId, 'workspaceId is required');
          return;
        }
        const limit = Number.isInteger(msg.limit) ? msg.limit : 20;
        const { items, total } = await indexTable.list(workspaceId, limit);
        ws.send(JSON.stringify({
          type: 'recent_docs:list',
          workspaceId,
          items,
          total,
        }));
      } catch (err) {
        console.error('[RecentDocs] list error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },

    'recent_docs:record': async (ws, msg) => {
      try {
        const { workspaceId, path, folder, name, panel } = msg;
        if (!workspaceId || !path || !folder || !name || !panel) {
          sendError(ws, workspaceId, 'Missing required fields');
          return;
        }
        await indexTable.record(workspaceId, path, folder, name, panel, Date.now());
        await broadcastList(workspaceId);
      } catch (err) {
        console.error('[RecentDocs] record error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },

    'recent_docs:clear': async (ws, msg) => {
      try {
        const workspaceId = msg.workspaceId;
        if (!workspaceId) {
          sendError(ws, msg.workspaceId, 'workspaceId is required');
          return;
        }
        await indexTable.clear(workspaceId);
        broadcast('recent_docs:cleared', workspaceId, [], 0);
      } catch (err) {
        console.error('[RecentDocs] clear error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },
  };
}

module.exports = createRecentDocsHandlers;
