/**
 * Fusion system panel — WebSocket message handlers
 *
 * One job: handle fusion:* WebSocket messages.
 * Returns a handler map keyed by message type.
 */

const fusionQueries = require('./queries');

/**
 * @param {Object} deps
 * @param {Function} deps.getDb - Returns Knex instance
 * @param {Map} deps.sessions - WebSocket → session state map
 * @param {(ws?: import('ws').WebSocket) => string|null} deps.getProjectRoot - Returns active workspace project root, or null in empty state
 * @returns {Object<string, Function>} Message type → async handler
 */
module.exports = function createFusionHandlers({ getDb, sessions, getProjectRoot }) {

  return {
    'fusion:tabs': async (ws) => {
      try {
        const tabs = await fusionQueries.getTabs(getDb());
        ws.send(JSON.stringify({ type: 'fusion:tabs', tabs }));
      } catch (err) {
        console.error('[Fusion] tabs error:', err.message);
        ws.send(JSON.stringify({ type: 'fusion:tabs', tabs: [], error: err.message }));
      }
    },

    'fusion:tab-items': async (ws, msg) => {
      try {
        const items = await fusionQueries.getTabItems(getDb(), msg.tab);
        ws.send(JSON.stringify({ type: 'fusion:items', tab: msg.tab, items }));
      } catch (err) {
        console.error('[Fusion] tab-items error:', err.message);
        ws.send(JSON.stringify({ type: 'fusion:items', tab: msg.tab, items: [], error: err.message }));
      }
    },

    'fusion:wiki-sections': async (ws, msg) => {
      try {
        const sections = await fusionQueries.getWikiSections(getDb(), msg.tab);
        ws.send(JSON.stringify({ type: 'fusion:wiki-sections', tab: msg.tab, sections }));
      } catch (err) {
        console.error('[Fusion] wiki-sections error:', err.message);
        ws.send(JSON.stringify({ type: 'fusion:wiki-sections', tab: msg.tab, sections: [], error: err.message }));
      }
    },

    'fusion:wiki-page': async (ws, msg) => {
      try {
        const page = await fusionQueries.getWikiPage(getDb(), msg.slug);
        // Coerce Buffer columns to UTF-8 strings. SQLite BLOB columns come back
        // as Node Buffers via Knex, which serialize to {type:"Buffer",data:[...]}
        // over JSON and crash marked.parse on the client.
        if (page && Buffer.isBuffer(page.content)) page.content = page.content.toString('utf8');
        if (page && Buffer.isBuffer(page.context)) page.context = page.context.toString('utf8');
        ws.send(JSON.stringify({ type: 'fusion:wiki', ...page }));
      } catch (err) {
        console.error('[Fusion] wiki-page error:', err.message);
        ws.send(JSON.stringify({ type: 'fusion:wiki', error: err.message }));
      }
    },

    'fusion:context': async (ws, msg) => {
      // Update Fusion's awareness of what the user is looking at.
      // No DB query — just tracks state for context injection into Fusion's wire.
      const sess = sessions.get(ws);
      if (sess) {
        sess.fusionContext = { tab: msg.tab, item: msg.item };
      }
    },
  };
};
