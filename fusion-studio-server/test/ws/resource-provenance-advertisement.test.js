'use strict';

jest.mock('../../lib/workspace/workspace-controller', () => ({
  listWorkspaces: jest.fn(async () => []),
  getActiveWorkspaceId: jest.fn(() => null),
  getActiveWorkspaceBindingRevision: jest.fn(() => 1),
}));
jest.mock('../../lib/cli-config', () => ({
  resolveCliConfig: jest.fn(async () => ({})),
}));
jest.mock('../../lib/workspace/workspace-state', () => ({
  get: jest.fn(() => null),
}));
jest.mock('../../lib/views', () => ({
  listViews: jest.fn(() => []),
}));
jest.mock('../../lib/workspace/ai-paths', () => ({
  getLocalMachineName: jest.fn(() => 'test-machine'),
  getSystemStylesRoot: jest.fn(() => '/unused'),
}));

const { buildWorkspaceInit } = require('../../lib/ws/connection-init');
const workspaceController = require('../../lib/workspace/workspace-controller');
const workspaceState = require('../../lib/workspace/workspace-state');
const readinessRuntime = require('../../lib/views/readiness-runtime');
const { installHistoricalReadinessFixture } = require('../views/historical-readiness-fixture');

describe('resource provenance protocol advertisement', () => {
  afterEach(() => {
    installHistoricalReadinessFixture('test-machine');
    workspaceController.listWorkspaces.mockResolvedValue([]);
    workspaceController.listWorkspaces.mockClear();
    workspaceState.get.mockReturnValue(null);
    workspaceState.get.mockClear();
  });

  test('initial workspace bind advertises v1 with the captured pair', async () => {
    const message = await buildWorkspaceInit(() => null, {
      workspaceId: 'workspace-A',
      workspaceEpoch: '123e4567-e89b-42d3-a456-426614174000',
      bindingRevision: 7,
      repoPath: null,
    });

    expect(message).toMatchObject({
      type: 'workspace:init',
      workspaceId: 'workspace-A',
      workspaceEpoch: '123e4567-e89b-42d3-a456-426614174000',
      bindingRevision: 7,
      fileSaveProtocolVersion: 1,
      resourceProvenanceProtocolVersion: 1,
      agentActivityProtocolVersion: 1,
      fileViewerReadProtocolVersion: 1,
    });
  });

  test('initial hydration waits for workspace readiness before reading view state', async () => {
    workspaceController.listWorkspaces.mockResolvedValue([
      { id: 'workspace-A', repoPath: '/workspace-A', type: 'code' },
    ]);
    workspaceState.get.mockReturnValue({ currentPanel: 'file-viewer' });
    let signalEntered;
    let release;
    const entered = new Promise(resolve => { signalEntered = resolve; });
    const ready = new Promise(resolve => { release = resolve; });
    readinessRuntime.installViewReadinessOwner({
      async ensureReady() {
        signalEntered();
        await ready;
        return { status: 'verified' };
      },
      acquireLease: () => ({ phase: 'journal_verified', verified: true, release: jest.fn() }),
      getStatus: () => ({ status: 'ready', verified: true }),
    });

    const hydration = buildWorkspaceInit(() => null, { repoPath: null });
    await entered;
    expect(workspaceState.get).not.toHaveBeenCalled();
    release();
    await expect(hydration).resolves.toMatchObject({
      workspaceStates: { 'workspace-A': { currentPanel: 'file-viewer' } },
    });
    expect(workspaceState.get).toHaveBeenCalledTimes(1);
  });

  test('initial hydration publishes bounded unavailable without reading legacy view state', async () => {
    workspaceController.listWorkspaces.mockResolvedValue([
      { id: 'workspace-A', repoPath: '/workspace-A', type: 'code' },
    ]);
    readinessRuntime.installViewReadinessOwner({
      ensureReady: async () => { throw new Error('private conflict detail'); },
      acquireLease: () => { throw new Error('unreachable'); },
      getStatus: () => ({ status: 'unavailable', verified: false }),
    });

    await expect(buildWorkspaceInit(() => null, { repoPath: null })).resolves.toMatchObject({
      workspaceStates: {},
      unavailableViewRegistries: {
        'workspace-A': { code: 'view_registry_unavailable' },
      },
    });
    expect(workspaceState.get).not.toHaveBeenCalled();
  });
});
