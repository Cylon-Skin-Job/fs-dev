'use strict';

const path = require('path');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

class ProvenanceConflictError extends Error {
  constructor(message, code = 'provenance_conflict') {
    super(message);
    this.name = 'ProvenanceConflictError';
    this.code = code;
  }
}

function assertNonemptyBoundedString(value, maxBytes, label) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new TypeError(`${label} must be a nonempty string of at most ${maxBytes} UTF-8 bytes`);
  }
  return value;
}

function assertBoundedString(value, maxBytes, label) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new TypeError(`${label} must be a string of at most ${maxBytes} UTF-8 bytes`);
  }
  return value;
}

function assertUuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a canonical lowercase UUID`);
  }
  return value;
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256`);
  }
  return value;
}

function assertTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative integer timestamp`);
  }
  return value;
}

function normalizeCanonicalPath(value, label = 'canonicalPath') {
  assertNonemptyBoundedString(value, 4096, label);
  if (value.includes('\\') || value.startsWith('/') || value.includes('\0')) {
    throw new TypeError(`${label} must be a normalized workspace-relative path`);
  }
  const normalized = path.posix.normalize(value);
  if (
    normalized !== value
    || normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || value.endsWith('/')
  ) throw new TypeError(`${label} must be a normalized workspace-relative path`);
  return value;
}

function normalizeFolderPrefix(value) {
  if (value === '') return '';
  return normalizeCanonicalPath(value, 'folderPrefix');
}

function normalizeFingerprint(value, { allowNull = false } = {}) {
  if (value == null && allowNull) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('fingerprint must be an object');
  }
  const keys = Object.keys(value).sort();
  const expected = ['birthtimeMs', 'dev', 'ino', 'size'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new TypeError('fingerprint must contain exactly birthtimeMs, dev, ino, size');
  }
  const dev = String(value.dev);
  const ino = String(value.ino);
  if (!/^[0-9]+$/u.test(dev) || !/^[0-9]+$/u.test(ino)) {
    throw new TypeError('fingerprint dev and ino must be nonnegative integers');
  }
  if (!Number.isSafeInteger(value.size) || value.size < 0) {
    throw new TypeError('fingerprint size must be a nonnegative safe integer');
  }
  if (value.birthtimeMs != null && (!Number.isSafeInteger(value.birthtimeMs) || value.birthtimeMs < 0)) {
    throw new TypeError('fingerprint birthtimeMs must be null or a nonnegative integer');
  }
  return Object.freeze({ dev, ino, size: value.size, birthtimeMs: value.birthtimeMs ?? null });
}

function fingerprintFromRow(row, prefix = 'fingerprint_') {
  if (row[`${prefix}dev`] == null) return null;
  return {
    dev: row[`${prefix}dev`],
    ino: row[`${prefix}ino`],
    size: row[`${prefix}size`],
    birthtimeMs: row[`${prefix}birthtime_ms`],
  };
}

function fingerprintsEqual(left, right) {
  if (!left || !right) return false;
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.birthtimeMs === right.birthtimeMs;
}

module.exports = {
  ProvenanceConflictError,
  assertBoundedString,
  assertNonemptyBoundedString,
  assertSha256,
  assertTimestamp,
  assertUuid,
  fingerprintFromRow,
  fingerprintsEqual,
  normalizeCanonicalPath,
  normalizeFingerprint,
  normalizeFolderPrefix,
};
