'use strict';

const { createShellAuthDispatch } = require('../../lib/ws/shell-auth-dispatch');

function frame(value) {
  return Buffer.from(JSON.stringify(value));
}

describe('shell auth dispatch', () => {
  test('retires partially established authority when challenge construction fails', () => {
    const session = {};
    const retire = jest.fn(({ session: target }) => { delete target.connectionRole; });
    const authOwner = {
      available: true,
      begin({ session: target }) {
        target.connectionRole = 'untrusted';
        throw new Error('challenge unavailable');
      },
      retire,
    };

    expect(() => createShellAuthDispatch({
      authOwner,
      ws: { send: jest.fn(), close: jest.fn() },
      session,
      origin: 'fusion-shell://app',
      initialize: jest.fn(), activate: jest.fn(), handleNext: jest.fn(),
    })).toThrow('challenge unavailable');
    expect(retire).toHaveBeenCalledTimes(1);
    expect(session).not.toHaveProperty('connectionRole');
  });

  test('holds initialization and product routing until proof succeeds', async () => {
    const order = [];
    const ws = { sent: [], send(value) { this.sent.push(JSON.parse(value)); }, close: jest.fn() };
    const session = {};
    const authOwner = {
      available: true,
      begin() { order.push('challenge'); return { challenge: { expiresAt: 11_000 } }; },
      verify({ session: activeSession, value }) {
        order.push(`verify:${value.type}`);
        activeSession.connectionRole = 'trusted-shell';
        return true;
      },
    };
    const dispatch = createShellAuthDispatch({
      authOwner, ws, session, origin: 'fusion-shell://app',
      initialize: async () => { order.push('initialize'); },
      activate: async () => {
        expect(ws.sent).toEqual([]);
        order.push('activate');
      },
      activateTransport: async () => { order.push('activate-transport'); },
      handleNext: async () => { order.push('product'); },
      now: () => 1_000,
    });
    await dispatch(frame({ type: 'shell-auth:proof' }));
    expect(order).toEqual(['challenge', 'verify:shell-auth:proof', 'initialize', 'activate-transport', 'activate']);
    expect(ws.sent).toEqual([{ type: 'shell-auth:authenticated', version: 1 }]);
    await dispatch(frame({ type: 'thread:list' }));
    expect(order.at(-1)).toBe('product');
    await dispatch(frame({ type: 'shell-auth:proof' }));
    expect(ws.close).toHaveBeenCalledWith(1008, 'shell authentication failed');
    expect(order.filter((value) => value === 'product')).toHaveLength(1);
  });

  test('activation failure emits no authenticated acknowledgement or releasable product state', async () => {
    const ws = { sent: [], send(value) { this.sent.push(JSON.parse(value)); }, close: jest.fn() };
    const authOwner = {
      available: true,
      begin: () => ({ challenge: { expiresAt: 11_000 } }),
      verify: () => true,
    };
    const dispatch = createShellAuthDispatch({
      authOwner, ws, session: {}, origin: 'fusion-shell://app',
      initialize: async () => { ws.send(JSON.stringify({ type: 'workspace:init' })); },
      activate: async () => { throw new Error('closed before activation'); },
      handleNext: jest.fn(),
      now: () => 1_000,
    });

    await dispatch(frame({ type: 'shell-auth:proof' }));

    expect(ws.sent).toEqual([{ type: 'workspace:init' }]);
    expect(ws.sent).not.toContainEqual({ type: 'shell-auth:authenticated', version: 1 });
    expect(ws.close).toHaveBeenCalledWith(1011, 'workspace initialization failed');
  });

  test('transport activation failure cannot publish a product session', async () => {
    const sessions = new Map();
    const ws = { sent: [], send(value) { this.sent.push(JSON.parse(value)); }, close: jest.fn() };
    const activate = jest.fn(() => sessions.set(ws, { role: 'product' }));
    const dispatch = createShellAuthDispatch({
      authOwner: {
        available: true,
        begin: () => ({ challenge: { expiresAt: 11_000 } }),
        verify: () => true,
      },
      ws,
      session: {},
      origin: 'fusion-shell://app',
      initialize: async () => {},
      activate,
      activateTransport: async () => { throw new Error('transport unavailable'); },
      handleNext: jest.fn(),
      now: () => 1_000,
    });

    await dispatch(frame({ type: 'shell-auth:proof' }));

    expect(activate).not.toHaveBeenCalled();
    expect(sessions.size).toBe(0);
    expect(ws.sent).toEqual([]);
    expect(ws.close).toHaveBeenCalledWith(1011, 'workspace initialization failed');
  });

  test('a close race rejected by activation cannot publish a false authenticated state', async () => {
    let closed = false;
    const ws = {
      sent: [],
      send(value) { this.sent.push(JSON.parse(value)); },
      close: jest.fn(() => { closed = true; }),
      once(event, listener) { if (event === 'close') this.onClose = listener; },
    };
    const authOwner = {
      available: true,
      begin: () => ({ challenge: { expiresAt: 11_000 } }),
      verify: () => true,
    };
    const dispatch = createShellAuthDispatch({
      authOwner, ws, session: {}, origin: 'fusion-shell://app',
      initialize: async () => {
        ws.send(JSON.stringify({ type: 'workspace:init' }));
        closed = true;
        ws.onClose?.();
      },
      activate: async () => {
        if (closed) throw new Error('transport closed');
      },
      handleNext: jest.fn(),
      now: () => 1_000,
    });

    await dispatch(frame({ type: 'shell-auth:proof' }));

    expect(ws.sent).toEqual([{ type: 'workspace:init' }]);
    expect(ws.close).toHaveBeenCalledWith(1011, 'workspace initialization failed');
  });

  test('rejects reordered product traffic without invoking initialization or router', async () => {
    const ws = { send: jest.fn(), close: jest.fn() };
    const initialize = jest.fn();
    const handleNext = jest.fn();
    const authOwner = { available: true, begin: () => ({ challenge: { expiresAt: 11_000 } }), verify: () => false };
    const dispatch = createShellAuthDispatch({ authOwner, ws, session: {}, origin: null, initialize, activate: jest.fn(), handleNext, now: () => 1_000 });
    await dispatch(frame({ type: 'thread:list', trusted: true }));
    expect(initialize).not.toHaveBeenCalled();
    expect(handleNext).not.toHaveBeenCalled();
  });

  test('rejects an over-bounded pre-authentication frame before verification', async () => {
    const ws = { send: jest.fn(), close: jest.fn() };
    const verify = jest.fn();
    const authOwner = {
      available: true,
      begin: () => ({ challenge: { expiresAt: 11_000 } }),
      verify,
    };
    const dispatch = createShellAuthDispatch({
      authOwner,
      ws,
      session: {},
      origin: 'fusion-shell://app',
      initialize: jest.fn(),
      activate: jest.fn(),
      handleNext: jest.fn(),
      now: () => 1_000,
    });

    await dispatch(Buffer.from(JSON.stringify({
      type: 'shell-auth:proof',
      padding: 'x'.repeat(5_000),
    })));

    expect(verify).not.toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalledWith(1008, 'shell authentication failed');
  });

  test('standalone mode preserves existing untrusted diagnostic/read dispatch after init', async () => {
    const order = [];
    const ws = { send: jest.fn(), close: jest.fn() };
    const authOwner = {
      available: false,
      begin({ session }) { session.connectionRole = 'untrusted'; return { mode: 'standalone' }; },
    };
    const dispatch = createShellAuthDispatch({
      authOwner, ws, session: {}, origin: null,
      initialize: async () => { order.push('initialize'); },
      activate: async () => { order.push('activate'); },
      handleNext: async () => { order.push('read'); },
    });
    await new Promise((resolve) => setImmediate(resolve));
    await dispatch(frame({ type: 'thread:list' }));
    expect(order).toEqual(['initialize', 'activate', 'read']);
  });

  test('standalone mode boundedly preserves reads arriving during asynchronous initialization', async () => {
    const order = [];
    let finishInitialization;
    const ws = {
      send: jest.fn(),
      close: jest.fn(),
      once(event, listener) { if (event === 'close') this.onClose = listener; },
    };
    const handleNext = jest.fn(async (message) => {
      order.push(JSON.parse(message.toString()).requestId);
    });
    const dispatch = createShellAuthDispatch({
      authOwner: {
        available: false,
        begin: () => ({ mode: 'standalone' }),
        retire: jest.fn(),
      },
      ws,
      session: {},
      origin: null,
      initialize: () => new Promise((resolve) => { finishInitialization = resolve; }),
      activateTransport: async () => { order.push('transport'); },
      activate: async () => { order.push('activate'); },
      handleNext,
    });

    await dispatch(frame({ type: 'thread:list', requestId: 'first' }));
    await dispatch(frame({ type: 'thread:list', requestId: 'second' }));
    expect(ws.close).not.toHaveBeenCalled();
    expect(handleNext).not.toHaveBeenCalled();

    finishInitialization();
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(['transport', 'activate', 'first', 'second']);
    expect(handleNext).toHaveBeenCalledTimes(2);
    expect(ws.close).not.toHaveBeenCalled();
  });

  test('standalone initialization queue is bounded and cleared on overflow', async () => {
    let finishInitialization;
    const retire = jest.fn();
    const ws = { send: jest.fn(), close: jest.fn(), once: jest.fn() };
    const handleNext = jest.fn();
    const dispatch = createShellAuthDispatch({
      authOwner: {
        available: false,
        begin: () => ({ mode: 'standalone' }),
        retire,
      },
      ws,
      session: {},
      origin: null,
      initialize: () => new Promise((resolve) => { finishInitialization = resolve; }),
      activate: jest.fn(),
      handleNext,
    });

    for (let index = 0; index < 64; index += 1) {
      await dispatch(frame({ type: 'thread:list', requestId: index }));
    }
    await dispatch(frame({ type: 'thread:list', requestId: 'overflow' }));
    expect(ws.close).toHaveBeenCalledTimes(1);
    expect(ws.close).toHaveBeenCalledWith(1013, 'server initialization pending');
    expect(retire).toHaveBeenCalledTimes(1);

    finishInitialization();
    await new Promise((resolve) => setImmediate(resolve));
    expect(handleNext).not.toHaveBeenCalled();
  });

  test('standalone close during initialization discards queued reads', async () => {
    let finishInitialization;
    const retire = jest.fn();
    const ws = {
      send: jest.fn(), close: jest.fn(),
      once(event, listener) { if (event === 'close') this.onClose = listener; },
    };
    const handleNext = jest.fn();
    const dispatch = createShellAuthDispatch({
      authOwner: {
        available: false,
        begin: () => ({ mode: 'standalone' }),
        retire,
      },
      ws,
      session: {},
      origin: null,
      initialize: () => new Promise((resolve) => { finishInitialization = resolve; }),
      activate: jest.fn(),
      handleNext,
    });

    await dispatch(frame({ type: 'thread:list' }));
    ws.onClose();
    finishInitialization();
    await new Promise((resolve) => setImmediate(resolve));
    expect(handleNext).not.toHaveBeenCalled();
    expect(retire).toHaveBeenCalledTimes(1);
  });

  test('managed product traffic during asynchronous activation closes without a late ack', async () => {
    let finishInitialization;
    const ws = {
      sent: [],
      send(value) { this.sent.push(JSON.parse(value)); },
      close: jest.fn(),
      once: jest.fn(),
    };
    const activate = jest.fn();
    const dispatch = createShellAuthDispatch({
      authOwner: {
        available: true,
        begin: () => ({ challenge: { expiresAt: 11_000 } }),
        verify: () => true,
      },
      ws,
      session: {},
      origin: 'fusion-shell://app',
      initialize: () => new Promise((resolve) => { finishInitialization = resolve; }),
      activate,
      handleNext: jest.fn(),
      now: () => 1_000,
    });

    const authentication = dispatch(frame({ type: 'shell-auth:proof' }));
    await dispatch(frame({ type: 'thread:list' }));
    finishInitialization();
    await authentication;
    expect(ws.close).toHaveBeenCalledWith(1008, 'shell authentication failed');
    expect(activate).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([]);
  });

  test('an unanswered challenge expires with the fixed denial', () => {
    const ws = { send: jest.fn(), close: jest.fn() };
    let expire;
    const session = { connectionRole: 'untrusted' };
    const retire = jest.fn(({ session: target }) => { delete target.connectionRole; });
    const authOwner = {
      available: true,
      begin: () => ({ challenge: { expiresAt: 11_000 } }),
      retire,
    };
    createShellAuthDispatch({
      authOwner, ws, session, origin: 'fusion-shell://app',
      initialize: jest.fn(), activate: jest.fn(), handleNext: jest.fn(), now: () => 1_000,
      schedule(callback, delay) { expect(delay).toBe(10_000); expire = callback; return 1; },
      cancel: jest.fn(),
    });
    expire();
    expect(ws.close).toHaveBeenCalledWith(1008, 'shell authentication failed');
    expect(retire).toHaveBeenCalledTimes(1);
    expect(session.connectionRole).toBeUndefined();
  });

  test('close retires active trusted authority exactly once', async () => {
    const ws = {
      send: jest.fn(), close: jest.fn(),
      once(event, listener) { if (event === 'close') this.onClose = listener; },
    };
    const session = {};
    const retire = jest.fn(({ session: target }) => { delete target.connectionRole; });
    const authOwner = {
      available: true,
      begin: () => ({ challenge: { expiresAt: 11_000 } }),
      verify({ session: target }) { target.connectionRole = 'trusted-shell'; return true; },
      retire,
    };
    const dispatch = createShellAuthDispatch({
      authOwner, ws, session, origin: 'fusion-shell://app',
      initialize: async () => {}, activate: async () => {}, handleNext: jest.fn(), now: () => 1_000,
    });
    await dispatch(frame({ type: 'shell-auth:proof' }));
    expect(session.connectionRole).toBe('trusted-shell');
    ws.onClose();
    ws.onClose();
    expect(retire).toHaveBeenCalledTimes(1);
    expect(session.connectionRole).toBeUndefined();
  });
});
