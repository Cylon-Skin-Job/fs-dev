'use strict';

const { performance } = require('perf_hooks');
const { isBusy } = require('../file-mutations/sqlite-contention');

const BATCH_LIMIT = 100;
const STARTUP_BUDGET_MS = 1_000;
const RETRY_DELAY_MS = 1_000;
const SHUTDOWN_TIMEOUT_MS = 2_000;

function immediate() { return new Promise((resolve) => setImmediate(resolve)); }

function isRetryable(error) {
  return isBusy(error) || error?.code === 'agent_exchange_bind_failed';
}

function createAgentExchangeBinder(repository, {
  writeDiagnostic = () => {},
  wallClock = Date.now,
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (!repository?.listNext || !repository?.bindExchange) {
    throw new TypeError('exchange bind repository is required');
  }
  let accepting = true;
  let active = null;
  let continuation = null;
  let continuationsEnabled = true;
  let continuationRequested = false;
  let wakeTimer = null;
  let wakeAt = null;
  const delayed = new Map();
  const suppressed = new Set();
  const retryUsed = new Set();

  function diagnose() {
    try { writeDiagnostic('agent_exchange_bind_failed'); } catch (_error) {}
  }

  function blockedIds() {
    return [...new Set([...delayed.keys(), ...suppressed])];
  }

  function armWake() {
    if (!accepting) return;
    let earliest = null;
    for (const entry of delayed.values()) {
      if (earliest == null || entry.at < earliest) earliest = entry.at;
    }
    if (earliest == null || (wakeTimer && wakeAt <= earliest)) return;
    if (wakeTimer) clearTimer(wakeTimer);
    wakeAt = earliest;
    wakeTimer = setTimer(() => {
      wakeTimer = null;
      wakeAt = null;
      signal();
    }, Math.max(0, earliest - wallClock()));
    wakeTimer?.unref?.();
  }

  function delayOrSuppress(exchangeId, error) {
    if (!accepting) return;
    if (!isRetryable(error) || retryUsed.has(exchangeId)) {
      suppressed.add(exchangeId);
      diagnose();
      return;
    }
    retryUsed.add(exchangeId);
    delayed.set(exchangeId, Object.freeze({ at: wallClock() + RETRY_DELAY_MS }));
    armWake();
  }

  async function retryDue(limit, shouldContinue) {
    let dispositions = 0;
    const results = [];
    const due = [...delayed.entries()]
      .filter(([, entry]) => entry.at <= wallClock())
      .sort((left, right) => left[1].at - right[1].at || left[0] - right[0]);
    for (const [exchangeId, entry] of due) {
      if (dispositions >= limit || !accepting || !shouldContinue()) break;
      if (delayed.get(exchangeId) !== entry) continue;
      try {
        const result = await repository.bindExchange(exchangeId);
        if (result) {
          dispositions += 1;
          results.push(result);
        }
        retryUsed.delete(exchangeId);
      } catch (_error) {
        suppressed.add(exchangeId);
        diagnose();
      } finally {
        delayed.delete(exchangeId);
      }
    }
    armWake();
    return Object.freeze({ dispositions, results: Object.freeze(results) });
  }

  async function drain({ startup = false, limit = BATCH_LIMIT } = {}) {
    if (!accepting) return Object.freeze({ dispositions: 0, remaining: false });
    if (!Number.isInteger(limit) || limit < 0 || limit > BATCH_LIMIT) {
      throw new TypeError('binder batch limit must be 0..100');
    }
    const startedAt = monotonicNow();
    const withinBudget = () => !startup || monotonicNow() - startedAt < STARTUP_BUDGET_MS;
    const delayedResult = await retryDue(limit, withinBudget);
    let dispositions = delayedResult.dispositions;
    const results = [...delayedResult.results];
    while (accepting && dispositions < limit && withinBudget()) {
      let job;
      try {
        job = await repository.listNext({ excludedExchangeIds: blockedIds() });
      } catch (_error) {
        diagnose();
        break;
      }
      if (!job || !accepting) break;
      try {
        const result = await repository.bindExchange(job.exchange_id);
        if (result) {
          dispositions += 1;
          results.push(result);
        }
      } catch (error) {
        delayOrSuppress(job.exchange_id, error);
        break;
      }
    }
    let eligibleRemaining = false;
    if (accepting) {
      try {
        eligibleRemaining = Boolean(await repository.listNext({ excludedExchangeIds: blockedIds() }));
      } catch (_error) {
        diagnose();
      }
    }
    const remaining = delayed.size > 0 || eligibleRemaining;
    armWake();
    return Object.freeze({
      dispositions,
      eligibleRemaining,
      remaining,
      results: Object.freeze(results),
    });
  }

  function runDrain(options) {
    if (active) return active;
    active = drain(options).finally(() => {
      active = null;
      if (continuationRequested) scheduleContinuation();
    });
    return active;
  }

  function scheduleContinuation() {
    if (!accepting || !continuationsEnabled || continuation || active) return;
    continuation = immediate().then(async () => {
      continuation = null;
      if (!accepting) return;
      continuationRequested = false;
      const result = await runDrain({ startup: false });
      if (result.eligibleRemaining || continuationRequested) scheduleContinuation();
    }).catch(() => {
      continuation = null;
      diagnose();
      if (continuationRequested) scheduleContinuation();
    });
  }

  function signal() {
    if (!accepting) return;
    continuationRequested = true;
    if (!continuationsEnabled) return;
    scheduleContinuation();
  }

  function deferContinuations() { if (accepting) continuationsEnabled = false; }
  function enableContinuations() {
    if (!accepting) return;
    continuationsEnabled = true;
    if (continuationRequested) scheduleContinuation();
  }

  async function start({ deferContinuations: defer = false } = {}) {
    if (defer) continuationsEnabled = false;
    const result = await runDrain({ startup: true });
    if (result.eligibleRemaining) signal();
    return result;
  }

  async function shutdown({ timeoutMs = SHUTDOWN_TIMEOUT_MS, deadline = null } = {}) {
    accepting = false;
    continuationRequested = false;
    if (wakeTimer) clearTimer(wakeTimer);
    wakeTimer = null;
    wakeAt = null;
    delayed.clear();
    const pending = [active, continuation].filter(Boolean);
    if (pending.length === 0) return Object.freeze({ drained: true });
    const startedAt = monotonicNow();
    const localDeadline = Math.min(
      startedAt + Math.min(SHUTDOWN_TIMEOUT_MS, Math.max(0, timeoutMs)),
      Number.isFinite(deadline) ? deadline : Number.POSITIVE_INFINITY,
    );
    const remaining = Math.max(0, localDeadline - monotonicNow());
    if (remaining <= 0) return Object.freeze({ drained: false });
    let timer;
    const drained = await Promise.race([
      Promise.allSettled(pending).then(() => monotonicNow() < localDeadline),
      new Promise((resolve) => {
        timer = setTimer(() => resolve(false), remaining);
        timer?.unref?.();
      }),
    ]);
    if (timer) clearTimer(timer);
    return Object.freeze({ drained });
  }

  return Object.freeze({
    deferContinuations,
    drainBatch(limit = BATCH_LIMIT) {
      return runDrain({ startup: false, limit }).then((result) => result.results);
    },
    enableContinuations,
    isAccepting: () => accepting,
    shutdown,
    signal,
    start,
  });
}

module.exports = { createAgentExchangeBinder };
