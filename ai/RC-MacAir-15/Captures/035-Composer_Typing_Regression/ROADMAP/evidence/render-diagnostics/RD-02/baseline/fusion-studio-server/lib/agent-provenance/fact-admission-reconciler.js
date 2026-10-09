'use strict';

const { performance } = require('perf_hooks');
const { AgentFactConflictError } = require('./fact-authority-repository');

const BATCH_LIMIT = 100;
const STARTUP_BUDGET_MS = 1_000;
const RETRY_DELAY_MS = 1_000;
const SHUTDOWN_TIMEOUT_MS = 2_000;
const SELECTOR_KEY = 'selector:pending-agent-facts';

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createAgentFactAdmissionReconciler({
  authority,
  writeDiagnostic = () => {},
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (!authority?.listPending || !authority?.createPublishInput || !authority?.markConflict) {
    throw new TypeError('agent fact authority is required');
  }
  let publishers = null;
  let accepting = true;
  let active = null;
  let continuation = null;
  let continuationsEnabled = true;
  let continuationRequested = false;
  const delayed = new Map();
  const suppressed = new Set();
  const retryUsed = new Set();
  const publisherFailures = new WeakMap();

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  function installPublishers(value) {
    if (publishers) throw new Error('Agent fact publishers are already installed');
    const keys = value && Object.keys(value).sort();
    if (!keys || keys.join(',') !== 'publishAgentToolCompleted,publishResourceStateObserved'
      || typeof value.publishAgentToolCompleted !== 'function'
      || typeof value.publishResourceStateObserved !== 'function') {
      throw new TypeError('exact sealed agent fact publishers are required');
    }
    publishers = Object.freeze({ ...value });
  }

  function publisherFor(kind) {
    if (!publishers) throw new Error('Agent fact publishers are not installed');
    return kind === 'tool'
      ? publishers.publishAgentToolCompleted
      : publishers.publishResourceStateObserved;
  }

  function delayOrSuppress(source, retryable = true) {
    if (!accepting) return true;
    const key = source.key;
    if (!retryable || retryUsed.has(key)) {
      suppressed.add(key);
      diagnose('agent_fact_admission_failed');
      return false;
    }
    retryUsed.add(key);
    const timer = setTimer(() => {
      delayed.delete(key);
      if (accepting) signal();
    }, RETRY_DELAY_MS);
    timer?.unref?.();
    delayed.set(key, timer);
    return true;
  }

  async function persistConflict(source) {
    if (!accepting) return Object.freeze({ stop: true });
    try {
      await authority.markConflict(source.kind, source.eventId);
      diagnose('agent_fact_admission_conflict');
      return Object.freeze({ stop: false });
    } catch (error) {
      return Object.freeze({
        stop: delayOrSuppress(source, error?.code === 'agent_fact_admission_transition_failed'
          || error?.code === 'SQLITE_BUSY'),
      });
    }
  }

  async function processOne(source) {
    try {
      const input = await authority.createPublishInput(source.kind, source.eventId);
      if (!accepting) return Object.freeze({ stop: true });
      const result = await publisherFor(source.kind)(input);
      if (!accepting) return Object.freeze({ stop: true });
      if (result?.admitted === true) return Object.freeze({ stop: false });
      const failure = publisherFailures.get(input.reservation);
      publisherFailures.delete(input.reservation);
      if (failure?.kind === 'operational') {
        return Object.freeze({ stop: delayOrSuppress(source, failure.retryable) });
      }
      return persistConflict(source);
    } catch (error) {
      if (!accepting) return Object.freeze({ stop: true });
      if (error instanceof AgentFactConflictError || error?.code === 'agent_fact_admission_conflict') {
        return persistConflict(source);
      }
      return Object.freeze({
        stop: delayOrSuppress(source, error?.code === 'agent_fact_admission_transition_failed'
          || error?.code === 'SQLITE_BUSY'),
      });
    }
  }

  async function drain({ startup = false } = {}) {
    if (!accepting) return Object.freeze({ dispositions: 0, remaining: false });
    if (delayed.has(SELECTOR_KEY) || suppressed.has(SELECTOR_KEY)) {
      return Object.freeze({ dispositions: 0, remaining: false });
    }
    const startedAt = monotonicNow();
    let dispositions = 0;
    while (accepting && dispositions < BATCH_LIMIT
      && (!startup || monotonicNow() - startedAt < STARTUP_BUDGET_MS)) {
      const excludedKeys = [...suppressed, ...delayed.keys()];
      let selected;
      try {
        selected = await authority.listPending({ limit: 1, excludedKeys });
      } catch (error) {
        delayOrSuppress({ key: SELECTOR_KEY }, error?.code === 'agent_fact_admission_transition_failed'
          || error?.code === 'SQLITE_BUSY');
        break;
      }
      if (!accepting || selected.length === 0) break;
      const outcome = await processOne(selected[0]);
      dispositions += 1;
      if (outcome.stop) break;
    }
    let remaining = false;
    if (accepting && !delayed.has(SELECTOR_KEY) && !suppressed.has(SELECTOR_KEY)) {
      try {
        remaining = (await authority.listPending({
          limit: 1,
          excludedKeys: [...suppressed, ...delayed.keys()],
        })).length > 0;
      } catch (error) {
        delayOrSuppress({ key: SELECTOR_KEY }, error?.code === 'agent_fact_admission_transition_failed'
          || error?.code === 'SQLITE_BUSY');
      }
    }
    return Object.freeze({ dispositions, remaining });
  }

  function scheduleContinuation() {
    if (!accepting || !continuationsEnabled || continuation) return;
    continuationRequested = false;
    continuation = immediate().then(async () => {
      continuation = null;
      if (!accepting) return;
      if (!continuationsEnabled) {
        continuationRequested = true;
        return;
      }
      const result = await runDrain(false);
      if (result.remaining) scheduleContinuation();
    }).catch(() => {
      continuation = null;
      diagnose('agent_fact_admission_failed');
    });
  }

  function runDrain(startup) {
    if (active) return active;
    active = drain({ startup }).finally(() => { active = null; });
    return active;
  }

  function signal() {
    if (!accepting) return;
    if (!continuationsEnabled) {
      continuationRequested = true;
      return;
    }
    scheduleContinuation();
  }

  function enableContinuations() {
    if (!accepting) return;
    continuationsEnabled = true;
    if (continuationRequested) scheduleContinuation();
  }

  function deferContinuations() {
    if (accepting) continuationsEnabled = false;
  }

  function recordPublisherRejection(reservation, kind, retryable) {
    if (reservation && (typeof reservation === 'object' || typeof reservation === 'function')) {
      publisherFailures.set(reservation, Object.freeze({ kind, retryable: retryable === true }));
    }
  }

  function isAccepting() {
    return accepting;
  }

  async function start({ deferContinuations = false } = {}) {
    if (deferContinuations) continuationsEnabled = false;
    const result = await runDrain(true);
    if (result.remaining) signal();
    return result;
  }

  async function shutdown({ timeoutMs = SHUTDOWN_TIMEOUT_MS, deadline = null } = {}) {
    accepting = false;
    continuationRequested = false;
    for (const timer of delayed.values()) clearTimer(timer);
    delayed.clear();
    const pending = [active, continuation].filter(Boolean);
    let drained = pending.length === 0;
    if (pending.length) {
      const startedAt = monotonicNow();
      const localDeadline = Math.min(
        startedAt + Math.min(SHUTDOWN_TIMEOUT_MS, Math.max(0, timeoutMs)),
        Number.isFinite(deadline) ? deadline : Number.POSITIVE_INFINITY,
      );
      const remaining = Math.max(0, localDeadline - monotonicNow());
      if (remaining > 0) {
        let timer;
        drained = await Promise.race([
          Promise.allSettled(pending).then(() => monotonicNow() < localDeadline),
          new Promise((resolve) => {
            timer = setTimer(() => resolve(false), remaining);
            timer?.unref?.();
          }),
        ]);
        if (timer) clearTimer(timer);
      }
    }
    for (const timer of delayed.values()) clearTimer(timer);
    delayed.clear();
    return drained;
  }

  return Object.freeze({
    installPublishers,
    deferContinuations,
    enableContinuations,
    isAccepting,
    recordPublisherRejection,
    signal,
    start,
    shutdown,
    _drain: drain,
    _delayed: delayed,
    _suppressed: suppressed,
  });
}

module.exports = {
  BATCH_LIMIT,
  RETRY_DELAY_MS,
  SHUTDOWN_TIMEOUT_MS,
  STARTUP_BUDGET_MS,
  createAgentFactAdmissionReconciler,
};
