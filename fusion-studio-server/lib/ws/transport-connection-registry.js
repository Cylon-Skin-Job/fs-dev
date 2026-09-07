'use strict';

function createTransportConnectionRegistry() {
  const connections = new Map();
  const closingCleanups = new Set();

  function track(ws, waitForCleanup = async () => {}) {
    if (!ws || typeof ws.once !== 'function' || typeof ws.terminate !== 'function') {
      throw new TypeError('WebSocket transport is required');
    }
    if (typeof waitForCleanup !== 'function') {
      throw new TypeError('WebSocket cleanup waiter is required');
    }
    if (connections.has(ws)) throw new Error('WebSocket transport is already tracked');
    let settleClosed;
    const closed = new Promise((resolve) => { settleClosed = resolve; });
    const entry = Object.freeze({ closed, settleClosed, waitForCleanup });
    connections.set(ws, entry);
    ws.once('close', () => {
      settleClosed();
      if (connections.get(ws) === entry) connections.delete(ws);
      const closingCleanup = Promise.resolve()
        .then(waitForCleanup)
        .catch(() => {})
        .finally(() => closingCleanups.delete(closingCleanup));
      closingCleanups.add(closingCleanup);
    });
  }

  async function terminateAll() {
    const owned = [...connections.entries()];
    const alreadyClosing = [...closingCleanups];
    connections.clear();
    await Promise.all([
      ...alreadyClosing,
      ...owned.map(async ([ws, entry]) => {
        try { ws.terminate(); } catch (_error) { entry.settleClosed(); }
        await entry.closed;
        try { await entry.waitForCleanup(); } catch (_error) {}
      }),
    ]);
    return owned.length;
  }

  return Object.freeze({ track, terminateAll });
}

module.exports = { createTransportConnectionRegistry };
