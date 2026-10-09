/**
 * Console log tee.
 *
 * Overrides console output so request-descendant diagnostics are minimized;
 * console.log is also appended as timestamped lines to a log file.
 * Extracted from server.js per SPEC-01g. Install point matters: lines
 * logged before installLogTee() runs reach stdout only, not the file.
 */

const fs = require('fs');
const path = require('path');
const { minimizeRequestDiagnosticArgs } = require('./ws/request-diagnostic-context');

function resolveServerLogPath({ appUserData, serverDir }) {
  const userDataPath = typeof appUserData === 'string' ? appUserData.trim() : '';
  if (userDataPath) {
    return path.join(path.resolve(userDataPath), 'server-live.log');
  }
  return path.join(serverDir, 'server-live.log');
}

function installLogTee(logFilePath) {
  const originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  const wrappers = {};
  const projectArgs = (level, args) => {
    const requestArgs = minimizeRequestDiagnosticArgs(level, args);
    if (requestArgs !== args) return requestArgs;
    const marker = level === 'error'
      ? 'diagnostic_error'
      : level === 'warn'
        ? 'diagnostic_warning'
        : 'diagnostic_log';
    return [`[Server] ${marker}`];
  };
  wrappers.log = function(...args) {
    const safeArgs = projectArgs('log', args);
    originals.log.apply(console, safeArgs);
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${safeArgs.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}
`;
    fs.appendFileSync(logFilePath, line);
  };
  wrappers.warn = function(...args) {
    originals.warn.apply(console, projectArgs('warn', args));
  };
  wrappers.error = function(...args) {
    originals.error.apply(console, projectArgs('error', args));
  };
  console.log = wrappers.log;
  console.warn = wrappers.warn;
  console.error = wrappers.error;
  return function restoreLogTee() {
    if (console.log === wrappers.log) console.log = originals.log;
    if (console.warn === wrappers.warn) console.warn = originals.warn;
    if (console.error === wrappers.error) console.error = originals.error;
  };
}

module.exports = { installLogTee, resolveServerLogPath };
