'use strict';

const { on } = require('../event-bus');
const { getDb } = require('../db');
const { isRecordedEventType, recordEvent } = require('./event-ledger');

let stopCurrent = null;

function startEventLedgerSubscriber(options = {}) {
  if (stopCurrent) return stopCurrent;

  const dbProvider = options.getDb || getDb;
  const logger = options.logger || console;
  const unsubscribe = on('*', (event) => {
    if (!event || !isRecordedEventType(event.type)) return;

    Promise.resolve()
      .then(() => recordEvent(dbProvider(), event))
      .catch((err) => {
        logger.warn('[EventLedger] write failed:', err.message);
      });
  });

  stopCurrent = () => {
    unsubscribe();
    stopCurrent = null;
  };

  logger.log('[EventLedger] Subscriber started');
  return stopCurrent;
}

module.exports = {
  startEventLedgerSubscriber,
};
