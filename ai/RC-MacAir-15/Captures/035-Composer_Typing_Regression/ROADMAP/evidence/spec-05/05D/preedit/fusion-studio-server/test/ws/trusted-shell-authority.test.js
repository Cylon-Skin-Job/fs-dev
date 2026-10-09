'use strict';

const {
  hasTrustedShellAuthority,
  requireTrustedViewAuthority,
} = require('../../lib/ws/trusted-shell-authority');
const { hasTrustedThreadAuthority } = require('../../lib/ws/privileged-thread-guard');

function privateSession(role = 'trusted-shell') {
  const session = {};
  Object.defineProperty(session, 'connectionRole', { value: role, enumerable: false });
  return session;
}

test('shared shell admission accepts only the non-enumerable connection-owned role', () => {
  expect(hasTrustedShellAuthority(privateSession())).toBe(true);
  expect(hasTrustedThreadAuthority(privateSession())).toBe(true);
  expect(hasTrustedShellAuthority({ connectionRole: 'trusted-shell' })).toBe(false);
  expect(hasTrustedShellAuthority({ role: 'trusted-shell', origin: 'fusion-shell://app' })).toBe(false);
});

test('view denial is bounded and does not emit thread-specific semantics', () => {
  const ws = { send: jest.fn() };
  expect(requireTrustedViewAuthority(ws, { connectionRole: 'trusted-shell' })).toBe(false);
  const payload = JSON.parse(ws.send.mock.calls[0][0]);
  expect(payload).toEqual({
    type: 'error', code: 'VIEW_MUTATION_DENIED', message: 'View mutation denied',
  });
  expect(JSON.stringify(payload)).not.toMatch(/thread|proof|nonce|origin/i);
});
