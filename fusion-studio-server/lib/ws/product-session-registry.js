'use strict';

const OPEN = 1;

function createProductSessionRegistry({ sessions }) {
  if (!(sessions instanceof Map)) {
    throw new TypeError('product sessions map is required');
  }

  function activate({ ws, session, managed }) {
    if (!ws || ws.readyState !== OPEN || !session || typeof session !== 'object') {
      throw new Error('product session activation failed');
    }
    if (sessions.has(ws) || session.workspaceBindingState !== 'active') {
      throw new Error('product session activation failed');
    }
    if (
      (managed === true && session.connectionRole !== 'trusted-shell')
      || (managed === false && session.connectionRole !== 'untrusted')
      || typeof managed !== 'boolean'
    ) {
      throw new Error('product session activation failed');
    }
    sessions.set(ws, session);
  }

  function getAllClients() {
    const clients = [];
    for (const [ws] of sessions) {
      if (ws.readyState === OPEN) clients.push(ws);
    }
    return clients;
  }

  function getClientByConnectionId(connectionId) {
    for (const [ws, session] of sessions) {
      if (session.connectionId === connectionId && ws.readyState === OPEN) return ws;
    }
    return null;
  }

  function getSessionForClient(ws) {
    return sessions.get(ws) || null;
  }

  return Object.freeze({
    activate,
    getAllClients,
    getClientByConnectionId,
    getSessionForClient,
  });
}

module.exports = { createProductSessionRegistry };
