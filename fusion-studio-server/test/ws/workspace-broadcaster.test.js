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
jest.mock('../../lib/ws/connection-init', () => ({
  buildPanelConfig: jest.fn((projectRoot) => ({ type: 'panel_config', projectRoot })),
}));
jest.mock('../../lib/workspace/ai-paths', () => ({
  getSystemStylesRoot: jest.fn((root) => `${root}/ai/styles`),
}));
jest.mock('../../lib/thread/ThreadWebSocketHandler', () => ({
  retireWorkspaceBinding: jest.fn(async () => true),
  getState: jest.fn(),
}));

const { createWorkspaceBroadcaster } = require('../../lib/ws/workspace-broadcaster');
const { runWorkspaceOperation } = require('../../lib/ws/workspace-operation-lease');
const ThreadWebSocketHandler = require('../../lib/thread/ThreadWebSocketHandler');

function session() {
  return {
    currentWorkspaceId: 'A',
    workspaceEpoch: '123e4567-e89b-42d3-a456-426614174000',
    projectRoot: '/A',
    workspaceBindingState: 'active',
    workspaceReplyFlushState: 'idle',
    workspaceReplyBuffer: [],
    workspaceReplyBufferBytes: 0,
  };
}

function socket({ failFirst = false } = {}) {
  return {
    readyState: 1,
    sent: [],
    closes: [],
    send(payload, callback) {
      this.sent.push(payload);
      callback?.(failFirst && this.sent.length === 1 ? new Error('send failed') : undefined);
    },
    close(code, reason) {
      this.closes.push([code, reason]);
      this.readyState = 3;
    },
  };
}

describe('workspace broadcaster bind integration', () => {
  beforeEach(() => {
    mockListeners.clear();
    ThreadWebSocketHandler.retireWorkspaceBinding.mockClear();
    ThreadWebSocketHandler.getState.mockReset();
  });

  test('thread lifecycle reaches only the exact active workspace/root/epoch manager binding', () => {
    const wsA = socket();
    const wsB = socket();
    const stateA = session();
    const stateB = { ...session(), currentWorkspaceId: 'B', projectRoot: '/B' };
    ThreadWebSocketHandler.getState.mockImplementation((ws) => ws === wsA
      ? { workspaceRetired: false, threadManager: { workspaceId: 'A', projectRoot: '/A' } }
      : { workspaceRetired: false, threadManager: { workspaceId: 'B', projectRoot: '/B' } });
    createWorkspaceBroadcaster({
      getAllClients: () => [wsA, wsB],
      getClientByConnectionId: () => null,
      getSessionForClient: (ws) => ws === wsA ? stateA : stateB,
    });

    mockListeners.get('thread:state_changed')({
      workspace: 'workspace:A', workspaceId: 'A', projectRoot: '/A',
      workspaceEpoch: stateA.workspaceEpoch, threadId: 'same-id', turnId: 'turn-a',
      state: 'in_flight', previousState: null,
    });

    expect(wsA.sent.map(JSON.parse)).toEqual([expect.objectContaining({
      type: 'thread:state_changed', workspaceId: 'A', threadId: 'same-id', turnId: 'turn-a',
    })]);
    expect(wsB.sent).toEqual([]);
  });

  test('workspace switch sends a fresh pair before activation and panel configuration', async () => {
    const ws = socket();
    const state = session();
    createWorkspaceBroadcaster({
      getAllClients: () => [ws],
      getClientByConnectionId: () => null,
      getSessionForClient: () => state,
    });
    await mockListeners.get('workspace:switched')({ from: 'A', to: 'B', repoPath: '/B' });

    const sent = ws.sent.map((value) => JSON.parse(value));
    expect(sent[0]).toMatchObject({
      type: 'workspace:switched', from: 'A', to: 'B', repoPath: '/B',
      workspaceId: 'B', fileSaveProtocolVersion: 1, resourceProvenanceProtocolVersion: 1,
      fileViewerReadProtocolVersion: 1,
    });
    expect(sent[0].workspaceEpoch).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    expect(sent[1]).toEqual({ type: 'panel_config', projectRoot: '/B' });
    expect(state).toMatchObject({
      currentWorkspaceId: 'B', workspaceEpoch: sent[0].workspaceEpoch,
      projectRoot: '/B', workspaceBindingState: 'active',
    });
    expect(ThreadWebSocketHandler.retireWorkspaceBinding).toHaveBeenCalledWith(ws, state);
  });

  test('bind-frame send failure closes for reconnect and suppresses panel configuration', async () => {
    const ws = socket({ failFirst: true });
    const state = session();
    createWorkspaceBroadcaster({
      getAllClients: () => [ws],
      getClientByConnectionId: () => null,
      getSessionForClient: () => state,
    });
    await mockListeners.get('workspace:switched')({ from: 'A', to: 'B', repoPath: '/B' });
    expect(ws.sent).toHaveLength(1);
    expect(ws.closes[0][0]).toBe(1011);
    expect(state.workspaceBindingState).toBe('binding');
  });

  test('workspace binding waits for an already-admitted bounded operation', async () => {
    const ws = socket();
    const state = session();
    createWorkspaceBroadcaster({
      getAllClients: () => [ws],
      getClientByConnectionId: () => null,
      getSessionForClient: () => state,
    });
    const effects = [];
    let releaseOperation;
    const mayFinish = new Promise(resolve => { releaseOperation = resolve; });
    let markStarted;
    const started = new Promise(resolve => { markStarted = resolve; });
    const operation = runWorkspaceOperation(ws, () => true, async () => {
      effects.push('operation-start');
      markStarted();
      await mayFinish;
      effects.push('operation-finish');
    });
    await started;

    const switched = mockListeners.get('workspace:switched')({ from: 'A', to: 'B', repoPath: '/B' });
    await Promise.resolve();
    expect(state.workspaceBindingState).toBe('active');
    expect(effects).toEqual(['operation-start']);

    releaseOperation();
    await Promise.all([operation, switched]);
    expect(effects).toEqual(['operation-start', 'operation-finish']);
    expect(state).toMatchObject({
      currentWorkspaceId: 'B', projectRoot: '/B', workspaceBindingState: 'active',
    });
  });

  test('workspace binding sends no new-workspace frame before provider retirement completes', async () => {
    const ws = socket();
    const state = session();
    let finishRetirement;
    const providerRetired = new Promise(resolve => { finishRetirement = resolve; });
    ThreadWebSocketHandler.retireWorkspaceBinding.mockImplementationOnce(() => providerRetired);
    createWorkspaceBroadcaster({
      getAllClients: () => [ws],
      getClientByConnectionId: () => null,
      getSessionForClient: () => state,
    });

    const switched = mockListeners.get('workspace:switched')({ from: 'A', to: 'B', repoPath: '/B' });
    await new Promise(resolve => setImmediate(resolve));

    expect(ws.sent).toEqual([]);
    expect(state).toMatchObject({ currentWorkspaceId: 'A', projectRoot: '/A' });

    finishRetirement(true);
    await switched;
    expect(JSON.parse(ws.sent[0])).toMatchObject({
      type: 'workspace:switched', to: 'B', repoPath: '/B',
    });
    expect(state).toMatchObject({ currentWorkspaceId: 'B', projectRoot: '/B' });
  });
});
