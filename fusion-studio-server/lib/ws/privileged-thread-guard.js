'use strict';

const THREAD_MUTATION_DENIED = Object.freeze({
  type: 'error',
  code: 'THREAD_MUTATION_DENIED',
  message: 'Thread mutation denied',
});

const THREAD_FORK_UNAVAILABLE = Object.freeze({
  type: 'error',
  code: 'THREAD_FORK_UNAVAILABLE',
  message: 'Thread fork is unavailable',
});

function hasTrustedThreadAuthority(session) {
  if (!session || typeof session !== 'object') return false;
  const role = Object.getOwnPropertyDescriptor(session, 'connectionRole');
  return Boolean(role && role.enumerable === false && role.value === 'trusted-shell');
}

function sendBoundedError(ws, error) {
  try { ws.send(JSON.stringify(error)); } catch (_error) {}
  return false;
}

function denyThreadMutation(ws) {
  return sendBoundedError(ws, THREAD_MUTATION_DENIED);
}

function requireTrustedThreadAuthority(ws, session) {
  return hasTrustedThreadAuthority(session)
    ? true
    : denyThreadMutation(ws);
}

function denyThreadFork(ws) {
  return sendBoundedError(ws, THREAD_FORK_UNAVAILABLE);
}

module.exports = {
  THREAD_FORK_UNAVAILABLE,
  THREAD_MUTATION_DENIED,
  denyThreadMutation,
  denyThreadFork,
  hasTrustedThreadAuthority,
  requireTrustedThreadAuthority,
};
