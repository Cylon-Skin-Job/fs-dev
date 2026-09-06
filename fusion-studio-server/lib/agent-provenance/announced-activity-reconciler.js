'use strict';

const { performance } = require('perf_hooks');
const { isBusy, runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');

const BATCH_LIMIT = 100;
const STARTUP_BUDGET_MS = 1_000;
const RETRY_DELAY_MS = 1_000;
const SHUTDOWN_TIMEOUT_MS = 2_000;
const SELECTOR_KEY = 'selector:announced-activities';

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createAnnouncedActivityReconciler({
  db,
  activityRepository,
  now = Date.now,
  monotonicNow = () => performance.now(),
  writeDiagnostic = () => {},
  onTerminalReserved = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (typeof db !== 'function' || typeof activityRepository?.reserveTerminal !== 'function') {
    throw new TypeError('database and activity repository are required');
  }
  let accepting = true;
  let active = null;
  let continuation = null;
  let continuationsEnabled = true;
  let continuationRequested = false;
  const delayed = new Map();
  const retryUsed = new Set();
  const suppressed = new Set();

  function diagnose() {
    try { writeDiagnostic('agent_tool_reservation_failed'); } catch (_error) {}
  }

  function terminalInput(row) {
    const observedAt = Math.max(now(), row.announced_observed_at, row.arguments_observed_at ?? 0);
    return {
      activityId: row.activity_id,
      eventId: row.event_id,
      workspaceId: row.workspace_id,
      threadId: row.thread_id,
      turnId: row.turn_id,
      harnessId: row.harness_id,
      provider: row.provider,
      toolCallId: row.tool_call_id,
      toolName: row.tool_name,
      nativeToolName: row.native_tool_name,
      authorityRootSha256: row.authority_root_sha256,
      authorityRootDevice: row.authority_root_device,
      authorityRootInode: row.authority_root_inode,
      status: 'interrupted',
      announcedObservedAt: row.announced_observed_at,
      announcedReportedAt: row.announced_reported_at,
      argumentsObservedAt: row.arguments_observed_at,
      argumentsReportedAt: row.arguments_reported_at,
      argumentsSha256: row.arguments_sha256,
      terminalObservedAt: observedAt,
      reconciledAt: observedAt,
      resultSha256: null,
      candidates: [],
      reportedCount: 0,
      truncated: false,
      now: observedAt,
    };
  }

  function delayOrSuppress(row, error) {
    if (!accepting) return;
    const key = row.activity_id;
    const retryable = error?.code === 'agent_announced_reconciliation_contention' || isBusy(error);
    if (!retryable || retryUsed.has(key)) {
      suppressed.add(key);
      diagnose();
      return;
    }
    retryUsed.add(key);
    const timer = setTimer(() => {
      delayed.delete(key);
      if (accepting) signal();
    }, RETRY_DELAY_MS);
    timer?.unref?.();
    delayed.set(key, timer);
  }

  async function reconcileRow(row) {
    try {
      const result = await runBoundedSqliteRetry(() => {
        if (!accepting) {
          const error = new Error('announced activity reconciler is stopped');
          error.code = 'agent_announced_reconciliation_shutdown';
          throw error;
        }
        return activityRepository.reserveTerminal(terminalInput(row));
      }, {
        attempts: 5,
        retryUnique: true,
        exhaustionCode: 'agent_announced_reconciliation_contention',
        exhaustionMessage: 'announced activity reconciliation did not settle',
      });
      if (accepting) {
        try { onTerminalReserved(result); } catch (_error) {}
      }
      return true;
    } catch (error) {
      delayOrSuppress(row, error);
      return false;
    }
  }

  async function select(limit) {
    return runBoundedSqliteRetry(() => {
      if (!accepting) {
        const error = new Error('announced activity reconciler is stopped');
        error.code = 'agent_announced_reconciliation_shutdown';
        throw error;
      }
      let query = db('agent_tool_activities')
        .where({ status: 'announced', fact_admission_state: 'not_ready', ledger_state: 'not_ready' });
      const excluded = [...delayed.keys(), ...suppressed];
      if (excluded.length) query = query.whereNotIn('activity_id', excluded);
      return query.orderBy('announced_observed_at', 'asc').orderBy('id', 'asc').limit(limit);
    }, {
      attempts: 5,
      retryUnique: true,
      exhaustionCode: 'agent_announced_reconciliation_contention',
      exhaustionMessage: 'announced activity selection did not settle',
    });
  }

  async function drain({ startup = false } = {}) {
    if (!accepting || delayed.has(SELECTOR_KEY) || suppressed.has(SELECTOR_KEY)) {
      return Object.freeze({ dispositions: 0, remaining: false });
    }
    const startedAt = monotonicNow();
    let dispositions = 0;
    while (accepting && dispositions < BATCH_LIMIT
      && (!startup || monotonicNow() - startedAt < STARTUP_BUDGET_MS)) {
      let rows;
      try {
        rows = await select(1);
      } catch (error) {
        delayOrSuppress({ activity_id: SELECTOR_KEY }, error);
        break;
      }
      if (!accepting || rows.length === 0) break;
      await reconcileRow(rows[0]);
      dispositions += 1;
    }
    let remaining = false;
    if (accepting && !delayed.has(SELECTOR_KEY) && !suppressed.has(SELECTOR_KEY)) {
      try {
        remaining = (await select(1)).length > 0;
      } catch (error) {
        delayOrSuppress({ activity_id: SELECTOR_KEY }, error);
      }
    }
    return Object.freeze({ dispositions, remaining });
  }

  function runDrain(startup) {
    if (active) return active;
    active = drain({ startup }).finally(() => { active = null; });
    return active;
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
    }).catch(() => { continuation = null; diagnose(); });
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
    deferContinuations, enableContinuations, start, signal, shutdown, isAccepting,
    _drain: drain, _suppressed: suppressed,
  });
}

module.exports = {
  BATCH_LIMIT,
  RETRY_DELAY_MS,
  SHUTDOWN_TIMEOUT_MS,
  STARTUP_BUDGET_MS,
  createAnnouncedActivityReconciler,
};
