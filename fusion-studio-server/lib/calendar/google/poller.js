const { run } = require('./sync');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function start() {
  run(); // initial fetch on startup
  setInterval(run, POLL_INTERVAL_MS);
}

module.exports = { start };
