const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

jest.mock('child_process', () => ({ spawn: jest.fn() }));

const { spawn } = require('child_process');
const { OpenCodeHarness } = require('../../../lib/harness/opencode');
const { HarnessRegistry } = require('../../../lib/harness/registry');

function createFakeProcess() {
  const proc = new EventEmitter();
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.killed = false;
  proc.pid = 1234;
  proc.kill = jest.fn(() => {
    proc.killed = true;
    return true;
  });
  return proc;
}

async function collect(asyncIterable) {
  const events = [];
  for await (const event of asyncIterable) {
    events.push(event);
  }
  return events;
}

function emitSuccessfulTextRun(proc, sessionId = 'ses_probe') {
  proc.stdout.emit('data', `{"type":"text","timestamp":1780703411893,"sessionID":"${sessionId}","part":{"type":"text","text":"OPEN_CODE_JSON_PROBE_OK"}}\n`);
  proc.stdout.emit('data', `{"type":"step_finish","timestamp":1780703411932,"sessionID":"${sessionId}","part":{"type":"step-finish","reason":"stop","messageID":"msg_probe","tokens":{"total":10,"input":3,"output":1,"reasoning":0,"cache":{"write":0,"read":6}}}}\n`);
  proc.emit('close', 0, null);
}

function emitCleanExitTextRunWithoutStepFinish(proc, sessionId = 'ses_probe') {
  proc.stdout.emit('data', `{"type":"text","timestamp":1780703411893,"sessionID":"${sessionId}","part":{"type":"text","text":"OPEN_CODE_JSON_PROBE_OK"}}\n`);
  proc.emit('close', 0, null);
}

describe('OpenCodeHarness', () => {
  beforeEach(() => {
    spawn.mockReset();
    delete process.env.OPENCODE_PATH;
  });

  it('exposes cliName for install-status probing', () => {
    const harness = new OpenCodeHarness();

    expect(harness.cliName).toBe('opencode');
  });

  it('isInstalled returns true when opencode --version exits 0', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();

    const result = harness.isInstalled();
    proc.emit('close', 0);

    await expect(result).resolves.toBe(true);
    expect(spawn).toHaveBeenCalledWith('opencode', ['--version'], { stdio: 'pipe' });
  });

  it('isInstalled returns false when spawn fails', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();

    const result = harness.isInstalled();
    proc.emit('error', new Error('ENOENT'));

    await expect(result).resolves.toBe(false);
  });

  it('getVersion captures version output', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();

    const result = harness.getVersion();
    proc.stdout.emit('data', '1.15.13\n');
    proc.emit('close', 0);

    await expect(result).resolves.toBe('1.15.13');
  });

  it('startThread returns a session with sendMessage and stop', async () => {
    const harness = new OpenCodeHarness();
    await harness.initialize({});

    const session = await harness.startThread('thread-1', '/project');

    expect(session.threadId).toBe('thread-1');
    expect(typeof session.sendMessage).toBe('function');
    expect(typeof session.stop).toBe('function');
    expect(harness.getSession('thread-1')).toBe(session);
  });

  it('sendMessage spawns opencode run with JSON format, dir, and prompt', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    await harness.initialize({});
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc));

    const events = await eventsPromise;

    expect(spawn).toHaveBeenCalledWith('opencode', ['run', '--format', 'json', '--dir', '/project', 'hello'], expect.objectContaining({ cwd: '/project' }));
    expect(events.map((event) => event.type)).toEqual(['turn_begin', 'content', 'status_update', 'turn_end']);
  });

  it('stores the generated OpenCode session id from the first prompt', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_thread_1'));
    await eventsPromise;

    expect(session.openCodeSessionId).toBe('ses_thread_1');
  });

  it('follow-up prompts reuse the captured OpenCode session id', async () => {
    const firstProc = createFakeProcess();
    const secondProc = createFakeProcess();
    spawn.mockReturnValueOnce(firstProc).mockReturnValueOnce(secondProc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const firstEventsPromise = collect(session.sendMessage('first'));
    setImmediate(() => emitSuccessfulTextRun(firstProc, 'ses_thread_1'));
    await firstEventsPromise;

    const secondEventsPromise = collect(session.sendMessage('second'));
    setImmediate(() => emitSuccessfulTextRun(secondProc, 'ses_thread_1'));
    await secondEventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual(['run', '--format', 'json', '--dir', '/project', 'first']);
    expect(spawn.mock.calls[1][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--session', 'ses_thread_1', 'second']);
  });

  it('starts from a stored OpenCode session id after a cold Fusion session', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project', {}, {
      harnessConfig: { opencodeSessionId: 'ses_stored' },
    });

    const eventsPromise = collect(session.sendMessage('after cold start'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_stored'));
    await eventsPromise;

    expect(session.openCodeSessionId).toBe('ses_stored');
    expect(spawn.mock.calls[0][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--session', 'ses_stored', 'after cold start']);
  });

  it('persists the first captured OpenCode session id once', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const updateHarnessConfig = jest.fn(async () => {});
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project', {}, { updateHarnessConfig });

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => {
      proc.stdout.emit('data', '{"type":"text","timestamp":1780703411893,"sessionID":"ses_thread_1","part":{"type":"text","text":"OPEN_CODE_JSON_PROBE_OK"}}\n');
      proc.stdout.emit('data', '{"type":"text","timestamp":1780703411894,"sessionID":"ses_thread_1","part":{"type":"text","text":"AGAIN"}}\n');
      proc.stdout.emit('data', '{"type":"step_finish","timestamp":1780703411932,"sessionID":"ses_thread_1","part":{"type":"step-finish","reason":"stop","messageID":"msg_probe","tokens":{"total":10,"input":3,"output":1,"reasoning":0,"cache":{"write":0,"read":6}}}}\n');
      proc.emit('close', 0, null);
    });
    await eventsPromise;

    expect(updateHarnessConfig).toHaveBeenCalledTimes(1);
    expect(updateHarnessConfig).toHaveBeenCalledWith({ opencodeSessionId: 'ses_thread_1' });
  });

  it('does not persist again when the OpenCode session id is already stored', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const updateHarnessConfig = jest.fn(async () => {});
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project', {}, {
      harnessConfig: { opencodeSessionId: 'ses_stored' },
      updateHarnessConfig,
    });

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_stored'));
    await eventsPromise;

    expect(updateHarnessConfig).not.toHaveBeenCalled();
  });

  it('different Fusion thread sessions keep different OpenCode session ids', async () => {
    const firstThreadProc = createFakeProcess();
    const secondThreadProc = createFakeProcess();
    spawn.mockReturnValueOnce(firstThreadProc).mockReturnValueOnce(secondThreadProc);
    const harness = new OpenCodeHarness();
    const firstSession = await harness.startThread('thread-1', '/project');
    const secondSession = await harness.startThread('thread-2', '/project');

    const firstEventsPromise = collect(firstSession.sendMessage('first thread'));
    setImmediate(() => emitSuccessfulTextRun(firstThreadProc, 'ses_thread_1'));
    await firstEventsPromise;

    const secondEventsPromise = collect(secondSession.sendMessage('second thread'));
    setImmediate(() => emitSuccessfulTextRun(secondThreadProc, 'ses_thread_2'));
    await secondEventsPromise;

    expect(firstSession.openCodeSessionId).toBe('ses_thread_1');
    expect(secondSession.openCodeSessionId).toBe('ses_thread_2');
  });

  it('never uses global --continue session state', async () => {
    const firstProc = createFakeProcess();
    const secondProc = createFakeProcess();
    spawn.mockReturnValueOnce(firstProc).mockReturnValueOnce(secondProc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const firstEventsPromise = collect(session.sendMessage('first'));
    setImmediate(() => emitSuccessfulTextRun(firstProc, 'ses_thread_1'));
    await firstEventsPromise;

    const secondEventsPromise = collect(session.sendMessage('second'));
    setImmediate(() => emitSuccessfulTextRun(secondProc, 'ses_thread_1'));
    await secondEventsPromise;

    const allArgs = spawn.mock.calls.flatMap((call) => call[1]);
    expect(allArgs).toContain('--session');
    expect(allArgs).not.toContain('--continue');
  });

  it('throws if a completed OpenCode JSON run has no sessionID', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => {
      proc.stdout.emit('data', '{"type":"text","timestamp":1780703411893,"part":{"type":"text","text":"OPEN_CODE_JSON_PROBE_OK"}}\n');
      proc.stdout.emit('data', '{"type":"step_finish","timestamp":1780703411932,"part":{"type":"step-finish","reason":"stop","messageID":"msg_probe","tokens":{"total":10,"input":3,"output":1,"reasoning":0,"cache":{"write":0,"read":6}}}}\n');
      proc.emit('close', 0, null);
    });

    await expect(eventsPromise).rejects.toThrow('completed without a sessionID');
  });

  it('config.cliPath overrides executable', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    await harness.initialize({ cliPath: '/opt/homebrew/bin/opencode' });
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc));
    await eventsPromise;

    expect(spawn).toHaveBeenCalledWith('/opt/homebrew/bin/opencode', expect.any(Array), expect.any(Object));
  });

  it('config.model adds --model', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    await harness.initialize({ model: 'opencode/mimo-v2.5-free' });
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--model', 'opencode/mimo-v2.5-free', 'hello']);
  });

  it('config.thinking true adds --thinking', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    await harness.initialize({ thinking: true });
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--thinking', 'hello']);
  });

  it('config.pure adds --pure while preserving session reuse', async () => {
    const firstProc = createFakeProcess();
    const secondProc = createFakeProcess();
    spawn.mockReturnValueOnce(firstProc).mockReturnValueOnce(secondProc);
    const harness = new OpenCodeHarness();
    await harness.initialize({ pure: true });
    const session = await harness.startThread('thread-1', '/project');

    const firstEventsPromise = collect(session.sendMessage('first'));
    setImmediate(() => emitSuccessfulTextRun(firstProc, 'ses_thread_1'));
    await firstEventsPromise;

    const secondEventsPromise = collect(session.sendMessage('second'));
    setImmediate(() => emitSuccessfulTextRun(secondProc, 'ses_thread_1'));
    await secondEventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--pure', 'first']);
    expect(spawn.mock.calls[1][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--pure', '--session', 'ses_thread_1', 'second']);
  });

  it('stdout text JSON yields turn_begin then content', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc));
    const events = await eventsPromise;

    expect(events[0]).toMatchObject({ type: 'turn_begin', userInput: 'hello' });
    expect(events[1]).toEqual({ type: 'content', timestamp: 1780703411893, text: 'OPEN_CODE_JSON_PROBE_OK' });
  });

  it('stdout tool JSON yields canonical tool events through the translator', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('use tool'));
    setImmediate(() => {
      proc.stdout.emit('data', '{"type":"tool_use","timestamp":1780703445385,"sessionID":"ses_probe","part":{"type":"tool","tool":"bash","callID":"call_probe","state":{"status":"completed","input":{"command":"printf OPENCODE_TOOL_PROBE_OK"},"output":"OPENCODE_TOOL_PROBE_OK","metadata":{"output":"OPENCODE_TOOL_PROBE_OK","exit":0,"description":"Run printf probe command"},"title":"Run printf probe command"}}}\n');
      proc.stdout.emit('data', '{"type":"step_finish","timestamp":1780703411932,"sessionID":"ses_probe","part":{"type":"step-finish","reason":"stop","messageID":"msg_probe","tokens":{"total":10,"input":3,"output":1,"reasoning":0,"cache":{"write":0,"read":6}}}}\n');
      proc.emit('close', 0, null);
    });

    const events = await eventsPromise;

    expect(events.map((event) => event.type)).toEqual(['turn_begin', 'tool_call', 'tool_call_args', 'tool_result', 'status_update', 'turn_end']);
    expect(events[1]).toMatchObject({ toolCallId: 'call_probe', toolName: 'shell' });
    expect(events[3]).toMatchObject({ output: 'OPENCODE_TOOL_PROBE_OK', isError: false });
  });

  it('clean exit with text and no step_finish yields a synthetic turn_end', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitCleanExitTextRunWithoutStepFinish(proc));
    const events = await eventsPromise;

    expect(events.map((event) => event.type)).toEqual(['turn_begin', 'content', 'turn_end']);
    expect(events.at(-1)).toMatchObject({
      type: 'turn_end',
      reason: 'complete',
      fullText: 'OPEN_CODE_JSON_PROBE_OK',
      hasToolCalls: false,
      _meta: {
        harnessId: 'opencode',
        provider: 'opencode',
        terminalSource: 'process_exit_missing_step_finish',
      },
    });
  });

  it('clean exit with reasoning and text but no step_finish yields a synthetic turn_end', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('think'));
    setImmediate(() => {
      proc.stdout.emit('data', '{"type":"reasoning","timestamp":1780703411800,"sessionID":"ses_probe","part":{"type":"reasoning","text":"checking approach"}}\n');
      proc.stdout.emit('data', '{"type":"text","timestamp":1780703411893,"sessionID":"ses_probe","part":{"type":"text","text":"done"}}\n');
      proc.emit('close', 0, null);
    });
    const events = await eventsPromise;

    expect(events.map((event) => event.type)).toEqual(['turn_begin', 'thinking', 'content', 'turn_end']);
    expect(events.at(-1)).toMatchObject({ type: 'turn_end', fullText: 'done' });
  });

  it('clean exit with completed tool event and no step_finish yields a synthetic turn_end', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('use tool'));
    setImmediate(() => {
      proc.stdout.emit('data', '{"type":"tool_use","timestamp":1780703445385,"sessionID":"ses_probe","part":{"type":"tool","tool":"bash","callID":"call_probe","state":{"status":"completed","input":{"command":"printf OPENCODE_TOOL_PROBE_OK"},"output":"OPENCODE_TOOL_PROBE_OK","metadata":{"output":"OPENCODE_TOOL_PROBE_OK","exit":0,"description":"Run printf probe command"},"title":"Run printf probe command"}}}\n');
      proc.emit('close', 0, null);
    });
    const events = await eventsPromise;

    expect(events.map((event) => event.type)).toEqual(['turn_begin', 'tool_call', 'tool_call_args', 'tool_result', 'turn_end']);
    expect(events.at(-1)).toMatchObject({ type: 'turn_end', fullText: '', hasToolCalls: true });
  });

  it('clean exit after only step_start still throws', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => {
      proc.stdout.emit('data', '{"type":"step_start","timestamp":1780703411800,"sessionID":"ses_probe","part":{"type":"step-start"}}\n');
      proc.emit('close', 0, null);
    });

    await expect(eventsPromise).rejects.toThrow('OpenCode process exited before turn_end');
  });

  it('nonzero exit after useful output still throws', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => {
      proc.stdout.emit('data', '{"type":"text","timestamp":1780703411893,"sessionID":"ses_probe","part":{"type":"text","text":"OPEN_CODE_JSON_PROBE_OK"}}\n');
      proc.emit('close', 1, null);
    });

    await expect(eventsPromise).rejects.toThrow('OpenCode process exited before turn_end');
  });

  it('final step_finish reason stop yields turn_end', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc));
    const events = await eventsPromise;

    expect(events.at(-1)).toMatchObject({ type: 'turn_end', reason: 'stop' });
  });

  it('normal step_finish path does not produce a duplicate synthetic turn_end', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc));
    const events = await eventsPromise;

    expect(events.filter((event) => event.type === 'turn_end')).toHaveLength(1);
    expect(events.at(-1)._meta.terminalSource).toBeUndefined();
  });

  it('malformed stdout line is ignored when surrounded by valid JSON', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const parseErrors = [];
    harness.on('parse_error', (err) => parseErrors.push(err));
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => {
      proc.stdout.emit('data', 'not json\n');
      emitSuccessfulTextRun(proc);
    });
    const events = await eventsPromise;

    expect(parseErrors).toHaveLength(1);
    expect(events.map((event) => event.type)).toContain('content');
  });

  it('process exit after stop does not throw', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');
    const iterator = session.sendMessage('hello')[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({ value: { type: 'turn_begin' } });
    await session.stop();
    proc.emit('close', null, 'SIGTERM');

    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
  });

  it('unexpected process exit during active send throws a useful error', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');
    const iterator = session.sendMessage('hello')[Symbol.asyncIterator]();

    await iterator.next();
    proc.stderr.emit('data', 'boom');
    proc.emit('close', 1, null);

    await expect(iterator.next()).rejects.toThrow('OpenCode process exited before turn_end');
  });

  it('dispose stops active sessions and clears the session map', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');
    const iterator = session.sendMessage('hello')[Symbol.asyncIterator]();

    await iterator.next();
    await harness.dispose();
    proc.emit('close', null, 'SIGTERM');

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(harness.sessions.size).toBe(0);
  });
});

describe('OpenCode registry registration', () => {
  it('contains opencode while Kimi remains registered as the default fallback harness', () => {
    const registry = new HarnessRegistry();

    expect(registry.has('opencode')).toBe(true);
    expect(registry.get('opencode')).toBeInstanceOf(OpenCodeHarness);
    expect(registry.get('kimi').id).toBe('kimi');
    expect(registry.getIds()[0]).toBe('kimi');
  });
});
