'use strict';

const { performance } = require('perf_hooks');
const { isBusy, isUnique, runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');
const { AgentLedgerSourceMissingError } = require('./agent-ledger-repository');

const BATCH_LIMIT = 100;
const STARTUP_BUDGET_MS = 1_000;
const TRANSITION_RETRY_MS = 1_000;
const SHUTDOWN_TIMEOUT_MS = 2_000;
const SELECTOR_KEY = 'selector:agent-ledger-candidates';
const WAKE_KEY = 'selector:agent-ledger-wake';

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createAgentLedgerReconciler({
  repository,
  writeDiagnostic = () => {},
  now = Date.now,
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (!repository?.claim || !repository?.appendClaimed || !repository?.listCandidates) {
    throw new TypeError('agent ledger repository is required');
  }
  let accepting = true;
  let continuation = null;
  let wakeTimer = null;
  let wakeAt = null;
  let serial = Promise.resolve();
  let serialPending = 0;
  let selectedReplay = null;
  let continuationsEnabled = true;
  let continuationRequested = false;
  const delayed = new Map();
  const suppressed = new Set();
  const retryUsed = new Set();

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  function excludedKeys() {
    return [...suppressed, ...delayed.keys()];
  }

  function retryableTransition(error) {
    return error?.code === 'agent_ledger_transition_failed' || isBusy(error) || isUnique(error);
  }

  function enqueue(work) {
    serialPending += 1;
    const task = serial.then(work);
    const tracked = task.finally(() => { serialPending -= 1; });
    serial = tracked.catch(() => {});
    return tracked;
  }

  function scheduleSignalAt(at) {
    if (!accepting || at == null || (wakeTimer && wakeAt <= at)) return;
    if (wakeTimer) clearTimer(wakeTimer);
    wakeAt = at;
    wakeTimer = setTimer(() => {
      wakeTimer = null;
      wakeAt = null;
      signal();
    }, Math.max(0, at - now()));
    wakeTimer?.unref?.();
  }

  async function armNextWake() {
    if (!accepting) return;
    let durableAt;
    try {
      durableAt = await repository.nextWake(excludedKeys());
    } catch (error) {
      delayOrSuppress(WAKE_KEY, async () => {
        const retriedAt = await repository.nextWake(excludedKeys());
        if (accepting) scheduleSignalAt(retriedAt);
      }, error);
      return;
    }
    if (!accepting) return;
    let next = durableAt;
    for (const entry of delayed.values()) {
      if (next == null || entry.at < next) next = entry.at;
    }
    scheduleSignalAt(next);
  }

  function delayOrSuppress(key, operation, error) {
    if (!accepting) return;
    if (!retryableTransition(error) || retryUsed.has(key)) {
      delayed.delete(key);
      suppressed.add(key);
      diagnose('agent_ledger_transition_failed');
      return;
    }
    retryUsed.add(key);
    const at = now() + TRANSITION_RETRY_MS;
    delayed.set(key, Object.freeze({ at, operation }));
    scheduleSignalAt(at);
  }

  async function attemptTransition(key, operation) {
    try {
      const result = await operation();
      delayed.delete(key);
      retryUsed.delete(key);
      return Object.freeze({ settled: true, result });
    } catch (error) {
      delayOrSuppress(key, operation, error);
      return Object.freeze({ settled: false, result: null });
    }
  }

  async function transition(claim, options, afterSettle = null) {
    const key = `claim:${claim.claimToken}`;
    return attemptTransition(key, async () => {
      const result = await repository.settleFailure(claim, now(), options);
      if (afterSettle) afterSettle(result);
      return result;
    });
  }

  async function project(claim) {
    if (!accepting) return Object.freeze({ status: 'shutdown_pending' });
    try {
      const result = await runBoundedSqliteRetry(
        () => {
          if (!accepting) {
            const error = new Error('agent ledger owner is stopped');
            error.code = 'agent_ledger_shutdown';
            throw error;
          }
          return repository.appendClaimed(claim, now());
        },
        {
          attempts: 5,
          retryUnique: true,
          exhaustionCode: 'agent_ledger_projection_contention',
          exhaustionMessage: 'agent ledger projection did not settle',
        },
      );
      if (result.status === 'conflict') diagnose('agent_ledger_conflict');
      return result;
    } catch (error) {
      if (error instanceof AgentLedgerSourceMissingError || error?.code === 'agent_ledger_source_missing') {
        diagnose('agent_ledger_source_missing');
        return Object.freeze({ status: 'source_missing' });
      }
      if (!accepting) return Object.freeze({ status: 'shutdown_pending' });
      if (error?.code === 'agent_ledger_projection_contention') {
        const outcome = await transition(claim, {}, () => {
          if (claim.attempt >= 3) diagnose(claim.kind === 'tool'
            ? 'agent_tool_ledger_contention'
            : 'agent_observation_ledger_contention');
        });
        return Object.freeze({ status: outcome.settled ? 'rescheduled' : 'transition_pending' });
      }
      diagnose('agent_ledger_write_failed');
      const outcome = await transition(claim, { terminal: true });
      return Object.freeze({ status: outcome.settled ? 'failed' : 'transition_pending' });
    }
  }

  async function claimAndProject(candidate) {
    const key = candidate.key;
    const operation = async () => {
      const claim = await repository.claim(candidate, now());
      if (!accepting || !claim) return Object.freeze({ status: 'skipped' });
      return project(claim);
    };
    const outcome = await attemptTransition(key, operation);
    return outcome.result || Object.freeze({ status: 'transition_pending' });
  }

  async function recover(candidate) {
    const key = `claim:${candidate.claimToken}`;
    const operation = () => repository.recover(candidate, now());
    const outcome = await attemptTransition(key, operation);
    return Object.freeze({ status: outcome.settled ? 'recovered' : 'transition_pending' });
  }

  async function processCandidate(candidate) {
    return candidate.state === 'running' ? recover(candidate) : claimAndProject(candidate);
  }

  async function runDueDelayedTransition() {
    const due = [...delayed.entries()]
      .filter(([, entry]) => entry.at <= now())
      .sort((left, right) => left[1].at - right[1].at || left[0].localeCompare(right[0]))[0];
    if (!due) return false;
    const [key, entry] = due;
    try {
      await entry.operation();
      if (!accepting) return true;
      delayed.delete(key);
      retryUsed.delete(key);
    } catch (_error) {
      if (!accepting) return true;
      delayed.delete(key);
      suppressed.add(key);
      diagnose('agent_ledger_transition_failed');
    }
    return true;
  }

  async function drain({ startup = false } = {}) {
    if (!accepting) return Object.freeze({ dispositions: 0, remaining: false });
    const startedAt = monotonicNow();
    let dispositions = 0;
    while (accepting && dispositions < BATCH_LIMIT
      && (!startup || monotonicNow() - startedAt < STARTUP_BUDGET_MS)) {
      if (await runDueDelayedTransition()) {
        dispositions += 1;
        continue;
      }
      if (delayed.has(SELECTOR_KEY) || suppressed.has(SELECTOR_KEY)) break;
      let rows;
      if (selectedReplay) {
        rows = selectedReplay;
        selectedReplay = null;
      } else {
        try {
          rows = await repository.listCandidates({
            now: now(), includeRunning: true, limit: 1, excludedKeys: excludedKeys(),
          });
        } catch (error) {
          delayOrSuppress(SELECTOR_KEY, async () => {
            selectedReplay = await repository.listCandidates({
              now: now(), includeRunning: true, limit: 1, excludedKeys: excludedKeys(),
            });
          }, error);
          break;
        }
      }
      if (!accepting || rows.length === 0) break;
      try { await processCandidate(rows[0]); } catch (_error) {}
      dispositions += 1;
    }
    let remaining = false;
    if (accepting && !delayed.has(SELECTOR_KEY) && !suppressed.has(SELECTOR_KEY)) {
      try {
        remaining = (await repository.listCandidates({
          now: now(), includeRunning: true, limit: 1, excludedKeys: excludedKeys(),
        })).length > 0;
      } catch (error) {
        delayOrSuppress(SELECTOR_KEY, async () => {
          selectedReplay = await repository.listCandidates({
            now: now(), includeRunning: true, limit: 1, excludedKeys: excludedKeys(),
          });
        }, error);
      }
      if (accepting) await armNextWake();
    }
    return Object.freeze({ dispositions, remaining: accepting && remaining });
  }

  function runDrain(startup) {
    return enqueue(() => drain({ startup }));
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
      diagnose('agent_ledger_transition_failed');
    });
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

  function appendAgentFact(fact) {
    return enqueue(async () => {
      if (!accepting) throw new Error('agent ledger is shutting down');
      let claimed;
      try {
        claimed = await repository.claimFact(fact, now());
      } catch (error) {
        if (error instanceof AgentLedgerSourceMissingError
          || error?.code === 'agent_ledger_source_missing') throw error;
        const kind = fact?.eventType === 'agent.tool_completed' ? 'tool' : 'observation';
        const key = `${kind}:${fact?.eventId}`;
        delayOrSuppress(key, async () => {
          const retried = await repository.claimFact(fact, now());
          if (!accepting || retried?.status) return retried;
          return project(retried);
        }, error);
        throw error;
      }
      if (!accepting) return Object.freeze({ status: 'shutdown_pending' });
      if (claimed?.status) return claimed;
      return project(claimed);
    });
  }

  async function start({ deferContinuations = false } = {}) {
    if (deferContinuations) continuationsEnabled = false;
    const result = await runDrain(true);
    if (result.remaining) signal();
    return result;
  }

  function isAccepting() {
    return accepting;
  }

  async function shutdown({ timeoutMs = SHUTDOWN_TIMEOUT_MS, deadline = null } = {}) {
    accepting = false;
    continuationRequested = false;
    if (wakeTimer) clearTimer(wakeTimer);
    wakeTimer = null;
    wakeAt = null;
    delayed.clear();
    const startedAt = monotonicNow();
    const localDeadline = Math.min(
      startedAt + Math.min(SHUTDOWN_TIMEOUT_MS, Math.max(0, timeoutMs)),
      Number.isFinite(deadline) ? deadline : Number.POSITIVE_INFINITY,
    );
    const remaining = Math.max(0, localDeadline - monotonicNow());
    const pending = [continuation, serialPending > 0 ? serial : null].filter(Boolean);
    let drained = pending.length === 0;
    if (pending.length && remaining > 0) {
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
    delayed.clear();
    return drained;
  }

  return Object.freeze({
    appendAgentFact,
    deferContinuations,
    enableContinuations,
    isAccepting,
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
  SHUTDOWN_TIMEOUT_MS,
  STARTUP_BUDGET_MS,
  TRANSITION_RETRY_MS,
  createAgentLedgerReconciler,
};
