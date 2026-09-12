'use strict';

const ERROR_CODE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MAX_ERROR_CODE_BYTES = 64;

class ViewRelocationError extends Error {
  constructor(code, message = 'View registry unavailable', options = {}) {
    super(message);
    this.name = 'ViewRelocationError';
    this.code = parseRelocationErrorCode(code);
    this.journalFailure = options.journalFailure !== false;
  }
}

class ViewRelocationCrashError extends Error {
  constructor(point) {
    super(`Injected view relocation crash: ${point}`);
    this.name = 'ViewRelocationCrashError';
    this.point = point;
  }
}

function parseRelocationErrorCode(value) {
  if (
    typeof value !== 'string'
    || Buffer.byteLength(value, 'utf8') < 1
    || Buffer.byteLength(value, 'utf8') > MAX_ERROR_CODE_BYTES
    || !ERROR_CODE_PATTERN.test(value)
  ) {
    return 'migration_failed';
  }
  return value;
}

function toRelocationError(error, fallbackCode = 'migration_failed') {
  if (error instanceof ViewRelocationError || error instanceof ViewRelocationCrashError) {
    return error;
  }
  return new ViewRelocationError(fallbackCode);
}

module.exports = {
  ERROR_CODE_PATTERN,
  MAX_ERROR_CODE_BYTES,
  ViewRelocationError,
  ViewRelocationCrashError,
  parseRelocationErrorCode,
  toRelocationError,
};
