'use strict';

const http = require('node:http');
const { createHmac } = require('node:crypto');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { createShellAuthOwner, proofInput } = require('../../lib/ws/shell-auth');
const { createShellAuthDispatch } = require('../../lib/ws/shell-auth-dispatch');
const { createDeferredProductConnection } = require('../../lib/ws/deferred-product-connection');
const { createProductSessionRegistry } = require('../../lib/ws/product-session-registry');
const { createTransportConnectionRegistry } = require('../../lib/ws/transport-connection-registry');
const {
  MAX_SHELL_AUTH_FRAME_BYTES,
  activateApplicationPayloadLimit,
} = require('../../lib/ws/websocket-payload-boundary');

const GENERATION = 'generation_auth_000001';
const MASTER = Buffer.alloc(32, 1);
const RENDERER_NONCE = Buffer.alloc(32, 3).toString('base64url');

function nextMessage(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('message timeout')), 2_000);
    ws.once('message', (data) => { clearTimeout(timer); resolve(JSON.parse(data.toString())); });
  });
}

function nextMessages(ws, count) {
  return new Promise((resolve, reject) => {
    const values = [];
    const timer = setTimeout(() => reject(new Error('message timeout')), 2_000);
    const receive = (data) => {
      values.push(JSON.parse(data.toString()));
      if (values.length !== count) return;
      clearTimeout(timer);
      ws.off('message', receive);
      resolve(values);
    };
    ws.on('message', receive);
  });
}

function nextClose(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('close timeout')), 2_000);
    ws.once('close', (code, reason) => { clearTimeout(timer); resolve([code, reason.toString()]); });
  });
}

describe('public WebSocket shell authentication', () => {
  let server;
  let wss;
  let url;
  let sequence;
  let routed;
  let routedPromise;
  let signalRouted;
  let managerInitializations;
  let productFactoryCalls;
  let productCloseCalls;
  let transportRegistry;
  let productSessions;
  let productSessionRegistry;
  let failTransportActivation;
  let serverClosePromises;
  let connectionSessions;
  let authOwner;
  let initializationGate;

  beforeEach(async () => {
    sequence = 0;
    routed = [];
    managerInitializations = 0;
    productFactoryCalls = 0;
    productCloseCalls = 0;
    transportRegistry = createTransportConnectionRegistry();
    productSessions = new Map();
    productSessionRegistry = createProductSessionRegistry({ sessions: productSessions });
    failTransportActivation = false;
    serverClosePromises = [];
    connectionSessions = [];
    initializationGate = null;
    routedPromise = new Promise((resolve) => { signalRouted = resolve; });
    server = http.createServer();
    wss = new WebSocketServer({ server, maxPayload: MAX_SHELL_AUTH_FRAME_BYTES });
    authOwner = createShellAuthOwner({
      authority: { version: 1, generation: GENERATION, master: MASTER },
      now: () => 1_000,
      randomBytes: () => Buffer.alloc(32, ++sequence),
      ttlMs: 1_000,
    });
    wss.on('connection', (ws, request) => {
      serverClosePromises.push(new Promise((resolve) => ws.once('close', resolve)));
      const session = {
        connectionId: `connection_auth_00000${sequence + 1}`,
        workspaceBindingState: 'pending-auth',
      };
      connectionSessions.push(session);
      const productConnection = createDeferredProductConnection({
        ws,
        build: async () => {
          productFactoryCalls += 1;
          return {
            handleMessage: (message) => { routed.push(message.toString()); signalRouted(); },
            handleClose: () => {
              productCloseCalls += 1;
              productSessions.delete(ws);
            },
          };
        },
      });
      const dispatch = createShellAuthDispatch({
        authOwner, ws, session, origin: request.headers.origin,
        initialize: async () => {
          if (initializationGate) await initializationGate;
          await productConnection.initialize();
          managerInitializations += 1;
          session.workspaceBindingState = 'active';
          ws.send(JSON.stringify({ type: 'workspace:init' }));
        },
        activate: () => productSessionRegistry.activate({
          ws,
          session,
          managed: authOwner.available,
        }),
        activateTransport: () => {
          if (failTransportActivation) throw new Error('injected transport activation failure');
          activateApplicationPayloadLimit(ws);
        },
        handleNext: productConnection.handleMessage,
        now: () => 1_000,
      });
      transportRegistry.track(ws, productConnection.waitForCleanup);
      ws.on('message', dispatch);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `ws://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await transportRegistry.terminateAll();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  test('trusted shell proves possession before initialization and product routing', async () => {
    const ws = new WebSocket(url, { origin: 'fusion-shell://app' });
    const challenge = await nextMessage(ws);
    const proof = {
      type: 'shell-auth:proof', version: 1,
      connectionId: challenge.connectionId,
      serverNonce: challenge.serverNonce,
      rendererNonce: RENDERER_NONCE,
      generation: challenge.generation,
      expiresAt: challenge.expiresAt,
      proof: createHmac('sha256', MASTER).update(proofInput(challenge, RENDERER_NONCE)).digest('base64url'),
    };
    const initialized = nextMessages(ws, 2);
    ws.send(JSON.stringify(proof));
    expect(await initialized).toEqual([
      { type: 'workspace:init' },
      { type: 'shell-auth:authenticated', version: 1 },
    ]);
    expect(productFactoryCalls).toBe(1);
    ws.send(JSON.stringify({ type: 'thread:list' }));
    await routedPromise;
    expect(routed).toEqual([JSON.stringify({ type: 'thread:list' })]);
    const replayClosed = nextClose(ws);
    ws.send(JSON.stringify(proof));
    await expect(replayClosed).resolves.toEqual([1008, 'shell authentication failed']);
    await serverClosePromises[0];
    expect(productCloseCalls).toBe(1);
    expect(connectionSessions[0]).not.toHaveProperty('connectionRole');
  });

  test('standalone upgraded socket preserves an immediate read across asynchronous initialization', async () => {
    authOwner = createShellAuthOwner();
    let releaseInitialization;
    initializationGate = new Promise((resolve) => { releaseInitialization = resolve; });
    const ws = new WebSocket(url);
    await new Promise((resolve) => ws.once('open', resolve));
    const initialized = nextMessage(ws);
    ws.send(JSON.stringify({ type: 'thread:list', requestId: 'standalone-immediate' }));

    await new Promise((resolve) => setImmediate(resolve));
    expect(productFactoryCalls).toBe(0);
    expect(routed).toEqual([]);
    expect(ws.readyState).toBe(WebSocket.OPEN);

    releaseInitialization();
    await expect(initialized).resolves.toEqual({ type: 'workspace:init' });
    await routedPromise;
    expect(routed).toEqual([JSON.stringify({
      type: 'thread:list', requestId: 'standalone-immediate',
    })]);
    expect(productFactoryCalls).toBe(1);
    expect(productSessions.size).toBe(1);
    expect(connectionSessions[0].connectionRole).toBe('untrusted');
    ws.close();
    await serverClosePromises[0];
    expect(connectionSessions[0]).not.toHaveProperty('connectionRole');
  });

  test('real upgraded transport activation failure never publishes a product session or ack', async () => {
    failTransportActivation = true;
    const ws = new WebSocket(url, { origin: 'fusion-shell://app' });
    const challenge = await nextMessage(ws);
    const received = [];
    ws.on('message', (data) => received.push(JSON.parse(data.toString())));
    const closed = nextClose(ws);
    ws.send(JSON.stringify({
      type: 'shell-auth:proof', version: 1,
      connectionId: challenge.connectionId,
      serverNonce: challenge.serverNonce,
      rendererNonce: RENDERER_NONCE,
      generation: challenge.generation,
      expiresAt: challenge.expiresAt,
      proof: createHmac('sha256', MASTER).update(proofInput(challenge, RENDERER_NONCE)).digest('base64url'),
    }));

    await expect(closed).resolves.toEqual([1011, 'workspace initialization failed']);
    await serverClosePromises[0];
    expect(received).toEqual([{ type: 'workspace:init' }]);
    expect(received).not.toContainEqual({ type: 'shell-auth:authenticated', version: 1 });
    expect(productSessions.size).toBe(0);
    expect(productFactoryCalls).toBe(1);
    expect(productCloseCalls).toBe(1);
    expect(connectionSessions[0]).not.toHaveProperty('connectionRole');
  });

  test('an unanswered upgraded socket expires without constructing product state', async () => {
    const ws = new WebSocket(url, { origin: 'fusion-shell://app' });
    await expect(nextMessage(ws)).resolves.toMatchObject({ type: 'shell-auth:challenge' });
    await expect(nextClose(ws)).resolves.toEqual([1008, 'shell authentication failed']);
    await serverClosePromises[0];
    expect(connectionSessions[0]).not.toHaveProperty('connectionRole');
    expect(productFactoryCalls).toBe(0);
    expect(productCloseCalls).toBe(0);
    await expect(transportRegistry.terminateAll()).resolves.toBe(0);
  });

  test('abnormal upgraded-socket close releases transport ownership without product construction', async () => {
    const ws = new WebSocket(url, { origin: 'fusion-shell://app' });
    await expect(nextMessage(ws)).resolves.toMatchObject({ type: 'shell-auth:challenge' });
    ws.terminate();
    await serverClosePromises[0];
    expect(connectionSessions[0]).not.toHaveProperty('connectionRole');
    expect(productFactoryCalls).toBe(0);
    expect(productCloseCalls).toBe(0);
    await expect(transportRegistry.terminateAll()).resolves.toBe(0);
  });

  test('raw product traffic and custom-origin proof close before route or initialization', async () => {
    const raw = new WebSocket(url);
    await nextMessage(raw);
    const rawClose = nextClose(raw);
    raw.send(JSON.stringify({ type: 'thread:list', role: 'trusted-shell' }));
    await expect(rawClose).resolves.toEqual([1008, 'shell authentication failed']);
    await serverClosePromises[0];
    expect(connectionSessions[0]).not.toHaveProperty('connectionRole');
    expect(routed).toEqual([]);
    expect(managerInitializations).toBe(0);
    expect(productFactoryCalls).toBe(0);
    expect(productCloseCalls).toBe(0);

    const custom = new WebSocket(url, { origin: 'fusion-studio://workspace/custom' });
    const challenge = await nextMessage(custom);
    const customClose = nextClose(custom);
    custom.send(JSON.stringify({
      type: 'shell-auth:proof', version: 1,
      connectionId: challenge.connectionId, serverNonce: challenge.serverNonce,
      rendererNonce: RENDERER_NONCE, generation: challenge.generation,
      expiresAt: challenge.expiresAt,
      proof: createHmac('sha256', MASTER).update(proofInput(challenge, RENDERER_NONCE)).digest('base64url'),
    }));
    await expect(customClose).resolves.toEqual([1008, 'shell authentication failed']);
    await serverClosePromises[1];
    expect(connectionSessions[1]).not.toHaveProperty('connectionRole');
    expect(routed).toEqual([]);
    expect(managerInitializations).toBe(0);
    expect(productFactoryCalls).toBe(0);
    expect(productCloseCalls).toBe(0);
  });

  test('a proof is bound to one connection and cannot be replayed on another', async () => {
    const first = new WebSocket(url, { origin: 'fusion-shell://app' });
    const firstChallenge = await nextMessage(first);
    const proof = {
      type: 'shell-auth:proof', version: 1,
      connectionId: firstChallenge.connectionId, serverNonce: firstChallenge.serverNonce,
      rendererNonce: RENDERER_NONCE, generation: firstChallenge.generation,
      expiresAt: firstChallenge.expiresAt,
      proof: createHmac('sha256', MASTER).update(proofInput(firstChallenge, RENDERER_NONCE)).digest('base64url'),
    };
    const initialized = nextMessages(first, 2);
    first.send(JSON.stringify(proof));
    await initialized;

    const second = new WebSocket(url, { origin: 'fusion-shell://app' });
    await nextMessage(second);
    const closed = nextClose(second);
    second.send(JSON.stringify(proof));
    await expect(closed).resolves.toEqual([1008, 'shell authentication failed']);
    first.close();
  });
});
