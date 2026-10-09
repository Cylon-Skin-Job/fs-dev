'use strict';

const { performance } = require('perf_hooks');

function immediate() { return new Promise((resolve) => setImmediate(resolve)); }

function isRetryable(error) {
  return error?.code === 'SQLITE_BUSY'
    || error?.code === 'agent_renderer_projection_transition_failed'
    || /database is locked|cannot start a transaction within a transaction/iu.test(String(error?.message));
}

function createAgentRendererProjectionOwner({
  repository,
  authority,
  writeDiagnostic = () => {},
  wallClock = Date.now,
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (!repository?.claimDue || !authority?.deliverClaim) {
    throw new TypeError('renderer projection durable dependencies are required');
  }
  let accepting = true;
  let active = null;
  let continuation = null;
  let wakeTimer = null;
  let wakeAt = null;
  let activeController = null;
  let continuationsEnabled = false;
  let continuationRequested = false;
  const cleanup = new Set();
  const delayed = new Map();
  const suppressed = new Set();
  const retryUsed = new Set();

  function blocked() {
    const keys = [...new Set([...delayed.keys(), ...suppressed])];
    return {
      claimTokens: keys.filter((key) => key.startsWith('claim:')).map((key) => key.slice(6)),
      sourceEdgeIds: keys.filter((key) => key.startsWith('edge:')).map((key) => key.slice(5)),
    };
  }

  function diagnose() {
    try { writeDiagnostic('agent_renderer_projection_transition_failed'); } catch (_error) {}
  }

  function scheduleWakeAt(at) {
    if (!accepting || at == null || (wakeTimer && wakeAt <= at)) return;
    if (wakeTimer) clearTimer(wakeTimer);
    wakeAt = at;
    wakeTimer = setTimer(() => {
      wakeTimer = null;
      wakeAt = null;
      signal();
    }, Math.max(0, at - wallClock()));
    wakeTimer?.unref?.();
  }

  function deferFailedTransition(key, error, operation, onSuccess = () => {}) {
    if (!accepting) return false;
    if (!isRetryable(error) || retryUsed.has(key)) {
      suppressed.add(key);
      diagnose();
      return false;
    }
    retryUsed.add(key);
    const entry = Object.freeze({
      at: wallClock() + 1_000,
      operation,
      onSuccess,
    });
    delayed.set(key, entry);
    scheduleWakeAt(entry.at);
    return true;
  }

  async function retryDueTransitions({ limit, shouldContinue }) {
    let dispositions = 0;
    const now = wallClock();
    const entries = [...delayed.entries()]
      .filter(([, entry]) => entry.at <= now)
      .sort((left, right) => left[1].at - right[1].at || left[0].localeCompare(right[0]));
    for (const [key, entry] of entries) {
      if (dispositions >= limit || !shouldContinue()) break;
      if (!accepting || delayed.get(key) !== entry) continue;
      try {
        const result = await entry.operation(limit - dispositions, shouldContinue);
        if (!accepting) return dispositions;
        const completed = await entry.onSuccess(result);
        dispositions += Number.isSafeInteger(completed) && completed > 0 ? completed : 0;
        retryUsed.delete(key);
      } catch (_retryError) {
        suppressed.add(key);
        diagnose();
      }
      delayed.delete(key);
    }
    return dispositions;
  }

  async function transition(key, operation) {
    try {
      await operation();
      return true;
    } catch (error) {
      deferFailedTransition(key, error, operation);
      return false;
    }
  }

  async function processClaim(claim, { deadline = Number.POSITIVE_INFINITY } = {}) {
    if (!accepting) return false;
    const key = `claim:${claim.claimToken}`;
    const startedAt = monotonicNow();
    const deliveryDeadline = Math.min(startedAt + 2_000, deadline);
    let deliveryTimer;
    const controller = new AbortController();
    activeController = controller;
    let rejectCancellation;
    const cancelled = new Promise((_, reject) => { rejectCancellation = reject; });
    const onAbort = () => {
      const error = new Error('renderer projection delivery cancelled');
      error.code = 'projection_cancelled';
      rejectCancellation(error);
    };
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const delivery = Promise.resolve().then(() => (
      authority.deliverClaim(claim, { signal: controller.signal })
    ));
    const trackedDelivery = delivery.then(() => undefined, () => undefined)
      .finally(() => cleanup.delete(trackedDelivery));
    cleanup.add(trackedDelivery);
    try {
      const result = await Promise.race([
        delivery,
        cancelled,
        new Promise((_, reject) => {
          deliveryTimer = setTimer(() => {
            controller.abort();
            const error = new Error('renderer projection deadline expired');
            error.code = 'projection_deadline';
            reject(error);
          }, Math.max(0, deliveryDeadline - monotonicNow()));
          deliveryTimer?.unref?.();
        }),
      ]);
      if (deliveryTimer) clearTimer(deliveryTimer);
      deliveryTimer = null;
      controller.signal.removeEventListener('abort', onAbort);
      if (activeController === controller) activeController = null;
      if (!accepting) return false;
      return transition(key, () => repository.settle(claim.claimToken, wallClock(), result.settlement));
    } catch (_error) {
      if (deliveryTimer) clearTimer(deliveryTimer);
      deliveryTimer = null;
      controller.abort();
      controller.signal.removeEventListener('abort', onAbort);
      if (activeController === controller) activeController = null;
      if (!accepting) return false;
      return transition(key, () => repository.failDelivery(claim.claimToken, wallClock()));
    }
  }

  async function drain({ startup = false } = {}) {
    if (!accepting) return Object.freeze({ dispositions: 0, remaining: false });
    const startedAt = monotonicNow();
    const withinStartupDeadline = () => !startup || monotonicNow() - startedAt < 1_000;
    let dispositions = await retryDueTransitions({
      limit: 100,
      shouldContinue: withinStartupDeadline,
    });
    if (!accepting) return Object.freeze({ dispositions, remaining: false });
    const exclusions = blocked();
    try {
      dispositions += await repository.recoverExpired(wallClock(), {
        excludedClaimTokens: exclusions.claimTokens,
        limit: 100 - dispositions,
        shouldContinue: withinStartupDeadline,
      });
    } catch (error) {
      const key = error.claimToken ? `claim:${error.claimToken}` : 'selector:lease-recovery';
      deferFailedTransition(
        key,
        error,
        (available, shouldContinue) => repository.recoverExpired(wallClock(), {
          onlyClaimToken: error.claimToken ?? null,
          excludedClaimTokens: error.claimToken ? [] : blocked().claimTokens,
          limit: available,
          shouldContinue,
        }),
        (recovered) => recovered,
      );
    }
    while (accepting && dispositions < 100 && withinStartupDeadline()) {
      if (delayed.has('selector:pending-claim') || suppressed.has('selector:pending-claim')) break;
      const excludedSourceEdgeIds = blocked().sourceEdgeIds;
      let claim;
      try {
        claim = await repository.claimDue(wallClock(), { excludedSourceEdgeIds });
      } catch (error) {
        const key = error.sourceEdgeId ? `edge:${error.sourceEdgeId}` : 'selector:pending-claim';
        deferFailedTransition(
          key,
          error,
          () => repository.claimDue(wallClock(), {
            excludedSourceEdgeIds: blocked().sourceEdgeIds
              .filter((sourceEdgeId) => sourceEdgeId !== error.sourceEdgeId),
            onlySourceEdgeId: error.sourceEdgeId ?? null,
          }),
          async (retryClaim) => {
            if (!retryClaim) return 0;
            await processClaim(retryClaim);
            return 1;
          },
        );
        break;
      }
      if (!claim) break;
      await processClaim(claim, {
        deadline: startup ? startedAt + 1_000 : Number.POSITIVE_INFINITY,
      });
      dispositions += 1;
    }
    return Object.freeze({
      dispositions,
      remaining: delayed.size > 0 || (!suppressed.has('selector:pending-claim') && (await repository.nextWakeAt({
        excludedSourceEdgeIds: blocked().sourceEdgeIds,
        excludedClaimTokens: blocked().claimTokens,
      })) != null),
    });
  }

  function armWake() {
    if (!accepting) return;
    const exclusions = blocked();
    repository.nextWakeAt({
      excludedSourceEdgeIds: exclusions.sourceEdgeIds,
      excludedClaimTokens: exclusions.claimTokens,
    }).then((next) => {
      if (!accepting) return;
      for (const entry of delayed.values()) {
        if (next == null || entry.at < next) next = entry.at;
      }
      scheduleWakeAt(next);
    }).catch(diagnose);
  }

  function runDrain(startup = false) {
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
    if (continuation) return;
    continuationRequested = false;
    if (wakeTimer) clearTimer(wakeTimer);
    wakeTimer = null;
    wakeAt = null;
    continuation = immediate().then(async () => {
      continuation = null;
      if (!accepting) return;
      const result = await runDrain(false);
      if (result.remaining) armWake();
    }).catch(() => { continuation = null; diagnose(); armWake(); });
  }

  async function start() {
    const result = await runDrain(true);
    if (result.remaining) continuationRequested = true;
    return result;
  }

  function enableContinuations() {
    if (!accepting || continuationsEnabled) return false;
    continuationsEnabled = true;
    if (continuationRequested) signal();
    else armWake();
    return true;
  }

  async function shutdown({ timeoutMs = 2_000, deadline = Number.POSITIVE_INFINITY } = {}) {
    accepting = false;
    continuationsEnabled = false;
    continuationRequested = false;
    activeController?.abort();
    if (wakeTimer) clearTimer(wakeTimer);
    wakeTimer = null;
    wakeAt = null;
    delayed.clear();
    const pending = [active, continuation, ...cleanup].filter(Boolean);
    if (!pending.length) return true;
    const finishBy = Math.min(monotonicNow() + Math.max(0, Math.min(2_000, timeoutMs)), deadline);
    const remaining = Math.max(0, finishBy - monotonicNow());
    if (remaining <= 0) return false;
    let timer;
    const drained = await Promise.race([
      Promise.allSettled(pending).then(() => monotonicNow() < finishBy),
      new Promise((resolve) => { timer = setTimer(() => resolve(false), remaining); }),
    ]);
    if (timer) clearTimer(timer);
    return drained;
  }

  return Object.freeze({
    signal,
    start,
    enableContinuations,
    shutdown,
    isAccepting: () => accepting,
    _drain: drain,
  });
}

module.exports = { createAgentRendererProjectionOwner };
