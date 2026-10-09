const { run } = require('./sync');
const { runSafely, setSafeInterval } = require('../../background-services/safety');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let inFlight = false;

async function runSync() {
  if (inFlight) return;
  inFlight = true;
  try {
    await run();
  } catch (err) {
    console.warn('[Calendar:Google] sync skipped:', err?.message || err);
  } finally {
    inFlight = false;
  }
}

function start() {
  runSafely('Calendar:Google sync', runSync); // initial fetch on startup
  setSafeInterval('Calendar:Google sync', runSync, POLL_INTERVAL_MS);
}

module.exports = { start };
