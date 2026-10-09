const { KimiHarness } = require('../index');

jest.mock('child_process', () => {
  const { EventEmitter: MockEmitter } = require('events');
  return {
    spawn: jest.fn(() => {
      const proc = new MockEmitter();
      proc.pid = 12345;
      proc.killed = false;
      proc.stdin = { write: jest.fn() };
      proc.stdout = new MockEmitter();
      proc.stderr = new MockEmitter();
      proc.kill = jest.fn(() => { proc.killed = true; });
      return proc;
    })
  };
});

const { spawn } = require('child_process');

describe('KimiHarness.sendMessage', () => {
  let harness;
  let proc;

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new KimiHarness();
  });

  async function startSession() {
    const sessionPromise = harness.startThread('thread-1', '/tmp/project');
    proc = spawn.mock.results[0].value;
    const session = await sessionPromise;
    return session;
  }

  function feedEvent(eventType, payload) {
    const line = JSON.stringify({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: eventType, payload }
    });
    proc.stdout.emit('data', Buffer.from(line + '\n'));
  }

  function feedError(id, error) {
    const line = JSON.stringify({
      jsonrpc: '2.0',
      id,
      error
    });
    proc.stdout.emit('data', Buffer.from(line + '\n'));
  }

  function getWrittenJson() {
    return proc.stdin.write.mock.calls.map(([str]) => {
      const trimmed = str.trim();
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    });
  }

  it('writes an initialize JSON-RPC request once', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello');
    // Start consuming immediately so the generator begins execution
    const consumePromise = (async () => {
      for await (const _ of iterator) { /* drain */ }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedEvent('TurnBegin', { user_input: 'Hello' });
    feedEvent('TurnEnd', {});
    await consumePromise;

    const written = getWrittenJson();
    const initMessages = written.filter(m => m.method === 'initialize');
    expect(initMessages).toHaveLength(1);
    expect(initMessages[0].params).toMatchObject({
      protocol_version: '1.4',
      client: { name: 'fusion-studio', version: '0.1.0' },
      capabilities: { supports_question: true }
    });
    expect(initMessages[0].id).toBeDefined();
  });

  it('writes a prompt JSON-RPC request with params.user_input', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello world');
    const consumePromise = (async () => {
      for await (const _ of iterator) { /* drain */ }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedEvent('TurnBegin', { user_input: 'Hello world' });
    feedEvent('TurnEnd', {});
    await consumePromise;

    const written = getWrittenJson();
    const promptMessages = written.filter(m => m.method === 'prompt');
    expect(promptMessages).toHaveLength(1);
    expect(promptMessages[0].params.user_input).toBe('Hello world');
  });

  it('includes params.system when provided', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello', { system: 'You are helpful' });
    const consumePromise = (async () => {
      for await (const _ of iterator) { /* drain */ }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedEvent('TurnBegin', { user_input: 'Hello' });
    feedEvent('TurnEnd', {});
    await consumePromise;

    const written = getWrittenJson();
    const promptMessages = written.filter(m => m.method === 'prompt');
    expect(promptMessages[0].params.system).toBe('You are helpful');
  });

  it('yields canonical turn_begin, content, and turn_end events in order', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello');
    const collected = [];
    const consumePromise = (async () => {
      for await (const event of iterator) {
        collected.push(event.type);
      }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedEvent('TurnBegin', { user_input: 'Hello' });
    feedEvent('ContentPart', { type: 'text', text: 'Hi there' });
    feedEvent('TurnEnd', {});
    await consumePromise;

    expect(collected).toEqual(['turn_begin', 'content', 'turn_end']);
  });

  it('yields canonical status_update events from Kimi wire StatusUpdate', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello');
    const collected = [];
    const consumePromise = (async () => {
      for await (const event of iterator) {
        collected.push(event);
      }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedEvent('TurnBegin', { user_input: 'Hello' });
    feedEvent('StatusUpdate', {
      context_usage: 0.5,
      token_usage: { input_other: 100, output: 50 },
      message_id: 'msg-1',
      plan_mode: true
    });
    feedEvent('TurnEnd', {});
    await consumePromise;

    const status = collected.find(event => event.type === 'status_update');
    expect(status).toMatchObject({
      contextUsage: 0.5,
      tokenUsage: { input_other: 100, output: 50 },
      messageId: 'msg-1',
      planMode: true
    });
  });

  it('throws on prompt error preserving code and message', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello');
    let caughtError = null;
    const consumePromise = (async () => {
      try {
        for await (const _ of iterator) { /* drain */ }
      } catch (err) {
        caughtError = err;
      }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedError('2', { code: -32004, message: 'Authentication failed' });
    await consumePromise;

    expect(caughtError).not.toBeNull();
    expect(caughtError.message).toMatch(/Authentication failed/);
  });

  it('preserves auth error code -32004', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello');
    let caughtError = null;
    const consumePromise = (async () => {
      try {
        for await (const _ of iterator) { /* drain */ }
      } catch (err) {
        caughtError = err;
      }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedError('2', { code: -32004, message: 'Authentication failed' });
    await consumePromise;

    expect(caughtError).not.toBeNull();
    expect(caughtError.code).toBe(-32004);
    expect(caughtError.message).toMatch(/Authentication failed/);
  });

  it('removes listeners after success', async () => {
    const session = await startSession();

    const beforeCount = harness.listenerCount('event');

    const iterator = session.sendMessage('Hello');
    const consumePromise = (async () => {
      for await (const _ of iterator) { /* drain */ }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedEvent('TurnBegin', { user_input: 'Hello' });
    feedEvent('TurnEnd', {});
    await consumePromise;

    expect(harness.listenerCount('event')).toBe(beforeCount);
  });

  it('removes listeners after error', async () => {
    const session = await startSession();

    const beforeEventCount = harness.listenerCount('event');
    const beforeErrorCount = harness.listenerCount('response_error');

    const iterator = session.sendMessage('Hello');
    const consumePromise = (async () => {
      try {
        for await (const _ of iterator) { /* drain */ }
      } catch {
        // expected
      }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedError('2', { code: -1, message: 'Something went wrong' });
    await consumePromise;

    expect(harness.listenerCount('event')).toBe(beforeEventCount);
    expect(harness.listenerCount('response_error')).toBe(beforeErrorCount);
  });

  it('exits active sendMessage when session.stop() is followed by process exit', async () => {
    const session = await startSession();
    const beforeEventCount = harness.listenerCount('event');
    const beforeErrorCount = harness.listenerCount('response_error');
    const beforeExitCount = harness.listenerCount('exit');

    const iterator = session.sendMessage('Hello');
    let caughtError = null;
    const consumePromise = (async () => {
      try {
        for await (const _ of iterator) { /* drain */ }
      } catch (err) {
        caughtError = err;
      }
    })();

    await new Promise(r => setTimeout(r, 10));
    await session.stop();
    proc.emit('exit', null);
    await consumePromise;

    expect(caughtError).toBeNull();
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(harness.listenerCount('event')).toBe(beforeEventCount);
    expect(harness.listenerCount('response_error')).toBe(beforeErrorCount);
    expect(harness.listenerCount('exit')).toBe(beforeExitCount);
  });

  it('throws if process exits during active send without a requested stop', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello');
    let caughtError = null;
    const consumePromise = (async () => {
      try {
        for await (const _ of iterator) { /* drain */ }
      } catch (err) {
        caughtError = err;
      }
    })();

    await new Promise(r => setTimeout(r, 10));
    proc.emit('exit', 1);
    await consumePromise;

    expect(caughtError).not.toBeNull();
    expect(caughtError.message).toMatch(/process exited during active send/);
  });

  it('yields canonical subagent_event from Kimi wire SubagentEvent', async () => {
    const session = await startSession();

    const iterator = session.sendMessage('Hello');
    const collected = [];
    const consumePromise = (async () => {
      for await (const event of iterator) {
        collected.push(event);
      }
    })();

    await new Promise(r => setTimeout(r, 10));
    feedEvent('TurnBegin', { user_input: 'Hello' });
    feedEvent('SubagentEvent', {
      parent_tool_call_id: 'tc-1',
      agent_id: 'agent-1',
      subagent_type: 'task',
      event: {
        type: 'ToolCall',
        payload: { id: 'sub-tc-1', function: { name: 'Bash' } }
      }
    });
    feedEvent('TurnEnd', {});
    await consumePromise;

    const subagentEvent = collected.find(e => e.type === 'subagent_event');
    expect(subagentEvent).toBeDefined();
    expect(subagentEvent).toMatchObject({
      parentToolCallId: 'tc-1',
      agentId: 'agent-1',
      subagentType: 'task',
      subagentEventType: 'ToolCall',
      subagentPayload: { id: 'sub-tc-1', function: { name: 'Bash' } }
    });
    expect(subagentEvent.timestamp).toBeDefined();
  });

  it('does not emit chat:turn_end directly through event-bus', () => {
    const fs = require('fs');
    const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
    expect(source).not.toMatch(/require\(['"]\.\.\/..\/event-bus['"]\)/);
    expect(source).not.toMatch(/bridgeToEventBus/);
    expect(source).not.toMatch(/normalizeTokenUsage/);
  });
});
