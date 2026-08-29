/**
 * Public prompt route → canonical drain ownership integration tests
 * (RCC-0108 SPEC-01 Slice C, SPEC §5 items a–d).
 *
 * Real chain under test:
 *   client-message-router prompt branch
 *     -> thread-runtime-controller.acceptPromptThroughRuntime
 *       -> canonical-harness-event-bridge (bind-once)
 *         -> canonical-chat-event-applier (drain-driven)
 *           -> ThreadRuntimeManager (sole mutable owner)
 *             -> real event bus chat:* publications
 *
 * Mocked infrastructure edges ONLY:
 *   - ThreadWebSocketHandler getState/handleMessageSend (persistence edge)
 *   - spawnAndSetupWire (child-process edge; returns fake canonical wires)
 * The process-manager registry and event bus are REAL.
 */

jest.mock('../../lib/thread/ThreadWebSocketHandler', () => ({
  getState: jest.fn(),
  handleMessageSend: jest.fn(),
  getCurrentThreadManager: jest.fn(() => null),
  getCurrentThreadId: jest.fn(() => null),
}));

jest.mock('../../lib/ws/thread-ws-handlers', () => ({
  createThreadWsHandlers: jest.fn(() => ({})),
  spawnAndSetupWire: jest.fn(),
}));

// The 'uuid' package is ESM-only under Jest (see thread-runtime-controller's
// crypto.randomUUID precedent). Shim it with unique ids so generated drain
// and server turn ids never collide across threads/tests.
let mockIdCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `gen-${Math.random().toString(36).slice(2, 10)}-${++mockIdCounter}`,
}));

const { emit, on } = require('../../lib/event-bus');
const ThreadWebSocketHandler = require('../../lib/thread/ThreadWebSocketHandler');
const { spawnAndSetupWire } = require('../../lib/ws/thread-ws-handlers');
const { unregisterWire } = require('../../lib/wire/process-manager');
const { checkSettingsBounce } = require('../../lib/enforcement');
const { createWireMessageRouter } = require('../../lib/wire/message-router');
const { createClientMessageRouter } = require('../../lib/ws/client-message-router');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');

function flushAsyncWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function makeDeferred() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

/**
 * Fake canonical harness wire with stage-gated async iteration for
 * deterministic interleaving across threads on one WebSocket.
 */
function makeGatedHarnessWire(label) {
  const stages = new Map();
  function stage(name) {
    if (!stages.has(name)) {
      const deferred = makeDeferred();
      const reached = makeDeferred();
      stages.set(name, {
        wait: deferred.promise,
        release: deferred.release,
        reached: reached.promise,
        markReached: reached.release,
      });
    }
    return stages.get(name);
  }

  const sentInputs = [];
  const wire = {
    _usesDirectCanonicalEvents: true,
    pid: 424242,
    async *_sendMessage(input) {
      sentInputs.push(input);
      const begin = stage('begin');
      begin.markReached();
      await begin.wait;
      yield { type: 'turn_begin', userInput: input };

      const content = stage('content');
      content.markReached();
      await content.wait;
      yield { type: 'content', text: `${label} reply` };

      const end = stage('end');
      end.markReached();
      await end.wait;
      yield { type: 'turn_end', reason: 'complete' };
    },
  };
  return { wire, stage, sentInputs };
}

describe('public prompt route with canonical drain ownership', () => {
  const THREAD_A = `thread-a-${Math.random().toString(36).slice(2, 10)}`;
  const THREAD_B = `thread-b-${Math.random().toString(36).slice(2, 10)}`;
  const WORKSPACE_ID = 'ws-integration';
  const PROJECT_ROOT = '/tmp/integration-project';

  let ws;
  let session;
  let router;
  let busEvents;
  let unsubscribeFns;
  let fakeWires;

  beforeEach(() => {
    jest.clearAllMocks();
    threadRuntimeManager.runtimes.clear();

    ws = { readyState: 1, send: jest.fn() };
    session = {
      connectionId: 'conn-integration',
      currentWorkspaceId: WORKSPACE_ID,
      projectRoot: PROJECT_ROOT,
      currentThreadId: null,
      currentScope: null,
      currentViewId: null,
      wire: null,
      buffer: '',
    };

    const manager = {
      workspaceId: WORKSPACE_ID,
      getThread: jest.fn(async id => ({ threadId: id, entry: { name: 'Thread' } })),
      touchSession: jest.fn(),
      addMessage: jest.fn(async () => ({})),
      openSession: jest.fn(async () => ({})),
      closeSession: jest.fn(async () => ({})),
      recordSavedExchange: jest.fn(async () => ({})),
      syncChatlogMirrorFromHistory: jest.fn(async () => ({})),
      index: { touch: jest.fn(async () => ({})) },
      listThreads: jest.fn(async () => []),
    };
    // One stable per-ws state object: the controller mutates state.threadId.
    const wsState = {
      panelId: 'panel-1',
      viewName: 'view-1',
      threadId: null,
      threadManager: manager,
    };
    ThreadWebSocketHandler.getState.mockReturnValue(wsState);
    ThreadWebSocketHandler.handleMessageSend.mockResolvedValue(true);

    fakeWires = new Map([
      [THREAD_A, makeGatedHarnessWire('A')],
      [THREAD_B, makeGatedHarnessWire('B')],
    ]);
    spawnAndSetupWire.mockImplementation(async ({ threadId }) => {
      const env = fakeWires.get(threadId);
      if (!env) throw new Error(`no fake wire for ${threadId}`);
      return env.wire;
    });

    // REAL canonical chain composed exactly like server.js does per connection.
    const wireRouter = createWireMessageRouter({
      session,
      ws,
      emit,
      checkSettingsBounce,
    });

    router = createClientMessageRouter({
      ws,
      session,
      connectionId: 'conn-integration',
      projectRoot: PROJECT_ROOT,
      fileExplorer: {},
      wireLifecycle: {
        awaitHarnessReady: jest.fn(),
        initializeWire: jest.fn(),
        setupWireHandlers: jest.fn(),
      },
      sessions: new Map([[ws, session]]),
      setSessionRoot: jest.fn(),
      clearSessionRoot: jest.fn(),
      getProjectRoot: () => PROJECT_ROOT,
      getFusionHandlers: () => ({}),
      getClipboardHandlers: () => ({}),
      getBookmarksHandlers: () => ({}),
      getThemeHandlers: () => ({}),
      getSecretsHandlers: () => ({}),
      getScreenshotHandlers: () => ({}),
      handleCanonicalHarnessEvent: wireRouter.handleCanonicalHarnessEvent,
    });

    busEvents = [];
    unsubscribeFns = [
      on('*', (event) => {
        if (typeof event?.type === 'string' && event.type.startsWith('chat:')) {
          busEvents.push(event);
        }
      }),
    ];
  });

  afterEach(() => {
    for (const unsubscribe of unsubscribeFns || []) unsubscribe();
    unsubscribeFns = [];
    for (const threadId of fakeWires?.keys() || []) unregisterWire(threadId);
  });

  function runtimeKey(threadId) {
    return { workspaceId: WORKSPACE_ID, scope: 'project', threadId };
  }

  async function sendPrompt(payload) {
    await router.handleClientMessage(JSON.stringify({ type: 'prompt', ...payload }));
    await flushAsyncWork();
  }

  async function sendStop(payload) {
    await router.handleClientMessage(JSON.stringify({ type: 'turn:stop', ...payload }));
    await flushAsyncWork();
  }

  function eventsFor(threadId, type) {
    return busEvents.filter(e => e.type === type && e.threadId === threadId);
  }

  test('(a) prompt flows through the public route to turn_begin/content/turn_end bus events with explicit identity', async () => {
    await sendPrompt({ user_input: 'hello integration', threadId: THREAD_A });

    // Walk the gated iterator end-to-end.
    const env = fakeWires.get(THREAD_A);
    await env.stage('begin').reached;
    env.stage('begin').release();
    await flushAsyncWork();
    await env.stage('content').reached;
    env.stage('content').release();
    await flushAsyncWork();
    await env.stage('end').reached;
    env.stage('end').release();
    await flushAsyncWork();
    await flushAsyncWork();

    expect(busEvents.map(e => e.type))
      .toEqual(expect.arrayContaining(['chat:turn_begin', 'chat:content', 'chat:turn_end']));

    const begin = eventsFor(THREAD_A, 'chat:turn_begin')[0];
    expect(begin).toMatchObject({
      workspace: 'workspace:ws-integration',
      workspaceId: WORKSPACE_ID,
      projectRoot: PROJECT_ROOT,
      scope: 'project',
      threadId: THREAD_A,
      userInput: 'hello integration',
    });
    expect(typeof begin.turnId).toBe('string');
    expect(begin.turnId.length).toBeGreaterThan(0);

    expect(eventsFor(THREAD_A, 'chat:content')).toEqual([
      expect.objectContaining({
        type: 'chat:content',
        threadId: THREAD_A,
        turnId: begin.turnId,
        text: 'A reply',
      }),
    ]);

    const end = eventsFor(THREAD_A, 'chat:turn_end')[0];
    expect(end).toMatchObject({
      threadId: THREAD_A,
      turnId: begin.turnId,
      fullText: 'A reply',
      userInput: 'hello integration',
      reason: 'complete',
      partial: false,
    });
    expect(Array.isArray(end.parts)).toBe(true);
    // parts accumulate streamed text verbatim ('A reply' from the fake
    // harness), matching the text/fullText assertions above.
    expect(end.parts).toEqual([{ type: 'text', content: 'A reply' }]);

    // Terminalization cleared its own drain; the completed snapshot remains
    // available as the thread:opened overlay source.
    expect(threadRuntimeManager.getActiveDrain(runtimeKey(THREAD_A))).toBeNull();
    expect(threadRuntimeManager.getLiveTurn(runtimeKey(THREAD_A))).toMatchObject({
      status: 'complete',
      turnId: begin.turnId,
      fullText: 'A reply',
    });
  });

  test('(b) two interleaved threads on ONE WebSocket keep isolated routes, inputs, attachments, and drains', async () => {
    await sendPrompt({ user_input: 'input A', threadId: THREAD_A });
    await fakeWires.get(THREAD_A).stage('begin').reached;

    await sendPrompt({
      user_input: 'input B',
      threadId: THREAD_B,
      attachments: [{ label: 'b.png', path: '/tmp/b.png' }],
    });
    await fakeWires.get(THREAD_B).stage('begin').reached;

    // Both parked pre-begin: two live drains coexist on one connection, each
    // with its own frozen route and bound control.
    const keyA = runtimeKey(THREAD_A);
    const keyB = runtimeKey(THREAD_B);
    const drainA = threadRuntimeManager.getActiveDrain(keyA);
    const drainB = threadRuntimeManager.getActiveDrain(keyB);
    expect(drainA.routeContext).toMatchObject({ threadId: THREAD_A, acceptedUserInput: 'input A' });
    expect(drainB.routeContext).toMatchObject({ threadId: THREAD_B, acceptedUserInput: 'input B' });
    expect(drainB.routeContext.attachments).toEqual([
      { kind: 'file', label: 'b.png', path: '/tmp/b.png', sourceName: 'b.png' },
    ]);
    // Each control closes over its own thread's lease touch.
    drainA.control.touchThreadSession();
    drainB.control.touchThreadSession();
    expect(drainA.control.runtimeKey.threadId).toBe(THREAD_A);
    expect(drainB.control.runtimeKey.threadId).toBe(THREAD_B);

    // Interleave: B begins BEFORE A.
    fakeWires.get(THREAD_B).stage('begin').release();
    await flushAsyncWork();
    fakeWires.get(THREAD_A).stage('begin').release();
    await flushAsyncWork();

    const beginA = eventsFor(THREAD_A, 'chat:turn_begin')[0];
    const beginB = eventsFor(THREAD_B, 'chat:turn_begin')[0];
    expect(beginA.userInput).toBe('input A');
    expect(beginB.userInput).toBe('input B');
    expect(beginA.attachments).toEqual([]);
    expect(beginB.attachments).toEqual([
      { kind: 'file', label: 'b.png', path: '/tmp/b.png', sourceName: 'b.png' },
    ]);
    expect(beginA.turnId).not.toBe(beginB.turnId);

    // Harness inputs carry their own serialized attachment context only.
    expect(fakeWires.get(THREAD_A).sentInputs[0]).toBe('input A');
    expect(fakeWires.get(THREAD_B).sentInputs[0]).toContain('/tmp/b.png');

    // Cross-content: each lands only on its own bound turn.
    fakeWires.get(THREAD_B).stage('content').release();
    await flushAsyncWork();
    fakeWires.get(THREAD_A).stage('content').release();
    await flushAsyncWork();

    expect(eventsFor(THREAD_B, 'chat:content')).toEqual([
      expect.objectContaining({ turnId: beginB.turnId, text: 'B reply' }),
    ]);
    expect(eventsFor(THREAD_A, 'chat:content')).toEqual([
      expect.objectContaining({ turnId: beginA.turnId, text: 'A reply' }),
    ]);

    // Snapshot isolation mid-flight.
    expect(threadRuntimeManager.getLiveTurn(keyA)).toMatchObject({
      threadId: THREAD_A,
      userInput: 'input A',
      fullText: 'A reply',
      attachments: [],
    });
    expect(threadRuntimeManager.getLiveTurn(keyB)).toMatchObject({
      threadId: THREAD_B,
      userInput: 'input B',
      fullText: 'B reply',
      attachments: [{ kind: 'file', label: 'b.png', path: '/tmp/b.png', sourceName: 'b.png' }],
    });

    // A terminalizes first; B stays in flight and untouched.
    fakeWires.get(THREAD_A).stage('end').release();
    await flushAsyncWork();
    expect(eventsFor(THREAD_A, 'chat:turn_end')).toHaveLength(1);
    expect(eventsFor(THREAD_B, 'chat:turn_end')).toHaveLength(0);
    expect(threadRuntimeManager.getActiveDrain(keyA)).toBeNull();
    expect(threadRuntimeManager.getActiveDrain(keyB)?.drainId).toBe(drainB.drainId);
    expect(threadRuntimeManager.getLiveTurn(keyB).status).toBe('in_flight');

    fakeWires.get(THREAD_B).stage('end').release();
    await flushAsyncWork();
    expect(eventsFor(THREAD_B, 'chat:turn_end')).toHaveLength(1);
    expect(threadRuntimeManager.getActiveDrain(keyB)).toBeNull();
  });

  test('(c) the live snapshot is serializable plain data — no functions, harness, or control objects', async () => {
    await sendPrompt({ user_input: 'snapshot probe', threadId: THREAD_A });
    const env = fakeWires.get(THREAD_A);
    await env.stage('begin').reached;
    env.stage('begin').release();
    await flushAsyncWork();
    await env.stage('content').reached;
    env.stage('content').release();
    await flushAsyncWork();

    const key = runtimeKey(THREAD_A);
    const record = threadRuntimeManager.getActiveDrain(key);
    expect(record).toBeTruthy(); // mid-flight

    const snapshot = threadRuntimeManager.getLiveTurn(key);
    const roundTrip = JSON.parse(JSON.stringify(snapshot));
    expect(roundTrip).toEqual(snapshot);

    (function assertPlainData(value) {
      expect(typeof value).not.toBe('function');
      if (value && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) {
          expect(childKey).not.toMatch(/control|stopHarness|touchThreadSession|wire|harness/i);
          assertPlainData(child);
        }
      }
    })(snapshot);

    // The record keeps the non-serializable capability beside the projection —
    // never inside it.
    expect(record.control.stopHarness).toBeInstanceOf(Function);
    expect(JSON.stringify(snapshot)).not.toContain('stopHarness');

    env.stage('end').release();
    await flushAsyncWork();
  });

  test('(d) bind-once is observable through the public route: duplicate begin cannot rebind or reset', async () => {
    let releaseIteratorEnd;
    const iteratorDone = new Promise(resolve => { releaseIteratorEnd = resolve; });
    fakeWires.set(THREAD_B, {
      sentInputs: [],
      stage: () => ({ reached: Promise.resolve(), release: () => {} }),
      wire: {
        _usesDirectCanonicalEvents: true,
        pid: 424243,
        async *_sendMessage(input) {
          yield { type: 'turn_begin', userInput: input };
          yield { type: 'content', text: 'kept ' };
          yield { type: 'turn_begin', userInput: 'hijack attempt' }; // duplicate
          yield { type: 'content', text: 'intact' };
          yield { type: 'turn_end', reason: 'complete' };
          releaseIteratorEnd();
        },
      },
    });

    await sendPrompt({ user_input: 'dup probe', threadId: THREAD_B });
    await iteratorDone;
    await flushAsyncWork();
    await flushAsyncWork();

    const begins = eventsFor(THREAD_B, 'chat:turn_begin');
    expect(begins).toHaveLength(1); // a rejected duplicate never re-emits a begin

    const boundTurnId = begins[0].turnId;
    const ends = eventsFor(THREAD_B, 'chat:turn_end');
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({
      threadId: THREAD_B,
      turnId: boundTurnId, // same bound server turnId end-to-end
      fullText: 'kept intact', // accumulator was never reset by the duplicate
      userInput: 'dup probe',
    });
  });

  test('(e) stop on A cannot stop B and preserves A\'s accepted structured attachments', async () => {
    // A carries an attachment and is parked mid-turn at its end gate.
    await sendPrompt({
      user_input: 'stop probe A',
      threadId: THREAD_A,
      attachments: [{ label: 'a.png', path: '/tmp/a.png' }],
    });
    const envA = fakeWires.get(THREAD_A);
    await envA.stage('begin').reached;
    envA.stage('begin').release();
    await flushAsyncWork();
    await envA.stage('content').reached;
    envA.stage('content').release();
    await flushAsyncWork();
    await envA.stage('end').reached; // reached but NOT released — A still in flight

    // B runs its own live drain on the same WebSocket.
    await sendPrompt({ user_input: 'stop probe B', threadId: THREAD_B });
    const envB = fakeWires.get(THREAD_B);
    await envB.stage('begin').reached;
    envB.stage('begin').release();
    await flushAsyncWork();
    await envB.stage('content').reached; // parked pre-content-release
    const keyA = runtimeKey(THREAD_A);
    const keyB = runtimeKey(THREAD_B);
    const drainB = threadRuntimeManager.getActiveDrain(keyB);
    expect(drainB).toBeTruthy();

    // Observe each bound control's physical stop through its own wire. The
    // controls close over these exact wire objects, so a control-invoked stop
    // can only land here.
    const stopSpyA = jest.fn(() => Promise.resolve());
    const stopSpyB = jest.fn(() => Promise.resolve());
    envA.wire._stopSession = stopSpyA;
    envB.wire._stopSession = stopSpyB;

    busEvents = [];
    await sendStop({ threadId: THREAD_A });

    // A's synthesized interrupted terminal carries A's accepted attachments
    // and partial parts from the runtime-owned snapshot.
    const endA = eventsFor(THREAD_A, 'chat:turn_end');
    expect(endA).toHaveLength(1);
    expect(endA[0]).toMatchObject({
      threadId: THREAD_A,
      reason: 'interrupted',
      partial: true,
      userInput: 'stop probe A',
      fullText: 'A reply',
      parts: [{ type: 'text', content: 'A reply' }],
      attachments: [
        { kind: 'file', label: 'a.png', path: '/tmp/a.png', sourceName: 'a.png' },
      ],
    });

    // Only A's bound harness stopped through its matching control.
    expect(stopSpyA).toHaveBeenCalledTimes(1);
    expect(stopSpyB).not.toHaveBeenCalled();

    // B keeps its own drain, bound turn, and in-flight snapshot untouched.
    expect(eventsFor(THREAD_B, 'chat:turn_end')).toHaveLength(0);
    expect(threadRuntimeManager.getActiveDrain(keyB)?.drainId).toBe(drainB.drainId);
    expect(threadRuntimeManager.getLiveTurn(keyB)).toMatchObject({
      threadId: THREAD_B,
      status: 'in_flight',
      userInput: 'stop probe B',
      fullText: '',
    });

    // A's drain cleared by its own terminal; the completed snapshot persists.
    expect(threadRuntimeManager.getActiveDrain(keyA)).toBeNull();
    expect(threadRuntimeManager.getLiveTurn(keyA)).toMatchObject({
      status: 'interrupted',
      attachments: [
        { kind: 'file', label: 'a.png', path: '/tmp/a.png', sourceName: 'a.png' },
      ],
    });

    // Drain the parked gates so both iterators finish cleanly.
    envA.stage('end').release();
    envB.stage('content').release();
    await flushAsyncWork();
    await envB.stage('end').reached;
    envB.stage('end').release();
    await flushAsyncWork();
  });
});
