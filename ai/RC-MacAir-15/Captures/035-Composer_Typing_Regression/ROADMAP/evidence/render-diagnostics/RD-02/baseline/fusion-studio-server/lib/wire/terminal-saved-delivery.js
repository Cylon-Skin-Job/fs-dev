'use strict';

// A bounded transport fallback for a real saved event after Stop retired its
// provider route. Owns no runtime/persistence state and never manufactures ACKs.
const { on, drainEventEffects } = require('../event-bus');
const deliveredEvents = new WeakSet();
const LATE_SAVED_DELIVERY_MS = 30_000;

function savedExchangeMessage(event) {
  return {
    type: 'chat-turn:saved', scope: event.scope, threadId: event.threadId,
    turnId: event.turnId, exchangeId: event.exchangeId, seq: event.seq, ts: event.ts,
    partial: event.partial, reason: event.reason, metadata: event.metadata,
  };
}

function deliverSavedExchange(event, send) {
  if (deliveredEvents.has(event)) return true;
  if (!send(savedExchangeMessage(event))) return false;
  deliveredEvents.add(event);
  return true;
}

function retainTimedOutSavedDelivery({ identity, ws, isCurrent }) {
  const exact = Object.freeze({ ...identity });
  let closed = false;
  const controller = new AbortController();
  let unsubscribe;
  let timer;
  const cancel = () => {
    if (closed) return;
    closed = true;
    unsubscribe?.();
    clearTimeout(timer);
    controller.abort();
    ws?.removeListener?.('close', cancel);
  };
  const deliver = event => {
    if (!['workspaceId', 'projectRoot', 'workspaceEpoch', 'threadId', 'turnId']
      .every(field => event[field] === exact[field])) return;
    try {
      // Shared event-local delivery receipt prevents duplicates even if the
      // normal broadcaster races teardown or its first send fails.
      if (!closed && isCurrent() && ws?.readyState === 1) {
        deliverSavedExchange(event, message => {
          ws.send(JSON.stringify(message));
          return true;
        });
      }
    } finally { cancel(); }
  };
  unsubscribe = on('chat-turn:saved', deliver);
  ws?.once?.('close', cancel);
  timer = setTimeout(cancel, LATE_SAVED_DELIVERY_MS);
  timer.unref?.();
  // Failed effects settle without a saved event. A permanently held effect
  // cannot retain this listener beyond the explicit delivery deadline.
  void drainEventEffects(exact, { timeoutMs: LATE_SAVED_DELIVERY_MS, signal: controller.signal }).then(cancel, cancel);
  return cancel;
}

module.exports = { retainTimedOutSavedDelivery, deliverSavedExchange, LATE_SAVED_DELIVERY_MS };
