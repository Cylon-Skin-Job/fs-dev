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

  it('stop waits for process close and permits TERM to KILL escalation', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const session = await harness.startThread('thread-1', '/project');
    const eventsPromise = collect(session.sendMessage('hello'));
    await new Promise(resolve => setImmediate(resolve));

    let termSettled = false;
    const term = session.stop('SIGTERM').then(() => { termSettled = true; });
    await Promise.resolve();
    expect(termSettled).toBe(false);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(proc.killed).toBe(true);

    const kill = session.stop('SIGKILL');
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
    expect(termSettled).toBe(false);
    proc.emit('close', null, 'SIGKILL');
    await Promise.all([term, kill, eventsPromise]);
    expect(termSettled).toBe(true);
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

  it('passes the per-thread model override to opencode run', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    harness.initialize({ model: 'workspace-default-model' });
    const session = await harness.startThread('thread-1', '/project', {}, {
      harnessConfig: { model: 'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731' },
    });

    const eventsPromise = collect(session.sendMessage('model probe'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_model_probe'));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual([
      'run', '--format', 'json', '--dir', '/project',
      '--model', 'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731',
      'model probe',
    ]);
  });

  it('passes the per-thread effort variant to opencode run', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    harness.initialize({ model: 'default-model', variant: 'high' });
    const session = await harness.startThread('thread-1', '/project', {}, {
      harnessConfig: { model: 'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731', variant: 'max' },
    });

    const eventsPromise = collect(session.sendMessage('variant probe'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_variant_probe'));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual([
      'run', '--format', 'json', '--dir', '/project',
      '--model', 'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731',
      '--variant', 'max',
      'variant probe',
    ]);
  });

  it('applies live harnessConfig changes to the next prompt', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    harness.initialize({ model: 'default-model' });
    const session = await harness.startThread('thread-1', '/project', {}, {
      harnessConfig: {},
    });

    session.applyHarnessConfig({ model: 'baseten/deepseek-ai/DeepSeek-V4-Flash-0731', variant: 'high' });

    const eventsPromise = collect(session.sendMessage('live config probe'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_live_config_probe'));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual([
      'run', '--format', 'json', '--dir', '/project',
      '--model', 'baseten/deepseek-ai/DeepSeek-V4-Flash-0731',
      '--variant', 'high',
      'live config probe',
    ]);
  });

  it('omits --variant when the model has no effort selection', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    harness.initialize({ model: 'kimi-model' });
    const session = await harness.startThread('thread-1', '/project', {}, {
      harnessConfig: { model: 'kimi-model' },
    });

    const eventsPromise = collect(session.sendMessage('no variant probe'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_no_variant_probe'));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual([
      'run', '--format', 'json', '--dir', '/project',
      '--model', 'kimi-model',
      'no variant probe',
    ]);
  });

  it('falls back to the workspace default model without a per-thread override', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    harness.initialize({ model: 'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731' });
    const session = await harness.startThread('thread-1', '/project', {}, {
      harnessConfig: {},
    });

    const eventsPromise = collect(session.sendMessage('default model probe'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_default_model_probe'));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual([
      'run', '--format', 'json', '--dir', '/project',
      '--model', 'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731',
      'default model probe',
    ]);
  });

  it('starts a pending fork from the source OpenCode session without making it active', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    const pendingFork = {
      type: 'opencode-current-head',
      status: 'pending',
      sourceThreadId: 'thread-source',
      sourceOpenCodeSessionId: 'ses_source',
    };
    const session = await harness.startThread('thread-fork', '/project', {}, {
      harnessConfig: { pendingFork },
    });

    const eventsPromise = collect(session.sendMessage('fork prompt'));
    expect(session.openCodeSessionId).toBeNull();
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_forked'));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--session', 'ses_source', '--fork', 'fork prompt']);
    expect(session.openCodeSessionId).toBe('ses_forked');
    expect(session.openCodeSessionId).not.toBe('ses_source');
  });

  it('persists the returned fork OpenCode session id and clears pendingFork', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const updateHarnessConfig = jest.fn(async () => {});
    const harness = new OpenCodeHarness();
    const pendingFork = {
      type: 'opencode-current-head',
      status: 'pending',
      sourceThreadId: 'thread-source',
      sourceThreadName: 'Source thread',
      sourceExchangeId: 42,
      sourceOpenCodeSessionId: 'ses_source',
      requestedAt: '2026-06-25T12:00:00.000Z',
    };
    const session = await harness.startThread('thread-fork', '/project', {}, {
      harnessConfig: {
        pendingFork,
        forkProvenance: {
          ...pendingFork,
          forkThreadId: 'thread-fork',
        },
      },
      updateHarnessConfig,
    });

    const eventsPromise = collect(session.sendMessage('fork prompt'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_forked'));
    await eventsPromise;

    expect(updateHarnessConfig).toHaveBeenCalledTimes(1);
    expect(updateHarnessConfig).toHaveBeenCalledWith({
      opencodeSessionId: 'ses_forked',
      pendingFork: null,
      forkProvenance: expect.objectContaining({
        ...pendingFork,
        forkThreadId: 'thread-fork',
        status: 'created',
        createdOpenCodeSessionId: 'ses_forked',
        createdAt: expect.any(String),
      }),
    });
    expect(session.pendingFork).toBeNull();
    expect(session.pendingForkConsumed).toBe(true);
  });

  it('leaves pendingFork untouched when OpenCode fails before returning a session id', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const updateHarnessConfig = jest.fn(async () => {});
    const harness = new OpenCodeHarness();
    const pendingFork = {
      type: 'opencode-current-head',
      status: 'pending',
      sourceThreadId: 'thread-source',
      sourceOpenCodeSessionId: 'ses_source',
    };
    const session = await harness.startThread('thread-fork', '/project', {}, {
      harnessConfig: { pendingFork },
      updateHarnessConfig,
    });

    const eventsPromise = collect(session.sendMessage('fork prompt'));
    setImmediate(() => {
      proc.stderr.emit('data', 'fork failed');
      proc.emit('close', 1, null);
    });

    await expect(eventsPromise).rejects.toThrow('OpenCode process exited before turn_end');
    expect(spawn.mock.calls[0][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--session', 'ses_source', '--fork', 'fork prompt']);
    expect(updateHarnessConfig).not.toHaveBeenCalled();
    expect(session.openCodeSessionId).toBeNull();
    expect(session.pendingFork).toEqual(pendingFork);
    expect(session.pendingForkConsumed).toBe(false);
  });

  it('keeps the returned fork session id when a later stream failure occurs', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const updateHarnessConfig = jest.fn(async () => {});
    const harness = new OpenCodeHarness();
    const pendingFork = {
      type: 'opencode-current-head',
      status: 'pending',
      sourceThreadId: 'thread-source',
      sourceOpenCodeSessionId: 'ses_source',
    };
    const session = await harness.startThread('thread-fork', '/project', {}, {
      harnessConfig: { pendingFork },
      updateHarnessConfig,
    });

    const eventsPromise = collect(session.sendMessage('fork prompt'));
    setImmediate(() => {
      proc.stdout.emit('data', '{"type":"text","timestamp":1780703411893,"sessionID":"ses_forked","part":{"type":"text","text":"partial"}}\n');
      proc.stderr.emit('data', 'stream failed');
      proc.emit('close', 1, null);
    });

    await expect(eventsPromise).rejects.toThrow('OpenCode process exited before turn_end');
    expect(updateHarnessConfig).toHaveBeenCalledWith(expect.objectContaining({
      opencodeSessionId: 'ses_forked',
      pendingFork: null,
      forkProvenance: expect.objectContaining({
        status: 'created',
        createdOpenCodeSessionId: 'ses_forked',
      }),
    }));
    expect(session.openCodeSessionId).toBe('ses_forked');
    expect(session.pendingFork).toBeNull();
    expect(session.pendingForkConsumed).toBe(true);
  });

  it('leaves pendingFork untouched when persisting the returned fork session id fails', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const updateHarnessConfig = jest.fn(async () => {
      throw new Error('db write failed');
    });
    const harness = new OpenCodeHarness();
    const pendingFork = {
      type: 'opencode-current-head',
      status: 'pending',
      sourceThreadId: 'thread-source',
      sourceOpenCodeSessionId: 'ses_source',
    };
    const session = await harness.startThread('thread-fork', '/project', {}, {
      harnessConfig: { pendingFork },
      updateHarnessConfig,
    });

    const eventsPromise = collect(session.sendMessage('fork prompt'));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_forked'));

    await expect(eventsPromise).rejects.toThrow('db write failed');
    expect(updateHarnessConfig).toHaveBeenCalledWith(expect.objectContaining({
      opencodeSessionId: 'ses_forked',
      pendingFork: null,
    }));
    expect(session.openCodeSessionId).toBeNull();
    expect(session.pendingFork).toEqual(pendingFork);
    expect(session.pendingForkConsumed).toBe(false);
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

  it('configures Kimi Code 2.7 visible thinking through OpenCode flags', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);
    const harness = new OpenCodeHarness();
    await harness.initialize({ model: 'kimi-for-coding/k2p7', thinking: true });
    const session = await harness.startThread('thread-1', '/project');

    const eventsPromise = collect(session.sendMessage('hello'));
    setImmediate(() => emitSuccessfulTextRun(proc));
    await eventsPromise;

    expect(spawn.mock.calls[0][1]).toEqual(['run', '--format', 'json', '--dir', '/project', '--model', 'kimi-for-coding/k2p7', '--thinking', 'hello']);
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
    expect(events[1]).toMatchObject({
      type: 'content', timestamp: 1780703411893, timestampSource: 'provider_reported',
      reportedAt: 1780703411893, text: 'OPEN_CODE_JSON_PROBE_OK',
    });
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

    expect(events.map((event) => event.type)).toEqual(['turn_begin', 'tool_snapshot', 'status_update', 'turn_end']);
    expect(events[1]).toMatchObject({ toolCallId: 'call_probe', toolName: 'shell' });
    expect(events[1].result).toMatchObject({ output: 'OPENCODE_TOOL_PROBE_OK', isError: false });
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

    expect(events.map((event) => event.type)).toEqual(['turn_begin', 'tool_snapshot', 'turn_end']);
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
    const stopped = session.stop();
    proc.emit('close', null, 'SIGTERM');
    await stopped;

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
    const disposed = harness.dispose();
    setImmediate(() => proc.emit('close', null, 'SIGTERM'));
    await disposed;

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
