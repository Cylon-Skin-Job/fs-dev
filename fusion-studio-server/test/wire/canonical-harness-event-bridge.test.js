/**
 * Canonical Harness Event Bridge Tests
 *
 * Tests the direct bridge from flat CanonicalEvent objects to the
 * { type, payload } shape consumed by canonical-chat-event-applier.
 */

const { createCanonicalHarnessEventBridge } = require('../../lib/wire/canonical-harness-event-bridge');

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

  describe('event mappings', () => {
    test('maps turn_begin', () => {
      bridge.applyHarnessEvent({
        type: 'turn_begin',
        timestamp: 1,
        userInput: 'Hello AI'
      });

      expect(appliedEvents).toHaveLength(1);
      expect(appliedEvents[0].event).toEqual({
        type: 'turn_begin',
        payload: { userInput: 'Hello AI' }
      });
    });

    test('maps content', () => {
      bridge.applyHarnessEvent({
        type: 'content',
        timestamp: 1,
        text: 'Hello world'
      });

      expect(appliedEvents[0].event).toEqual({
        type: 'content',
        payload: { text: 'Hello world' }
      });
    });

    test('maps thinking', () => {
      bridge.applyHarnessEvent({
        type: 'thinking',
        timestamp: 1,
        text: 'Deep thought'
      });

      expect(appliedEvents[0].event).toEqual({
        type: 'thinking',
        payload: { text: 'Deep thought' }
      });
    });

    test('maps tool_call with canonical tool name', () => {
      bridge.applyHarnessEvent({
        type: 'tool_call',
        timestamp: 1,
        toolCallId: 'tc-1',
        toolName: 'shell'
      });

      expect(appliedEvents[0].event).toEqual({
        type: 'tool_call',
        payload: { toolCallId: 'tc-1', toolName: 'shell' }
      });
    });

    test('maps tool_call_args', () => {
      bridge.applyHarnessEvent({
        type: 'tool_call_args',
        timestamp: 1,
        toolCallId: 'tc-1',
        argsChunk: '{"cmd": "ls"}'
      });

      expect(appliedEvents[0].event).toEqual({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-1', argsChunk: '{"cmd": "ls"}' }
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

      expect(appliedEvents[0].event).toEqual({
        type: 'tool_result',
        payload: {
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

      expect(appliedEvents[0].event).toEqual({
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

      expect(appliedEvents[0].event).toEqual({
        type: 'status_update',
        payload: {
          contextUsage: 42,
          tokenUsage: { input_other: 100, output: 50 },
          messageId: 'msg-1',
          planMode: true
        }
      });
    });

    test('maps turn_end', () => {
      bridge.applyHarnessEvent({
        type: 'turn_end',
        timestamp: 1,
        turnId: 'turn-1'
      });

      expect(appliedEvents[0].event).toEqual({
        type: 'turn_end',
        payload: {}
      });
    });

    // ─── SPEC-02 Slice B: step_begin passthrough ───────────────────────

    test('maps step_begin preserving timestamp/stepId/messageId verbatim', () => {
      bridge.applyHarnessEvent({
        type: 'step_begin',
        timestamp: 1724600000000,
        stepId: 'step-abc',
        messageId: 'msg-123'
      });

      expect(appliedEvents).toHaveLength(1);
      expect(appliedEvents[0].event).toStrictEqual({
        type: 'step_begin',
        payload: {
          timestamp: 1724600000000,
          stepId: 'step-abc',
          messageId: 'msg-123'
        }
      });
    });

    test('forwards a native timestamp UNCHANGED — no rounding, renaming, or synthesis', () => {
      bridge.applyHarnessEvent({ type: 'step_begin', timestamp: 946684800001 });

      const payload = appliedEvents[0].event.payload;
      expect(payload.timestamp).toBe(946684800001);
      expect(payload.startedAt).toBeUndefined(); // bridge must not rename
    });

    test('absent keys stay absent-valued (undefined) with no invented values', () => {
      bridge.applyHarnessEvent({ type: 'step_begin' });

      expect(appliedEvents).toHaveLength(1);
      const payload = appliedEvents[0].event.payload;
      expect(payload.timestamp).toBeUndefined();
      expect(payload.stepId).toBeUndefined();
      expect(payload.messageId).toBeUndefined();
      // Exactly the three contracted keys — nothing invented for missing ones.
      expect(Object.keys(payload).sort()).toEqual(['messageId', 'stepId', 'timestamp']);
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

    test('routes canonical step_begin as a chat event, never to onNonChatEvent', () => {
      const onNonChatEvent = jest.fn();
      const guardedBridge = createCanonicalHarnessEventBridge({
        applyChatEvent: mockApplier.applyChatEvent,
        onNonChatEvent,
      });

      guardedBridge.applyHarnessEvent({ type: 'step_begin', stepId: 's1' });

      expect(appliedEvents).toHaveLength(1);
      expect(onNonChatEvent).not.toHaveBeenCalled();
    });
  });

  // ─── SPEC-01 Slice C: drain context + bind-once ──────────────────────

  describe('drain context pass-through and bind-once', () => {
    const DRAIN = { route: { threadId: 'thread-1' }, control: { drainId: 'drain-1' } };

    function makeBridge(applierResult, bindDrainTurn) {
      const applied = [];
      const bridgeWithBind = createCanonicalHarnessEventBridge({
        applyChatEvent: (event, ws, drainContext) => {
          applied.push({ event, ws, drainContext });
          return typeof applierResult === 'function' ? applierResult(event) : applierResult;
        },
        bindDrainTurn,
      });
      return { applied, bridgeWithBind };
    }

    test('every mapped event carries the drain context through to the applier', () => {
      const { applied, bridgeWithBind } = makeBridge(undefined, jest.fn());

      const events = [
        { type: 'turn_begin', userInput: 'Hi' },
        { type: 'step_begin', timestamp: 1724600000000, stepId: 's1' },
        { type: 'content', text: 'x' },
        { type: 'thinking', text: 'y' },
        { type: 'tool_call', toolCallId: 'tc-1', toolName: 'Bash' },
        { type: 'tool_call_args', toolCallId: 'tc-1', argsChunk: '{}' },
        { type: 'tool_result', toolCallId: 'tc-1' },
        { type: 'subagent_event', agentId: 'a1' },
        { type: 'status_update', messageId: 'm1' },
        { type: 'turn_end', reason: 'complete' },
      ];
      for (const event of events) {
        bridgeWithBind.applyHarnessEvent(event, null, DRAIN);
      }

      expect(applied).toHaveLength(events.length);
      for (const entry of applied) {
        expect(entry.drainContext).toBe(DRAIN);
      }
    });

    test('binds the returned server turnId exactly once on an accepted begin', () => {
      const bindDrainTurn = jest.fn(() => true);
      const { bridgeWithBind } = makeBridge(
        () => ({ accepted: true, turnId: 'server-turn-1' }),
        bindDrainTurn
      );

      bridgeWithBind.applyHarnessEvent({ type: 'turn_begin', userInput: 'Hi' }, null, DRAIN);

      expect(bindDrainTurn).toHaveBeenCalledTimes(1);
      expect(bindDrainTurn).toHaveBeenCalledWith(DRAIN, 'server-turn-1');
    });

    test('never binds a rejected begin', () => {
      const bindDrainTurn = jest.fn();
      const { bridgeWithBind } = makeBridge(
        () => ({ accepted: false }),
        bindDrainTurn
      );

      bridgeWithBind.applyHarnessEvent({ type: 'turn_begin', userInput: '' }, null, DRAIN);

      expect(bindDrainTurn).not.toHaveBeenCalled();
    });

    test('does not bind when there is no drain context or no turnId', () => {
      const bindDrainTurn = jest.fn();
      const acceptedNoId = makeBridge(() => ({ accepted: true, turnId: 'turn-x' }), bindDrainTurn);
      acceptedNoId.bridgeWithBind.applyHarnessEvent({ type: 'turn_begin' }, null, undefined);
      expect(acceptedNoId.applied[0].drainContext).toBeUndefined();
      expect(bindDrainTurn).not.toHaveBeenCalled();

      const noTurnId = makeBridge(() => ({ accepted: true }), bindDrainTurn);
      noTurnId.bridgeWithBind.applyHarnessEvent({ type: 'turn_begin' }, null, DRAIN);
      expect(bindDrainTurn).not.toHaveBeenCalled();

      const spurious = makeBridge(() => undefined, bindDrainTurn);
      spurious.bridgeWithBind.applyHarnessEvent({ type: 'turn_begin' }, null, DRAIN);
      expect(bindDrainTurn).not.toHaveBeenCalled();
    });

    test('works without a bindDrainTurn dep (no-drain composition stays byte-compatible)', () => {
      const legacyBridge = createCanonicalHarnessEventBridge({
        applyChatEvent: mockApplier.applyChatEvent,
      });

      legacyBridge.applyHarnessEvent({
        type: 'turn_begin',
        userInput: 'Hi',
      });

      expect(appliedEvents[0].event).toEqual({
        type: 'turn_begin',
        payload: { userInput: 'Hi' },
      });
    });

    test('drainHarnessEvents passes options.drainContext per event', async () => {
      const { applied, bridgeWithBind } = makeBridge(undefined, jest.fn());

      async function* generateEvents() {
        yield { type: 'content', timestamp: 1, text: 'Hello' };
        yield { type: 'turn_end', timestamp: 2 };
      }

      await bridgeWithBind.drainHarnessEvents(generateEvents(), null, { drainContext: DRAIN });

      expect(applied).toHaveLength(2);
      expect(applied.every(entry => entry.drainContext === DRAIN)).toBe(true);
    });
  });
});
