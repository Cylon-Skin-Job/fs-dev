'use strict';

const { performance } = require('perf_hooks');
const { MAX_SNAPSHOT_BYTES } = require('../db/migrations/036_agent_tool_provenance');
const { sha256Utf8 } = require('./turn-authority');

const RETRYABLE_DB = /database is locked|cannot start a transaction within a transaction/iu;

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

function isRetryable(error) {
  return error?.code === 'SQLITE_BUSY'
    || error?.code === 'agent_observation_transition_failed'
    || RETRYABLE_DB.test(String(error?.message));
}

function createAgentResourceObserver({
  repository,
  checkpointRepository,
  pathCoordinator,
  nativeObserver,
  onObservationReserved = () => {},
  onProjectionReserved = () => {},
  writeDiagnostic = () => {},
  wallClock = Date.now,
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  resolveWorkspaceRoot,
} = {}) {
  if (!repository?.claimDue || !checkpointRepository?.applySuccessfulObservation) {
    throw new TypeError('observation durable repositories are required');
  }
  if (!pathCoordinator?.tryAcquireObservation || !nativeObserver?.observeSecureFile
    || !nativeObserver?.createCancellationHandle || !nativeObserver?.deadlineAfterMilliseconds
    || typeof resolveWorkspaceRoot !== 'function') {
    throw new TypeError('secure observer dependencies are required');
  }
  let accepting = true;
  let activeDrain = null;
  let continuation = null;
  let dueTimer = null;
  let dueAt = null;
  let continuationsEnabled = true;
  let continuationRequested = false;
  const activeClaims = new Map();
  const activeTasks = new Map();
  const delayed = new Map();
  const suppressed = new Set();
  const retryUsed = new Set();

  function blockedClaimTokens() {
    return [...new Set([...delayed.keys(), ...suppressed]
      .filter((key) => key.startsWith('claim:')).map((key) => key.slice(6)))];
  }

  function blockedActivityIds() {
    return [...new Set([...delayed.keys(), ...suppressed]
      .filter((key) => key.startsWith('activity:')).map((key) => key.slice(9)))];
  }

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  function scheduleWakeAt(at) {
    if (!accepting || at == null || (dueTimer && dueAt <= at)) return;
    if (dueTimer) clearTimer(dueTimer);
    dueAt = at;
    dueTimer = setTimer(() => {
      dueTimer = null;
      dueAt = null;
      signal();
    }, Math.max(0, at - wallClock()));
    dueTimer?.unref?.();
  }

  function deferFailedTransition(key, error, operation, onSuccess = () => {}) {
    if (!accepting) return false;
    if (!isRetryable(error) || retryUsed.has(key)) {
      suppressed.add(key);
      diagnose('agent_observation_transition_failed');
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
        diagnose('agent_observation_transition_failed');
      }
      delayed.delete(key);
    }
    return dispositions;
  }

  async function delayedTransition(key, operation) {
    if (!accepting) return false;
    try {
      await operation();
      return true;
    } catch (error) {
      deferFailedTransition(key, error, operation);
      return false;
    }
  }

  async function loadAuthorizedRoot(context) {
    const root = await resolveWorkspaceRoot(context.activity.workspace_id);
    if (typeof root !== 'string' || sha256Utf8(root) !== context.activity.authority_root_sha256) {
      return null;
    }
    return root;
  }

  async function closeTimeout(claim, attempt) {
    const now = wallClock();
    if (attempt === 3) {
      await repository.closeGroup(claim.claimToken, now, {
        state: 'failed', reason: 'observation_timeout',
      });
    } else {
      await repository.settleNoResult(claim.claimToken, now);
    }
  }

  async function processClaim(claim) {
    const claimKey = `claim:${claim.claimToken}`;
    if (!accepting || delayed.has(claimKey) || suppressed.has(claimKey)) return false;
    const coordinatorKey = `${claim.workspaceId}\u0000${claim.canonicalPath}`;
    const lease = pathCoordinator.tryAcquireObservation(coordinatorKey);
    if (!lease) {
      await delayedTransition(claimKey, () => repository.releaseWithoutAttempt(
        claim.claimToken, wallClock(), 100,
      ));
      return true;
    }
    const acquiredAt = monotonicNow();
    const coordinatorDeadline = acquiredAt + 2_000;
    let leaseReleased = false;
    const releaseLease = () => {
      if (leaseReleased) return false;
      leaseReleased = true;
      return lease.release();
    };
    let attempt = 0;
    let cancellation = null;
    let deadlineTimer = null;
    let deadlineFired = false;
    let secureBytes = null;
    let resolveDeadline;
    const deadline = new Promise((resolve) => { resolveDeadline = resolve; });
    deadlineTimer = setTimer(() => {
      deadlineFired = true;
      cancellation?.cancel();
      if (Buffer.isBuffer(secureBytes)) {
        secureBytes.fill(0);
        secureBytes = null;
      }
      // The coordinator deadline is the absolute same-path save-wait bound.
      // The cancelled native call stays scheduler-owned until it settles, but
      // its late result is fenced and can no longer retain this path lease.
      releaseLease();
      resolveDeadline(Object.freeze({ status: 'failed', reason: 'observation_timeout' }));
    }, Math.max(0, coordinatorDeadline - monotonicNow()));
    deadlineTimer?.unref?.();
    const deadlineGuard = () => accepting && !deadlineFired && monotonicNow() < coordinatorDeadline;
    const assertBeforeDeadline = () => {
      if (deadlineGuard()) return;
      const error = new Error('observation coordinator deadline expired');
      error.code = 'observation_deadline_expired';
      throw error;
    };
    try {
      if (!deadlineGuard()) {
        await repository.releaseWithoutAttempt(claim.claimToken, wallClock(), 100);
        return true;
      }
      const context = await repository.loadClaimContext(claim.claimToken);
      if (nativeObserver.available === false) {
        attempt = await repository.reserveAttempt(claim.claimToken, wallClock(), {
          deadlineGuard,
        });
        await repository.closeGroup(claim.claimToken, wallClock(), {
          state: 'failed', reason: 'secure_open_unavailable',
          deadlineGuard,
        });
        return true;
      }
      const root = await loadAuthorizedRoot(context);
      if (!accepting) return false;
      if (!deadlineGuard()) {
        await repository.releaseWithoutAttempt(claim.claimToken, wallClock(), 100);
        return true;
      }
      attempt = await repository.reserveAttempt(claim.claimToken, wallClock(), {
        deadlineGuard,
      });
      assertBeforeDeadline();
      if (!root) {
        await repository.closeGroup(claim.claimToken, wallClock(), {
          state: 'failed', reason: 'workspace_unavailable',
          deadlineGuard,
        });
        return true;
      }
      if (!deadlineGuard()) {
        await repository.settleNoResult(claim.claimToken, wallClock());
        return true;
      }
      cancellation = nativeObserver.createCancellationHandle();
      activeClaims.set(claim.claimToken, cancellation);
      const remaining = Math.max(0, coordinatorDeadline - monotonicNow());
      const nativeRead = Promise.resolve(nativeObserver.observeSecureFile({
          rootPath: root,
          relativePath: context.dominantEdge.canonical_path,
          expectedRootDevice: context.activity.authority_root_device,
          expectedRootInode: context.activity.authority_root_inode,
          byteLimit: MAX_SNAPSHOT_BYTES,
          deadlineNs: nativeObserver.deadlineAfterMilliseconds(remaining),
          cancellation,
        }));
      const secureResult = await Promise.race([
        nativeRead,
        deadline,
      ]);
      if (Buffer.isBuffer(secureResult?.bytes)) secureBytes = secureResult.bytes;
      if (deadlineFired) {
        // The native operation owns descriptor cleanup. Keep scheduler task
        // ownership until its cooperative cancellation completion is observed.
        const discarded = await nativeRead.catch(() => null);
        if (Buffer.isBuffer(discarded?.bytes)) discarded.bytes.fill(0);
      }
      if (!accepting) return false;
      if (monotonicNow() >= coordinatorDeadline || secureResult.reason === 'observation_timeout') {
        releaseLease();
        await closeTimeout(claim, attempt);
        return true;
      }
      const observedAt = wallClock();
      if (secureResult.status === 'bytes') {
        try {
          const outcome = await checkpointRepository.applySuccessfulObservation({
            activityId: claim.activityId,
            claimToken: claim.claimToken,
            sourceEdgeId: claim.claimedEdgeId,
            canonicalPath: claim.canonicalPath,
            state: 'bytes',
            bytes: secureResult.bytes,
            takeByteOwnership: true,
            fingerprint: secureResult.fingerprint,
            observedAt,
            deadlineGuard,
          });
          if (Buffer.isBuffer(secureBytes)) secureBytes.fill(0);
          secureBytes = null;
          assertBeforeDeadline();
          try { if (outcome.eventId) onObservationReserved(outcome.eventId); } catch (_error) {}
          try { onProjectionReserved(outcome.sourceEdgeId); } catch (_error) {}
          return true;
        } catch (error) {
          if (error?.code !== 'unsupported_text') throw error;
          await repository.closeGroup(claim.claimToken, observedAt, {
            state: 'skipped', reason: 'unsupported_text',
            deadlineGuard,
          });
          return true;
        }
      }
      if (secureResult.status === 'absent') {
        const outcome = await checkpointRepository.applySuccessfulObservation({
          activityId: claim.activityId,
          claimToken: claim.claimToken,
          sourceEdgeId: claim.claimedEdgeId,
          canonicalPath: claim.canonicalPath,
          state: 'absent',
          observedAt,
          deadlineGuard,
        });
        assertBeforeDeadline();
        try { if (outcome.eventId) onObservationReserved(outcome.eventId); } catch (_error) {}
        try { onProjectionReserved(outcome.sourceEdgeId); } catch (_error) {}
        return true;
      }
      if (secureResult.status === 'skipped') {
        await repository.closeGroup(claim.claimToken, observedAt, {
          state: 'skipped', reason: secureResult.reason,
          deadlineGuard,
        });
      } else {
        await repository.closeGroup(claim.claimToken, observedAt, {
          state: 'failed', reason: secureResult.reason,
          deadlineGuard,
        });
      }
      return true;
    } catch (error) {
      if (!accepting) return false;
      diagnose('agent_observation_failed');
      // A filesystem result that did not commit is deliberately discarded.
      cancellation?.cancel();
      activeClaims.delete(claim.claimToken);
      await delayedTransition(claimKey, () => repository.settleNoResult(claim.claimToken, wallClock()));
      return false;
    } finally {
      if (deadlineTimer) clearTimer(deadlineTimer);
      cancellation?.cancel();
      activeClaims.delete(claim.claimToken);
      if (Buffer.isBuffer(secureBytes)) secureBytes.fill(0);
      releaseLease();
    }
  }

  function installClaimTask(claim) {
    if (activeTasks.has(claim.activityId)) {
      throw new Error('observation activity already owns a scheduler slot');
    }
    const task = processClaim(claim).then(
      (value) => ({ activityId: claim.activityId, value }),
      (error) => ({ activityId: claim.activityId, error }),
    );
    activeTasks.set(claim.activityId, task);
    task.then(() => { if (accepting) signal(); });
    return task;
  }

  async function processRetriedClaim(claim) {
    if (!claim || !accepting) return 0;
    while (accepting && activeTasks.size >= 4) {
      const settled = await Promise.race(activeTasks.values());
      activeTasks.delete(settled.activityId);
    }
    if (!accepting) return 0;
    await installClaimTask(claim);
    activeTasks.delete(claim.activityId);
    return 1;
  }

  async function drain({ startup = false } = {}) {
    if (!accepting) return Object.freeze({ dispositions: 0, remaining: false });
    const startedAt = monotonicNow();
    const withinStartupDeadline = () => !startup || monotonicNow() - startedAt < 2_000;
    let dispositions = await retryDueTransitions({
      limit: 16,
      shouldContinue: withinStartupDeadline,
    });
    if (!accepting) return Object.freeze({ dispositions, remaining: false });
    try {
      dispositions += await repository.recoverExpired(wallClock(), {
        excludedClaimTokens: blockedClaimTokens(),
        limit: 16 - dispositions,
        shouldContinue: withinStartupDeadline,
      });
    } catch (error) {
      const key = error.claimToken ? `claim:${error.claimToken}` : 'selector:lease-recovery';
      deferFailedTransition(
        key,
        error,
        (available, shouldContinue) => error.claimToken
          ? repository.settleNoResult(error.claimToken, wallClock())
          : repository.recoverExpired(wallClock(), {
            excludedClaimTokens: blockedClaimTokens(), limit: available, shouldContinue,
          }),
        (recovered) => recovered,
      );
    }
    let selectionExhausted = delayed.has('selector:pending-claim')
      || suppressed.has('selector:pending-claim');
    while (accepting && dispositions < 16 && withinStartupDeadline()) {
      while (!selectionExhausted && activeTasks.size < 4 && dispositions < 16
        && withinStartupDeadline()) {
        const excluded = [...activeTasks.keys(), ...blockedActivityIds()];
        let claim;
        try {
          claim = await repository.claimDue(wallClock(), { excludedActivityIds: excluded });
        } catch (error) {
          const key = error.activityId ? `activity:${error.activityId}` : 'selector:pending-claim';
          deferFailedTransition(
            key,
            error,
            () => repository.claimDue(wallClock(), {
              excludedActivityIds: [...activeTasks.keys(), ...blockedActivityIds()]
                .filter((activityId) => activityId !== error.activityId),
              onlyActivityId: error.activityId ?? null,
            }),
            processRetriedClaim,
          );
          selectionExhausted = true;
          break;
        }
        if (!claim) { selectionExhausted = true; break; }
        installClaimTask(claim);
        dispositions += 1;
      }
      if (!activeTasks.size || (startup && monotonicNow() - startedAt >= 2_000)) break;
      const disposition = await Promise.race(activeTasks.values());
      activeTasks.delete(disposition.activityId);
      selectionExhausted = false;
    }
    return Object.freeze({
      dispositions,
      remaining: activeTasks.size > 0 || delayed.size > 0
        || (!suppressed.has('selector:pending-claim') && (await repository.nextWakeAt({
        excludedActivityIds: blockedActivityIds(),
        excludedClaimTokens: blockedClaimTokens(),
      })) != null),
    });
  }

  function armNextWake() {
    if (!accepting) return;
    Promise.resolve(repository.nextWakeAt({
      excludedActivityIds: blockedActivityIds(),
      excludedClaimTokens: blockedClaimTokens(),
    })).then((next) => {
      if (!accepting) return;
      for (const entry of delayed.values()) {
        if (next == null || entry.at < next) next = entry.at;
      }
      scheduleWakeAt(next);
    }).catch(() => diagnose('agent_observation_transition_failed'));
  }

  function runDrain(startup = false) {
    if (activeDrain) return activeDrain;
    activeDrain = drain({ startup }).finally(() => { activeDrain = null; });
    return activeDrain;
  }

  function signal() {
    if (!accepting) return;
    if (!continuationsEnabled) {
      continuationRequested = true;
      return;
    }
    if (continuation) return;
    continuationRequested = false;
    if (dueTimer) { clearTimer(dueTimer); dueTimer = null; }
    dueAt = null;
    continuation = immediate().then(async () => {
      continuation = null;
      if (!accepting) return;
      const result = await runDrain(false);
      if (result.remaining) armNextWake();
    }).catch(() => {
      continuation = null;
      diagnose('agent_observation_failed');
      armNextWake();
    });
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
    else armNextWake();
    return true;
  }

  function deferContinuations() {
    if (accepting) continuationsEnabled = false;
  }

  async function shutdown({ timeoutMs = 2_000, deadline = Number.POSITIVE_INFINITY } = {}) {
    accepting = false;
    continuationsEnabled = false;
    continuationRequested = false;
    if (dueTimer) clearTimer(dueTimer);
    dueTimer = null;
    dueAt = null;
    delayed.clear();
    for (const cancellation of activeClaims.values()) cancellation.cancel();
    const owned = [activeDrain, continuation, ...activeTasks.values()].filter(Boolean);
    if (!owned.length) return true;
    const finishBy = Math.min(monotonicNow() + Math.max(0, Math.min(2_000, timeoutMs)), deadline);
    const remaining = Math.max(0, finishBy - monotonicNow());
    if (remaining <= 0) return false;
    let timer;
    const drained = await Promise.race([
      Promise.allSettled(owned).then(() => monotonicNow() < finishBy),
      new Promise((resolve) => { timer = setTimer(() => resolve(false), remaining); }),
    ]);
    if (timer) clearTimer(timer);
    if (drained) activeTasks.clear();
    return drained;
  }

  return Object.freeze({
    signal, start, deferContinuations, enableContinuations, shutdown, isAccepting: () => accepting,
    _drain: drain, _processClaim: processClaim,
    _activeTasks: activeTasks, _delayed: delayed, _suppressed: suppressed,
  });
}

module.exports = { createAgentResourceObserver };
