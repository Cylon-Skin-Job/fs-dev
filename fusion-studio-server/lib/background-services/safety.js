/**
 * Background service safety boundary.
 *
 * Background timers, watchers, and event-bus listeners should fail closed:
 * log one concise error and keep the server alive. Feature modules should
 * stay simple and put their defensive boundary here instead of each service
 * inventing its own crash handling.
 */

const { logFailure } = require('./log');

function reportFailure(name, err) {
  console.error('[Background] service_failed');
  logFailure(name, err);
}

function runSafely(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.catch === 'function') {
      result.catch((err) => {
        reportFailure(name, err);
      });
    }
    return result;
  } catch (err) {
    reportFailure(name, err);
    return null;
  }
}

function safeHandler(name, fn) {
  return (...args) => runSafely(name, () => fn(...args));
}

function setSafeInterval(name, fn, intervalMs) {
  return setInterval(() => runSafely(name, fn), intervalMs);
}

function setSafeTimeout(name, fn, timeoutMs) {
  return setTimeout(() => runSafely(name, fn), timeoutMs);
}

module.exports = {
  runSafely,
  safeHandler,
  setSafeInterval,
  setSafeTimeout,
};
