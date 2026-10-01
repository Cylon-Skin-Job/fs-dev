'use strict';

// Ephemeral, opt-in observations of an exact interactive drain. No bus, DB or logs.
const { normalizeRuntimeRoot } = require('./runtime-identity');
const turns = new Map();
const subscribers = new Set();
let nextGeneration = 0;
const MAX_QUEUE_UNITS = 131072;
const keyOf = (route) => JSON.stringify([
  route.workspaceId, normalizeRuntimeRoot(route), route.threadId,
]);
const same = (subscriber, turn) => subscriber.key === turn.key;
function hasObservers(turn) { return [...subscribers].some((s) => same(s, turn)); }
function envelope(turn) {
  return turn ? { turnId: turn.turnId, generation: turn.generation, drainId: turn.drainId,
    terminal: turn.terminal, availability: turn.availability } : {
    turnId: null, generation: 0, drainId: null, terminal: false, availability: 'idle',
  };
}
function resetSubscriber(s, turn) {
  s.turn = turn;
  s.events = [];
  s.units = 0;
  s.dropped = 0;
  s.reset = true;
  s.baseline = turn?.seq ?? 0;
}
function beginDiagnosticTurn(route, { turnId, drainId, isCurrent }) {
  const key = keyOf(route);
  const turn = { key, turnId, drainId, generation: ++nextGeneration, seq: 0,
    terminal: false, availability: 'unsupported', isCurrent };
  turns.get(key)?.discard?.();
  const discards = new Set();
  turn.discard = () => { for (const fn of discards) { try { fn(); } catch { /* observer-only */ } } };
  turns.set(key, turn);
  for (const s of subscribers) if (same(s, turn)) resetSubscriber(s, turn);
  const current = () => turns.get(key) === turn && isCurrent();
  return {
    isObserved: () => current() && hasObservers(turn),
    reserveSequence() { return current() ? ++turn.seq : null; },
    onDiscard(fn) { discards.add(fn); return () => discards.delete(fn); },
    available() { if (current()) turn.availability = 'available'; },
    emit(event) {
      if (!current() || !hasObservers(turn)) return;
      const record = { ...event, seq: event.seq ?? ++turn.seq };
      for (const s of subscribers) {
        if (!same(s, turn) || record.seq <= s.baseline) continue;
        if (record.firstSeq <= s.baseline) { s.dropped += record.seq - s.baseline; continue; }
        s.events.push(record);
        s.units += record.text.length;
        while (s.units > MAX_QUEUE_UNITS || s.events.length > 128) {
          s.units -= s.events.shift().text.length;
          s.dropped += 1;
        }
      }
    },
    finish() {
      turn.terminal = true;
      if (turns.get(key) === turn && !hasObservers(turn)) turns.delete(key);
    },
  };
}

function subscribeDiagnostic({ route, subscriptionId, ws, isCurrent, onDispose = () => {} }) {
  const key = keyOf(route);
  const s = { key, route, subscriptionId, ws, isCurrent, lastState: null };
  resetSubscriber(s, turns.get(key) ?? null);
  subscribers.add(s);
  let timer;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    subscribers.delete(s);
    s.events = [];
    onDispose();
    const turn = turns.get(key);
    if (turn && !hasObservers(turn)) {
      turn.discard();
      if (turn.terminal) turns.delete(key);
    }
  };
  const flush = () => {
    if (!isCurrent() || ws.readyState !== 1) { dispose(); return; }
    // A slow browser never queues unbounded sends or blocks canonical delivery.
    if ((ws.bufferedAmount || 0) > 262144) return;
    const state = envelope(s.turn);
    const stateKey = JSON.stringify(state);
    if (!s.reset && s.events.length === 0 && s.dropped === 0 && stateKey === s.lastState) return;
    const frame = { type: 'chat-turn:diagnostic:stream', subscriptionId,
      workspaceId: route.workspaceId, threadId: route.threadId, ...state,
      reset: s.reset, baseline: s.baseline, dropped: s.dropped, events: s.events };
    s.events = []; s.units = 0; s.dropped = 0; s.reset = false; s.lastState = stateKey;
    try { ws.send(JSON.stringify(frame)); } catch { dispose(); }
  };
  timer = setInterval(flush, 100);
  timer.unref?.();
  flush();
  return dispose;
}
module.exports = { beginDiagnosticTurn, subscribeDiagnostic };
