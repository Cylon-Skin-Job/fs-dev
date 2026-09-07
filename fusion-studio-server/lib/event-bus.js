/**
 * Event Bus — central pub/sub for all server-side cross-module communication.
 *
 * This is the backbone of the system. All chat events, workspace lifecycle,
 * thread lifecycle, ticket dispatch, agent runs, and user-defined automations
 * flow through this bus.
 *
 * Emitters: wire message router, all harnesses (kimi, claude-code, gemini,
 *           codex, qwen, robin), client message router, runner, dispatch
 * Listeners: wire-broadcaster, audit-subscriber, trigger-loader,
 *            (future) workspace/thread lifecycle controllers
 *
 * Governed facts use a separately admitted, private delivery path attached to
 * this singleton by lib/subscriptions/host-bootstrap. That path deliberately
 * does not call emit() or on(), so legacy callers cannot forge an admitted
 * fact. The public compatibility surface below remains unchanged.
 */

const EventEmitter = require('events');
const { performance } = require('perf_hooks');
const { runSafely } = require('./background-services/safety');

const bus = new EventEmitter();
bus.setMaxListeners(200);

const MAX_CHAIN_DEPTH = 5;
let currentDepth = 0;
const inFlightEffects = new Map();

// Same-event suppression: track the triggering event in the current chain
let currentTrigger = null;

/**
 * Extract the key field from event data for dedup comparison.
 * CHAT_SCOPE_SPEC: `workspaceId` is added at the end (forward-compat) so that
 * future workspace-lifecycle events don't accidentally dedup against unrelated
 * entity events when multi-workspace ships.
 */
function eventKey(data) {
  return data.ticketId ?? data.threadId ?? data.runId ?? data.workspaceId ?? null;
}

/**
 * Check if this emit is a duplicate of the event that triggered it.
 * Suppresses A→action→A loops on the same entity.
 */
function isSameEventLoop(type, data) {
  if (!currentTrigger) return false;
  if (type !== currentTrigger.type) return false;
  const key = eventKey(data);
  const triggerKey = eventKey(currentTrigger);
  return key !== null && key === triggerKey;
}

/**
 * Emit an event on the bus.
 *
 * @param {string} type - Event type (e.g. 'chat:turn_end', 'ticket:claimed')
 * @param {Object} data - Event payload (merged with type + timestamp)
 */
function emit(type, data = {}) {
  if (currentDepth >= MAX_CHAIN_DEPTH) {
    console.warn(`[EventBus] Max chain depth (${MAX_CHAIN_DEPTH}) reached, dropping: ${type}`);
    return;
  }

  if (isSameEventLoop(type, data)) {
    console.warn(`[EventBus] Same-event loop suppressed: ${type}`);
    return;
  }

  const event = { type, timestamp: Date.now(), ...data };
  const previousTrigger = currentTrigger;
  currentTrigger = event;
  currentDepth++;
  try {
    emitSafely(type, event);
    emitSafely('*', event);
  } finally {
    currentDepth--;
    currentTrigger = previousTrigger;
  }
}

function emitSafely(type, event) {
  for (const listener of bus.listeners(type)) {
    const result = runSafely(`EventBus:${type}`, () => listener(event));
    trackEffect(event, result);
  }
}

function exactEffectKey(event) {
  if (!event || typeof event.workspaceId !== 'string' || !event.workspaceId
    || typeof event.projectRoot !== 'string' || !event.projectRoot
    || typeof event.workspaceEpoch !== 'string' || !event.workspaceEpoch
    || typeof event.threadId !== 'string' || !event.threadId
    || typeof event.turnId !== 'string' || !event.turnId) return null;
  return JSON.stringify([
    event.workspaceId, event.projectRoot, event.workspaceEpoch, event.threadId, event.turnId,
  ]);
}

function trackEffect(event, result) {
  if (!result || typeof result.then !== 'function') return;
  const key = exactEffectKey(event);
  if (!key) return;
  let effects = inFlightEffects.get(key);
  if (!effects) {
    effects = new Set();
    inFlightEffects.set(key, effects);
  }
  const tracked = Promise.resolve(result).then(() => true, () => false);
  effects.add(tracked);
  tracked.finally(() => {
    effects.delete(tracked);
    if (effects.size === 0 && inFlightEffects.get(key) === effects) {
      inFlightEffects.delete(key);
    }
  });
}

async function drainEventEffects(identity, {
  timeoutMs = 3_000,
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const key = exactEffectKey(identity);
  if (!key) return Object.freeze({ drained: false });
  const deadline = monotonicNow() + Math.max(0, timeoutMs);
  while (true) {
    const effects = inFlightEffects.get(key);
    if (!effects || effects.size === 0) return Object.freeze({ drained: true });
    const remaining = Math.max(0, deadline - monotonicNow());
    if (remaining <= 0) return Object.freeze({ drained: false });
    let timer;
    const completed = await Promise.race([
      Promise.allSettled([...effects]).then(() => true),
      new Promise((resolve) => {
        timer = setTimer(() => resolve(false), remaining);
        timer?.unref?.();
      }),
    ]);
    if (timer) clearTimer(timer);
    if (!completed) return Object.freeze({ drained: false });
  }
}

/**
 * Listen for events of a given type.
 *
 * @param {string} type - Event type to listen for, or '*' for all events
 * @param {Function} handler - Called with the event object
 * @returns {Function} Unsubscribe function
 */
function on(type, handler) {
  bus.on(type, handler);
  return () => bus.off(type, handler);
}

const publicApi = { emit, on, bus };
Object.defineProperty(publicApi, 'drainEventEffects', {
  value: drainEventEffects,
  enumerable: false,
});
module.exports = publicApi;
