/**
 * Bookmarks — WebSocket handler map.
 *
 * One job: map bookmarks:* messages to index-table calls, broadcast
 * updated state to all connected clients.
 *
 * Follows the recent-docs handlers pattern (lib/recent-docs/handlers.js).
 */

'use strict';

const indexTable = require('./index-table');

function createBookmarksHandlers({ getAllClients }) {
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
      type: 'bookmarks:error',
      workspaceId,
      error: message,
    }));
  }

  async function broadcastList(workspaceId) {
    const { items, total } = await indexTable.list(workspaceId);
    broadcast('bookmarks:updated', workspaceId, items, total);
  }

  return {
    'bookmarks:list': async (ws, msg) => {
      try {
        const workspaceId = msg.workspaceId;
        if (!workspaceId) {
          sendError(ws, msg.workspaceId, 'workspaceId is required');
          return;
        }
        const limit = Number.isInteger(msg.limit) ? msg.limit : 100;
        const { items, total } = await indexTable.list(workspaceId, limit);
        ws.send(JSON.stringify({
          type: 'bookmarks:list',
          workspaceId,
          items,
          total,
        }));
      } catch (err) {
        console.error('[Bookmarks] list error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },

    'bookmarks:add': async (ws, msg) => {
      try {
        const { workspaceId, url, title, folder } = msg;
        if (!workspaceId || !url) {
          sendError(ws, workspaceId, 'workspaceId and url are required');
          return;
        }
        await indexTable.add(workspaceId, url, title ?? '', folder || '');
        await broadcastList(workspaceId);
      } catch (err) {
        console.error('[Bookmarks] add error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },

    'bookmarks:remove': async (ws, msg) => {
      try {
        const { workspaceId, id } = msg;
        if (!workspaceId || !id) {
          sendError(ws, workspaceId, 'workspaceId and id are required');
          return;
        }
        await indexTable.remove(workspaceId, id);
        await broadcastList(workspaceId);
      } catch (err) {
        console.error('[Bookmarks] remove error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },

    'bookmarks:update': async (ws, msg) => {
      try {
        const { workspaceId, id, title, folder } = msg;
        if (!workspaceId || !id) {
          sendError(ws, workspaceId, 'workspaceId and id are required');
          return;
        }
        await indexTable.update(workspaceId, id, { title, folder });
        await broadcastList(workspaceId);
      } catch (err) {
        console.error('[Bookmarks] update error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },
  };
}

module.exports = createBookmarksHandlers;
