const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { stopChildProcess } = require('./process-shutdown.cjs');

function createChild(onKill) {
  const child = new EventEmitter();
  child.pid = 1234;
  child.exitCode = null;
  child.signalCode = null;
  child.signals = [];
  child.kill = (signal) => {
    child.signals.push(signal);
    onKill?.(signal, child);
    return true;
  };
  return child;
}

function emitExit(child, signal) {
  child.signalCode = signal;
  child.emit('exit', null, signal);
}

test('stopChildProcess accepts a graceful SIGTERM exit', async () => {
  const child = createChild((signal, current) => {
    queueMicrotask(() => emitExit(current, signal));
  });

  const result = await stopChildProcess(child, { graceMs: 50, forceMs: 50 });

  assert.deepEqual(result, { status: 'graceful' });
  assert.deepEqual(child.signals, ['SIGTERM']);
});

test('stopChildProcess escalates a hung child to SIGKILL', async () => {
  const logs = [];
  const child = createChild((signal, current) => {
    if (signal === 'SIGKILL') queueMicrotask(() => emitExit(current, signal));
  });

  const result = await stopChildProcess(child, {
    graceMs: 5,
    forceMs: 50,
    log: (message) => logs.push(message),
  });

  assert.deepEqual(result, { status: 'forced' });
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL']);
  assert.match(logs[0], /did not exit after SIGTERM/);
});

test('stopChildProcess does not signal an already exited child', async () => {
  const child = createChild();
  child.exitCode = 0;

  const result = await stopChildProcess(child);

  assert.deepEqual(result, { status: 'already-exited' });
  assert.deepEqual(child.signals, []);
});

test('stopChildProcess recognizes OS exit when Electron misses the child exit event', async () => {
  let alive = true;
  const child = createChild((signal) => {
    if (signal === 'SIGTERM') alive = false;
  });

  const result = await stopChildProcess(child, {
    graceMs: 100,
    forceMs: 50,
    isProcessAlive: () => alive,
  });

  assert.deepEqual(result, { status: 'graceful' });
  assert.deepEqual(child.signals, ['SIGTERM']);
});
