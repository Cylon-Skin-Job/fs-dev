/**
 * Canonical Chat Event Applier Tests
 *
 * SPEC-01 Slice C: coverage intent is drain-driven. Every scenario is
 * re-expressed through claimed drain contexts ({route, control}) plus runtime
 * assertions — ThreadRuntimeManager owns every mutable canonical turn state;
 * connection/session state carries none of it.
 */

const { createCanonicalChatEventApplier } = require('../../lib/wire/canonical-chat-event-applier');
const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
} = require('../../lib/thread/canonical-drain-context');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const { HarnessRuntimeError } = require('../../lib/harness/errors');
const {
  TURN_TERMINAL_ERROR_CATALOG,
  normalizeTurnTerminalError,
} = require('../../lib/thread/turn-terminal-error');

describe('CanonicalChatEventApplier (drain-driven)', () => {
  let emittedEvents;
  let touchCounts;
  let stoppedThreads;
  let turnIdCounter;
  let applier;
  let mockWs;

  function emit(type, payload) {
    emittedEvents.push({ type, payload });
  }

  function checkSettingsBounce(toolName, args) {
    if (toolName === 'forbidden_tool') {
      return { message: 'forbidden_tool is not allowed' };
    }
    const filePath = args.file_path || args.filePath || args.path;
    if (toolName === 'write' && filePath?.startsWith('settings/')) {
      return { message: 'Write to settings/ is not allowed' };
    }
    return null;
  }

  function generateTurnId() {
    turnIdCounter += 1;
    return `turn-${turnIdCounter}`;
  }

  /**
   * Claim one active drain with a frozen route context and live control,
   * exactly like the interactive/automation acceptance paths do.
   */
  function makeEnv({ threadId = 'thread-1', userInput = 'Hello AI', attachments = [], drainId = null } = {}) {
    const runtimeKey = { workspaceId: 'code', scope: 'project', threadId };
    let routeContext;
    if (userInput === '') {
      // The route factory rejects empty accepted input; spurious-begin
      // scenarios need a well-formed-but-empty route, built by hand.
      routeContext = Object.freeze({
        workspaceId: 'code',
        workspace: 'workspace:code',
        projectRoot: '/tmp/project',
        scope: 'project',
        threadId,
        acceptedUserInput: '',
        attachments: Object.freeze([]),
      });
    } else {
      routeContext = createCanonicalRouteContext({
        workspaceId: 'code',
        workspace: 'workspace:code',
        projectRoot: '/tmp/project',
        scope: 'project',
        threadId,
        acceptedUserInput: userInput,
        attachments,
      });
    }
    const id = drainId || `drain-${threadId}-${Math.random().toString(36).slice(2, 8)}`;
    const control = createCanonicalDrainControl({
      drainId: id,
      runtimeKey,
      touchThreadSession: () => {
        touchCounts[threadId] = (touchCounts[threadId] || 0) + 1;
      },
      stopHarness: async () => {
        stoppedThreads.push(threadId);
      },
    });
    const record = threadRuntimeManager.claimActiveDrain(runtimeKey, control, routeContext);
    return {
      runtimeKey,
      routeContext,
      control,
      drainId: id,
      drainContext: { route: record.routeContext, control: record.control },
    };
  }

  /** Bridge-shaped turn_begin: applies, then binds once on acceptance. */
  function beginBoundTurn(env, { userInput } = {}) {
    const result = applier.applyChatEvent({
      type: 'turn_begin',
      payload: { userInput },
    }, mockWs, env.drainContext);
    if (result?.accepted && result.turnId) {
      expect(threadRuntimeManager.bindTurnToDrain(env.runtimeKey, env.drainId, result.turnId)).toBe(true);
    }
    return result;
  }

  function getLiveTurn(runtimeKey) {
    return threadRuntimeManager.getLiveTurn(runtimeKey);
  }

  beforeEach(() => {
    threadRuntimeManager.runtimes.clear();
    emittedEvents = [];
    touchCounts = {};
    stoppedThreads = [];
    turnIdCounter = 0;
    mockWs = { readyState: 1 };
    applier = createCanonicalChatEventApplier({
      emit,
      checkSettingsBounce,
      generateTurnId,
    });
  });

  function eventsOfType(type) {
    return emittedEvents.filter(e => e.type === type);
  }

  // ─── transport guard ─────────────────────────────────────────────────

  describe('drain context requirement', () => {
    test('diagnostic drops any canonical event without a drain context', () => {
      applier.applyChatEvent({ type: 'content', payload: { text: 'x' } }, mockWs, undefined);
      applier.applyChatEvent({ type: 'content', payload: { text: 'x' } }, mockWs, {});
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, { route: null, control: {} });

      expect(emittedEvents).toHaveLength(0);
      expect(Object.keys(touchCounts)).toHaveLength(0);
    });

    test('ignores unknown canonical event types', () => {
      const env = makeEnv();
      applier.applyChatEvent({ type: 'unknown_event', payload: {} }, mockWs, env.drainContext);
      expect(emittedEvents).toHaveLength(0);
    });
  });

  // ─── turn_begin ──────────────────────────────────────────────────────

  describe('turn_begin', () => {
    test('accepted begin creates snapshot + accumulator, emits, and returns the server turnId', () => {
      const env = makeEnv();

      const result = applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, env.drainContext);

      expect(result).toEqual({ accepted: true, turnId: 'turn-1' });
      expect(touchCounts['thread-1']).toBe(1);

      const event = eventsOfType('chat:turn_begin')[0];
      expect(event).toBeDefined();
      expect(event.payload).toMatchObject({
        workspace: 'workspace:code',
        workspaceId: 'code',
        projectRoot: '/tmp/project',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        userInput: 'Hello AI',
        attachments: [],
      });

      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn).toMatchObject({
        workspaceId: 'code',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        userInput: 'Hello AI',
        status: 'in_flight',
        fullText: '',
        parts: [],
        streamSeq: 1,
        attachments: [],
      });

      const record = threadRuntimeManager.getActiveDrain(env.runtimeKey);
      expect(record.turn.toolArgsBuffers).toBeInstanceOf(Map);
      expect(record.turn.bouncedToolCalls).toBeInstanceOf(Set);
      expect(record.turn.hasToolCalls).toBe(false);
      expect(record.turn.usage).toEqual({ contextUsage: null, tokenUsage: null, messageId: null, planMode: false });
      expect(record.turn.terminalized).toBe(false);
      expect(record.turnId).toBeNull(); // unbound until the bridge binds
    });

    test('accepted input comes from the frozen route first, payload second', () => {
      const env = makeEnv({ userInput: 'Route wins' });
      applier.applyChatEvent({
        type: 'turn_begin',
        payload: { userInput: 'Payload loses' },
      }, mockWs, env.drainContext);

      expect(eventsOfType('chat:turn_begin')[0].payload.userInput).toBe('Route wins');
      expect(getLiveTurn(env.runtimeKey).userInput).toBe('Route wins');
    });

    test('payload userInput is used when the route carries an empty string', () => {
      const env = makeEnv({ userInput: '' });
      applier.applyChatEvent({
        type: 'turn_begin',
        payload: { userInput: 'Direct input' },
      }, mockWs, env.drainContext);

      expect(eventsOfType('chat:turn_begin')[0].payload.userInput).toBe('Direct input');
    });

    test('ignores spurious turn_begin without route or payload input', () => {
      const env = makeEnv({ userInput: '' });
      const result = applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, env.drainContext);

      expect(result).toEqual({ accepted: false });
      expect(eventsOfType('chat:turn_begin')).toHaveLength(0);
      expect(getLiveTurn(env.runtimeKey)).toBeNull();
    });

    test('route attachments land on the snapshot as plain copied data', () => {
      const env = makeEnv({
        attachments: [{ kind: 'file', label: 'a.txt', path: '/tmp/a.txt', sourceName: 'a.txt' }],
      });
      beginBoundTurn(env);

      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.attachments).toEqual([
        { kind: 'file', label: 'a.txt', path: '/tmp/a.txt', sourceName: 'a.txt' },
      ]);
      expect(Object.isFrozen(liveTurn.attachments)).toBe(false); // clone, not frozen alias
    });

    test('duplicate begin cannot reset the live turn or rebind', () => {
      const env = makeEnv();
      const first = beginBoundTurn(env);
      emittedEvents = [];

      const duplicate = applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, env.drainContext);

      expect(first.accepted).toBe(true);
      expect(duplicate).toEqual({ accepted: false });
      expect(eventsOfType('chat:turn_begin')).toHaveLength(0);
      expect(getLiveTurn(env.runtimeKey).streamSeq).toBe(1); // untouched by the duplicate
      expect(getLiveTurn(env.runtimeKey).turnId).toBe(first.turnId);

      // The already-bound turnId cannot be rebound either.
      expect(threadRuntimeManager.bindTurnToDrain(env.runtimeKey, env.drainId, 'other-turn')).toBe(false);
      expect(threadRuntimeManager.resolveBoundTurnId(env.runtimeKey, env.drainId)).toBe(first.turnId);
    });

    test('begin is rejected when the drain is superseded', () => {
      const envA = makeEnv({ threadId: 'thread-A', drainId: 'drain-A-original' });
      // Replacement drain supersedes A's record on the same runtime key.
      const replacement = makeEnv({ threadId: 'thread-A', drainId: 'drain-replacement' });
      expect(replacement.drainId).not.toBe(envA.drainId);

      const late = applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, envA.drainContext);
      expect(late).toEqual({ accepted: false });
      expect(getLiveTurn(replacement.runtimeKey)).toBeNull();
    });
  });

  // ─── content / thinking ──────────────────────────────────────────────

  describe('content and thinking accumulation', () => {
    test('consecutive content merges into one snapshot part with per-event emissions', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'content', payload: { text: 'Hello ' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'content', payload: { text: 'world' } }, mockWs, env.drainContext);

      const events = eventsOfType('chat:content');
      expect(events).toHaveLength(2);
      expect(events[0].payload).toMatchObject({
        workspace: 'workspace:code',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        text: 'Hello ',
      });
      expect(events[1].payload.text).toBe('world');

      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.fullText).toBe('Hello world');
      expect(liveTurn.parts).toEqual([{ type: 'text', content: 'Hello world' }]);
    });

    test('thinking stays separate from text across interleaved parts', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Thinking 1' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Thinking 2' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Text 1' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Thinking 3' } }, mockWs, env.drainContext);

      expect(eventsOfType('chat:thinking')).toHaveLength(3);
      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.parts).toEqual([
        { type: 'think', content: 'Thinking 1Thinking 2' },
        { type: 'text', content: 'Text 1' },
        { type: 'think', content: 'Thinking 3' },
      ]);
    });

    test('post-begin events before binding are diagnostic drops without emission', () => {
      const env = makeEnv();
      // Begin accepted by the manager, but the bridge never bound (simulates
      // events racing ahead of bind).
      const begun = applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, env.drainContext);
      expect(begun.accepted).toBe(true);
      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey).turnId).toBeNull();
      emittedEvents = [];

      applier.applyChatEvent({ type: 'content', payload: { text: 'early' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'early' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'subagent_event', payload: {} }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'status_update', payload: {} }, mockWs, env.drainContext);

      expect(emittedEvents).toHaveLength(0);
      expect(getLiveTurn(env.runtimeKey).parts).toEqual([]);
    });

    test('stale identity mutations from a replaced drain are dropped without emission', () => {
      const envA = makeEnv({ threadId: 'thread-A' });
      // Replacement drain supersedes A's record on the same runtime key.
      const envB = makeEnv({ threadId: 'thread-A', drainId: 'drain-replacement' });
      beginBoundTurn(envB);
      emittedEvents = [];

      // Late A events (even with a previously valid-looking identity) gate out.
      applier.applyChatEvent({
        type: 'content',
        payload: { text: 'late A' },
      }, mockWs, { route: envA.routeContext, control: envA.control });

      expect(emittedEvents).toHaveLength(0);
      expect(getLiveTurn(envB.runtimeKey).fullText).toBe('');
    });
  });

  // ─── tools ───────────────────────────────────────────────────────────

  describe('tool lifecycle', () => {
    test('tool_call tracks accumulator state, appends a snapshot part, and emits', () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_call',
        payload: { toolCallId: 'tc-1', toolName: 'Bash' },
      }, mockWs, env.drainContext);

      const record = threadRuntimeManager.getActiveDrain(env.runtimeKey);
      expect(record.turn.hasToolCalls).toBe(true);
      expect(record.turn.toolArgsBuffers.get('tc-1')).toBe('');
      expect(record.turn.toolNamesById['tc-1']).toBe('Bash');

      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.parts[0]).toMatchObject({
        type: 'tool_call',
        toolCallId: 'tc-1',
        name: 'Bash',
        arguments: {},
        result: { output: '', display: [], isError: false },
      });

      expect(eventsOfType('chat:tool_call')[0].payload).toMatchObject({
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        toolName: 'Bash',
        toolCallId: 'tc-1',
      });
    });

    test('tool_call_args buffers chunks, emits each chunk, and applies parsed args to the snapshot', () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-1', toolName: 'Bash' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'tool_call_args', payload: { toolCallId: 'tc-1', argsChunk: '{"cmd": "ls"}' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'tool_call_args', payload: { toolCallId: 'tc-1', argsChunk: ' -la' } }, mockWs, env.drainContext);

      const record = threadRuntimeManager.getActiveDrain(env.runtimeKey);
      expect(record.turn.toolArgsBuffers.get('tc-1')).toBe('{"cmd": "ls"} -la');

      const events = eventsOfType('chat:tool_call_args');
      expect(events).toHaveLength(2);
      expect(events[0].payload.argsChunk).toBe('{"cmd": "ls"}');
      expect(events[1].payload.argsChunk).toBe(' -la');

      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.parts[0].arguments).toEqual({ cmd: 'ls' }); // parseable prefix applied once
    });

    test('args chunk falls back to the most recent buffer when toolCallId is omitted', () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-9', toolName: 'Read' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'tool_call_args', payload: { argsChunk: '{"path": "x"}' } }, mockWs, env.drainContext);

      const record = threadRuntimeManager.getActiveDrain(env.runtimeKey);
      expect(record.turn.toolArgsBuffers.get('tc-9')).toBe('{"path": "x"}');
      expect(eventsOfType('chat:tool_call_args')[0].payload.toolCallId).toBe('tc-9');
    });

    test('rejected tool_call_args input: zero publication and byte-identical projection (SPEC §5)', () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      // No open buffer yet: an args chunk with neither toolCallId nor a
      // recent buffer has no target and is rejected.
      applier.applyChatEvent({ type: 'tool_call_args', payload: { argsChunk: '{"x":1}' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-r', toolName: 'Bash' } }, mockWs, env.drainContext);
      emittedEvents = [];
      const before = getLiveTurn(env.runtimeKey);

      // Missing and empty chunks are rejected even with an open buffer.
      applier.applyChatEvent({ type: 'tool_call_args', payload: { toolCallId: 'tc-r' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'tool_call_args', payload: { toolCallId: 'tc-r', argsChunk: '' } }, mockWs, env.drainContext);

      expect(eventsOfType('chat:tool_call_args')).toHaveLength(0);
      expect(getLiveTurn(env.runtimeKey)).toEqual(before); // no bump, no mutation
    });

    test('tool_result parses buffered args, updates the snapshot part, and emits bus payload fields', () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-1', toolName: 'Bash' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'tool_call_args', payload: { toolCallId: 'tc-1', argsChunk: '{"cmd": "echo hello"}' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_result',
        payload: {
          toolCallId: 'tc-1',
          toolName: 'Bash',
          result: {
            output: 'hello',
            statusMessage: 'Done',
            display: [{ type: 'text', text: 'hello' }],
            returnedDiff: false,
            isError: false,
            files: [],
          },
        },
      }, mockWs, env.drainContext);

      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.parts[0].arguments).toEqual({ cmd: 'echo hello' });
      expect(liveTurn.parts[0].result).toMatchObject({
        output: 'hello',
        statusMessage: 'Done',
        isError: false,
        returnedDiff: false,
      });
      expect(liveTurn.parts[0].result.enforcementPhase).toBeUndefined();

      const event = eventsOfType('chat:tool_result')[0];
      expect(event.payload).toMatchObject({
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        toolCallId: 'tc-1',
        toolName: 'Bash',
        toolArgs: { cmd: 'echo hello' },
        toolOutput: 'hello',
        toolStatus: 'Done',
        toolDisplay: [{ type: 'text', text: 'hello' }],
        returnedDiff: false,
        isError: false,
      });
      // Buffer consumed on outcome.
      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey).turn.toolArgsBuffers.has('tc-1')).toBe(false);
    });

    test('handles result without statusMessage', () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-1', toolName: 'Bash' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_result',
        payload: {
          toolCallId: 'tc-1',
          toolName: 'Bash',
          result: { output: 'output-only', display: [], returnedDiff: false, isError: false },
        },
      }, mockWs, env.drainContext);

      expect(eventsOfType('chat:tool_result')[0].payload.toolStatus).toBeUndefined();
    });

    test('pre-execution bounce stops the BOUND harness and emits enforcement phases', async () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-2', toolName: 'write' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-2', argsChunk: '{"file_path": "settings/config.json"}' },
      }, mockWs, env.drainContext);

      const bounced = eventsOfType('system:tool_bounced')[0];
      expect(bounced.payload).toMatchObject({
        threadId: 'thread-1',
        reason: 'Write to settings/ is not allowed',
        phase: 'tool_args',
      });

      const toolResult = eventsOfType('chat:tool_result')[0];
      expect(toolResult.payload.isError).toBe(true);
      expect(toolResult.payload.toolOutput).toBe('Write to settings/ is not allowed');
      expect(toolResult.payload.returnedDiff).toBe(false);
      expect(toolResult.payload.enforcementPhase).toBe('tool_args');

      // Fire-and-forget bound-control stop replaces session.wire.kill.
      await new Promise(resolve => setImmediate(resolve));
      expect(stoppedThreads).toEqual(['thread-1']);

      // Snapshot part carries the error result with its enforcement phase.
      const part = getLiveTurn(env.runtimeKey).parts.find(p => p.toolCallId === 'tc-2');
      expect(part.result.isError).toBe(true);
      expect(part.result.enforcementPhase).toBe('tool_args');
    });

    test('pre-execution bounce handles camelCase filePath args', async () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-4', toolName: 'write' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-4', argsChunk: '{"filePath": "settings/config.json"}' },
      }, mockWs, env.drainContext);

      const bounced = eventsOfType('system:tool_bounced')[0];
      expect(bounced.payload.filePath).toBe('settings/config.json');
      expect(eventsOfType('chat:tool_result')[0].payload.enforcementPhase).toBe('tool_args');
      await new Promise(resolve => setImmediate(resolve));
      expect(stoppedThreads).toEqual(['thread-1']);
    });

    test('cross-thread pre-execution bounce stops ONLY the bounced thread\'s bound harness', async () => {
      // SPEC §5: enforcement rejection on A stops A's bound harness only.
      // Two live drains on two runtime keys; only A's args bounce.
      const envA = makeEnv({ threadId: 'thread-A', userInput: 'Bounce me' });
      const envB = makeEnv({ threadId: 'thread-B', userInput: 'Unrelated turn' });
      beginBoundTurn(envA);
      beginBoundTurn(envB);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-a', toolName: 'write' } }, mockWs, envA.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-a', argsChunk: '{"file_path": "settings/config.json"}' },
      }, mockWs, envA.drainContext);

      // Fire-and-forget bound-control stop resolves on the microtask queue.
      await new Promise(resolve => setImmediate(resolve));

      // Exactly one bound harness stopped: A's. B's control never ran.
      expect(stoppedThreads).toEqual(['thread-A']);

      // Enforcement emissions belong to A only.
      for (const event of [...eventsOfType('system:tool_bounced'), ...eventsOfType('chat:tool_result')]) {
        expect(event.payload.threadId).toBe('thread-A');
      }

      // B stays in flight with its current drain and its own bound turn intact.
      expect(threadRuntimeManager.getActiveDrain(envB.runtimeKey)?.drainId).toBe(envB.drainId);
      expect(threadRuntimeManager.isDrainCurrent(envB.runtimeKey, envB.drainId)).toBe(true);
      expect(getLiveTurn(envB.runtimeKey)).toMatchObject({
        threadId: 'thread-B',
        status: 'in_flight',
        userInput: 'Unrelated turn',
      });
      expect(eventsOfType('chat:turn_end')).toHaveLength(0);
    });

    test('later tool_result is silently ignored after a pre-execution bounce', () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-3', toolName: 'write' } }, mockWs, env.drainContext);
      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-3', argsChunk: '{"file_path": "settings/config.json"}' },
      }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_result',
        payload: {
          toolCallId: 'tc-3',
          toolName: 'write',
          result: { output: 'would write', display: [], returnedDiff: false, isError: false },
        },
      }, mockWs, env.drainContext);

      expect(emittedEvents).toHaveLength(0);
    });

    test('tool_result-phase bounce emits enforcementPhase tool_result without stopping the harness', () => {
      // The args-phase check only fires once a complete JSON object exists, so
      // a call whose arguments never complete during streaming can only be
      // classified at result time. This fixture bounces on the tool name
      // alone to exercise that exact path.
      const env = makeEnv({ userInput: 'Run tool' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-5', toolName: 'forbidden_tool' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_result',
        payload: {
          toolCallId: 'tc-5',
          toolName: 'forbidden_tool',
          result: { output: 'done', display: [], returnedDiff: false, isError: false },
        },
      }, mockWs, env.drainContext);

      const bounced = eventsOfType('system:tool_bounced')[0];
      expect(bounced.payload.phase).toBe('tool_result');
      expect(eventsOfType('chat:tool_result')[0].payload.enforcementPhase).toBe('tool_result');
      const part = getLiveTurn(env.runtimeKey).parts.find(p => p.toolCallId === 'tc-5');
      expect(part.result.enforcementPhase).toBe('tool_result');
    });
  });

  // ─── subagent_event / status_update ─────────────────────────────────

  describe('subagent_event', () => {
    test('emits chat:subagent_event with the bound turn identity', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'subagent_event',
        payload: {
          parentToolCallId: 'tc-1',
          agentId: 'agent-1',
          subagentType: 'planner',
          subagentEventType: 'plan_step',
          subagentPayload: { step: 1 },
        },
      }, mockWs, env.drainContext);

      const event = eventsOfType('chat:subagent_event')[0];
      expect(event.payload).toMatchObject({
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        parentToolCallId: 'tc-1',
        agentId: 'agent-1',
        subagentType: 'planner',
        eventType: 'plan_step',
        eventPayload: { step: 1 },
      });
      expect(touchCounts['thread-1']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('status_update', () => {
    test('stores usage metadata on the runtime accumulator and emits with bound turn identity + seq', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      emittedEvents = [];

      // R-FINDING-2: explicit initialization — no status has arrived yet, so
      // the served snapshot's usage projection is null, not undefined.
      expect(getLiveTurn(env.runtimeKey).usage).toBeNull();

      applier.applyChatEvent({
        type: 'status_update',
        payload: {
          contextUsage: 42,
          tokenUsage: { input_other: 100, output: 50 },
          messageId: 'msg-1',
          planMode: true,
        },
      }, mockWs, env.drainContext);

      const record = threadRuntimeManager.getActiveDrain(env.runtimeKey);
      expect(record.turn.usage).toEqual({
        contextUsage: 42,
        tokenUsage: { input_other: 100, output: 50 },
        messageId: 'msg-1',
        planMode: true,
      });

      // R-FINDING-2: the same gated mutation mirrors a JSON-safe projection
      // onto the snapshot, so the published state is reconstructible from it.
      expect(getLiveTurn(env.runtimeKey).usage).toEqual({
        contextUsage: 42,
        tokenUsage: { input_other: 100, output: 50 },
        messageId: 'msg-1',
        planMode: true,
      });

      const event = eventsOfType('chat:status_update')[0];
      expect(event.payload).toMatchObject({
        scope: 'project',
        threadId: 'thread-1',
        // SPEC-02 Slice D §3.D rule 2: status_update gains the bound turnId.
        turnId: 'turn-1',
        contextUsage: 42,
        tokenUsage: { input_other: 100, output: 50 },
        messageId: 'msg-1',
        planMode: true,
      });
      // The emitted seq is the exact resulting frontier of its own mutation.
      expect(event.payload.streamSeq).toBe(getLiveTurn(env.runtimeKey).streamSeq);
    });

    test('snapshot usage is a deep clone — mutating the accumulator copy cannot reach it', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      applier.applyChatEvent({
        type: 'status_update',
        payload: { tokenUsage: { output: 50 } },
      }, mockWs, env.drainContext);

      threadRuntimeManager.getActiveDrain(env.runtimeKey).turn.usage.tokenUsage.output = 999;

      expect(getLiveTurn(env.runtimeKey).usage.tokenUsage).toEqual({ output: 50 });
    });

    test('status_update keeps bumping the single streamSeq frontier exactly once per event', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      const before = getLiveTurn(env.runtimeKey).streamSeq;

      applier.applyChatEvent({ type: 'status_update', payload: { contextUsage: 1 } }, mockWs, env.drainContext);

      expect(getLiveTurn(env.runtimeKey).streamSeq).toBe(before + 1);
    });
  });

  // ─── turn_end ────────────────────────────────────────────────────────

  describe('turn_end', () => {
    test('assembles from the runtime snapshot + accumulator, terminalizes, resets usage, clears-if-current', () => {
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Hello' } }, mockWs, env.drainContext);
      applier.applyChatEvent({
        type: 'status_update',
        payload: { contextUsage: 10, tokenUsage: { output: 5 }, messageId: 'msg-end', planMode: false },
      }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      const event = eventsOfType('chat:turn_end')[0];
      expect(event).toBeDefined();
      expect(event.payload).toMatchObject({
        workspace: 'workspace:code',
        workspaceId: 'code',
        projectRoot: '/tmp/project',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        fullText: 'Hello',
        hasToolCalls: false,
        userInput: 'Hi',
        reason: 'complete',
        partial: false,
      });
      expect(event.payload.parts).toEqual([{ type: 'text', content: 'Hello' }]);

      // Usage metadata was reset by terminalizeTurn.
      const recordAfterClear = threadRuntimeManager.getActiveDrain(env.runtimeKey);
      expect(recordAfterClear).toBeNull(); // clear-if-current removed our record

      // The COMPLETED snapshot remains available for thread:opened overlay.
      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.status).toBe('complete');
      expect(liveTurn.fullText).toBe('Hello');
      expect(liveTurn.streamSeq).toBeGreaterThan(1);
      // R-FINDING-2 terminal retention: the snapshot mirror clears with the
      // accumulator reset — both representations agree at terminalization.
      expect(liveTurn.usage).toBeNull();
    });

    test('emitted parts are clones — mutating them cannot reach the live runtime', () => {
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Hello' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      const parts = eventsOfType('chat:turn_end')[0].payload.parts;
      parts.push({ type: 'text', content: 'evil' });
      parts[0].content = 'mutated';

      expect(getLiveTurn(env.runtimeKey).parts).toEqual([{ type: 'text', content: 'Hello' }]);
    });

    test('interrupted turn_end emits terminal metadata and preserves partial parts', () => {
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Hello' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'turn_end',
        payload: { reason: 'interrupted', partial: true },
      }, mockWs, env.drainContext);

      const event = eventsOfType('chat:turn_end')[0];
      expect(event.payload).toMatchObject({
        threadId: 'thread-1',
        scope: 'project',
        userInput: 'Hi',
        fullText: 'Hello',
        reason: 'interrupted',
        partial: true,
      });
      expect(event.payload.parts).toEqual([{ type: 'text', content: 'Hello' }]);
      expect(getLiveTurn(env.runtimeKey).status).toBe('interrupted');
      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey)).toBeNull();
    });

    test('repeat turn_end after terminalization is an idempotent non-emitting drop', () => {
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Once' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      expect(eventsOfType('chat:turn_end')).toHaveLength(1);
    });

    test('hasToolCalls survives terminalization for assembly', () => {
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-1', toolName: 'Bash' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      expect(eventsOfType('chat:turn_end')[0].payload.hasToolCalls).toBe(true);
    });

    test('turn_end for a drain that never began a turn is a drop', () => {
      const env = makeEnv();
      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);
      expect(eventsOfType('chat:turn_end')).toHaveLength(0);
      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey)).toBeTruthy(); // record untouched
    });

    test('late turn_end from a superseded drain cannot clear the replacement drain', () => {
      const envA = makeEnv({ threadId: 'thread-A', drainId: 'drain-A' });
      const envB = makeEnv({ threadId: 'thread-A', drainId: 'drain-B' });
      beginBoundTurn(envB);
      applier.applyChatEvent({ type: 'content', payload: { text: 'B output' } }, mockWs, envB.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, envA.drainContext);

      expect(eventsOfType('chat:turn_end')).toHaveLength(0);
      expect(threadRuntimeManager.getActiveDrain(envB.runtimeKey)?.drainId).toBe('drain-B');
      expect(getLiveTurn(envB.runtimeKey).status).toBe('in_flight');
    });
  });

  // ─── error terminals (SPEC-03 Slice B) ──────────────────────────────

  describe('error turn_end terminals (SPEC-03 Slice B)', () => {
    const HOSTILE = 'HOSTILE raw provider stack /tmp/secret stderr';

    function makeAuthMarker() {
      return new HarnessRuntimeError('HARNESS_AUTHENTICATION_FAILED', {
        version: 1,
        harnessId: 'opencode',
        category: 'authentication',
        hadRenderableOutput: true,
        hadToolCalls: true,
        truncatedFields: ['stderrExcerpt'],
        stderrExcerpt: HOSTILE,
      });
    }

    /** Begin a bound turn, emit partial text + a tool call, then fail it. */
    function drivePartialTurnThenError(thrownShape = null) {
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'hmm' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'content', payload: { text: 'partial answer' } }, mockWs, env.drainContext);
      applier.applyChatEvent({
        type: 'tool_call',
        payload: { toolCallId: 'tc-e1', toolName: 'Read' },
      }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'turn_end',
        payload: {
          reason: 'error',
          partial: true,
          ...(thrownShape ? { terminalError: thrownShape } : {}),
        },
      }, mockWs, env.drainContext);
      return env;
    }

    test('a reason-error turn_end through the bound context terminalizes exactly once with status error, preserving partial output', () => {
      const env = drivePartialTurnThenError();

      const events = eventsOfType('chat:turn_end');
      expect(events).toHaveLength(1); // exactly ONE terminal publication
      const event = events[0].payload;
      expect(event).toMatchObject({
        threadId: 'thread-1',
        turnId: 'turn-1',
        reason: 'error',
        partial: true,
        fullText: 'partial answer',
        hasToolCalls: true,
        userInput: 'Hi',
      });
      // Partial thinking/text/tool output preserved in emission...
      expect(event.parts).toEqual([
        { type: 'think', content: 'hmm' },
        { type: 'text', content: 'partial answer' },
        { type: 'tool_call', toolCallId: 'tc-e1', name: 'Read', arguments: {}, result: { output: '', display: [], isError: false } },
      ]);

      // ...and in the retained snapshot, terminalized as 'error'.
      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.status).toBe('error');
      expect(liveTurn.fullText).toBe('partial answer');
      expect(liveTurn.parts).toEqual(event.parts);
      expect(liveTurn.usage).toBeNull();
      expect(liveTurn.activity).toBeNull();
      expect(liveTurn.stepCursor).toBeNull();
      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey)).toBeNull();
    });

    test('terminalError on the wire event matches the catalog row for a genuine marker', () => {
      const marker = makeAuthMarker();
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'turn_end',
        payload: { reason: 'error', partial: true, terminalError: normalizeTurnTerminalError(marker) },
      }, mockWs, env.drainContext);

      const event = eventsOfType('chat:turn_end')[0].payload;
      expect(event.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED);
      expect(getLiveTurn(env.runtimeKey).terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED);
    });

    test('an absent or hostile envelope is substituted with the generic MODEL_RESPONSE_FAILED row', () => {
      for (const bad of [undefined, null, { code: 'AUTHENTICATION_FAILED' }, { stack: HOSTILE }]) {
        threadRuntimeManager.runtimes.clear();
        const env = drivePartialTurnThenError(bad);
        const event = eventsOfType('chat:turn_end')[0].payload;
        expect(event.reason).toBe('error');
        expect(event.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
        expect(JSON.stringify(event)).not.toContain('HOSTILE');
        void env;
      }
    });

    test('the published envelope IS the retained snapshot one, at the SAME seq (post-terminalize clone pin)', () => {
      const env = drivePartialTurnThenError(normalizeTurnTerminalError(new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT')));
      const retained = getLiveTurn(env.runtimeKey);
      const event = eventsOfType('chat:turn_end')[0].payload;
      expect(event.streamSeq).toBe(retained.streamSeq);
      expect(event.activityRevision).toBe(retained.activityRevision);
      expect(event.terminalError).toEqual(retained.terminalError);
    });

    test('duplicate/stale error turn_end is dropped idempotently after terminalization', () => {
      const env = drivePartialTurnThenError();
      expect(eventsOfType('chat:turn_end')).toHaveLength(1);

      applier.applyChatEvent({
        type: 'turn_end',
        payload: {
          reason: 'error',
          partial: true,
          terminalError: TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT,
        },
      }, mockWs, env.drainContext);
      applier.applyChatEvent({
        type: 'turn_end',
        payload: { reason: 'interrupted', partial: true },
      }, mockWs, env.drainContext);

      expect(eventsOfType('chat:turn_end')).toHaveLength(1);
      expect(getLiveTurn(env.runtimeKey).status).toBe('error');
    });

    test.each([
      ['complete', {}],
      ['interrupted', { partial: true }],
    ])('%s turn_end carries NO envelope even when a hostile payload supplies one', (reason, extra) => {
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'content', payload: { text: 'done' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'turn_end',
        payload: {
          reason,
          ...extra,
          terminalError: { ...TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED, stolen: HOSTILE },
        },
      }, mockWs, env.drainContext);

      const event = eventsOfType('chat:turn_end')[0].payload;
      expect(event).not.toHaveProperty('terminalError'); // omitted key (pinned shape)
      expect(getLiveTurn(env.runtimeKey).terminalError).toBeNull(); // snapshot forced null
      expect(getLiveTurn(env.runtimeKey).status).toBe(reason === 'complete' ? 'complete' : 'interrupted');
    });

    test('pre-binding error turn_end is dropped without terminalizing or emitting', () => {
      const env = makeEnv(); // claimed, never begun
      applier.applyChatEvent({
        type: 'turn_end',
        payload: { reason: 'error', partial: true, terminalError: normalizeTurnTerminalError(makeAuthMarker()) },
      }, mockWs, env.drainContext);

      expect(eventsOfType('chat:turn_end')).toHaveLength(0);
      expect(getLiveTurn(env.runtimeKey)).toBeNull();
      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey)).toBeTruthy();
    });

    test('raw-material exclusion sweep: no stacks/stderr/provider objects from the thrown failure enter any lifecycle/snapshot/emission path', () => {
      const env = drivePartialTurnThenError({
        ...normalizeTurnTerminalError(makeAuthMarker()),
        stack: HOSTILE,
        stderrExcerpt: HOSTILE,
        provider: { json: { secret: 'SECRET-ENV-VALUE' } },
      });

      // The hostile keys are validator-rejected; substitution keeps only the
      // safe catalog row.
      const serializedSnapshot = JSON.stringify(getLiveTurn(env.runtimeKey));
      const serializedEvents = JSON.stringify(emittedEvents);
      for (const blob of [serializedSnapshot, serializedEvents]) {
        expect(blob).not.toContain('HOSTILE');
        expect(blob).not.toContain('SECRET-ENV-VALUE');
        expect(blob).not.toContain('provider');
        expect(blob).not.toContain('stack');
        expect(blob).not.toContain('stderrExcerpt');
      }
      expect(getLiveTurn(env.runtimeKey).terminalError)
        .toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
    });
  });

  // ─── runtime authority contracts ─────────────────────────────────────

  describe('serializable snapshot contract', () => {
    test('live snapshot JSON-round-trips with no functions and no control/harness keys', () => {
      const env = makeEnv({
        userInput: 'Snapshot me',
        attachments: [{ kind: 'file', label: 'a.txt', path: '/tmp/a.txt', sourceName: 'a.txt' }],
      });
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Body' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-1', toolName: 'Bash' } }, mockWs, env.drainContext);

      const snapshot = getLiveTurn(env.runtimeKey);
      const roundTrip = JSON.parse(JSON.stringify(snapshot));
      expect(roundTrip).toEqual(snapshot);

      (function assertPlainData(value, keyPath = '') {
        expect(typeof value).not.toBe('function');
        if (value && typeof value === 'object') {
          for (const [key, child] of Object.entries(value)) {
            expect(key).not.toMatch(/control|stopHarness|touchThreadSession|wire|harness/i);
            assertPlainData(child, `${keyPath}.${key}`);
          }
        }
      })(snapshot);
    });

    test('completed snapshot survives drain clear for the thread:opened overlay', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Persisted' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey)).toBeNull();
      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.status).toBe('complete');
      expect(liveTurn.fullText).toBe('Persisted');
    });
  });

  describe('applyLiveMutation streamSeq frontier', () => {
    test('returned streamSeq is monotonically increasing across accepted mutations', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      const identity = { drainId: env.drainId, turnId: 'turn-1' };

      const seqs = [
        threadRuntimeManager.applyLiveMutation(env.runtimeKey, identity, ({ snapshot }) => {
          require('../../lib/thread/live-turn-snapshot').appendContent(snapshot, 'a');
        }),
        threadRuntimeManager.applyLiveMutation(env.runtimeKey, identity, ({ snapshot }) => {
          require('../../lib/thread/live-turn-snapshot').appendContent(snapshot, 'b');
        }),
        threadRuntimeManager.applyLiveMutation(env.runtimeKey, identity, ({ snapshot }) => {
          require('../../lib/thread/live-turn-snapshot').appendThinking(snapshot, 't');
        }),
      ];

      expect(seqs.every(seq => typeof seq === 'number')).toBe(true);
      expect(seqs[0]).toBeLessThan(seqs[1]);
      expect(seqs[1]).toBeLessThan(seqs[2]);
      expect(getLiveTurn(env.runtimeKey).streamSeq).toBe(seqs[2]);
    });

    test('no-op mutations return the unchanged current streamSeq (no phantom bumps)', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      const identity = { drainId: env.drainId, turnId: 'turn-1' };
      const before = getLiveTurn(env.runtimeKey).streamSeq;

      const seq = threadRuntimeManager.applyLiveMutation(env.runtimeKey, identity, ({ snapshot }) => {
        require('../../lib/thread/live-turn-snapshot').appendContent(snapshot, ''); // ignored by helper
      });

      expect(seq).toBe(before);
      expect(getLiveTurn(env.runtimeKey).streamSeq).toBe(before);
    });

    test('returns null for wrong turnId, wrong drainId, or unbound turns', () => {
      const env = makeEnv();
      beginBoundTurn(env); // binds turn-1
      const mutator = () => {};

      expect(threadRuntimeManager.applyLiveMutation(env.runtimeKey, { drainId: env.drainId, turnId: 'wrong' }, mutator)).toBeNull();
      expect(threadRuntimeManager.applyLiveMutation(env.runtimeKey, { drainId: 'other-drain', turnId: 'turn-1' }, mutator)).toBeNull();

      const unbound = makeEnv();
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, unbound.drainContext);
      expect(threadRuntimeManager.applyLiveMutation(unbound.runtimeKey, { drainId: unbound.drainId, turnId: 'turn-x' }, mutator)).toBeNull();
    });
  });

  describe('bind-once authority API', () => {
    test('bindTurnToDrain binds exactly once and rejects empty ids or mismatched drains', () => {
      const env = makeEnv();

      expect(threadRuntimeManager.bindTurnToDrain(env.runtimeKey, env.drainId, '')).toBe(false);
      expect(threadRuntimeManager.bindTurnToDrain(env.runtimeKey, env.drainId, undefined)).toBe(false);
      expect(threadRuntimeManager.resolveBoundTurnId(env.runtimeKey, env.drainId)).toBeNull();

      expect(threadRuntimeManager.bindTurnToDrain(env.runtimeKey, env.drainId, 'turn-1')).toBe(true);
      expect(threadRuntimeManager.bindTurnToDrain(env.runtimeKey, env.drainId, 'turn-2')).toBe(false);
      expect(threadRuntimeManager.bindTurnToDrain(env.runtimeKey, 'wrong-drain', 'turn-2')).toBe(false);
      expect(threadRuntimeManager.resolveBoundTurnId(env.runtimeKey, env.drainId)).toBe('turn-1');
    });

    test('isDrainCurrent reflects claim, replacement, and clear-if-current', () => {
      const env = makeEnv({ threadId: 'thread-C', drainId: 'drain-C1' });
      expect(threadRuntimeManager.isDrainCurrent(env.runtimeKey, 'drain-C1')).toBe(true);
      expect(threadRuntimeManager.isDrainCurrent(env.runtimeKey, 'drain-other')).toBe(false);

      makeEnv({ threadId: 'thread-C', drainId: 'drain-C2' });
      expect(threadRuntimeManager.isDrainCurrent(env.runtimeKey, 'drain-C1')).toBe(false);

      expect(threadRuntimeManager.clearActiveDrainIfCurrent(env.runtimeKey, 'drain-C1')).toBe(false);
      expect(threadRuntimeManager.clearActiveDrainIfCurrent(env.runtimeKey, 'drain-C2')).toBe(true);
      expect(threadRuntimeManager.isDrainCurrent(env.runtimeKey, 'drain-C2')).toBe(false);
    });
  });

  // ─── Runtime-1R successor: fixed route identity ─────────────────────

  describe('interleaved drains on one applier keep their own routes', () => {
    test('events route by their fixed drain context even while other turns mutate shared state', () => {
      const envA = makeEnv({ threadId: 'thread-A' });
      const envB = makeEnv({ threadId: 'thread-B' });

      beginBoundTurn(envA);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Reply from A' } }, mockWs, envA.drainContext);
      beginBoundTurn(envB);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Reply from B' } }, mockWs, envB.drainContext);

      // Passive browse simulation: nothing about the applier reads selection
      // state, so there is nothing to corrupt. Both routes stay independent.
      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, envA.drainContext);

      const endA = eventsOfType('chat:turn_end').find(e => e.payload.threadId === 'thread-A');
      expect(endA).toBeDefined();
      expect(endA.payload.threadId).toBe('thread-A');
      expect(endA.payload.fullText).toBe('Reply from A');

      expect(getLiveTurn(envA.runtimeKey).fullText).toBe('Reply from A');
      expect(getLiveTurn(envB.runtimeKey).fullText).toBe('Reply from B');
      expect(getLiveTurn(envB.runtimeKey).status).toBe('in_flight'); // B unaffected
    });
  });

  // ─── SPEC-02 Slice B: step_begin identity and activity ──────────────

  describe('step_begin (SPEC-02 Slice B)', () => {
    const NOW = 1724600000000;
    const LOWER_BOUND = 946684800000;

    function applyStep(env, payload) {
      applier.applyChatEvent({ type: 'step_begin', payload }, mockWs, env.drainContext);
    }

    function stepEvents() {
      return eventsOfType('chat:step_begin');
    }

    function useClock(value) {
      jest.spyOn(Date, 'now').mockReturnValue(value);
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // ── identity precedence ────────────────────────────────────────────

    test('identity precedence: non-empty stepId beats messageId beats timestamp', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      emittedEvents = [];

      applyStep(env, { stepId: 's1', messageId: 'm1', timestamp: NOW });
      expect(stepEvents()[0].payload.identity).toBe('step:s1');

      applyStep(env, { messageId: 'm1', timestamp: NOW });
      expect(stepEvents()[1].payload.identity).toBe('message:m1');

      applyStep(env, { timestamp: NOW });
      expect(stepEvents()[2].payload.identity).toBe(`time:${String(NOW)}`);
    });

    test('same stepId under different timestamps dedupes to one acceptance', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      emittedEvents = [];

      applyStep(env, { stepId: 's1', timestamp: NOW });
      applyStep(env, { stepId: 's1', timestamp: NOW + 5000 });

      expect(stepEvents()).toHaveLength(1);
      const live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(1);
      expect(live.seenStepIdentities).toEqual(['step:s1']);
    });

    // ── dedupe-before-normalization ────────────────────────────────────

    test('duplicate detection precedes time handling — replay drops regardless of clock movement', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      applyStep(env, { stepId: 's1' }); // accepted; startedAt = NOW (no ts)
      emittedEvents = [];

      useClock(NOW + 300000); // clock advances well past any window
      applyStep(env, { stepId: 's1' }); // identical replay

      expect(stepEvents()).toHaveLength(0);
      const live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(1);
      expect(live.activity.startedAt).toBe(NOW); // no re-derived/reset time
      expect(live.seenStepIdentities).toEqual(['step:s1']);
      expect(live.stepCursor).toEqual({ identity: 'step:s1', startedAt: NOW });
    });

    test('A → B → delayed-A lifetime dedupe: delayed A dropped, ledger has no eviction', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      applyStep(env, { stepId: 'A', timestamp: NOW });
      applyStep(env, { stepId: 'B', timestamp: NOW });
      emittedEvents = [];

      applyStep(env, { stepId: 'A', timestamp: NOW }); // delayed replay of A

      expect(stepEvents()).toHaveLength(0);
      const live = getLiveTurn(env.runtimeKey);
      expect(live.activity).toMatchObject({ identity: 'step:B', activityRevision: 2 });
      expect(live.stepCursor).toEqual({ identity: 'step:B', startedAt: NOW });
      expect(live.seenStepIdentities).toEqual(['step:A', 'step:B']);
    });

    test('same future timestamp replays as duplicate even after now passes its whole window', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      const T = NOW + 120000; // too future at NOW (> now + 60s)
      useClock(NOW);
      applyStep(env, { timestamp: T }); // accepted; identity time:T; startedAt clamped to NOW
      expect(stepEvents()[0].payload).toMatchObject({ identity: `time:${T}`, startedAt: NOW });
      emittedEvents = [];

      useClock(T + 120000); // now advanced beyond T + 60s acceptance window
      applyStep(env, { timestamp: T }); // same identity → still a duplicate

      expect(stepEvents()).toHaveLength(0);
      const live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(1); // no reset
      expect(live.activity).toMatchObject({ identity: `time:${T}`, startedAt: NOW });
      expect(live.seenStepIdentities).toEqual([`time:${T}`]);
    });

    // ── normalization matrix (one captured now) ────────────────────────

    describe('normalization matrix', () => {
      function startedAtFor(timestamp) {
        const env = makeEnv();
        beginBoundTurn(env);
        useClock(NOW);
        applyStep(env, { timestamp });
        return stepEvents()[0].payload.startedAt;
      }

      test('second-based value (< lower bound) is rejected → now', () => {
        expect(startedAtFor(1724600000)).toBe(NOW);
      });

      test('exactly the lower bound is accepted verbatim', () => {
        expect(startedAtFor(LOWER_BOUND)).toBe(LOWER_BOUND);
      });

      test('valid past timestamp passes through unchanged', () => {
        expect(startedAtFor(NOW - 5000)).toBe(NOW - 5000);
      });

      test('future timestamp within the +60s skew clamps to now (Math.min)', () => {
        expect(startedAtFor(NOW + 30000)).toBe(NOW);
        expect(startedAtFor(NOW + 60000)).toBe(NOW); // inclusive edge still clamps
      });

      test('too-future timestamp (> now+60s) is rejected → now', () => {
        expect(startedAtFor(NOW + 60001)).toBe(NOW);
      });
    });

    // ── no-stable-identity fallback ────────────────────────────────────

    test('payload without ids/timestamp is ignored: no mutation, bump, or emission', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      const before = getLiveTurn(env.runtimeKey);

      const identityLess = [
        {},
        { stepId: '' },
        { messageId: '' },
        { timestamp: '123' },
        { timestamp: NaN },
        { timestamp: Infinity },
        { timestamp: -Infinity },
        { timestamp: null },
      ];
      for (const payload of identityLess) {
        applyStep(env, payload);
      }

      expect(stepEvents()).toHaveLength(0);
      const live = getLiveTurn(env.runtimeKey);
      expect(live.streamSeq).toBe(before.streamSeq);
      expect(live.activityRevision).toBe(0);
      expect(live.activity).toBeNull();
      expect(live.stepCursor).toBeNull();
      expect(live.seenStepIdentities).toEqual([]);
    });

    // ── snapshot carriage ──────────────────────────────────────────────

    test('accepted step carves identity/cursor/ledger/revision into the JSON-safe snapshot', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);

      applyStep(env, { stepId: 's1', messageId: 'm1', timestamp: NOW - 1000 });

      const live = getLiveTurn(env.runtimeKey);
      expect(live.activity).toEqual({
        kind: 'working',
        turnId: 'turn-1',
        identity: 'step:s1',
        stepId: 's1',
        messageId: 'm1',
        startedAt: NOW - 1000,
        activityRevision: 1,
      });
      expect(live.stepCursor).toEqual({ identity: 'step:s1', startedAt: NOW - 1000 });
      expect(live.seenStepIdentities).toEqual(['step:s1']);
      expect(live.activityRevision).toBe(1);
      expect(JSON.parse(JSON.stringify(live))).toEqual(live); // round-trip safe
    });

    test('a second distinct step replaces activity, bumps revision to 2, ledger [A,B]', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      applyStep(env, { stepId: 'A' });
      applyStep(env, { stepId: 'B' });

      const live = getLiveTurn(env.runtimeKey);
      expect(live.activity).toMatchObject({
        kind: 'working',
        identity: 'step:B',
        activityRevision: 2,
        startedAt: NOW,
      });
      expect(live.stepCursor).toEqual({ identity: 'step:B', startedAt: NOW });
      expect(live.seenStepIdentities).toEqual(['step:A', 'step:B']);
    });

    test('each accepted step increments the single streamSeq frontier exactly once', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      const before = getLiveTurn(env.runtimeKey).streamSeq;

      applyStep(env, { stepId: 'A' });
      applyStep(env, { stepId: 'B' });

      expect(getLiveTurn(env.runtimeKey).streamSeq).toBe(before + 2);
    });

    // ── terminal clears ────────────────────────────────────────────────

    test('step-only clean exit clears transient fields and bumps revision exactly once more', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      applyStep(env, { stepId: 's1' });
      emittedEvents = [];

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      expect(eventsOfType('chat:turn_end')).toHaveLength(1); // clean completion
      const live = getLiveTurn(env.runtimeKey);
      expect(live.status).toBe('complete');
      expect(live.activity).toBeNull();
      expect(live.stepCursor).toBeNull();
      expect(live.seenStepIdentities).toEqual([]);
      expect(live.activityRevision).toBe(2); // +1 accept, +1 real Working→cleared
    });

    test('output-less turn terminalization never bumps activityRevision', () => {
      const env = makeEnv();
      beginBoundTurn(env);

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      const live = getLiveTurn(env.runtimeKey);
      expect(live.status).toBe('complete');
      expect(live.activity).toBeNull();
      expect(live.stepCursor).toBeNull();
      expect(live.seenStepIdentities).toEqual([]);
      expect(live.activityRevision).toBe(0); // no activity ever existed
    });

    test('two-step turn ends at revision 3 (accept, replace, clear)', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      applyStep(env, { stepId: 'A' });
      applyStep(env, { stepId: 'B' });

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      expect(getLiveTurn(env.runtimeKey).activityRevision).toBe(3);
    });

    test('turn_end assembly still reads fullText/parts/userInput after transient clears', () => {
      const env = makeEnv({ userInput: 'Hi' });
      beginBoundTurn(env);
      useClock(NOW);
      applyStep(env, { stepId: 's1' });
      applier.applyChatEvent({ type: 'content', payload: { text: 'Body' } }, mockWs, env.drainContext);
      emittedEvents = [];

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs, env.drainContext);

      const event = eventsOfType('chat:turn_end')[0];
      expect(event.payload).toMatchObject({
        turnId: 'turn-1',
        fullText: 'Body',
        userInput: 'Hi',
        parts: [{ type: 'text', content: 'Body' }],
      });
    });

    // ── rejected input never bumps/publishes ───────────────────────────

    test('pre-binding, stale-drain, duplicate, and identity-less steps: zero seq movement, zero emissions', () => {
      // Pre-binding: begin accepted but bridge has not bound yet.
      const preEnv = makeEnv();
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, preEnv.drainContext);

      // Stale-drain: replacement drain supersedes A on the same runtime key.
      const envA = makeEnv({ threadId: 'thread-stale', drainId: 'drain-A' });
      const envB = makeEnv({ threadId: 'thread-stale', drainId: 'drain-B' });
      beginBoundTurn(envB);
      useClock(NOW);
      applyStep(envB, { stepId: 'only' }); // accepted baseline on B

      const baseline = getLiveTurn(envB.runtimeKey);
      emittedEvents = [];

      applyStep(preEnv, { stepId: 'early' });
      applyStep(envA, { stepId: 'late-A' }); // superseded drain context
      applyStep(envB, { stepId: 'only' }); // duplicate
      applyStep(envB, {}); // no identity

      expect(stepEvents()).toHaveLength(0);
      const live = getLiveTurn(envB.runtimeKey);
      expect(live.streamSeq).toBe(baseline.streamSeq);
      expect(live.activityRevision).toBe(1);
      expect(live.activity).toMatchObject({ identity: 'step:only', activityRevision: 1 });
      expect(live.seenStepIdentities).toEqual(['step:only']);
    });

    // ── compatibility-bus emission shape & isolation ───────────────────

    test('emits chat:step_begin via the injected bus with the exact sibling-convention key set', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      emittedEvents = [];

      applyStep(env, { stepId: 's1', messageId: 'm1', timestamp: NOW - 1000 });

      const event = stepEvents()[0];
      expect(event.type).toBe('chat:step_begin');
      expect(Object.keys(event.payload).sort()).toEqual([
        'activityRevision', 'identity', 'messageId', 'projectRoot', 'scope', 'startedAt',
        'stepId', 'streamSeq', 'threadId', 'turnId', 'workspace', 'workspaceEpoch',
        'workspaceId',
      ]);
      expect(event.payload).toMatchObject({
        workspace: 'workspace:code',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        identity: 'step:s1',
        stepId: 's1',
        messageId: 'm1',
        startedAt: NOW - 1000,
        activityRevision: 1,
      });
      // The emitted seq is the exact resulting frontier.
      expect(event.payload.streamSeq).toBe(getLiveTurn(env.runtimeKey).streamSeq);
    });

    test('timestamp-only emission omits stepId/messageId keys entirely', () => {
      const env = makeEnv();
      beginBoundTurn(env);
      useClock(NOW);
      emittedEvents = [];

      applyStep(env, { timestamp: NOW - 1000 });

      const payload = stepEvents()[0].payload;
      expect(payload).toHaveProperty('identity', `time:${NOW - 1000}`);
      expect(payload).not.toHaveProperty('stepId');
      expect(payload).not.toHaveProperty('messageId');
      const live = getLiveTurn(env.runtimeKey);
      expect(live.activity).not.toHaveProperty('stepId');
      expect(live.activity).not.toHaveProperty('messageId');
    });

    test('compatibility-path isolation: touched server files carry no canonical-only publication APIs', () => {
      const fs = require('fs');
      const path = require('path');
      const touched = [
        '../../lib/wire/canonical-harness-event-bridge.js',
        '../../lib/wire/canonical-chat-event-applier.js',
        '../../lib/wire/canonical-chat-terminal-events.js',
        // SPEC-02 Slice D §5: the extracted text/tool event modules join the
        // compatibility-path isolation guard.
        '../../lib/wire/canonical-chat-text-events.js',
        '../../lib/wire/canonical-chat-tool-events.js',
        '../../lib/thread/live-turn-snapshot.js',
        '../../lib/thread/canonical-turn-accumulator.js',
      ];
      for (const rel of touched) {
        const source = fs.readFileSync(path.join(__dirname, rel), 'utf8');
        expect(source).not.toMatch(/publishCanonical|AcceptedCanonicalRef|canonical[-_]?admission/i);
      }
    });
  });

  // ─── SPEC-02 Slice C: renderable-output suppression ──────────────────

  describe('renderable-output suppression (SPEC-02 Slice C)', () => {
    const NOW = 1724600000000;

    function useClock(value) {
      jest.spyOn(Date, 'now').mockReturnValue(value);
    }

    function applyStep(env, payload) {
      applier.applyChatEvent({ type: 'step_begin', payload }, mockWs, env.drainContext);
    }

    /** Begin + bind a turn, accept step A (rev 1, Working set), clear events. */
    function beginSteppedTurn(env) {
      beginBoundTurn(env);
      useClock(NOW);
      applyStep(env, { stepId: 'A' });
      emittedEvents = [];
    }

    /**
     * "No mutation at all" proof surface: after a suppressed chunk the
     * snapshot deep-equals the pre-chunk clone on every updatedAt-independent
     * projection field.
     */
    function expectSnapshotUnchangedSince(live, before) {
      expect(live.parts).toEqual(before.parts);
      expect(live.fullText).toBe(before.fullText);
      expect(live.streamSeq).toBe(before.streamSeq);
      expect(live.activityRevision).toBe(before.activityRevision);
      expect(live.activity).toEqual(before.activity);
      expect(live.stepCursor).toEqual(before.stepCursor);
      expect(live.seenStepIdentities).toEqual(before.seenStepIdentities);
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('blank INITIAL thinking is suppressed: no part, no emission, no frontier or revision movement, Working retained', () => {
      const env = makeEnv();
      beginSteppedTurn(env);
      const before = getLiveTurn(env.runtimeKey);

      applier.applyChatEvent({ type: 'thinking', payload: { text: '  \n\t ' } }, mockWs, env.drainContext);

      expect(eventsOfType('chat:thinking')).toHaveLength(0);
      const live = getLiveTurn(env.runtimeKey);
      expectSnapshotUnchangedSince(live, before);
      expect(live.parts).toEqual([]);
      expect(live.streamSeq).toBe(2); // begin=1 + accepted step=2; blank moved nothing
      expect(live.activityRevision).toBe(1);
      expect(live.activity).toMatchObject({ kind: 'working', identity: 'step:A' });
    });

    test('blank INITIAL content is suppressed: same zero-mutation proof surface', () => {
      const env = makeEnv();
      beginSteppedTurn(env);
      const before = getLiveTurn(env.runtimeKey);

      applier.applyChatEvent({ type: 'content', payload: { text: '' } }, mockWs, env.drainContext);

      expect(eventsOfType('chat:content')).toHaveLength(0);
      const live = getLiveTurn(env.runtimeKey);
      expectSnapshotUnchangedSince(live, before);
      expect(live.fullText).toBe('');
      expect(live.streamSeq).toBe(2);
      expect(live.activityRevision).toBe(1);
      expect(live.activity).toMatchObject({ kind: 'working', identity: 'step:A' });
    });

    test('whitespace-only chunks append VERBATIM to an existing think part and emit normally', () => {
      const env = makeEnv();
      beginSteppedTurn(env);

      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Real idea' } }, mockWs, env.drainContext);
      const seqAfterReal = getLiveTurn(env.runtimeKey).streamSeq;
      emittedEvents = [];

      applier.applyChatEvent({ type: 'thinking', payload: { text: '  \n\t' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'thinking', payload: { text: ' \t ' } }, mockWs, env.drainContext);

      const events = eventsOfType('chat:thinking');
      expect(events.map((e) => e.payload.text)).toEqual(['  \n\t', ' \t ']);
      const live = getLiveTurn(env.runtimeKey);
      expect(live.parts).toEqual([{ type: 'think', content: 'Real idea  \n\t \t ' }]);
      expect(live.fullText).toBe(''); // thinking never touches fullText
      expect(live.streamSeq).toBe(seqAfterReal + 2); // each accepted continuation advances once
      expect(live.activityRevision).toBe(2); // cleared by the real chunk; continuations never bump
      expect(live.activity).toBeNull();
    });

    test('whitespace-only chunks append VERBATIM to an existing text part (fullText exact bytes)', () => {
      const env = makeEnv();
      beginSteppedTurn(env);

      applier.applyChatEvent({ type: 'content', payload: { text: 'Answer:' } }, mockWs, env.drainContext);
      const seqAfterReal = getLiveTurn(env.runtimeKey).streamSeq;
      emittedEvents = [];

      applier.applyChatEvent({ type: 'content', payload: { text: ' \n\t' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'content', payload: { text: '\t ' } }, mockWs, env.drainContext);

      const events = eventsOfType('chat:content');
      expect(events.map((e) => e.payload.text)).toEqual([' \n\t', '\t ']);
      const live = getLiveTurn(env.runtimeKey);
      expect(live.fullText).toBe('Answer: \n\t\t ');
      expect(live.parts).toEqual([{ type: 'text', content: 'Answer: \n\t\t ' }]);
      expect(live.streamSeq).toBe(seqAfterReal + 2);
      expect(live.activityRevision).toBe(2);
      expect(live.activity).toBeNull();
    });

    test('suppression does NOT clear Working: blank thinking/content leave activity and revision untouched', () => {
      const env = makeEnv();
      beginSteppedTurn(env);

      applier.applyChatEvent({ type: 'thinking', payload: { text: '' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'content', payload: { text: '   ' } }, mockWs, env.drainContext);

      const live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(1); // unchanged since the accepted step
      expect(live.activity).toEqual({
        kind: 'working',
        turnId: 'turn-1',
        identity: 'step:A',
        stepId: 'A',
        startedAt: NOW,
        activityRevision: 1,
      });
      expect(live.stepCursor).toEqual({ identity: 'step:A', startedAt: NOW });
      expect(eventsOfType('chat:thinking')).toHaveLength(0);
      expect(eventsOfType('chat:content')).toHaveLength(0);
    });

    test('first RENDERABLE thinking clears Working with exactly one bump; later chunks never bump again', () => {
      const env = makeEnv();
      beginSteppedTurn(env); // rev 1

      applier.applyChatEvent({ type: 'thinking', payload: { text: 'First' } }, mockWs, env.drainContext);

      let live = getLiveTurn(env.runtimeKey);
      expect(live.activity).toBeNull();
      expect(live.activityRevision).toBe(2); // exactly N+1
      // Cursor and seen ledger are RETAINED by the renderable clear.
      expect(live.stepCursor).toEqual({ identity: 'step:A', startedAt: NOW });
      expect(live.seenStepIdentities).toEqual(['step:A']);
      expect(eventsOfType('chat:thinking')[0].payload.text).toBe('First');

      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Second' } }, mockWs, env.drainContext);
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Third' } }, mockWs, env.drainContext);

      live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(2); // never bumps again
      expect(live.activity).toBeNull();
      expect(live.parts).toEqual([{ type: 'think', content: 'FirstSecondThird' }]);
    });

    test('first RENDERABLE content clears Working with exactly one bump; later chunks never bump again', () => {
      const env = makeEnv();
      beginSteppedTurn(env); // rev 1

      applier.applyChatEvent({ type: 'content', payload: { text: 'Hello' } }, mockWs, env.drainContext);

      let live = getLiveTurn(env.runtimeKey);
      expect(live.activity).toBeNull();
      expect(live.activityRevision).toBe(2);
      expect(live.stepCursor).toEqual({ identity: 'step:A', startedAt: NOW });
      expect(live.seenStepIdentities).toEqual(['step:A']);

      applier.applyChatEvent({ type: 'content', payload: { text: ' world' } }, mockWs, env.drainContext);

      live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(2);
      expect(live.fullText).toBe('Hello world');
    });

    test('first tool_call after step_begin clears Working with exactly one bump', () => {
      const env = makeEnv({ userInput: 'Run tool' });
      beginSteppedTurn(env); // rev 1

      applier.applyChatEvent({
        type: 'tool_call',
        payload: { toolCallId: 'tc-1', toolName: 'Bash' },
      }, mockWs, env.drainContext);

      let live = getLiveTurn(env.runtimeKey);
      expect(live.activity).toBeNull();
      expect(live.activityRevision).toBe(2);
      expect(live.stepCursor).toEqual({ identity: 'step:A', startedAt: NOW });
      expect(live.seenStepIdentities).toEqual(['step:A']);
      expect(live.parts[0]).toMatchObject({ type: 'tool_call', toolCallId: 'tc-1' });
      expect(eventsOfType('chat:tool_call')).toHaveLength(1);

      applier.applyChatEvent({
        type: 'tool_call',
        payload: { toolCallId: 'tc-2', toolName: 'Read' },
      }, mockWs, env.drainContext);

      live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(2); // never bumps again while already cleared
    });

    test('mixed sequence proves dedupe-after-clear: blank kept working → content cleared (N+1) → replayed A dropped → B accepted (N+2)', () => {
      // SPEC-02 §5 "Duplicate after visible activity cleared": the full-turn
      // ledger outlives the visible Working clear, so a replayed identity is
      // still a duplicate after renderable output appeared.
      const env = makeEnv();
      beginSteppedTurn(env); // step A: rev 1, Working set, ledger [step:A]
      const seqAfterStepA = getLiveTurn(env.runtimeKey).streamSeq;

      // Blank thinking keeps Working.
      applier.applyChatEvent({ type: 'thinking', payload: { text: '   ' } }, mockWs, env.drainContext);
      let live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(1);
      expect(live.activity).not.toBeNull();

      // First renderable content clears Working: rev N+1.
      applier.applyChatEvent({ type: 'content', payload: { text: 'Visible' } }, mockWs, env.drainContext);
      live = getLiveTurn(env.runtimeKey);
      expect(live.activity).toBeNull();
      expect(live.activityRevision).toBe(2);
      expect(live.seenStepIdentities).toEqual(['step:A']); // ledger survived the clear

      // Replayed A is STILL a duplicate even though visible activity cleared:
      // zero emissions, zero frontier/revision movement, no resurrection.
      emittedEvents = [];
      applyStep(env, { stepId: 'A' });
      expect(eventsOfType('chat:step_begin')).toHaveLength(0);
      live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(2);
      expect(live.activity).toBeNull();
      expect(live.seenStepIdentities).toEqual(['step:A']);
      expect(live.streamSeq).toBe(seqAfterStepA + 1); // only the content mutation moved it

      // Fresh step B accepted: rev N+2, Working replaced.
      applyStep(env, { stepId: 'B' });
      const bEvents = eventsOfType('chat:step_begin');
      expect(bEvents).toHaveLength(1);
      expect(bEvents[0].payload).toMatchObject({ identity: 'step:B', activityRevision: 3 });
      live = getLiveTurn(env.runtimeKey);
      expect(live.activityRevision).toBe(3);
      expect(live.activity).toMatchObject({ identity: 'step:B', activityRevision: 3 });
      expect(live.seenStepIdentities).toEqual(['step:A', 'step:B']);
      expect(live.parts).toEqual([{ type: 'text', content: 'Visible' }]);
    });
  });

  // ─── SPEC-02 Slice D / SPEC §5: sequenced publication ───────────────

  describe('sequenced publication (SPEC-02 Slice D)', () => {
    const NOW = 1724600000000;

    /**
     * Capturing emit: records every bus emission AND — for each sequenced
     * publication — the live snapshot clone keyed by its resulting streamSeq.
     * Emission is synchronous after the gated mutation, so the clone read at
     * emission time is exactly the projection that publication represents.
     */
    let frontierKey = null;
    let seqSnapshots = new Map();

    function capturingEmit(type, payload) {
      emittedEvents.push({ type, payload });
      if (typeof payload?.streamSeq === 'number') {
        seqSnapshots.set(payload.streamSeq, threadRuntimeManager.getLiveTurn(frontierKey));
      }
    }

    /** Applier instance wired to the capturing emit for one drive. */
    function makeCapturingApplier() {
      return createCanonicalChatEventApplier({
        emit: capturingEmit,
        checkSettingsBounce,
        generateTurnId,
      });
    }

    function beginBoundWith(a, env) {
      const result = a.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, env.drainContext);
      if (result?.accepted && result.turnId) {
        expect(threadRuntimeManager.bindTurnToDrain(env.runtimeKey, env.drainId, result.turnId)).toBe(true);
      }
      return result;
    }

    /**
     * One full mixed turn through EVERY in-flight event kind, including the
     * suppressed and rejected inputs that must publish nothing:
     * begin → blank content (suppressed) → step A → duplicate A → content →
     * thinking → tool_call → args → result → status → subagent → end.
     */
    function driveMixedTurn({ threadId = 'thread-frontier' } = {}) {
      const env = makeEnv({ threadId, userInput: 'Mixed turn' });
      frontierKey = env.runtimeKey;
      seqSnapshots = new Map();
      emittedEvents = [];
      const a = makeCapturingApplier();
      const apply = (type, payload) =>
        a.applyChatEvent({ type, payload }, mockWs, env.drainContext);

      useClock(NOW);
      beginBoundWith(a, env);                                        // seq 1
      apply('content', { text: '   ' });                             // suppressed
      apply('step_begin', { stepId: 'A' });                          // seq 2, rev 0→1
      apply('step_begin', { stepId: 'A' });                          // duplicate
      apply('content', { text: 'Hello' });                           // seq 3, rev 1→2
      apply('thinking', { text: 'Why' });                            // seq 4
      apply('tool_call', { toolCallId: 'tc-1', toolName: 'Bash' });  // seq 5
      apply('tool_call_args', { toolCallId: 'tc-1', argsChunk: '{"cmd":"ls"}' }); // seq 6
      apply('tool_result', {
        toolCallId: 'tc-1',
        toolName: 'Bash',
        result: { output: 'out', display: [], returnedDiff: false, isError: false },
      });                                                            // seq 7
      apply('status_update', { contextUsage: 10 });                  // seq 8
      apply('subagent_event', {
        agentId: 'ag-1', subagentType: 'planner', subagentEventType: 'tick',
      });                                                            // seq 9
      apply('turn_end', {});                                         // seq 10

      jest.restoreAllMocks();
      return env;
    }

    function useClock(value) {
      jest.spyOn(Date, 'now').mockReturnValue(value);
    }

    afterEach(() => {
      jest.restoreAllMocks();
      frontierKey = null;
      seqSnapshots = new Map();
    });

    test('every accepted in-flight outbound carries matching route identity and a strictly +1 frontier from 1', () => {
      const env = driveMixedTurn();

      expect(emittedEvents.map(e => e.type)).toEqual([
        'chat:turn_begin',
        'chat:step_begin',
        'chat:content',
        'chat:thinking',
        'chat:tool_call',
        'chat:tool_call_args',
        'chat:tool_result',
        'chat:status_update',
        'chat:subagent_event',
        'chat:turn_end',
      ]);

      let expected = 0;
      for (const { payload } of emittedEvents) {
        expected += 1;
        expect(payload).toMatchObject({
          scope: 'project',
          threadId: 'thread-frontier',
          turnId: 'turn-1',
          streamSeq: expected,
        });
        expect(Number.isInteger(payload.streamSeq)).toBe(true);
        expect(payload.streamSeq).toBeGreaterThan(0);
      }
      expect(expected).toBe(10);

      // The final frontier equals the last published sequence — no drift.
      expect(getLiveTurn(env.runtimeKey).streamSeq).toBe(expected);
    });

    test('suppressed/duplicate/rejected input produces NO publication and NO movement', () => {
      const env = makeEnv({ threadId: 'thread-silent', userInput: 'Silent probe' });
      frontierKey = env.runtimeKey;
      seqSnapshots = new Map();
      emittedEvents = [];
      const a = makeCapturingApplier();
      const before = (() => {
        beginBoundWith(a, env);
        a.applyChatEvent({ type: 'step_begin', payload: { stepId: 'A' } }, mockWs, env.drainContext);
        return getLiveTurn(env.runtimeKey);
      })();

      // A second, accepted-but-never-bound drain supplies pre-binding
      // rejection input (the bridge has not called bindTurnToDrain).
      const unboundEnv = makeEnv({ threadId: 'thread-unbound', drainId: 'drain-unbound' });
      const unboundBegin = a.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs, unboundEnv.drainContext);
      expect(unboundBegin.accepted).toBe(true);
      expect(threadRuntimeManager.resolveBoundTurnId(unboundEnv.runtimeKey, unboundEnv.drainId)).toBeNull();
      emittedEvents = [];

      a.applyChatEvent({ type: 'content', payload: { text: '\t\n ' } }, mockWs, env.drainContext); // suppressed blank
      a.applyChatEvent({ type: 'step_begin', payload: { stepId: 'A' } }, mockWs, env.drainContext); // duplicate identity
      a.applyChatEvent({ type: 'step_begin', payload: {} }, mockWs, env.drainContext); // no identity source
      a.applyChatEvent({ type: 'step_begin', payload: { stepId: 'early' } }, mockWs, unboundEnv.drainContext); // pre-binding

      expect(emittedEvents).toHaveLength(0);
      expect(getLiveTurn(env.runtimeKey)).toEqual(before); // byte-identical projection
    });

    test('snapshot-at-each-sequence reconstruction: contiguous frontier and final state equals the state at the last published sequence', () => {
      const env = driveMixedTurn();

      const seqs = [...seqSnapshots.keys()].sort((x, y) => x - y);
      expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // monotonic contiguity
      for (const seq of seqs) {
        expect(seqSnapshots.get(seq).streamSeq).toBe(seq);
      }

      // State at N is reconstructible from the snapshot at N: each captured
      // clone carries everything published up to and including its sequence.
      expect(seqSnapshots.get(1).parts).toEqual([]);
      expect(seqSnapshots.get(2).activity).toMatchObject({ identity: 'step:A' });
      expect(seqSnapshots.get(3).fullText).toBe('Hello');
      expect(seqSnapshots.get(4).parts.map(p => p.type)).toEqual(['text', 'think']);
      expect(seqSnapshots.get(6).parts.find(p => p.toolCallId === 'tc-1').arguments).toEqual({ cmd: 'ls' });
      expect(seqSnapshots.get(7).parts.find(p => p.toolCallId === 'tc-1').result.output).toBe('out');
      // R-FINDING-2: the usage published by status_update at seq 8 lives on
      // that snapshot clone too — not only on the accumulator.
      expect(seqSnapshots.get(8).usage).toEqual({
        contextUsage: 10,
        tokenUsage: null,
        messageId: null,
        planMode: false,
      });
      expect(seqSnapshots.get(10).status).toBe('complete');
      expect(seqSnapshots.get(10).usage).toBeNull(); // terminal clear, agreeing with the accumulator reset

      // Publication and projection are one atomic contract: the retained
      // snapshot equals the clone captured at the last emitted sequence.
      expect(threadRuntimeManager.getLiveTurn(env.runtimeKey)).toEqual(
        seqSnapshots.get(seqs[seqs.length - 1])
      );
    });

    // ─── R-FINDING-1: unique frontier per accepted tool_call_args ────────

    function driveToolArgsTurn(threadId, chunks) {
      const env = makeEnv({ threadId, userInput: 'Args frontier' });
      frontierKey = env.runtimeKey;
      seqSnapshots = new Map();
      emittedEvents = [];
      const a = makeCapturingApplier();
      const apply = (type, payload) =>
        a.applyChatEvent({ type, payload }, mockWs, env.drainContext);

      useClock(NOW);
      beginBoundWith(a, env); // seq 1
      apply('tool_call', { toolCallId: 'tc-args', toolName: 'Bash' }); // seq 2
      for (const chunk of chunks) {
        apply('tool_call_args', { toolCallId: 'tc-args', argsChunk: chunk });
      }
      jest.restoreAllMocks();
      return env;
    }

    test('R-FINDING-1: unparseable then parseable chunks publish strictly +1 sequences and land the parsed args', () => {
      const env = driveToolArgsTurn('thread-args-fail-first', ['{"cmd"', ':"ls -la"}']);

      const emissions = eventsOfType('chat:tool_call_args');
      expect(emissions).toHaveLength(2);
      // Both accepted publications advance the frontier EXACTLY ONCE — the
      // unparseable first chunk may not repeat the tool_call sequence.
      expect(emissions[0].payload.streamSeq).toBe(3);
      expect(emissions[1].payload.streamSeq).toBe(4);

      // Correct end state: full buffer, parsed arguments on the part.
      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey).turn.toolArgsBuffers.get('tc-args'))
        .toBe('{"cmd":"ls -la"}');
      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.parts.find(p => p.toolCallId === 'tc-args').arguments).toEqual({ cmd: 'ls -la' });
      expect(liveTurn.streamSeq).toBe(4); // final frontier equals the last publication
    });

    test('R-FINDING-1: parseable then unparseable chunks publish strictly +1 sequences and retain the parsed prefix', () => {
      const env = driveToolArgsTurn('thread-args-parse-first', ['{"cmd":"ls"}', ' trailing']);

      const emissions = eventsOfType('chat:tool_call_args');
      expect(emissions).toHaveLength(2);
      expect(emissions[0].payload.streamSeq).toBe(3);
      expect(emissions[1].payload.streamSeq).toBe(4); // no repeated streamSeq on the failing chunk

      // Parsed prefix stays applied; the raw continuation is preserved verbatim.
      expect(threadRuntimeManager.getActiveDrain(env.runtimeKey).turn.toolArgsBuffers.get('tc-args'))
        .toBe('{"cmd":"ls"} trailing');
      const liveTurn = getLiveTurn(env.runtimeKey);
      expect(liveTurn.parts.find(p => p.toolCallId === 'tc-args').arguments).toEqual({ cmd: 'ls' });
      expect(liveTurn.streamSeq).toBe(4);
    });

    test('activityRevision changes only at Working transitions while streamSeq advances on every mutation', () => {
      driveMixedTurn();

      // Exactly five publications carry the activity revision (parent §4.9).
      const carried = emittedEvents.filter(e => typeof e.payload.activityRevision === 'number');
      expect(carried.map(e => e.type)).toEqual([
        'chat:step_begin', 'chat:content', 'chat:thinking', 'chat:tool_call', 'chat:turn_end',
      ]);
      const revisions = carried.map(e => e.payload.activityRevision);
      // Set at step A (0→1), cleared once by the first renderable content
      // (1→2). Later renderable output and the terminal clear find activity
      // already null — the revision never moves again this turn.
      expect(revisions).toEqual([1, 2, 2, 2, 2]);
      for (let i = 1; i < revisions.length; i += 1) {
        expect(revisions[i]).toBeGreaterThanOrEqual(revisions[i - 1]); // never decreases
      }

      // Independence: the frontier advanced on EVERY accepted publication
      // while the revision stayed flat across those same mutations.
      const seqs = emittedEvents.map(e => e.payload.streamSeq);
      expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(emittedEvents[3].payload).toMatchObject({ streamSeq: 4, activityRevision: 2 }); // thinking
      expect(emittedEvents[4].payload).toMatchObject({ streamSeq: 5, activityRevision: 2 }); // tool_call
      const subagent = emittedEvents.find(e => e.type === 'chat:subagent_event');
      expect(subagent.payload.streamSeq).toBe(9);
      expect(subagent.payload.activityRevision).toBeUndefined(); // not an activity carrier
    });

    test('stale subagent_event from a superseded drain drops without publication or movement', () => {
      const envA = makeEnv({ threadId: 'thread-stale-sub', drainId: 'drain-A' });
      const envB = makeEnv({ threadId: 'thread-stale-sub', drainId: 'drain-B' });
      beginBoundWith(applier, envB);
      const baseline = getLiveTurn(envB.runtimeKey);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'subagent_event', payload: { agentId: 'late-A' },
      }, mockWs, envA.drainContext);

      expect(emittedEvents).toHaveLength(0);
      expect(getLiveTurn(envB.runtimeKey).streamSeq).toBe(baseline.streamSeq);
    });

    test('enforcement-bounce chat:tool_result carries the exact resulting streamSeq on both phases', () => {
      // Result-phase bounce (forbidden_tool classifies only at result time).
      const env = makeEnv({ threadId: 'thread-bounce-seq', userInput: 'Run forbidden' });
      frontierKey = env.runtimeKey;
      seqSnapshots = new Map();
      emittedEvents = [];
      beginBoundWith(applier, env);
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-f1', toolName: 'forbidden_tool' } }, mockWs, env.drainContext);

      const seqBeforeResult = getLiveTurn(env.runtimeKey).streamSeq;
      applier.applyChatEvent({
        type: 'tool_result',
        payload: { toolCallId: 'tc-f1', toolName: 'forbidden_tool', result: { output: 'done', display: [], returnedDiff: false, isError: false } },
      }, mockWs, env.drainContext);

      const bounced = eventsOfType('chat:tool_result')[0];
      expect(bounced.payload.enforcementPhase).toBe('tool_result');
      expect(bounced.payload.streamSeq).toBe(seqBeforeResult + 1); // exactly one mutation
      expect(bounced.payload.streamSeq).toBe(getLiveTurn(env.runtimeKey).streamSeq);
      expect(eventsOfType('system:tool_bounced')).toHaveLength(1); // unchanged family

      // Args-phase bounce (write into settings/): the args application AND
      // the synthetic bounce result are two distinct sequenced mutations —
      // each publication carries its own exact resulting frontier.
      emittedEvents = [];
      applier.applyChatEvent({ type: 'tool_call', payload: { toolCallId: 'tc-f2', toolName: 'write' } }, mockWs, env.drainContext);
      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-f2', argsChunk: '{"file_path": "settings/config.json"}' },
      }, mockWs, env.drainContext);

      const argsEmission = eventsOfType('chat:tool_call_args')[0];
      const argsPhase = eventsOfType('chat:tool_result')[0];
      expect(argsPhase.payload.enforcementPhase).toBe('tool_args');
      expect(argsPhase.payload.streamSeq).toBe(argsEmission.payload.streamSeq + 1);
      expect(argsPhase.payload.streamSeq).toBe(getLiveTurn(env.runtimeKey).streamSeq);
    });
  });
});
