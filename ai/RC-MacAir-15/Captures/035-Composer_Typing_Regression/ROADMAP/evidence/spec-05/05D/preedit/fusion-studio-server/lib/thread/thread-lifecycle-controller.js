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
const path = require('path');
const { setSafeTimeout } = require('../background-services/safety');

const STATE_IDLE = 'idle';
const STATE_IN_FLIGHT = 'in_flight';

const SETTINGS_KEY = 'enforcement.thread_idle_timeout_minutes';

// JSON([workspaceId, normalized root, workspaceEpoch, threadId]) → exact owner
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
  const { threadId, workspace, workspaceId, projectRoot, workspaceEpoch, turnId } = event;
  const key = lifecycleKey(event);
  if (!key || typeof projectRoot !== 'string' || !projectRoot
    || typeof workspaceEpoch !== 'string' || !workspaceEpoch
    || typeof turnId !== 'string' || !turnId) return;

  const existing = threads.get(key);
  let previousState;

  if (!existing) {
    previousState = null;
  } else if (existing.state === STATE_IN_FLIGHT
    && existing.projectRoot === projectRoot
    && existing.workspaceEpoch === workspaceEpoch
    && existing.turnId === turnId) {
    return;
  } else {
    previousState = existing.state;
    if (existing.timer) {
      clearTimeout(existing.timer);
    }
  }

  threads.set(key, {
    state: STATE_IN_FLIGHT,
    workspace,
    workspaceId,
    projectRoot,
    workspaceEpoch,
    threadId,
    turnId,
    timer: null,
    lastTransition: Date.now(),
  });

  emit('thread:state_changed', {
    threadId,
    workspace,
    workspaceId,
    projectRoot,
    workspaceEpoch,
    turnId,
    state: STATE_IN_FLIGHT,
    previousState,
  });
  console.log('[ThreadLifecycle] thread:state_changed → in_flight (' + threadId + ')');
}

function handleTurnEnd(event) {
  const { threadId, workspace, workspaceId, projectRoot, workspaceEpoch, turnId } = event;
  const key = lifecycleKey(event);
  if (!key) return;

  const entry = threads.get(key);
  if (!entry || entry.projectRoot !== projectRoot
    || entry.workspaceEpoch !== workspaceEpoch || entry.turnId !== turnId) return;

  entry.state = STATE_IDLE;
  entry.workspace = workspace;
  entry.lastTransition = Date.now();

  scheduleIdleTimer(key);

  emit('thread:state_changed', {
    threadId,
    workspace,
    workspaceId,
    projectRoot,
    workspaceEpoch,
    turnId,
    state: STATE_IDLE,
    previousState: STATE_IN_FLIGHT,
  });
  console.log('[ThreadLifecycle] thread:state_changed → idle (' + threadId + ')');
}

function handleSettingsChanged(event) {
  if (event.key !== SETTINGS_KEY) return;

  idleTimeoutMinutes = event.value;

  let rebased = 0;
  for (const [key, entry] of threads) {
    if (entry.state !== STATE_IDLE) continue;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.lastTransition = Date.now();
    if (idleTimeoutMinutes > 0) {
      scheduleIdleTimer(key);
    }
    rebased++;
  }

  console.log(
    '[ThreadLifecycle] Timeout updated to ' + idleTimeoutMinutes + 'min, rebased ' + rebased + ' idle timers'
  );
}

function scheduleIdleTimer(key) {
  if (idleTimeoutMinutes <= 0) return;
  const entry = threads.get(key);
  if (!entry) return;
  entry.timer = setSafeTimeout(`ThreadLifecycle:idle:${key}`, () => onIdleTimerFire(key), idleTimeoutMinutes * 60_000);
}

function onIdleTimerFire(key) {
  const entry = threads.get(key);
  if (!entry || entry.state !== STATE_IDLE) return;

  const idleMs = Date.now() - entry.lastTransition;
  const { workspace, workspaceId, projectRoot, workspaceEpoch, threadId, turnId } = entry;

  threads.delete(key);

  emit('thread:idle_expired', {
    threadId, workspace, workspaceId, projectRoot, workspaceEpoch, turnId, idleMs,
  });
  console.log(
    '[ThreadLifecycle] Thread ' + threadId + ' idle expired after ' + Math.round(idleMs / 60000) + 'min'
  );
}

function lifecycleKey({ workspaceId, projectRoot, workspaceEpoch, threadId } = {}) {
  if (typeof workspaceId !== 'string' || !workspaceId
    || typeof projectRoot !== 'string' || !projectRoot
    || typeof workspaceEpoch !== 'string' || !workspaceEpoch
    || typeof threadId !== 'string' || !threadId) return null;
  return JSON.stringify([workspaceId, path.resolve(projectRoot), workspaceEpoch, threadId]);
}

function getThreadState(workspaceId, threadId, projectRoot = null, workspaceEpoch = null) {
  if (projectRoot && workspaceEpoch) {
    return threads.get(lifecycleKey({ workspaceId, projectRoot, workspaceEpoch, threadId })) ?? null;
  }
  // Legacy diagnostics/tests may omit the newer identity only when exactly
  // one live record matches; ambiguity is fail-closed.
  const matches = [...threads.values()].filter((entry) => (
    entry.workspaceId === workspaceId && entry.threadId === threadId
  ));
  return matches.length === 1 ? matches[0] : null;
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
