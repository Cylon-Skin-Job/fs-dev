'use strict';

const {
  THREAD_FORK_UNAVAILABLE,
  THREAD_MUTATION_DENIED,
  denyThreadFork,
  hasTrustedThreadAuthority,
  requireTrustedThreadAuthority,
} = require('../../lib/ws/privileged-thread-guard');

function sessionWithPrivateRole(role) {
  const session = {};
  Object.defineProperty(session, 'connectionRole', {
    value: role,
    enumerable: false,
    configurable: true,
  });
  return session;
}

test('consumes only the non-enumerable server-private trusted-shell role', () => {
  expect(hasTrustedThreadAuthority(sessionWithPrivateRole('trusted-shell'))).toBe(true);
  expect(hasTrustedThreadAuthority(sessionWithPrivateRole('untrusted'))).toBe(false);
  expect(hasTrustedThreadAuthority({ connectionRole: 'trusted-shell' })).toBe(false);
  expect(hasTrustedThreadAuthority({ role: 'trusted-shell', proof: 'forged' })).toBe(false);
  expect(hasTrustedThreadAuthority(null)).toBe(false);
});

test('one bounded canonical denial reveals no role or proof detail', () => {
  const ws = { send: jest.fn() };
  expect(requireTrustedThreadAuthority(ws, { role: 'trusted-shell' })).toBe(false);
  expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual(THREAD_MUTATION_DENIED);
  expect(ws.send.mock.calls[0][0]).not.toMatch(/trusted|proof|role|nonce|generation/i);
});

test('trusted authority succeeds without an acknowledgement side effect', () => {
  const ws = { send: jest.fn() };
  expect(requireTrustedThreadAuthority(ws, sessionWithPrivateRole('trusted-shell'))).toBe(true);
  expect(ws.send).not.toHaveBeenCalled();
});

test('fork denial is fixed and independent of connection role', () => {
  const ws = { send: jest.fn() };
  expect(denyThreadFork(ws)).toBe(false);
  expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual(THREAD_FORK_UNAVAILABLE);
});
