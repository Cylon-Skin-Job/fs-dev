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
 */

const EventEmitter = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200);

const MAX_CHAIN_DEPTH = 5;
let currentDepth = 0;

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
    bus.emit(type, event);
    bus.emit('*', event);
  } finally {
    currentDepth--;
    currentTrigger = previousTrigger;
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

module.exports = { emit, on, bus };
