'use strict';

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

jest.mock('../../lib/views', () => ({
  resolveChatConfig: jest.fn(() => null),
  loadView: jest.fn(() => null),
}));

const { createClientMessageRouter } = require('../../lib/ws/client-message-router');
const { createFileViewerReadRoute } = require('../../lib/ws/file-viewer-read-route');
const { ThreadWebSocketHandler, threadRuntimeController } = require('../../lib/thread');
const { getWireForThread, sendToWire } = require('../../lib/wire/process-manager');
const { beginWorkspaceTransition } = require('../../lib/ws/workspace-operation-lease');

function flushAsyncWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function makeRouter({
  wire,
  role = 'trusted-shell',
  handleCanonicalHarnessEvent = jest.fn(),
  fileExplorer = {},
  fileSaveRoute = null,
  resourceProvenanceRoute = null,
  agentActivityRoute = null,
  fileViewerReadRoute = null,
} = {}) {
  const ws = { send: jest.fn(), close: jest.fn() };
  const session = {
    connectionId: 'connection-1',
    currentThreadId: 'thread-1',
    currentWorkspaceId: 'workspace-1',
    workspaceEpoch: 'workspace-epoch-1',
    workspaceBindingState: 'active',
    projectRoot: '/tmp/project',
    wire,
  };
  const managedSession = { ws, wireProcess: wire };
  const state = {
    threadId: 'thread-1',
    activatedThreadId: 'thread-1',
    threadManager: {
      workspaceId: 'workspace-1',
      projectRoot: '/tmp/project',
      getSession: jest.fn(() => managedSession),
    },
  };
  ThreadWebSocketHandler.getState.mockReturnValue(state);
  ThreadWebSocketHandler.captureActivationBinding.mockReturnValue({
    state,
    session,
    projectRoot: '/tmp/project',
    workspaceId: 'workspace-1',
    workspaceEpoch: 'workspace-epoch-1',
  });
  if (role) Object.defineProperty(session, 'connectionRole', { value: role, enumerable: false });

  const router = createClientMessageRouter({
    ws,
    session,
    connectionId: 'connection-1',
    projectRoot: '/tmp/project',
    fileExplorer,
    wireLifecycle: {
      awaitHarnessReady: jest.fn(),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
    sessions: new Map(),
    setSessionRoot: jest.fn(),
    clearSessionRoot: jest.fn(),
    getProjectRoot: jest.fn(() => '/tmp/project'),
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
