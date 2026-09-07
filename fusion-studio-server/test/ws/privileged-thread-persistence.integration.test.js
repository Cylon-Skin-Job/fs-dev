'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { createHmac } = require('node:crypto');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const RENDERER_NONCE = Buffer.alloc(32, 18).toString('base64url');
const WORKSPACE_ID = 'workspace-persistence';
const FOREIGN_WORKSPACE_ID = 'workspace-persistence-foreign';
const providerSpawns = [];
const providerWires = [];
let tempRoot;
let profileRoot;
let projectRoot;
let modules;
function fakeWire(threadId) {
  const wire = new EventEmitter();
  wire.pid = 9001;
  wire.killed = false;
  wire.stdout = new EventEmitter();
  wire.stderr = new EventEmitter();
  wire.stdin = { write: jest.fn() };
  wire.kill = jest.fn((signal) => {
    wire.killed = true;
    wire.signalCode = signal;
    queueMicrotask(() => {
      wire.emit('exit', null, signal);
      wire.emit('close', null, signal);
    });
    return true;
  });
  providerSpawns.push(threadId);
  providerWires.push(wire);
  return wire;
}
function inbox(ws) {
  const messages = [];
  ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  return {
    messages,
    async waitFor(predicate, after = 0, timeoutMs = 3_000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const found = messages.slice(after).find(predicate);
        if (found) return found;
        await new Promise((resolve) => setImmediate(resolve));
      }
      throw new Error('public persistence route response timeout');
    },
    async send(value, predicate) {
      const after = messages.length;
      ws.send(JSON.stringify(value));
      return this.waitFor(predicate, after);
    },
  };
}

async function createRuntime({ generation, master, managed = true }) {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const sessions = new Map();
  const authOwner = managed
    ? modules.createShellAuthOwner({
      authority: { version: 1, generation, master },
      now: () => 1_000,
      randomBytes: () => Buffer.alloc(32, 19),
      ttlMs: 1_000,
    })
    : modules.createShellAuthOwner();
  wss.on('connection', (ws, request) => {
    const session = {
      connectionId: 'connection_persist_00001',
      workspaceBindingState: 'pending-auth',
      currentWorkspaceId: WORKSPACE_ID,
      workspaceEpoch: 'workspace-epoch-persistence',
      projectRoot,
    };
    sessions.set(ws, session);
    const product = modules.createDeferredProductConnection({
      ws,
      build: async () => {
        modules.ThreadWebSocketHandler.setPanel(ws, 'chat', {
          projectRoot,
          viewName: 'chat',
          workspaceId: WORKSPACE_ID,
        });
        const wireLifecycle = modules.createWireLifecycle({
          session,
          ws,
          connectionId: session.connectionId,
          onWireMessage() {},
        });
        const router = modules.createClientMessageRouter({
          ws,
          session,
          connectionId: session.connectionId,
          projectRoot,
          fileExplorer: {},
          wireLifecycle,
          sessions,
          setSessionRoot() {},
          clearSessionRoot() {},
          getProjectRoot: () => projectRoot,
          getFusionHandlers: () => ({}), getClipboardHandlers: () => ({}),
          getBookmarksHandlers: () => ({}), getEmojiRecentsHandlers: () => ({}),
          getThemeHandlers: () => ({}), getSecretsHandlers: () => ({}),
          getScreenshotHandlers: () => ({}),
          handleCanonicalHarnessEvent: async () => {},
        });
        return {
          handleMessage: router.handleClientMessage,
          handleClose: router.handleClientClose,
        };
      },
    });
    const dispatch = modules.createShellAuthDispatch({
      authOwner,
      ws,
      session,
      origin: request.headers.origin,
      now: () => 1_000,
      initialize: async () => {
        await product.initialize();
        session.workspaceBindingState = 'active';
        ws.send(JSON.stringify({ type: 'workspace:init', workspaceId: WORKSPACE_ID }));
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
async function authenticate(url, master) {
  const ws = new WebSocket(url, { origin: 'fusion-shell://app' });
  const messages = inbox(ws);
  const challenge = await messages.waitFor((value) => value.type === 'shell-auth:challenge');
  ws.send(JSON.stringify({
    type: 'shell-auth:proof',
    version: 1,
    connectionId: challenge.connectionId,
    serverNonce: challenge.serverNonce,
    rendererNonce: RENDERER_NONCE,
    generation: challenge.generation,
    expiresAt: challenge.expiresAt,
    proof: createHmac('sha256', master)
      .update(modules.proofInput(challenge, RENDERER_NONCE))
      .digest('base64url'),
  }));
  await messages.waitFor((value) => value.type === 'workspace:init');
  return { ws, ...messages };
}

async function connectStandalone(url) {
  const ws = new WebSocket(url);
  const messages = inbox(ws);
  await messages.waitFor((value) => value.type === 'workspace:init');
  return { ws, ...messages };
}

async function closeClient(ws) {
  if (ws.readyState === WebSocket.CLOSED) return;
  const closed = new Promise((resolve) => ws.once('close', resolve));
  ws.close();
  await closed;
}

beforeAll(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-thread-authority-'));
  profileRoot = path.join(tempRoot, 'profile');
  projectRoot = path.join(tempRoot, 'workspace');
  fs.mkdirSync(projectRoot, { recursive: true });
  process.env.FUSION_APP_USER_DATA = profileRoot;
  process.env.FUSION_LOCAL_MACHINE = 'Test-Thread-Authority';

  jest.resetModules();
  jest.doMock('uuid', () => ({ v4: require('node:crypto').randomUUID }));
  jest.doMock('../../lib/harness/compat', () => ({ spawnThreadWire: fakeWire }));
  const dbModule = require('../../lib/db');
  await dbModule.initDb();
  await dbModule.getDb()('workspaces').whereNot({ id: WORKSPACE_ID }).del();
  await dbModule.getDb()('workspaces').insert({
    id: WORKSPACE_ID,
    label: 'Persistence Workspace',
    repo_path: projectRoot,
    sort_order: 0,
  }).onConflict('id').merge();

  const { createShellAuthOwner, proofInput } = require('../../lib/ws/shell-auth');
  modules = {
    ...dbModule,
    createShellAuthOwner,
    proofInput,
    createShellAuthDispatch: require('../../lib/ws/shell-auth-dispatch').createShellAuthDispatch,
    createDeferredProductConnection: require('../../lib/ws/deferred-product-connection').createDeferredProductConnection,
    createClientMessageRouter: require('../../lib/ws/client-message-router').createClientMessageRouter,
    createWireLifecycle: require('../../lib/wire/process-manager').createWireLifecycle,
    ThreadIndex: require('../../lib/thread/ThreadIndex').ThreadIndex,
    ThreadWebSocketHandler: require('../../lib/thread').ThreadWebSocketHandler,
  };
});

afterAll(async () => {
  if (modules) await modules.closeDb();
  delete process.env.FUSION_APP_USER_DATA;
  delete process.env.FUSION_LOCAL_MACHINE;
  fs.rmSync(tempRoot, { recursive: true, force: true });
  jest.dontMock('../../lib/harness/compat');
  jest.dontMock('uuid');
});

test('managed trusted route mutates real SQLite and markdown through New, resume, Rename, and Delete', async () => {
  const firstMaster = Buffer.alloc(32, 17);
  const firstRuntime = await createRuntime({
    generation: 'generation_persist_00001',
    master: firstMaster,
  });
  const firstClient = await authenticate(firstRuntime.url, firstMaster);
  let threadId;
  let mirror;
  try {
    const created = await firstClient.send(
      { type: 'thread:open-assistant' },
      (value) => value.type === 'thread:created',
    );
    threadId = created.threadId;
    await firstClient.waitFor((value) => value.type === 'wire_ready' && value.threadId === threadId);

    const db = modules.getDb();
    const createdRow = await db('threads').where({ thread_id: threadId }).first();
    expect(createdRow).toMatchObject({ workspace_id: WORKSPACE_ID, harness_id: 'opencode' });
    mirror = path.join(
      projectRoot, 'ai', 'Test-Thread-Authority', 'Data', 'Chatlogs', 'threads', `${threadId}.md`,
    );
    expect(fs.existsSync(mirror)).toBe(true);

    await db('workspaces').insert({
      id: FOREIGN_WORKSPACE_ID, label: 'Foreign Persistence Workspace',
      repo_path: path.join(tempRoot, 'foreign-workspace'), sort_order: 1,
    }).onConflict('id').merge();
    const foreignThreadId = 'foreign-thread-owned-by-workspace-b';
    const foreignIndex = new modules.ThreadIndex(FOREIGN_WORKSPACE_ID);
    await foreignIndex.create(foreignThreadId, 'Foreign thread', { harnessId: 'opencode' });
    const foreignSnapshot = await db('threads').where({ thread_id: foreignThreadId }).first();
    const crossWorkspaceSnapshot = {
      threadCount: await db('threads').count({ count: '*' }).first(),
      validRow: await db('threads').where({ thread_id: threadId }).first(),
      validMirror: fs.readFileSync(mirror, 'utf8'),
      spawns: [...providerSpawns],
      wires: providerWires.map((wire) => wire.killed),
    };
    for (const foreignRequest of [
      { type: 'thread:open', threadId: foreignThreadId },
      { type: 'thread:open-assistant', threadId: foreignThreadId },
      { type: 'thread:rename', threadId: foreignThreadId, name: 'Cross-workspace rename' },
      { type: 'thread:delete', threadId: foreignThreadId },
      { type: 'thread:touch', threadId: foreignThreadId },
      { type: 'thread:warm', threadId: foreignThreadId },
      { type: 'prompt', threadId: foreignThreadId, user_input: 'cross-workspace prompt' },
    ]) {
      await expect(firstClient.send(
        foreignRequest,
        (value) => value.type === 'error',
      )).resolves.toMatchObject({ type: 'error' });
    }
    expect(await db('threads').where({ thread_id: foreignThreadId }).first()).toEqual(foreignSnapshot);
    expect(await db('threads').count({ count: '*' }).first()).toEqual(crossWorkspaceSnapshot.threadCount);
    expect(await db('threads').where({ thread_id: threadId }).first()).toEqual(crossWorkspaceSnapshot.validRow);
    expect(fs.readFileSync(mirror, 'utf8')).toBe(crossWorkspaceSnapshot.validMirror);
    expect(providerSpawns).toEqual(crossWorkspaceSnapshot.spawns);
    expect(providerWires.map((wire) => wire.killed)).toEqual(crossWorkspaceSnapshot.wires);

    const beforeRejectedConfig = {
      count: await db('threads').count({ count: '*' }).first(),
      mirror: fs.readFileSync(mirror, 'utf8'),
      spawns: [...providerSpawns],
    };
    for (const rejectedRequest of [
      {
        type: 'thread:open-assistant',
        harnessConfig: { pendingFork: { sourceOpenCodeSessionId: 'provider-session' } },
      },
      { type: 'thread:open-assistant', harnessConfig: { opencodeSessionId: 'provider-session' } },
      { type: 'thread:open-assistant', harnessConfig: { apiKey: 'credential-canary' } },
      { type: 'thread:open-assistant', providerSessionId: 'unknown-alias' },
    ]) {
      await expect(firstClient.send(
        rejectedRequest,
        (value) => value.type === 'error',
      )).resolves.toMatchObject({ code: 'THREAD_MUTATION_DENIED' });
    }
    expect(await db('threads').count({ count: '*' }).first()).toEqual(beforeRejectedConfig.count);
    expect(fs.readFileSync(mirror, 'utf8')).toBe(beforeRejectedConfig.mirror);
    expect(providerSpawns).toEqual(beforeRejectedConfig.spawns);

    const standaloneRuntime = await createRuntime({ managed: false });
    const standalone = await connectStandalone(standaloneRuntime.url);
    const passiveSnapshot = await db('threads').where({ thread_id: threadId }).first();
    const passiveMirror = fs.readFileSync(mirror, 'utf8');
    const passiveSpawns = [...providerSpawns];
    try {
      await standalone.send(
        { type: 'thread:open', threadId },
        (value) => value.type === 'thread:opened' && value.threadId === threadId,
      );
      expect(await db('threads').where({ thread_id: threadId }).first()).toEqual(passiveSnapshot);
      expect(fs.readFileSync(mirror, 'utf8')).toBe(passiveMirror);

      for (const denied of [
        { type: 'thread:touch', threadId, role: 'trusted-shell' },
        { type: 'thread:warm', threadId, proof: 'forged' },
      ]) {
        await expect(standalone.send(denied, (value) => value.type === 'error')).resolves.toMatchObject({
          code: 'THREAD_MUTATION_DENIED',
        });
      }
      expect(await db('threads').where({ thread_id: threadId }).first()).toEqual(passiveSnapshot);
      expect(fs.readFileSync(mirror, 'utf8')).toBe(passiveMirror);
      expect(providerSpawns).toEqual(passiveSpawns);
    } finally {
      await closeClient(standalone.ws);
      await standaloneRuntime.close();
    }
    expect(await db('threads').where({ thread_id: threadId }).first()).toEqual(passiveSnapshot);
    expect(fs.readFileSync(mirror, 'utf8')).toBe(passiveMirror);
    expect(providerSpawns).toEqual(passiveSpawns);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await firstClient.send(
      { type: 'thread:open-assistant', threadId },
      (value) => value.type === 'thread:opened' && value.threadId === threadId,
    );
    await firstClient.waitFor((value) => value.type === 'wire_ready' && value.threadId === threadId);
    const resumedRow = await db('threads').where({ thread_id: threadId }).first();
    expect(resumedRow.resumed_at).toEqual(expect.any(String));
    expect(resumedRow.updated_at).toBeGreaterThan(createdRow.updated_at);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await firstClient.send(
      { type: 'thread:touch', threadId },
      (value) => value.type === 'thread:list',
    );
    const touchedRow = await db('threads').where({ thread_id: threadId }).first();
    expect(touchedRow.updated_at).toBeGreaterThan(resumedRow.updated_at);

  } finally {
    await closeClient(firstClient.ws);
    await firstRuntime.close();
  }

  const secondMaster = Buffer.alloc(32, 27);
  const secondRuntime = await createRuntime({
    generation: 'generation_persist_00002',
    master: secondMaster,
  });
  const secondClient = await authenticate(secondRuntime.url, secondMaster);
  try {
    const listed = await secondClient.send(
      { type: 'thread:list' },
      (value) => value.type === 'thread:list',
    );
    expect(listed.threads.map((thread) => thread.threadId)).toContain(threadId);
    await secondClient.send(
      { type: 'thread:open-assistant', threadId },
      (value) => value.type === 'thread:opened' && value.threadId === threadId,
    );
    await secondClient.waitFor((value) => value.type === 'wire_ready' && value.threadId === threadId);

    await secondClient.send(
      { type: 'thread:rename', threadId, name: 'Trusted persisted rename' },
      (value) => value.type === 'thread:renamed' && value.threadId === threadId,
    );
    const db = modules.getDb();
    expect(await db('threads').where({ thread_id: threadId }).first()).toMatchObject({
      name: 'Trusted persisted rename',
    });
    expect(fs.readFileSync(mirror, 'utf8')).toContain('Trusted persisted rename');

    const beforeFork = {
      row: await db('threads').where({ thread_id: threadId }).first(),
      mirror: fs.readFileSync(mirror, 'utf8'),
      spawns: [...providerSpawns],
    };
    await expect(secondClient.send(
      { type: 'thread:fork', sourceThreadId: threadId },
      (value) => value.type === 'error',
    )).resolves.toMatchObject({ code: 'THREAD_FORK_UNAVAILABLE' });
    expect(await db('threads').where({ thread_id: threadId }).first()).toEqual(beforeFork.row);
    expect(fs.readFileSync(mirror, 'utf8')).toBe(beforeFork.mirror);
    expect(providerSpawns).toEqual(beforeFork.spawns);

    await secondClient.send(
      { type: 'thread:delete', threadId },
      (value) => value.type === 'thread:deleted' && value.threadId === threadId,
    );
    expect(await db('threads').where({ thread_id: threadId }).first()).toBeUndefined();
    expect(fs.existsSync(mirror)).toBe(false);
    // New Chat spawns once; same-launch active resume reuses that exact wire;
    // the fresh server generation owns one new provider after restart.
    expect(providerSpawns).toEqual([threadId, threadId]);
  } finally {
    await closeClient(secondClient.ws);
    await secondRuntime.close();
  }
});
