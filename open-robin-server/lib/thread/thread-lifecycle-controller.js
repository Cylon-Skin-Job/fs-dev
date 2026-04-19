/**
 * Thread Lifecycle Controller — bus observer for per-thread IDLE/IN_FLIGHT state.
 *
 * Subscribes to chat:turn_begin / chat:turn_end to track each thread's state,
 * manages a per-thread idle timer, and emits thread:* lifecycle events for
 * downstream consumers (future thread-eviction-controller, workspace-broadcaster).
 *
 * Additive to SessionManager — does not evict threads, does not touch wires.
 *
 * See: docs/THREAD_LIFECYCLE_SPEC.md
 */

const { on, emit } = require('../event-bus');

const STATE_IDLE = 'idle';
const STATE_IN_FLIGHT = 'in_flight';

const SETTINGS_KEY = 'enforcement.thread_idle_timeout_minutes';

// threadId → { state, workspace, timer, lastTransition }
const threads = new Map();

let idleTimeoutMinutes = 45;

/**
 * Start the thread lifecycle controller.
 * Call once during server boot, after the event bus is available and after
 * the audit subscriber / wire broadcaster have started.
 *
 * @param {object} [config]
 * @param {number} [config.idleTimeoutMinutes=45]
 */
function startThreadLifecycle(config = {}) {
  if (config.idleTimeoutMinutes !== undefined) {
    idleTimeoutMinutes = config.idleTimeoutMinutes;
  }

  on('chat:turn_begin', handleTurnBegin);
  on('chat:turn_end', handleTurnEnd);
  on('settings:enforcement_changed', handleSettingsChanged);

  console.log('[ThreadLifecycle] Started (timeout: ' + idleTimeoutMinutes + 'min)');
}

function handleTurnBegin(event) {
  const { threadId, workspace } = event;
  if (!threadId) return;

  const existing = threads.get(threadId);
  let previousState;

  if (!existing) {
    previousState = null;
  } else if (existing.state === STATE_IN_FLIGHT) {
    return;
  } else {
    previousState = STATE_IDLE;
    if (existing.timer) {
      clearTimeout(existing.timer);
    }
  }

  threads.set(threadId, {
    state: STATE_IN_FLIGHT,
    workspace,
    timer: null,
    lastTransition: Date.now(),
  });

  emit('thread:state_changed', {
    threadId,
    workspace,
    state: STATE_IN_FLIGHT,
    previousState,
  });
  console.log('[ThreadLifecycle] thread:state_changed → in_flight (' + threadId + ')');
}

function handleTurnEnd(event) {
  const { threadId, workspace } = event;
  if (!threadId) return;

  const entry = threads.get(threadId);
  if (!entry) return;

  entry.state = STATE_IDLE;
  entry.workspace = workspace;
  entry.lastTransition = Date.now();

  scheduleIdleTimer(threadId);

  emit('thread:state_changed', {
    threadId,
    workspace,
    state: STATE_IDLE,
    previousState: STATE_IN_FLIGHT,
  });
  console.log('[ThreadLifecycle] thread:state_changed → idle (' + threadId + ')');
}

function handleSettingsChanged(event) {
  if (event.key !== SETTINGS_KEY) return;

  idleTimeoutMinutes = event.value;

  let rebased = 0;
  for (const [threadId, entry] of threads) {
    if (entry.state !== STATE_IDLE) continue;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.lastTransition = Date.now();
    if (idleTimeoutMinutes > 0) {
      scheduleIdleTimer(threadId);
    }
    rebased++;
  }

  console.log(
    '[ThreadLifecycle] Timeout updated to ' + idleTimeoutMinutes + 'min, rebased ' + rebased + ' idle timers'
  );
}

function scheduleIdleTimer(threadId) {
  if (idleTimeoutMinutes <= 0) return;
  const entry = threads.get(threadId);
  if (!entry) return;
  entry.timer = setTimeout(() => onIdleTimerFire(threadId), idleTimeoutMinutes * 60_000);
}

function onIdleTimerFire(threadId) {
  const entry = threads.get(threadId);
  if (!entry || entry.state !== STATE_IDLE) return;

  const idleMs = Date.now() - entry.lastTransition;
  const workspace = entry.workspace;

  threads.delete(threadId);

  emit('thread:idle_expired', { threadId, workspace, idleMs });
  console.log(
    '[ThreadLifecycle] Thread ' + threadId + ' idle expired after ' + Math.round(idleMs / 60000) + 'min'
  );
}

function getThreadState(threadId) {
  return threads.get(threadId) ?? null;
}

function getTrackedCount() {
  return threads.size;
}

function getIdleCount() {
  let count = 0;
  for (const entry of threads.values()) {
    if (entry.state === STATE_IDLE) count++;
  }
  return count;
}

function getInFlightCount() {
  let count = 0;
  for (const entry of threads.values()) {
    if (entry.state === STATE_IN_FLIGHT) count++;
  }
  return count;
}

module.exports = {
  startThreadLifecycle,
  getThreadState,
  getTrackedCount,
  getIdleCount,
  getInFlightCount,
};
