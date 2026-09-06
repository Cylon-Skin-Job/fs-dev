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

const { createWorkspaceBroadcaster } = require('../../lib/ws/workspace-broadcaster');

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
});
