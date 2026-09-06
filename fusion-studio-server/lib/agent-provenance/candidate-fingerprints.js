'use strict';

const crypto = require('crypto');
const path = require('path');
const { assertSha256 } = require('../file-mutations/provenance-values');

const DOMAIN = Buffer.from('fusion-agent-candidate-v1\0', 'ascii');
const MAX_CANDIDATES = 64;
const MAX_CODE_UNITS = 4096;
const MAX_UTF8_BYTES = 4096;

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

function acceptedCandidateSha256(canonicalPath) {
  return crypto.createHash('sha256')
    .update(DOMAIN)
    .update('accepted\0', 'ascii')
    .update(canonicalPath, 'utf8')
    .digest('hex');
}

function rejectedCandidateSha256(candidate, reason) {
  if (typeof candidate !== 'string') throw new TypeError('rejected candidate must be a string');
  if (!['outside_workspace', 'invalid_path', 'blocked_before_execution'].includes(reason)) {
    throw new TypeError('rejection reason is invalid');
  }
  const codeUnitLength = candidate.length;
  const prefix = candidate.slice(0, 4097);
  const encoded = Buffer.allocUnsafe(prefix.length * 2);
  for (let index = 0; index < prefix.length; index += 1) encoded.writeUInt16LE(prefix.charCodeAt(index), index * 2);
  return crypto.createHash('sha256')
    .update(DOMAIN)
    .update('rejected\0', 'ascii')
    .update(reason, 'ascii')
    .update('\0', 'ascii')
    .update(String(codeUnitLength), 'ascii')
    .update('\0', 'ascii')
    .update(encoded)
    .digest('hex');
}

function normalizeComponents(value, { rejectEscape }) {
  const stack = [];
  for (const component of value.split('/')) {
    if (component === '' || component === '.') continue;
    if (component === '..') {
      if (stack.length === 0) {
        if (rejectEscape) return null;
        continue;
      }
      stack.pop();
    } else {
      stack.push(component);
    }
  }
  return stack;
}

function admitCandidatePath(candidate, canonicalRoot) {
  if (typeof candidate !== 'string') return null;
  const reject = (reason) => Object.freeze({
    accepted: false,
    reason,
    candidateSha256: rejectedCandidateSha256(candidate, reason),
  });
  const rawLength = candidate.length;
  if (rawLength > MAX_CODE_UNITS || candidate.includes('\0') || candidate.includes('\\') || hasUnpairedSurrogate(candidate)) {
    return reject('invalid_path');
  }
  if (Buffer.byteLength(candidate, 'utf8') > MAX_UTF8_BYTES) return reject('invalid_path');
  if (typeof canonicalRoot !== 'string'
    || !path.posix.isAbsolute(canonicalRoot)
    || canonicalRoot.includes('\0')
    || canonicalRoot.includes('\\')
    || path.posix.normalize(canonicalRoot) !== canonicalRoot
    || (canonicalRoot !== '/' && canonicalRoot.endsWith('/'))) {
    throw new TypeError('canonicalRoot must be an absolute canonical path');
  }

  let relativeComponents;
  if (candidate.startsWith('/')) {
    const rootComponents = normalizeComponents(canonicalRoot, { rejectEscape: false });
    const candidateComponents = normalizeComponents(candidate, { rejectEscape: false });
    const inRoot = rootComponents.every((component, index) => candidateComponents[index] === component);
    if (!inRoot) return reject('outside_workspace');
    relativeComponents = candidateComponents.slice(rootComponents.length);
  } else {
    relativeComponents = normalizeComponents(candidate, { rejectEscape: true });
    if (!relativeComponents) return reject('outside_workspace');
  }
  if (relativeComponents.length === 0) return reject('invalid_path');
  const canonicalPath = relativeComponents.join('/');
  if (Buffer.byteLength(canonicalPath, 'utf8') > MAX_UTF8_BYTES) return reject('invalid_path');
  const slash = canonicalPath.lastIndexOf('/');
  const fileName = slash < 0 ? canonicalPath : canonicalPath.slice(slash + 1);
  if (Buffer.byteLength(fileName, 'utf8') > 255) return reject('invalid_path');
  return Object.freeze({
    accepted: true,
    canonicalPath,
    fileName,
    folderPath: slash < 0 ? '' : canonicalPath.slice(0, slash),
    candidateSha256: acceptedCandidateSha256(canonicalPath),
  });
}

function retainCandidates(candidates) {
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
  const retained = [];
  const seen = new Set();
  let reportedCount = 0;
  for (const candidate of candidates) {
    assertSha256(candidate.candidateSha256, 'candidateSha256');
    const key = [candidate.candidateSha256, candidate.accessFamily, candidate.accessKind, candidate.extractionBasis].join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    reportedCount += 1;
    if (reportedCount === MAX_CANDIDATES + 1) {
      return Object.freeze({ reportedCount: 65, retainedCount: 64, truncated: true, candidates: Object.freeze(retained) });
    }
    retained.push(Object.freeze({ ...candidate, candidateOrdinal: retained.length }));
  }
  return Object.freeze({
    reportedCount,
    retainedCount: retained.length,
    truncated: false,
    candidates: Object.freeze(retained),
  });
}

module.exports = {
  MAX_CANDIDATES,
  acceptedCandidateSha256,
  admitCandidatePath,
  rejectedCandidateSha256,
  retainCandidates,
};
