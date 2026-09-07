'use strict';

const http = require('node:http');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { createShutdownHandler } = require('../../lib/shutdown');
const { createDeferredProductConnection } = require('../../lib/ws/deferred-product-connection');
const { createTransportConnectionRegistry } = require('../../lib/ws/transport-connection-registry');

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function closedSocket(ws) {
  return new Promise((resolve) => ws.once('close', (code) => resolve(code)));
}

function runRealExitBoundary() {
  const shutdownPath = require.resolve('../../lib/shutdown');
  const deferredPath = require.resolve('../../lib/ws/deferred-product-connection');
  const registryPath = require.resolve('../../lib/ws/transport-connection-registry');
  const wsPath = require.resolve('ws');
  const script = `
    'use strict';
    const fs = require('node:fs');
    const http = require('node:http');
    const WebSocket = require(${JSON.stringify(wsPath)});
    const { WebSocketServer } = WebSocket;
    const { createShutdownHandler } = require(${JSON.stringify(shutdownPath)});
    const { createDeferredProductConnection } = require(${JSON.stringify(deferredPath)});
    const { createTransportConnectionRegistry } = require(${JSON.stringify(registryPath)});
    const server = http.createServer();
    const wss = new WebSocketServer({ server });
    const transports = createTransportConnectionRegistry();
    const sessions = new Map();
    let productCleanup = 0;
    process.on('exit', () => fs.writeSync(1, JSON.stringify({ productCleanup })));
    const requestShutdown = createShutdownHandler({
      server,
      sessions,
      terminateTransports: transports.terminateAll,
      closeWatchers: async () => true,
      stopSubscriptions: async () => true,
      closeDatabase: async () => true,
      logger: { log() {}, error() {} },
      forceAfterMs: 1_000,
    });
    wss.on('connection', async (ws) => {
      const product = createDeferredProductConnection({
        ws,
        build: async () => ({
          handleMessage() {},
          handleClose() { productCleanup += 1; },
        }),
      });
      transports.track(ws, product.waitForCleanup);
      await product.initialize();
      sessions.set(ws, {});
      await requestShutdown('SIGTERM');
    });
    server.listen(0, '127.0.0.1', () => {
      new WebSocket('ws://127.0.0.1:' + server.address().port);
    });
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      try {
        resolve({ code, signal, stderr, ...JSON.parse(stdout) });
      } catch (error) {
        reject(new Error(`exit-boundary proof failed: ${error.message}; stderr=${stderr}`));
      }
    });
  });
}

describe('WebSocket transport connection registry', () => {
  test('default process exit waits for real upgraded-socket product cleanup', async () => {
    await expect(runRealExitBoundary()).resolves.toMatchObject({
      code: 0,
      signal: null,
      productCleanup: 1,
    });
  });

  test('normal shutdown terminates pending and active upgraded sockets outside product authority', async () => {
    const server = http.createServer();
    const wss = new WebSocketServer({ server });
    const transports = createTransportConnectionRegistry();
    const productSessions = new Map();
    const order = [];
    let connectionCount = 0;
    let markActive;
    const activeReady = new Promise((resolve) => { markActive = resolve; });
    wss.on('connection', (ws) => {
      connectionCount += 1;
      if (connectionCount === 2) {
        const product = createDeferredProductConnection({
          ws,
          build: async () => ({
            handleMessage() {},
            handleClose() { order.push('product-cleanup'); },
          }),
        });
        transports.track(ws, product.waitForCleanup);
        void product.initialize().then(() => {
          productSessions.set(ws, { connectionRole: 'trusted-shell' });
          markActive();
        });
      } else transports.track(ws);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `ws://127.0.0.1:${server.address().port}`;
    const pending = await openSocket(url);
    const active = await openSocket(url);
    await activeReady;
    const pendingClosed = closedSocket(pending);
    const activeClosed = closedSocket(active);
    const exits = [];
    const requestShutdown = createShutdownHandler({
      server,
      sessions: productSessions,
      terminateTransports: transports.terminateAll,
      closeWatchers: async () => true,
      stopSubscriptions: async () => true,
      closeDatabase: async () => true,
      exit: (code) => { order.push('exit'); exits.push(code); },
      logger: { log() {}, error() {} },
      forceAfterMs: 1_000,
    });

    await requestShutdown('SIGTERM');

    await expect(Promise.all([pendingClosed, activeClosed])).resolves.toEqual([1006, 1006]);
    expect(productSessions.size).toBe(0);
    await expect(transports.terminateAll()).resolves.toBe(0);
    expect(exits).toEqual([0]);
    expect(order).toEqual(['product-cleanup', 'exit']);
    await new Promise((resolve) => wss.close(resolve));
  });

  test('abnormal close removes an upgraded socket before later shutdown', async () => {
    const server = http.createServer();
    const wss = new WebSocketServer({ server });
    const transports = createTransportConnectionRegistry();
    let serverClosed;
    wss.on('connection', (ws) => {
      transports.track(ws);
      serverClosed = new Promise((resolve) => ws.once('close', resolve));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const ws = await openSocket(`ws://127.0.0.1:${server.address().port}`);

    ws.terminate();
    await serverClosed;

    await expect(transports.terminateAll()).resolves.toBe(0);
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  test('shutdown waits for asynchronous product cleanup after transport close', async () => {
    const server = http.createServer();
    const wss = new WebSocketServer({ server });
    const transports = createTransportConnectionRegistry();
    let releaseCleanup;
    let cleanupFinished = false;
    const cleanupGate = new Promise((resolve) => { releaseCleanup = resolve; });
    let productReady;
    const ready = new Promise((resolve) => { productReady = resolve; });
    wss.on('connection', async (ws) => {
      const product = createDeferredProductConnection({
        ws,
        build: async () => ({
          handleMessage() {},
          async handleClose() {
            await cleanupGate;
            cleanupFinished = true;
          },
        }),
      });
      transports.track(ws, product.waitForCleanup);
      await product.initialize();
      productReady();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const client = await openSocket(`ws://127.0.0.1:${server.address().port}`);
    await ready;

    let terminated = false;
    const termination = transports.terminateAll().then(() => { terminated = true; });
    await new Promise((resolve) => setImmediate(resolve));
    expect(terminated).toBe(false);
    expect(cleanupFinished).toBe(false);

    releaseCleanup();
    await termination;
    expect(cleanupFinished).toBe(true);
    client.terminate();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });
});
