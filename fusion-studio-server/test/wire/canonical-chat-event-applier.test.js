/**
 * Canonical Chat Event Applier Tests
 *
 * Behavior-preserving extraction from message-router.js (Slice G).
 */

const { createCanonicalChatEventApplier } = require('../../lib/wire/canonical-chat-event-applier');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');

describe('CanonicalChatEventApplier', () => {
  let session;
  let emittedEvents;
  let touchCount;
  let persistCalls;
  let applier;
  let mockWs;
  let turnIdCounter;

  function makeSession() {
    return {
      currentThreadId: 'thread-1',
      currentWorkspaceId: 'code',
      pendingUserInput: null,
      currentTurn: null,
      hasToolCalls: false,
      assistantParts: [],
      toolArgs: {},
      activeToolId: null,
      contextUsage: null,
      tokenUsage: null,
      messageId: null,
      planMode: false,
    };
  }

  function emit(type, payload) {
    emittedEvents.push({ type, payload });
  }

  function resolveWorkspace(s) {
    if (s.currentScope === 'view' && s.currentViewId) {
      return `workspace:${s.currentWorkspaceId}, ${s.currentViewId}`;
    }
    return `workspace:${s.currentWorkspaceId}`;
  }

  function touchThreadSession() {
    touchCount++;
  }

  async function persistAssistantMessage(ws, content, hasToolCalls, metadata, explicitThreadId) {
    persistCalls.push({ ws, content, hasToolCalls, metadata, explicitThreadId });
  }

  function checkSettingsBounce(toolName, args) {
    if (toolName === 'write' && args.file_path?.startsWith('settings/')) {
      return { message: 'Write to settings/ is not allowed' };
    }
    return null;
  }

  function generateTurnId() {
    turnIdCounter++;
    return `turn-${turnIdCounter}`;
  }

  beforeEach(() => {
    threadRuntimeManager.runtimes.clear();
    session = makeSession();
    emittedEvents = [];
    touchCount = 0;
    persistCalls = [];
    turnIdCounter = 0;
    mockWs = { readyState: 1 };

    applier = createCanonicalChatEventApplier({
      session,
      emit,
      resolveWorkspace,
      touchThreadSession,
      persistAssistantMessage,
      checkSettingsBounce,
      generateTurnId,
    });
  });

  // ─── turn_begin ───────────────────────────────────────────────────────

  describe('turn_begin', () => {
    test('uses pending user input fallback and emits chat:turn_begin', () => {
      session.pendingUserInput = 'Hello AI';

      applier.applyChatEvent({
        type: 'turn_begin',
        payload: {}
      }, mockWs);

      expect(touchCount).toBe(1);
      expect(session.currentTurn).toEqual({
        id: 'turn-1',
        text: '',
        userInput: 'Hello AI',
        attachments: [],
      });
      expect(session.pendingUserInput).toBeNull();
      expect(session.hasToolCalls).toBe(false);
      expect(session.assistantParts).toEqual([]);

      const event = emittedEvents.find(e => e.type === 'chat:turn_begin');
      expect(event).toBeDefined();
      expect(event.payload).toMatchObject({
        workspace: 'workspace:code',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        userInput: 'Hello AI'
      });

      const liveTurn = threadRuntimeManager.getLiveTurn({
        workspaceId: 'code',
        scope: 'project',
        threadId: 'thread-1',
      });
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
      });
    });

    test('uses payload user_input when present', () => {
      applier.applyChatEvent({
        type: 'turn_begin',
        payload: { userInput: 'Direct input' }
      }, mockWs);

      expect(session.currentTurn.userInput).toBe('Direct input');
    });

    test('ignores empty turn_begin without pending input', () => {
      applier.applyChatEvent({
        type: 'turn_begin',
        payload: {}
      }, mockWs);

      expect(session.currentTurn).toBeNull();
      expect(emittedEvents.filter(e => e.type === 'chat:turn_begin')).toHaveLength(0);
    });
  });

  // ─── content ──────────────────────────────────────────────────────────

  describe('content', () => {
    beforeEach(() => {
      session.pendingUserInput = 'Hi';
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs);
      emittedEvents = []; // reset
      touchCount = 0;
    });

    test('consecutive content events merge in assistantParts', () => {
      applier.applyChatEvent({ type: 'content', payload: { text: 'Hello ' } }, mockWs);
      applier.applyChatEvent({ type: 'content', payload: { text: 'world' } }, mockWs);

      expect(session.assistantParts).toHaveLength(1);
      expect(session.assistantParts[0]).toEqual({
        type: 'text',
        content: 'Hello world'
      });
      expect(session.currentTurn.text).toBe('Hello world');

      const events = emittedEvents.filter(e => e.type === 'chat:content');
      expect(events).toHaveLength(2);
      expect(events[0].payload.scope).toBe('project');
      expect(events[0].payload.text).toBe('Hello ');
      expect(events[1].payload.text).toBe('world');

      const liveTurn = threadRuntimeManager.getLiveTurn({
        workspaceId: 'code',
        scope: 'project',
        threadId: 'thread-1',
      });
      expect(liveTurn.fullText).toBe('Hello world');
      expect(liveTurn.parts).toEqual([{ type: 'text', content: 'Hello world' }]);
    });

    test('content after think starts new text part', () => {
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Hmm...' } }, mockWs);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Result' } }, mockWs);

      expect(session.assistantParts).toHaveLength(2);
      expect(session.assistantParts[0].type).toBe('think');
      expect(session.assistantParts[1].type).toBe('text');
    });
  });

  // ─── thinking ─────────────────────────────────────────────────────────

  describe('thinking', () => {
    beforeEach(() => {
      session.pendingUserInput = 'Hi';
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs);
      emittedEvents = [];
      touchCount = 0;
    });

    test('thinking events stay separate from text', () => {
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Thinking 1' } }, mockWs);
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Thinking 2' } }, mockWs);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Text 1' } }, mockWs);
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Thinking 3' } }, mockWs);

      expect(session.assistantParts).toHaveLength(3);
      expect(session.assistantParts[0]).toEqual({ type: 'think', content: 'Thinking 1Thinking 2' });
      expect(session.assistantParts[1]).toEqual({ type: 'text', content: 'Text 1' });
      expect(session.assistantParts[2]).toEqual({ type: 'think', content: 'Thinking 3' });

      const liveTurn = threadRuntimeManager.getLiveTurn({
        workspaceId: 'code',
        scope: 'project',
        threadId: 'thread-1',
      });
      expect(liveTurn.parts).toEqual([
        { type: 'think', content: 'Thinking 1Thinking 2' },
        { type: 'text', content: 'Text 1' },
        { type: 'think', content: 'Thinking 3' },
      ]);
    });

    test('emits chat:thinking', () => {
      applier.applyChatEvent({ type: 'thinking', payload: { text: 'Deep thought' } }, mockWs);

      const event = emittedEvents.find(e => e.type === 'chat:thinking');
      expect(event).toBeDefined();
      expect(event.payload.scope).toBe('project');
      expect(event.payload.text).toBe('Deep thought');
    });
  });

  // ─── tool_call ────────────────────────────────────────────────────────

  describe('tool_call', () => {
    beforeEach(() => {
      session.pendingUserInput = 'Run tool';
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs);
      emittedEvents = [];
      touchCount = 0;
    });

    test('creates a persisted tool part and emits chat:tool_call', () => {
      applier.applyChatEvent({
        type: 'tool_call',
        payload: { toolCallId: 'tc-1', toolName: 'Bash' }
      }, mockWs);

      expect(session.hasToolCalls).toBe(true);
      expect(session.activeToolId).toBe('tc-1');
      expect(session.toolArgs['tc-1']).toBe('');

      expect(session.assistantParts).toHaveLength(1);
      expect(session.assistantParts[0]).toMatchObject({
        type: 'tool_call',
        toolCallId: 'tc-1',
        name: 'Bash',
        arguments: {},
        result: {
          output: '',
          display: [],
          isError: false
        }
      });

      const event = emittedEvents.find(e => e.type === 'chat:tool_call');
      expect(event).toBeDefined();
      expect(event.payload).toMatchObject({
        scope: 'project',
        toolName: 'Bash',
        toolCallId: 'tc-1'
      });

      const liveTurn = threadRuntimeManager.getLiveTurn({
        workspaceId: 'code',
        scope: 'project',
        threadId: 'thread-1',
      });
      expect(liveTurn.parts[0]).toMatchObject({
        type: 'tool_call',
        toolCallId: 'tc-1',
        name: 'Bash',
        arguments: {},
      });
    });
  });

  // ─── tool_call_args ───────────────────────────────────────────────────

  describe('tool_call_args', () => {
    beforeEach(() => {
      session.pendingUserInput = 'Run tool';
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs);
      applier.applyChatEvent({
        type: 'tool_call',
        payload: { toolCallId: 'tc-1', toolName: 'Bash' }
      }, mockWs);
      emittedEvents = [];
      touchCount = 0;
    });

    test('accumulates and emits chat:tool_call_args', () => {
      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-1', argsChunk: '{"cmd": "ls"}' }
      }, mockWs);
      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-1', argsChunk: ' -la' }
      }, mockWs);

      expect(session.toolArgs['tc-1']).toBe('{"cmd": "ls"} -la');

      const events = emittedEvents.filter(e => e.type === 'chat:tool_call_args');
      expect(events).toHaveLength(2);
      expect(events[0].payload.scope).toBe('project');
      expect(events[0].payload.argsChunk).toBe('{"cmd": "ls"}');
      expect(events[1].payload.argsChunk).toBe(' -la');
    });
  });

  // ─── tool_result ──────────────────────────────────────────────────────

  describe('tool_result', () => {
    beforeEach(() => {
      session.pendingUserInput = 'Run tool';
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs);
      applier.applyChatEvent({
        type: 'tool_call',
        payload: { toolCallId: 'tc-1', toolName: 'Bash' }
      }, mockWs);
      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-1', argsChunk: '{"cmd": "echo hello"}' }
      }, mockWs);
      emittedEvents = [];
      touchCount = 0;
    });

    test('parses args, updates persisted part, and emits current bus payload fields', () => {
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
            files: []
          }
        }
      }, mockWs);

      // Persisted part updated
      const part = session.assistantParts[0];
      expect(part.arguments).toEqual({ cmd: 'echo hello' });
      expect(part.result).toMatchObject({
        output: 'hello',
        statusMessage: 'Done',
        isError: false,
        returnedDiff: false
      });

      // Bus event uses current payload names
      const event = emittedEvents.find(e => e.type === 'chat:tool_result');
      expect(event).toBeDefined();
      expect(event.payload).toMatchObject({
        scope: 'project',
        toolCallId: 'tc-1',
        toolName: 'Bash',
        toolArgs: { cmd: 'echo hello' },
        toolOutput: 'hello',
        toolStatus: 'Done',
        toolDisplay: [{ type: 'text', text: 'hello' }],
        returnedDiff: false,
        isError: false
      });

      const liveTurn = threadRuntimeManager.getLiveTurn({
        workspaceId: 'code',
        scope: 'project',
        threadId: 'thread-1',
      });
      expect(liveTurn.parts[0]).toMatchObject({
        type: 'tool_call',
        toolCallId: 'tc-1',
        arguments: { cmd: 'echo hello' },
        result: {
          output: 'hello',
          statusMessage: 'Done',
          isError: false,
          returnedDiff: false,
        },
      });
    });

    test('handles result without statusMessage', () => {
      applier.applyChatEvent({
        type: 'tool_result',
        payload: {
          toolCallId: 'tc-1',
          toolName: 'Bash',
          result: {
            output: 'output-only',
            display: [],
            returnedDiff: false,
            isError: false
          }
        }
      }, mockWs);

      const event = emittedEvents.find(e => e.type === 'chat:tool_result');
      expect(event.payload.toolStatus).toBeUndefined();
    });

    test('bounced tool_result emits system:tool_bounced and error chat:tool_result', () => {
      // Re-setup with a settings write
      session.assistantParts = [];
      session.toolArgs = {};
      applier.applyChatEvent({
        type: 'tool_call',
        payload: { toolCallId: 'tc-2', toolName: 'write' }
      }, mockWs);
      applier.applyChatEvent({
        type: 'tool_call_args',
        payload: { toolCallId: 'tc-2', argsChunk: '{"file_path": "settings/config.json"}' }
      }, mockWs);
      emittedEvents = [];

      applier.applyChatEvent({
        type: 'tool_result',
        payload: {
          toolCallId: 'tc-2',
          toolName: 'write',
          result: {
            output: 'would write',
            display: [],
            returnedDiff: false,
            isError: false
          }
        }
      }, mockWs);

      const bounced = emittedEvents.find(e => e.type === 'system:tool_bounced');
      expect(bounced).toBeDefined();
      expect(bounced.payload.reason).toBe('Write to settings/ is not allowed');

      const toolResult = emittedEvents.find(e => e.type === 'chat:tool_result');
      expect(toolResult).toBeDefined();
      expect(toolResult.payload.scope).toBe('project');
      expect(toolResult.payload.isError).toBe(true);
      expect(toolResult.payload.toolOutput).toBe('Write to settings/ is not allowed');
      expect(toolResult.payload.returnedDiff).toBe(false);
    });
  });

  // ─── subagent_event ───────────────────────────────────────────────────

  describe('subagent_event', () => {
    test('emits chat:subagent_event', () => {
      applier.applyChatEvent({
        type: 'subagent_event',
        payload: {
          parentToolCallId: 'tc-1',
          agentId: 'agent-1',
          subagentType: 'planner',
          subagentEventType: 'plan_step',
          subagentPayload: { step: 1 }
        }
      }, mockWs);

      const event = emittedEvents.find(e => e.type === 'chat:subagent_event');
      expect(event).toBeDefined();
      expect(event.payload).toMatchObject({
        scope: 'project',
        parentToolCallId: 'tc-1',
        agentId: 'agent-1',
        subagentType: 'planner',
        eventType: 'plan_step',
        eventPayload: { step: 1 }
      });
    });

    test('calls touchThreadSession to keep session alive', () => {
      applier.applyChatEvent({
        type: 'subagent_event',
        payload: {
          parentToolCallId: 'tc-1',
          agentId: 'agent-1',
          subagentType: 'task',
          subagentEventType: 'TurnBegin',
          subagentPayload: {}
        }
      }, mockWs);

      expect(touchCount).toBe(1);
    });
  });

  // ─── status_update ────────────────────────────────────────────────────

  describe('status_update', () => {
    test('stores metadata and emits chat:status_update', () => {
      applier.applyChatEvent({
        type: 'status_update',
        payload: {
          contextUsage: 42,
          tokenUsage: { input_other: 100, output: 50 },
          messageId: 'msg-1',
          planMode: true
        }
      }, mockWs);

      expect(touchCount).toBe(1);
      expect(session.contextUsage).toBe(42);
      expect(session.tokenUsage).toEqual({ input_other: 100, output: 50 });
      expect(session.messageId).toBe('msg-1');
      expect(session.planMode).toBe(true);

      const event = emittedEvents.find(e => e.type === 'chat:status_update');
      expect(event).toBeDefined();
      expect(event.payload).toMatchObject({
        scope: 'project',
        contextUsage: 42,
        tokenUsage: { input_other: 100, output: 50 },
        messageId: 'msg-1',
        planMode: true
      });
    });
  });

  // ─── turn_end ─────────────────────────────────────────────────────────

  describe('turn_end', () => {
    beforeEach(() => {
      session.pendingUserInput = 'Hi';
      applier.applyChatEvent({ type: 'turn_begin', payload: {} }, mockWs);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Hello' } }, mockWs);
      emittedEvents = [];
    });

    test('calls assistant-message persistence, emits chat:turn_end with parts, then resets turn state', async () => {
      // Set some metadata via status_update
      applier.applyChatEvent({
        type: 'status_update',
        payload: {
          contextUsage: 10,
          tokenUsage: { output: 5 },
          messageId: 'msg-end',
          planMode: false
        }
      }, mockWs);
      emittedEvents = [];

      await applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs);

      // Persistence called
      expect(persistCalls).toHaveLength(1);
      expect(persistCalls[0]).toMatchObject({
        ws: mockWs,
        content: 'Hello',
        hasToolCalls: false,
        explicitThreadId: 'thread-1'
      });
      expect(persistCalls[0].metadata).toMatchObject({
        contextUsage: 10,
        tokenUsage: { output: 5 },
        messageId: 'msg-end',
        planMode: false,
        reason: 'complete',
        partial: false
      });

      // Event emitted
      const event = emittedEvents.find(e => e.type === 'chat:turn_end');
      expect(event).toBeDefined();
      expect(event.payload).toMatchObject({
        workspace: 'workspace:code',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        fullText: 'Hello',
        hasToolCalls: false,
        userInput: 'Hi',
        reason: 'complete',
        partial: false
      });
      expect(event.payload.parts).toHaveLength(1);
      expect(event.payload.parts[0]).toEqual({ type: 'text', content: 'Hello' });

      // Turn state reset
      expect(session.currentTurn).toBeNull();
      expect(session.assistantParts).toEqual([]);
      expect(session.contextUsage).toBeNull();
      expect(session.tokenUsage).toBeNull();
      expect(session.messageId).toBeNull();
      expect(session.planMode).toBe(false);

      const liveTurn = threadRuntimeManager.getLiveTurn({
        workspaceId: 'code',
        scope: 'project',
        threadId: 'thread-1',
      });
      expect(liveTurn.status).toBe('complete');
      expect(liveTurn.fullText).toBe('Hello');
    });

    test('no-op when there is no current turn', async () => {
      session.currentTurn = null;
      await applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs);

      expect(persistCalls).toHaveLength(0);
      expect(emittedEvents.filter(e => e.type === 'chat:turn_end')).toHaveLength(0);
    });

    test('interrupted turn_end emits terminal metadata and preserves partial parts', async () => {
      await applier.applyChatEvent({
        type: 'turn_end',
        payload: { reason: 'interrupted', partial: true },
      }, mockWs);

      expect(persistCalls).toHaveLength(1);
      expect(persistCalls[0].content).toBe('Hello');
      expect(persistCalls[0].explicitThreadId).toBe('thread-1');
      expect(persistCalls[0].metadata).toMatchObject({
        reason: 'interrupted',
        partial: true,
      });

      const event = emittedEvents.find(e => e.type === 'chat:turn_end');
      expect(event.payload).toMatchObject({
        threadId: 'thread-1',
        scope: 'project',
        userInput: 'Hi',
        fullText: 'Hello',
        reason: 'interrupted',
        partial: true,
      });
      expect(event.payload.parts).toEqual([{ type: 'text', content: 'Hello' }]);

      const liveTurn = threadRuntimeManager.getLiveTurn({
        workspaceId: 'code',
        scope: 'project',
        threadId: 'thread-1',
      });
      expect(liveTurn.status).toBe('interrupted');
    });

    test('Runtime-1R: persists to session.currentThreadId even after passive browse changes selection state', async () => {
      // Simulate: thread A is in flight
      session.currentThreadId = 'thread-A';
      applier.applyChatEvent({ type: 'turn_begin', payload: { userInput: 'Hello A' } }, mockWs);
      applier.applyChatEvent({ type: 'content', payload: { text: 'Reply from A' } }, mockWs);
      emittedEvents = [];

      // Simulate passive browse to B: the wsState selection changes, but
      // session.currentThreadId (the wire's identity) stays A.
      // In the old code, addAssistantMessage would read wsState and hit B.
      // With the fix, handleTurnEnd captures session.currentThreadId explicitly.
      await applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs);

      // Persistence must receive the in-flight thread identity explicitly
      expect(persistCalls).toHaveLength(1);
      expect(persistCalls[0].explicitThreadId).toBe('thread-A');
      expect(persistCalls[0].content).toBe('Reply from A');

      // Emitted event must carry the same captured identity
      const event = emittedEvents.find(e => e.type === 'chat:turn_end');
      expect(event).toBeDefined();
      expect(event.payload.threadId).toBe('thread-A');
    });

    test('emits turn_end and resets even when assistant-message persistence rejects', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      applier = createCanonicalChatEventApplier({
        session,
        emit,
        resolveWorkspace,
        touchThreadSession,
        persistAssistantMessage: () => Promise.reject(new Error('persist failed')),
        checkSettingsBounce,
        generateTurnId,
      });

      applier.applyChatEvent({ type: 'turn_end', payload: {} }, mockWs);
      await Promise.resolve();

      expect(emittedEvents.some(e => e.type === 'chat:turn_end')).toBe(true);
      expect(session.currentTurn).toBeNull();
      expect(session.assistantParts).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ─── unknown canonical event ──────────────────────────────────────────

  test('ignores unknown canonical event types', () => {
    applier.applyChatEvent({ type: 'unknown_event', payload: {} }, mockWs);
    expect(emittedEvents).toHaveLength(0);
    expect(touchCount).toBe(0);
  });
});
