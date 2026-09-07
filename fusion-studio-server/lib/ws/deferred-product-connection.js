'use strict';

function createDeferredProductConnection({ ws, build }) {
  if (!ws || typeof ws.once !== 'function' || typeof build !== 'function') {
    throw new TypeError('deferred product connection capabilities are required');
  }
  let product = null;
  let buildStarted = false;
  let closeObserved = false;
  let buildSettled = false;
  let cleanupRan = false;
  let cleanupHandler = null;
  let resolveCleanup;
  const cleanupComplete = new Promise((resolve) => { resolveCleanup = resolve; });

  function cleanup() {
    if (cleanupRan) return cleanupComplete;
    if (!cleanupHandler && buildStarted && !buildSettled) return cleanupComplete;
    cleanupRan = true;
    let result;
    try { result = cleanupHandler?.(); } catch (_error) {}
    Promise.resolve(result)
      .catch(() => {})
      .finally(resolveCleanup);
    return cleanupComplete;
  }

  function ownCleanup(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('product cleanup capability is required');
    }
    if (cleanupHandler && cleanupHandler !== handler) {
      throw new Error('product cleanup capability is already owned');
    }
    cleanupHandler = handler;
    if (closeObserved) void cleanup();
  }

  ws.once('close', () => {
    closeObserved = true;
    void cleanup();
  });

  async function initialize() {
    if (buildStarted || closeObserved) {
      throw new Error('product connection initialization failed');
    }
    buildStarted = true;
    let candidate;
    try {
      candidate = await build(Object.freeze({ ownCleanup }));
      if (!candidate || typeof candidate.handleClose !== 'function') {
        throw new Error('product connection initialization failed');
      }
      ownCleanup(candidate.handleClose);
      if (typeof candidate.handleMessage !== 'function') {
        throw new Error('product connection initialization failed');
      }
    } catch (_error) {
      buildSettled = true;
      await cleanup();
      throw new Error('product connection initialization failed');
    }
    buildSettled = true;
    product = candidate;
    if (closeObserved) {
      await cleanup();
      throw new Error('product connection initialization failed');
    }
  }

  function handleMessage(message, isBinary) {
    if (!product || closeObserved) {
      throw new Error('product connection unavailable');
    }
    return product.handleMessage(message, isBinary);
  }

  function waitForCleanup() {
    if (closeObserved) void cleanup();
    return cleanupComplete;
  }

  return Object.freeze({ initialize, handleMessage, waitForCleanup });
}

module.exports = { createDeferredProductConnection };
