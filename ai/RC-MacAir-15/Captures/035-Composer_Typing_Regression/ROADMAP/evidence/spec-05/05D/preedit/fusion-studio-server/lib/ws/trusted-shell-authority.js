'use strict';

const VIEW_MUTATION_DENIED = Object.freeze({
  type: 'error',
  code: 'VIEW_MUTATION_DENIED',
  message: 'View mutation denied',
});

function hasTrustedShellAuthority(session) {
  if (!session || typeof session !== 'object') return false;
  const role = Object.getOwnPropertyDescriptor(session, 'connectionRole');
  return Boolean(role && role.enumerable === false && role.value === 'trusted-shell');
}

function denyViewMutation(ws) {
  try { ws.send(JSON.stringify(VIEW_MUTATION_DENIED)); } catch (_error) {}
  return false;
}

function requireTrustedViewAuthority(ws, session) {
  return hasTrustedShellAuthority(session) ? true : denyViewMutation(ws);
}

module.exports = {
  VIEW_MUTATION_DENIED,
  denyViewMutation,
  hasTrustedShellAuthority,
  requireTrustedViewAuthority,
};
