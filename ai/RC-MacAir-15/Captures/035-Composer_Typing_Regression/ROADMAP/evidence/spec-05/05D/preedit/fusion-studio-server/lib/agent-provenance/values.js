'use strict';

const {
  assertBoundedString,
  assertNonemptyBoundedString,
  assertSha256,
  assertTimestamp,
  assertUuid,
  normalizeCanonicalPath,
} = require('../file-mutations/provenance-values');
const { acceptedCandidateSha256, rejectedCandidateSha256 } = require('./candidate-fingerprints');

const STATUSES = Object.freeze(['announced', 'completed', 'error', 'blocked', 'interrupted']);
const ACCESS_FAMILIES = Object.freeze(['read', 'write', 'execute', 'unknown']);
const ACCESS_KINDS = Object.freeze(['read', 'write', 'create', 'delete', 'move_from', 'move_to', 'execute', 'unknown']);
const EXTRACTION_BASES = Object.freeze([
  'structured_path',
  'shell_input_redirection',
  'shell_output_redirection',
  'shell_known_operand',
]);
const PRE_OBSERVATION_REASONS = Object.freeze(['outside_workspace', 'invalid_path', 'blocked_before_execution']);
const SKIP_REASONS = Object.freeze([...PRE_OBSERVATION_REASONS, 'final_symlink', 'not_regular_file', 'unsupported_text', 'too_large']);
const FAILURE_REASONS = Object.freeze([
  'workspace_unavailable', 'unreadable', 'secure_open_unavailable', 'observation_timeout',
  'observation_incomplete', 'unstable_during_observation', 'identity_conflict',
]);

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function assertScalarBoundedString(value, maxBytes, label, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new TypeError(`${label} has an invalid UTF-8 byte bound`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError(`${label} must contain Unicode scalar values`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new TypeError(`${label} must contain Unicode scalar values`);
  }
  return value;
}

function assertOptional(value, validator) {
  return value == null ? null : validator(value);
}

function assertCanonicalUnsignedDecimal(value, label) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,19})$/u.test(value)) {
    throw new TypeError(`${label} must be canonical unsigned decimal text`);
  }
  return value;
}

function normalizeRootAuthority(input) {
  const digest = assertSha256(input.authorityRootSha256, 'authorityRootSha256');
  const device = input.authorityRootDevice ?? null;
  const inode = input.authorityRootInode ?? null;
  if ((device == null) !== (inode == null)) {
    throw new TypeError('authority root device and inode must be supplied together');
  }
  return Object.freeze({
    authorityRootSha256: digest,
    authorityRootDevice: device == null ? null : assertCanonicalUnsignedDecimal(device, 'authorityRootDevice'),
    authorityRootInode: inode == null ? null : assertCanonicalUnsignedDecimal(inode, 'authorityRootInode'),
  });
}

function pathParts(canonicalPath) {
  assertScalarBoundedString(canonicalPath, 4096, 'canonicalPath');
  const normalized = normalizeCanonicalPath(canonicalPath);
  const slash = normalized.lastIndexOf('/');
  const fileName = slash < 0 ? normalized : normalized.slice(slash + 1);
  const folderPath = slash < 0 ? '' : normalized.slice(0, slash);
  assertNonemptyBoundedString(fileName, 255, 'fileName');
  assertBoundedString(folderPath, 4096, 'folderPath');
  return Object.freeze({ canonicalPath: normalized, fileName, folderPath });
}

function normalizeCandidate(candidate, ordinal) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('candidate must be an object');
  }
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal > 63) throw new TypeError('candidate ordinal is invalid');
  const reason = candidate.reason == null
    ? null
    : assertEnum(candidate.reason, PRE_OBSERVATION_REASONS, 'candidate reason');
  const accepted = reason == null;
  const path = accepted ? pathParts(candidate.canonicalPath) : null;
  if (!accepted && candidate.canonicalPath != null && reason !== 'blocked_before_execution') {
    throw new TypeError('rejected candidates cannot retain raw paths');
  }
  const retainedPath = reason === 'blocked_before_execution' && candidate.canonicalPath
    ? pathParts(candidate.canonicalPath)
    : path;
  if (candidate.resourceId != null) throw new TypeError('terminal candidates cannot claim resource identity');
  const suppliedHash = assertSha256(candidate.candidateSha256, 'candidateSha256');
  const expectedHash = retainedPath
    ? acceptedCandidateSha256(retainedPath.canonicalPath)
    : rejectedCandidateSha256(candidate.candidateValue, reason);
  if (suppliedHash !== expectedHash) throw new TypeError('candidateSha256 does not match the normalized candidate');
  return Object.freeze({
    edgeId: assertUuid(candidate.edgeId, 'edgeId'),
    candidateOrdinal: ordinal,
    candidateSha256: suppliedHash,
    resourceId: null,
    ...retainedPath,
    accessFamily: assertEnum(candidate.accessFamily, ACCESS_FAMILIES, 'accessFamily'),
    accessKind: assertEnum(candidate.accessKind, ACCESS_KINDS, 'accessKind'),
    extractionBasis: assertEnum(candidate.extractionBasis, EXTRACTION_BASES, 'extractionBasis'),
    reason,
  });
}

function normalizeActivityIdentity(input) {
  const authority = normalizeRootAuthority(input);
  return Object.freeze({
    activityId: assertUuid(input.activityId, 'activityId'),
    eventId: assertUuid(input.eventId, 'eventId'),
    workspaceId: assertScalarBoundedString(input.workspaceId, 128, 'workspaceId'),
    threadId: assertScalarBoundedString(input.threadId, 128, 'threadId'),
    turnId: assertScalarBoundedString(input.turnId, 128, 'turnId'),
    harnessId: assertScalarBoundedString(input.harnessId, 128, 'harnessId'),
    provider: assertScalarBoundedString(input.provider, 128, 'provider'),
    toolCallId: assertScalarBoundedString(input.toolCallId, 512, 'toolCallId'),
    toolName: assertScalarBoundedString(input.toolName, 128, 'toolName'),
    nativeToolName: assertScalarBoundedString(input.nativeToolName, 128, 'nativeToolName'),
    ...authority,
  });
}

function normalizeTimes(input, status) {
  const terminal = status !== 'announced';
  const announcedObservedAt = assertTimestamp(input.announcedObservedAt, 'announcedObservedAt');
  const times = {
    announcedObservedAt,
    announcedReportedAt: assertOptional(input.announcedReportedAt, (v) => assertTimestamp(v, 'announcedReportedAt')),
    executionStartedReportedAt: assertOptional(input.executionStartedReportedAt, (v) => assertTimestamp(v, 'executionStartedReportedAt')),
    argumentsObservedAt: assertOptional(input.argumentsObservedAt, (v) => assertTimestamp(v, 'argumentsObservedAt')),
    argumentsReportedAt: assertOptional(input.argumentsReportedAt, (v) => assertTimestamp(v, 'argumentsReportedAt')),
    terminalObservedAt: assertOptional(input.terminalObservedAt, (v) => assertTimestamp(v, 'terminalObservedAt')),
    terminalReportedAt: assertOptional(input.terminalReportedAt, (v) => assertTimestamp(v, 'terminalReportedAt')),
    terminalSnapshotReportedAt: assertOptional(input.terminalSnapshotReportedAt, (v) => assertTimestamp(v, 'terminalSnapshotReportedAt')),
    reconciledAt: assertOptional(input.reconciledAt, (v) => assertTimestamp(v, 'reconciledAt')),
  };
  if (terminal !== (times.terminalObservedAt != null)) throw new TypeError('terminal status/time shape is invalid');
  if (times.argumentsReportedAt != null && times.argumentsObservedAt == null) throw new TypeError('arguments reported time needs an observed time');
  if (times.argumentsObservedAt != null && times.argumentsObservedAt < announcedObservedAt) throw new TypeError('arguments observed before announcement');
  if (times.terminalObservedAt != null && times.terminalObservedAt < announcedObservedAt) throw new TypeError('terminal observed before announcement');
  if ([times.executionStartedReportedAt, times.terminalReportedAt, times.terminalSnapshotReportedAt].some((v) => v != null)
    && times.terminalObservedAt == null) throw new TypeError('terminal provider times require a terminal observation');
  if (times.reconciledAt != null && status !== 'interrupted') throw new TypeError('reconciledAt requires interrupted status');
  return Object.freeze(times);
}

module.exports = {
  ACCESS_FAMILIES,
  ACCESS_KINDS,
  EXTRACTION_BASES,
  FAILURE_REASONS,
  PRE_OBSERVATION_REASONS,
  SKIP_REASONS,
  STATUSES,
  assertCanonicalUnsignedDecimal,
  assertEnum,
  assertScalarBoundedString,
  normalizeActivityIdentity,
  normalizeCandidate,
  normalizeRootAuthority,
  normalizeTimes,
  pathParts,
};
