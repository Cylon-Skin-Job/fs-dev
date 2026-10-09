'use strict';

const { createWorkspaceRibbonHandlers } = require('../../lib/workspace/workspace-ribbon');

function makeWorkspace(id, overrides = {}) {
  return {
    id,
    label: id,
    repoPath: `/repo/${id}`,
    repo_path: `/repo/${id}`,
    sortOrder: overrides.sortOrder ?? 0,
    ribbonVisible: overrides.ribbonVisible ?? true,
    ribbonSortOrder: overrides.ribbonSortOrder ?? overrides.sortOrder ?? 0,
    ...overrides,
  };
}

function makeHarness(initialWorkspaces, initialActiveId = null) {
  let workspaces = initialWorkspaces.map(workspace => ({ ...workspace }));
  let activeWorkspaceId = initialActiveId;
  let activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId) || null;
  let bindingRevision = 0;
  const emitted = [];

  const registry = {
    getById: jest.fn(async id => workspaces.find(workspace => workspace.id === id) || null),
    list: jest.fn(async () => workspaces.map(workspace => ({ ...workspace }))),
    maxRibbonSortOrder: jest.fn(async () => Math.max(
      -1,
      ...workspaces
        .filter(workspace => workspace.ribbonVisible !== false)
        .map(workspace => workspace.ribbonSortOrder ?? workspace.sortOrder)
    )),
    updateRibbonVisibility: jest.fn(async (id, visible) => {
      workspaces = workspaces.map(workspace =>
        workspace.id === id ? { ...workspace, ribbonVisible: visible } : workspace
      );
    }),
    updateRibbonMembership: jest.fn(async (id, { visible, ribbonSortOrder }) => {
      workspaces = workspaces.map(workspace =>
        workspace.id === id ? { ...workspace, ribbonVisible: visible, ribbonSortOrder } : workspace
      );
    }),
    updateRibbonSortOrders: jest.fn(async ids => {
      workspaces = workspaces.map(workspace => {
        const nextIndex = ids.indexOf(workspace.id);
        return nextIndex === -1 ? workspace : { ...workspace, ribbonSortOrder: nextIndex };
      });
    }),
  };

  const writeLastActive = jest.fn(async () => {});

  const handlers = createWorkspaceRibbonHandlers({
    registry,
    emit: (type, payload) => emitted.push({ type, payload }),
    getActiveWorkspaceId: () => activeWorkspaceId,
    setActiveWorkspace: (id, workspace) => {
      activeWorkspaceId = id;
      activeWorkspace = workspace;
      bindingRevision += 1;
      return bindingRevision;
    },
    writeLastActive,
  });

  return {
    handlers,
    registry,
    writeLastActive,
    emitted,
    getActiveWorkspaceId: () => activeWorkspaceId,
    getActiveWorkspace: () => activeWorkspace,
  };
}

describe('workspace ribbon handlers', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('removes a non-active workspace from the ribbon', async () => {
    const alpha = makeWorkspace('alpha', { sortOrder: 0 });
    const beta = makeWorkspace('beta', { sortOrder: 1 });
    const harness = makeHarness([alpha, beta], 'alpha');

    await harness.handlers.handleRibbonRemoveRequested({ workspaceId: 'beta' });

    expect(harness.registry.updateRibbonVisibility).toHaveBeenCalledWith('beta', false);
    expect(harness.getActiveWorkspaceId()).toBe('alpha');
    expect(harness.writeLastActive).not.toHaveBeenCalled();
    expect(harness.emitted.map(event => event.type)).toEqual([
      'workspace:registry_changed',
      'workspace:ribbon_removed',
    ]);
  });

  test('falls back to the closest visible ribbon workspace when removing the active one', async () => {
    const alpha = makeWorkspace('alpha', { sortOrder: 0 });
    const beta = makeWorkspace('beta', { sortOrder: 1 });
    const gamma = makeWorkspace('gamma', { sortOrder: 2 });
    const harness = makeHarness([alpha, beta, gamma], 'beta');

    await harness.handlers.handleRibbonRemoveRequested({ workspaceId: 'beta' });

    expect(harness.getActiveWorkspaceId()).toBe('gamma');
    expect(harness.getActiveWorkspace()).toMatchObject({ id: 'gamma' });
    expect(harness.writeLastActive).toHaveBeenCalledWith('gamma');
    expect(harness.emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'workspace:switched',
        payload: { bindingRevision: 1, from: 'beta', to: 'gamma', repoPath: '/repo/gamma' },
      }),
      expect.objectContaining({
        type: 'workspace:ribbon_removed',
        payload: { workspaceId: 'beta' },
      }),
    ]));
  });

  test('clears active workspace when the last ribbon workspace is removed', async () => {
    const alpha = makeWorkspace('alpha');
    const harness = makeHarness([alpha], 'alpha');

    await harness.handlers.handleRibbonRemoveRequested({ workspaceId: 'alpha' });

    expect(harness.getActiveWorkspaceId()).toBeNull();
    expect(harness.getActiveWorkspace()).toBeNull();
    expect(harness.writeLastActive).toHaveBeenCalledWith(null);
    expect(harness.emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'workspace:switched',
        payload: { bindingRevision: 1, from: 'alpha', to: null, repoPath: null },
      }),
    ]));
  });

  test('adding to the ribbon restores the workspace when no active workspace exists', async () => {
    const alpha = makeWorkspace('alpha', { ribbonVisible: false, ribbonSortOrder: 0 });
    const harness = makeHarness([alpha], null);

    await harness.handlers.handleRibbonAddRequested({ workspaceId: 'alpha' });

    expect(harness.registry.updateRibbonMembership).toHaveBeenCalledWith('alpha', {
      visible: true,
      ribbonSortOrder: 0,
    });
    expect(harness.getActiveWorkspaceId()).toBe('alpha');
    expect(harness.writeLastActive).toHaveBeenCalledWith('alpha');
    expect(harness.emitted.map(event => event.type)).toEqual([
      'workspace:registry_changed',
      'workspace:switched',
    ]);
  });

  test('rejects invalid ribbon reorder payloads', async () => {
    const alpha = makeWorkspace('alpha', { sortOrder: 0 });
    const beta = makeWorkspace('beta', { sortOrder: 1 });
    const harness = makeHarness([alpha, beta], 'alpha');

    await harness.handlers.handleRibbonReorderRequested({
      workspaceIds: ['alpha', 'alpha'],
      connectionId: 'connection-1',
    });

    expect(harness.registry.updateRibbonSortOrders).not.toHaveBeenCalled();
    expect(harness.emitted).toEqual([
      {
        type: 'workspace:ribbon_reorder_rejected',
        payload: {
          connectionId: 'connection-1',
          message: 'Ribbon reorder workspaceIds must be unique non-empty strings.',
        },
      },
    ]);
  });

  test('reorders exactly the visible ribbon workspaces and emits registry changes', async () => {
    const alpha = makeWorkspace('alpha', { sortOrder: 0 });
    const beta = makeWorkspace('beta', { sortOrder: 1 });
    const hidden = makeWorkspace('hidden', { sortOrder: 2, ribbonVisible: false });
    const harness = makeHarness([alpha, beta, hidden], 'alpha');

    await harness.handlers.handleRibbonReorderRequested({
      workspaceIds: ['beta', 'alpha'],
      connectionId: 'connection-1',
    });

    expect(harness.registry.updateRibbonSortOrders).toHaveBeenCalledWith(['beta', 'alpha']);
    expect(harness.emitted).toHaveLength(1);
    expect(harness.emitted[0]).toMatchObject({
      type: 'workspace:registry_changed',
      payload: {
        workspaces: expect.arrayContaining([
          expect.objectContaining({ id: 'beta', ribbonSortOrder: 0 }),
          expect.objectContaining({ id: 'alpha', ribbonSortOrder: 1 }),
          expect.objectContaining({ id: 'hidden', ribbonVisible: false }),
        ]),
      },
    });
  });
});
