'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { checkSettingsBounce } = require('../../lib/enforcement');
const { createCanonicalChatEventApplier } = require('../../lib/wire/canonical-chat-event-applier');
const { createCanonicalHarnessEventBridge } = require('../../lib/wire/canonical-harness-event-bridge');
const { OpenCodeJsonEventTranslator } = require('../../lib/harness/opencode/json-event-translator');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');

function makeAuthority(overrides = {}) {
  return Object.freeze({
    workspaceId: 'workspace-A', threadId: 'thread-A', turnId: 'turn-A',
    harnessId: 'opencode', provider: 'opencode', canonicalRoot: '/workspace/A',
    authorityRootSha256: 'a'.repeat(64), authorityRootDevice: '1', authorityRootInode: '2',
    ...overrides,
  });
}

function makeSnapshot(overrides = {}) {
  return {
    type: 'tool_snapshot', origin: 'terminal_snapshot', harnessId: 'opencode', provider: 'opencode',
    timestamp: 30, timestampSource: 'provider_reported', observedAt: 100,
    toolCallId: 'call-1', toolName: 'write', nativeToolName: 'write', status: 'completed',
    hasInput: true, input: { filePath: 'Settings/config.json' },
    executionStartedReportedAt: 10, terminalReportedAt: 20, terminalSnapshotReportedAt: 30,
    result: { output: 'provider result', display: [], returnedDiff: false, isError: false, files: [], omitted: undefined },
    ...overrides,
  };
}

function makeHarness(activityOwner, settingsBounce = () => null, onEmit = null, options = {}) {
  const emitted = [];
  const session = {
    currentWorkspaceId: 'workspace-A', currentThreadId: 'thread-A', projectRoot: '/workspace/A',
    pendingUserInput: 'do it', pendingTurnId: 'turn-A',
    pendingAgentTurnAuthority: options.authority === undefined ? makeAuthority() : options.authority,
    currentTurn: null, assistantParts: [], hasToolCalls: false, toolArgs: {},
    wire: { killed: false, kill: jest.fn() },
  };
  const applier = createCanonicalChatEventApplier({
    session,
    emit: (type, payload) => {
      emitted.push({ type, payload });
      onEmit?.(type, payload);
    },
    resolveWorkspace: value => `workspace:${value.currentWorkspaceId}`,
    touchThreadSession: jest.fn(), checkSettingsBounce: settingsBounce,
    generateTurnId: () => 'wrong-turn', activityOwner,
    enableSyntheticIncrementalProvenance: Boolean(options.enableSyntheticIncrementalProvenance),
  });
  const bridge = createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
    finalizationTimeoutMs: options.finalizationTimeoutMs,
  });
  return { emitted, session, bridge, applier };
}

describe('atomic OpenCode terminal snapshot application', () => {
  beforeEach(() => threadRuntimeManager.runtimes.clear());

  test('reserves before call/args/result expansion and resolves Settings once against frozen root', async () => {
    const order = [];
    let reserved;
    const owner = {
      jsonSafePersistedResult(value) {
        return JSON.parse(JSON.stringify(value));
      },
      async captureTerminalSnapshot(authority, snapshot, result) {
        order.push('reserve');
        reserved = { authority, snapshot, result };
      },
      interruptOpen: jest.fn(async () => []),
    };
    const roots = [];
    const { emitted, session, bridge } = makeHarness(owner, (_tool, _args, root) => {
      roots.push(root);
      return { message: 'blocked at result' };
    });
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    session.currentWorkspaceId = 'workspace-B';
    session.currentThreadId = 'thread-B';
    session.projectRoot = '/workspace/B';
    await bridge.applyHarnessEvent(makeSnapshot());
    order.push(...emitted.filter(item => item.type.startsWith('chat:tool') || item.type === 'system:tool_bounced').map(item => item.type));

    expect(roots).toEqual(['/workspace/A']);
    expect(reserved).toEqual({
      authority: makeAuthority(),
      snapshot: expect.objectContaining({ status: 'completed' }),
      result: {
        output: 'blocked at result', statusMessage: 'blocked at result', display: [], returnedDiff: false,
        isError: true, error: 'blocked at result', files: [], enforcementPhase: 'tool_result',
      },
    });
    expect(order).toEqual(['reserve', 'chat:tool_call', 'chat:tool_call_args', 'system:tool_bounced', 'chat:tool_result']);
    expect(session.wire.kill).not.toHaveBeenCalled();
    const part = session.assistantParts[0];
    expect(part).toMatchObject({
      toolCallId: 'call-1', terminalSnapshotExpansionVersion: 1,
      terminalSnapshotExpansionComplete: true,
      arguments: { filePath: 'Settings/config.json' },
      result: { output: 'blocked at result', enforcementPhase: 'tool_result' },
    });
    expect(emitted.find(item => item.type === 'chat:tool_result').payload).toMatchObject({
      workspace: 'workspace:workspace-A', threadId: 'thread-A', turnId: 'turn-A',
    });
    expect(reserved.result).toEqual(JSON.parse(JSON.stringify(part.result)));
  });

  test('reservation failure remains fail-open for result, later text, and exactly one turn end', async () => {
    const owner = {
      jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
      captureTerminalSnapshot: jest.fn(async () => { throw new Error('db down'); }),
      interruptOpen: jest.fn(async () => []),
    };
    const { emitted, session, bridge } = makeHarness(owner);
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    await bridge.applyHarnessEvent(makeSnapshot({ input: { filePath: 'src/a.js' } }));
    await bridge.applyHarnessEvent({ type: 'content', text: 'after tool' });
    await Promise.all([
      bridge.applyHarnessEvent({ type: 'turn_end', reason: 'complete' }),
      bridge.applyHarnessEvent({ type: 'turn_end', reason: 'interrupted', partial: true }),
    ]);
    expect(emitted.filter(item => item.type === 'chat:tool_result')).toHaveLength(1);
    expect(emitted.filter(item => item.type === 'chat:content')).toHaveLength(1);
    expect(emitted.filter(item => item.type === 'chat:turn_end')).toHaveLength(1);
    expect(emitted.find(item => item.type === 'chat:turn_end').payload.parts).toEqual([
      expect.objectContaining({ type: 'tool_call', terminalSnapshotExpansionComplete: true }),
      { type: 'text', content: 'after tool' },
    ]);
    expect(session.currentTurn).toBeNull();
  });

  test('a pre-barrier tool call cannot resume chat mutation after the queue deadline', async () => {
    let resumeAnnounce;
    let announceStarted;
    const announced = new Promise(resolve => { announceStarted = resolve; });
    let resumeInterrupt;
    let interruptStarted;
    const interrupting = new Promise(resolve => { interruptStarted = resolve; });
    const owner = {
      announce: jest.fn(() => {
        announceStarted();
        return new Promise(resolve => { resumeAnnounce = resolve; });
      }),
      interruptOpen: jest.fn(() => {
        interruptStarted();
        return new Promise(resolve => { resumeInterrupt = resolve; });
      }),
    };
    const { emitted, session, bridge } = makeHarness(owner, () => null, null, {
      enableSyntheticIncrementalProvenance: true,
      finalizationTimeoutMs: 20,
    });
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    const toolCall = bridge.applyHarnessEvent({
      type: 'tool_call', toolCallId: 'stale-call', toolName: 'read', nativeToolName: 'read',
    });
    await announced;
    const ending = bridge.finalizeTurn({ type: 'turn_end', reason: 'interrupted', partial: true });
    await interrupting;

    resumeAnnounce({ replay: false });
    await toolCall;
    expect(session.currentTurn?.id).toBe('turn-A');
    expect(session.assistantParts).toEqual([]);
    expect(emitted.map(item => item.type)).toEqual(['chat:turn_begin']);

    resumeInterrupt([]);
    await ending;
    expect(emitted.map(item => item.type)).toEqual(['chat:turn_begin', 'chat:turn_end']);
    expect(emitted[1].payload.parts).toEqual([]);
  });

  test('a started terminal reservation cannot expand after the queue deadline', async () => {
    let resumeCapture;
    let captureStarted;
    const capturing = new Promise(resolve => { captureStarted = resolve; });
    let resumeInterrupt;
    let interruptStarted;
    const interrupting = new Promise(resolve => { interruptStarted = resolve; });
    const owner = {
      jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
      captureTerminalSnapshot: jest.fn(() => {
        captureStarted();
        return new Promise(resolve => { resumeCapture = resolve; });
      }),
      interruptOpen: jest.fn(() => {
        interruptStarted();
        return new Promise(resolve => { resumeInterrupt = resolve; });
      }),
    };
    const { emitted, session, bridge } = makeHarness(owner, () => null, null, {
      finalizationTimeoutMs: 20,
    });
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    const terminal = bridge.applyHarnessEvent(makeSnapshot({
      toolCallId: 'stale-terminal', input: { filePath: 'src/stale.txt' },
    }));
    await capturing;
    const ending = bridge.finalizeTurn({ type: 'turn_end', reason: 'interrupted', partial: true });
    await interrupting;

    resumeCapture({ replay: false });
    await terminal;
    expect(session.currentTurn?.id).toBe('turn-A');
    expect(session.assistantParts).toEqual([]);
    expect(emitted.map(item => item.type)).toEqual(['chat:turn_begin']);

    resumeInterrupt([]);
    await ending;
    expect(emitted.map(item => item.type)).toEqual(['chat:turn_begin', 'chat:turn_end']);
    expect(emitted[1].payload.parts).toEqual([]);
  });

  test('same-socket foreground drains retain independent turn state through interleaved completion', async () => {
    const owner = {
      jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
      captureTerminalSnapshot: jest.fn(async () => ({ replay: false })),
      interruptOpen: jest.fn(async () => []),
    };
    const built = makeHarness(owner);
    const authorityA = makeAuthority({ threadId: 'thread-A', turnId: 'turn-A' });
    const authorityB = makeAuthority({ threadId: 'thread-B', turnId: 'turn-B' });
    const applicationContext = (turnAuthority, input) => ({
      ...built.session,
      currentWorkspaceId: turnAuthority.workspaceId,
      currentThreadId: turnAuthority.threadId,
      projectRoot: turnAuthority.canonicalRoot,
      pendingAgentTurnAuthority: turnAuthority,
      pendingTurnId: turnAuthority.turnId,
      pendingUserInput: input,
      pendingAttachments: [],
      currentTurn: null,
      assistantParts: [],
      hasToolCalls: false,
      toolArgs: {},
      toolNamesById: {},
      bouncedToolCalls: new Set(),
    });
    let markABegun;
    const aBegun = new Promise(resolve => { markABegun = resolve; });
    let releaseA;
    const aMayContinue = new Promise(resolve => { releaseA = resolve; });
    async function* eventsA() {
      yield { type: 'turn_begin', userInput: 'prompt A' };
      markABegun();
      await aMayContinue;
      yield { type: 'content', text: 'late A text' };
      yield makeSnapshot({
        toolCallId: 'tool-A', input: { filePath: 'src/a.txt' }, result: { output: 'A result' },
      });
    }
    async function* eventsB() {
      yield { type: 'turn_begin', userInput: 'prompt B' };
      yield { type: 'content', text: 'B text' };
      yield makeSnapshot({
        toolCallId: 'tool-B', input: { filePath: 'src/b.txt' }, result: { output: 'B result' },
      });
    }

    const drainA = built.bridge.drainHarnessEvents(eventsA(), null, {
      turnAuthority: authorityA,
      turnApplicationContext: applicationContext(authorityA, 'prompt A'),
    });
    await aBegun;
    await built.bridge.drainHarnessEvents(eventsB(), null, {
      turnAuthority: authorityB,
      turnApplicationContext: applicationContext(authorityB, 'prompt B'),
    });

    expect(built.emitted.filter(item => item.type === 'chat:turn_end').map(item => item.payload.turnId))
      .toEqual(['turn-B']);
    releaseA();
    await drainA;

    const results = built.emitted.filter(item => item.type === 'chat:tool_result');
    expect(results.map(item => [item.payload.turnId, item.payload.toolCallId, item.payload.toolOutput])).toEqual([
      ['turn-B', 'tool-B', 'B result'],
      ['turn-A', 'tool-A', 'A result'],
    ]);
    const endings = built.emitted.filter(item => item.type === 'chat:turn_end');
    expect(endings.map(item => item.payload.turnId)).toEqual(['turn-B', 'turn-A']);
    expect(endings.find(item => item.payload.turnId === 'turn-A').payload).toMatchObject({
      threadId: 'thread-A', fullText: 'late A text', userInput: 'prompt A',
    });
    expect(endings.find(item => item.payload.turnId === 'turn-B').payload).toMatchObject({
      threadId: 'thread-B', fullText: 'B text', userInput: 'prompt B',
    });
    expect(owner.captureTerminalSnapshot.mock.calls.map(([turnAuthority, event]) => [
      turnAuthority.turnId, event.toolCallId,
    ])).toEqual([
      ['turn-B', 'tool-B'],
      ['turn-A', 'tool-A'],
    ]);
  });

  test('one same-socket drain error finalizes only itself while the other remains live', async () => {
    const owner = { interruptOpen: jest.fn(async () => []) };
    const built = makeHarness(owner);
    const authorityA = makeAuthority({ threadId: 'thread-error-A', turnId: 'turn-error-A' });
    const authorityB = makeAuthority({ threadId: 'thread-error-B', turnId: 'turn-error-B' });
    const applicationContext = (turnAuthority, input) => ({
      ...built.session,
      currentThreadId: turnAuthority.threadId,
      pendingAgentTurnAuthority: turnAuthority,
      pendingTurnId: turnAuthority.turnId,
      pendingUserInput: input,
      pendingAttachments: [],
      currentTurn: null,
      assistantParts: [],
      hasToolCalls: false,
      toolArgs: {},
      toolNamesById: {},
      bouncedToolCalls: new Set(),
    });
    let markABegun;
    const aBegun = new Promise(resolve => { markABegun = resolve; });
    let releaseA;
    const aMayContinue = new Promise(resolve => { releaseA = resolve; });
    async function* eventsA() {
      yield { type: 'turn_begin', userInput: 'error peer A' };
      markABegun();
      await aMayContinue;
      yield { type: 'content', text: 'A survived' };
    }
    async function* eventsB() {
      yield { type: 'turn_begin', userInput: 'error B' };
      yield { type: 'content', text: 'B partial' };
      throw new Error('B iterator failed');
    }

    const drainA = built.bridge.drainHarnessEvents(eventsA(), null, {
      turnAuthority: authorityA,
      turnApplicationContext: applicationContext(authorityA, 'error peer A'),
    });
    await aBegun;
    await expect(built.bridge.drainHarnessEvents(eventsB(), null, {
      turnAuthority: authorityB,
      turnApplicationContext: applicationContext(authorityB, 'error B'),
    })).rejects.toThrow('B iterator failed');
    expect(built.emitted.filter(item => item.type === 'chat:turn_end').map(item => item.payload.turnId))
      .toEqual(['turn-error-B']);

    releaseA();
    await drainA;
    const endings = built.emitted.filter(item => item.type === 'chat:turn_end');
    expect(endings.map(item => item.payload.turnId)).toEqual(['turn-error-B', 'turn-error-A']);
    expect(endings.find(item => item.payload.turnId === 'turn-error-A').payload.fullText).toBe('A survived');
  });

  test('ordinary terminal result installs the exact JSON-safe fingerprint value without undefined keys', async () => {
    let fingerprintValue;
    const owner = {
      jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
      captureTerminalSnapshot: jest.fn(async (_authority, _snapshot, result) => {
        fingerprintValue = result;
        return { replay: false };
      }),
      interruptOpen: jest.fn(async () => []),
    };
    const { session, bridge } = makeHarness(owner);
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    await bridge.applyHarnessEvent(makeSnapshot({ input: { filePath: 'src/a.js' } }));

    const installed = session.assistantParts[0].result;
    expect(installed).toBe(fingerprintValue);
    expect(installed).not.toHaveProperty('statusMessage');
    expect(installed).not.toHaveProperty('error');
  });

  test('symlink enforcement stays on the accepted root through A to B to A navigation', async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-agent-settings-'));
    try {
      const rootA = path.join(temporaryRoot, 'A');
      const rootB = path.join(temporaryRoot, 'B');
      await fs.mkdir(path.join(rootA, 'settings'), { recursive: true });
      await fs.mkdir(path.join(rootB, 'ordinary'), { recursive: true });
      await fs.symlink(path.join(rootA, 'settings'), path.join(rootA, 'linked'));
      await fs.symlink(path.join(rootB, 'ordinary'), path.join(rootB, 'linked'));
      const owner = {
        jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
        captureTerminalSnapshot: jest.fn(async () => ({ replay: false })),
        interruptOpen: jest.fn(async () => []),
      };
      const acceptedAuthority = makeAuthority({ canonicalRoot: rootA });
      const { emitted, session, bridge } = makeHarness(
        owner,
        checkSettingsBounce,
        null,
        { authority: acceptedAuthority },
      );
      await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });

      session.projectRoot = rootB;
      await bridge.applyHarnessEvent(makeSnapshot({
        toolCallId: 'call-B',
        input: { filePath: 'linked/from-b.txt' },
      }));
      session.projectRoot = rootA;
      await bridge.applyHarnessEvent(makeSnapshot({
        toolCallId: 'call-A',
        input: { filePath: 'linked/from-a.txt' },
      }));

      expect(owner.captureTerminalSnapshot).toHaveBeenCalledTimes(2);
      expect(emitted.filter(item => item.type === 'system:tool_bounced')).toHaveLength(2);
      expect(session.wire.kill).not.toHaveBeenCalled();
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('authority-unavailable terminal snapshots never enforce against mutable session root', async () => {
    const settingsBounce = jest.fn(() => ({ message: 'must not run' }));
    const { emitted, bridge } = makeHarness(null, settingsBounce, null, { authority: null });
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    await bridge.applyHarnessEvent(makeSnapshot());
    expect(settingsBounce).not.toHaveBeenCalled();
    expect(emitted.filter(item => item.type === 'system:tool_bounced')).toHaveLength(0);
    expect(emitted.find(item => item.type === 'chat:tool_result').payload.toolOutput).toBe('provider result');
  });

  test('JSON-safe conversion failure omits only the digest and does not rewrite tool truth', async () => {
    const circularOutput = {};
    circularOutput.self = circularOutput;
    const owner = {
      jsonSafePersistedResult: jest.fn(() => { throw new TypeError('cyclic'); }),
      captureTerminalSnapshot: jest.fn(async () => ({ replay: false })),
      interruptOpen: jest.fn(async () => []),
    };
    const { emitted, session, bridge } = makeHarness(owner);
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    await bridge.applyHarnessEvent(makeSnapshot({
      input: { filePath: 'src/a.js' },
      result: { output: circularOutput, display: [], returnedDiff: false, isError: false, files: [] },
    }));

    expect(owner.captureTerminalSnapshot).toHaveBeenCalledWith(
      makeAuthority(),
      expect.objectContaining({ toolCallId: 'call-1' }),
      undefined,
      expect.objectContaining({ isCurrent: expect.any(Function) }),
    );
    expect(session.assistantParts[0].result.output).toBe(circularOutput);
    expect(emitted.find(item => item.type === 'chat:tool_result').payload.toolOutput).toBe(circularOutput);
  });

  test('awaits application in ingress order and ignores a terminal arriving after the barrier', async () => {
    const calls = [];
    let release;
    const bridge = createCanonicalHarnessEventBridge({
      applyChatEvent: async event => {
        calls.push(event.type);
        if (event.type === 'content') await new Promise(resolve => { release = resolve; });
      },
    });
    const content = bridge.applyHarnessEvent({ type: 'content', text: 'one' });
    const end = bridge.applyHarnessEvent({ type: 'turn_end', reason: 'complete' });
    const late = bridge.applyHarnessEvent(makeSnapshot());
    expect(calls).toEqual(['content']);
    release();
    await Promise.all([content, end, late]);
    expect(calls).toEqual(['content', 'turn_end']);
  });

  test('a terminal snapshot queued before stop drains before the exclusive finalizer barrier', async () => {
    const calls = [];
    let release;
    const bridge = createCanonicalHarnessEventBridge({
      applyChatEvent: async event => {
        calls.push([event.type, event.payload.ingressOrdinal]);
        if (event.type === 'content') await new Promise(resolve => { release = resolve; });
      },
    });
    const content = bridge.applyHarnessEvent({ type: 'content', text: 'one' });
    const terminal = bridge.applyHarnessEvent(makeSnapshot());
    const stopped = bridge.finalizeTurn({ type: 'turn_end', reason: 'interrupted', partial: true });
    release();
    await Promise.all([content, terminal, stopped]);
    expect(calls).toEqual([
      ['content', 0],
      ['tool_snapshot', 1],
      ['turn_end', 2],
    ]);
  });

  test('finalizer bounds a stalled pre-barrier application and prevents late chat mutation', async () => {
    let resumeAnnouncement;
    const owner = {
      announce: jest.fn(() => new Promise(resolve => { resumeAnnouncement = resolve; })),
      interruptOpen: jest.fn(async () => []),
    };
    const diagnostics = [];
    const emitted = [];
    const session = {
      currentWorkspaceId: 'workspace-A', currentThreadId: 'thread-A', projectRoot: '/workspace/A',
      pendingUserInput: 'do it', pendingTurnId: 'turn-A', pendingAgentTurnAuthority: makeAuthority(),
      currentTurn: null, assistantParts: [], hasToolCalls: false, toolArgs: {},
    };
    const applier = createCanonicalChatEventApplier({
      session,
      emit: (type, payload) => emitted.push({ type, payload }),
      resolveWorkspace: value => `workspace:${value.currentWorkspaceId}`,
      touchThreadSession: jest.fn(), checkSettingsBounce: () => null,
      generateTurnId: () => 'wrong-turn', activityOwner: owner,
      enableSyntheticIncrementalProvenance: true,
    });
    const bridge = createCanonicalHarnessEventBridge({
      applyChatEvent: applier.applyChatEvent,
      onDiagnostic: code => diagnostics.push(code),
      finalizationTimeoutMs: 20,
    });
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    const stalled = bridge.applyHarnessEvent({
      type: 'tool_call', toolCallId: 'late-call', toolName: 'write', nativeToolName: 'write',
      harnessId: 'opencode', provider: 'opencode', observedAt: 10,
    });
    const finalized = bridge.finalizeTurn({ type: 'turn_end', reason: 'interrupted', partial: true });
    await finalized;

    expect(diagnostics).toEqual(['agent_turn_queue_timeout']);
    expect(emitted.filter(item => item.type === 'chat:turn_end')).toHaveLength(1);
    expect(session.currentTurn).toBeNull();
    resumeAnnouncement({ replay: false });
    await stalled;
    expect(session.assistantParts).toEqual([]);
    expect(emitted.filter(item => item.type === 'chat:tool_call')).toHaveLength(0);
  });

  test('timed-out A queue cannot reserve or render its queued terminal snapshot after B starts', async () => {
    let resumeAnnouncement;
    const owner = {
      announce: jest.fn(() => new Promise(resolve => { resumeAnnouncement = resolve; })),
      captureTerminalSnapshot: jest.fn(async () => ({ replay: false })),
      interruptOpen: jest.fn(async () => []),
      jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
    };
    const built = makeHarness(owner, () => null, null, { enableSyntheticIncrementalProvenance: true });
    let identity = { workspaceId: 'workspace-A', threadId: 'thread-A', turnId: 'turn-A' };
    const original = createCanonicalHarnessEventBridge({
      applyChatEvent: built.applier.applyChatEvent,
      resolveTurnIdentity: () => identity,
      finalizationTimeoutMs: 20,
    });
    const rebound = createCanonicalHarnessEventBridge({
      applyChatEvent: jest.fn(async () => {}),
      resolveTurnIdentity: () => identity,
      finalizationTimeoutMs: 20,
    });
    await original.applyHarnessEvent({ type: 'turn_begin', userInput: 'A' });
    const stalled = original.applyHarnessEvent({
      type: 'tool_call', toolCallId: 'stall-A', toolName: 'write', nativeToolName: 'write', observedAt: 10,
    });
    const terminal = original.applyHarnessEvent(makeSnapshot({
      toolCallId: 'terminal-A', input: { filePath: 'src/old.txt' },
    }));
    await rebound.finalizeTurn({ type: 'turn_end', reason: 'interrupted', partial: true });

    identity = { ...identity, turnId: 'turn-B' };
    built.session.pendingAgentTurnAuthority = makeAuthority({ turnId: 'turn-B' });
    built.session.pendingTurnId = 'turn-B';
    built.session.pendingUserInput = 'B';
    await original.applyHarnessEvent({ type: 'turn_begin', userInput: 'B' });
    resumeAnnouncement({ replay: false });
    await Promise.all([stalled, terminal]);

    expect(owner.captureTerminalSnapshot).not.toHaveBeenCalled();
    expect(built.session.currentTurn.id).toBe('turn-B');
    expect(built.session.assistantParts).toEqual([]);
    expect(built.emitted.filter(item => item.type === 'chat:tool_result')).toHaveLength(0);
    expect(built.emitted.filter(item => item.type === 'chat:turn_end').map(item => item.payload.turnId)).toEqual(['turn-A']);
  });

  test('two terminal tools remain ordered while exact and conflicting duplicates compare without rerendering', async () => {
    const owner = {
      jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
      captureTerminalSnapshot: jest.fn(async () => ({ replay: false })),
      interruptOpen: jest.fn(async () => []),
    };
    const { emitted, bridge } = makeHarness(owner);
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    const first = makeSnapshot({ toolCallId: 'call-1', input: { filePath: 'src/one.js' } });
    await bridge.applyHarnessEvent(first);
    await bridge.applyHarnessEvent({ type: 'content', text: 'between' });
    await bridge.applyHarnessEvent(makeSnapshot({ toolCallId: 'call-2', input: { filePath: 'src/two.js' } }));
    await bridge.applyHarnessEvent(first);
    await bridge.applyHarnessEvent(makeSnapshot({
      toolCallId: 'call-1', status: 'error', input: { filePath: 'src/conflict.js' },
      result: { output: 'different', display: [], returnedDiff: false, isError: true, files: [] },
    }));
    await bridge.applyHarnessEvent({ type: 'turn_end', reason: 'complete' });

    expect(owner.captureTerminalSnapshot).toHaveBeenCalledTimes(4);
    expect(owner.captureTerminalSnapshot.mock.calls[2][1]).toMatchObject({
      toolCallId: 'call-1', status: 'completed', input: { filePath: 'src/one.js' },
      result: { output: 'provider result', isError: false },
    });
    expect(owner.captureTerminalSnapshot.mock.calls[3][1]).toMatchObject({
      toolCallId: 'call-1', status: 'error', input: { filePath: 'src/conflict.js' },
    });
    expect(emitted.map(item => item.type).filter(type => [
      'chat:tool_call', 'chat:content', 'chat:turn_end',
    ].includes(type))).toEqual([
      'chat:tool_call', 'chat:content', 'chat:tool_call', 'chat:turn_end',
    ]);
    expect(emitted.filter(item => item.type === 'chat:turn_end')).toHaveLength(1);
  });

  test('synthetic call, arguments, pre-execution bounce, and terminal result reach the activity owner', async () => {
    const owner = {
      announce: jest.fn(async () => ({ replay: false })),
      acceptArguments: jest.fn(async () => ({ replay: false })),
      blockBeforeExecution: jest.fn(async () => ({ replay: false })),
      complete: jest.fn(async () => ({ replay: false })),
      interruptOpen: jest.fn(async () => []),
      jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
    };
    const settingsBounce = (_tool, args) => args.filePath?.startsWith('Settings/')
      ? { message: 'blocked' }
      : null;
    const { session, bridge } = makeHarness(owner, settingsBounce, null, {
      enableSyntheticIncrementalProvenance: true,
    });
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    await bridge.applyHarnessEvent({
      type: 'tool_call', toolCallId: 'blocked-call', toolName: 'write', nativeToolName: 'write',
      harnessId: 'opencode', provider: 'opencode', observedAt: 10,
    });
    await bridge.applyHarnessEvent({
      type: 'tool_call_args', toolCallId: 'blocked-call', toolName: 'write',
      argsChunk: '{"filePath":"Settings/config.json"}', observedAt: 11,
    });
    expect(owner.announce).toHaveBeenCalledTimes(1);
    expect(owner.acceptArguments).toHaveBeenCalledTimes(1);
    expect(owner.blockBeforeExecution).toHaveBeenCalledTimes(1);
    expect(session.wire.kill).toHaveBeenCalledWith('SIGTERM');

    await bridge.applyHarnessEvent({
      type: 'tool_call', toolCallId: 'complete-call', toolName: 'read', nativeToolName: 'read',
      harnessId: 'opencode', provider: 'opencode', observedAt: 20,
    });
    await bridge.applyHarnessEvent({
      type: 'tool_call_args', toolCallId: 'complete-call', toolName: 'read',
      argsChunk: '{"filePath":"README.md"}', observedAt: 21,
    });
    await bridge.applyHarnessEvent({
      type: 'tool_result', toolCallId: 'complete-call', toolName: 'read', output: 'ok',
      display: [], returnedDiff: false, isError: false, files: [], observedAt: 22,
    });
    expect(owner.complete).toHaveBeenCalledWith(
      makeAuthority(),
      expect.objectContaining({ toolCallId: 'complete-call', observedAt: 22, isError: false }),
      expect.objectContaining({ output: 'ok', isError: false }),
    );
  });

  test('generic non-OpenCode events keep production provenance inert', async () => {
    const owner = {
      announce: jest.fn(), acceptArguments: jest.fn(), blockBeforeExecution: jest.fn(), complete: jest.fn(),
      captureTerminalSnapshot: jest.fn(),
      interruptOpen: jest.fn(async () => []),
    };
    const codexAuthority = makeAuthority({ harnessId: 'codex', provider: 'codex' });
    const { emitted, bridge } = makeHarness(owner, () => null, null, { authority: codexAuthority });
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    await bridge.applyHarnessEvent({ type: 'tool_call', toolCallId: 'generic', toolName: 'write' });
    await bridge.applyHarnessEvent({
      type: 'tool_call_args', toolCallId: 'generic', toolName: 'write', argsChunk: '{"filePath":"a"}',
    });
    await bridge.applyHarnessEvent({
      type: 'tool_result', toolCallId: 'generic', toolName: 'write', output: 'ok', isError: false,
    });
    await bridge.applyHarnessEvent(makeSnapshot({
      harnessId: 'codex', provider: 'codex', toolCallId: 'codex-snapshot',
      input: { filePath: 'src/codex.txt' },
    }));
    expect(owner.announce).not.toHaveBeenCalled();
    expect(owner.acceptArguments).not.toHaveBeenCalled();
    expect(owner.blockBeforeExecution).not.toHaveBeenCalled();
    expect(owner.complete).not.toHaveBeenCalled();
    expect(owner.captureTerminalSnapshot).not.toHaveBeenCalled();
    expect(emitted.filter(item => item.type === 'chat:tool_result')).toHaveLength(2);
  });

  test('malformed terminal OpenCode identity stays result-phase and never sends pre-execution SIGTERM', async () => {
    const owner = {
      announce: jest.fn(), acceptArguments: jest.fn(), blockBeforeExecution: jest.fn(), complete: jest.fn(),
      captureTerminalSnapshot: jest.fn(), interruptOpen: jest.fn(async () => []),
    };
    const settingsBounce = jest.fn((_tool, _args, root) => (
      root === '/workspace/A' ? { message: 'result-phase restriction' } : null
    ));
    const { emitted, session, bridge } = makeHarness(owner, settingsBounce);
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    const translator = new OpenCodeJsonEventTranslator({ now: () => 100 });
    const events = translator.translate({
      type: 'tool_use',
      part: {
        type: 'tool', id: 'ignored-part-id', tool: 'write',
        state: {
          status: 'completed', input: { filePath: 'Settings/config.json' },
          output: 'provider says write completed',
        },
      },
    });
    for (const event of events) await bridge.applyHarnessEvent(event);

    expect(events.map(event => event.origin)).toEqual([
      'terminal_chat_fail_open', 'terminal_chat_fail_open', 'terminal_chat_fail_open',
    ]);
    expect(session.wire.kill).not.toHaveBeenCalled();
    expect(settingsBounce).toHaveBeenCalledTimes(1);
    expect(settingsBounce).toHaveBeenCalledWith('write', { filePath: 'Settings/config.json' }, '/workspace/A');
    expect(owner.captureTerminalSnapshot).not.toHaveBeenCalled();
    expect(owner.announce).not.toHaveBeenCalled();
    expect(emitted.filter(item => item.type === 'chat:tool_result')).toHaveLength(1);
    expect(emitted.find(item => item.type === 'chat:tool_result').payload).toMatchObject({
      enforcementPhase: 'tool_result',
      toolOutput: 'result-phase restriction',
    });
  });

  test('malformed terminal fail-open never substitutes a mutable root when authority is unavailable', async () => {
    const settingsBounce = jest.fn(() => ({ message: 'must not apply' }));
    const { emitted, session, bridge } = makeHarness(null, settingsBounce, null, { authority: null });
    await bridge.applyHarnessEvent({ type: 'turn_begin', userInput: 'do it' });
    const translator = new OpenCodeJsonEventTranslator({ now: () => 100 });
    const events = translator.translate({
      type: 'tool_use',
      part: {
        type: 'tool', tool: 'write',
        state: { status: 'completed', input: { filePath: 'Settings/config.json' }, output: 'provider truth' },
      },
    });
    for (const event of events) await bridge.applyHarnessEvent(event);
    expect(settingsBounce).not.toHaveBeenCalled();
    expect(session.wire.kill).not.toHaveBeenCalled();
    expect(emitted.find(item => item.type === 'chat:tool_result').payload.toolOutput).toBe('provider truth');
  });

  test('a delayed old-turn finalizer emits only its captured turn and cannot clear a new turn', async () => {
    let resumeInterruption;
    const owner = {
      interruptOpen: jest.fn(() => new Promise(resolve => { resumeInterruption = resolve; })),
    };
    const { emitted, session, applier } = makeHarness(owner);
    await applier.applyChatEvent({ type: 'turn_begin', payload: { userInput: 'A' } });
    const endingA = applier.applyChatEvent({ type: 'turn_end', payload: { reason: 'interrupted' } });
    session.pendingAgentTurnAuthority = makeAuthority({ turnId: 'turn-B' });
    session.pendingTurnId = 'turn-B';
    session.pendingUserInput = 'B';
    await applier.applyChatEvent({ type: 'turn_begin', payload: { userInput: 'B' } });
    resumeInterruption([]);
    await endingA;

    expect(emitted.filter(item => item.type === 'chat:turn_end').map(item => item.payload.turnId)).toEqual(['turn-A']);
    expect(session.currentTurn.id).toBe('turn-B');
  });

  test.each(['chat:tool_call', 'chat:tool_call_args', 'chat:tool_result'])(
    'failure after %s retains terminal reservation and finalizes once with an incomplete part',
    async (failurePoint) => {
      const owner = {
        jsonSafePersistedResult: value => JSON.parse(JSON.stringify(value)),
        captureTerminalSnapshot: jest.fn(async () => ({ replay: false })),
        interruptOpen: jest.fn(async () => []),
      };
      let failed = false;
      const { emitted, bridge } = makeHarness(owner, () => null, type => {
        if (!failed && type === failurePoint) {
          failed = true;
          throw new Error('injected expansion failure');
        }
      });
      async function* events() {
        yield { type: 'turn_begin', userInput: 'do it' };
        yield makeSnapshot({ input: { filePath: 'src/a.js' } });
        yield { type: 'content', text: 'must not pass failed ingress item' };
      }
      await expect(bridge.drainHarnessEvents(events())).rejects.toThrow('injected expansion failure');
      expect(owner.captureTerminalSnapshot).toHaveBeenCalledTimes(1);
      expect(emitted.filter(item => item.type === 'chat:turn_end')).toHaveLength(1);
      const part = emitted.find(item => item.type === 'chat:turn_end').payload.parts[0];
      if (failurePoint === 'chat:tool_result') {
        expect(part.terminalSnapshotExpansionComplete).toBe(true);
      } else {
        expect(part.terminalSnapshotExpansionComplete).toBeUndefined();
      }
    },
  );
});
