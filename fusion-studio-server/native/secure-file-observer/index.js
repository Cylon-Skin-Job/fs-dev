'use strict';

const path = require('path');

let addon = null;
let loadError = null;
try {
  if (process.platform === 'darwin') {
    addon = require(path.join(__dirname, 'build', 'Release', 'secure_file_observer.node'));
    if (typeof addon.observe !== 'function' || typeof addon.monotonicNowNs !== 'function') {
      loadError = new Error('secure file observer ABI is incomplete');
      addon = null;
    }
  } else {
    loadError = new Error('secure file observation requires Darwin');
  }
} catch (error) {
  loadError = error;
}

function deadlineAfterMilliseconds(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 2_000) {
    throw new TypeError('secure observer deadline duration is invalid');
  }
  if (!addon) return 0n;
  return addon.monotonicNowNs() + BigInt(Math.floor(milliseconds * 1_000_000));
}

function unavailable() {
  return Object.freeze({ status: 'failed', reason: 'secure_open_unavailable' });
}

function createCancellationHandle() {
  const view = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  return Object.freeze({
    view,
    cancel() {
      Atomics.store(view, 0, 1);
      Atomics.notify(view, 0);
    },
    get cancelled() { return Atomics.load(view, 0) !== 0; },
  });
}

async function observeSecureFile(input) {
  if (!addon || typeof addon.observe !== 'function') return unavailable();
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('secure observer input is required');
  }
  if (typeof input.rootPath !== 'string' || !path.isAbsolute(input.rootPath)
    || input.rootPath.includes('\0')) {
    throw new TypeError('secure observer root is invalid');
  }
  if (typeof input.relativePath !== 'string' || input.relativePath.includes('\0')
    || input.relativePath.includes('\\') || input.relativePath.startsWith('/')
    || Buffer.byteLength(input.relativePath, 'utf8') > 4096
    || input.relativePath.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new TypeError('secure observer relative path is invalid');
  }
  if (!Number.isSafeInteger(input.byteLimit) || input.byteLimit < 0 || input.byteLimit > 10 * 1024 * 1024) {
    throw new TypeError('secure observer byte limit is invalid');
  }
  const pair = [input.expectedRootDevice, input.expectedRootInode];
  if ((pair[0] == null) !== (pair[1] == null)
    || pair.some((value) => value != null && !/^(?:0|[1-9][0-9]{0,19})$/u.test(value))) {
    throw new TypeError('secure observer root identity is invalid');
  }
  const deadlineNs = input.deadlineNs ?? deadlineAfterMilliseconds(2_000);
  const result = await addon.observe({
    rootPath: input.rootPath,
    relativePath: input.relativePath,
    expectedRootDevice: input.expectedRootDevice ?? null,
    expectedRootInode: input.expectedRootInode ?? null,
    byteLimit: input.byteLimit,
    deadlineNs: String(deadlineNs),
    cancelView: input.cancellation?.view ?? input.cancelView ?? null,
    ...(process.env.FUSION_SECURE_OBSERVER_SMOKE_HOOKS === '1'
      && input.testParentBarrier instanceof Int32Array
      ? { testParentBarrier: input.testParentBarrier }
      : {}),
  });
  if (result?.status === 'bytes' && Buffer.isBuffer(result.bytes)) {
    return Object.freeze({ ...result });
  }
  return Object.freeze({ ...result });
}

module.exports = Object.freeze({
  available: Boolean(addon?.observe && addon?.monotonicNowNs),
  loadErrorCode: loadError ? 'secure_open_unavailable' : null,
  createCancellationHandle,
  deadlineAfterMilliseconds,
  observeSecureFile,
});
