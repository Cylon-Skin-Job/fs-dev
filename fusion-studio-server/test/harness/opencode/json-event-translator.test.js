const {
  OpenCodeJsonEventTranslator,
  mapOpenCodeToolName,
  mapOpenCodeTokenUsage,
} = require('../../../lib/harness/opencode');

describe('OpenCodeJsonEventTranslator', () => {
  it('creates turn_begin from the caller input before draining OpenCode output', () => {
    const translator = new OpenCodeJsonEventTranslator();

    expect(translator.beginTurn('hello', 100)).toEqual({
      type: 'turn_begin',
      timestamp: 100,
      userInput: 'hello',
    });
  });

  it('maps text events to canonical content', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'text',
      timestamp: 1780703411893,
      part: { type: 'text', text: 'OPEN_CODE_JSON_PROBE_OK' },
    });

    expect(events).toEqual([{ type: 'content', timestamp: 1780703411893, text: 'OPEN_CODE_JSON_PROBE_OK' }]);
  });

  it('maps reasoning parts to canonical thinking', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'reasoning',
      timestamp: 1780703411893,
      part: { type: 'reasoning', text: 'checking approach' },
    });

    expect(events).toEqual([{ type: 'thinking', timestamp: 1780703411893, text: 'checking approach' }]);
  });

  it('maps completed tool-use events to call, args, and result', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'tool_use',
      timestamp: 1780703445385,
      part: {
        type: 'tool',
        tool: 'bash',
        callID: 'call_b50fbfe191e94243a66a4733',
        state: {
          status: 'completed',
          input: { command: 'printf OPENCODE_TOOL_PROBE_OK', description: 'Run printf probe command' },
          output: 'OPENCODE_TOOL_PROBE_OK',
          metadata: { output: 'OPENCODE_TOOL_PROBE_OK', exit: 0, description: 'Run printf probe command' },
          title: 'Run printf probe command',
        },
      },
    });

    expect(events).toEqual([
      {
        type: 'tool_call',
        timestamp: 1780703445385,
        toolCallId: 'call_b50fbfe191e94243a66a4733',
        toolName: 'shell',
      },
      {
        type: 'tool_call_args',
        timestamp: 1780703445385,
        toolCallId: 'call_b50fbfe191e94243a66a4733',
        argsChunk: JSON.stringify({ command: 'printf OPENCODE_TOOL_PROBE_OK', description: 'Run printf probe command' }),
      },
      {
        type: 'tool_result',
        timestamp: 1780703445385,
        toolCallId: 'call_b50fbfe191e94243a66a4733',
        toolName: 'shell',
        output: 'OPENCODE_TOOL_PROBE_OK',
        statusMessage: 'Run printf probe command',
        display: [],
        returnedDiff: false,
        isError: false,
        files: [],
      },
    ]);
  });

  it('maps nonzero tool exit to isError true', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'tool_use',
      timestamp: 10,
      part: {
        type: 'tool',
        tool: 'bash',
        callID: 'call_failed',
        state: {
          status: 'completed',
          input: { command: 'false' },
          output: 'failed',
          metadata: { exit: 1, description: 'Run false' },
        },
      },
    });

    expect(events[2]).toMatchObject({ type: 'tool_result', isError: true, output: 'failed' });
  });

  it('suppresses shell status when OpenCode title duplicates the command', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'tool_use',
      timestamp: 10,
      part: {
        type: 'tool',
        tool: 'bash',
        callID: 'call_git_status',
        state: {
          status: 'completed',
          input: { command: 'git status' },
          output: 'fatal: not a git repository (or any of the parent directories): .git\n',
          metadata: { exit: 128 },
          title: 'git status',
        },
      },
    });

    expect(events[2]).toMatchObject({
      type: 'tool_result',
      toolName: 'shell',
      isError: true,
      output: 'fatal: not a git repository (or any of the parent directories): .git\n',
    });
    expect(events[2].statusMessage).toBeUndefined();
  });

  it('emits an exit diagnostic for failed shell calls without output', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'tool_use',
      timestamp: 10,
      part: {
        type: 'tool',
        tool: 'bash',
        callID: 'call_empty_failure',
        state: {
          status: 'completed',
          input: { command: 'false' },
          output: '',
          metadata: { exit: 1 },
          title: 'false',
        },
      },
    });

    expect(events[2]).toMatchObject({
      type: 'tool_result',
      toolName: 'shell',
      isError: true,
      output: '',
      statusMessage: 'Command failed with exit code 1',
    });
  });

  it('defers tool result for incomplete tool states', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'tool_use',
      timestamp: 10,
      part: {
        type: 'tool',
        tool: 'read',
        callID: 'call_reading',
        state: { status: 'running', input: { filePath: '/tmp/example.txt' } },
      },
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.type)).toEqual(['tool_call', 'tool_call_args']);
  });

  it('does not emit turn_end for step_finish reason tool-calls', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'step_finish',
      timestamp: 1780703445403,
      part: {
        type: 'step-finish',
        reason: 'tool-calls',
        messageID: 'msg_e9a323827001HZdY6XtvgSFyvB',
        tokens: { input: 16233, output: 41, cache: { write: 0, read: 1024 } },
      },
    });

    expect(events.map((event) => event.type)).toEqual(['status_update']);
  });

  it('emits status_update and turn_end for final step_finish', () => {
    const translator = new OpenCodeJsonEventTranslator();
    translator.translate({ type: 'text', timestamp: 1, part: { type: 'text', text: 'done' } });

    const events = translator.translate({
      type: 'step_finish',
      timestamp: 1780703411932,
      part: {
        type: 'step-finish',
        reason: 'stop',
        messageID: 'msg_e9a31b49e001gbn38ihqWIjlgS',
        tokens: { total: 23695, input: 38, output: 9, reasoning: 32, cache: { write: 0, read: 23616 } },
      },
    });

    expect(events[0]).toMatchObject({
      type: 'status_update',
      timestamp: 1780703411932,
      messageId: 'msg_e9a31b49e001gbn38ihqWIjlgS',
      tokenUsage: {
        input_other: 38,
        input_cache_read: 23616,
        input_cache_creation: 0,
        output: 9,
      },
    });
    expect(events[1]).toMatchObject({
      type: 'turn_end',
      timestamp: 1780703411932,
      reason: 'stop',
      fullText: 'done',
      hasToolCalls: false,
    });
  });

  it('maps token usage fields from OpenCode tokens', () => {
    expect(mapOpenCodeTokenUsage({ input: 10, output: 5, cache: { read: 3, write: 2 } })).toEqual({
      input_other: 10,
      input_cache_read: 3,
      input_cache_creation: 2,
      output: 5,
    });
  });

  it('ignores unknown event types', () => {
    const translator = new OpenCodeJsonEventTranslator();

    expect(translator.translate({ type: 'unknown_event', timestamp: 1, part: {} })).toEqual([]);
  });

  it('maps OpenCode tool names to current canonical frontend tool names', () => {
    expect(mapOpenCodeToolName('bash')).toBe('shell');
    expect(mapOpenCodeToolName('read')).toBe('read');
    expect(mapOpenCodeToolName('write')).toBe('write');
    expect(mapOpenCodeToolName('edit')).toBe('edit');
    expect(mapOpenCodeToolName('grep')).toBe('grep');
    expect(mapOpenCodeToolName('glob')).toBe('glob');
    expect(mapOpenCodeToolName('webfetch')).toBe('fetch');
    expect(mapOpenCodeToolName('websearch')).toBe('search');
    expect(mapOpenCodeToolName('todowrite')).toBe('todo');
    expect(mapOpenCodeToolName('task')).toBe('subagent');
  });

  describe('step_begin translation', () => {
    it('maps both OpenCode step-start spellings to one identical canonical shape', () => {
      const fromTopLevel = new OpenCodeJsonEventTranslator().translate({
        type: 'step_start',
        timestamp: 1780703411800,
        id: 'step_same',
        messageID: 'msg_same',
        part: {},
      });
      const fromPart = new OpenCodeJsonEventTranslator().translate({
        type: 'message.updated',
        timestamp: 1780703411800,
        part: { type: 'step-start', id: 'step_same', messageID: 'msg_same' },
      });

      const expected = [{ type: 'step_begin', timestamp: 1780703411800, stepId: 'step_same', messageId: 'msg_same' }];
      expect(fromTopLevel).toStrictEqual(expected);
      expect(fromPart).toStrictEqual(expected);
    });

    it.each([
      ['missing', undefined],
      ['string', '1780703411800'],
      ['NaN', Number.NaN],
      ['positive Infinity', Number.POSITIVE_INFINITY],
      ['negative Infinity', Number.NEGATIVE_INFINITY],
    ])('omits the timestamp key for a %s native value instead of synthesizing time', (_label, rawTimestamp) => {
      const translator = new OpenCodeJsonEventTranslator();
      const event = { type: 'step_start', part: { type: 'step-start' } };
      if (rawTimestamp !== undefined) {
        event.timestamp = rawTimestamp;
      }

      const [stepBegin] = translator.translate(event);

      expect(stepBegin).toStrictEqual({ type: 'step_begin' });
      expect(Object.prototype.hasOwnProperty.call(stepBegin, 'timestamp')).toBe(false);
    });

    it('preserves present finite numeric timestamps exactly, including falsy zero and negatives', () => {
      const translator = new OpenCodeJsonEventTranslator();

      expect(translator.translate({ type: 'step_start', timestamp: 0, part: {} }))
        .toStrictEqual([{ type: 'step_begin', timestamp: 0 }]);
      expect(translator.translate({ type: 'step_start', timestamp: -42, part: {} }))
        .toStrictEqual([{ type: 'step_begin', timestamp: -42 }]);
      expect(translator.translate({ type: 'step_start', timestamp: 1780703411800.5, part: {} }))
        .toStrictEqual([{ type: 'step_begin', timestamp: 1780703411800.5 }]);
    });

    it('prefers part-level identifiers over event-level fallbacks and preserves values unchanged', () => {
      const [stepBegin] = new OpenCodeJsonEventTranslator().translate({
        type: 'step_start',
        id: 'event_step',
        messageID: 'event_msg',
        part: { type: 'step-start', id: 'part_step', messageID: 'part_msg' },
      });

      expect(stepBegin).toStrictEqual({
        type: 'step_begin',
        stepId: 'part_step',
        messageId: 'part_msg',
      });
    });

    it('falls back to event-level identifiers only when the part omits them', () => {
      const [stepBegin] = new OpenCodeJsonEventTranslator().translate({
        type: 'step_start',
        id: 'event_step',
        messageID: 'event_msg',
        part: { type: 'step-start' },
      });

      expect(stepBegin).toStrictEqual({
        type: 'step_begin',
        stepId: 'event_step',
        messageId: 'event_msg',
      });
    });

    it.each([
      ['empty string', ''],
      ['whitespace-only string', '   '],
      ['number', 42],
      ['null', null],
    ])('omits identifiers that are %s instead of passing them through', (_label, rawValue) => {
      const translator = new OpenCodeJsonEventTranslator();

      const [fromPart] = translator.translate({
        type: 'step_start',
        part: { type: 'step-start', id: rawValue, messageID: rawValue },
      });
      expect(fromPart).toStrictEqual({ type: 'step_begin' });

      const [fromEvent] = new OpenCodeJsonEventTranslator().translate({
        type: 'step_start',
        id: rawValue,
        messageID: rawValue,
        part: { type: 'step-start' },
      });
      expect(fromEvent).toStrictEqual({ type: 'step_begin' });
    });

    it('preserves identifier strings verbatim without trimming content', () => {
      const [stepBegin] = new OpenCodeJsonEventTranslator().translate({
        type: 'step_start',
        part: { type: 'step-start', id: '  step-7  ', messageID: ' msg_7 ' },
      });

      expect(stepBegin.stepId).toBe('  step-7  ');
      expect(stepBegin.messageId).toBe(' msg_7 ');
    });
  });
});
