'use strict';

const path = require('node:path');
const { commitWorkspaceRootForBindingResult } = require('./view-capsule-registry.cjs');

const MAX_BINDING_FRAME_BYTES = 8192;
const DEFAULT_CORRELATION_TIMEOUT_MS = 2000;

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function parseServerWorkspaceBinding(value) {
  if (!hasExactKeys(value, ['bindingRevision', 'repoPath', 'version', 'workspaceId'])
    || value.version !== 1
    || !Number.isSafeInteger(value.bindingRevision) || value.bindingRevision < 1) return null;
  if (value.workspaceId === null && value.repoPath === null) {
    return Object.freeze({
      bindingRevision: value.bindingRevision,
      workspaceId: null,
      repoPath: null,
    });
  }
  if (typeof value.workspaceId !== 'string' || value.workspaceId.length === 0
    || Buffer.byteLength(value.workspaceId, 'utf8') > 256
    || /[\u0000-\u001f\u007f]/.test(value.workspaceId)
    || typeof value.repoPath !== 'string' || !path.isAbsolute(value.repoPath)
    || value.repoPath.includes('\0') || Buffer.byteLength(value.repoPath, 'utf8') > 4096) return null;
  return Object.freeze({
    bindingRevision: value.bindingRevision,
    workspaceId: value.workspaceId,
    repoPath: path.resolve(value.repoPath),
  });
}

function createServerWorkspaceBindingParser({ onBinding, onError = () => {} } = {}) {
  if (typeof onBinding !== 'function') throw new TypeError('onBinding is required');
  let pending = Buffer.alloc(0);
  let failed = false;

  function fail() {
    if (failed) return;
    failed = true;
    pending = Buffer.alloc(0);
    onError(new Error('server_workspace_binding_invalid'));
  }

  function push(chunk) {
    if (failed || !Buffer.isBuffer(chunk)) return;
    let nextPending = Buffer.concat([pending, chunk]);
    const bindings = [];
    while (!failed) {
      const newline = nextPending.indexOf(0x0a);
      if (newline === -1) break;
      if (newline === 0 || newline + 1 > MAX_BINDING_FRAME_BYTES) {
        fail();
        return;
      }
      const frame = nextPending.subarray(0, newline);
      nextPending = nextPending.subarray(newline + 1);
      const text = frame.toString('utf8');
      if (!Buffer.from(text, 'utf8').equals(frame)) { fail(); return; }
      let value;
      try { value = JSON.parse(text); } catch { fail(); return; }
      const parsed = parseServerWorkspaceBinding(value);
      if (!parsed) { fail(); return; }
      bindings.push(parsed);
    }
    if (nextPending.length > MAX_BINDING_FRAME_BYTES) { fail(); return; }
    pending = nextPending;
    for (const binding of bindings) {
      try { onBinding(binding); } catch { fail(); return; }
    }
  }

  function end() {
    if (!failed && pending.length !== 0) fail();
  }

  return Object.freeze({ push, end });
}

function createServerWorkspaceBindingAuthority({
  getRuntimeGeneration,
  getExpectedGeneration,
  installBinding,
  revokeBinding,
  getInstalledBinding,
  setWorkspaceRoot,
  correlationTimeoutMs = DEFAULT_CORRELATION_TIMEOUT_MS,
} = {}) {
  if ([getRuntimeGeneration, getExpectedGeneration, installBinding, revokeBinding,
    getInstalledBinding, setWorkspaceRoot]
    .some((value) => typeof value !== 'function')) throw new TypeError('binding authority capabilities are required');
  if (!Number.isInteger(correlationTimeoutMs) || correlationTimeoutMs < 1 || correlationTimeoutMs > 30_000) {
    throw new TypeError('correlationTimeoutMs must be an integer from 1 through 30000');
  }
  let version = 0;
  let authoritative = null;
  let installation = null;
  let pendingCorrelation = null;

  function isWorkspaceId(value) {
    return value === null || (typeof value === 'string' && value.length > 0
      && Buffer.byteLength(value, 'utf8') <= 256
      && !/[\u0000-\u001f\u007f]/.test(value));
  }

  function matchesGeneration(generation) {
    return typeof generation === 'string' && generation.length > 0
      && getExpectedGeneration() === generation;
  }

  function beginInstallation(snapshot = authoritative) {
    if (!snapshot || getRuntimeGeneration() !== snapshot.runtimeGeneration) return Promise.resolve(false);
    if (installation && installation.version === snapshot.version) return installation.promise;
    setWorkspaceRoot(null);
    const promise = Promise.resolve(installBinding(
      { workspaceId: snapshot.workspaceId, repoPath: snapshot.repoPath },
      snapshot.runtimeGeneration,
    )).then((accepted) => {
      if (authoritative !== snapshot || version !== snapshot.version
        || getRuntimeGeneration() !== snapshot.runtimeGeneration) return false;
      const currentBinding = getInstalledBinding();
      return commitWorkspaceRootForBindingResult(accepted, currentBinding, setWorkspaceRoot)
        || (snapshot.workspaceId === null && snapshot.repoPath === null && currentBinding === null);
    }, () => false);
    installation = Object.freeze({ version: snapshot.version, promise });
    return promise;
  }

  function settlePending(snapshot, result) {
    if (!snapshot || pendingCorrelation !== snapshot) return;
    pendingCorrelation = null;
    clearTimeout(snapshot.timeout);
    snapshot.resolve(Boolean(result));
  }

  function expirePending(snapshot) {
    if (!snapshot || pendingCorrelation !== snapshot) return;
    version += 1;
    authoritative = authoritative ? Object.freeze({ ...authoritative, version }) : null;
    installation = null;
    revokeBinding(snapshot.runtimeGeneration);
    setWorkspaceRoot(null);
    settlePending(snapshot, false);
  }

  function revokeForPendingCorrelation(runtimeGeneration) {
    version += 1;
    authoritative = authoritative ? Object.freeze({ ...authoritative, version }) : null;
    installation = null;
    revokeBinding(runtimeGeneration);
    setWorkspaceRoot(null);
  }

  function isExactBinding(binding, workspaceId, bindingRevision, runtimeGeneration) {
    return Boolean(binding
      && binding.workspaceId === workspaceId
      && binding.bindingRevision === bindingRevision
      && binding.runtimeGeneration === runtimeGeneration);
  }

  function startPendingInstallation(pending, binding = authoritative) {
    if (pendingCorrelation !== pending
      || !isExactBinding(binding, pending.workspaceId, pending.bindingRevision, pending.runtimeGeneration)) return;
    void beginInstallation(binding).then((installed) => {
      if (pendingCorrelation !== pending || authoritative !== binding || version !== binding.version
        || getRuntimeGeneration() !== pending.runtimeGeneration) return;
      settlePending(pending, installed);
    });
  }

  function beginPendingCorrelation(workspaceId, bindingRevision, runtimeGeneration) {
    revokeForPendingCorrelation(runtimeGeneration);
    let resolve;
    const promise = new Promise((settle) => { resolve = settle; });
    const snapshot = {
      workspaceId,
      bindingRevision,
      runtimeGeneration,
      promise,
      resolve,
      timeout: null,
    };
    snapshot.timeout = setTimeout(() => expirePending(snapshot), correlationTimeoutMs);
    snapshot.timeout.unref?.();
    pendingCorrelation = snapshot;
    startPendingInstallation(snapshot);
    return promise;
  }

  function accept(value, runtimeGeneration) {
    if (!matchesGeneration(runtimeGeneration)
      || !hasExactKeys(value, ['bindingRevision', 'repoPath', 'workspaceId'])) return false;
    const parsed = parseServerWorkspaceBinding({ version: 1, ...value });
    if (!parsed) return false;
    if (authoritative?.runtimeGeneration === runtimeGeneration
      && parsed.bindingRevision <= authoritative.bindingRevision) return false;
    version += 1;
    authoritative = Object.freeze({
      ...parsed,
      runtimeGeneration,
      version,
    });
    installation = null;
    if (getRuntimeGeneration() === runtimeGeneration) revokeBinding(runtimeGeneration);
    setWorkspaceRoot(null);
    const pending = pendingCorrelation;
    if (pending) {
      if (isExactBinding(
        authoritative,
        pending.workspaceId,
        pending.bindingRevision,
        pending.runtimeGeneration,
      )) {
        startPendingInstallation(pending, authoritative);
      } else if (authoritative.bindingRevision >= pending.bindingRevision) {
        settlePending(pending, false);
      }
    }
    return true;
  }

  function activate(runtimeGeneration) {
    if (!authoritative || authoritative.runtimeGeneration !== runtimeGeneration
      || getRuntimeGeneration() !== runtimeGeneration) return Promise.resolve(false);
    return beginInstallation(authoritative);
  }

  async function correlate(workspaceId, bindingRevision, runtimeGeneration) {
    if (!matchesGeneration(runtimeGeneration) || getRuntimeGeneration() !== runtimeGeneration) return false;
    if (!isWorkspaceId(workspaceId)
      || !Number.isSafeInteger(bindingRevision) || bindingRevision < 1) {
      if (pendingCorrelation) settlePending(pendingCorrelation, false);
      revokeForPendingCorrelation(runtimeGeneration);
      return false;
    }
    if (authoritative?.runtimeGeneration === runtimeGeneration
      && authoritative.bindingRevision > bindingRevision) {
      return false;
    }
    if (authoritative?.runtimeGeneration === runtimeGeneration
      && authoritative.bindingRevision === bindingRevision
      && authoritative.workspaceId !== workspaceId) {
      if (pendingCorrelation) settlePending(pendingCorrelation, false);
      revokeForPendingCorrelation(runtimeGeneration);
      return false;
    }
    if (pendingCorrelation) {
      if (pendingCorrelation.workspaceId === workspaceId
        && pendingCorrelation.bindingRevision === bindingRevision
        && pendingCorrelation.runtimeGeneration === runtimeGeneration) return pendingCorrelation.promise;
      settlePending(pendingCorrelation, false);
      return beginPendingCorrelation(workspaceId, bindingRevision, runtimeGeneration);
    }
    return beginPendingCorrelation(workspaceId, bindingRevision, runtimeGeneration);
  }

  function retire() {
    if (pendingCorrelation) settlePending(pendingCorrelation, false);
    version += 1;
    authoritative = null;
    installation = null;
    const runtimeGeneration = getRuntimeGeneration();
    if (typeof runtimeGeneration === 'string' && runtimeGeneration.length > 0) {
      revokeBinding(runtimeGeneration);
    }
    setWorkspaceRoot(null);
  }

  function invalidateInstallation() {
    if (pendingCorrelation) settlePending(pendingCorrelation, false);
    version += 1;
    authoritative = authoritative ? Object.freeze({ ...authoritative, version }) : null;
    installation = null;
    setWorkspaceRoot(null);
  }

  function getCurrent() {
    if (!authoritative || authoritative.runtimeGeneration !== getRuntimeGeneration()) return null;
    return Object.freeze({
      workspaceId: authoritative.workspaceId,
      bindingRevision: authoritative.bindingRevision,
      repoPath: authoritative.repoPath,
      runtimeGeneration: authoritative.runtimeGeneration,
    });
  }

  return Object.freeze({ accept, activate, correlate, retire, invalidateInstallation, getCurrent });
}

module.exports = {
  MAX_BINDING_FRAME_BYTES,
  DEFAULT_CORRELATION_TIMEOUT_MS,
  parseServerWorkspaceBinding,
  createServerWorkspaceBindingParser,
  createServerWorkspaceBindingAuthority,
};
