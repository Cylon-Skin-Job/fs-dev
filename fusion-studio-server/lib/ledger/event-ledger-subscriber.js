'use strict';

const { on } = require('../event-bus');
const { performance } = require('perf_hooks');
const { getDb } = require('../db');
const { isRecordedEventType, recordEvent } = require('./event-ledger');

let stopCurrent = null;
const inFlightWrites = new Set();

function startEventLedgerSubscriber(options = {}) {
  if (stopCurrent) return stopCurrent;

  const dbProvider = options.getDb || getDb;
  const logger = options.logger || console;
  const unsubscribe = on('*', (event) => {
    if (!event || !isRecordedEventType(event.type)) return;

    const task = Promise.resolve()
      .then(() => recordEvent(dbProvider(), event))
      .catch((err) => {
        logger.warn('[EventLedger] write failed:', err.message);
      });
    inFlightWrites.add(task);
    task.finally(() => inFlightWrites.delete(task));
    return task;
  });

  stopCurrent = () => {
    unsubscribe();
    stopCurrent = null;
  };

  logger.log('[EventLedger] Subscriber started');
  return stopCurrent;
}

async function drainEventLedgerWrites({
  timeoutMs = 5_000,
  deadline = null,
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (stopCurrent) stopCurrent();
  const localDeadline = Math.min(
    monotonicNow() + Math.max(0, timeoutMs),
    Number.isFinite(deadline) ? deadline : Number.POSITIVE_INFINITY,
  );
  while (inFlightWrites.size > 0) {
    const remaining = Math.max(0, localDeadline - monotonicNow());
    if (remaining <= 0) return Object.freeze({ drained: false });
    let timer;
    const completed = await Promise.race([
      Promise.allSettled([...inFlightWrites]).then(() => true),
      new Promise((resolve) => {
        timer = setTimer(() => resolve(false), remaining);
        timer?.unref?.();
      }),
    ]);
    if (timer) clearTimer(timer);
    if (!completed) return Object.freeze({ drained: false });
  }
  return Object.freeze({ drained: true });
}

module.exports = {
  drainEventLedgerWrites,
  startEventLedgerSubscriber,
};
