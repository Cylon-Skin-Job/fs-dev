'use strict';

// Real session owner, OpenCode inert process proxy, canonical bus and wire
// broadcaster. Only durable effect timing and the OS child are controlled.
jest.mock('../../lib/thread/ThreadWebSocketHandler', () => ({ getState: jest.fn() }));
const { EventEmitter } = require('events');
const ThreadWebSocketHandler = require('../../lib/thread/ThreadWebSocketHandler');
const { SessionManager } = require('../../lib/thread/session-manager');
const { SessionLifecycle } = require('../../lib/thread/session-lifecycle');
const { OpenCodeHarness } = require('../../lib/harness/opencode');
const { stopRuntimeTurn } = require('../../lib/thread/runtime-stop');
const { threadRuntimeManager, RUNTIME_STATES } = require('../../lib/thread/thread-runtime-manager');
const { createCanonicalDrainControl, createCanonicalRouteContext } = require('../../lib/thread/canonical-drain-context');
const { createCanonicalChatEventApplier } = require('../../lib/wire/canonical-chat-event-applier');
const { createCanonicalHarnessEventBridge } = require('../../lib/wire/canonical-harness-event-bridge');
const eventBus = require('../../lib/event-bus');
const wires = require('../../lib/wire/process-manager');
const { createWireBroadcaster } = require('../../lib/wire/wire-broadcaster');
const { retainTimedOutSavedDelivery, LATE_SAVED_DELIVERY_MS } = require('../../lib/wire/terminal-saved-delivery');
const flush = () => new Promise(resolve => setImmediate(resolve));
const key = Object.freeze({ workspaceId: 'stop-timeout-workspace', projectRoot: '/tmp/stop-timeout-owned',
  workspaceEpoch: 'stop-timeout-epoch', threadId: 'stop-timeout-thread', scope: 'project' });
const identity = { ...key, turnId: 'stop-timeout-turn' };
let fixture;
let removeEffect;
let releaseEffect;
let savedListenerCount;
let originalListeners;

beforeAll(() => {
  originalListeners = new Map(eventBus.bus.eventNames().map(name => [name, eventBus.bus.listeners(name)]));
  createWireBroadcaster({ getClientForThread: wires.getClientForThread });
  savedListenerCount = eventBus.bus.listenerCount('chat-turn:saved');
});
afterAll(() => {
  for (const name of eventBus.bus.eventNames()) {
    for (const listener of eventBus.bus.listeners(name)) {
      if (!originalListeners.get(name)?.includes(listener)) eventBus.bus.off(name, listener);
    }
  }
});
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'performance'] });
  threadRuntimeManager.runtimes.clear();
});
afterEach(async () => {
  releaseEffect?.(); await flush(); removeEffect?.();
  for (const [id, session] of fixture?.sessions.activeSessions || []) {
    if (session.state === 'stopping') fixture.sessions.completeStoppedSession(id, session.wireProcess);
    else fixture.sessions.closeSession(id);
  }
  wires.unregisterWire(key.threadId, key);
  threadRuntimeManager.runtimes.clear();
  expect(eventBus.bus.listenerCount('chat-turn:saved')).toBe(savedListenerCount);
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers(); fixture = null; removeEffect = null; releaseEffect = null;
});

async function setup() {
  const ws = new EventEmitter(); ws.readyState = 1; ws.send = jest.fn();
  const sessions = new SessionManager();
  const index = { list: async () => [], activate: async () => {}, markResumed: async () => {}, suspend: jest.fn(async () => {}) };
  const lifecycle = new SessionLifecycle({ ...key, index, sessionManager: sessions, mirror: {} });
  const harness = new OpenCodeHarness();
  const harnessSession = await harness.startThread(key.threadId, key.projectRoot, key);
  const proxy = harnessSession.process;
  const proxyExits = jest.fn(); proxy.on('exit', proxyExits);
  let computationActive = true;
  let closed;
  harnessSession.activeProcessClose = new Promise(resolve => { closed = resolve; });
  // The real OpenCode stop method must close its active child; no proxy exit
  // is fabricated to rescue SessionLifecycle's observer.
  const childKill = jest.fn(() => { computationActive = false; closed(); return true; });
  harnessSession.activeProcess = { kill: childKill };
  await lifecycle.openSession(key.threadId, proxy, ws, { workspaceEpoch: key.workspaceEpoch });
  const manager = { ...key,
    getSession: sessions.getSession.bind(sessions), beginSessionRetirement: sessions.beginSessionRetirement.bind(sessions),
    completeStoppedSession: lifecycle.completeStoppedSession.bind(lifecycle),
    reconcileProviderExit: lifecycle.reconcileProviderExit.bind(lifecycle),
  };
  const state = { threadManager: manager, workspaceEpoch: key.workspaceEpoch };
  ThreadWebSocketHandler.getState.mockReturnValue(state);
  wires.registerWire(key.threadId, proxy, key.projectRoot, ws, key);
  const stopHarness = jest.fn(() => harnessSession.stop('SIGTERM'));
  const control = createCanonicalDrainControl({ drainId: 'timeout-drain', runtimeKey: key, stopHarness, touchThreadSession() {} });
  const route = createCanonicalRouteContext({ ...key, workspace: `workspace:${key.workspaceId}`, acceptedUserInput: 'save before Stop cleanup', attachments: [] });
  threadRuntimeManager.claimActiveDrain(key, control, route);
  const applier = createCanonicalChatEventApplier({ emit: eventBus.emit, checkSettingsBounce: () => null, generateTurnId: () => identity.turnId });
  const bridge = createCanonicalHarnessEventBridge({ applyChatEvent: applier.applyChatEvent,
    bindDrainTurn: (ctx, turnId) => threadRuntimeManager.bindTurnToDrain(ctx.control.runtimeKey, ctx.control.drainId, turnId) });
  await bridge.applyHarnessEvent({ type: 'turn_begin' }, ws, { control, route });
  threadRuntimeManager.markInFlight(key);
  fixture = { ws, state, sessions, manager, proxy, proxyExits, childKill, stopHarness, index,
    active: () => computationActive,
    stop: () => stopRuntimeTurn({ ws, session: { workspaceEpoch: key.workspaceEpoch },
      clientMsg: { threadId: key.threadId }, handleCanonicalHarnessEvent: bridge.applyHarnessEvent, returnOutcome: true }),
  };
  return fixture;
}
function holdSave(outcome = 'saved') {
  const gate = new Promise(resolve => { releaseEffect = resolve; });
  removeEffect = eventBus.on('chat:turn_end', async event => {
    await gate;
    if (outcome === 'failed') throw new Error('controlled save failure');
    const { type, timestamp, ...saved } = event;
    eventBus.emit('chat-turn:saved', { ...saved, exchangeId: 7, seq: 1 });
  });
}
function savedFrames(ws) { return ws.send.mock.calls.map(([raw]) => JSON.parse(raw)).filter(frame => frame.type === 'chat-turn:saved'); }
async function expireStop(f) {
  const stopping = f.stop(); await flush();
  expect(f.active()).toBe(true);
  await jest.advanceTimersByTimeAsync(3001);
  expect(await stopping).toBe(true);
  expect(f.active()).toBe(false);
  expect(f.childKill).toHaveBeenCalledWith('SIGTERM');
  expect(f.proxyExits).not.toHaveBeenCalled();
  expect(f.sessions.getSession(key.threadId)).toBeUndefined();
  expect(f.index.suspend).toHaveBeenCalledTimes(1);
  expect(threadRuntimeManager.getRuntimeState(key)).toBe(RUNTIME_STATES.COLD);
  expect(wires.getWireForThread(key.threadId, key)).toBeNull();
}

test.each(['saved', 'failed'])('post-timeout %s effect cannot pin real session/proxy and never invents an ACK', async outcome => {
  const f = await setup(); holdSave(outcome);
  await expireStop(f);
  expect(eventBus.bus.listenerCount('chat-turn:saved')).toBe(savedListenerCount + 1);
  expect(savedFrames(f.ws)).toHaveLength(0);
  releaseEffect(); await flush();
  expect(savedFrames(f.ws)).toHaveLength(outcome === 'saved' ? 1 : 0);
  if (outcome === 'saved') expect(savedFrames(f.ws)[0]).toMatchObject({ turnId: identity.turnId, exchangeId: 7 });
  expect(f.stopHarness).toHaveBeenCalledTimes(1);
});

test('permanently held effect releases delivery listener at30s; later save needs history recovery', async () => {
  const f = await setup(); holdSave(); await expireStop(f);
  await jest.advanceTimersByTimeAsync(LATE_SAVED_DELIVERY_MS + 1);
  expect(eventBus.bus.listenerCount('chat-turn:saved')).toBe(savedListenerCount);
  expect(jest.getTimerCount()).toBe(0);
  releaseEffect(); await flush(); expect(savedFrames(f.ws)).toHaveLength(0);
});

test.each(['runtime', 'connection', 'provider'])('late ACK cannot target replacement %s', async replacement => {
  const f = await setup(); holdSave(); await expireStop(f);
  if (replacement === 'runtime') {
    threadRuntimeManager.claimActiveDrain(key, createCanonicalDrainControl({ drainId: 'replacement-drain', runtimeKey: key,
      stopHarness: jest.fn(), touchThreadSession() {} }), createCanonicalRouteContext({ ...key,
      workspace: `workspace:${key.workspaceId}`, acceptedUserInput: 'replacement', attachments: [] }));
    threadRuntimeManager.markInFlight(key);
  } else if (replacement === 'provider') {
    const replacementProxy = new EventEmitter(); replacementProxy.kill = jest.fn();
    f.sessions.openSession(key.threadId, null, replacementProxy, f.ws);
  } else f.state.workspaceEpoch = 'replacement-epoch';
  releaseEffect(); await flush();
  expect(savedFrames(f.ws)).toHaveLength(0);
  if (replacement === 'runtime') expect(threadRuntimeManager.getRuntimeState(key)).toBe(RUNTIME_STATES.IN_FLIGHT);
});

test('different-turn saved event cannot consume the retained exact-turn delivery', async () => {
  const f = await setup(); holdSave(); await expireStop(f);
  eventBus.emit('chat-turn:saved', { ...identity, turnId: 'another-turn', exchangeId: 11 });
  expect(savedFrames(f.ws)).toHaveLength(0);
  expect(eventBus.bus.listenerCount('chat-turn:saved')).toBe(savedListenerCount + 1);
  releaseEffect(); await flush();
  expect(savedFrames(f.ws)).toHaveLength(1);
  expect(savedFrames(f.ws)[0].turnId).toBe(identity.turnId);
});

test('provider failure cancels fallback without cooling an unproven retirement', async () => {
  const f = await setup(); holdSave();
  f.stopHarness.mockRejectedValueOnce(new Error('controlled provider close failure'));
  const stopping = f.stop(); await flush(); await jest.advanceTimersByTimeAsync(3001);
  expect(await stopping).toBe(false);
  expect(f.active()).toBe(true);
  expect(threadRuntimeManager.getRuntimeState(key)).toBe(RUNTIME_STATES.STOPPING);
  expect(eventBus.bus.listenerCount('chat-turn:saved')).toBe(savedListenerCount);
  releaseEffect(); await flush();
  // Existing ordinary route may deliver a genuine save; cleanup makes no ACK.
  expect(savedFrames(f.ws)).toHaveLength(1);
  f.sessions.completeStoppedSession(key.threadId, f.proxy);
});

test.each(['ordinary', 'send-failed'])('fallback and %s broadcaster race deliver exactly one real ACK', async mode => {
  const f = await setup(); holdSave(); f.ws.send.mockClear();
  // Register the fallback while the normal route still exists, reproducing
  // acknowledgement during teardown rather than only after unregister.
  const cancel = retainTimedOutSavedDelivery({ identity, ws: f.ws, isCurrent: () => true });
  const event = { ...identity, scope: 'project', exchangeId: 9 };
  if (mode === 'send-failed') f.ws.send.mockImplementationOnce(() => { throw new Error('first send failed'); });
  eventBus.emit('chat-turn:saved', event);
  const successful = f.ws.send.mock.results.filter(result => result.type === 'return');
  expect(successful).toHaveLength(1);
  cancel();
});

test('connection close cancels both saved listener and bounded effect-wait timer', async () => {
  const f = await setup(); holdSave(); await expireStop(f);
  f.ws.readyState = 3; f.ws.emit('close'); await flush();
  expect(eventBus.bus.listenerCount('chat-turn:saved')).toBe(savedListenerCount);
  expect(jest.getTimerCount()).toBe(0);
});
