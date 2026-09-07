'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const childProcess = require('child_process');

const ADAPTERS = ['qwen', 'codex', 'gemini', 'claude-code'];

test.each(ADAPTERS)('%s routes canonical terminal events only through the owned iterator', (adapter) => {
  const source = fs.readFileSync(
    path.join(__dirname, `../../lib/harness/clis/${adapter}/index.js`),
    'utf8',
  );
  expect(source).not.toContain("require('../../../event-bus')");
  expect(source).not.toContain('bridgeToEventBus');
  expect(source).not.toContain("emit('chat:turn_end'");
  expect(source).not.toContain("emit('chat:status_update'");
  expect(source).toContain("this.emit('event', { threadId, sessionKey, event })");
});

function createProcess() {
  const proc = new EventEmitter();
  proc.pid = 123;
  proc.killed = false;
  proc.stdin = { write: jest.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn((signal) => {
    proc.killed = true;
    proc.signal = signal;
    return true;
  });
  return proc;
}

const ADAPTER_CLASSES = {
  qwen: require('../../lib/harness/clis/qwen').QwenHarness,
  codex: require('../../lib/harness/clis/codex').CodexHarness,
  gemini: require('../../lib/harness/clis/gemini').GeminiHarness,
  'claude-code': require('../../lib/harness/clis/claude-code').ClaudeCodeHarness,
};

test.each(ADAPTERS)('%s session yields canonical events and honors provider stop signal', async (adapter) => {
  const proc = createProcess();
  const spawn = jest.spyOn(childProcess, 'spawn').mockReturnValue(proc);
  const Harness = ADAPTER_CLASSES[adapter];
  const harness = new Harness();
  harness.cliPath = `/bin/${adapter}`;
  harness.initializeAcpSession = jest.fn(async () => {});

  try {
    const session = await harness.startThread('thread-1', '/tmp/project', {
      workspaceId: 'workspace-1',
    });
    const iterator = session.sendMessage('hello');
    const first = iterator.next();
    await new Promise(resolve => setImmediate(resolve));
    harness.emit('event', {
      threadId: 'thread-1', sessionKey: session.sessionKey,
      event: { type: 'content', text: 'answer' },
    });
    harness.emit('event', {
      threadId: 'thread-1', sessionKey: session.sessionKey,
      event: { type: 'turn_end', reason: 'complete' },
    });

    await expect(first).resolves.toEqual({
      done: false, value: { type: 'content', text: 'answer' },
    });
    await expect(iterator.next()).resolves.toEqual({
      done: false, value: { type: 'turn_end', reason: 'complete' },
    });
    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
    expect(proc.stdin.write).toHaveBeenCalledWith(expect.stringContaining('session/prompt'));

    await session.stop('SIGKILL');
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  } finally {
    spawn.mockRestore();
  }
});

test.each(ADAPTERS)('%s launch remains bound to its workspace runtime config', async (adapter) => {
  const proc = createProcess();
  const spawn = jest.spyOn(childProcess, 'spawn').mockReturnValue(proc);
  const Harness = ADAPTER_CLASSES[adapter];
  const harness = new Harness();
  harness.cliPath = `/workspace-b/${adapter}`;
  harness.config = { mode: 'workspace-b-mode', model: 'workspace-b-model' };
  harness.initializeAcpSession = jest.fn(async () => {});

  try {
    await harness.startThread('same-id', '/workspace/a', {
      workspaceId: 'workspace-a',
    }, {
      sessionKey: JSON.stringify(['workspace-a', '/workspace/a', 'same-id']),
      runtimeConfig: {
        cliPath: `/workspace-a/${adapter}`,
        mode: 'workspace-a-mode',
        model: 'workspace-a-model',
      },
    });

    expect(spawn).toHaveBeenCalledWith(`/workspace-a/${adapter}`,
      expect.arrayContaining(['workspace-a-mode', 'workspace-a-model']),
      expect.objectContaining({ cwd: '/workspace/a' }));
    expect(spawn.mock.calls[0][1]).not.toContain('workspace-b-model');
  } finally {
    spawn.mockRestore();
  }
});

test('equal public thread ids keep distinct workspace adapter sessions and event queues', async () => {
  const procA = createProcess();
  const procB = createProcess();
  const spawn = jest.spyOn(childProcess, 'spawn')
    .mockReturnValueOnce(procA)
    .mockReturnValueOnce(procB);
  const harness = new ADAPTER_CLASSES.qwen();
  harness.cliPath = '/bin/qwen';
  harness.initializeAcpSession = jest.fn(async () => {});

  try {
    const sessionA = await harness.startThread('same-id', '/workspace/a', {
      workspaceId: 'workspace-a',
    });
    const sessionB = await harness.startThread('same-id', '/workspace/b', {
      workspaceId: 'workspace-b',
    });
    expect(sessionA.sessionKey).not.toBe(sessionB.sessionKey);
    expect(harness.sessions.size).toBe(2);

    const nextA = sessionA.sendMessage('A').next();
    const nextB = sessionB.sendMessage('B').next();
    await new Promise(resolve => setImmediate(resolve));
    harness.emit('event', {
      threadId: 'same-id', sessionKey: sessionA.sessionKey,
      event: { type: 'turn_end', marker: 'A' },
    });
    harness.emit('event', {
      threadId: 'same-id', sessionKey: sessionB.sessionKey,
      event: { type: 'turn_end', marker: 'B' },
    });

    await expect(nextA).resolves.toEqual({
      done: false, value: { type: 'turn_end', marker: 'A' },
    });
    await expect(nextB).resolves.toEqual({
      done: false, value: { type: 'turn_end', marker: 'B' },
    });
  } finally {
    spawn.mockRestore();
  }
});
