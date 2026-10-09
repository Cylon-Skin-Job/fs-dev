'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const requestDiagnosticContext = new AsyncLocalStorage();

function runWithRequestDiagnosticBoundary(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('request diagnostic callback is required');
  }
  return requestDiagnosticContext.run(true, callback);
}

function minimizeRequestDiagnosticArgs(level, args) {
  if (requestDiagnosticContext.getStore() !== true) return args;
  const marker = level === 'error'
    ? 'request_error'
    : level === 'warn'
      ? 'request_warning'
      : 'request_log';
  return [`[WS] ${marker}`];
}

module.exports = {
  minimizeRequestDiagnosticArgs,
  runWithRequestDiagnosticBoundary,
};
