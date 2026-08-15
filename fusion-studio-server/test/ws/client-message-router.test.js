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
const { threadRuntimeController } = require('../../lib/thread');
const { getWireForThread } = require('../../lib/wire/process-manager');

function flushAsyncWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function makeRouter({ wire, handleCanonicalHarnessEvent = jest.fn() }) {
  const ws = { send: jest.fn() };
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
    fileExplorer: {},
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
