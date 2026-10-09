'use strict';

// Real accepted-before-turn_begin drain, bound Stop, bounded provider close and
// session lifecycle. Only the OS child boundary and metadata store are fakes.
jest.mock('../../lib/thread/ThreadWebSocketHandler', () => ({ getState: () => null }));
const { EventEmitter } = require('node:events');
const { SessionManager } = require('../../lib/thread/session-manager');
const { SessionLifecycle } = require('../../lib/thread/session-lifecycle');
const { threadRuntimeManager: runtime } = require('../../lib/thread/thread-runtime-manager');
const { stopRuntimeTurn } = require('../../lib/thread/runtime-stop');
const { terminateProviderProcessAndWait } = require('../../lib/thread/provider-termination');
const { createCanonicalDrainControl, createCanonicalRouteContext } = require('../../lib/thread/canonical-drain-context');
const fixtures = [];
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  for (const f of fixtures.splice(0)) {
    for (const timer of f.sessions.timeouts.values()) clearTimeout(timer);
    f.sessions.timeouts.clear(); f.sessions.activeSessions.clear();
  }
  runtime.runtimes.clear(); jest.useRealTimers();
});

async function setup() {
  const key = { workspaceId: 'exited-drain', projectRoot: '/tmp/exited-drain-fixture',
    workspaceEpoch: 'epoch-1', scope: 'project', threadId: 'thread' };
  const sessions = new SessionManager();
  const index = { list: jest.fn(async () => []), activate: jest.fn(async () => {}),
    markResumed: jest.fn(async () => {}), suspend: jest.fn(async () => {}) };
  const lifecycle = new SessionLifecycle({ ...key, index, sessionManager: sessions, mirror: {} });
  const wire = new EventEmitter(); wire.kill = jest.fn(() => true);
  const ws = { readyState: 1, send: jest.fn() };
  const session = await lifecycle.openSession(key.threadId, wire, ws, { workspaceEpoch: key.workspaceEpoch });
  const operations = { ...key, getSession: sessions.getSession.bind(sessions),
    beginSessionRetirement: sessions.beginSessionRetirement.bind(sessions),
    completeStoppedSession: lifecycle.completeStoppedSession.bind(lifecycle),
    reconcileProviderExit: lifecycle.reconcileProviderExit.bind(lifecycle) };
  const stopHarness = jest.fn(() => terminateProviderProcessAndWait(wire, 10, 10));
  const control = createCanonicalDrainControl({ drainId: 'prebegin-drain', runtimeKey: key,
    touchThreadSession() {}, stopHarness });
  const route = createCanonicalRouteContext({ ...key, workspace: 'workspace:exited-drain',
    acceptedUserInput: 'fixture accepted prompt', attachments: [] });
  runtime.claimActiveDrain(key, control, route); runtime.markInFlight(key);
  const ownership = runtime.captureOwnership(key);
  let complete; let reject;
  const completion = new Promise((resolve, fail) => { complete = resolve; reject = fail; });
  // Production iterator tasks have a consumer even if retirement fails first.
  completion.catch(() => {});
  runtime.bindActiveDrainLifecycle(key, control.drainId, { completion,
    retire: () => stopRuntimeTurn({ ws, session: { workspaceEpoch: key.workspaceEpoch },
      clientMsg: { threadId: key.threadId }, allowInactiveDrain: true, returnOutcome: true,
      runtimeBinding: { sessions: operations, wire, runtimeKey: key, drainId: control.drainId, ownership } }) });
  const f = { key, sessions, index, lifecycle, wire, ws, session, control, stopHarness, complete, reject };
  fixtures.push(f); return f;
}

async function failInitialClose(f) {
  const closing = expect(f.lifecycle.closeSession(f.key.threadId)).rejects.toThrow('Canonical drain retirement failed');
  await jest.advanceTimersByTimeAsync(21); await closing;
  expect(f.sessions.getSession(f.key.threadId)).toBe(f.session);
  expect(f.session.state).toBe('stopping');
  expect(runtime.getRuntimeState(f.key)).toBe('stopping');
  expect(runtime.getActiveDrain(f.key)).not.toBeNull();
  expect(f.sessions.timeouts.size).toBe(0);
  expect(f.index.suspend).not.toHaveBeenCalled();
  expect(f.stopHarness).toHaveBeenCalledTimes(1);
}
function exit(f) { f.wire.exitCode = 0; f.wire.emit('exit', 0, null); return f.session.exitReconciliation; }
function expectReleased(f) {
  expect(f.sessions.getSession(f.key.threadId)).toBeUndefined();
  expect(runtime.getRuntimeState(f.key)).toBe('cold');
  expect(runtime.getActiveDrain(f.key)).toBeNull();
  expect(f.index.suspend).toHaveBeenCalledTimes(1);
  expect(f.stopHarness).toHaveBeenCalledTimes(1);
  expect(f.wire.kill).toHaveBeenCalledTimes(2);
  expect(f.ws.send).not.toHaveBeenCalled();
}

test.each(['fulfilled', 'rejected'])('exact late exit recovers the failed real Stop after iterator %s', async outcome => {
  const f = await setup(); await failInitialClose(f);
  if (outcome === 'fulfilled') f.complete(); else f.reject(new Error('iterator failed'));
  await exit(f); expectReleased(f);
});

test('exit waits for delayed iterator settlement before clearing the drain or suspending', async () => {
  const f = await setup(); await failInitialClose(f);
  const recovering = exit(f); await jest.advanceTimersByTimeAsync(4_000);
  expect(runtime.getActiveDrain(f.key)).not.toBeNull();
  expect(f.index.suspend).not.toHaveBeenCalled();
  f.complete(); await recovering; expectReleased(f);
});

test('pending iterator times out boundedly, remains discoverable and permits retry after settlement', async () => {
  const f = await setup(); await failInitialClose(f);
  const recovering = expect(exit(f)).rejects.toThrow('Canonical drain did not retire in time');
  await jest.advanceTimersByTimeAsync(5_001); await recovering; await flush();
  expect(runtime.getActiveDrain(f.key)).not.toBeNull();
  expect(f.sessions.getSession(f.key.threadId)).toBe(f.session);
  expect(f.index.suspend).not.toHaveBeenCalled();
  f.complete(); await expect(f.lifecycle.closeSession(f.key.threadId)).resolves.toBe(true);
  expectReleased(f);
});

test('metadata failure retains the exited session; exact retry suspends before admission release', async () => {
  const f = await setup(); await failInitialClose(f); f.complete();
  f.index.suspend.mockRejectedValueOnce(new Error('metadata unavailable'));
  await expect(exit(f)).rejects.toThrow('metadata unavailable'); await flush();
  expect(f.sessions.getSession(f.key.threadId)).toBe(f.session);
  expect(runtime.getRuntimeState(f.key)).toBe('stopping');
  expect(runtime.getActiveDrain(f.key)).toBeNull();
  await expect(f.lifecycle.closeSession(f.key.threadId)).resolves.toBe(true);
  expect(f.sessions.getSession(f.key.threadId)).toBeUndefined();
  expect(runtime.getRuntimeState(f.key)).toBe('cold');
  expect(f.index.suspend).toHaveBeenCalledTimes(2);
  expect(f.stopHarness).toHaveBeenCalledTimes(1);
});

test('active Stop token reserves cleanup even after exact exit and settled iterator', async () => {
  const f = await setup(); await failInitialClose(f); f.complete(); f.session.stopFinalization = {};
  expect(exit(f)).toBeUndefined();
  await expect(f.lifecycle.closeSession(f.key.threadId)).resolves.toBe(false);
  expect(f.index.suspend).not.toHaveBeenCalled();
  delete f.session.stopFinalization; f.lifecycle.reconcileProviderExit(f.key.threadId, f.session);
  await f.session.exitReconciliation; expectReleased(f);
});

test.each(['session', 'wire', 'epoch', 'runtime', 'drain'])('delayed completion cannot clear, suspend or release a replacement %s', async kind => {
  const f = await setup(); await failInitialClose(f); const recovering = exit(f); await flush();
  let replacement;
  if (kind === 'session') {
    replacement = { ...f.session, wireProcess: { kill: jest.fn() }, workspaceEpoch: 'epoch-2' };
    f.sessions.activeSessions.set(f.key.threadId, replacement);
  } else if (kind === 'wire') {
    replacement = { kill: jest.fn() }; f.session.wireProcess = replacement;
  } else if (kind === 'epoch') {
    f.session.workspaceEpoch = 'epoch-2';
  } else {
    if (kind === 'runtime') runtime.runtimes.delete(runtime.makeKey(f.key));
    runtime.claimActiveDrain(f.key, { drainId: 'replacement-drain' }); runtime.markInFlight(f.key);
    replacement = runtime.getActiveDrain(f.key);
  }
  f.complete(); await expect(recovering).resolves.toBe(false);
  expect(f.index.suspend).not.toHaveBeenCalled();
  expect(f.stopHarness).toHaveBeenCalledTimes(1);
  if (kind === 'session') expect(f.sessions.getSession(f.key.threadId)).toBe(replacement);
  else if (kind === 'wire' || kind === 'epoch') {
    expect(f.sessions.getSession(f.key.threadId)).toBe(f.session);
    expect(runtime.getActiveDrain(f.key).drainId).toBe(f.control.drainId);
    expect(runtime.getRuntimeState(f.key)).toBe('stopping');
    if (kind === 'wire') expect(replacement.kill).not.toHaveBeenCalled();
  }
  else { expect(runtime.getActiveDrain(f.key)).toBe(replacement); expect(runtime.getRuntimeState(f.key)).toBe('in_flight'); }
});

test('a replacement drain during suspension cannot be cooled or release its session', async () => {
  const f = await setup(); await failInitialClose(f); f.complete();
  let finishMetadata; f.index.suspend.mockImplementationOnce(() => new Promise(resolve => { finishMetadata = resolve; }));
  const recovering = exit(f); await flush(); expect(f.index.suspend).toHaveBeenCalledTimes(1);
  runtime.claimActiveDrain(f.key, { drainId: 'new-during-metadata' }); runtime.markInFlight(f.key);
  finishMetadata(); await expect(recovering).resolves.toBe(false);
  expect(f.sessions.getSession(f.key.threadId)).toBe(f.session);
  expect(runtime.getActiveDrain(f.key).drainId).toBe('new-during-metadata');
  expect(runtime.getRuntimeState(f.key)).toBe('in_flight');
});
