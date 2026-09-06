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

const ThreadWebSocketHandler = require('../../lib/thread/ThreadWebSocketHandler');
const { attachClientToWire, getWireForThread, unregisterWire } = require('../../lib/wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const { createWireMessageRouter } = require('../../lib/wire/message-router');
const {
  createAgentTurnAuthorityRef,
  releaseAgentTurnAuthorityRef,
} = require('../../lib/agent-provenance/turn-authority');
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

describe('thread runtime prompt controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(deps.handleCanonicalHarnessEvent).toHaveBeenCalledWith({ type: 'turn_end' }, deps.ws);
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

  test('warm failure returns runtime to cold and sends recoverable error', async () => {
    const deps = makeDeps({ spawnAndSetupWire: jest.fn(() => Promise.reject(new Error('warm failed'))) });
    const runtimeKey = getRuntimeKey(deps.manager, 'thread-1');

    await acceptPromptThroughRuntime(deps);

    expect(threadRuntimeManager.getRuntimeState(runtimeKey)).toBe(RUNTIME_STATES.COLD);
    expect(JSON.parse(deps.ws.send.mock.calls[0][0])).toMatchObject({
      type: 'error',
      message: 'warm failed',
      threadId: 'thread-1',
      recoverable: true,
    });
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
