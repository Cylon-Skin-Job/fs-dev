/**
 * Canonical Harness Event Bridge Tests
 *
 * Tests the direct bridge from flat CanonicalEvent objects to the
 * { type, payload } shape consumed by canonical-chat-event-applier.
 */

const {
  createCanonicalHarnessEventBridge,
  shutdownActiveTurnLifecycles,
  _getLifecycleStats,
} = require('../../lib/wire/canonical-harness-event-bridge');
const { EventEmitter } = require('events');

describe('CanonicalHarnessEventBridge', () => {
  let appliedEvents;
  let mockApplier;
  let bridge;

  beforeEach(() => {
    appliedEvents = [];
    mockApplier = {
      applyChatEvent: (event, ws) => {
        appliedEvents.push({ event, ws });
      }
    };
    bridge = createCanonicalHarnessEventBridge({
      applyChatEvent: mockApplier.applyChatEvent,
    });
  });

  // Run these before cases that intentionally leave unresolved legacy test
  // lifecycles; production shutdown must never special-case those fixtures.
  describe('global active-turn shutdown ownership', () => {
    function heldEvents(releasePromise) {
      return (async function* events() {
        yield { type: 'turn_begin', userInput: 'active' };
        await releasePromise;
      }());
    }

    async function ownedWireFixture(wire, suffix) {
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      const identity = Object.freeze({
        workspaceId: 'wire-result-workspace',
        threadId: `wire-result-thread-${suffix}`,
        turnId: `wire-result-turn-${suffix}`,
      });
      const ownedBridge = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => identity,
        applyChatEvent: async () => {},
      });
      const drain = ownedBridge.drainHarnessEvents(heldEvents(held), null, {
        turnAuthority: identity,
        turnApplicationContext: { wire },
      });
      await new Promise((resolve) => setImmediate(resolve));
      return { drain, release };
    }

    test('finalizes all active lifecycles through original contexts and signals a shared wire once', async () => {
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      const wire = { _stopSession: jest.fn(async () => true) };
      const applications = [[], []];
      const drains = [];
      for (let index = 0; index < 2; index += 1) {
        const identity = Object.freeze({
          workspaceId: 'shutdown-workspace', threadId: `shutdown-thread-${index}`, turnId: `shutdown-turn-${index}`,
        });
        const ownerContext = { wire, marker: `context-${index}` };
        const ownedBridge = createCanonicalHarnessEventBridge({
          resolveTurnIdentity: () => identity,
          applyChatEvent: async (event, _ws, context) => applications[index].push({ type: event.type, context }),
        });
        drains.push(ownedBridge.drainHarnessEvents(heldEvents(held), null, {
          turnAuthority: identity,
          turnApplicationContext: ownerContext,
        }));
      }
      await new Promise((resolve) => setImmediate(resolve));

      await shutdownActiveTurnLifecycles();

      expect(wire._stopSession).toHaveBeenCalledTimes(1);
      expect(wire._stopSession).toHaveBeenCalledWith('SIGTERM');
      for (let index = 0; index < 2; index += 1) {
        expect(applications[index].map((item) => item.type)).toEqual(['turn_begin', 'turn_end']);
        expect(applications[index][1].context.marker).toBe(`context-${index}`);
      }
      expect(_getLifecycleStats().active).toBe(0);
      release();
      await Promise.all(drains);
    });

    test('owns a frozen-authority drain before its first event and rejects late iterator work', async () => {
      let releaseFirst;
      const first = new Promise((resolve) => { releaseFirst = resolve; });
      const wire = { _stopSession: jest.fn(async () => true) };
      const identity = Object.freeze({
        workspaceId: 'pre-event-workspace', threadId: 'pre-event-thread', turnId: 'pre-event-turn',
      });
      const applications = [];
      const diagnostics = [];
      const ownedBridge = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => identity,
        applyChatEvent: async (event) => { applications.push(event.type); },
        onDiagnostic: (code) => diagnostics.push(code),
      });
      const events = (async function* delayedFirstEvent() {
        await first;
        yield { type: 'turn_begin', userInput: 'late' };
      }());
      const drain = ownedBridge.drainHarnessEvents(events, null, {
        turnAuthority: identity,
        turnApplicationContext: { wire },
      });

      expect(_getLifecycleStats().active).toBe(1);
      await expect(shutdownActiveTurnLifecycles()).resolves.toMatchObject({
        drained: true, lifecycles: 1, wires: 1,
      });
      expect(wire._stopSession).toHaveBeenCalledTimes(1);
      expect(applications).toEqual(['turn_end']);
      releaseFirst();
      await drain;
      expect(applications).toEqual(['turn_end']);
      expect(diagnostics).toEqual(['agent_turn_late_event']);
      expect(_getLifecycleStats().active).toBe(0);
    });

    test.each([
      ['TERM success', async () => true, ['SIGTERM'], true],
      ['TERM false then KILL success', async (signal) => signal === 'SIGKILL', ['SIGTERM', 'SIGKILL'], true],
      ['TERM reject then KILL success', async (signal) => {
        if (signal === 'SIGTERM') throw new Error('term rejected');
        return true;
      }, ['SIGTERM', 'SIGKILL'], true],
      ['both reject', async () => { throw new Error('stop rejected'); }, ['SIGTERM', 'SIGKILL'], false],
      ['both throw synchronously', (signal) => { throw new Error(`${signal} threw`); }, ['SIGTERM', 'SIGKILL'], false],
      ['both return false', async () => false, ['SIGTERM', 'SIGKILL'], false],
    ])('wire stop outcome %s propagates exact drained state', async (suffix, stop, signals, drained) => {
      const wire = { _stopSession: jest.fn(stop) };
      const fixture = await ownedWireFixture(wire, suffix.replaceAll(' ', '-'));

      await expect(shutdownActiveTurnLifecycles()).resolves.toMatchObject({ drained, wires: 1 });
      expect(wire._stopSession.mock.calls.map(([signal]) => signal)).toEqual(signals);
      fixture.release();
      await fixture.drain;
    });

    test.each([
      ['TERM timeout then KILL success', false, true],
      ['TERM and KILL timeout', true, false],
    ])('wire stop timeout outcome %s leaves no timer', async (suffix, killHangs, drained) => {
      jest.useFakeTimers();
      try {
        const wire = {
          _stopSession: jest.fn((signal) => (
            signal === 'SIGKILL' && !killHangs ? Promise.resolve(true) : new Promise(() => {})
          )),
        };
        let release;
        const held = new Promise((resolve) => { release = resolve; });
        const identity = Object.freeze({
          workspaceId: 'wire-timeout-workspace',
          threadId: `wire-timeout-thread-${killHangs}`,
          turnId: `wire-timeout-turn-${killHangs}`,
        });
        const ownedBridge = createCanonicalHarnessEventBridge({
          resolveTurnIdentity: () => identity,
          applyChatEvent: async () => {},
        });
        const drain = ownedBridge.drainHarnessEvents(heldEvents(held), null, {
          turnAuthority: identity,
          turnApplicationContext: { wire },
        });
        await jest.advanceTimersByTimeAsync(0);
        const shutdown = shutdownActiveTurnLifecycles({
          timeoutMs: 5_000,
          monotonicNow: () => Date.now(),
        });
        await jest.advanceTimersByTimeAsync(2_000);
        if (killHangs) await jest.advanceTimersByTimeAsync(1_000);
        await expect(shutdown).resolves.toMatchObject({ drained, wires: 1 });
        expect(wire._stopSession.mock.calls.map(([signal]) => signal))
          .toEqual(['SIGTERM', 'SIGKILL']);
        expect(jest.getTimerCount()).toBe(0);
        release();
        await drain;
      } finally {
        jest.useRealTimers();
      }
    });

    test.each([
      ['minus', 1_999, ['SIGTERM']],
      ['equal', 2_000, ['SIGTERM']],
      ['plus', 2_001, ['SIGTERM', 'SIGKILL']],
    ])('wire close boundary %s leaves no timer or close listener', async (_boundary, closeAt, expectedSignals) => {
      jest.useFakeTimers();
      try {
        let release;
        const held = new Promise((resolve) => { release = resolve; });
        const wire = new EventEmitter();
        wire.kill = jest.fn((signal) => {
          setTimeout(() => wire.emit('close'), signal === 'SIGTERM' ? closeAt : 0);
        });
        const identity = Object.freeze({
          workspaceId: 'boundary-workspace', threadId: `boundary-thread-${closeAt}`, turnId: `boundary-turn-${closeAt}`,
        });
        const ownedBridge = createCanonicalHarnessEventBridge({
          resolveTurnIdentity: () => identity,
          applyChatEvent: async () => {},
        });
        const drain = ownedBridge.drainHarnessEvents(heldEvents(held), null, {
          turnAuthority: identity,
          turnApplicationContext: { wire },
        });
        await jest.advanceTimersByTimeAsync(0);
        const shutdown = shutdownActiveTurnLifecycles({
          timeoutMs: 5_000,
          monotonicNow: () => Date.now(),
        });
        await jest.advanceTimersByTimeAsync(closeAt > 2_000 ? 2_001 : closeAt);
        await shutdown;
        expect(wire.kill.mock.calls.map(([signal]) => signal)).toEqual(expectedSignals);
        expect(wire.listenerCount('close')).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
        release();
        await drain;
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('event mappings', () => {
    test('maps turn_begin', () => {
      bridge.applyHarnessEvent({
        type: 'turn_begin',
        timestamp: 1,
        userInput: 'Hello AI'
      });

      expect(appliedEvents).toHaveLength(1);
      expect(appliedEvents[0].event).toMatchObject({
        type: 'turn_begin',
        payload: { timestamp: 1, userInput: 'Hello AI' }
      });
    });

    test('maps content', () => {
      bridge.applyHarnessEvent({
        type: 'content',
        timestamp: 1,
        text: 'Hello world'
      });

      expect(appliedEvents[0].event).toMatchObject({
        type: 'content',
        payload: { timestamp: 1, text: 'Hello world' }
      });
    });

    test('maps thinking', () => {
      bridge.applyHarnessEvent({
        type: 'thinking',
        timestamp: 1,
        text: 'Deep thought'
      });

      expect(appliedEvents[0].event).toMatchObject({
        type: 'thinking',
        payload: { timestamp: 1, text: 'Deep thought' }
      });
    });

    test('maps tool_call with canonical tool name', () => {
      bridge.applyHarnessEvent({
        type: 'tool_call',
        timestamp: 1,
        toolCallId: 'tc-1',
        toolName: 'shell'
      });

      expect(appliedEvents[0].event).toMatchObject({
        type: 'tool_call',
        payload: { timestamp: 1, toolCallId: 'tc-1', toolName: 'shell' }
      });
    });

    test('maps tool_call_args', () => {
      bridge.applyHarnessEvent({
        type: 'tool_call_args',
        timestamp: 1,
        toolCallId: 'tc-1',
        argsChunk: '{"cmd": "ls"}'
      });

      expect(appliedEvents[0].event).toMatchObject({
        type: 'tool_call_args',
        payload: { timestamp: 1, toolCallId: 'tc-1', argsChunk: '{"cmd": "ls"}' }
      });
    });

    test('maps tool_result with canonical tool name', () => {
      bridge.applyHarnessEvent({
        type: 'tool_result',
        timestamp: 1,
        toolCallId: 'tc-1',
        toolName: 'shell',
        output: 'hello',
        statusMessage: 'Done',
        display: [{ type: 'text', text: 'hello' }],
        returnedDiff: false,
        isError: false,
        files: []
      });

      expect(appliedEvents[0].event).toMatchObject({
        type: 'tool_result',
        payload: {
          timestamp: 1,
          toolCallId: 'tc-1',
          toolName: 'shell',
          result: {
            output: 'hello',
            statusMessage: 'Done',
            display: [{ type: 'text', text: 'hello' }],
            returnedDiff: false,
            isError: false,
            files: []
          }
        }
      });
    });

    test('maps subagent_event', () => {
      bridge.applyHarnessEvent({
        type: 'subagent_event',
        timestamp: 1,
        parentToolCallId: 'tc-1',
        agentId: 'agent-1',
        subagentType: 'planner',
        subagentEventType: 'plan_step',
        subagentPayload: { step: 1 }
      });

      expect(appliedEvents[0].event).toMatchObject({
        type: 'subagent_event',
        payload: {
          parentToolCallId: 'tc-1',
          agentId: 'agent-1',
          subagentType: 'planner',
          subagentEventType: 'plan_step',
          subagentPayload: { step: 1 }
        }
      });
    });

    test('maps status_update', () => {
      bridge.applyHarnessEvent({
        type: 'status_update',
        timestamp: 1,
        contextUsage: 42,
        tokenUsage: { input_other: 100, output: 50 },
        messageId: 'msg-1',
        planMode: true
      });

      expect(appliedEvents[0].event).toMatchObject({
        type: 'status_update',
        payload: {
          contextUsage: 42,
          tokenUsage: { input_other: 100, output: 50 },
          messageId: 'msg-1',
          planMode: true
        }
      });
    });

    test('maps turn_end', async () => {
      await bridge.applyHarnessEvent({
        type: 'turn_end',
        timestamp: 1,
        turnId: 'turn-1'
      });

      expect(appliedEvents[0].event).toMatchObject({
        type: 'turn_end',
        payload: {}
      });
    });
  });

  describe('canonical tool name pass-through', () => {
    test('passes canonical tool names unchanged', () => {
      bridge.applyHarnessEvent({
        type: 'tool_call',
        timestamp: 1,
        toolCallId: 'tc-1',
        toolName: 'web_search'
      });

      expect(appliedEvents[0].event.payload.toolName).toBe('web_search');
    });

    test('does not mutate unknown tool names', () => {
      bridge.applyHarnessEvent({
        type: 'tool_call',
        timestamp: 1,
        toolCallId: 'tc-1',
        toolName: 'some_future_tool'
      });

      expect(appliedEvents[0].event.payload.toolName).toBe('some_future_tool');
    });
  });

  describe('drainHarnessEvents', () => {
    test('applies yielded events in order', async () => {
      async function* generateEvents() {
        yield { type: 'turn_begin', timestamp: 1, userInput: 'Hi' };
        yield { type: 'content', timestamp: 2, text: 'Hello' };
        yield { type: 'turn_end', timestamp: 3, turnId: 't1' };
      }

      await bridge.drainHarnessEvents(generateEvents());

      expect(appliedEvents).toHaveLength(3);
      expect(appliedEvents[0].event.type).toBe('turn_begin');
      expect(appliedEvents[1].event.type).toBe('content');
      expect(appliedEvents[2].event.type).toBe('turn_end');
    });

    test('passes ws through to applier', async () => {
      const mockWs = { readyState: 1 };

      async function* generateEvents() {
        yield { type: 'content', timestamp: 1, text: 'Hello' };
      }

      await bridge.drainHarnessEvents(generateEvents(), mockWs);

      expect(appliedEvents[0].ws).toBe(mockWs);
    });

    test('calls onError when draining throws', async () => {
      const error = new Error('stream failed');
      async function* generateEvents() {
        yield { type: 'content', timestamp: 1, text: 'Hello' };
        throw error;
      }

      const onError = jest.fn();
      await expect(bridge.drainHarnessEvents(generateEvents(), null, { onError })).rejects.toThrow('stream failed');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('turn-scoped lifecycle ownership', () => {
    test('separate connection bridges join one immutable turn finalizer', async () => {
      const identity = { workspaceId: 'workspace-join', threadId: 'thread-join', turnId: 'turn-join' };
      const applied = [];
      const first = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => identity,
        applyChatEvent: async event => { applied.push(['first', event.type]); },
      });
      const rebound = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => identity,
        applyChatEvent: async event => { applied.push(['rebound', event.type]); },
      });

      await first.applyHarnessEvent({ type: 'turn_begin', userInput: 'hello' });
      await rebound.applyHarnessEvent({ type: 'content', text: 'through rebound' });
      const stopped = rebound.finalizeTurn({ type: 'turn_end', reason: 'interrupted' });
      const providerEnd = first.finalizeTurn({ type: 'turn_end', reason: 'complete' });
      expect(providerEnd).toBe(stopped);
      await Promise.all([stopped, providerEnd]);
      expect(applied).toContainEqual(['first', 'content']);
      expect(applied).not.toContainEqual(['rebound', 'content']);
      expect(applied.filter(([, type]) => type === 'turn_end')).toHaveLength(1);
    });

    test('a reused rebound bridge stops A after completing B through A original owner', async () => {
      const authorityA = Object.freeze({
        workspaceId: 'workspace-reused', threadId: 'thread-A', turnId: 'turn-A',
      });
      const authorityB = Object.freeze({
        workspaceId: 'workspace-reused', threadId: 'thread-B', turnId: 'turn-B',
      });
      let reboundAuthority = authorityB;
      const applied = [];
      const originalA = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => authorityA,
        applyChatEvent: async event => { applied.push(['A', event.type]); },
      });
      const rebound = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => reboundAuthority,
        applyChatEvent: async event => { applied.push(['B', event.type]); },
      });

      await originalA.applyHarnessEvent({ type: 'turn_begin', userInput: 'A' });
      await rebound.applyHarnessEvent({ type: 'turn_begin', userInput: 'B' });
      await rebound.finalizeTurn({ type: 'turn_end', reason: 'complete' });
      reboundAuthority = authorityA;
      const stoppedA = rebound.finalizeTurn({ type: 'turn_end', reason: 'interrupted' });
      const providerEndA = originalA.finalizeTurn({ type: 'turn_end', reason: 'complete' });

      expect(stoppedA).toBe(providerEndA);
      await Promise.all([stoppedA, providerEndA]);
      expect(applied).toEqual([
        ['A', 'turn_begin'],
        ['B', 'turn_begin'],
        ['B', 'turn_end'],
        ['A', 'turn_end'],
      ]);
    });

    test('rebound stop drains a queued terminal snapshot through the original turn owner', async () => {
      const identity = { workspaceId: 'workspace-queued', threadId: 'thread-queued', turnId: 'turn-queued' };
      const originalParts = [];
      const reboundParts = [];
      const endings = [];
      let releaseSnapshot;
      const original = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => identity,
        applyChatEvent: async event => {
          if (event.type === 'tool_snapshot') {
            await new Promise(resolve => { releaseSnapshot = resolve; });
            originalParts.push('terminal');
          }
          if (event.type === 'turn_end') endings.push(['original', [...originalParts]]);
        },
      });
      const rebound = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => identity,
        applyChatEvent: async event => {
          if (event.type === 'turn_end') endings.push(['rebound', [...reboundParts]]);
        },
      });

      await original.applyHarnessEvent({ type: 'turn_begin', userInput: 'hello' });
      const terminal = original.applyHarnessEvent({ type: 'tool_snapshot', toolCallId: 'call-1' });
      const stopped = rebound.finalizeTurn({ type: 'turn_end', reason: 'interrupted' });
      while (!releaseSnapshot) await new Promise(resolve => setImmediate(resolve));
      releaseSnapshot();
      await Promise.all([terminal, stopped]);
      expect(endings).toEqual([['original', ['terminal']]]);
    });

    test('a new turn waits for the prior finalizer instead of reopening its ingress', async () => {
      let identity = { workspaceId: 'workspace-wait', threadId: 'thread-wait', turnId: 'turn-A' };
      let releaseEnd;
      const applied = [];
      const waiting = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => identity,
        applyChatEvent: async event => {
          applied.push(event.type);
          if (event.type === 'turn_end') await new Promise(resolve => { releaseEnd = resolve; });
        },
      });
      await waiting.applyHarnessEvent({ type: 'turn_begin', userInput: 'A' });
      const ending = waiting.finalizeTurn({ type: 'turn_end', reason: 'complete' });
      await Promise.resolve();
      identity = { ...identity, turnId: 'turn-B' };
      const beginning = waiting.applyHarnessEvent({ type: 'turn_begin', userInput: 'B' });
      while (!releaseEnd) await new Promise(resolve => setImmediate(resolve));
      expect(applied).toEqual(['turn_begin', 'turn_end']);
      releaseEnd();
      await Promise.all([ending, beginning]);
      expect(applied).toEqual(['turn_begin', 'turn_end', 'turn_begin']);
    });

    test('settled cross-connection tombstones remain bounded', async () => {
      let identity;
      const firstIdentity = Object.freeze({
        workspaceId: 'workspace-cap', threadId: 'thread-0', turnId: 'turn-0',
      });
      const firstApplications = [];
      const first = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => firstIdentity,
        applyChatEvent: async event => firstApplications.push(event),
      });
      await first.applyHarnessEvent({ type: 'turn_begin', userInput: 'first' });
      await first.finalizeTurn({ type: 'turn_end', reason: 'complete' });
      const bounded = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => identity,
        applyChatEvent: async () => {},
      });
      for (let index = 0; index < 1_030; index += 1) {
        identity = {
          workspaceId: 'workspace-cap', threadId: `thread-${index + 1}`, turnId: `turn-${index + 1}`,
        };
        await bounded.applyHarnessEvent({ type: 'turn_begin', userInput: 'bounded' });
        await bounded.finalizeTurn({ type: 'turn_end', reason: 'complete' });
      }
      expect(_getLifecycleStats().tombstones).toBeLessThanOrEqual(1_024);
      await first.finalizeTurn({ type: 'turn_end', reason: 'late-process-close' });
      expect(firstApplications.filter(event => event.type === 'turn_end')).toHaveLength(1);

      const reboundApplications = [];
      const rebound = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => firstIdentity,
        applyChatEvent: async event => reboundApplications.push(event.type),
      });
      await rebound.finalizeTurn({ type: 'turn_end', reason: 'late-rebound-close' });
      expect(reboundApplications).toEqual([]);
      expect(firstApplications.filter(event => event.type === 'turn_end')).toHaveLength(1);

      const freshApplications = [];
      const freshIdentity = {
        workspaceId: 'workspace-cap', threadId: 'thread-fresh', turnId: 'turn-fresh',
      };
      const fresh = createCanonicalHarnessEventBridge({
        resolveTurnIdentity: () => freshIdentity,
        applyChatEvent: async event => freshApplications.push(event.type),
      });
      await fresh.applyHarnessEvent({ type: 'turn_begin', userInput: 'fresh' });
      await fresh.applyHarnessEvent({ type: 'content', text: 'not suppressed' });
      await fresh.finalizeTurn({ type: 'turn_end', reason: 'complete' });
      expect(freshApplications).toEqual(['turn_begin', 'content', 'turn_end']);
    });
  });

  describe('non-chat events', () => {
    test('calls onNonChatEvent for unknown event types', () => {
      const onNonChatEvent = jest.fn();
      const bridgeWithNonChat = createCanonicalHarnessEventBridge({
        applyChatEvent: mockApplier.applyChatEvent,
        onNonChatEvent,
      });

      bridgeWithNonChat.applyHarnessEvent({
        type: 'custom_event',
        timestamp: 1,
        data: 'something'
      });

      expect(onNonChatEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'custom_event' }),
        undefined
      );
    });

    test('ignores unknown events when onNonChatEvent not provided', () => {
      bridge.applyHarnessEvent({
        type: 'custom_event',
        timestamp: 1,
        data: 'something'
      });

      expect(appliedEvents).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('handles null/undefined event gracefully', () => {
      bridge.applyHarnessEvent(null);
      bridge.applyHarnessEvent(undefined);
      bridge.applyHarnessEvent({});

      expect(appliedEvents).toHaveLength(0);
    });

    test('does not switch on raw Kimi wire names', () => {
      // These should be treated as unknown/non-chat events
      bridge.applyHarnessEvent({ type: 'TurnBegin', timestamp: 1 });
      bridge.applyHarnessEvent({ type: 'ContentPart', timestamp: 1 });
      bridge.applyHarnessEvent({ type: 'ToolCall', timestamp: 1 });
      bridge.applyHarnessEvent({ type: 'ToolResult', timestamp: 1 });

      expect(appliedEvents).toHaveLength(0);
    });
  });

});
