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

let activeLogFilePath = null;
let activeTempChatLogFd = null;

// TEMP CHAT-AR I-007: remove this private sink or migrate its closed fields to
// the governed, content-free health subscriber when that owner is implemented.
// Never pass prompts, argv, paths, stderr, provider JSON, or raw error text.
const TEMP_CHAT_STAGES = new Set([
  'dispatch_failure', 'spawn_attempt', 'spawn_return', 'spawn_throw',
  'spawn_error', 'child_close', 'session_patch_committed',
  'session_patch_error', 'missing_session_id',
  'prompt_frame', 'prompt_denied', 'prompt_routed', 'prompt_lease_denied',
  'status_frame', 'status_denied', 'status_result', 'status_error',
  'thread_open_request', 'thread_open_unbound', 'thread_open_return', 'thread_open_error',
]);
const TEMP_CHAT_ERROR_CODES = new Set([
  'EMFILE', 'ENFILE', 'ENOENT', 'EACCES', 'EPERM', 'EAGAIN', 'ENOSPC', 'ENOMEM',
  'E2BIG', 'EBADF', 'EINVAL', 'EIO', 'ENOTDIR', 'ETXTBSY',
  'ERR_INVALID_ARG_TYPE', 'ERR_INVALID_ARG_VALUE', 'ERR_OUT_OF_RANGE',
  'SQLITE_BUSY', 'SQLITE_FULL', 'SQLITE_IOERR', 'SQLITE_READONLY',
  'HARNESS_AUTHENTICATION_FAILED', 'HARNESS_MODEL_TIMEOUT', 'HARNESS_PROCESS_EXIT',
]);
const TEMP_CHAT_ERROR_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'SystemError']);
const TEMP_CHAT_RECEIPT_OUTCOMES = new Set(['reserved', 'accepted', 'rejected', 'cancelled']);

function logTemporaryChatBoundary(stage, fields = {}) {
  if (!activeLogFilePath || !TEMP_CHAT_STAGES.has(stage)) return;
  const record = { event: 'temp_chat_boundary_v1', stage };
  for (const key of ['threadId', 'turnId']) {
    if (typeof fields[key] === 'string' && /^[0-9a-f-]{36}$/i.test(fields[key])) {
      record[key] = fields[key];
    }
  }
  if (typeof fields.requestId === 'string' && /^[0-9a-f]{32}$/i.test(fields.requestId)) {
    record.requestId = fields.requestId;
  }
  for (const key of ['harnessId', 'expectedHarnessId']) {
    if (typeof fields[key] === 'string' && /^[a-z0-9_-]{1,32}$/.test(fields[key])) {
      record[key] = fields[key];
    }
  }
  if (Number.isSafeInteger(fields.pid) && fields.pid > 0) record.pid = fields.pid;
  if (Number.isSafeInteger(fields.exitCode) && fields.exitCode >= 0 && fields.exitCode <= 255) {
    record.exitCode = fields.exitCode;
  }
  if (typeof fields.signal === 'string' && /^SIG[A-Z0-9]{1,16}$/.test(fields.signal)) {
    record.signal = fields.signal;
  }
  if (TEMP_CHAT_ERROR_CODES.has(fields.errorCode)) record.errorCode = fields.errorCode;
  if (TEMP_CHAT_ERROR_NAMES.has(fields.errorName)) record.errorName = fields.errorName;
  if (TEMP_CHAT_RECEIPT_OUTCOMES.has(fields.receiptOutcome)) record.receiptOutcome = fields.receiptOutcome;
  if (Number.isSafeInteger(fields.errno) && fields.errno >= -4095 && fields.errno <= 4095) {
    record.errno = fields.errno;
  }
  for (const key of ['sawNativeJson', 'sawSessionId', 'hadStoredSessionId', 'sawTurnEnd', 'stopRequested', 'hadBoundTurn', 'environmentReady', 'hasThreadId']) {
    if (typeof fields[key] === 'boolean') record[key] = fields[key];
  }
  try {
    const line = `[${new Date().toISOString()}] ${JSON.stringify(record)}\n`;
    if (activeTempChatLogFd !== null) fs.writeSync(activeTempChatLogFd, line);
    else fs.appendFileSync(activeLogFilePath, line);
  } catch { /* Best-effort temporary diagnostics must not affect a chat turn. */ }
}

function resolveServerLogPath({ appUserData, serverDir }) {
  const userDataPath = typeof appUserData === 'string' ? appUserData.trim() : '';
  if (userDataPath) {
    return path.join(path.resolve(userDataPath), 'server-live.log');
  }
  return path.join(serverDir, 'server-live.log');
}

function installLogTee(logFilePath) {
  activeLogFilePath = logFilePath;
  try {
    // Keep one descriptor available to record a later EMFILE child-spawn failure.
    activeTempChatLogFd = fs.openSync(logFilePath, 'a');
  } catch { activeTempChatLogFd = null; }
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
    if (activeLogFilePath === logFilePath) {
      activeLogFilePath = null;
      if (activeTempChatLogFd !== null) {
        try { fs.closeSync(activeTempChatLogFd); } catch { /* Teardown only. */ }
        activeTempChatLogFd = null;
      }
    }
    if (console.log === wrappers.log) console.log = originals.log;
    if (console.warn === wrappers.warn) console.warn = originals.warn;
    if (console.error === wrappers.error) console.error = originals.error;
  };
}

module.exports = { installLogTee, resolveServerLogPath, logTemporaryChatBoundary };
