'use strict';

const http = require('node:http');
const { createHmac } = require('node:crypto');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { createDeferredProductConnection } = require('../../lib/ws/deferred-product-connection');
const { createServerRuntimeActivation } = require('../../lib/ws/server-runtime-activation');
const { createShellAuthDispatch } = require('../../lib/ws/shell-auth-dispatch');
const { createShellAuthOwner, proofInput } = require('../../lib/ws/shell-auth');
const { createTransportConnectionRegistry } = require('../../lib/ws/transport-connection-registry');

const GENERATION = 'generation_runtime_0001';
const MASTER = Buffer.alloc(32, 7);
const RENDERER_NONCE = Buffer.alloc(32, 8).toString('base64url');

function nextMessage(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('message timeout')), 2_000);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function nextMessages(ws, count) {
  return new Promise((resolve, reject) => {
    const messages = [];
    const timer = setTimeout(() => reject(new Error('message timeout')), 2_000);
    const receive = (data) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length !== count) return;
      clearTimeout(timer);
      ws.off('message', receive);
      resolve(messages);
    };
    ws.on('message', receive);
  });
}

function nextClose(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('close timeout')), 2_000);
    ws.once('close', (code, reason) => {
      clearTimeout(timer);
      resolve([code, reason.toString()]);
    });
  });
}

function createProof(challenge) {
  return {
    type: 'shell-auth:proof',
    version: 1,
    connectionId: challenge.connectionId,
    serverNonce: challenge.serverNonce,
    rendererNonce: RENDERER_NONCE,
    generation: challenge.generation,
    expiresAt: challenge.expiresAt,
    proof: createHmac('sha256', MASTER)
      .update(proofInput(challenge, RENDERER_NONCE))
      .digest('base64url'),
  };
}

async function createProductionBoundaryFixture() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const transports = createTransportConnectionRegistry();
  const activation = createServerRuntimeActivation();
  const authOwner = createShellAuthOwner({
    authority: { version: 1, generation: GENERATION, master: MASTER },
    now: () => 1_000,
    randomBytes: () => Buffer.alloc(32, 9),
    ttlMs: 10_000,
  });
  let productFactoryCalls = 0;
  let productCleanupCalls = 0;
  let productActivations = 0;

  wss.on('connection', (ws, request) => {
    transports.track(ws);
    const session = {
      connectionId: 'connection_runtime_0001',
      connectionRole: 'untrusted',
    };
    const productConnection = createDeferredProductConnection({
      ws,
      build: async () => {
        productFactoryCalls += 1;
        return {
          handleMessage() {},
          handleClose() { productCleanupCalls += 1; },
        };
      },
    });
    const dispatch = createShellAuthDispatch({
      authOwner,
      ws,
      session,
      origin: request.headers.origin,
      initialize: async () => {
        await activation.wait();
        await productConnection.initialize();
        ws.send(JSON.stringify({ type: 'workspace:init' }));
      },
      activate: async () => { productActivations += 1; },
      handleNext: productConnection.handleMessage,
      now: () => 1_000,
    });
    ws.on('message', dispatch);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    activation,
    url: `ws://127.0.0.1:${server.address().port}`,
    counts: () => ({ productFactoryCalls, productCleanupCalls, productActivations }),
    async close() {
      await transports.terminateAll();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

describe('server runtime activation', () => {
  test('settles once and fails closed when startup does not activate', async () => {
    const active = createServerRuntimeActivation();
    const activeWait = active.wait();
    active.activate();
    await expect(activeWait).resolves.toBeUndefined();
    expect(() => active.activate()).toThrow(/already settled/);

    const failed = createServerRuntimeActivation();
    const failedWait = failed.wait();
    failed.fail();
    await expect(failedWait).rejects.toThrow('server runtime unavailable');
    failed.fail();
  });

  test('valid proof constructs and acknowledges product state only after full runtime activation', async () => {
    const fixture = await createProductionBoundaryFixture();
    try {
      const ws = new WebSocket(fixture.url, { origin: 'fusion-shell://app' });
      const challenge = await nextMessage(ws);
      ws.send(JSON.stringify(createProof(challenge)));

      await new Promise((resolve) => setImmediate(resolve));
      expect(fixture.counts()).toEqual({
        productFactoryCalls: 0,
        productCleanupCalls: 0,
        productActivations: 0,
      });

      const initialized = nextMessages(ws, 2);
      fixture.activation.activate();
      await expect(initialized).resolves.toEqual([
        { type: 'workspace:init' },
        { type: 'shell-auth:authenticated', version: 1 },
      ]);
      expect(fixture.counts()).toEqual({
        productFactoryCalls: 1,
        productCleanupCalls: 0,
        productActivations: 1,
      });
      const closed = nextClose(ws);
      ws.close();
      await closed;
    } finally {
      await fixture.close();
    }
  });

  test('startup failure emits no product initialization or authenticated acknowledgement', async () => {
    const fixture = await createProductionBoundaryFixture();
    try {
      const ws = new WebSocket(fixture.url, { origin: 'fusion-shell://app' });
      const challenge = await nextMessage(ws);
      const received = [];
      ws.on('message', (data) => { received.push(JSON.parse(data.toString())); });
      const closed = nextClose(ws);
      ws.send(JSON.stringify(createProof(challenge)));
      fixture.activation.fail();

      await expect(closed).resolves.toEqual([1011, 'workspace initialization failed']);
      expect(received).toEqual([]);
      expect(fixture.counts()).toEqual({
        productFactoryCalls: 0,
        productCleanupCalls: 0,
        productActivations: 0,
      });
    } finally {
      await fixture.close();
    }
  });
});
