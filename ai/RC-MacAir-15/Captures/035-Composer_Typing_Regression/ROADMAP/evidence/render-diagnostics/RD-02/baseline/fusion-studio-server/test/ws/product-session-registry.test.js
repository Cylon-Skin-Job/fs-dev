'use strict';

const { createProductSessionRegistry } = require('../../lib/ws/product-session-registry');

function socket(readyState = 1) {
  return { readyState };
}

function activeSession(overrides = {}) {
  return {
    connectionId: 'connection_auth_000001',
    connectionRole: 'trusted-shell',
    workspaceBindingState: 'active',
    ...overrides,
  };
}

describe('product session registry', () => {
  test('publishes only initialized trusted managed or untrusted standalone sessions', () => {
    const sessions = new Map();
    const registry = createProductSessionRegistry({ sessions });
    const managed = socket();
    const managedSession = activeSession();
    registry.activate({ ws: managed, session: managedSession, managed: true });
    expect(registry.getAllClients()).toEqual([managed]);
    expect(registry.getClientByConnectionId(managedSession.connectionId)).toBe(managed);
    expect(registry.getSessionForClient(managed)).toBe(managedSession);

    const standalone = socket();
    registry.activate({
      ws: standalone,
      session: activeSession({ connectionId: 'connection_auth_000002', connectionRole: 'untrusted' }),
      managed: false,
    });
    expect(registry.getAllClients()).toEqual([managed, standalone]);
  });

  test.each([
    ['pending workspace initialization', activeSession({ workspaceBindingState: 'binding' }), true, 1],
    ['unproved managed role', activeSession({ connectionRole: 'untrusted' }), true, 1],
    ['forged standalone role', activeSession(), false, 1],
    ['closed transport', activeSession(), true, 3],
  ])('rejects %s without publishing it', (_label, session, managed, readyState) => {
    const sessions = new Map();
    const registry = createProductSessionRegistry({ sessions });
    const ws = socket(readyState);
    expect(() => registry.activate({ ws, session, managed })).toThrow('product session activation failed');
    expect(sessions.size).toBe(0);
    expect(registry.getAllClients()).toEqual([]);
  });

  test('rejects duplicate activation and excludes closed active recipients', () => {
    const sessions = new Map();
    const registry = createProductSessionRegistry({ sessions });
    const ws = socket();
    const session = activeSession();
    registry.activate({ ws, session, managed: true });
    expect(() => registry.activate({ ws, session, managed: true })).toThrow('product session activation failed');
    ws.readyState = 3;
    expect(registry.getAllClients()).toEqual([]);
    expect(registry.getClientByConnectionId(session.connectionId)).toBeNull();
  });
});
