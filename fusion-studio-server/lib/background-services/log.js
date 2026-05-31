/**
 * Persistent log for background service failures.
 *
 * Server stdout/stderr routing depends on how the app was launched. This file
 * gives background safety catches one stable place to write non-fatal failures.
 */

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '../../data/background-services.log');

function ensureDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function write(entry) {
  ensureDir();
  const record = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
}

function logFailure(service, err) {
  try {
    write({
      level: 'error',
      service,
      message: err && err.message ? err.message : String(err),
      code: err && err.code ? err.code : null,
    });
  } catch (logErr) {
    console.error('[Background:log] failed:', logErr.message);
  }
}

module.exports = {
  LOG_PATH,
  logFailure,
};
