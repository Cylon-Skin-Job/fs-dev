const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { Writable } = require('node:stream');
const test = require('node:test');

const { attachServerWorkspaceBindingChannel, pipeServerOutput } = require('./server-spawn.cjs');

function createChildHarness() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

function createDestination(write) {
  const destination = new EventEmitter();
  destination.write = write;
  destination.destroyed = false;
  destination.writable = true;
  destination.writableEnded = false;
  return destination;
}

function createWorkspaceBindingChannelHarness({ settled = false, killed = false } = {}) {
  const child = new EventEmitter();
  child.killed = killed;
  const workspaceBindingPipe = new EventEmitter();
  const bindings = [];
  const startupFailures = [];
  const establishedFailures = [];
  attachServerWorkspaceBindingChannel({
    child,
    workspaceBindingPipe,
    onBinding: (binding) => bindings.push(binding),
    isStartupSettled: () => settled,
    onStartupFailure: (error) => startupFailures.push(error),
    onEstablishedFailure: (error) => establishedFailures.push(error),
  });
  return { child, workspaceBindingPipe, bindings, startupFailures, establishedFailures };
}

test('fd4 close and error fail startup before settlement and retire authority afterward', () => {
  for (const event of ['end', 'close', 'error']) {
    const before = createWorkspaceBindingChannelHarness();
    const error = new Error(`before ${event}`);
    assert.doesNotThrow(() => before.workspaceBindingPipe.emit(event, error));
    assert.equal(before.startupFailures.length, 1, `${event} must fail startup once`);
    assert.match(before.startupFailures[0].message, /workspace binding channel failed/i);
    assert.equal(before.establishedFailures.length, 0);

    const after = createWorkspaceBindingChannelHarness({ settled: true });
    after.workspaceBindingPipe.emit('data', Buffer.from(
      '{"version":1,"bindingRevision":1,"workspaceId":"workspace-a","repoPath":"/tmp/workspace-a"}\n',
    ));
    assert.equal(after.bindings.length, 1);
    assert.doesNotThrow(() => after.workspaceBindingPipe.emit(event, error));
    assert.equal(after.startupFailures.length, 0);
    assert.equal(after.establishedFailures.length, 1, `${event} must retire established authority once`);
    after.workspaceBindingPipe.emit('close');
    assert.equal(after.establishedFailures.length, 1);
  }
});

test('fd4 lifecycle ignores closure caused by intentional child termination', () => {
  for (const event of ['end', 'close', 'error']) {
    const harness = createWorkspaceBindingChannelHarness({ killed: true });
    assert.doesNotThrow(() => harness.workspaceBindingPipe.emit(event, new Error(event)));
    assert.equal(harness.startupFailures.length, 0);
    assert.equal(harness.establishedFailures.length, 0);
  }
});

test('server output forwarding preserves readiness but emits only fixed stdout/stderr markers', async () => {
  const child = createChildHarness();
  const stdoutWrites = [];
  const stderrWrites = [];
  const readiness = [];
  const stdout = createDestination((value, callback) => {
    stdoutWrites.push(value);
    callback();
  });
  const stderr = createDestination((value, callback) => {
    stderrWrites.push(value);
    callback();
  });

  pipeServerOutput(child, { stdout, stderr, onStdout: (value) => readiness.push(value) });
  assert.equal(stdout.listenerCount('error'), 0);
  assert.equal(stderr.listenerCount('error'), 0);
  const canary = 'REPOSITORY_PROMPT_PAYLOAD_CANARY_00B';
  child.stdout.emit('data', Buffer.from(`${canary}\nSERVER_READY:4567\n`));
  child.stderr.emit('data', Buffer.from(`${canary}\n`));

  assert.deepEqual(readiness, [`${canary}\nSERVER_READY:4567\n`]);
  assert.deepEqual(stdoutWrites, ['[server] output\n']);
  assert.deepEqual(stderrWrites, ['[server:err] output\n']);
  assert.doesNotMatch(stdoutWrites.join(''), new RegExp(canary));
  assert.doesNotMatch(stderrWrites.join(''), new RegExp(canary));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stdout.listenerCount('error'), 0);
  assert.equal(stderr.listenerCount('error'), 0);
});

test('server output forwarding ignores synchronous closed-stream writes without blocking parsing', async () => {
  const child = createChildHarness();
  const readiness = [];
  let writes = 0;
  const stdout = createDestination(() => {
    writes += 1;
    const error = new Error('broken pipe');
    error.code = 'EPIPE';
    throw error;
  });
  const stderr = createDestination((_value, callback) => callback());

  pipeServerOutput(child, { stdout, stderr, onStdout: (value) => readiness.push(value) });
  assert.doesNotThrow(() => child.stdout.emit('data', Buffer.from('SERVER_READY:4567\n')));
  assert.doesNotThrow(() => child.stdout.emit('data', Buffer.from('later\n')));

  assert.deepEqual(readiness, ['SERVER_READY:4567\n', 'later\n']);
  assert.equal(writes, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stdout.listenerCount('error'), 0);
});

test('server output forwarding scopes asynchronous closed-stream guards to pending writes', async () => {
  const child = createChildHarness();
  let stdoutWrites = 0;
  let stderrWrites = 0;
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      stdoutWrites += 1;
      const error = new Error('broken pipe');
      error.code = 'EPIPE';
      queueMicrotask(() => callback(error));
    },
  });
  const stderr = new Writable({
    write(_chunk, _encoding, callback) {
      stderrWrites += 1;
      const error = new Error('destroyed stream');
      error.code = 'ERR_STREAM_DESTROYED';
      queueMicrotask(() => callback(error));
    },
  });

  pipeServerOutput(child, { stdout, stderr });
  assert.equal(stdout.listenerCount('error'), 0);
  assert.equal(stderr.listenerCount('error'), 0);
  child.stdout.emit('data', Buffer.from('first\n'));
  child.stderr.emit('data', Buffer.from('first failure\n'));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stdout.listenerCount('error'), 0);
  assert.equal(stderr.listenerCount('error'), 0);
  child.stdout.emit('data', Buffer.from('second\n'));
  child.stderr.emit('data', Buffer.from('second failure\n'));
  assert.equal(stdoutWrites, 1);
  assert.equal(stderrWrites, 1);
  assert.equal(stdout.listenerCount('error'), 0);
  assert.equal(stderr.listenerCount('error'), 0);

  child.emit('close');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stdout.listenerCount('error'), 0);
  assert.equal(stderr.listenerCount('error'), 0);
  assert.equal(child.stdout.listenerCount('data'), 0);
  assert.equal(child.stderr.listenerCount('data'), 0);
});

test('server output forwarding has no idle guard and reattaches for later real Writable writes', async () => {
  const child = createChildHarness();
  const callbacks = [];
  const stdout = new Writable({
    write(_chunk, _encoding, callback) { callbacks.push(callback); },
  });
  const stderr = new Writable({
    write(_chunk, _encoding, callback) { callback(); },
  });
  const idleError = new Error('unrelated idle broken pipe');
  idleError.code = 'EPIPE';

  pipeServerOutput(child, { stdout, stderr });
  assert.equal(stdout.listenerCount('error'), 0);
  assert.throws(() => stdout.emit('error', idleError), (actual) => actual === idleError);

  child.stdout.emit('data', Buffer.from('first\n'));
  assert.equal(stdout.listenerCount('error'), 1);
  assert.equal(callbacks.length, 1);
  callbacks.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stdout.listenerCount('error'), 0);

  child.stdout.emit('data', Buffer.from('second\n'));
  assert.equal(stdout.listenerCount('error'), 1);
  assert.equal(callbacks.length, 1);
  callbacks.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stdout.listenerCount('error'), 0);

  child.emit('close');
  assert.equal(child.stdout.listenerCount('data'), 0);
  assert.equal(child.stderr.listenerCount('data'), 0);
});

test('server output forwarding retains its EPIPE guard until a closing child write settles', async () => {
  const child = createChildHarness();
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      const error = new Error('late broken pipe');
      error.code = 'EPIPE';
      queueMicrotask(() => callback(error));
    },
  });
  const stderr = new Writable({
    write(_chunk, _encoding, callback) { callback(); },
  });

  pipeServerOutput(child, { stdout, stderr });
  assert.equal(stdout.listenerCount('error'), 0);
  child.stdout.emit('data', Buffer.from('last write\n'));
  assert.equal(stdout.listenerCount('error'), 1);
  child.emit('close');
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(stdout.listenerCount('error'), 0);
  assert.equal(stderr.listenerCount('error'), 0);
  assert.equal(child.stdout.listenerCount('data'), 0);
  assert.equal(child.stderr.listenerCount('data'), 0);
});

test('server output forwarding does not mask synchronous or asynchronous non-closed-stream failures', async () => {
  const child = createChildHarness();
  const syncError = new Error('synchronous disk failure');
  syncError.code = 'ENOSPC';
  const stdout = createDestination(() => { throw syncError; });
  const stderr = createDestination((_value, callback) => callback());
  pipeServerOutput(child, { stdout, stderr });

  assert.throws(
    () => child.stdout.emit('data', Buffer.from('cannot forward\n')),
    (actual) => actual === syncError,
  );
  const asyncError = new Error('asynchronous disk failure');
  asyncError.code = 'ENOSPC';
  assert.throws(() => stdout.emit('error', asyncError), (actual) => actual === asyncError);
  assert.equal(stdout.listenerCount('error'), 0);
  child.emit('close');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stderr.listenerCount('error'), 0);
});

test('server output forwarding surfaces a real Writable non-closed callback error', () => {
  const probe = String.raw`
    const assert = require('node:assert/strict');
    const { EventEmitter } = require('node:events');
    const { Writable } = require('node:stream');
    const { pipeServerOutput } = require('./server-spawn.cjs');

    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const failure = new Error('asynchronous disk failure');
    failure.code = 'ENOSPC';
    const stdout = new Writable({
      write(_chunk, _encoding, callback) {
        queueMicrotask(() => callback(failure));
      },
    });
    const stderr = new Writable({
      write(_chunk, _encoding, callback) { callback(); },
    });

    process.once('uncaughtException', (error) => {
      try {
        assert.equal(error, failure);
        assert.equal(stdout.listenerCount('error'), 0);
        process.stdout.write('SURFACED:ENOSPC:listeners=0\\n', () => process.exit(0));
      } catch (assertionError) {
        process.stderr.write(assertionError.stack + '\\n', () => process.exit(2));
      }
    });

    pipeServerOutput(child, { stdout, stderr });
    child.stdout.emit('data', Buffer.from('cannot forward\\n'));
    setTimeout(() => process.exit(3), 1000);
  `;
  const result = spawnSync(process.execPath, ['-e', probe], {
    cwd: __dirname,
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /SURFACED:ENOSPC:listeners=0/);
});
