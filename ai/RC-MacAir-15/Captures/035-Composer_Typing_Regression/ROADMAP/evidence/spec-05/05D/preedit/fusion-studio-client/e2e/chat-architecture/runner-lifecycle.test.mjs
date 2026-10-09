import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  assertDisposablePath,
  assertOwnedPid,
  assertSafePort,
  isPidRunning,
  markOwnedDirectory,
  runOwnedCommand,
} from './fixture-lifecycle.mjs';

const helper = path.join(import.meta.dirname, 'lifecycle-probe-child.mjs');
const runner = path.join(import.meta.dirname, 'run.mjs');
const supervisor = path.join(import.meta.dirname, 'owned-case-supervisor.mjs');
const require = createRequire(import.meta.url);
const {
  FIXTURE_GATE_OWNERS,
  DEFAULT_EVENT_SCRIPT,
  OpenCodeHarness,
  evaluateFixtureFaultGate,
  parseFixtureFaultSchedule,
  resetFixtureFaultGateCounts,
} = require('./deterministic-opencode-adapter.cjs');

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function execute(behavior, { deadlineMs = 5_000, interrupt = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-architecture-lifecycle-'));
  const token = `chat-architecture-probe-${process.pid}-${Date.now()}-${behavior}`;
  const profile = path.join(base, 'profile');
  const receipt = path.join(base, 'receipt.json');
  const log = path.join(base, 'probe.log');
  const controller = new AbortController();
  const pending = runOwnedCommand({
    command: process.execPath,
    args: [helper, token, behavior, profile, receipt, token],
    cwd: import.meta.dirname,
    env: process.env,
    token,
    logPath: log,
    deadlineMs,
    signal: controller.signal,
    progressMs: 50,
  });
  if (interrupt) setTimeout(() => controller.abort(), 100);
  const result = await pending;
  const record = JSON.parse(fs.readFileSync(receipt, 'utf8'));
  assert.equal(record.phase, 'clean');
  assert.equal(record.dbClosed, true);
  assert.equal(record.profileRemoved, true);
  assert.equal(isPidRunning(record.grandchildPid), false);
  assert.equal(isPidRunning(result.pid), false);
  assert.deepEqual(result.leakedOwnedPids, []);
  fs.rmSync(base, { recursive: true, force: true });
  return { result, record };
}

test('success cleanup closes the fixture database and owned process tree', async () => {
  const { result, record } = await execute('success');
  assert.equal(result.code, 0);
  assert.equal(record.reason, 'success');
});

test('assertion cleanup closes the fixture database and propagates failure', async () => {
  const { result, record } = await execute('assertion');
  assert.equal(result.code, 1);
  assert.equal(record.reason, 'assertion');
});

test('deadline cleanup terminates only the owned tree', async () => {
  const { result, record } = await execute('hang', { deadlineMs: 120 });
  assert.equal(result.timedOut, true);
  assert.equal(record.reason, 'timeout');
});

test('interrupt cleanup terminates only the owned tree', async () => {
  const { result, record } = await execute('hang', { interrupt: true });
  assert.equal(result.interrupted, true);
  assert.equal(record.reason, 'interrupt');
});

test('owner-PID watchdog cleans the owned tree when its supervisor disappears without a cooperative child signal', async () => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-architecture-parent-loss-'));
  const base = path.join(outer, 'owned-run');
  const profile = path.join(base, 'profile');
  const receipt = path.join(outer, 'receipt.json');
  const token = `chat-architecture-parent-loss-${process.pid}-${Date.now()}`;
  markOwnedDirectory(base, token, 'parent-loss-run');
  const owner = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const watcher = spawn(process.execPath, [
    supervisor, token, String(owner.pid), base, helper,
    token, 'hang', profile, receipt, token,
  ], { cwd: import.meta.dirname, stdio: 'ignore' });
  try {
    await waitFor(() => fs.existsSync(receipt), 5_000, 'parent-loss probe start');
    const running = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    assert.equal(running.phase, 'running');
    owner.kill('SIGKILL');
    await waitFor(() => watcher.exitCode !== null || watcher.signalCode !== null, 7_000, 'watchdog exit');
    const clean = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    assert.equal(clean.phase, 'clean');
    assert.equal(clean.dbClosed, true);
    assert.equal(clean.profileRemoved, true);
    assert.equal(isPidRunning(clean.probePid), false);
    assert.equal(isPidRunning(clean.grandchildPid), false);
    assert.equal(fs.existsSync(base), false);
    assert.equal(isPidRunning(watcher.pid), false);
    assert.notEqual(watcher.exitCode, 0);
  } finally {
    if (isPidRunning(owner.pid)) owner.kill('SIGKILL');
    if (isPidRunning(watcher.pid)) watcher.kill('SIGKILL');
    fs.rmSync(outer, { recursive: true, force: true });
  }
});

test('refuses reserved live paths, port 3001, and an unrelated existing PID', () => {
  assert.throws(
    () => assertDisposablePath('/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/data/fusion.db', 'wrong'),
    /refusing live path/,
  );
  assert.throws(() => assertSafePort(3001), /reserved/);
  assert.throws(() => assertOwnedPid(process.pid, 'not-in-this-process-command'), /refusing unrelated pid/);
});

test('runner fails closed for unknown flags and case IDs before creating a run', () => {
  const unknownFlag = spawnSync(process.execPath, [runner, '--suite', 'baseline', '--mode', 'characterize', '--wat', '1'], {
    encoding: 'utf8',
  });
  assert.notEqual(unknownFlag.status, 0);
  assert.match(unknownFlag.stderr, /unknown flag: --wat/);
  const unknownCase = spawnSync(process.execPath, [runner, '--suite', 'baseline', '--mode', 'characterize', '--cases', 'NOPE'], {
    encoding: 'utf8',
  });
  assert.notEqual(unknownCase.status, 0);
  assert.match(unknownCase.stderr, /unknown case: NOPE/);
});

test('fault schedule names every gate and keeps transport, server, and adapter injection distinct', async () => {
  assert.deepEqual(FIXTURE_GATE_OWNERS, {
    'before-admission': 'server',
    'after-admission': 'server',
    'before-ack': 'transport',
    'after-ack': 'transport',
    'before-dispatch': 'adapter',
    'after-dispatch': 'adapter',
    'before-turn-begin': 'adapter',
    'after-turn-begin': 'adapter',
    'before-stop': 'adapter',
    'after-stop': 'adapter',
    'before-save-ack': 'server',
    'after-save-ack': 'transport',
    'before-shutdown': 'adapter',
    'after-shutdown': 'adapter',
  });
  const previous = process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE;
  process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE = JSON.stringify({
    'before-admission': { action: 'throw' },
    'after-ack': { action: 'drop' },
  });
  try {
    resetFixtureFaultGateCounts();
    const schedule = parseFixtureFaultSchedule();
    await assert.rejects(
      evaluateFixtureFaultGate(schedule, 'before-admission', 'server'),
      /deterministic server fault/,
    );
    assert.deepEqual(
      await evaluateFixtureFaultGate(schedule, 'after-ack', 'transport'),
      { dropped: true, gate: 'after-ack', owner: 'transport', occurrence: 1 },
    );
    await assert.rejects(
      evaluateFixtureFaultGate(schedule, 'after-ack', 'server'),
      /belongs to transport, not server/,
    );
  } finally {
    if (previous === undefined) delete process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE;
    else process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE = previous;
  }
});

test('deterministic adapter emits bounded 20 fps text plus thinking, tool, usage, and terminal events', async () => {
  assert.equal(DEFAULT_EVENT_SCRIPT.frameIntervalMs, 50);
  assert.equal(DEFAULT_EVENT_SCRIPT.textFrames, 100);
  const previousScript = process.env.FUSION_CHAT_ARCH_EVENT_SCRIPT;
  const previousSchedule = process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE;
  process.env.FUSION_CHAT_ARCH_EVENT_SCRIPT = JSON.stringify({ frameIntervalMs: 50, textFrames: 3 });
  process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE = '{}';
  resetFixtureFaultGateCounts();
  const harness = new OpenCodeHarness();
  try {
    const session = await harness.startThread('fixture-thread', '/tmp/fixture-project');
    const events = [];
    const startedAt = Date.now();
    for await (const event of session.sendMessage('hello')) events.push(event);
    const elapsedMs = Date.now() - startedAt;
    const types = events.map((event) => event.type);
    for (const type of ['turn_begin', 'thinking', 'tool_call', 'tool_call_args', 'tool_result', 'status_update', 'turn_end']) {
      assert.ok(types.includes(type), `missing ${type}`);
    }
    const text = events.filter((event) => event.type === 'content');
    assert.equal(text.length, 3);
    assert.ok(text.every((event) => Buffer.byteLength(event.text, 'utf8') <= 200));
    assert.ok(elapsedMs >= 140, `configured 20 fps cadence was not observed (${elapsedMs}ms)`);
    assert.ok(elapsedMs < 2_000, `bounded script exceeded its cadence bound (${elapsedMs}ms)`);
    assert.equal(events.at(-1).type, 'turn_end');
    assert.equal(events.at(-1).reason, 'complete');
    assert.deepEqual(events.find((event) => event.type === 'status_update').tokenUsage, {
      inputTokens: 10, outputTokens: 5, totalTokens: 15,
    });
  } finally {
    await harness.dispose();
    if (previousScript === undefined) delete process.env.FUSION_CHAT_ARCH_EVENT_SCRIPT;
    else process.env.FUSION_CHAT_ARCH_EVENT_SCRIPT = previousScript;
    if (previousSchedule === undefined) delete process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE;
    else process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE = previousSchedule;
  }
});
