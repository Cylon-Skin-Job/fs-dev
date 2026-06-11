/**
 * Console log tee.
 *
 * Overrides console.log to also append timestamped lines to a log file.
 * Extracted from server.js per SPEC-01g. Install point matters: lines
 * logged before installLogTee() runs reach stdout only, not the file.
 */

const fs = require('fs');

function installLogTee(logFilePath) {
  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}
`;
    fs.appendFileSync(logFilePath, line);
  };
}

module.exports = { installLogTee };
