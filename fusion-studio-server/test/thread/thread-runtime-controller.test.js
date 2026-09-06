'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');

jest.mock('uuid', () => ({ v4: jest.fn(() => 'generated-wire-turn') }));

jest.mock('../../lib/thread/ThreadWebSocketHandler', () => ({
  getState: jest.fn(),
  getCurrentThreadManager: jest.fn(),
  handleMessageSend: jest.fn(),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  attachClientToWire: jest.fn(),
  getWireForThread: jest.fn(),
  unregisterWire: jest.fn(),
}));

// SPEC-03 Slice C: the diagnostic service is mocked file-wide with the
// failure-shaped default (null ⇒ no diagnosticId); Slice C tests override
// per-case. This keeps every pre-existing test on the no-ID path.
jest.mock('../../lib/thread/harness-diagnostic-service', () => ({
  persistDiagnosticReport: jest.fn(async () => null),
}));

const ThreadWebSocketHandler = require('../../lib/thread/ThreadWebSocketHandler');
const { attachClientToWire, getWireForThread, unregisterWire } = require('../../lib/wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const { createWireMessageRouter } = require('../../lib/wire/message-router');
const {
  createAgentTurnAuthorityRef,
  releaseAgentTurnAuthorityRef,
} = require('../../lib/agent-provenance/turn-authority');
const {
  createCanonicalChatEventApplier,
} = require('../../lib/wire/canonical-chat-event-applier');
const {
  createCanonicalHarnessEventBridge,
} = require('../../lib/wire/canonical-harness-event-bridge');
const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
} = require('../../lib/thread/canonical-drain-context');
const {
  HarnessRuntimeError,
  HARNESS_RUNTIME_ERROR_MESSAGES,
} = require('../../lib/harness/errors');
const { persistDiagnosticReport } = require('../../lib/thread/harness-diagnostic-service');
const {
  acceptPromptThroughRuntime,
  getRuntimeKey,
  stopRuntimeTurn,
  warmRuntimeForIntent,
} = require('../../lib/thread/thread-runtime-controller');

function flushAsyncWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function makeHarness(events = [{ type: 'turn_begin' }]) {
  return {
    _usesDirectCanonicalEvents: true,
    async *_sendMessage(input) {
      events.push({ type: 'sent', input });
      yield { type: 'turn_end' };
    },
  };
}

function makeDeps(overrides = {}) {
  const ws = { send: jest.fn() };
  const session = {
    currentWorkspaceId: 'workspace-1',
  };
  const manager = {
    workspaceId: 'workspace-1',
    getThread: jest.fn(() => Promise.resolve({ entry: {} })),
  };
  ThreadWebSocketHandler.getState.mockReturnValue({
    panelId: 'view-1',
    viewName: 'view-1',
    threadId: 'thread-1',
    threadManager: manager,
  });
    ThreadWebSocketHandler.handleMessageSend.mockResolvedValue(true);
    ThreadWebSocketHandler.getCurrentThreadManager.mockReturnValue(null);
  return {
    ws,
    session,
    manager,
    clientMsg: { type: 'prompt', threadId: 'thread-1', user_input: 'hello' },
    wireLifecycle: {},
    projectRoot: '/tmp/project',
    spawnAndSetupWire: jest.fn(() => Promise.resolve(makeHarness(overrides.events))),
    handleCanonicalHarnessEvent: jest.fn(),
    ...overrides,
  };
}

function parsedFrames(deps) {
  return deps.ws.send.mock.calls.map(([raw]) => JSON.parse(raw));
}

describe('thread runtime prompt controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    attachClientToWire.mockReturnValue(true);
    getWireForThread.mockReturnValue(null);
    unregisterWire.mockReturnValue(undefined);
  });

  test('cold prompt warms runtime and accepts the prompt', async () => {
    const deps = makeDeps();
    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.handleMessageSend).toHaveBeenCalledWith(deps.ws, {
      content: 'hello',
    });
    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledWith(
      { type: 'turn_end' },
      deps.ws,
      expect.objectContaining({
        route: expect.objectContaining({ threadId: 'thread-1', acceptedUserInput: 'hello' }),
        control: expect.objectContaining({ drainId: expect.any(String) }),
      })
    );
    // Normal completion (self-cleared drain, not superseded) returns the
    // runtime to READY.
    expect(threadRuntimeManager.getRuntimeState(getRuntimeKey(deps.manager, 'thread-1')))
      .toBe(RUNTIME_STATES.READY);
  });

  test('reattaches a ready runtime to the current websocket before draining live events', async () => {
    const order = [];
    const deps = makeDeps({
      spawnAndSetupWire: jest.fn(),
    });
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        order.push('send');
        yield { type: 'turn_end' };
      },
    };
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markReady(runtimeKey);
    getWireForThread.mockReturnValue(wire);
    ThreadWebSocketHandler.handleMessageSend.mockImplementation(async () => {
      order.push('persist');
      return true;
    });
    attachClientToWire.mockImplementation(() => {
      order.push('attach');
      return true;
    });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(attachClientToWire).toHaveBeenCalledWith('thread-1', wire, '/tmp/project', deps.ws, {
      workspaceId: 'workspace-1',
      viewId: null,
    });
    expect(order).toEqual(['persist', 'attach', 'send']);
  });

  test('persists user acceptance before draining _sendMessage events', async () => {
    const order = [];
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        order.push('send');
        yield { type: 'turn_end' };
      },
    };
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    ThreadWebSocketHandler.handleMessageSend.mockImplementation(async () => {
      order.push('persist');
      return true;
    });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(order).toEqual(['persist', 'send']);
  });

  test('captures immutable authority from server-resolved thread and wire identity', async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-runtime-authority-'));
    try {
      let finishDrain;
      const drainMayFinish = new Promise(resolve => { finishDrain = resolve; });
      const wire = {
        _usesDirectCanonicalEvents: true,
        _harnessId: 'opencode',
        _provider: 'opencode',
        async *_sendMessage() {
          await drainMayFinish;
          yield { type: 'turn_end' };
        },
      };
      const deps = makeDeps({
        projectRoot: temporaryRoot,
        spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)),
      });
      deps.manager.projectRoot = temporaryRoot;
      deps.manager.getThread.mockResolvedValue({ entry: { harnessId: 'opencode' } });

      await acceptPromptThroughRuntime(deps);
      const acceptedAuthority = deps.session.pendingAgentTurnAuthority;
      deps.session.currentWorkspaceId = 'workspace-B';
      deps.session.currentThreadId = 'thread-B';
      deps.session.projectRoot = '/workspace/B';

      expect(Object.isFrozen(acceptedAuthority)).toBe(true);
      expect(acceptedAuthority).toMatchObject({
        workspaceId: 'workspace-1', threadId: 'thread-1', harnessId: 'opencode',
        provider: 'opencode', canonicalRoot: await fs.realpath(temporaryRoot),
      });
      finishDrain();
      await flushAsyncWork();
      expect(deps.session).toMatchObject({
        pendingTurnId: null,
        pendingAgentTurnAuthority: null,
        pendingUserInput: null,
        pendingAttachments: [],
        currentWorkspaceId: 'workspace-B',
        currentThreadId: 'thread-B',
        projectRoot: '/workspace/B',
      });
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('one real same-socket router keeps concurrent foreground drains turn-local', async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-runtime-concurrent-'));
    try {
      const ws = { send: jest.fn(), readyState: 1 };
      const session = {
        currentWorkspaceId: 'workspace-1', currentThreadId: null, currentScope: 'project',
        currentViewId: null, projectRoot: temporaryRoot, currentTurn: null,
        pendingAttachments: [], assistantParts: [], hasToolCalls: false, toolArgs: {},
        wire: null,
      };
      const manager = {
        workspaceId: 'workspace-1', projectRoot: temporaryRoot,
        getThread: jest.fn(async threadId => ({ threadId, entry: { harnessId: 'opencode' } })),
      };
      ThreadWebSocketHandler.getState.mockReturnValue({
        panelId: 'view-1', viewName: 'view-1', threadId: 'thread-A', threadManager: manager,
      });
      ThreadWebSocketHandler.getCurrentThreadManager.mockReturnValue(null);
      const emitted = [];
      const captures = [];
      const activityOwner = {
        jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
        captureTerminalSnapshot: jest.fn(async (authority, event) => {
          captures.push([authority.threadId, authority.turnId, event.toolCallId]);
          return { replay: false };
        }),
        interruptOpen: jest.fn(async () => []),
      };
      const router = createWireMessageRouter({
        session,
        ws,
        emit: (type, payload) => emitted.push({ type, payload }),
        checkSettingsBounce: () => null,
        activityOwner,
      });
      let markABegun;
      const aBegun = new Promise(resolve => { markABegun = resolve; });
      let releaseA;
      const aMayContinue = new Promise(resolve => { releaseA = resolve; });
      const terminal = (toolCallId, filePath, output) => ({
        type: 'tool_snapshot', origin: 'terminal_snapshot', harnessId: 'opencode', provider: 'opencode',
        timestamp: 30, timestampSource: 'provider_reported', observedAt: 100,
        toolCallId, toolName: 'write', nativeToolName: 'write', status: 'completed',
        hasInput: true, input: { filePath }, executionStartedReportedAt: 10,
        terminalReportedAt: 20, terminalSnapshotReportedAt: 30,
        result: { output, display: [], returnedDiff: false, isError: false, files: [] },
      });
      const wireA = {
        _usesDirectCanonicalEvents: true, _harnessId: 'opencode', _provider: 'opencode',
        async *_sendMessage() {
          yield { type: 'turn_begin', userInput: 'prompt A' };
          markABegun();
          await aMayContinue;
          yield { type: 'content', text: 'late A' };
          yield terminal('tool-A', 'src/a.txt', 'A result');
        },
      };
      const wireB = {
        _usesDirectCanonicalEvents: true, _harnessId: 'opencode', _provider: 'opencode',
        async *_sendMessage() {
          yield { type: 'turn_begin', userInput: 'prompt B' };
          yield { type: 'content', text: 'B text' };
          yield terminal('tool-B', 'src/b.txt', 'B result');
        },
      };
      const wires = new Map([['thread-A', wireA], ['thread-B', wireB]]);
      getWireForThread.mockImplementation(threadId => wires.get(threadId) || null);
      for (const threadId of wires.keys()) {
        threadRuntimeManager.markReady({ workspaceId: 'workspace-1', scope: 'project', threadId });
      }

      const common = {
        ws,
        session,
        manager,
        wireLifecycle: {},
        projectRoot: temporaryRoot,
        spawnAndSetupWire: jest.fn(),
        handleCanonicalHarnessEvent: router.handleCanonicalHarnessEvent,
      };
      await acceptPromptThroughRuntime({
        ...common,
        clientMsg: { type: 'prompt', threadId: 'thread-A', user_input: 'prompt A' },
      });
      await aBegun;
      await acceptPromptThroughRuntime({
        ...common,
        clientMsg: { type: 'prompt', threadId: 'thread-B', user_input: 'prompt B' },
      });

      for (let attempt = 0; attempt < 50
        && !emitted.some(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-B'); attempt += 1) {
        await flushAsyncWork();
      }
      expect(emitted.filter(item => item.type === 'chat:turn_end').map(item => item.payload.threadId))
        .toEqual(['thread-B']);
      releaseA();
      for (let attempt = 0; attempt < 50
        && emitted.filter(item => item.type === 'chat:turn_end').length < 2; attempt += 1) {
        await flushAsyncWork();
      }

      const endings = emitted.filter(item => item.type === 'chat:turn_end');
      expect(endings.map(item => item.payload.threadId)).toEqual(['thread-B', 'thread-A']);
      expect(endings.find(item => item.payload.threadId === 'thread-A').payload)
        .toMatchObject({ fullText: 'late A', userInput: 'prompt A' });
      expect(endings.find(item => item.payload.threadId === 'thread-B').payload)
        .toMatchObject({ fullText: 'B text', userInput: 'prompt B' });
      expect(captures.map(([threadId, , toolCallId]) => [threadId, toolCallId])).toEqual([
        ['thread-B', 'tool-B'],
        ['thread-A', 'tool-A'],
      ]);
      expect(new Set(captures.map(([, turnId]) => turnId).filter(Boolean)).size).toBe(2);
      expect(endings).toHaveLength(2);

      let markCBegun;
      const cBegun = new Promise(resolve => { markCBegun = resolve; });
      let releaseC;
      const cMayContinue = new Promise(resolve => { releaseC = resolve; });
      wires.set('thread-C', {
        _usesDirectCanonicalEvents: true, _harnessId: 'opencode', _provider: 'opencode',
        async *_sendMessage() {
          yield { type: 'turn_begin', userInput: 'prompt C' };
          markCBegun();
          await cMayContinue;
          yield { type: 'content', text: 'C survived D error' };
        },
      });
      wires.set('thread-D', {
        _usesDirectCanonicalEvents: true, _harnessId: 'opencode', _provider: 'opencode',
        async *_sendMessage() {
          yield { type: 'turn_begin', userInput: 'prompt D' };
          yield { type: 'content', text: 'D partial' };
          throw new Error('D foreground iterator failed');
        },
      });
      for (const threadId of ['thread-C', 'thread-D']) {
        threadRuntimeManager.markReady({ workspaceId: 'workspace-1', scope: 'project', threadId });
      }
      await acceptPromptThroughRuntime({
        ...common,
        clientMsg: { type: 'prompt', threadId: 'thread-C', user_input: 'prompt C' },
      });
      await cBegun;
      await acceptPromptThroughRuntime({
        ...common,
        clientMsg: { type: 'prompt', threadId: 'thread-D', user_input: 'prompt D' },
      });
      for (let attempt = 0; attempt < 50
        && !emitted.some(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-D'); attempt += 1) {
        await flushAsyncWork();
      }
      expect(emitted.filter(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-C'))
        .toHaveLength(0);
      expect(emitted.filter(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-D'))
        .toHaveLength(1);
      releaseC();
      for (let attempt = 0; attempt < 50
        && !emitted.some(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-C'); attempt += 1) {
        await flushAsyncWork();
      }
      expect(emitted.filter(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-C'))
        .toHaveLength(1);
      expect(emitted.find(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-C').payload.fullText)
        .toBe('C survived D error');

      let markEBegun;
      const eBegun = new Promise(resolve => { markEBegun = resolve; });
      let releaseE;
      const eMayFinish = new Promise(resolve => { releaseE = resolve; });
      let releaseF;
      const fMayBegin = new Promise(resolve => { releaseF = resolve; });
      wires.set('thread-E', {
        _usesDirectCanonicalEvents: true, _harnessId: 'opencode', _provider: 'opencode',
        _stopSession: jest.fn(async () => {}),
        async *_sendMessage() {
          yield { type: 'turn_begin', userInput: 'prompt E' };
          yield { type: 'content', text: 'E partial' };
          yield { type: 'thinking', text: 'E thought' };
          yield { type: 'status_update', tokenUsage: { total: 7 }, messageId: 'message-E' };
          markEBegun();
          await eMayFinish;
          yield { type: 'content', text: 'late E must be ignored' };
        },
      });
      wires.set('thread-F', {
        _usesDirectCanonicalEvents: true, _harnessId: 'opencode', _provider: 'opencode',
        async *_sendMessage() {
          await fMayBegin;
          yield { type: 'turn_begin', userInput: 'prompt F' };
          yield { type: 'content', text: 'F completed' };
        },
      });
      for (const threadId of ['thread-E', 'thread-F']) {
        threadRuntimeManager.markReady({ workspaceId: 'workspace-1', scope: 'project', threadId });
      }
      await acceptPromptThroughRuntime({
        ...common,
        clientMsg: { type: 'prompt', threadId: 'thread-E', user_input: 'prompt E' },
      });
      await eBegun;

      session.currentWorkspaceId = 'workspace-F-navigation';
      session.currentThreadId = 'thread-F';
      session.projectRoot = '/workspace/F-navigation';
      await acceptPromptThroughRuntime({
        ...common,
        clientMsg: {
          type: 'prompt',
          threadId: 'thread-F',
          user_input: 'prompt F',
          attachments: [{ kind: 'file', label: 'F', path: '/workspace/F/attachment.txt' }],
        },
      });
      const pendingFAuthority = session.pendingAgentTurnAuthority;
      const pendingFAttachments = session.pendingAttachments;
      await stopRuntimeTurn({
        ws,
        session,
        clientMsg: { type: 'turn:stop', threadId: 'thread-E' },
        handleCanonicalHarnessEvent: router.handleCanonicalHarnessEvent,
      });

      expect(emitted.filter(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-E'))
        .toHaveLength(1);
      expect(session.currentWorkspaceId).toBe('workspace-F-navigation');
      expect(session.currentThreadId).toBe('thread-F');
      expect(session.projectRoot).toBe('/workspace/F-navigation');
      expect(session.pendingTurnId).toBe(pendingFAuthority.turnId);
      expect(session.pendingAgentTurnAuthority).toBe(pendingFAuthority);
      expect(session.pendingUserInput).toBe('prompt F');
      expect(session.pendingAttachments).toBe(pendingFAttachments);
      expect(session.pendingAttachments).toEqual([
        expect.objectContaining({ label: 'F', path: '/workspace/F/attachment.txt' }),
      ]);
      expect(session.currentTurn).toBeNull();
      expect(session.assistantParts).toEqual([]);
      expect(session.toolArgs).toEqual({});
      expect(session.tokenUsage).not.toEqual({ total: 7 });
      expect(session.messageId).not.toBe('message-E');

      releaseF();
      for (let attempt = 0; attempt < 50
        && !emitted.some(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-F'); attempt += 1) {
        await flushAsyncWork();
      }
      await flushAsyncWork();
      expect(session).toMatchObject({
        currentWorkspaceId: 'workspace-F-navigation',
        currentThreadId: 'thread-F',
        projectRoot: '/workspace/F-navigation',
        pendingTurnId: null,
        pendingAgentTurnAuthority: null,
        pendingUserInput: null,
        pendingAttachments: [],
      });
      releaseE();
      await flushAsyncWork();
      expect(emitted.filter(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-E'))
        .toHaveLength(1);

      let markGBegun;
      const gBegun = new Promise(resolve => { markGBegun = resolve; });
      let releaseG;
      const gMayFinish = new Promise(resolve => { releaseG = resolve; });
      let releaseH;
      const hMayBegin = new Promise(resolve => { releaseH = resolve; });
      wires.set('thread-G', {
        _usesDirectCanonicalEvents: true, _harnessId: 'opencode', _provider: 'opencode',
        async *_sendMessage() {
          yield { type: 'turn_begin', userInput: 'prompt G' };
          markGBegun();
          await gMayFinish;
          yield { type: 'content', text: 'G completed' };
        },
      });
      wires.set('thread-H', {
        _usesDirectCanonicalEvents: true, _harnessId: 'opencode', _provider: 'opencode',
        async *_sendMessage() {
          await hMayBegin;
          yield { type: 'turn_begin', userInput: 'prompt H' };
          yield { type: 'content', text: 'H completed' };
        },
      });
      for (const threadId of ['thread-G', 'thread-H']) {
        threadRuntimeManager.markReady({ workspaceId: 'workspace-1', scope: 'project', threadId });
      }
      await acceptPromptThroughRuntime({
        ...common,
        clientMsg: { type: 'prompt', threadId: 'thread-G', user_input: 'prompt G' },
      });
      await gBegun;
      await acceptPromptThroughRuntime({
        ...common,
        clientMsg: {
          type: 'prompt',
          threadId: 'thread-H',
          user_input: 'prompt H',
          attachments: [{ kind: 'file', label: 'H', path: '/workspace/H/attachment.txt' }],
        },
      });
      const pendingH = {
        turnId: session.pendingTurnId,
        authority: session.pendingAgentTurnAuthority,
        userInput: session.pendingUserInput,
        attachments: session.pendingAttachments,
      };
      releaseG();
      for (let attempt = 0; attempt < 50
        && !emitted.some(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-G'); attempt += 1) {
        await flushAsyncWork();
      }
      await flushAsyncWork();
      expect(session.pendingTurnId).toBe(pendingH.turnId);
      expect(session.pendingAgentTurnAuthority).toBe(pendingH.authority);
      expect(session.pendingUserInput).toBe(pendingH.userInput);
      expect(session.pendingAttachments).toBe(pendingH.attachments);

      releaseH();
      for (let attempt = 0; attempt < 50
        && !emitted.some(item => item.type === 'chat:turn_end' && item.payload.threadId === 'thread-H'); attempt += 1) {
        await flushAsyncWork();
      }
      await flushAsyncWork();
      expect(session).toMatchObject({
        pendingTurnId: null,
        pendingAgentTurnAuthority: null,
        pendingUserInput: null,
        pendingAttachments: [],
      });
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('warming prompts share one warm-up and do not spawn twice', async () => {
    let resolveWarm;
    const warmPromise = new Promise(resolve => { resolveWarm = resolve; });
    const wire = makeHarness([]);
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => warmPromise) });

    const first = acceptPromptThroughRuntime(deps);
    const second = acceptPromptThroughRuntime(deps);
    resolveWarm(wire);
    await Promise.all([first, second]);
    await flushAsyncWork();

    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.handleMessageSend).toHaveBeenCalledTimes(1);
  });

  test('in-flight runtime rejects another prompt without sending', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markInFlight(runtimeKey);

    await acceptPromptThroughRuntime(deps);

    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(JSON.parse(deps.ws.send.mock.calls[0][0])).toMatchObject({
      type: 'error',
      threadId: 'thread-1',
      recoverable: true,
    });
  });

  test.each([
    ['accepted prompt', 'async'],
    ['warm intent', 'async'],
    ['accepted prompt', 'sync'],
  ])('%s %s spawn failure stays fixed-safe in frame and server diagnostic', async (entrypoint, failureMode) => {
    const canary = `CANARY_SECRET_WARM_${entrypoint}_${failureMode}`;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spawnAndSetupWire = failureMode === 'sync'
      ? jest.fn(() => { throw new Error(canary); })
      : jest.fn(() => Promise.reject(new Error(canary)));
    const deps = makeDeps({ spawnAndSetupWire });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');

    if (entrypoint === 'warm intent') {
      await warmRuntimeForIntent({
        ws: deps.ws,
        session: deps.session,
        clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
        wireLifecycle: deps.wireLifecycle,
        projectRoot: deps.projectRoot,
        spawnAndSetupWire: deps.spawnAndSetupWire,
      });
    } else {
      await acceptPromptThroughRuntime(deps);
    }

    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    expect(parsedFrames(deps)).toEqual([{
      type: 'error',
      scope: 'project',
      message: 'Thread warm-up failed',
      threadId: 'thread-1',
      recoverable: true,
    }]);
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Thread warm-up failed',
      { threadId: 'thread-1', marker: 'THREAD_WARM_UP_FAILED' },
    ]]);
    expect(JSON.stringify(deps.ws.send.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(canary);
  });

  test('shared warming-promise rejection stays fixed-safe for the joining caller', async () => {
    const canary = 'CANARY_SECRET_SHARED_WARM_PROMISE';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps({ spawnAndSetupWire: jest.fn() });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const warmPromise = Promise.reject(new Error(canary));
    // Prevent the deliberately rejected fixture from becoming unhandled before
    // ensureReadyRuntime attaches its own await/catch.
    warmPromise.catch(() => {});
    threadRuntimeManager.markWarming(runtimeKey, warmPromise);

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    expect(parsedFrames(deps)).toEqual([{
      type: 'error',
      scope: 'project',
      message: 'Thread warm-up failed',
      threadId: 'thread-1',
      recoverable: true,
    }]);
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Thread warm-up failed',
      { threadId: 'thread-1', marker: 'THREAD_WARM_UP_FAILED' },
    ]]);
    expect(JSON.stringify(deps.ws.send.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(canary);
  });

  test.each(['accepted prompt', 'warm intent'])(
    '%s thread lookup rejection is contained with one fixed-safe frame',
    async (entrypoint) => {
      const canary = `CANARY_SECRET_GET_THREAD_${entrypoint}`;
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const deps = makeDeps();
      deps.manager.getThread.mockRejectedValue(new Error(canary));

      if (entrypoint === 'warm intent') {
        await warmRuntimeForIntent({
          ws: deps.ws,
          session: deps.session,
          clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
          wireLifecycle: deps.wireLifecycle,
          projectRoot: deps.projectRoot,
          spawnAndSetupWire: deps.spawnAndSetupWire,
        });
      } else {
        await acceptPromptThroughRuntime(deps);
      }

      expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
      expect(parsedFrames(deps)).toEqual([{
        type: 'error',
        scope: 'project',
        message: 'Thread lookup failed',
        threadId: 'thread-1',
        recoverable: true,
      }]);
      expect(errorSpy.mock.calls).toEqual([[
        '[ThreadRuntime] Thread lookup failed',
        { threadId: 'thread-1', marker: 'THREAD_LOOKUP_FAILED' },
      ]]);
      expect(JSON.stringify({ frames: deps.ws.send.mock.calls, logs: errorSpy.mock.calls }))
        .not.toContain(canary);
    }
  );

  test('unexpected prompt-acceptance rejection rolls runtime back with fixed-safe output', async () => {
    const canary = 'CANARY_SECRET_HANDLE_MESSAGE_SEND';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps();
    ThreadWebSocketHandler.handleMessageSend.mockRejectedValue(new Error(canary));
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');

    await expect(acceptPromptThroughRuntime(deps)).resolves.toBeUndefined();

    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.READY);
    expect(attachClientToWire).not.toHaveBeenCalled();
    expect(parsedFrames(deps)).toEqual([{
      type: 'error',
      scope: 'project',
      message: 'Message could not be accepted',
      threadId: 'thread-1',
      recoverable: true,
    }]);
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Prompt acceptance failed',
      { threadId: 'thread-1', marker: 'PROMPT_ACCEPTANCE_FAILED' },
    ]]);
    expect(JSON.stringify({ frames: deps.ws.send.mock.calls, logs: errorSpy.mock.calls }))
      .not.toContain(canary);
  });

  test('thread warm on cold runtime spawns once and marks ready', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.READY);
  });

  test('thread warm while warming shares warm promise and does not spawn twice', async () => {
    let resolveWarm;
    const warmPromise = new Promise(resolve => { resolveWarm = resolve; });
    const wire = makeHarness([]);
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => warmPromise) });

    const first = warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });
    const second = warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    resolveWarm(wire);
    await Promise.all([first, second]);

    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
  });

  test('thread warm while ready with registered wire does not spawn', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const wire = makeHarness([]);
    threadRuntimeManager.markReady(runtimeKey);
    getWireForThread.mockReturnValue(wire);

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
  });

  test('thread warm replaces a closed wire left behind by idle expiry', async () => {
    const replacementWire = makeHarness([]);
    const deps = makeDeps({
      spawnAndSetupWire: jest.fn(() => Promise.resolve(replacementWire)),
    });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const expiredWire = { ...makeHarness([]), killed: true };
    threadRuntimeManager.markReady(runtimeKey);
    getWireForThread.mockReturnValueOnce(expiredWire).mockReturnValueOnce(expiredWire);

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(unregisterWire).toHaveBeenCalledWith('thread-1');
    expect(deps.spawnAndSetupWire).toHaveBeenCalledTimes(1);
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.READY);
  });

  test('thread warm while busy does not stop, send, spawn, or scare user', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markInFlight(runtimeKey);

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
    expect(deps.ws.send).not.toHaveBeenCalled();
  });

  test('thread warm while stopping does not stop, send, spawn, or scare user', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markState(runtimeKey, RUNTIME_STATES.STOPPING);

    await warmRuntimeForIntent({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'thread:warm', threadId: 'thread-1' },
      wireLifecycle: deps.wireLifecycle,
      projectRoot: deps.projectRoot,
      spawnAndSetupWire: deps.spawnAndSetupWire,
    });

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
    expect(deps.ws.send).not.toHaveBeenCalled();
  });

  test('stop on in-flight runtime emits one interrupted terminal turn and marks runtime cold', async () => {
    const stop = jest.fn(() => Promise.resolve());
    const wire = { _stopSession: stop };
    const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn() });
    Object.assign(deps.session, {
      currentThreadId: 'thread-1',
      toolArgs: { 'tool-live': '{"path":"secret"}' },
      toolNamesById: { 'tool-live': 'write' },
      bouncedToolCalls: new Set(['tool-live']),
      contextUsage: { used: 1 },
      tokenUsage: { total: 2 },
      messageId: 'message-live',
      planMode: true,
    });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markInFlight(runtimeKey);
    threadRuntimeManager.beginLiveTurn(runtimeKey, {
      turnId: 'turn-live',
      userInput: 'hello',
    });
    threadRuntimeManager.appendLiveContent(runtimeKey, 'partial');
    getWireForThread.mockReturnValue(wire);

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    });

    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledTimes(1);
    // No active drain record was claimed, so the synthesized terminal event
    // carries no drain context (2-arg call shape preserved).
    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledWith({
      type: 'turn_end',
      reason: 'interrupted',
      partial: true,
    }, deps.ws);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(unregisterWire).toHaveBeenCalledWith('thread-1');
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    expect(deps.session).toMatchObject({
      currentTurn: null,
      assistantParts: [],
      toolArgs: {},
      toolNamesById: {},
      contextUsage: null,
      tokenUsage: null,
      messageId: null,
      planMode: false,
    });
    expect(deps.session.bouncedToolCalls).toEqual(new Set());
  });

  test('a rebound stop prefers restored live authority over stale pending navigation state', async () => {
    const authority = await createAgentTurnAuthorityRef({
      workspaceId: 'workspace-1', threadId: 'thread-1', turnId: 'turn-live',
      harnessId: 'opencode', provider: 'opencode', workspaceRoot: '/tmp',
    });
    const pendingAuthority = await createAgentTurnAuthorityRef({
      workspaceId: 'workspace-1', threadId: 'thread-2', turnId: 'turn-pending',
      harnessId: 'opencode', provider: 'opencode', workspaceRoot: '/tmp',
    });
    const stop = jest.fn(() => Promise.resolve());
    const wire = { _stopSession: stop };
    const deps = makeDeps();
    Object.assign(deps.session, {
      currentThreadId: 'thread-1',
      currentScope: 'project',
      projectRoot: '/tmp',
      pendingUserInput: 'hello',
      pendingTurnId: 'turn-live',
      pendingAgentTurnAuthority: authority,
      pendingAttachments: [],
      currentTurn: null,
      assistantParts: [],
      hasToolCalls: false,
      toolArgs: {},
      toolNamesById: {},
    });
    const emitted = [];
    const router = createWireMessageRouter({
      session: deps.session,
      ws: deps.ws,
      emit: (type, payload) => emitted.push({ type, payload }),
      checkSettingsBounce: () => null,
      activityOwner: {
        interruptOpen: jest.fn(async () => []),
      },
    });
    deps.handleCanonicalHarnessEvent = router.handleCanonicalHarnessEvent;
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markInFlight(runtimeKey);
    await deps.handleCanonicalHarnessEvent({ type: 'turn_begin', userInput: 'hello' }, deps.ws);
    deps.session.pendingAgentTurnAuthority = pendingAuthority;
    deps.session.pendingTurnId = 'turn-pending';
    deps.session.pendingUserInput = 'pending';
    getWireForThread.mockReturnValue(wire);

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    });

    const endings = emitted.filter(item => item.type === 'chat:turn_end');
    expect(endings).toHaveLength(1);
    expect(endings[0].payload).toMatchObject({
      workspaceId: 'workspace-1', threadId: 'thread-1', turnId: 'turn-live',
    });
    releaseAgentTurnAuthorityRef(authority);
    releaseAgentTurnAuthorityRef(pendingAuthority);
  });

  test('stubborn process receives SIGKILL after the bounded SIGTERM close wait', async () => {
    jest.useFakeTimers();
    try {
      let closeProcess;
      const closed = new Promise(resolve => { closeProcess = resolve; });
      const stop = jest.fn((signal) => {
        if (signal === 'SIGKILL') closeProcess();
        return closed;
      });
      const wire = { _stopSession: stop };
      const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn(async () => {}) });
      const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
      threadRuntimeManager.markInFlight(runtimeKey);
      threadRuntimeManager.beginLiveTurn(runtimeKey, {
        turnId: 'turn-live',
        userInput: 'hello',
      });
      getWireForThread.mockReturnValue(wire);

      const stopped = stopRuntimeTurn({
        ws: deps.ws,
        session: deps.session,
        clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
        handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
      });
      await Promise.resolve();
      expect(stop).toHaveBeenCalledTimes(1);
      expect(stop).toHaveBeenLastCalledWith('SIGTERM');

      await jest.advanceTimersByTimeAsync(2_000);
      await stopped;
      expect(stop.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL']);
      expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledTimes(1);
      expect(unregisterWire).toHaveBeenCalledTimes(1);
      expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a process that never closes after SIGKILL cannot retain the turn finalizer', async () => {
    jest.useFakeTimers();
    try {
      const neverCloses = new Promise(() => {});
      const stop = jest.fn(() => neverCloses);
      const wire = { _stopSession: stop };
      const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn(async () => {}) });
      const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
      threadRuntimeManager.markInFlight(runtimeKey);
      threadRuntimeManager.beginLiveTurn(runtimeKey, { turnId: 'turn-live', userInput: 'hello' });
      getWireForThread.mockReturnValue(wire);

      const stopped = stopRuntimeTurn({
        ws: deps.ws,
        session: deps.session,
        clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
        handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
      });
      await jest.advanceTimersByTimeAsync(3_000);
      await stopped;

      expect(stop.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL']);
      expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledTimes(1);
      expect(unregisterWire).toHaveBeenCalledTimes(1);
      expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    } finally {
      jest.useRealTimers();
    }
  });

  test('interrupted synthesis exception cannot disclose or prevent bound-stop cleanup', async () => {
    const canary = 'CANARY_SECRET_INTERRUPTED_SYNTHESIS';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps({
      handleCanonicalHarnessEvent: jest.fn(() => { throw new Error(canary); }),
    });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const stopHarness = jest.fn(() => Promise.resolve());
    const control = createCanonicalDrainControl({
      drainId: 'stop-synthesis-drain',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness,
    });
    threadRuntimeManager.claimActiveDrain(runtimeKey, control, null);
    threadRuntimeManager.beginLiveTurn(runtimeKey, {
      turnId: 'turn-live',
      userInput: 'hello',
    });
    threadRuntimeManager.markInFlight(runtimeKey);

    await expect(stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    })).resolves.toBeUndefined();

    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledTimes(1);
    expect(stopHarness).toHaveBeenCalledTimes(1);
    expect(unregisterWire).toHaveBeenCalledWith('thread-1');
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    expect(deps.ws.send).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Interrupted-turn synthesis failed',
      {
        threadId: 'thread-1',
        drainId: 'stop-synthesis-drain',
        marker: 'INTERRUPTED_TURN_SYNTHESIS_FAILED',
      },
    ]]);
    expect(JSON.stringify({ frames: deps.ws.send.mock.calls, logs: errorSpy.mock.calls }))
      .not.toContain(canary);
  });

  test('legacy stop rejection cannot disclose and still unregisters and marks cold', async () => {
    const canary = 'CANARY_SECRET_LEGACY_STOPWIRE';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const stopSession = jest.fn(async () => { throw new Error(canary); });
    const wire = { _stopSession: stopSession };
    const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn() });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.beginLiveTurn(runtimeKey, {
      turnId: 'turn-live',
      userInput: 'hello',
    });
    threadRuntimeManager.markInFlight(runtimeKey);
    getWireForThread.mockReturnValue(wire);

    await expect(stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    })).resolves.toBeUndefined();

    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledTimes(1);
    expect(stopSession).toHaveBeenCalledTimes(1);
    expect(unregisterWire).toHaveBeenCalledWith('thread-1');
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    expect(deps.ws.send).not.toHaveBeenCalled();
    expect(warnSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Legacy harness stop failed',
      { threadId: 'thread-1', marker: 'LEGACY_HARNESS_STOP_FAILED' },
    ]]);
    expect(JSON.stringify({ frames: deps.ws.send.mock.calls, logs: warnSpy.mock.calls }))
      .not.toContain(canary);
  });

  test('arbitrary bound-control stop rejection is contained and cleanup still completes', async () => {
    const canary = 'CANARY_SECRET_ARBITRARY_BOUND_STOP';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn() });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const control = createCanonicalDrainControl({
      drainId: 'arbitrary-bound-stop',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => { throw new Error(canary); },
    });
    threadRuntimeManager.claimActiveDrain(runtimeKey, control, null);
    threadRuntimeManager.beginLiveTurn(runtimeKey, {
      turnId: 'turn-live',
      userInput: 'hello',
    });
    threadRuntimeManager.markInFlight(runtimeKey);

    await expect(stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    })).resolves.toBeUndefined();

    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledTimes(1);
    expect(unregisterWire).toHaveBeenCalledWith('thread-1');
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    expect(deps.ws.send).not.toHaveBeenCalled();
    expect(warnSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Harness stop failed',
      {
        threadId: 'thread-1',
        drainId: 'arbitrary-bound-stop',
        marker: 'HARNESS_STOP_FAILED',
      },
    ]]);
    expect(JSON.stringify({ frames: deps.ws.send.mock.calls, logs: warnSpy.mock.calls }))
      .not.toContain(canary);
  });

  test('stop is recoverable no-op when runtime is not in flight', async () => {
    const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn() });

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    });

    expect(deps.handleCanonicalHarnessEvent).not.toHaveBeenCalled();
    expect(JSON.parse(deps.ws.send.mock.calls[0][0])).toMatchObject({
      type: 'error',
      threadId: 'thread-1',
      recoverable: true,
    });
  });

  test('duplicate stop while stopping does not emit duplicate terminal events', async () => {
    const deps = makeDeps({ handleCanonicalHarnessEvent: jest.fn() });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    threadRuntimeManager.markState(runtimeKey, RUNTIME_STATES.STOPPING);

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: deps.handleCanonicalHarnessEvent,
    });

    expect(deps.handleCanonicalHarnessEvent).not.toHaveBeenCalled();
    expect(deps.ws.send).not.toHaveBeenCalled();
  });
});

describe('canonical drain binding (SPEC-01 Slice B)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    attachClientToWire.mockReturnValue(true);
    getWireForThread.mockReturnValue(null);
    unregisterWire.mockReturnValue(undefined);
  });

  function makeBoundWire(extra = {}) {
    return {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield { type: 'turn_end' };
      },
      ...extra,
    };
  }

  test('claims the active drain before consuming the first harness event', async () => {
    const order = [];
    const originalClaim = threadRuntimeManager.claimActiveDrain.bind(threadRuntimeManager);
    const claimSpy = jest.spyOn(threadRuntimeManager, 'claimActiveDrain')
      .mockImplementation((key, control, routeContext) => {
        order.push('claim');
        return originalClaim(key, control, routeContext);
      });
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        order.push('send-start');
        yield { type: 'turn_end' };
      },
    };
    const deps = makeDeps({
      spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)),
      handleCanonicalHarnessEvent: jest.fn((event) => {
        order.push(`event:${event.type}`);
      }),
    });
    ThreadWebSocketHandler.handleMessageSend.mockImplementation(async () => {
      order.push('persist');
      return true;
    });
    attachClientToWire.mockImplementation(() => {
      order.push('attach');
      return true;
    });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(order).toEqual(['persist', 'attach', 'claim', 'send-start', 'event:turn_end']);
    claimSpy.mockRestore();
  });

  test('claimed record carries drain identity, route context, and live control closures', async () => {
    const stopSession = jest.fn(() => Promise.resolve());
    const wire = makeBoundWire({ _stopSession: stopSession });
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    deps.manager.touchSession = jest.fn();
    deps.clientMsg.attachments = [{ kind: 'image', label: 'pic.png', path: '/tmp/pic.png' }];

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const record = threadRuntimeManager.getActiveDrain(runtimeKey);

    expect(record).toBeTruthy();
    expect(record.turnId).toBeNull();
    expect(record.drainId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(record.control.drainId).toBe(record.drainId);
    expect(record.control.runtimeKey).toMatchObject({
      workspaceId: 'workspace-1',
      scope: 'project',
      threadId: 'thread-1',
    });

    record.control.touchThreadSession();
    expect(deps.manager.touchSession).toHaveBeenCalledWith('thread-1');

    await record.control.stopHarness();
    expect(stopSession).toHaveBeenCalledTimes(1);

    expect(record.routeContext).toMatchObject({
      workspaceId: 'workspace-1',
      workspace: 'workspace:workspace-1',
      projectRoot: '/tmp/project',
      scope: 'project',
      threadId: 'thread-1',
      acceptedUserInput: 'hello',
    });
    expect(record.routeContext.attachments).toEqual([
      { kind: 'image', label: 'pic.png', path: '/tmp/pic.png', sourceName: 'pic.png' },
    ]);
  });

  test('bound harness stop exception is swallowed with an ids-only fixed diagnostic', async () => {
    const canary = 'CANARY_SECRET_BOUND_HARNESS_STOP';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const stopSession = jest.fn(async () => { throw new Error(canary); });
    const wire = makeBoundWire({ _stopSession: stopSession });
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const record = threadRuntimeManager.getActiveDrain(getRuntimeKey(deps.manager, 'thread-1'));
    expect(record).toBeTruthy();
    await expect(record.control.stopHarness()).resolves.toBeUndefined();

    expect(stopSession).toHaveBeenCalledTimes(1);
    expect(deps.ws.send).not.toHaveBeenCalled();
    expect(warnSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Harness stop failed',
      {
        threadId: 'thread-1',
        drainId: record.drainId,
        marker: 'HARNESS_STOP_FAILED',
      },
    ]]);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(canary);
  });

  test('mutating clientMsg.attachments after acceptance leaves the stored route untouched', async () => {
    const wire = makeBoundWire();
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    deps.clientMsg.attachments = [{ path: '/tmp/a.txt', label: 'a.txt' }];

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const record = threadRuntimeManager.getActiveDrain(getRuntimeKey(deps.manager, 'thread-1'));

    deps.clientMsg.attachments.push({ path: '/tmp/evil.txt' });
    deps.clientMsg.attachments[0].path = '/tmp/mutated.txt';

    expect(record.routeContext.attachments).toEqual([
      { kind: 'file', label: 'a.txt', path: '/tmp/a.txt', sourceName: 'a.txt' },
    ]);
    expect(Object.isFrozen(record.routeContext)).toBe(true);
    expect(Object.isFrozen(record.routeContext.attachments)).toBe(true);
    expect(Object.isFrozen(record.routeContext.attachments[0])).toBe(true);

    // SPEC-01 Slice C: accepted input/attachments live ONLY in the frozen
    // route context — the connection session stores none of them.
    expect(deps.session.pendingUserInput).toBeUndefined();
    expect(deps.session.pendingAttachments).toBeUndefined();
  });

  test('empty user_input is rejected before warming, persistence, or IN_FLIGHT', async () => {
    const deps = makeDeps();

    await acceptPromptThroughRuntime({
      ...deps,
      clientMsg: { type: 'prompt', threadId: 'thread-1', user_input: '' },
    });
    await flushAsyncWork();

    expect(deps.spawnAndSetupWire).not.toHaveBeenCalled();
    expect(ThreadWebSocketHandler.handleMessageSend).not.toHaveBeenCalled();
    expect(deps.handleCanonicalHarnessEvent).not.toHaveBeenCalled();
    expect(threadRuntimeManager.getRuntimeState(getRuntimeKey(deps.manager, 'thread-1'))).toBe(RUNTIME_STATES.COLD);
    expect(JSON.parse(deps.ws.send.mock.calls[0][0])).toMatchObject({
      type: 'error',
      message: 'Prompt requires a non-empty user_input',
      threadId: 'thread-1',
    });
  });

  test('a drain-binding failure rolls back and omits the thrown value from frame and log', async () => {
    const canary = 'CANARY_SECRET_DRAIN_BINDING';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wire = makeBoundWire();
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    jest.spyOn(threadRuntimeManager, 'claimActiveDrain').mockImplementationOnce(() => {
      throw new Error(canary);
    });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.READY);
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();
    expect(deps.handleCanonicalHarnessEvent).not.toHaveBeenCalled();
    expect(parsedFrames(deps)).toEqual([{
      type: 'error',
      scope: 'project',
      message: 'Prompt binding failed',
      threadId: 'thread-1',
      recoverable: true,
    }]);
    expect(errorSpy.mock.calls).toEqual([[
      '[ThreadRuntime] Prompt drain binding failed',
      { threadId: 'thread-1', marker: 'PROMPT_DRAIN_BINDING_FAILED' },
    ]]);
    expect(JSON.stringify(deps.ws.send.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(canary);
  });
});

describe('runtime drain authority (SPEC-01 Slice C)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    attachClientToWire.mockReturnValue(true);
    getWireForThread.mockReturnValue(null);
    unregisterWire.mockReturnValue(undefined);
  });

  function makeBoundWire(extra = {}) {
    return {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield { type: 'turn_end' };
      },
      ...extra,
    };
  }

  test('every iterator event carries the claimed drain context (route + control)', async () => {
    const wire = makeBoundWire();
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    deps.manager.touchSession = jest.fn();

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const claimed = threadRuntimeManager.getActiveDrain(runtimeKey) // cleared by nothing here — mock handler
      || { drainId: 'cleared' };
    void claimed;

    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalled();
    for (const call of deps.handleCanonicalHarnessEvent.mock.calls) {
      const [, , drainContext] = call;
      expect(drainContext).toBeTruthy();
      expect(drainContext.route).toMatchObject({
        workspaceId: 'workspace-1',
        scope: 'project',
        threadId: 'thread-1',
        acceptedUserInput: 'hello',
      });
      expect(drainContext.control.drainId).toMatch(/^[0-9a-f-]{36}$/);
      expect(Object.isFrozen(drainContext.route)).toBe(true);
    }
  });

  test('loop error after the drain was superseded is a diagnostic-only no-op', async () => {
    const canary = 'CANARY_SECRET_SUPERSEDED_ITERATOR';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let releaseError;
    const errorGate = new Promise(resolve => { releaseError = resolve; });
    let started;
    const startGate = new Promise(resolve => { started = resolve; });
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        started();
        yield { type: 'turn_begin' };
        await errorGate;
        throw new Error(canary);
      },
    };
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });

    await acceptPromptThroughRuntime(deps);
    await startGate;

    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const originalRecord = threadRuntimeManager.getActiveDrain(runtimeKey);
    expect(originalRecord).toBeTruthy();

    // A replacement drain takes over the same runtime key.
    const replacementControl = createCanonicalDrainControl({
      drainId: 'replacement-drain',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    });
    threadRuntimeManager.claimActiveDrain(runtimeKey, replacementControl, null);

    releaseError();
    await flushAsyncWork();

    // No ws error send, no state stomp of the replacement drain.
    expect(deps.ws.send).not.toHaveBeenCalled();
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)?.drainId).toBe('replacement-drain');
    // The stale path must not touch runtime state at all — the replacement
    // drain's own lifecycle stays in charge (still IN_FLIGHT here).
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.IN_FLIGHT);
    expect(warnSpy.mock.calls).toContainEqual([
      '[ThreadRuntime] Ignoring superseded iterator failure',
      {
        threadId: 'thread-1',
        drainId: originalRecord.drainId,
        marker: 'SUPERSEDED_ITERATOR_FAILURE',
      },
    ]);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(canary);
  });

  test('stop through a claimed + bound drain terminalizes and clears-if-current', async () => {
    const stopSession = jest.fn(() => Promise.resolve());
    const wire = { _stopSession: stopSession };
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    getWireForThread.mockReturnValue(wire);

    // Compose the REAL bridge/applier chain exactly like message-router does.
    const emitted = [];
    const applier = createCanonicalChatEventApplier({
      emit: (type, payload) => emitted.push({ type, payload }),
      checkSettingsBounce: () => null,
      generateTurnId: () => 'server-turn-1',
    });
    const bridge = createCanonicalHarnessEventBridge({
      applyChatEvent: applier.applyChatEvent,
      bindDrainTurn: (drainContext, turnId) => threadRuntimeManager.bindTurnToDrain(
        drainContext.control.runtimeKey,
        drainContext.control.drainId,
        turnId
      ),
    });

    // Acceptance-shaped claim, then the REAL bridge path begins and binds.
    const routeContext = createCanonicalRouteContext({
      workspaceId: 'workspace-1',
      workspace: 'workspace:workspace-1',
      projectRoot: '/tmp/project',
      scope: 'project',
      threadId: 'thread-1',
      acceptedUserInput: 'hello',
      attachments: [],
    });
    // SPEC-01 Slice D: the BOUND control is the stop mechanism and is
    // observable separately from the registry wire.
    const boundStopHarness = jest.fn(() => Promise.resolve());
    const control = createCanonicalDrainControl({
      drainId: 'stop-drain',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: boundStopHarness,
    });
    threadRuntimeManager.claimActiveDrain(runtimeKey, control, routeContext);
    bridge.applyHarnessEvent({
      type: 'turn_begin',
      userInput: 'hello',
    }, null, { route: routeContext, control }); // begins + binds server-turn-1
    expect(threadRuntimeManager.resolveBoundTurnId(runtimeKey, 'stop-drain')).toBe('server-turn-1');
    threadRuntimeManager.markInFlight(runtimeKey);

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: bridge.applyHarnessEvent,
    });

    const endEvent = emitted.find(e => e.type === 'chat:turn_end');
    expect(endEvent).toBeDefined();
    expect(endEvent.payload).toMatchObject({
      threadId: 'thread-1',
      turnId: 'server-turn-1',
      reason: 'interrupted',
      partial: true,
      userInput: 'hello',
    });

    // Terminalization cleared-if-current; the completed snapshot remains.
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();
    expect(threadRuntimeManager.getLiveTurn(runtimeKey)).toMatchObject({
      status: 'interrupted',
      turnId: 'server-turn-1',
    });
    // SPEC-01 Slice D: the stop went through the BOUND control capability —
    // never the registry/session wire mechanism.
    expect(boundStopHarness).toHaveBeenCalledTimes(1);
    expect(stopSession).not.toHaveBeenCalled();
    expect(unregisterWire).toHaveBeenCalledWith('thread-1');
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
  });
});

describe('stop supersession guard (SPEC-01 Slice D)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    attachClientToWire.mockReturnValue(true);
    getWireForThread.mockReturnValue(null);
    unregisterWire.mockReturnValue(undefined);
  });

  /** Real bridge/applier chain exactly like message-router composes it. */
  function makeBridge() {
    let turnCounter = 0;
    const applier = createCanonicalChatEventApplier({
      emit: () => {},
      checkSettingsBounce: () => null,
      generateTurnId: () => `server-turn-${++turnCounter}`,
    });
    return createCanonicalHarnessEventBridge({
      applyChatEvent: applier.applyChatEvent,
      bindDrainTurn: (drainContext, turnId) => threadRuntimeManager.bindTurnToDrain(
        drainContext.control.runtimeKey,
        drainContext.control.drainId,
        turnId
      ),
    });
  }

  function makeRouteContext(userInput) {
    return createCanonicalRouteContext({
      workspaceId: 'workspace-1',
      workspace: 'workspace:workspace-1',
      projectRoot: '/tmp/project',
      scope: 'project',
      threadId: 'thread-1',
      acceptedUserInput: userInput,
      attachments: [],
    });
  }

  test('late Stop completion from old drain A cannot affect replacement drain B', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const bridge = makeBridge();

    // Drain A with a SLOW stopHarness so its Stop completion lands after
    // supersession — the deterministic mid-call interleaving.
    let releaseStopA;
    const stopAGate = new Promise(resolve => { releaseStopA = resolve; });
    let stopAEntered = false;
    const controlA = createCanonicalDrainControl({
      drainId: 'drain-A',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => {
        stopAEntered = true;
        await stopAGate;
      },
    });
    const routeA = makeRouteContext('input A');
    threadRuntimeManager.claimActiveDrain(runtimeKey, controlA, routeA);
    bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'input A' }, null, { route: routeA, control: controlA });
    expect(threadRuntimeManager.resolveBoundTurnId(runtimeKey, 'drain-A')).toBe('server-turn-1');
    threadRuntimeManager.markInFlight(runtimeKey);

    // Stop A. The call runs synchronously through capture → STOPPING →
    // interrupted-turn_end synthesis (which terminalizes + clears A's own
    // record) and then suspends inside control.stopHarness() at the gate.
    const stopPromise = stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: bridge.applyHarnessEvent,
    });
    await flushAsyncWork();
    expect(stopAEntered).toBe(true);

    // Supersession mid-stop: replacement drain B claims the runtime key and
    // begins + binds its own turn; the runtime goes back IN_FLIGHT for B.
    const controlB = createCanonicalDrainControl({
      drainId: 'drain-B',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    });
    const routeB = makeRouteContext('input B');
    threadRuntimeManager.claimActiveDrain(runtimeKey, controlB, routeB);
    bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'input B' }, null, { route: routeB, control: controlB });
    threadRuntimeManager.markInFlight(runtimeKey);
    expect(threadRuntimeManager.resolveBoundTurnId(runtimeKey, 'drain-B')).toBe('server-turn-2');

    // A's slow stop resolves AFTER B took over.
    releaseStopA();
    await stopPromise;
    await flushAsyncWork();

    // B's record, bound turn, and live snapshot survive untouched...
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)?.drainId).toBe('drain-B');
    expect(threadRuntimeManager.resolveBoundTurnId(runtimeKey, 'drain-B')).toBe('server-turn-2');
    expect(threadRuntimeManager.getLiveTurn(runtimeKey)).toMatchObject({
      status: 'in_flight',
      turnId: 'server-turn-2',
      fullText: '',
    });
    // ...B-era runtime state was not forced COLD by A's late completion...
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.IN_FLIGHT);
    // ...and no unregisterWire side effect hit the slot B may own.
    expect(unregisterWire).not.toHaveBeenCalledWith('thread-1');
  });

  test('stop of a never-begun claimed drain clears only its own orphaned record', async () => {
    const deps = makeDeps();
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const bridge = makeBridge();

    // Claimed but never begun: no bound turn, so the synthesized interrupted
    // turn_end is dropped pre-binding and cannot clear the record itself.
    const boundStopHarness = jest.fn(() => Promise.resolve());
    const control = createCanonicalDrainControl({
      drainId: 'drain-orphan',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: boundStopHarness,
    });
    threadRuntimeManager.claimActiveDrain(runtimeKey, control, makeRouteContext('orphan input'));
    threadRuntimeManager.beginLiveTurn(runtimeKey, { turnId: 'legacy-live', userInput: 'orphan input' });
    threadRuntimeManager.markInFlight(runtimeKey);

    await stopRuntimeTurn({
      ws: deps.ws,
      session: deps.session,
      clientMsg: { type: 'turn:stop', threadId: 'thread-1' },
      handleCanonicalHarnessEvent: bridge.applyHarnessEvent,
    });
    await flushAsyncWork();

    // Bound control stopped; the orphaned never-begun record was removed by
    // the stop path's clear-if-current; runtime landed cold.
    expect(boundStopHarness).toHaveBeenCalledTimes(1);
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();
    expect(unregisterWire).toHaveBeenCalledWith('thread-1');
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
  });
});

describe('companion error boundary — genuine markers only (SPEC-03 Slice A)', () => {
  function parsedFrames(deps) {
    return deps.ws.send.mock.calls.map(([raw]) => JSON.parse(raw));
  }

  function makeThrowingDeps(thrown) {
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        throw thrown;
      },
    };
    return makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    attachClientToWire.mockReturnValue(true);
    getWireForThread.mockReturnValue(null);
    unregisterWire.mockReturnValue(undefined);
  });

  test('a genuine HARNESS_AUTHENTICATION_FAILED marker sends the fixed auth_error companion with no raw error fields', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const marker = new HarnessRuntimeError('HARNESS_AUTHENTICATION_FAILED', {
      version: 1,
      harnessId: 'opencode',
      category: 'authentication',
      hadRenderableOutput: false,
      hadToolCalls: false,
      truncatedFields: [],
      stderrExcerpt: 'redacted provider text',
    });
    const deps = makeThrowingDeps(marker);

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const frames = parsedFrames(deps);
    const companion = frames.find((frame) => frame.type === 'auth_error');
    expect(companion).toEqual({
      type: 'auth_error',
      scope: 'project',
      threadId: 'thread-1',
      recoverable: true,
      message: HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_AUTHENTICATION_FAILED,
    });
    // Exactly one companion; no raw error serialization anywhere.
    expect(frames.filter((frame) => frame.type === 'auth_error')).toHaveLength(1);
    for (const frame of frames) {
      const serialized = JSON.stringify(frame);
      expect(serialized).not.toContain('redacted provider text');
      expect(frame).not.toHaveProperty('error');
      expect(frame).not.toHaveProperty('stack');
    }
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('redacted provider text');
    expect(errorSpy.mock.calls).toContainEqual([
      '[WS] Harness sendMessage failed',
      {
        threadId: 'thread-1',
        drainId: expect.any(String),
        marker: 'AUTHENTICATION_FAILED',
      },
    ]);
    // Runtime returned to READY after the failed turn.
    expect(threadRuntimeManager.getRuntimeState(getRuntimeKey(deps.manager, 'thread-1')))
      .toBe(RUNTIME_STATES.READY);
  });

  test.each([
    ['an auth-shaped plain Error with code -32004', (() => {
      const lookalike = new Error('Authentication failed for this account');
      lookalike.code = -32004;
      return lookalike;
    })()],
    ['a plain object shaped like the marker', {
      code: 'HARNESS_AUTHENTICATION_FAILED',
      name: 'HarnessRuntimeError',
      message: HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_AUTHENTICATION_FAILED,
    }],
  ])('%s takes the generic path (lookalikes are never classified)', async (_label, thrown) => {
    const deps = makeThrowingDeps(thrown);

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const frames = parsedFrames(deps);
    expect(frames.some((frame) => frame.type === 'auth_error')).toBe(false);
    const generic = frames.at(-1);
    expect(generic).toMatchObject({
      type: 'error',
      scope: 'project',
      threadId: 'thread-1',
      recoverable: true,
    });
    for (const frame of frames) {
      expect(frame).not.toHaveProperty('error');
      expect(frame).not.toHaveProperty('stack');
    }
  });

  test('non-authentication genuine markers take the generic path without raw serialization', async () => {
    const marker = new HarnessRuntimeError('HARNESS_PROCESS_EXIT', {
      version: 1,
      harnessId: 'opencode',
      category: 'process_exit',
      exitCode: 1,
      hadRenderableOutput: true,
      hadToolCalls: false,
      truncatedFields: ['stderrExcerpt'],
      stderrExcerpt: 'redacted exit tail',
    });
    const deps = makeThrowingDeps(marker);

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const frames = parsedFrames(deps);
    expect(frames.some((frame) => frame.type === 'auth_error')).toBe(false);
    expect(frames.at(-1)).toMatchObject({
      type: 'error',
      recoverable: true,
      threadId: 'thread-1',
    });
    const serialized = JSON.stringify(frames);
    expect(serialized).not.toContain('redacted exit tail');
    expect(serialized).not.toContain('HarnessRuntimeError');
  });

  test('no sent frame in any failure scenario carries a raw error object or stack text', async () => {
    const scenarios = [
      new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT'),
      Object.assign(new Error('boom'), { code: -32004 }),
    ];
    for (const thrown of scenarios) {
      const deps = makeThrowingDeps(thrown);
      await acceptPromptThroughRuntime(deps);
      await flushAsyncWork();
      for (const [raw] of deps.ws.send.mock.calls) {
        const frame = JSON.parse(raw);
        expect(frame).not.toHaveProperty('error');
        expect(raw).not.toContain('at ');
        expect(raw).not.toContain('stack');
      }
    }
  });
});

describe('failure-path canonical terminalization (SPEC-03 Slice B)', () => {
  const { TURN_TERMINAL_ERROR_CATALOG } = require('../../lib/thread/turn-terminal-error');

  function parsedFrames(deps) {
    return deps.ws.send.mock.calls.map(([raw]) => JSON.parse(raw));
  }

  /** Real bridge/applier chain exactly like message-router composes it. */
  function makeRealBridge() {
    let turnCounter = 0;
    const applier = createCanonicalChatEventApplier({
      emit: () => {},
      checkSettingsBounce: () => null,
      generateTurnId: () => `server-turn-${++turnCounter}`,
    });
    return createCanonicalHarnessEventBridge({
      applyChatEvent: applier.applyChatEvent,
      bindDrainTurn: (drainContext, turnId) => threadRuntimeManager.bindTurnToDrain(
        drainContext.control.runtimeKey,
        drainContext.control.drainId,
        turnId
      ),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    attachClientToWire.mockReturnValue(true);
    getWireForThread.mockReturnValue(null);
    unregisterWire.mockReturnValue(undefined);
  });

  test('post-begin iterator exception synthesizes EXACTLY ONE error turn_end through the bound context and still sends the companion', async () => {
    const marker = new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT');
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        yield { type: 'content', text: 'partial answer' };
        throw marker;
      },
    };
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    deps.manager.touchSession = jest.fn();

    // Real chain: the synthesized terminal flows bridge → applier → runtime.
    deps.handleCanonicalHarnessEvent = makeRealBridge().applyHarnessEvent;

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    // The bound machinery terminalized the failed turn exactly once...
    const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
    expect(liveTurn).toMatchObject({
      status: 'error',
      turnId: 'server-turn-1',
      fullText: 'partial answer',
      userInput: 'hello',
    });
    expect(liveTurn.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT);
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull(); // clear-if-current ran
    // ...the runtime returned to READY...
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.READY);
    // ...and the Slice-A companion notification STILL went out (after synthesis).
    const frames = parsedFrames(deps);
    const companions = frames.filter((frame) => frame.type === 'error' || frame.type === 'auth_error');
    expect(companions).toHaveLength(1);
    expect(companions[0]).toMatchObject({
      type: 'error',
      scope: 'project',
      threadId: 'thread-1',
      recoverable: true,
    });
  });

  test('post-begin generic failure terminalizes once while companion and server diagnostics omit raw material', async () => {
    const canary = 'CANARY_SECRET_POST_BEGIN_0108';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        yield { type: 'content', text: 'safe partial' };
        throw new Error(canary);
      },
    };
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    deps.manager.touchSession = jest.fn();
    deps.handleCanonicalHarnessEvent = makeRealBridge().applyHarnessEvent;

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
    expect(liveTurn).toMatchObject({
      status: 'error',
      turnId: 'server-turn-1',
      fullText: 'safe partial',
    });
    expect(liveTurn.terminalError).toEqual(
      TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED
    );
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();

    const companions = parsedFrames(deps)
      .filter((frame) => frame.type === 'error' || frame.type === 'auth_error');
    expect(companions).toEqual([{
      type: 'error',
      scope: 'project',
      threadId: 'thread-1',
      recoverable: true,
      message: TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED.message,
    }]);
    expect(JSON.stringify(deps.ws.send.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(canary);
    expect(errorSpy.mock.calls).toContainEqual([
      '[WS] Harness sendMessage failed',
      {
        threadId: 'thread-1',
        drainId: expect.any(String),
        marker: 'MODEL_RESPONSE_FAILED',
      },
    ]);
  });

  test('terminal synthesis exception is value-minimized and still emits one fixed companion', async () => {
    const iteratorCanary = 'CANARY_SECRET_SYNTHESIS_ITERATOR';
    const synthesisCanary = 'CANARY_SECRET_SYNTHESIS_HANDLER';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        throw new Error(iteratorCanary);
      },
    };
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });
    deps.handleCanonicalHarnessEvent = jest.fn((event, _ws, drainContext) => {
      if (event.type === 'turn_begin') {
        threadRuntimeManager.bindTurnToDrain(
          drainContext.control.runtimeKey,
          drainContext.control.drainId,
          'bound-turn-for-synthesis-failure'
        );
      } else if (event.type === 'turn_end' && event.reason === 'error') {
        throw new Error(synthesisCanary);
      }
    });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const companions = parsedFrames(deps)
      .filter((frame) => frame.type === 'error' || frame.type === 'auth_error');
    expect(companions).toEqual([{
      type: 'error',
      scope: 'project',
      threadId: 'thread-1',
      recoverable: true,
      message: TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED.message,
    }]);
    expect(deps.handleCanonicalHarnessEvent.mock.calls
      .filter(([event]) => event.type === 'turn_end' && event.reason === 'error'))
      .toHaveLength(1);
    expect(errorSpy.mock.calls).toEqual([
      [
        '[ThreadRuntime] Error-turn synthesis failed',
        {
          threadId: 'thread-1',
          drainId: expect.any(String),
          marker: 'ERROR_TURN_SYNTHESIS_FAILED',
        },
      ],
      [
        '[WS] Harness sendMessage failed',
        {
          threadId: 'thread-1',
          drainId: expect.any(String),
          marker: 'MODEL_RESPONSE_FAILED',
        },
      ],
    ]);
    const ordinaryMaterial = JSON.stringify({
      frames: deps.ws.send.mock.calls,
      errors: errorSpy.mock.calls,
    });
    expect(ordinaryMaterial).not.toContain(iteratorCanary);
    expect(ordinaryMaterial).not.toContain(synthesisCanary);
    expect(threadRuntimeManager.getRuntimeState(getRuntimeKey(deps.manager, 'thread-1')))
      .toBe(RUNTIME_STATES.READY);
  });

  test('pre-begin iterator exception creates NO canonical event and keeps only the notification', async () => {
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        throw new HarnessRuntimeError('HARNESS_PROCESS_EXIT'); // throws before any event
      },
    };
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    // No canonical event at all — no exchange, no snapshot, no terminalization.
    expect(deps.handleCanonicalHarnessEvent).not.toHaveBeenCalled();
    expect(threadRuntimeManager.getLiveTurn(getRuntimeKey(deps.manager, 'thread-1'))).toBeNull();
    expect(threadRuntimeManager.getActiveDrain(getRuntimeKey(deps.manager, 'thread-1'))).toBeTruthy(); // orphaned claim left for stop-path hygiene, never terminalized
    // Notification behavior unchanged.
    const frames = parsedFrames(deps);
    expect(frames.at(-1)).toMatchObject({
      type: 'error',
      scope: 'project',
      threadId: 'thread-1',
      recoverable: true,
    });
    expect(threadRuntimeManager.getRuntimeState(getRuntimeKey(deps.manager, 'thread-1')))
      .toBe(RUNTIME_STATES.READY);
  });

  test('pre-begin generic failure keeps one fixed companion and value-minimized server diagnostics', async () => {
    const canary = 'CANARY_SECRET_PRE_BEGIN_0108';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        throw new Error(canary);
      },
    };
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)) });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(deps.handleCanonicalHarnessEvent).not.toHaveBeenCalled();
    expect(threadRuntimeManager.getLiveTurn(getRuntimeKey(deps.manager, 'thread-1'))).toBeNull();
    const companions = parsedFrames(deps)
      .filter((frame) => frame.type === 'error' || frame.type === 'auth_error');
    expect(companions).toEqual([{
      type: 'error',
      scope: 'project',
      threadId: 'thread-1',
      recoverable: true,
      message: TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED.message,
    }]);
    expect(JSON.stringify(deps.ws.send.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(canary);
    expect(errorSpy.mock.calls).toContainEqual([
      '[WS] Harness sendMessage failed',
      {
        threadId: 'thread-1',
        drainId: expect.any(String),
        marker: 'MODEL_RESPONSE_FAILED',
      },
    ]);
    expect(threadRuntimeManager.getRuntimeState(getRuntimeKey(deps.manager, 'thread-1')))
      .toBe(RUNTIME_STATES.READY);
  });

  test('lookalike errors normalize to the generic MODEL_RESPONSE_FAILED catalog row on the synthesized terminal', async () => {
    const lookalike = new Error('Authentication failed for this account');
    lookalike.code = -32004;
    const deps = makeDeps({
      spawnAndSetupWire: jest.fn(() => Promise.resolve({
        _usesDirectCanonicalEvents: true,
        async *_sendMessage() {
          yield { type: 'turn_begin', userInput: 'hello' };
          throw lookalike;
        },
      })),
    });
    // The mock handler simulates the bridge's bind-once so the synthesized
    // begin binds exactly like production; capture every call.
    deps.handleCanonicalHarnessEvent = jest.fn((event, ws, dc) => {
      if (event.type === 'turn_begin' && dc?.control) {
        threadRuntimeManager.bindTurnToDrain(dc.control.runtimeKey, dc.control.drainId, 'mock-bound-turn');
      }
    });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const syntheses = deps.handleCanonicalHarnessEvent.mock.calls
      .filter(([event]) => event.type === 'turn_end' && event.reason === 'error');
    expect(syntheses).toHaveLength(1);
    const [synthesized,, drainContext] = syntheses[0];
    expect(synthesized).toMatchObject({ type: 'turn_end', reason: 'error', partial: true });
    expect(synthesized.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
    // Synthesis carries the SAME claimed drain context as every iterator event.
    expect(drainContext.route).toMatchObject({ threadId: 'thread-1', acceptedUserInput: 'hello' });
    expect(drainContext.control.drainId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('a genuine auth marker synthesizes the specific AUTHENTICATION_FAILED envelope plus the fixed-text companion', async () => {
    const marker = new HarnessRuntimeError('HARNESS_AUTHENTICATION_FAILED');
    const deps = makeDeps({
      spawnAndSetupWire: jest.fn(() => Promise.resolve({
        _usesDirectCanonicalEvents: true,
        async *_sendMessage() {
          yield { type: 'turn_begin', userInput: 'hello' };
          throw marker;
        },
      })),
    });
    // Same bind-once simulation as the lookalike test.
    deps.handleCanonicalHarnessEvent = jest.fn((event, ws, dc) => {
      if (event.type === 'turn_begin' && dc?.control) {
        threadRuntimeManager.bindTurnToDrain(dc.control.runtimeKey, dc.control.drainId, 'mock-bound-turn');
      }
    });

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const synthesisCall = deps.handleCanonicalHarnessEvent.mock.calls
      .find(([event]) => event.type === 'turn_end' && event.reason === 'error');
    expect(synthesisCall).toBeTruthy();
    const [synthesized, , drainContext] = synthesisCall;
    expect(synthesized.partial).toBe(true);
    expect(synthesized.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED);

    const frames = parsedFrames(deps);
    expect(frames.filter((frame) => frame.type === 'auth_error')).toHaveLength(1);
    // No frame ever serializes raw error material (class name, stacks).
    for (const frame of frames) {
      expect(JSON.stringify(frame)).not.toContain('HarnessRuntimeError');
      expect(frame).not.toHaveProperty('error');
      expect(frame).not.toHaveProperty('stack');
      expect(frame).not.toHaveProperty('terminalError'); // companions stay envelope-free
    }
  });
});

describe('diagnosticId wiring through the existing terminal chain (SPEC-03 Slice C)', () => {
  const { TURN_TERMINAL_ERROR_CATALOG } = require('../../lib/thread/turn-terminal-error');

  function makeCandidate() {
    return {
      version: 1,
      harnessId: 'opencode',
      category: 'timeout',
      hadRenderableOutput: true,
      hadToolCalls: false,
      truncatedFields: [],
    };
  }

  /** Real bridge/applier chain exactly like message-router composes it. */
  function makeRealBridge() {
    const emitted = [];
    let turnCounter = 0;
    const applier = createCanonicalChatEventApplier({
      emit: (type, payload) => emitted.push({ type, payload }),
      checkSettingsBounce: () => null,
      generateTurnId: () => `server-turn-${++turnCounter}`,
    });
    const bridge = createCanonicalHarnessEventBridge({
      applyChatEvent: applier.applyChatEvent,
      bindDrainTurn: (drainContext, turnId) => threadRuntimeManager.bindTurnToDrain(
        drainContext.control.runtimeKey,
        drainContext.control.drainId,
        turnId
      ),
    });
    return { bridge, emitted };
  }

  function makeThrowingDeps(thrown, handleCanonicalHarnessEvent) {
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        yield { type: 'content', text: 'partial answer' };
        throw thrown;
      },
    };
    const deps = makeDeps({
      spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)),
      handleCanonicalHarnessEvent,
    });
    deps.manager.touchSession = jest.fn(); // bound drain control closure calls it
    return deps;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    threadRuntimeManager.runtimes.clear();
    attachClientToWire.mockReturnValue(true);
    getWireForThread.mockReturnValue(null);
    unregisterWire.mockReturnValue(undefined);
    persistDiagnosticReport.mockResolvedValue(null); // failure-shaped default
  });

  test('genuine marker + candidate: error turn_end, terminal snapshot, and service binding all carry the diagnosticId', async () => {
    persistDiagnosticReport.mockResolvedValue('diag-uuid-1');
    const marker = new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT', makeCandidate());
    const { bridge, emitted } = makeRealBridge();
    const deps = makeThrowingDeps(marker, bridge.applyHarnessEvent);
    deps.manager.touchSession = jest.fn();

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    // The service received the authoritative prompt-bound identity and ONLY
    // the already-sanitized closed candidate (never the raw error).
    expect(persistDiagnosticReport).toHaveBeenCalledTimes(1);
    const [bindingArg, candidateArg] = persistDiagnosticReport.mock.calls[0];
    expect(bindingArg).toEqual({
      workspaceId: 'workspace-1',
      threadId: 'thread-1',
      turnId: 'server-turn-1',
    });
    expect(candidateArg).toEqual(makeCandidate());
    expect(candidateArg).toBe(marker.candidate); // the sanitized candidate itself

    const expectedEnvelope = {
      ...TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT,
      diagnosticId: 'diag-uuid-1',
    };
    // Exactly ONE wire turn_end carries the envelope incl. diagnosticId.
    const ends = emitted.filter((entry) => entry.type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0].payload).toMatchObject({
      threadId: 'thread-1',
      turnId: 'server-turn-1',
      reason: 'error',
      partial: true,
    });
    expect(ends[0].payload.terminalError).toEqual(expectedEnvelope);
    // The retained terminal snapshot carries the SAME envelope (published
    // seq === retained seq chain; no second publication path).
    const liveTurn = threadRuntimeManager.getLiveTurn(getRuntimeKey(deps.manager, 'thread-1'));
    expect(liveTurn.status).toBe('error');
    expect(liveTurn.terminalError).toEqual(expectedEnvelope);
    expect(liveTurn.fullText).toBe('partial answer');
    expect(threadRuntimeManager.getRuntimeState(getRuntimeKey(deps.manager, 'thread-1')))
      .toBe(RUNTIME_STATES.READY);
  });

  test('absent candidate: the service is never called and the envelope carries no diagnosticId', async () => {
    const marker = new HarnessRuntimeError('HARNESS_PROCESS_EXIT'); // no candidate
    const { bridge, emitted } = makeRealBridge();
    const deps = makeThrowingDeps(marker, bridge.applyHarnessEvent);

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(persistDiagnosticReport).not.toHaveBeenCalled();
    const ends = emitted.filter((entry) => entry.type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0].payload.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED);
    expect('diagnosticId' in ends[0].payload.terminalError).toBe(false);
  });

  test('service failure (null) leaves terminalization exactly as Slice B — no diagnosticId, same single error terminal', async () => {
    persistDiagnosticReport.mockResolvedValue(null);
    const marker = new HarnessRuntimeError('HARNESS_AUTHENTICATION_FAILED', makeCandidate());
    const { bridge, emitted } = makeRealBridge();
    const deps = makeThrowingDeps(marker, bridge.applyHarnessEvent);

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(persistDiagnosticReport).toHaveBeenCalledTimes(1);
    const ends = emitted.filter((entry) => entry.type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0].payload.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED);
    expect('diagnosticId' in ends[0].payload.terminalError).toBe(false);
    const liveTurn = threadRuntimeManager.getLiveTurn(getRuntimeKey(deps.manager, 'thread-1'));
    expect(liveTurn.status).toBe('error');
    expect(liveTurn.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED);
    expect(threadRuntimeManager.getRuntimeState(getRuntimeKey(deps.manager, 'thread-1')))
      .toBe(RUNTIME_STATES.READY);
  });

  test('rejecting diagnostic dependency is fixed-safe and cannot wedge interactive terminalization', async () => {
    const canary = 'CANARY_INTERACTIVE_DIAGNOSTIC_REJECTION_0108';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    persistDiagnosticReport.mockRejectedValue(new Error(canary));
    const marker = new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT', makeCandidate());
    const { bridge, emitted } = makeRealBridge();
    const deps = makeThrowingDeps(marker, bridge.applyHarnessEvent);

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const ends = emitted.filter((entry) => entry.type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0].payload.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT);
    expect('diagnosticId' in ends[0].payload.terminalError).toBe(false);
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');
    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.READY);
    expect(threadRuntimeManager.getActiveDrain(runtimeKey)).toBeNull();
    expect(warnSpy.mock.calls).toContainEqual([
      '[HarnessDiagnostics] Terminal persistence dependency failed',
      {
        workspaceId: 'workspace-1',
        threadId: 'thread-1',
        turnId: 'server-turn-1',
        marker: 'HARNESS_DIAGNOSTIC_DEPENDENCY_FAILED',
      },
    ]);
    expect(JSON.stringify({
      frames: deps.ws.send.mock.calls,
      emitted,
      warnLogs: warnSpy.mock.calls,
      errorLogs: errorSpy.mock.calls,
    })).not.toContain(canary);
  });

  test('a non-genuine error carrying a candidate-shaped property never reaches the service', async () => {
    const lookalike = new Error('boom');
    lookalike.candidate = makeCandidate(); // hostile: plain errors are never markers
    const { bridge, emitted } = makeRealBridge();
    const deps = makeThrowingDeps(lookalike, bridge.applyHarnessEvent);

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    expect(persistDiagnosticReport).not.toHaveBeenCalled();
    const ends = emitted.filter((entry) => entry.type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0].payload.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
    expect('diagnosticId' in ends[0].payload.terminalError).toBe(false);
  });

  test('regression guard: a normal completion never carries terminalError at all', async () => {
    const { bridge, emitted } = makeRealBridge();
    const wire = {
      _usesDirectCanonicalEvents: true,
      async *_sendMessage() {
        yield { type: 'turn_begin', userInput: 'hello' };
        yield { type: 'turn_end' };
      },
    };
    const deps = makeDeps({
      spawnAndSetupWire: jest.fn(() => Promise.resolve(wire)),
      handleCanonicalHarnessEvent: bridge.applyHarnessEvent,
    });
    deps.manager.touchSession = jest.fn();

    await acceptPromptThroughRuntime(deps);
    await flushAsyncWork();

    const ends = emitted.filter((entry) => entry.type === 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0].payload.reason).toBe('complete');
    expect('terminalError' in ends[0].payload).toBe(false);
    expect(persistDiagnosticReport).not.toHaveBeenCalled();
  });
});
