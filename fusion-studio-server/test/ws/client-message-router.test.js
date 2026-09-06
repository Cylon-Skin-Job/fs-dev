'use strict';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-id'),
}));

jest.mock('../../lib/thread', () => ({
  ThreadWebSocketHandler: {
    getState: jest.fn(() => null),
    getCurrentThreadManager: jest.fn(() => null),
    handleMessageSend: jest.fn(() => Promise.resolve()),
  },
  threadRuntimeController: {
    acceptPromptThroughRuntime: jest.fn(() => Promise.resolve()),
    warmRuntimeForIntent: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../lib/wire/process-manager', () => ({
  getWireForThread: jest.fn(() => null),
  sendToWire: jest.fn(),
}));

jest.mock('../../lib/ws/thread-ws-handlers', () => ({
  createThreadWsHandlers: jest.fn(() => ({})),
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
const { threadRuntimeController } = require('../../lib/thread');
const { getWireForThread } = require('../../lib/wire/process-manager');

function flushAsyncWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function makeRouter({
  wire,
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
    wire,
  };

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

    expect(threadRuntimeController.warmRuntimeForIntent).toHaveBeenCalledWith(expect.objectContaining({
      ws,
      session,
      clientMsg: expect.objectContaining({ type: 'thread:warm', threadId: 'thread-1' }),
    }));
    expect(threadRuntimeController.acceptPromptThroughRuntime).not.toHaveBeenCalled();
  });
});

describe('createClientMessageRouter text-frame and file_save privacy contract', () => {
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
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
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain(secret);
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
    expect(logged).toContain('[redacted]');
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
