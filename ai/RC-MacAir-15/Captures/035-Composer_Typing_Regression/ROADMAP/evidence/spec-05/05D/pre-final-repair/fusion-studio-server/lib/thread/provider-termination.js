'use strict';

// Bounded provider-process termination; owns no session or runtime state.
const PROVIDER_CLOSE_GRACE_MS = 5_000;
const PROVIDER_CLOSE_FORCE_MS = 5_000;

function createWireTerminationWaiter(wireProcess) {
  if (!wireProcess) return null;
  if (wireProcess.exitCode !== undefined && wireProcess.exitCode !== null) {
    return { promise: Promise.resolve(), cancel() {} };
  }
  if (wireProcess.signalCode !== undefined && wireProcess.signalCode !== null) {
    return { promise: Promise.resolve(), cancel() {} };
  }
  if (typeof wireProcess.once !== 'function') return null;

  let settled = false;
  let resolveWait;
  const promise = new Promise((resolve) => {
    resolveWait = resolve;
  });
  const cleanup = () => {
    wireProcess.removeListener?.('exit', finish);
    wireProcess.removeListener?.('close', finish);
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolveWait();
  };
  wireProcess.once('exit', finish);
  wireProcess.once('close', finish);
  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      cleanup();
      resolveWait();
    },
  };
}

function awaitBoundedProviderTermination(terminationPromise, timeoutMs) {
  let timeout;
  return Promise.race([
    Promise.resolve(terminationPromise),
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('Provider process did not close during workspace retirement'));
      }, timeoutMs);
      timeout.unref?.();
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function terminateProviderProcessAndWait(
  wireProcess,
  graceMs = PROVIDER_CLOSE_GRACE_MS,
  forceMs = PROVIDER_CLOSE_FORCE_MS,
) {
  const stopMethod = typeof wireProcess?._stopSession === 'function'
    ? wireProcess._stopSession.bind(wireProcess)
    : (typeof wireProcess?.stop === 'function' ? wireProcess.stop.bind(wireProcess) : null);
  if (typeof wireProcess?.kill !== 'function' && stopMethod) {
    try {
      await awaitBoundedProviderTermination(stopMethod('SIGTERM'), graceMs);
      return;
    } catch (_graceError) {
      await awaitBoundedProviderTermination(stopMethod('SIGKILL'), forceMs);
      return;
    }
  }

  const eventWaiter = typeof wireProcess?._waitForTermination === 'function'
    ? null
    : createWireTerminationWaiter(wireProcess);
  const terminationPromise = () => {
    if (typeof wireProcess?._waitForTermination === 'function') {
      return wireProcess._waitForTermination();
    }
    if (eventWaiter) return eventWaiter.promise;
    return Promise.reject(new Error('Provider process has no termination contract'));
  };

  try {
    const alreadyExited = (wireProcess?.exitCode !== undefined && wireProcess.exitCode !== null)
      || (wireProcess?.signalCode !== undefined && wireProcess.signalCode !== null);
    if (wireProcess && !wireProcess.killed && !alreadyExited) wireProcess.kill('SIGTERM');
    await awaitBoundedProviderTermination(terminationPromise(), graceMs);
  } catch (_graceError) {
    try { wireProcess?.kill?.('SIGKILL'); } catch (_signalError) {}
    await awaitBoundedProviderTermination(terminationPromise(), forceMs);
  }
}

module.exports = { terminateProviderProcessAndWait, PROVIDER_CLOSE_GRACE_MS, PROVIDER_CLOSE_FORCE_MS };
