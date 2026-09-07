'use strict';

const http = require('node:http');
const { createHmac } = require('node:crypto');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;

const mockOwnerEffects = [];
const mockState = {
  threadId: null,
  threadManager: {
    workspaceId: 'workspace-1',
    projectRoot: '/repo',
    openSession: jest.fn(() => Promise.resolve()),
  },
};

jest.mock('../../lib/thread', () => ({
  RUNTIME_STATES: { STOPPING: 'stopping' },
  ThreadWebSocketHandler: {
    getState: jest.fn(() => mockState),
    activateThreadSession: jest.fn(async (ws, threadId, wire) => {
      await mockState.threadManager.openSession(threadId, wire, ws);
      mockState.threadId = threadId;
      mockState.activatedThreadId = threadId;
    }),
    isActivationBindingCurrent: jest.fn(() => true),
    handleThreadOpenAssistant: jest.fn(async (ws, message) => {
      mockOwnerEffects.push(['open-assistant', message.threadId || null]);
      mockState.threadId = message.threadId || 'thread-created';
      ws.send(JSON.stringify({
        type: message.threadId ? 'thread:opened' : 'thread:created',
        threadId: mockState.threadId,
      }));
      return mockState.threadId;
    }),
    handleThreadRename: jest.fn(async (ws, message) => {
      mockOwnerEffects.push(['rename', message.threadId]);
      ws.send(JSON.stringify({ type: 'thread:renamed', threadId: message.threadId, name: message.name }));
    }),
    handleThreadDelete: jest.fn(async (ws, message) => {
      mockOwnerEffects.push(['delete', message.threadId]);
      ws.send(JSON.stringify({ type: 'thread:deleted', threadId: message.threadId }));
    }),
    handleThreadOpen: jest.fn(async (ws, message) => {
      mockOwnerEffects.push(['open', message.threadId]);
      ws.send(JSON.stringify({ type: 'thread:opened', threadId: message.threadId }));
    }),
    handleThreadCopyLink: jest.fn(),
    handleThreadTouch: jest.fn(async (ws, message) => {
      mockOwnerEffects.push(['touch', message.threadId]);
      ws.send(JSON.stringify({ type: 'thread:list', threads: [] }));
    }),
    handleThreadSearch: jest.fn(),
    sendThreadList: jest.fn(async (ws) => {
      mockOwnerEffects.push(['list']);
      ws.send(JSON.stringify({ type: 'thread:list', threads: [] }));
    }),
  },
  threadRuntimeController: {
    warmRuntimeForIntent: jest.fn(async ({ clientMsg }) => {
      mockOwnerEffects.push(['warm', clientMsg.threadId]);
    }),
  },
  threadRuntimeManager: {
    getRuntimeState: jest.fn(() => 'cold'),
    markReady: jest.fn(),
  },
}));

jest.mock('../../lib/harness/compat', () => ({
  spawnThreadWire: jest.fn((threadId) => {
    mockOwnerEffects.push(['provider', threadId]);
    return { pid: 42, kill: jest.fn() };
  }),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  getWireForThread: jest.fn(),
  registerWire: jest.fn(),
  unregisterWire: jest.fn(),
}));

const { createShellAuthOwner, proofInput } = require('../../lib/ws/shell-auth');
const { createShellAuthDispatch } = require('../../lib/ws/shell-auth-dispatch');
const { createDeferredProductConnection } = require('../../lib/ws/deferred-product-connection');
const { decodeClientTextFrame } = require('../../lib/ws/client-frame-decoder');
const { createThreadWsHandlers } = require('../../lib/ws/thread-ws-handlers');

const GENERATION = 'generation_route_000001';
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

async function createPublicServer(managed) {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const authOwner = managed
    ? createShellAuthOwner({
      authority: { version: 1, generation: GENERATION, master: MASTER },
      now: () => 1_000,
      randomBytes: () => Buffer.alloc(32, 9),
      ttlMs: 1_000,
    })
    : createShellAuthOwner();

  wss.on('connection', (ws, request) => {
    const session = {
      connectionId: 'connection_route_000001',
      workspaceBindingState: 'pending-auth',
      currentWorkspaceId: 'workspace-1',
      workspaceEpoch: 'workspace-epoch-1',
      projectRoot: '/repo',
    };
    const product = createDeferredProductConnection({
      ws,
      build: async () => {
        const handlers = createThreadWsHandlers({
          ws,
          session,
          projectRoot: '/repo',
          wireLifecycle: {
            awaitHarnessReady: jest.fn(() => Promise.resolve()),
            initializeWire: jest.fn(),
            setupWireHandlers: jest.fn(),
          },
        });
        return {
          handleMessage(frame, isBinary) {
            const message = decodeClientTextFrame(frame, isBinary).value;
            return handlers[message.type]?.(message);
          },
          handleClose() {},
        };
      },
    });
    const dispatch = createShellAuthDispatch({
      authOwner,
      ws,
      session,
      origin: request.headers.origin,
      now: () => 1_000,
      initialize: async () => {
        await product.initialize();
        session.workspaceBindingState = 'active';
        ws.send(JSON.stringify({ type: 'workspace:init' }));
      },
      activate() {},
      activateTransport() {},
      handleNext: product.handleMessage,
    });
    ws.on('message', dispatch);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `ws://127.0.0.1:${server.address().port}`,
    async close() {
      for (const client of wss.clients) client.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function authenticate(url) {
  const ws = new WebSocket(url, { origin: 'fusion-shell://app' });
  const challenge = await nextMessage(ws);
  const initialized = [];
  const onMessage = (data) => initialized.push(JSON.parse(data.toString()));
  ws.on('message', onMessage);
  ws.send(JSON.stringify({
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
  }));
  while (!initialized.some((value) => value.type === 'shell-auth:authenticated')) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  ws.off('message', onMessage);
  return ws;
}

async function request(ws, value) {
  const response = nextMessage(ws);
  ws.send(JSON.stringify(value));
  return response;
}

async function requestMany(ws, value, count) {
  return new Promise((resolve, reject) => {
    const received = [];
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('message timeout'));
    }, 2_000);
    const onMessage = (data) => {
      received.push(JSON.parse(data.toString()));
      if (received.length !== count) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(received);
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify(value));
  });
}

async function closeClient(ws) {
  if (ws.readyState === WebSocket.CLOSED) return;
  const closed = new Promise((resolve) => ws.once('close', resolve));
  ws.close();
  await closed;
}

describe('public privileged thread route', () => {
  beforeEach(() => {
    mockOwnerEffects.length = 0;
    mockState.threadId = null;
    mockState.activatedThreadId = null;
    mockState.threadManager.openSession.mockClear();
  });

  test('trusted shell performs New Chat, resume, Rename and Delete while Fork stays unavailable', async () => {
    const runtime = await createPublicServer(true);
    const ws = await authenticate(runtime.url);
    await expect(requestMany(ws, { type: 'thread:open-assistant' }, 2)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'thread:created', threadId: 'thread-created' }),
      expect.objectContaining({ type: 'wire_ready', threadId: 'thread-created' }),
    ]));
    await expect(requestMany(ws, {
      type: 'thread:open-assistant', threadId: 'thread-created',
    }, 2)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'thread:opened', threadId: 'thread-created' }),
      expect.objectContaining({ type: 'wire_ready', threadId: 'thread-created' }),
    ]));
    await expect(request(ws, { type: 'thread:rename', threadId: 'thread-created', name: 'Renamed' })).resolves.toMatchObject({ type: 'thread:renamed' });
    await expect(request(ws, { type: 'thread:touch', threadId: 'thread-created' })).resolves.toMatchObject({ type: 'thread:list' });
    ws.send(JSON.stringify({ type: 'thread:warm', threadId: 'thread-created' }));
    await new Promise((resolve) => setImmediate(resolve));
    await expect(request(ws, { type: 'thread:delete', threadId: 'thread-created' })).resolves.toMatchObject({ type: 'thread:deleted' });
    const beforeFork = [...mockOwnerEffects];
    await expect(request(ws, { type: 'thread:fork', sourceThreadId: 'thread-created' })).resolves.toEqual({
      type: 'error', code: 'THREAD_FORK_UNAVAILABLE', message: 'Thread fork is unavailable',
    });
    expect(mockOwnerEffects).toEqual(beforeFork);
    expect(mockOwnerEffects).toEqual(expect.arrayContaining([
      ['open-assistant', null],
      ['open-assistant', 'thread-created'],
      ['rename', 'thread-created'],
      ['touch', 'thread-created'],
      ['warm', 'thread-created'],
      ['delete', 'thread-created'],
      ['provider', 'thread-created'],
    ]));
    await closeClient(ws);
    await runtime.close();
  });

  test('standalone reads work while raw/request-field mutations deny before owners and provider', async () => {
    const runtime = await createPublicServer(false);
    const ws = new WebSocket(runtime.url);
    await expect(nextMessage(ws)).resolves.toEqual({ type: 'workspace:init' });
    await expect(request(ws, { type: 'thread:list' })).resolves.toEqual({ type: 'thread:list', threads: [] });
    await expect(request(ws, { type: 'thread:open', threadId: 'thread-existing' })).resolves.toEqual({
      type: 'thread:opened', threadId: 'thread-existing',
    });
    const readEffects = [...mockOwnerEffects];
    for (const message of [
      { type: 'thread:open-assistant', role: 'trusted-shell', model: { permission: 'all' } },
      { type: 'thread:rename', threadId: 'thread-existing', name: 'No', proof: 'forged' },
      { type: 'thread:delete', threadId: 'thread-existing', trusted: true },
      { type: 'thread:touch', threadId: 'thread-existing', role: 'trusted-shell' },
      { type: 'thread:warm', threadId: 'thread-existing', proof: 'forged' },
    ]) {
      await expect(request(ws, message)).resolves.toEqual({
        type: 'error', code: 'THREAD_MUTATION_DENIED', message: 'Thread mutation denied',
      });
    }
    expect(mockOwnerEffects).toEqual(readEffects);
    expect(mockOwnerEffects).toEqual([['list'], ['open', 'thread-existing']]);
    await closeClient(ws);
    await runtime.close();
  });
});
