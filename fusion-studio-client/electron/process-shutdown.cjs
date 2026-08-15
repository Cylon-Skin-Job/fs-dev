function hasExited(child) {
  return !child || child.exitCode != null || child.signalCode != null;
}

function defaultIsProcessAlive(child) {
  if (hasExited(child)) return false;
  if (!Number.isInteger(child.pid)) return true;
  try {
    process.kill(child.pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    return true;
  }
}

function waitForExit(child, timeoutMs, isProcessAlive) {
  if (hasExited(child)) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(pollTimer);
      child.removeListener('exit', onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    const pollTimer = setInterval(() => {
      if (!isProcessAlive(child)) finish(true);
    }, 25);
    child.once('exit', onExit);
  });
}

/**
 * Stop a child process with a bounded graceful period and a forced fallback.
 * The exit listener is installed before each signal so a fast exit cannot race
 * past the waiter.
 */
async function stopChildProcess(child, {
  graceMs = 3000,
  forceMs = 1000,
  log = () => {},
  isProcessAlive = defaultIsProcessAlive,
} = {}) {
  if (hasExited(child)) return { status: 'already-exited' };

  const gracefulExit = waitForExit(child, graceMs, isProcessAlive);
  try {
    child.kill('SIGTERM');
  } catch (error) {
    if (error.code === 'ESRCH' || hasExited(child)) return { status: 'already-exited' };
    throw error;
  }
  if (await gracefulExit) return { status: 'graceful' };

  log(`child pid=${child.pid ?? 'unknown'} did not exit after SIGTERM; sending SIGKILL`);
  const forcedExit = waitForExit(child, forceMs, isProcessAlive);
  try {
    child.kill('SIGKILL');
  } catch (error) {
    if (error.code === 'ESRCH' || hasExited(child)) return { status: 'forced' };
    throw error;
  }
  if (await forcedExit) return { status: 'forced' };

  log(`child pid=${child.pid ?? 'unknown'} remained after SIGKILL`);
  return { status: 'still-running' };
}

module.exports = { hasExited, stopChildProcess };
