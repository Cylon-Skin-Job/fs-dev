'use strict';

const mockListeners = new Map();

jest.mock('../../lib/event-bus', () => ({
  on: jest.fn((type, handler) => {
    mockListeners.set(type, handler);
    return () => mockListeners.delete(type);
  }),
}));
jest.mock('../../lib/workspace/registry-service', () => ({
  getById: jest.fn(async (id) => ({ id, type: 'code' })),
}));
jest.mock('../../lib/theme/themes-service', () => ({
  list: jest.fn(async () => []),
}));
jest.mock('../../lib/workspace/ai-paths', () => ({
  getSystemStylesRoot: jest.fn((root) => `${root}/ai/styles`),
}));
jest.mock('../../lib/ws/connection-init', () => ({
  buildPanelConfig: jest.fn((projectRoot) => ({ type: 'panel_config', projectRoot })),
}));

const http = require('node:http');
const { createHmac } = require('node:crypto');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { createHarnessBroadcaster } = require('../../lib/ws/harness-broadcaster');
const { createWorkspaceBroadcaster } = require('../../lib/ws/workspace-broadcaster');
const { createProductSessionRegistry } = require('../../lib/ws/product-session-registry');
const { createShellAuthDispatch } = require('../../lib/ws/shell-auth-dispatch');
const { createShellAuthOwner, proofInput } = require('../../lib/ws/shell-auth');
const { beginWorkspaceBind, completeWorkspaceBind } = require('../../lib/ws/workspace-session');

const MASTER = Buffer.alloc(32, 7);
const GENERATION = 'generation_auth_000001';
const RENDERER_NONCE = Buffer.alloc(32, 9).toString('base64url');

function trackMessages(ws) {
  const received = [];
  ws.on('message', (data) => received.push(JSON.parse(data.toString())));
  return received;
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('condition timeout');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function proofFor(challenge) {
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

describe('pending shell recipient isolation', () => {
  test('harness and workspace fan-out sees only activated initialized sessions', async () => {
    const sessions = new Map();
    const registry = createProductSessionRegistry({ sessions });
    const pendingSessions = [];
    let connectionSequence = 0;
    let randomSequence = 0;
    const authOwner = createShellAuthOwner({
      authority: { version: 1, generation: GENERATION, master: MASTER },
      now: () => 1_000,
      randomBytes: () => Buffer.alloc(32, ++randomSequence),
    });
    const server = http.createServer();
    const wss = new WebSocketServer({ server });

    createHarnessBroadcaster({ getAllClients: registry.getAllClients });
    createWorkspaceBroadcaster({
      getAllClients: registry.getAllClients,
      getClientByConnectionId: registry.getClientByConnectionId,
      getSessionForClient: registry.getSessionForClient,
    });

    wss.on('connection', (ws, request) => {
      const session = {
        connectionId: `connection_auth_00000${++connectionSequence}`,
        connectionRole: 'untrusted',
        projectRoot: null,
        currentWorkspaceId: null,
        workspaceEpoch: null,
        workspaceBindingState: 'pending-auth',
        workspaceReplyFlushState: 'idle',
        workspaceReplyBuffer: [],
        workspaceReplyBufferBytes: 0,
      };
      pendingSessions.push(session);
      const dispatch = createShellAuthDispatch({
        authOwner,
        ws,
        session,
        origin: request.headers.origin,
        initialize: async () => {
          const pair = beginWorkspaceBind(session, { workspaceId: 'A', repoPath: '/A' });
          const initialized = await completeWorkspaceBind(ws, session, { type: 'workspace:init' }, pair);
          if (!initialized) throw new Error('workspace initialization failed');
        },
        activate: () => registry.activate({ ws, session, managed: true }),
        handleNext: jest.fn(),
        now: () => 1_000,
      });
      ws.on('message', dispatch);
      ws.on('close', () => sessions.delete(ws));
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `ws://127.0.0.1:${server.address().port}`;
    const raw = new WebSocket(url);
    const rawMessages = trackMessages(raw);
    const custom = new WebSocket(url, { origin: 'fusion-studio://workspace/custom' });
    const customMessages = trackMessages(custom);

    try {
      await waitFor(() => rawMessages.length === 1 && customMessages.length === 1 && pendingSessions.length === 2);
      expect(rawMessages[0].type).toBe('shell-auth:challenge');
      expect(customMessages[0].type).toBe('shell-auth:challenge');
      const pendingSnapshots = pendingSessions.map((session) => JSON.stringify(session));

      mockListeners.get('harness:status_changed')({ id: 'opencode', installed: true });
      await mockListeners.get('workspace:switched')({
        bindingRevision: 1, from: 'A', to: 'B', repoPath: '/B',
      });

      expect(rawMessages).toHaveLength(1);
      expect(customMessages).toHaveLength(1);
      expect(pendingSessions.map((session) => JSON.stringify(session))).toEqual(pendingSnapshots);
      expect(sessions.size).toBe(0);

      const trusted = new WebSocket(url, { origin: 'fusion-shell://app' });
      const trustedMessages = trackMessages(trusted);
      await waitFor(() => trustedMessages.length === 1 && pendingSessions.length === 3);
      trusted.send(JSON.stringify(proofFor(trustedMessages[0])));
      await waitFor(() => trustedMessages.some((message) => message.type === 'shell-auth:authenticated'));
      expect(sessions.size).toBe(1);
      expect(pendingSessions[2]).toMatchObject({
        connectionRole: 'trusted-shell',
        workspaceBindingState: 'active',
        currentWorkspaceId: 'A',
        projectRoot: '/A',
      });

      mockListeners.get('harness:status_changed')({ id: 'opencode', installed: false });
      await mockListeners.get('workspace:switched')({
        bindingRevision: 2, from: 'A', to: 'B', repoPath: '/B',
      });
      await waitFor(() => trustedMessages.some((message) => message.type === 'panel_config'));
      expect(trustedMessages).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'harness:status_changed', id: 'opencode', installed: false }),
        expect.objectContaining({ type: 'workspace:switched', from: 'A', to: 'B', repoPath: '/B' }),
        { type: 'panel_config', projectRoot: '/B' },
      ]));
      expect(pendingSessions[2]).toMatchObject({
        connectionRole: 'trusted-shell',
        workspaceBindingState: 'active',
        currentWorkspaceId: 'B',
        projectRoot: '/B',
      });
      expect(rawMessages).toHaveLength(1);
      expect(customMessages).toHaveLength(1);
      trusted.terminate();
      await waitFor(() => sessions.size === 0);

      const customClosed = new Promise((resolve) => custom.once('close', resolve));
      custom.send(JSON.stringify(proofFor(customMessages[0])));
      await customClosed;
      expect(sessions.size).toBe(0);
    } finally {
      raw.terminate();
      custom.terminate();
      for (const client of wss.clients) client.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
