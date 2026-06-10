/**
 * Emoji recents — WebSocket handler map.
 *
 * One job: map emoji_recents:* messages to SQLite table calls.
 */

'use strict';

const indexTable = require('./index-table');

function createEmojiRecentsHandlers() {
  function sendError(ws, message) {
    ws.send(JSON.stringify({ type: 'emoji_recents:error', error: message }));
  }

  return {
    'emoji_recents:list': async (ws, msg) => {
      try {
        const limit = Number.isInteger(msg.limit) ? msg.limit : indexTable.EMOJI_RECENTS_CAP;
        const { items, total } = await indexTable.list(limit);
        ws.send(JSON.stringify({ type: 'emoji_recents:list', items, total }));
      } catch (err) {
        console.error('[EmojiRecents] list error:', err.message);
        sendError(ws, err.message);
      }
    },

    'emoji_recents:record': async (ws, msg) => {
      try {
        const emoji = msg.emoji;
        if (typeof emoji !== 'string' || emoji.length === 0) {
          sendError(ws, 'emoji is required');
          return;
        }
        const item = await indexTable.record(emoji, Date.now());
        ws.send(JSON.stringify({ type: 'emoji_recents:record', item }));
      } catch (err) {
        console.error('[EmojiRecents] record error:', err.message);
        sendError(ws, err.message);
      }
    },
  };
}

module.exports = createEmojiRecentsHandlers;
