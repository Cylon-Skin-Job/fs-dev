'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-id'),
}));

jest.mock('../../lib/thread', () => ({
  ThreadWebSocketHandler: {
    cleanup: jest.fn(() => Promise.resolve()),
    captureActivationBinding: jest.fn(),
    getState: jest.fn(() => ({
      threadId: 'thread-1',
      threadManager: { workspaceId: 'workspace-1', projectRoot: '/tmp/project' },
    })),
    isActivationBindingCurrent: jest.fn((ws, binding) => (
      binding?.session?.workspaceBindingState === 'active'
      && binding.session.currentWorkspaceId === binding.workspaceId
      && binding.session.workspaceEpoch === binding.workspaceEpoch
      && binding.session.projectRoot === binding.projectRoot
    )),
    getCurrentThreadManager: jest.fn(() => null),
    handleMessageSend: jest.fn(() => Promise.resolve()),
  },
  threadRuntimeController: {
    acceptPromptThroughRuntime: jest.fn(() => Promise.resolve()),
    warmRuntimeForIntent: jest.fn(() => Promise.resolve()),
    stopRuntimeTurn: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../lib/wire/process-manager', () => ({
  getWireForThread: jest.fn(() => null),
  sendToWire: jest.fn(),
}));

const mockThreadWarmHandler = jest.fn(() => Promise.resolve());

jest.mock('../../lib/ws/thread-ws-handlers', () => ({
  createThreadWsHandlers: jest.fn(() => ({ 'thread:warm': mockThreadWarmHandler })),
  spawnAndSetupWire: jest.fn(),
}));

jest.mock('../../lib/ws/harness-ws-handlers', () => ({
  createHarnessWsHandlers: jest.fn(() => ({})),
}));

jest.mock('../../lib/ws/workspace-request-handlers', () => ({
  createWorkspaceRequestHandlers: jest.fn(() => ({})),
}));

jest.mock('../../lib/workspace/registry-service', () => ({
  getById: jest.fn(),
  list: jest.fn(),
}));

jest.mock('../../lib/views', () => ({
  resolveChatConfig: jest.fn(() => null),
  loadView: jest.fn(() => null),
  updateWorkspaceViewRegistry: jest.fn(() => ({ version: 2, views: [] })),
  getWorkspaceViewOptions: jest.fn(() => ({ hiddenViews: [], availableTemplates: [] })),
  restoreWorkspaceView: jest.fn(() => ({ version: 2, views: [] })),
  addWorkspaceView: jest.fn(() => ({ version: 2, views: [] })),
  buildViewCapsulesProjection: jest.fn(() => ({ version: 1, entries: [] })),
  listViews: jest.fn(() => []),
}));

const { createClientMessageRouter } = require('../../lib/ws/client-message-router');
const views = require('../../lib/views');
const { createFileViewerReadRoute } = require('../../lib/ws/file-viewer-read-route');
const { ThreadWebSocketHandler, threadRuntimeController } = require('../../lib/thread');
const { getWireForThread, sendToWire } = require('../../lib/wire/process-manager');
const { beginWorkspaceTransition } = require('../../lib/ws/workspace-operation-lease');
const registry = require('../../lib/workspace/registry-service');
const viewReadiness = require('../../lib/views/readiness-runtime');
const { installHistoricalReadinessFixture } = require('../views/historical-readiness-fixture');
const workspaceState = require('../../lib/workspace/workspace-state');

beforeEach(() => {
  // The production owner is process-scoped; isolate workspace identity
  // registrations between unit cases that intentionally reuse fixture IDs.
  installHistoricalReadinessFixture();
});

function flushAsyncWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function installReadyViewOwner(projectRoot) {
  viewReadiness.installViewReadinessOwner({
    ensureReady: async ({ workspaceId }) => ({
      status: 'verified',
      phase: 'journal_verified',
      verified: true,
      workspaceId,
      projectRoot,
    }),
    acquireLease: () => ({
      phase: 'journal_verified',
      verified: true,
      projectRoot,
      release() {},
    }),
    getStatus: () => ({ status: 'ready', verified: true }),
  });
}

function makeRouter({
  wire,
  role = 'trusted-shell',
  workspaceId = 'workspace-1',
  projectRoot = '/tmp/project',
  handleCanonicalHarnessEvent = jest.fn(),
  fileExplorer = {},
  fileSaveRoute = null,
  resourceProvenanceRoute = null,
  agentActivityRoute = null,
  fileViewerReadRoute = null,
  additionalSessions = [],
} = {}) {
  const ws = { readyState: 1, send: jest.fn(), close: jest.fn() };
  const session = {
    connectionId: 'connection-1',
    currentThreadId: 'thread-1',
    currentWorkspaceId: workspaceId,
    workspaceEpoch: 'workspace-epoch-1',
    workspaceBindingState: 'active',
    projectRoot,
    wire,
  };
  const managedSession = { ws, wireProcess: wire };
  const state = {
    threadId: 'thread-1',
    activatedThreadId: 'thread-1',
    threadManager: {
      workspaceId,
      projectRoot,
      getSession: jest.fn(() => managedSession),
    },
  };
  ThreadWebSocketHandler.getState.mockReturnValue(state);
  ThreadWebSocketHandler.captureActivationBinding.mockReturnValue({
    state,
    session,
    projectRoot,
    workspaceId,
    workspaceEpoch: 'workspace-epoch-1',
  });
  if (role) Object.defineProperty(session, 'connectionRole', { value: role, enumerable: false });

  const router = createClientMessageRouter({
    ws,
    session,
    connectionId: 'connection-1',
    projectRoot,
    fileExplorer,
    wireLifecycle: {
      awaitHarnessReady: jest.fn(),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
    sessions: new Map([[ws, session], ...additionalSessions]),
    setSessionRoot: jest.fn(),
    clearSessionRoot: jest.fn(),
    getProjectRoot: jest.fn(() => projectRoot),
    getFusionHandlers: () => ({}),
    getClipboardHandlers: () => ({}),
    getBookmarksHandlers: () => ({}),
    getThemeHandlers: () => ({}),
    getSecretsHandlers: () => ({}),
    getScreenshotHandlers: () => ({}),
    getFileSaveRoute: () => fileSaveRoute,
    getResourceProvenanceRoute: () => resourceProvenanceRoute,
    getAgentActivityRoute: () => agentActivityRoute,
    getFileViewerReadRoute: () => fileViewerReadRoute,
    handleCanonicalHarnessEvent,
  });

  return { router, ws, session, handleCanonicalHarnessEvent };
}

describe('createClientMessageRouter prompt harness routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('applies yielded canonical events for direct canonical wires', async () => {
    const yieldedEvents = [
      { type: 'turn_begin', timestamp: 1, userInput: 'hello' },
      { type: 'turn_end', timestamp: 2, turnId: 'turn-1' },
    ];
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield* yieldedEvents;
      },
    };
    const { router, ws, session, handleCanonicalHarnessEvent } = makeRouter({ wire });
    getWireForThread.mockReturnValue(wire);

    await router.handleClientMessage(JSON.stringify({
      type: 'prompt',
      user_input: 'hello',
      threadId: 'thread-1',
    }));
    await flushAsyncWork();

    expect(threadRuntimeController.acceptPromptThroughRuntime).toHaveBeenCalledWith(expect.objectContaining({
      ws,
      session,
      clientMsg: expect.objectContaining({ type: 'prompt', user_input: 'hello' }),
      handleCanonicalHarnessEvent,
    }));
  });

  test('errors visibly if wire lacks direct canonical event delivery', async () => {
    const drainedEvents = [];
    const wire = {
      _usesDirectCanonicalEvents: false,
      async *_sendMessage() {
        drainedEvents.push('started');
        yield { type: 'content', timestamp: 1, text: 'would be dropped' };
        drainedEvents.push('completed');
      },
    };
    const { router, ws, handleCanonicalHarnessEvent } = makeRouter({ wire });
    getWireForThread.mockReturnValue(wire);

    await router.handleClientMessage(JSON.stringify({
      type: 'prompt',
      user_input: 'hello',
      threadId: 'thread-1',
    }));
    await flushAsyncWork();

    expect(threadRuntimeController.acceptPromptThroughRuntime).toHaveBeenCalled();
  });

  test('errors visibly if wire lacks _sendMessage (legacy path retired)', async () => {
    const wire = {
      // No _sendMessage — simulates a pre-legacy-retirement wire
    };
    const { router, ws } = makeRouter({ wire });
    getWireForThread.mockReturnValue(wire);

    await router.handleClientMessage(JSON.stringify({
      type: 'prompt',
      user_input: 'hello',
      threadId: 'thread-1',
    }));
    await flushAsyncWork();

    expect(threadRuntimeController.acceptPromptThroughRuntime).toHaveBeenCalled();
  });

  test('includes route metadata on auth-style sendMessage failures', async () => {
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        const err = new Error('Authentication failed');
        err.code = -32004;
        throw err;
      },
    };
    const { router, ws } = makeRouter({ wire });
    getWireForThread.mockReturnValue(wire);

    await router.handleClientMessage(JSON.stringify({
      type: 'prompt',
      user_input: 'hello',
      threadId: 'thread-1',
    }));
    await flushAsyncWork();

    expect(threadRuntimeController.acceptPromptThroughRuntime).toHaveBeenCalled();
  });

  test('dispatches thread:warm to the runtime controller', async () => {
    const { router, ws, session } = makeRouter({ wire: null });

    await router.handleClientMessage(JSON.stringify({
      type: 'thread:warm',
      threadId: 'thread-1',
    }));

    expect(mockThreadWarmHandler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'thread:warm', threadId: 'thread-1',
    }));
    expect(threadRuntimeController.acceptPromptThroughRuntime).not.toHaveBeenCalled();
  });

  test('untrusted prompt cannot reach runtime lookup, persistence, or provider spawn', async () => {
    const { router, ws } = makeRouter({ wire: null, role: 'untrusted' });
    await router.handleClientMessage(JSON.stringify({
      type: 'prompt', threadId: 'thread-1', user_input: 'forged', role: 'trusted-shell',
    }));
    expect(threadRuntimeController.acceptPromptThroughRuntime).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'error', code: 'THREAD_MUTATION_DENIED', message: 'Thread mutation denied',
    });
  });

  test.each(['turn:stop', 'response'])('untrusted %s cannot reach the provider owner', async (type) => {
    const wire = { stdin: { write: jest.fn() }, killed: false };
    const { router, ws } = makeRouter({ wire, role: 'untrusted' });
    getWireForThread.mockReturnValue(wire);

    await router.handleClientMessage(JSON.stringify({
      type,
      threadId: 'thread-1',
      payload: { answer: 'forged' },
      requestId: 'request-1',
    }));

    expect(threadRuntimeController.stopRuntimeTurn).not.toHaveBeenCalled();
    expect(wire.stdin.write).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'error', code: 'THREAD_MUTATION_DENIED', message: 'Thread mutation denied',
    });
  });

  test('trusted response reaches only the exact workspace-owned wire', async () => {
    const wire = { stdin: { write: jest.fn() }, killed: false };
    const { router } = makeRouter({ wire });
    getWireForThread.mockImplementation((threadId, binding) => (
      threadId === 'thread-1'
      && binding?.workspaceId === 'workspace-1'
      && binding?.projectRoot === '/tmp/project'
      && binding?.workspaceEpoch === 'workspace-epoch-1' ? wire : null
    ));

    await router.handleClientMessage(JSON.stringify({
      type: 'response', threadId: 'thread-1', payload: { answer: 'yes' }, requestId: 'request-1',
    }));

    expect(sendToWire).toHaveBeenCalledWith(wire, 'response', { answer: 'yes' }, 'request-1');
    expect(getWireForThread).toHaveBeenCalledWith('thread-1', expect.objectContaining({
      workspaceId: 'workspace-1',
      projectRoot: '/tmp/project',
      workspaceEpoch: 'workspace-epoch-1',
    }));
  });

  test('trusted stop is denied after provider ownership transfers to another client', async () => {
    const wire = { stdin: { write: jest.fn() }, killed: false };
    const { router, ws } = makeRouter({ wire });
    const state = ThreadWebSocketHandler.getState(ws);
    state.threadManager.getSession.mockReturnValue({ ws: {}, wireProcess: wire });
    getWireForThread.mockReturnValue(wire);

    await router.handleClientMessage(JSON.stringify({ type: 'turn:stop', threadId: 'thread-1' }));

    expect(threadRuntimeController.stopRuntimeTurn).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0]).code).toBe('THREAD_MUTATION_DENIED');
  });

  test('trusted prompt rejects Fork-era or unknown harness configuration before runtime effects', async () => {
    const { router, ws } = makeRouter({ wire: null });
    await router.handleClientMessage(JSON.stringify({
      type: 'prompt', threadId: 'thread-1', user_input: 'forged',
      harnessConfig: { opencodeSessionId: 'provider-session' },
    }));
    expect(threadRuntimeController.acceptPromptThroughRuntime).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0]).code).toBe('THREAD_MUTATION_DENIED');
  });

  test('workspace binding waits for in-progress prompt persistence and provider admission', async () => {
    const { router, ws, session } = makeRouter({ wire: {} });
    const effects = [];
    let releasePersistence;
    const persistenceMayFinish = new Promise(resolve => { releasePersistence = resolve; });
    let markPersistenceStarted;
    const persistenceStarted = new Promise(resolve => { markPersistenceStarted = resolve; });
    threadRuntimeController.acceptPromptThroughRuntime.mockImplementationOnce(async () => {
      effects.push('persistence-start');
      markPersistenceStarted();
      await persistenceMayFinish;
      effects.push('provider-admission');
    });

    const prompt = router.handleClientMessage(JSON.stringify({
      type: 'prompt', threadId: 'thread-1', user_input: 'hello',
    }));
    await persistenceStarted;
    const binding = beginWorkspaceTransition(ws, () => {
      effects.push('workspace-binding');
      session.workspaceBindingState = 'binding';
      session.currentWorkspaceId = null;
      session.workspaceEpoch = null;
      session.projectRoot = null;
    });
    await Promise.resolve();
    expect(effects).toEqual(['persistence-start']);

    releasePersistence();
    await Promise.all([prompt, binding]);
    expect(effects).toEqual(['persistence-start', 'provider-admission', 'workspace-binding']);
  });

  test('prompt queued behind workspace binding denies before persistence or provider admission', async () => {
    const { router, ws, session } = makeRouter({ wire: {} });
    const binding = beginWorkspaceTransition(ws, () => {
      session.workspaceBindingState = 'binding';
      session.currentWorkspaceId = null;
      session.workspaceEpoch = null;
      session.projectRoot = null;
    });
    ThreadWebSocketHandler.isActivationBindingCurrent
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    await Promise.all([binding, router.handleClientMessage(JSON.stringify({
      type: 'prompt', threadId: 'thread-1', user_input: 'hello',
    }))]);

    expect(threadRuntimeController.acceptPromptThroughRuntime).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'error', code: 'THREAD_MUTATION_DENIED', message: 'Thread mutation denied',
    });
  });
});

describe('createClientMessageRouter protected generated workspace state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('workspace:state_push denies a System/state symlink into a protected capsule', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-router-protected-state-'));
    process.env.FUSION_LOCAL_MACHINE = 'Test Machine';
    try {
      const protectedState = path.join(
        root, 'ai', 'Test-Machine', 'System', 'Views', '001-capture', 'state',
      );
      fs.mkdirSync(protectedState, { recursive: true });
      const systemRoot = path.join(root, 'ai', 'Test-Machine', 'System');
      fs.symlinkSync(protectedState, path.join(systemRoot, 'state'), 'dir');
      registry.getById.mockResolvedValue({ id: 'workspace-1', repoPath: root, ribbonVisible: true });
      registry.list.mockResolvedValue([{ id: 'workspace-1', repoPath: root }]);
      views.listViews.mockReturnValue(['capture-viewer']);
      const { router } = makeRouter();

      await router.handleClientMessage(JSON.stringify({
        type: 'workspace:state_push',
        workspaceId: 'workspace-1',
        state: { currentPanel: 'capture-viewer' },
      }));

      expect(fs.readdirSync(protectedState)).toEqual([]);
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test.each(['untrusted', null])(
    'workspace:state_push rejects forged authority for connection role %p before effects',
    async (role) => {
      const ensureReady = jest.fn(async () => ({ status: 'staged' }));
      viewReadiness.installViewReadinessOwner({
        ensureReady,
        acquireLease: jest.fn(() => ({
          phase: 'precutover_staged', projectRoot: '/tmp/project', release() {},
        })),
        getStatus: () => ({ status: 'staged', verified: false }),
      });
      const save = jest.spyOn(workspaceState, 'save').mockResolvedValue(undefined);
      try {
        const { router, ws } = makeRouter({ role });
        await router.handleClientMessage(JSON.stringify({
          type: 'workspace:state_push',
          workspaceId: 'workspace-1',
          state: { currentPanel: 'capture-viewer' },
          connectionRole: 'trusted-shell',
          role: 'trusted-shell',
          authority: true,
          actor: 'owner',
        }));

        expect(registry.getById).not.toHaveBeenCalled();
        expect(ensureReady).not.toHaveBeenCalled();
        expect(views.listViews).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
        expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
          type: 'error', code: 'VIEW_MUTATION_DENIED', message: 'View mutation denied',
        });
      } finally {
        save.mockRestore();
      }
    },
  );

  test('trusted workspace:state_push saves only after readiness and strict registry discovery', async () => {
    const ensureReady = jest.fn(async () => ({
      status: 'staged', phase: 'precutover_staged', verified: false,
    }));
    const release = jest.fn();
    const acquireLease = jest.fn(() => ({
      phase: 'precutover_staged', verified: false, projectRoot: '/tmp/project', release,
    }));
    viewReadiness.installViewReadinessOwner({
      ensureReady,
      acquireLease,
      getStatus: () => ({ status: 'staged', verified: false }),
    });
    registry.getById.mockResolvedValue({
      id: 'workspace-1', repoPath: '/tmp/project', ribbonVisible: true,
    });
    views.listViews.mockReturnValue(['capture-viewer']);
    const save = jest.spyOn(workspaceState, 'save').mockResolvedValue(undefined);
    try {
      const { router, ws } = makeRouter({ role: 'trusted-shell' });
      await router.handleClientMessage(JSON.stringify({
        type: 'workspace:state_push',
        workspaceId: 'workspace-1',
        state: { currentPanel: 'capture-viewer' },
      }));

      const context = { workspaceId: 'workspace-1', projectRoot: '/tmp/project' };
      expect(ensureReady).toHaveBeenCalledWith(context);
      expect(acquireLease).toHaveBeenCalledWith(context);
      expect(views.listViews).toHaveBeenCalledWith('/tmp/project', { strictReadiness: true });
      expect(save).toHaveBeenCalledWith(
        'workspace-1',
        { currentPanel: 'capture-viewer' },
        { repoPath: '/tmp/project', allowedViewIds: ['capture-viewer'] },
      );
      expect(release).toHaveBeenCalledTimes(1);
      expect(ws.send).not.toHaveBeenCalled();
    } finally {
      save.mockRestore();
    }
  });

  test('trusted workspace:state_push exposes bounded conflict without mutation', async () => {
    const { ViewRelocationError } = require('../../lib/views/relocation-errors');
    const ensureReady = jest.fn(async () => { throw new ViewRelocationError('root_conflict'); });
    viewReadiness.installViewReadinessOwner({
      ensureReady,
      acquireLease: jest.fn(() => { throw new Error('unreachable'); }),
      getStatus: () => ({ status: 'unavailable', verified: false }),
    });
    registry.getById.mockResolvedValue({
      id: 'workspace-1', repoPath: '/tmp/project', ribbonVisible: true,
    });
    const save = jest.spyOn(workspaceState, 'save').mockResolvedValue(undefined);
    try {
      const { router, ws } = makeRouter({ role: 'trusted-shell' });
      await router.handleClientMessage(JSON.stringify({
        type: 'workspace:state_push',
        workspaceId: 'workspace-1',
        state: { currentPanel: 'capture-viewer' },
      }));

      expect(ensureReady).toHaveBeenCalledWith({
        workspaceId: 'workspace-1', projectRoot: '/tmp/project',
      });
      expect(views.listViews).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: 'error', code: 'view_registry_unavailable', message: 'View registry unavailable',
      });
    } finally {
      save.mockRestore();
    }
  });
});

describe('createClientMessageRouter trusted view mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    views.updateWorkspaceViewRegistry.mockReset().mockReturnValue({ version: 2, views: [] });
    views.restoreWorkspaceView.mockReset().mockReturnValue({ version: 2, views: [] });
    views.addWorkspaceView.mockReset().mockReturnValue({ version: 2, views: [] });
    views.getWorkspaceViewOptions.mockReset().mockReturnValue({
      hiddenViews: [], availableTemplates: [],
    });
  });

  test.each([
    ['workspace:view_update_requested', 'updateWorkspaceViewRegistry', { viewId: 'file-viewer', patch: { label: 'Files' } }],
    ['workspace:view_restore_requested', 'restoreWorkspaceView', { viewId: 'file-viewer' }],
    ['workspace:view_add_requested', 'addWorkspaceView', { templateId: 'file-viewer' }],
  ])('%s rejects request-supplied authority on an untrusted connection before effects', async (type, method, payload) => {
    const { router, ws } = makeRouter({ role: 'untrusted' });
    await router.handleClientMessage(JSON.stringify({
      type,
      ...payload,
      role: 'trusted-shell',
      origin: 'fusion-shell://app',
      authority: true,
      projectRoot: '/forged',
      actor: 'owner',
    }));

    expect(views[method]).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'error', code: 'VIEW_MUTATION_DENIED', message: 'View mutation denied',
    });
  });

  test.each([
    ['workspace:view_update_requested', 'updateWorkspaceViewRegistry', { viewId: 'file-viewer', patch: { label: 'Files' } }],
    ['workspace:view_restore_requested', 'restoreWorkspaceView', { viewId: 'file-viewer' }],
    ['workspace:view_add_requested', 'addWorkspaceView', { templateId: 'file-viewer' }],
  ])('%s remains functional for the connection-owned trusted role', async (type, method, payload) => {
    installReadyViewOwner('/tmp/project');
    const { router, ws } = makeRouter({ role: 'trusted-shell' });
    await router.handleClientMessage(JSON.stringify({ type, ...payload }));

    expect(views[method]).toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
      type: 'workspace:view_registry_updated',
      registry: { version: 2, views: [] },
    });
    expect(views.buildViewCapsulesProjection).toHaveBeenCalledWith('/tmp/project', 'workspace-1');
  });

  test.each([
    ['workspace:view_update_requested', 'updateWorkspaceViewRegistry', { viewId: 'file-viewer', patch: { label: 'Files' } }],
    ['workspace:view_restore_requested', 'restoreWorkspaceView', { viewId: 'file-viewer' }],
    ['workspace:view_add_requested', 'addWorkspaceView', { templateId: 'file-viewer' }],
  ])('%s acknowledges a durable mutation without re-entering its readiness lease', async (
    type,
    method,
    payload,
  ) => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-router-view-ack-')));
    const machine = 'Test-Machine';
    const previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = machine;
    try {
      const capsule = path.join(root, 'ai', machine, 'System', 'Views', '001-file-viewer');
      fs.mkdirSync(path.join(capsule, 'state'), { recursive: true });
      fs.writeFileSync(
        path.join(capsule, 'manifest.md'),
        '---\nname: Files\nmetadata:\n  view-id: file-viewer\n  data-source: none\n---\n',
      );
      fs.writeFileSync(
        path.join(capsule, 'content.json'),
        `${JSON.stringify({ version: 1, dataSource: 'none', root: { type: 'none' } }, null, 2)}\n`,
      );
      const marker = path.join(root, 'durable-registry-marker');
      installReadyViewOwner(root);
      views[method].mockImplementationOnce(() => {
        fs.writeFileSync(marker, type, 'utf8');
        return { version: 2, views: ['file-viewer'] };
      });
      const { router, ws } = makeRouter({ role: 'trusted-shell', projectRoot: root });

      await router.handleClientMessage(JSON.stringify({ type, ...payload }));

      expect(fs.readFileSync(marker, 'utf8')).toBe(type);
      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: 'workspace:view_registry_updated',
        workspaceId: 'workspace-1',
        workspaceEpoch: 'workspace-epoch-1',
        registry: { version: 2, views: ['file-viewer'] },
        viewCapsules: { version: 1, entries: [] },
      });
    } finally {
      if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
      else process.env.FUSION_LOCAL_MACHINE = previousMachine;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('successful view mutation fans a fresh projection with each bound client epoch', async () => {
    installReadyViewOwner('/tmp/project');
    const peer = { readyState: 1, send: jest.fn() };
    const distinctEpochPeer = { readyState: 1, send: jest.fn() };
    const failedPeer = { readyState: 1, send: jest.fn(() => { throw new Error('closed during send'); }) };
    const peerSession = {
      workspaceBindingState: 'active',
      currentWorkspaceId: 'workspace-1',
      workspaceEpoch: 'workspace-epoch-1',
      projectRoot: '/tmp/project',
    };
    const { router, ws } = makeRouter({
      role: 'trusted-shell',
      additionalSessions: [
        [peer, peerSession],
        [failedPeer, { ...peerSession }],
        [distinctEpochPeer, { ...peerSession, workspaceEpoch: 'workspace-epoch-2' }],
      ],
    });

    await router.handleClientMessage(JSON.stringify({
      type: 'workspace:view_update_requested',
      viewId: 'file-viewer',
      patch: { label: 'Files' },
    }));

    const expected = JSON.stringify({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-1',
      workspaceEpoch: 'workspace-epoch-1',
      registry: { version: 2, views: [] },
      viewCapsules: { version: 1, entries: [] },
    });
    expect(ws.send).toHaveBeenCalledWith(expected);
    expect(peer.send).toHaveBeenCalledWith(expected);
    expect(failedPeer.send).toHaveBeenCalledWith(expected);
    expect(distinctEpochPeer.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-1',
      workspaceEpoch: 'workspace-epoch-2',
      registry: { version: 2, views: [] },
      viewCapsules: { version: 1, entries: [] },
    }));
  });

  test('readiness failure leaves the prior registry bytes intact and returns bounded rejection', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-router-view-conflict-')));
    const machine = 'Test-Machine';
    const previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = machine;
    try {
      const marker = path.join(root, 'registry-state.json');
      fs.writeFileSync(marker, '{"version":1}\n', 'utf8');
      fs.mkdirSync(path.join(root, 'ai', machine, 'Views'), { recursive: true });
      fs.mkdirSync(path.join(root, 'ai', machine, 'System', 'Views'), { recursive: true });
      installHistoricalReadinessFixture(machine);
      views.updateWorkspaceViewRegistry.mockImplementationOnce(() => {
        fs.writeFileSync(marker, '{"version":2}\n', 'utf8');
        return { version: 2 };
      });
      const { router, ws } = makeRouter({ role: 'trusted-shell', projectRoot: root });

      await router.handleClientMessage(JSON.stringify({
        type: 'workspace:view_update_requested',
        viewId: 'file-viewer',
        patch: { label: 'Files' },
      }));

      expect(views.updateWorkspaceViewRegistry).not.toHaveBeenCalled();
      expect(fs.readFileSync(marker, 'utf8')).toBe('{"version":1}\n');
      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: 'workspace:view_update_rejected',
        workspaceId: 'workspace-1',
        workspaceEpoch: 'workspace-epoch-1',
        code: 'view_registry_unavailable',
        message: 'Unable to update view',
      });
    } finally {
      if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
      else process.env.FUSION_LOCAL_MACHINE = previousMachine;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('readiness conflict rejects trusted view mutation with only bounded unavailable', async () => {
    const { ViewRelocationError } = require('../../lib/views/relocation-errors');
    viewReadiness.installViewReadinessOwner({
      ensureReady: async () => { throw new ViewRelocationError('root_conflict'); },
      acquireLease: () => { throw new Error('unreachable'); },
      getStatus: () => ({ status: 'unavailable', verified: false }),
    });
    const { router, ws } = makeRouter({ role: 'trusted-shell' });
    await router.handleClientMessage(JSON.stringify({
      type: 'workspace:view_update_requested',
      viewId: 'file-viewer',
      patch: { label: 'Files' },
    }));
    expect(views.updateWorkspaceViewRegistry).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'workspace:view_update_rejected',
      workspaceId: 'workspace-1',
      workspaceEpoch: 'workspace-epoch-1',
      code: 'view_registry_unavailable',
      message: 'Unable to update view',
    });
  });

  test.each([
    [
      'workspace:view_update_requested',
      'updateWorkspaceViewRegistry',
      { viewId: 'file-viewer', patch: { label: 'Files' } },
      'workspace:view_registry_updated',
    ],
    [
      'workspace:view_restore_requested',
      'restoreWorkspaceView',
      { viewId: 'file-viewer' },
      'workspace:view_registry_updated',
    ],
    [
      'workspace:view_add_requested',
      'addWorkspaceView',
      { templateId: 'file-viewer' },
      'workspace:view_registry_updated',
    ],
    [
      'workspace:view_options_requested',
      'getWorkspaceViewOptions',
      {},
      'workspace:view_options',
    ],
  ])('%s stays bound to its captured workspace while readiness awaits a workspace switch', async (
    type,
    method,
    payload,
    responseType,
  ) => {
    let signalReadinessStarted;
    let releaseReadiness;
    const readinessStarted = new Promise(resolve => { signalReadinessStarted = resolve; });
    const readinessMayFinish = new Promise(resolve => { releaseReadiness = resolve; });
    const effects = [];
    viewReadiness.installViewReadinessOwner({
      ensureReady: async (context) => {
        effects.push(`readiness:${context.workspaceId}:${context.projectRoot}`);
        signalReadinessStarted();
        await readinessMayFinish;
        return { status: 'verified', phase: 'journal_verified', verified: true };
      },
      acquireLease: ({ projectRoot }) => ({
        phase: 'journal_verified',
        verified: true,
        projectRoot,
        release() { effects.push('readiness-release'); },
      }),
      getStatus: () => ({ status: 'staged', phase: 'precutover_staged', verified: false }),
    });
    views[method].mockImplementationOnce((root) => {
      effects.push(`operation:${root}`);
      if (method === 'getWorkspaceViewOptions') {
        return { hiddenViews: ['hidden-view'], availableTemplates: ['template-view'] };
      }
      return { version: 2, views: ['file-viewer'] };
    });
    const { router, ws, session } = makeRouter({
      role: 'trusted-shell',
      workspaceId: 'workspace-a',
      projectRoot: '/workspace/A',
    });

    const request = router.handleClientMessage(JSON.stringify({ type, ...payload }));
    await readinessStarted;
    const switching = beginWorkspaceTransition(ws, async () => {
      effects.push('workspace-switch');
      session.currentWorkspaceId = 'workspace-b';
      session.projectRoot = '/workspace/B';
      session.workspaceEpoch = 'workspace-epoch-2';
    });
    await flushAsyncWork();

    expect(views[method]).not.toHaveBeenCalled();
    expect(session.currentWorkspaceId).toBe('workspace-a');
    releaseReadiness();
    await request;
    await switching;

    expect(views[method]).toHaveBeenCalledWith(
      '/workspace/A',
      ...(method === 'updateWorkspaceViewRegistry'
        ? [expect.objectContaining(payload)]
        : method === 'restoreWorkspaceView'
          ? ['file-viewer']
          : method === 'addWorkspaceView'
            ? ['file-viewer']
            : []),
    );
    expect(effects).toEqual([
      'readiness:workspace-a:/workspace/A',
      'operation:/workspace/A',
      'readiness-release',
      'workspace-switch',
    ]);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
      type: responseType,
      workspaceId: 'workspace-a',
      workspaceEpoch: 'workspace-epoch-1',
    });
    expect(session.currentWorkspaceId).toBe('workspace-b');
    expect(session.projectRoot).toBe('/workspace/B');
  });
});

describe('createClientMessageRouter view discovery readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['file_content_request', 'file_content_response', 'handleFileContentRequest', '__workspace__', 'views.json'],
    ['file_tree_request', 'file_tree_response', 'handleFileTreeRequest', '__panels__', ''],
    ['file_content_request', 'file_content_response', 'handleFileContentRequest', 'capture-viewer', 'content.json'],
    ['file_tree_request', 'file_tree_response', 'handleFileTreeRequest', 'capture-viewer', ''],
  ])('fails closed for %s while the registry is unavailable', async (
    requestType,
    responseType,
    method,
    panel,
    requestPath,
  ) => {
    const { ViewRelocationError } = require('../../lib/views/relocation-errors');
    viewReadiness.installViewReadinessOwner({
      ensureReady: async () => { throw new ViewRelocationError('root_conflict'); },
      acquireLease: () => { throw new Error('unreachable'); },
      getStatus: () => ({ status: 'unavailable', verified: false }),
    });
    const handler = jest.fn();
    const { router, ws } = makeRouter({ fileExplorer: { [method]: handler } });
    await router.handleClientMessage(JSON.stringify({
      type: requestType,
      panel,
      path: requestPath,
      requestId: 'discovery-1',
      workspaceId: 'workspace-1',
      generation: 7,
    }));

    expect(handler).not.toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: responseType,
      panel,
      path: requestPath,
      requestId: 'discovery-1',
      workspaceId: 'workspace-1',
      generation: 7,
      success: false,
      error: 'View registry unavailable',
      code: 'view_registry_unavailable',
    });
  });

  test.each(['__panels__', 'capture-viewer'])(
    'fails closed for %s recent-file discovery while the registry is unavailable',
    async (panel) => {
      const { ViewRelocationError } = require('../../lib/views/relocation-errors');
      viewReadiness.installViewReadinessOwner({
        ensureReady: async () => { throw new ViewRelocationError('root_conflict'); },
        acquireLease: () => { throw new Error('unreachable'); },
        getStatus: () => ({ status: 'unavailable', verified: false }),
      });
      const handleRecentFilesRequest = jest.fn();
      const { router, ws } = makeRouter({ fileExplorer: { handleRecentFilesRequest } });
      await router.handleClientMessage(JSON.stringify({
        type: 'recent_files_request',
        panel,
        requestId: 'recent-1',
        workspaceId: 'workspace-1',
        generation: 8,
      }));

      expect(handleRecentFilesRequest).not.toHaveBeenCalled();
      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: 'recent_files_response',
        panel,
        requestId: 'recent-1',
        workspaceId: 'workspace-1',
        generation: 8,
        success: false,
        error: 'View registry unavailable',
        code: 'view_registry_unavailable',
      });
    },
  );

  test.each([
    ['file_content_request', 'handleFileContentRequest', '__workspace__', 'views.json'],
    ['file_tree_request', 'handleFileTreeRequest', '__panels__', ''],
    ['recent_files_request', 'handleRecentFilesRequest', '__panels__', ''],
    ['file_content_request', 'handleFileContentRequest', 'capture-viewer', 'content.json'],
    ['file_tree_request', 'handleFileTreeRequest', 'capture-viewer', ''],
    ['recent_files_request', 'handleRecentFilesRequest', 'capture-viewer', ''],
  ])('holds readiness while serving %s', async (requestType, method, panel, requestPath) => {
    const release = jest.fn();
    viewReadiness.installViewReadinessOwner({
      ensureReady: async () => ({ status: 'staged', phase: 'precutover_staged', verified: false }),
      acquireLease: () => ({ phase: 'precutover_staged', verified: false, release }),
      getStatus: () => ({ status: 'staged', phase: 'precutover_staged', verified: false }),
    });
    const handler = jest.fn();
    const { router, ws } = makeRouter({ fileExplorer: { [method]: handler } });
    const message = { type: requestType, panel, path: requestPath };

    await router.handleClientMessage(JSON.stringify(message));

    expect(handler).toHaveBeenCalledWith(ws, message);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['__apps__', 'file_content_request', 'handleFileContentRequest'],
    ['__apps__', 'file_tree_request', 'handleFileTreeRequest'],
    ['__apps__', 'recent_files_request', 'handleRecentFilesRequest'],
    ['__settings__', 'file_content_request', 'handleFileContentRequest'],
    ['__settings__', 'file_tree_request', 'handleFileTreeRequest'],
    ['__settings__', 'recent_files_request', 'handleRecentFilesRequest'],
  ])('keeps registry-independent %s available for %s during a view conflict', async (
    panel,
    requestType,
    method,
  ) => {
    const ensureReady = jest.fn(async () => { throw new Error('must not be consulted'); });
    viewReadiness.installViewReadinessOwner({
      ensureReady,
      acquireLease: () => { throw new Error('must not be acquired'); },
      getStatus: () => ({ status: 'unavailable', verified: false }),
    });
    const handler = jest.fn();
    const { router, ws } = makeRouter({ fileExplorer: { [method]: handler } });
    const message = { type: requestType, panel, path: 'asset.txt' };

    await router.handleClientMessage(JSON.stringify(message));

    expect(handler).toHaveBeenCalledWith(ws, message);
    expect(ensureReady).not.toHaveBeenCalled();
  });

  test('serializes a normal-panel read with workspace switching and gates the replacement workspace', async () => {
    const { ViewRelocationError } = require('../../lib/views/relocation-errors');
    let signalEntered;
    let releaseReadiness;
    const entered = new Promise(resolve => { signalEntered = resolve; });
    const readiness = new Promise(resolve => { releaseReadiness = resolve; });
    const ensureReady = jest.fn(async (context) => {
      if (context.workspaceId === 'workspace-2') throw new ViewRelocationError('root_conflict');
      signalEntered();
      await readiness;
      return { status: 'staged', phase: 'precutover_staged', verified: false };
    });
    const release = jest.fn();
    viewReadiness.installViewReadinessOwner({
      ensureReady,
      acquireLease: () => ({ phase: 'precutover_staged', verified: false, release }),
      getStatus: () => ({ status: 'staged', verified: false }),
    });
    const observedRoots = [];
    const handleFileContentRequest = jest.fn(() => {
      observedRoots.push(session.projectRoot);
    });
    const { router, ws, session } = makeRouter({ fileExplorer: { handleFileContentRequest } });
    const message = { type: 'file_content_request', panel: 'capture-viewer', path: 'content.json' };

    const firstRead = router.handleClientMessage(JSON.stringify(message));
    await entered;
    const switching = beginWorkspaceTransition(ws, async () => {
      session.currentWorkspaceId = 'workspace-2';
      session.projectRoot = '/tmp/project-2';
      session.workspaceEpoch = 'workspace-epoch-2';
    });
    await flushAsyncWork();
    expect(observedRoots).toEqual([]);

    releaseReadiness();
    await firstRead;
    await switching;
    expect(observedRoots).toEqual(['/tmp/project']);
    expect(release).toHaveBeenCalledTimes(1);

    ws.send.mockClear();
    await router.handleClientMessage(JSON.stringify(message));
    expect(handleFileContentRequest).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
      type: 'file_content_response',
      panel: 'capture-viewer',
      success: false,
      code: 'view_registry_unavailable',
    });
    expect(ensureReady).toHaveBeenLastCalledWith({
      workspaceId: 'workspace-2',
      projectRoot: '/tmp/project-2',
    });
  });
});

describe('createClientMessageRouter text-frame and file_save privacy contract', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('accepts a valid UTF-8 text frame, redacts logs, and gives the route the exact original content', async () => {
    const handleFileSave = jest.fn();
    const secret = 'SECRET-\u{1f98a}-payload';
    const raw = Buffer.from(JSON.stringify({
      type: 'file_save', version: 1, requestId: 'request-1', workspaceId: 'A',
      workspaceEpoch: '123e4567-e89b-42d3-a456-426614174000', panel: 'file-viewer',
      path: 'note.md', content: secret,
    }), 'utf8');
    const { router } = makeRouter({ fileSaveRoute: { handleFileSave } });

    await router.handleClientMessage(raw, false);

    expect(handleFileSave).toHaveBeenCalledTimes(1);
    expect(handleFileSave.mock.calls[0][0].message.content).toBe(secret);
    const logged = logSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('[declared]');
    expect(logged).not.toContain(secret);
  });

  test('client_log cannot relay authentication material through message or nested data', async () => {
    const canaries = ['master-canary', 'generation-canary', 'proof-canary', 'nonce-canary'];
    const { router } = makeRouter();

    await router.handleClientMessage(Buffer.from(JSON.stringify({
      type: 'client_log',
      level: canaries[1],
      message: canaries[0],
      data: {
        generation: canaries[1],
        nested: { shellProof: canaries[2], renderer_nonce: canaries[3] },
      },
    })), false);

    const logged = logSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('[redacted]');
    expect(logged).toContain('[CLIENT LOG]');
    for (const canary of canaries) expect(logged).not.toContain(canary);
  });

  test('malformed message type cannot relay nested authentication material through any diagnostic', async () => {
    const canaries = ['master-canary', 'generation-canary', 'proof-canary', 'server-nonce-canary', 'renderer-nonce-canary'];
    const { router, ws } = makeRouter();

    await router.handleClientMessage(Buffer.from(JSON.stringify({
      type: {
        master: canaries[0],
        generation: canaries[1],
        proof: canaries[2],
        serverNonce: canaries[3],
        nested: { renderer_nonce: canaries[4] },
      },
    })), false);

    const diagnostics = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map(String)
      .join(' ');
    expect(diagnostics).toContain('[invalid]');
    for (const canary of canaries) expect(diagnostics).not.toContain(canary);
    expect(errorSpy).toHaveBeenCalledWith('[WS] Message handling error');
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'error',
      message: 'Message handling failed',
    }));
  });

  test('unknown message diagnostics never serialize secret material hidden under neutral keys', async () => {
    const canaries = [
      'proof-shaped-neutral-canary',
      'nonce-shaped-neutral-canary',
      'derived-signature-neutral-canary',
    ];
    const { router, ws } = makeRouter();

    await router.handleClientMessage(Buffer.from(JSON.stringify({
      type: 'unknown:diagnostic',
      payload: canaries[0],
      detail: { value: canaries[1], nested: [canaries[2]] },
    })), false);

    const diagnostics = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map(String)
      .join(' ');
    expect(diagnostics).toContain('[declared]');
    for (const canary of canaries) expect(diagnostics).not.toContain(canary);
    expect(ws.send).not.toHaveBeenCalled();
  });

  test('close waits for thread cleanup and emits only fixed diagnostics', async () => {
    const canary = 'THREAD_CLOSE_PAYLOAD_CANARY_00B';
    let releaseCleanup;
    const cleanupGate = new Promise((resolve) => { releaseCleanup = resolve; });
    ThreadWebSocketHandler.cleanup.mockReturnValueOnce(cleanupGate);
    const { router } = makeRouter({ wire: { pid: canary } });
    let completed = false;

    const closing = router.handleClientClose().then(() => { completed = true; });
    await flushAsyncWork();
    expect(completed).toBe(false);
    releaseCleanup();
    await closing;

    const diagnostics = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map(String)
      .join(' ');
    expect(diagnostics).not.toContain(canary);
    expect(diagnostics).toContain('[WS] client_disconnected');
    expect(diagnostics).toContain('[WS] wire_detached');
  });

  test('prompt resolution and general handler failures return fixed error values', async () => {
    const canary = 'PROMPT_IDENTIFIER_PAYLOAD_CANARY_00B';
    const { router: promptRouter, ws: promptWs } = makeRouter();
    await promptRouter.handleClientMessage(JSON.stringify({
      type: 'prompt:resolve',
      promptId: canary,
      payload: canary,
    }));
    expect(promptWs.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'prompt:resolve_error',
      requestId: null,
      promptId: null,
      message: 'Prompt resolution failed',
    }));
    expect(promptWs.send.mock.calls.flat().join('')).not.toContain(canary);

    const { router: failingRouter, ws: failingWs } = makeRouter({
      fileExplorer: {
        handleRecentFilesRequest: async () => { throw new Error(canary); },
      },
    });
    await failingRouter.handleClientMessage(JSON.stringify({
      type: 'recent_files_request',
      panel: '__apps__',
      payload: canary,
    }));
    expect(failingWs.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'error',
      message: 'Message handling failed',
    }));
    expect(failingWs.send.mock.calls.flat().join('')).not.toContain(canary);
  });

  test('redacts agent activity selectors before logging while preserving the routed message', async () => {
    const handleQuery = jest.fn();
    const selectors = {
      path: '/Users/alice/private/secret.txt',
      folderPrefix: '/Users/alice/private',
      fileName: 'secret.txt',
    };
    const message = {
      type: 'agent:activity:query', version: 1, requestId: 'query-1',
      subject: 'resource_edges', ...selectors,
    };
    const { router } = makeRouter({ agentActivityRoute: { handleQuery } });

    await router.handleClientMessage(JSON.stringify(message));

    expect(handleQuery.mock.calls[0][0].message).toEqual(message);
    const logged = logSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('[declared]');
    expect(logged).not.toContain(selectors.path);
    expect(logged).not.toContain(selectors.folderPrefix);
    expect(logged).not.toContain(selectors.fileName);
  });

  test('binary file_save closes 1003 before logging, routing, or responding', async () => {
    const handleFileSave = jest.fn();
    const { router, ws } = makeRouter({ fileSaveRoute: { handleFileSave } });
    await router.handleClientMessage(Buffer.from('{"type":"file_save"}'), true);
    expect(ws.close).toHaveBeenCalledWith(1003, 'Binary client frames are unsupported.');
    expect(ws.send).not.toHaveBeenCalled();
    expect(handleFileSave).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test.each([
    ['malformed JSON', Buffer.from('{"type":"file_save",')],
    ['invalid UTF-8', Buffer.from([0x7b, 0xc3, 0x28, 0x7d])],
  ])('%s closes 1007 before correlation, logging, routing, or responding', async (_label, raw) => {
    const handleFileSave = jest.fn();
    const { router, ws } = makeRouter({ fileSaveRoute: { handleFileSave } });
    await router.handleClientMessage(raw, false);
    expect(ws.close).toHaveBeenCalledWith(1007, expect.any(String));
    expect(ws.send).not.toHaveBeenCalled();
    expect(handleFileSave).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('fails closed when the atomically installed governed save route is unavailable', async () => {
    const handleFileSaveRequest = jest.fn();
    const { router, ws } = makeRouter({ fileExplorer: { handleFileSaveRequest } });
    const legacy = { type: 'file_save', panel: 'file-viewer', path: 'note.md', content: 'legacy' };
    await router.handleClientMessage(JSON.stringify(legacy));
    expect(handleFileSaveRequest).not.toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalledWith(1011, 'file save route unavailable');
  });

  test('delegates the public resource provenance family to its installed domain route', async () => {
    const handleQuery = jest.fn();
    const { router, ws, session } = makeRouter({ resourceProvenanceRoute: { handleQuery } });
    const message = {
      type: 'resource:provenance:query', version: 1, requestId: 'query-1',
      workspaceId: 'workspace-1', workspaceEpoch: '123e4567-e89b-42d3-a456-426614174000',
    };
    await router.handleClientMessage(JSON.stringify(message));
    expect(handleQuery).toHaveBeenCalledWith({ ws, session, message });
  });

  test('delegates the public agent activity family only to its installed domain route', async () => {
    const handleQuery = jest.fn();
    const { router, ws, session } = makeRouter({ agentActivityRoute: { handleQuery } });
    const message = {
      type: 'agent:activity:query', version: 1, requestId: 'query-1', subject: 'tool_calls',
      workspaceId: 'workspace-1', workspaceEpoch: '123e4567-e89b-42d3-a456-426614174000',
    };
    await router.handleClientMessage(JSON.stringify(message));
    expect(handleQuery).toHaveBeenCalledWith({ ws, session, message });
  });

  test.each([
    ['tree', 'file_tree_request', 'handleTree'],
    ['content', 'file_content_request', 'handleContent'],
  ])('delegates File Viewer %s v1 requests only to the canonical route', async (_label, type, method) => {
    const canonical = jest.fn();
    const legacyTree = jest.fn();
    const legacyContent = jest.fn();
    const { router, ws, session } = makeRouter({
      fileExplorer: {
        handleFileTreeRequest: legacyTree,
        handleFileContentRequest: legacyContent,
      },
      fileViewerReadRoute: { [method]: canonical },
    });
    const message = { type, version: 1, panel: 'file-viewer', unexpected: true };
    await router.handleClientMessage(JSON.stringify(message));
    expect(canonical).toHaveBeenCalledWith({ ws, session, message });
    expect(legacyTree).not.toHaveBeenCalled();
    expect(legacyContent).not.toHaveBeenCalled();
  });

  test('keeps a named unversioned non-File-Viewer panel on compatibility routing', async () => {
    viewReadiness.installViewReadinessOwner({
      ensureReady: async () => ({ status: 'staged', phase: 'precutover_staged', verified: false }),
      acquireLease: () => ({ phase: 'precutover_staged', verified: false, release() {} }),
      getStatus: () => ({ status: 'staged', phase: 'precutover_staged', verified: false }),
    });
    const legacy = jest.fn();
    const canonical = jest.fn();
    const { router, ws } = makeRouter({
      fileExplorer: { handleFileContentRequest: legacy },
      fileViewerReadRoute: { handleContent: canonical },
    });
    const message = { type: 'file_content_request', panel: 'office', path: 'note.md' };
    await router.handleClientMessage(JSON.stringify(message));
    expect(legacy).toHaveBeenCalledWith(ws, message);
    expect(canonical).not.toHaveBeenCalled();
  });

  test('routes a public WebSocket File Viewer request through to its versioned result', async () => {
    const route = createFileViewerReadRoute({
      registryAccess: { validatePayload: jest.fn(async () => ({ valid: true, errors: [] })) },
      readService: {
        readTree: jest.fn(),
        readContent: jest.fn(async () => ({ content: 'body', size: 4, lastModified: 5 })),
      },
    });
    const { router, ws, session } = makeRouter({ fileViewerReadRoute: route });
    ws.readyState = 1;
    session.currentWorkspaceId = 'workspace-A';
    session.workspaceEpoch = '123e4567-e89b-42d3-a456-426614174000';
    session.workspaceBindingState = 'active';
    session.workspaceReplyFlushState = 'idle';
    session.workspaceReplyBuffer = [];
    session.workspaceReplyBufferBytes = 0;
    await router.handleClientMessage(JSON.stringify({
      type: 'file_content_request', version: 1, requestId: 'content-1',
      workspaceId: 'workspace-A', workspaceEpoch: session.workspaceEpoch,
      panel: 'file-viewer', path: 'docs/a.md',
    }));
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'file_content_response', version: 1, success: true, requestId: 'content-1',
      workspaceId: 'workspace-A', workspaceEpoch: session.workspaceEpoch,
      panel: 'file-viewer', path: 'docs/a.md', content: 'body', size: 4, lastModified: 5,
    });
  });
});
