/**
 * Wire Broadcaster Tests (RCC-0108 SPEC-02 Slice D / SPEC §5)
 *
 * Bus → wire mapping for every in-flight chat:* shape: each outbound wire
 * message carries scope + threadId + turnId + streamSeq (1:1 from the bus
 * payload), content/thinking/tool_call/turn_end also carry activityRevision,
 * step_begin maps its identity/startedAt/revision fields, drop paths stay
 * non-throwing, and the post-terminal acknowledgement family remains
 * UNCHANGED (no streamSeq).
 *
 * The broadcaster subscribes to the process-wide event-bus singleton, so each
 * test gets a fresh module registry (resetModules) — no listener leakage.
 */

describe('WireBroadcaster', () => {
  let emit;
  let clientWs;
  let sent;

  /**
   * Fresh event-bus + wire-broadcaster pair per test; a single registered
   * client ws captures everything JSON.stringify would actually put on the
   * wire (so undefined fields are provably absent, not merely null).
   */
  function startBroadcaster({ getClientForThread } = {}) {
    jest.resetModules();
    ({ emit } = require('../../lib/event-bus'));
    const { createWireBroadcaster } = require('../../lib/wire/wire-broadcaster');
    clientWs = {
      readyState: 1,
      send: jest.fn((raw) => sent.push(JSON.parse(raw))),
    };
    sent = [];
    createWireBroadcaster({
      getClientForThread: getClientForThread || (() => clientWs),
    });
  }

  function emitAndCapture(type, payload) {
    emit(type, payload);
    expect(sent).toHaveLength(1);
    return sent[0];
  }

  const BASE = { scope: 'project', threadId: 'thread-1', turnId: 'turn-9', streamSeq: 4 };

  // ─── in-flight shapes ────────────────────────────────────────────────

  test('turn_begin maps scope/threadId/turnId/streamSeq + userInput', () => {
    startBroadcaster();

    expect(emitAndCapture('chat:turn_begin', {
      ...BASE, userInput: 'Hello', attachments: [{ kind: 'file' }],
    })).toEqual({
      type: 'turn_begin',
      scope: 'project',
      threadId: 'thread-1',
      turnId: 'turn-9',
      streamSeq: 4,
      userInput: 'Hello',
    });
  });

  test('step_begin maps identity/startedAt/activityRevision and preserves optional ids only when present', () => {
    startBroadcaster();

    const full = emitAndCapture('chat:step_begin', {
      ...BASE,
      identity: 'step:s1',
      stepId: 's1',
      messageId: 'm1',
      startedAt: 1724600000000,
      activityRevision: 3,
    });
    expect(full).toEqual({
      type: 'step_begin',
      scope: 'project',
      threadId: 'thread-1',
      turnId: 'turn-9',
      streamSeq: 4,
      identity: 'step:s1',
      stepId: 's1',
      messageId: 'm1',
      startedAt: 1724600000000,
      activityRevision: 3,
    });

    sent = [];
    const minimal = emitAndCapture('chat:step_begin', {
      ...BASE,
      identity: 'time:1724600000000',
      startedAt: 1724600000000,
      activityRevision: 3,
    });
    expect(minimal).toEqual({
      type: 'step_begin',
      scope: 'project',
      threadId: 'thread-1',
      turnId: 'turn-9',
      streamSeq: 4,
      identity: 'time:1724600000000',
      startedAt: 1724600000000,
      activityRevision: 3,
    }); // no stepId/messageId keys invented
  });

  test('content maps streamSeq + activityRevision + text verbatim', () => {
    startBroadcaster();

    expect(emitAndCapture('chat:content', { ...BASE, activityRevision: 2, text: 'Hi' }))
      .toEqual({
        type: 'content',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-9',
        streamSeq: 4,
        activityRevision: 2,
        text: 'Hi',
      });
  });

  test('thinking maps streamSeq + activityRevision + text verbatim', () => {
    startBroadcaster();

    expect(emitAndCapture('chat:thinking', { ...BASE, activityRevision: 5, text: 'Hmm' }))
      .toEqual({
        type: 'thinking',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-9',
        streamSeq: 4,
        activityRevision: 5,
        text: 'Hmm',
      });
  });

  test('tool_call maps streamSeq + activityRevision + tool identity', () => {
    startBroadcaster();

    expect(emitAndCapture('chat:tool_call', {
      ...BASE, activityRevision: 2, toolName: 'Bash', toolCallId: 'tc-1',
    })).toEqual({
      type: 'tool_call',
      scope: 'project',
      threadId: 'thread-1',
      toolName: 'Bash',
      toolCallId: 'tc-1',
      turnId: 'turn-9',
      streamSeq: 4,
      activityRevision: 2,
    });
  });

  test('tool_call_args maps streamSeq + buffered chunk', () => {
    startBroadcaster();

    expect(emitAndCapture('chat:tool_call_args', {
      ...BASE, toolCallId: 'tc-1', argsChunk: '{"cmd"',
    })).toEqual({
      type: 'tool_call_args',
      scope: 'project',
      threadId: 'thread-1',
      toolCallId: 'tc-1',
      argsChunk: '{"cmd"',
      turnId: 'turn-9',
      streamSeq: 4,
    });
  });

  test('tool_result maps streamSeq + result fields (no activityRevision — results never move Working)', () => {
    startBroadcaster();

    expect(emitAndCapture('chat:tool_result', {
      ...BASE,
      toolCallId: 'tc-1',
      toolArgs: { cmd: 'ls' },
      toolOutput: 'files',
      toolStatus: 'Done',
      toolDisplay: [{ type: 'text', text: 'files' }],
      returnedDiff: false,
      isError: false,
    })).toEqual({
      type: 'tool_result',
      scope: 'project',
      threadId: 'thread-1',
      toolCallId: 'tc-1',
      toolArgs: { cmd: 'ls' },
      toolOutput: 'files',
      toolStatus: 'Done',
      toolDisplay: [{ type: 'text', text: 'files' }],
      returnedDiff: false,
      isError: false,
      turnId: 'turn-9',
      streamSeq: 4,
    });
  });

  test('subagent_event maps streamSeq + subagent projection fields', () => {
    startBroadcaster();

    expect(emitAndCapture('chat:subagent_event', {
      ...BASE,
      parentToolCallId: 'tc-1',
      agentId: 'a-1',
      subagentType: 'planner',
      eventType: 'plan_step',
      eventPayload: { step: 1 },
    })).toEqual({
      type: 'subagent_event',
      scope: 'project',
      threadId: 'thread-1',
      turnId: 'turn-9',
      streamSeq: 4,
      parentToolCallId: 'tc-1',
      agentId: 'a-1',
      subagentType: 'planner',
      subagentEventType: 'plan_step',
      subagentPayload: { step: 1 },
    });
  });

  test('turn_end maps streamSeq + activityRevision + terminal assembly', () => {
    startBroadcaster();

    const parts = [{ type: 'text', content: 'Body' }];
    expect(emitAndCapture('chat:turn_end', {
      ...BASE,
      activityRevision: 2,
      fullText: 'Body',
      hasToolCalls: false,
      userInput: 'Hi',
      parts,
      reason: 'complete',
      partial: false,
    })).toEqual({
      type: 'turn_end',
      scope: 'project',
      threadId: 'thread-1',
      turnId: 'turn-9',
      streamSeq: 4,
      activityRevision: 2,
      fullText: 'Body',
      hasToolCalls: false,
      userInput: 'Hi',
      parts,
      reason: 'complete',
      partial: false,
    });
  });

  test('status_update gains bound turnId + streamSeq on today\'s usage shape', () => {
    startBroadcaster();

    expect(emitAndCapture('chat:status_update', {
      ...BASE,
      contextUsage: 42,
      tokenUsage: { output: 50 },
    })).toEqual({
      type: 'status_update',
      scope: 'project',
      threadId: 'thread-1',
      turnId: 'turn-9',
      streamSeq: 4,
      contextUsage: 42,
      tokenUsage: { output: 50 },
    });
  });

  // ─── SPEC-03 Slice B: error-terminal envelope forwarding ─────────────

  test('error turn_end forwards terminalError + streamSeq + activityRevision 1:1', () => {
    startBroadcaster();

    const terminalError = {
      kind: 'runtime',
      code: 'MODEL_RESPONSE_FAILED',
      message: 'The model response failed before it completed.',
      recoverable: true,
    };
    const parts = [{ type: 'text', content: 'partial' }];
    expect(emitAndCapture('chat:turn_end', {
      ...BASE,
      activityRevision: 1,
      fullText: 'partial',
      hasToolCalls: false,
      userInput: 'Hi',
      parts,
      reason: 'error',
      partial: true,
      terminalError,
    })).toEqual({
      type: 'turn_end',
      scope: 'project',
      threadId: 'thread-1',
      turnId: 'turn-9',
      streamSeq: 4,
      activityRevision: 1,
      fullText: 'partial',
      hasToolCalls: false,
      userInput: 'Hi',
      parts,
      reason: 'error',
      partial: true,
      terminalError,
    });
  });

  test('non-error terminals OMIT the terminalError key entirely (pinned shape)', () => {
    startBroadcaster();

    emitAndCapture('chat:turn_end', {
      ...BASE,
      activityRevision: 2,
      fullText: 'Body',
      hasToolCalls: false,
      userInput: 'Hi',
      parts: [],
      reason: 'complete',
      partial: false,
    });
    expect(Object.keys(sent[0]).sort()).not.toContain('terminalError');

    sent = [];
    emitAndCapture('chat:turn_end', {
      ...BASE,
      activityRevision: 2,
      fullText: 'So far',
      hasToolCalls: false,
      userInput: 'Hi',
      parts: [],
      reason: 'interrupted',
      partial: true,
    });
    expect(Object.keys(sent[0]).sort()).not.toContain('terminalError');
  });

  test('legacy pre-SPEC-40b2 status_update without sequence fields serializes byte-compatibly (undefined keys omitted)', () => {
    startBroadcaster();

    emitAndCapture('chat:status_update', {
      workspace: 'workspace:code',
      scope: 'project',
      threadId: 'thread-1',
      contextUsage: 7,
      tokenUsage: null,
    });

    expect(sent[0]).toEqual({
      type: 'status_update',
      scope: 'project',
      threadId: 'thread-1',
      contextUsage: 7,
      tokenUsage: null,
    });
    expect(Object.keys(sent[0]).sort()).toEqual([
      'contextUsage', 'scope', 'threadId', 'tokenUsage', 'type',
    ]);
  });

  // ─── post-terminal acknowledgement family: UNCHANGED ────────────────

  test.each([
    ['chat:exchange_metadata', 'exchange_metadata'],
    ['chat-turn:saved', 'chat-turn:saved'],
  ])('%s acknowledgements keep their exact shape with no streamSeq even when the bus payload carries one', (busType, wireType) => {
    startBroadcaster();

    emitAndCapture(busType, {
      scope: 'project',
      threadId: 'thread-1',
      turnId: 'turn-9',
      streamSeq: 99, // deliberately present upstream — must NOT forward
      exchangeId: 'ex-1',
      seq: 3,
      ts: 1234,
      partial: false,
      reason: 'complete',
      metadata: {},
      userInput: 'Hi',
    });

    expect(sent[0].type).toBe(wireType);
    expect(sent[0]).not.toHaveProperty('streamSeq');
  });

  // ─── drop paths ──────────────────────────────────────────────────────

  test('drops silently when the thread has no registered client', () => {
    startBroadcaster({ getClientForThread: () => null });

    emit('chat:content', { ...BASE, activityRevision: 1, text: 'x' });

    expect(clientWs.send).not.toHaveBeenCalled();
  });

  test('drops when the client readyState is not OPEN', () => {
    startBroadcaster();
    clientWs.readyState = 2; // CLOSING

    emit('chat:turn_end', { ...BASE, parts: [], activityRevision: 1 });

    expect(clientWs.send).not.toHaveBeenCalled();
  });

  test('drops when ws.send throws (socket failure) instead of crashing the bus listener', () => {
    startBroadcaster();
    clientWs.send = jest.fn(() => { throw new Error('EPIPE'); });

    expect(() => emit('chat:thinking', { ...BASE, activityRevision: 1, text: 'x' })).not.toThrow();
  });
});
