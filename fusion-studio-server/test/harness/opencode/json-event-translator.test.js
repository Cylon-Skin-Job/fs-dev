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
      timestampSource: 'host_observed',
      observedAt: 100,
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

    expect(events).toEqual([expect.objectContaining({
      type: 'content', timestamp: 1780703411893, timestampSource: 'provider_reported',
      reportedAt: 1780703411893, text: 'OPEN_CODE_JSON_PROBE_OK',
    })]);
  });

  it('maps reasoning parts to canonical thinking', () => {
    const translator = new OpenCodeJsonEventTranslator();

    const events = translator.translate({
      type: 'reasoning',
      timestamp: 1780703411893,
      part: { type: 'reasoning', text: 'checking approach' },
    });

    expect(events).toEqual([expect.objectContaining({
      type: 'thinking', timestamp: 1780703411893, timestampSource: 'provider_reported',
      reportedAt: 1780703411893, text: 'checking approach',
    })]);
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

    expect(events).toEqual([expect.objectContaining({
      type: 'tool_snapshot', origin: 'terminal_snapshot', harnessId: 'opencode', provider: 'opencode',
      timestamp: 1780703445385, timestampSource: 'provider_reported',
      terminalSnapshotReportedAt: 1780703445385,
      toolCallId: 'call_b50fbfe191e94243a66a4733', toolName: 'shell', nativeToolName: 'bash',
      status: 'completed', hasInput: true,
      input: { command: 'printf OPENCODE_TOOL_PROBE_OK', description: 'Run printf probe command' },
      result: expect.objectContaining({ output: 'OPENCODE_TOOL_PROBE_OK', isError: false, files: [] }),
    })]);
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

    expect(events[0]).toMatchObject({ type: 'tool_snapshot', status: 'completed', result: { isError: true, output: 'failed' } });
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

    expect(events[0].result).toMatchObject({
      isError: true,
      output: 'fatal: not a git repository (or any of the parent directories): .git\n',
    });
    expect(events[0].result.statusMessage).toBeUndefined();
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

    expect(events[0].result).toMatchObject({
      isError: true,
      output: '',
      statusMessage: 'Command failed with exit code 1',
    });
  });

  it('keeps incomplete tool states on the legacy chat path without provenance', () => {
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

    expect(events.map(event => event.type)).toEqual(['tool_call', 'tool_call_args']);
    expect(events.every(event => event.origin === 'legacy_chat_fail_open')).toBe(true);
    expect(events.some(event => event.type === 'tool_snapshot')).toBe(false);
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
    expect(mapOpenCodeToolName('BASH')).toBe('shell');
    expect(mapOpenCodeToolName('future-tool')).toBe('unknown');
  });

  it('maps terminal snapshot status and the three reported clocks without substitution', () => {
    const translator = new OpenCodeJsonEventTranslator({ now: () => 400 });
    const completed = translator.translate({
      type: 'tool_use', timestamp: 300,
      part: { type: 'tool', callID: 'own-call', id: 'ignored-part', tool: 'edit', state: {
        status: 'completed', time: { start: 100, end: 200 }, input: { filePath: 'a' },
        output: 'failed', metadata: { exit: 1 }, files: ['must-stay-inert'],
      } },
    })[0];
    expect(completed).toMatchObject({
      status: 'completed', observedAt: 400, executionStartedReportedAt: 100,
      terminalReportedAt: 200, terminalSnapshotReportedAt: 300, toolCallId: 'own-call',
      result: { isError: true, files: [] },
    });
    expect(completed).not.toHaveProperty('announcedReportedAt');
    expect(completed).not.toHaveProperty('argumentsReportedAt');

    const errored = translator.translate({
      type: 'tool_use',
      part: { type: 'tool', callID: 'error-call', tool: 'bash', state: {
        status: 'error', input: { command: 'false' }, output: 'error', metadata: { exit: 0 },
      } },
    })[0];
    expect(errored).toMatchObject({
      status: 'error', observedAt: 400, timestamp: 400, timestampSource: 'host_observed',
      result: { isError: false },
    });
    expect(errored.executionStartedReportedAt).toBeUndefined();
    expect(errored.terminalReportedAt).toBeUndefined();
    expect(errored.terminalSnapshotReportedAt).toBeUndefined();
  });

  it.each([
    [{ id: 'must-not-be-used', tool: 'read', state: { status: 'completed' } }],
    [{ callID: 1, tool: 'read', state: { status: 'completed' } }],
    [{ callID: 'call', state: { status: 'completed' } }],
    [{ callID: 'call', tool: 1, state: { status: 'completed' } }],
    [{ callID: 'call', tool: 'read', state: { status: 'running' } }],
  ])('takes the redacted provenance-only diagnostic branch for malformed identity/status %#', (part) => {
    const diagnostics = [];
    const translator = new OpenCodeJsonEventTranslator({ onDiagnostic: code => diagnostics.push(code) });
    const events = translator.translate({ type: 'tool_use', part });
    expect(events.length).toBeGreaterThan(0);
    const expectedOrigin = part.state?.status === 'completed' || part.state?.status === 'error'
      ? 'terminal_chat_fail_open'
      : 'legacy_chat_fail_open';
    expect(events.every(event => event.origin === expectedOrigin)).toBe(true);
    expect(events.some(event => event.type === 'tool_snapshot')).toBe(false);
    expect(events.some(event => event.toolCallId === 'must-not-be-used')).toBe(false);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatch(/^agent_tool_/u);
  });
});
