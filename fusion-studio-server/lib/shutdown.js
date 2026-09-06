'use strict';

const { performance } = require('perf_hooks');

const DEFAULT_FORCE_AFTER_MS = 8_000;
const OWNER_PHASE_DEADLINE_MS = 5_000;
const SUBSCRIPTION_PHASE_DEADLINE_MS = 6_500;
const DATABASE_PHASE_DEADLINE_MS = 7_000;

function createShutdownHandler({
  server,
  sessions,
  closeWatchers,
  beginQuiesce = () => {},
  phaseAOwners = [],
  stopSubscriptions = async () => {},
  closeDatabase,
  exit = process.exit,
  logger = console,
  forceAfterMs = DEFAULT_FORCE_AFTER_MS,
  ownerDeadlineMs = Math.min(OWNER_PHASE_DEADLINE_MS, forceAfterMs),
  subscriptionDeadlineMs = Math.min(SUBSCRIPTION_PHASE_DEADLINE_MS, forceAfterMs),
  databaseDeadlineMs = Math.min(DATABASE_PHASE_DEADLINE_MS, forceAfterMs),
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  if (!Array.isArray(phaseAOwners) || phaseAOwners.some((owner) => typeof owner !== 'function')) {
    throw new TypeError('phase A owners must be functions');
  }
  let shutdownPromise = null;

  return function requestShutdown(signal = 'SIGTERM') {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      logger.log(`[Shutdown] received ${signal}`);
      const startedAt = monotonicNow();
      const abortController = new AbortController();
      let exited = false;
      const safeExit = (code) => {
        if (exited) return;
        exited = true;
        exit(code);
      };
      const forceTimer = setTimer(() => {
        abortController.abort();
        logger.error(`[Shutdown] cleanup exceeded ${forceAfterMs}ms; forcing exit`);
        safeExit(1);
      }, forceAfterMs);

      async function runUntil(label, absoluteMs, work) {
        const phaseDeadline = startedAt + absoluteMs;
        const remaining = Math.max(0, phaseDeadline - monotonicNow());
        let timer;
        let completed;
        try {
          completed = await Promise.race([
            Promise.resolve().then(work).then((result) => (
              result !== false && monotonicNow() < phaseDeadline
            )),
            new Promise((resolve) => {
              timer = setTimer(() => resolve(false), remaining);
              timer?.unref?.();
            }),
          ]);
        } finally {
          if (timer) clearTimer(timer);
        }
        if (!completed) logger.error(`[Shutdown] ${label} exceeded its phase deadline`);
        return completed;
      }

      try {
        try { server.close(); } catch {}
        try { server.closeIdleConnections?.(); } catch {}
        try { server.closeAllConnections?.(); } catch {}
        logger.log('[Shutdown] HTTP listener closed');
        for (const [ws] of sessions) {
          try { ws.terminate?.(); } catch {}
        }
        sessions.clear();
        logger.log('[Shutdown] renderer clients disconnected');
        try { beginQuiesce(); } catch {}

        logger.log('[Shutdown] draining concurrent owners');
        const owners = [...phaseAOwners, async () => closeWatchers()];
        const ownersDrained = await runUntil('owner drain', ownerDeadlineMs, async () => {
          const results = await Promise.allSettled(owners.map((owner) => owner({
            signal: abortController.signal,
            deadline: startedAt + ownerDeadlineMs,
            timeoutMs: Math.max(0, startedAt + ownerDeadlineMs - monotonicNow()),
          })));
          const rejected = results.find((result) => result.status === 'rejected');
          if (rejected) throw rejected.reason;
          return results.every((result) => (
            result.value !== false && result.value?.drained !== false
          ));
        });
        abortController.abort();
        if (!ownersDrained) return;
        logger.log('[Shutdown] concurrent owners drained');

        logger.log('[Shutdown] stopping governed subscriptions');
        const subscriptionsStopped = await runUntil(
          'subscription stop', subscriptionDeadlineMs, stopSubscriptions,
        );
        if (!subscriptionsStopped) return;
        logger.log('[Shutdown] governed subscriptions stopped');
        logger.log('[Shutdown] closing database');
        const databaseClosed = await runUntil('database close', databaseDeadlineMs, closeDatabase);
        if (!databaseClosed) return;
        logger.log('[Shutdown] database closed');
        clearTimer(forceTimer);
        logger.log('[Shutdown] cleanup complete');
        safeExit(0);
      } catch (error) {
        clearTimer(forceTimer);
        abortController.abort();
        logger.error(`[Shutdown] cleanup failed: ${error.message}`);
        safeExit(1);
      }
    })();

    return shutdownPromise;
  };
}

module.exports = {
  DATABASE_PHASE_DEADLINE_MS,
  DEFAULT_FORCE_AFTER_MS,
  OWNER_PHASE_DEADLINE_MS,
  SUBSCRIPTION_PHASE_DEADLINE_MS,
  createShutdownHandler,
};
